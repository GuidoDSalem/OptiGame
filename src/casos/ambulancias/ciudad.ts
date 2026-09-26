import type { Ciudad } from '../../engine/ambulancias';

/** Ciudad del caso C1 (km en un mapa de 12 × 10). Todos los números del caso viven acá. */
export const CIUDAD: Ciudad = {
  barrios: [
    { id: 'centro', label: 'Centro', x: 6, y: 5, r: 0.9, tasa: 16 },
    { id: 'puerto', label: 'Puerto', x: 9.6, y: 5.6, r: 0.8, tasa: 7 },
    { id: 'norte', label: 'Barrio Norte', x: 6.2, y: 8.2, r: 0.9, tasa: 9 },
    { id: 'estacion', label: 'Estación', x: 3.4, y: 6.4, r: 0.8, tasa: 8 },
    { id: 'parque', label: 'Parque', x: 8.4, y: 2.6, r: 0.9, tasa: 8 },
    { id: 'sur', label: 'Villa Sur', x: 5.2, y: 1.6, r: 1.0, tasa: 11 },
    { id: 'oeste', label: 'Oeste', x: 1.4, y: 3.8, r: 1.0, tasa: 7 },
    { id: 'lomas', label: 'Las Lomas', x: 2.2, y: 8.6, r: 0.9, tasa: 5 },
    { id: 'costanera', label: 'Costanera', x: 11, y: 8.4, r: 0.8, tasa: 5 },
    { id: 'industrial', label: 'Industrial', x: 10.8, y: 1.4, r: 0.9, tasa: 4 },
    { id: 'universidad', label: 'Universidad', x: 8.2, y: 7.4, r: 0.7, tasa: 6 },
    { id: 'jardines', label: 'Jardines', x: 3.2, y: 2.0, r: 0.8, tasa: 6 },
  ],
  bases: [
    { id: 'hospital', label: 'Hospital Central', x: 6.4, y: 5.4, costoFijo: 520, capacidad: 40 },
    { id: 'bomberos', label: 'Cuartel de Bomberos', x: 3.0, y: 5.0, costoFijo: 300, capacidad: 20 },
    { id: 'norte', label: 'Base Norte', x: 5.4, y: 8.6, costoFijo: 280, capacidad: 18 },
    { id: 'puerto', label: 'Base Puerto', x: 10.2, y: 6.4, costoFijo: 290, capacidad: 18 },
    { id: 'sur', label: 'Base Sur', x: 4.6, y: 2.2, costoFijo: 300, capacidad: 20 },
    { id: 'parque', label: 'Base Parque', x: 9.2, y: 2.2, costoFijo: 260, capacidad: 16 },
    { id: 'lomas', label: 'Base Lomas', x: 1.8, y: 7.4, costoFijo: 220, capacidad: 12 },
  ],
  salida: { fijo: 20, porKm: 6 },
  privada: { costo: 110, minutos: 28 },
  tiempo: { despacho: 4, porKm: 2 },
  dias: { sigma: 0.2, probCritico: 0.12, factorCritico: 1.6, probEvento: 0.15, extraEvento: 14 },
};

/** Semillas: una para la muestra que se usa para decidir y otra para los días de validación. */
export const SEMILLA_MUESTRA = 2024;
export const SEMILLA_VALIDACION = 777;

/** Tamaños del análisis que corre la página. */
export const OPCIONES = {
  semillaMuestra: SEMILLA_MUESTRA,
  semillaValidacion: SEMILLA_VALIDACION,
  muestra: 200,
  pozo: 400,
  validacion: 2000,
  tamanos: [
    { n: 5, replicas: 20 },
    { n: 10, replicas: 20 },
    { n: 20, replicas: 20 },
    { n: 50, replicas: 8 },
    { n: 100, replicas: 4 },
    { n: 200, replicas: 2 },
  ],
};
