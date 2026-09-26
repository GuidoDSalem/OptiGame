/** Datos del nivel 2. Montos en miles de $ ($k); alcances en miles de personas. */
export const CANALES = [
  { id: 'tv', symbol: 'x_{tv}', label: 'Televisión', alcance: 3.2, jovenes: 0.5, horas: 2, max: 60 },
  { id: 'radio', symbol: 'x_{ra}', label: 'Radio', alcance: 1.8, jovenes: 0.5, horas: 1, max: 30 },
  { id: 'redes', symbol: 'x_{re}', label: 'Redes sociales', alcance: 2.4, jovenes: 2, horas: 2.5, max: 40 },
  { id: 'via', symbol: 'x_{vp}', label: 'Vía pública', alcance: 1.2, jovenes: 0.6, horas: 1, max: 25 },
] as const;

export type CanalId = (typeof CANALES)[number]['id'];

export const DATA = {
  presupuesto: 100, // $k
  horas: 200, // horas del equipo creativo
  jovenesMin: 74, // miles de jóvenes a alcanzar como mínimo
  tvPorRadio: 2, // convenio: TV ≤ 2 × radio
} as const;
