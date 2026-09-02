// ─────────────────────────────────────────────────────────────────────────
// bot-teco.mjs — Función serverless del chatbot "Teco" de Tecolutla.Travel.
//
// COMPLETAMENTE SEPARADA del bot de Xanath (ese vive en Make + Chatwoot).
// Esta función:
//   1. Recibe { visitorId, text, pagePath } por POST.
//   2. Arma el system prompt (reglas) + el catálogo real de negocios (datos).
//   3. Recuerda la conversación por visitorId (Netlify Blobs).
//   4. Llama a la API de Claude con la llave DEDICADA de Teco.
//   5. Devuelve { reply } en markdown.
//
// La llave NUNCA va en el código: se lee de la variable de entorno de Netlify
//   ANTHROPIC_API_KEY_TECO  (la crea Hector en Netlify; nadie más la ve).
// ─────────────────────────────────────────────────────────────────────────
import { getStore } from '@netlify/blobs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import catalogo from './_datos-bot/catalogo-negocios.json' with { type: 'json' };
import { SYSTEM_PROMPT, construirContexto } from './_datos-bot/prompt-teco.mjs';

// Config (ajustable sin tocar la lógica) ──────────────────────────────────
const MODEL = process.env.BOT_TECO_MODEL || 'claude-sonnet-5';
const MAX_TOKENS = 1024;             // respuestas cortas
const MAX_TEXTO = 2000;              // tope de caracteres del mensaje del visitante
const MAX_HISTORIAL = 12;            // pares de mensajes que se recuerdan (memoria)
const RATE_LIMITE = 15;             // máx. mensajes...
const RATE_VENTANA_MS = 60000;      // ...por minuto y por IP (freno al abuso de tokens)
const API_URL = 'https://api.anthropic.com/v1/messages';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Verifica el "pase" (token) firmado por bot-teco-token.mjs (mismo secreto: la llave).
function tokenValido(token, secreto) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, firma] = token.split('.');
  if (!payload || !firma) return false;
  const esperada = Buffer.from(createHmac('sha256', secreto).update(payload).digest())
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const datos = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof datos.exp === 'number' && Date.now() < datos.exp;
  } catch {
    return false;
  }
}

// Registra un intento sospechoso: consola (logs de Netlify) + últimos 50 en Blobs.
async function registrarSospechoso(motivo, ip, extra) {
  console.warn(`[TECO-SOSPECHOSO] ${motivo} ip=${ip} ${extra || ''}`);
  try {
    const store = getStore({ name: 'bot-teco-alertas', consistency: 'strong' });
    const prev = (await store.get('log', { type: 'json' })) || { eventos: [] };
    prev.eventos.push({
      ts: new Date().toISOString(),
      motivo,
      ip: String(ip || '').slice(0, 45),
      extra: extra ? String(extra).slice(0, 120) : '',
    });
    prev.eventos = prev.eventos.slice(-50);
    await store.setJSON('log', prev);
  } catch {
    /* si el registro falla, no bloquea */
  }
}

// Detecta qué negocios recomendó el bot (por los enlaces de su respuesta) y
// arma la tarjeta visual de cada uno con datos REALES del catálogo.
// Así el chat muestra foto + nombre + chips, como la competencia, pero sin
// un segundo endpoint: todo viaja en la misma respuesta.
function extraerTarjetas(reply, negocios) {
  const porUrl = new Map(negocios.map((n) => [n.url, n]));
  const tarjetas = [];
  const vistos = new Set();
  const regex = /\]\((\/[a-z0-9\-]+\/[a-z0-9\-]+)\)/gi;
  let m;
  while ((m = regex.exec(reply)) !== null) {
    const url = m[1];
    if (vistos.has(url)) continue;
    const n = porUrl.get(url);
    if (!n) continue;
    vistos.add(url);
    tarjetas.push({
      nombre: n.nombre,
      url: n.url,
      foto: n.foto || null,
      chips: Array.isArray(n.chips) ? n.chips : [],
      categoria: n.categoriaEtiqueta || n.categoria || '',
      catSlug: n.categoria || '',
      telefono: n.telefono || null,
    });
    if (tarjetas.length >= 4) break; // no saturar el chat
  }
  return tarjetas;
}

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Método no permitido' }, 405);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY_TECO;
  if (!apiKey) {
    // El bot aún no está encendido (falta la llave en Netlify).
    return json({ ok: false, error: 'bot-no-configurado' }, 503);
  }

  // IP del visitante (para el límite y para registrar intentos sospechosos).
  const ip = request.headers.get('x-nf-client-connection-ip')
    || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'desconocida';

  // Solo acepta peticiones desde el propio sitio (bloquea abuso cruzado desde otros orígenes).
  const origenCrudo = request.headers.get('origin') || request.headers.get('referer') || '';
  const host = request.headers.get('host') || '';
  if (origenCrudo && host) {
    try {
      if (new URL(origenCrudo).host !== host) {
        await registrarSospechoso('origen-no-permitido', ip, origenCrudo);
        return json({ ok: false, error: 'origen-no-permitido' }, 403);
      }
    } catch {
      /* header raro: no bloqueamos por esto */
    }
  }

  // Límite de frecuencia por IP: freno al abuso que gastaría tokens con spam.
  try {
    const rateStore = getStore({ name: 'bot-teco-rate', consistency: 'strong' });
    const ahora = Date.now();
    let rl = await rateStore.get(ip, { type: 'json' });
    if (!rl || ahora > rl.resetAt) rl = { count: 0, resetAt: ahora + RATE_VENTANA_MS };
    rl.count += 1;
    await rateStore.setJSON(ip, rl);
    if (rl.count > RATE_LIMITE) {
      await registrarSospechoso('demasiadas-peticiones', ip, `count=${rl.count}`);
      return json({ ok: false, error: 'demasiadas-peticiones' }, 429);
    }
  } catch {
    /* si el contador falla, no bloqueamos al visitante legítimo */
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }

  // Verifica el "pase" (token): quien no cargó la página no puede usar el bot.
  if (!tokenValido(cuerpo.token, apiKey)) {
    await registrarSospechoso('token-invalido', ip, origenCrudo);
    return json({ ok: false, error: 'token-invalido' }, 401);
  }

  const visitorId = typeof cuerpo.visitorId === 'string' ? cuerpo.visitorId.slice(0, 80) : '';
  const texto = typeof cuerpo.text === 'string' ? cuerpo.text.trim().slice(0, MAX_TEXTO) : '';
  const pagePath = typeof cuerpo.pagePath === 'string' ? cuerpo.pagePath.slice(0, 200) : '';

  if (!visitorId || !texto) {
    return json({ ok: false, error: 'Faltan datos (visitorId y text)' }, 400);
  }

  // ── Memoria por visitante ───────────────────────────────────────────────
  const store = getStore({ name: 'bot-teco-memoria', consistency: 'strong' });
  let historial = [];
  try {
    const previo = await store.get(visitorId, { type: 'json' });
    if (previo && Array.isArray(previo.mensajes)) historial = previo.mensajes;
  } catch {
    // Si Blobs falla, seguimos sin memoria (mejor responder que caer).
    historial = [];
  }

  // Mensajes para la API: historial recortado + el nuevo mensaje del usuario.
  const mensajes = [...historial, { role: 'user', content: texto }].slice(-MAX_HISTORIAL * 2);

  // System = reglas (estable) + catálogo real (datos) + contexto de página.
  const system = `${SYSTEM_PROMPT}\n\n${construirContexto(catalogo, pagePath)}`;

  // ── Llamada a la API de Claude ─────────────────────────────────────────
  let reply;
  let usoTokens = null; // { input_tokens, output_tokens } — viene en la misma respuesta
  try {
    const respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: mensajes,
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '');
      console.error('bot-teco: error API', respuesta.status, detalle.slice(0, 500));
      return json({ ok: false, error: 'ia-no-disponible' }, 502);
    }

    const datos = await respuesta.json();
    usoTokens = datos.usage || null;
    reply = (datos.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!reply) {
      return json({ ok: false, error: 'respuesta-vacia' }, 502);
    }
  } catch (error) {
    console.error('bot-teco: excepción', String(error && error.message ? error.message : error));
    return json({ ok: false, error: 'ia-no-disponible' }, 502);
  }

  // ── Guardar memoria (best effort — no bloquea la respuesta) ─────────────
  try {
    const nuevos = [...mensajes, { role: 'assistant', content: reply }].slice(-MAX_HISTORIAL * 2);
    await store.setJSON(visitorId, { mensajes: nuevos, actualizado: new Date().toISOString() });
  } catch (error) {
    console.error('bot-teco: no se pudo guardar memoria', String(error && error.message ? error.message : error));
  }

  // ── Registrar uso de tokens por mes y por modelo (para ver el gasto y comparar
  //    Sonnet vs Haiku). Best effort: si falla, no afecta al visitante. ─────────
  if (usoTokens) {
    try {
      const usoStore = getStore({ name: 'bot-teco-uso', consistency: 'strong' });
      const mes = new Date().toISOString().slice(0, 7); // "2026-09"
      const prev = (await usoStore.get('uso', { type: 'json' })) || { porMes: {} };
      const mesObj = prev.porMes[mes] || {};
      const m = mesObj[MODEL] || { entrada: 0, salida: 0, mensajes: 0 };
      m.entrada += usoTokens.input_tokens || 0;
      m.salida += usoTokens.output_tokens || 0;
      m.mensajes += 1;
      mesObj[MODEL] = m;
      prev.porMes[mes] = mesObj;
      await usoStore.setJSON('uso', prev);
    } catch {
      /* best effort */
    }
  }

  const tarjetas = extraerTarjetas(reply, catalogo.negocios);

  // "Ver más" por sección, según las categorías que se recomendaron (enlace correcto y automático)
  const SECCIONES = {
    hospedaje: { plural: 'hospedajes', label: 'Hospedaje', url: '/hospedaje' },
    gastronomia: { plural: 'lugares para comer', label: 'Gastronomía', url: '/gastronomia' },
    actividades: { plural: 'actividades y paseos', label: 'Actividades', url: '/actividades' },
  };
  const catsVistas = [];
  for (const t of tarjetas) {
    if (t.catSlug && SECCIONES[t.catSlug] && !catsVistas.includes(t.catSlug)) catsVistas.push(t.catSlug);
  }
  const verMas = catsVistas.map((c) => SECCIONES[c]);

  return json({ ok: true, reply, tarjetas, verMas });
};
