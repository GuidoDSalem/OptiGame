import type { DatosBicis, Modelo } from '../../engine/bicis';

/** Supuestos del caso C2 (todos los números del modelo viven acá). */
export const ANCLAJES = 20; // El dataset no publica la capacidad: se supone igual para todas.
export const FLOTA = 300; // La mitad de los anclajes de la zona.
export const HORA_INICIO = 6;
export const HORA_FIN = 12; // A mediodía pasa el segundo camión.

export const modeloDe = (D: Pick<DatosBicis, 'horas'>): Modelo => ({
  capacidad: ANCLAJES,
  flota: FLOTA,
  ventana: D.horas.map((h, i) => (h >= HORA_INICIO && h < HORA_FIN ? i : -1)).filter((i) => i >= 0),
});
