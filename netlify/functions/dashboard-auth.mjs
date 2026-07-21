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
    // DIAGNOSTICO TEMPORAL — no revela el valor, solo longitudes y si un
    // trim() arregla la comparacion (espacios extra al copiar/pegar).
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'Contraseña incorrecta',
        diagnostico: {
          variableConfigurada: Boolean(process.env.DASHBOARD_SECRET),
          longitudEsperada: process.env.DASHBOARD_SECRET?.length ?? 0,
          longitudRecibida: clave?.length ?? 0,
          coincideConTrim: clave?.trim() === process.env.DASHBOARD_SECRET?.trim(),
        },
      }),
      { status: 401 },
    );
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
