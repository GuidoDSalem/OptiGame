/** Datos del nivel 3. Cantidades en camiones por semana; costos en miles de $ por camión. */
export const PLANTAS = [
  { id: 'raf', label: 'Rafaela', short: 'Raf', oferta: 30 },
  { id: 'sun', label: 'Sunchales', short: 'Sun', oferta: 25 },
  { id: 'esp', label: 'Esperanza', short: 'Esp', oferta: 20 },
] as const;

export const CENTROS = [
  { id: 'ros', label: 'Rosario', short: 'Ros', demanda: 25 },
  { id: 'sfe', label: 'Santa Fe', short: 'SFe', demanda: 15 },
  { id: 'cba', label: 'Córdoba', short: 'Cba', demanda: 20 },
  { id: 'par', label: 'Paraná', short: 'Par', demanda: 10 },
] as const;

/** Costo por camión (en $k) de cada planta a cada centro. */
export const COSTO: Record<string, Record<string, number>> = {
  raf: { ros: 9, sfe: 4, cba: 8, par: 6 },
  sun: { ros: 10, sfe: 5, cba: 7, par: 7 },
  esp: { ros: 6, sfe: 2, cba: 10, par: 3 },
};
