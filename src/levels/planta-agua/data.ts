/** Datos del nivel 1. Todo lo numérico vive acá para que historia, modelo y mundo no se desincronicen. */
export const DATA = {
  demanda: 60, // ML/día que necesita la ciudad
  capRio: 50, // ML/día máximo que se puede bombear del río
  capPozo: 40, // ML/día máximo del pozo
  salRio: 200, // mg/L de sales disueltas en el agua de río
  salPozo: 950, // mg/L en el agua de pozo
  salMax: 500, // mg/L permitido en el agua potable
  coagRio: 3, // kg de coagulante por ML de agua de río (es turbia)
  coagPozo: 1, // kg por ML de agua de pozo
  coagStock: 160, // kg de coagulante disponibles por día
  costoRio: 120, // $ por ML (tratamiento)
  costoPozo: 80, // $ por ML (bombeo)
} as const;
