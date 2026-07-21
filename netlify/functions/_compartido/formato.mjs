export const NOMBRES_CANAL = {
  google: 'Google',
  instagram: 'Instagram',
  facebook: 'Facebook',
  directo: 'directo',
  interno: 'el sitio',
  otro: 'otros canales',
};

export function claveMesActual() {
  return new Date().toISOString().slice(0, 7); // "2026-07"
}

export function nombreMes(clave) {
  const [anio, mes] = clave.split('-').map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString('es-MX', { month: 'long' });
}

export function claveMesAnterior(clave) {
  const [anio, mes] = clave.split('-').map(Number);
  const fecha = new Date(anio, mes - 2, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

export function entradaPrincipal(mapa) {
  const entradas = Object.entries(mapa || {});
  if (entradas.length === 0) return null;
  entradas.sort((a, b) => b[1] - a[1]);
  return entradas[0][0];
}
