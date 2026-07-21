// Valida la contraseña del dashboard interno. Variable separada de
// WEBHOOK_SECRET a propósito, para no mezclar la credencial del bot de
// WhatsApp con la del panel interno.
export default async (request) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Método no permitido' }), {
      status: 405,
    });
  }

  let cuerpo;
  try {
    cuerpo = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'JSON inválido' }), { status: 400 });
  }

  const { clave } = cuerpo;
  if (!process.env.DASHBOARD_SECRET || clave !== process.env.DASHBOARD_SECRET) {
    return new Response(JSON.stringify({ ok: false, error: 'Contraseña incorrecta' }), {
      status: 401,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
