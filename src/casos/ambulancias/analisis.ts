/**
 * Todo el análisis del caso C1, como función pura (la corre el Web Worker de la página y la
 * usan los tests). No importa nada de React.
 */
import {
  cantidadPlanes,
  evaluarPlan,
  frecuencias,
  mejorPlan,
  planPorVoto,
  planPromedio,
  planesPorDia,
  simularDias,
  tablaCostos,
  type Ciudad,
  type Evaluacion,
  type Plan,
} from '../../engine/ambulancias';

export interface OpcionesAnalisis {
  semillaMuestra: number;
  semillaValidacion: number;
  /** Días de la muestra principal (con la que se decide). */
  muestra: number;
  /** Días disponibles para las réplicas del estudio de tamaño de muestra (incluye la muestra). */
  pozo: number;
  /** Días nuevos para validar fuera de muestra. */
  validacion: number;
  /** Tamaños de muestra a estudiar y cuántas réplicas de cada uno. */
  tamanos: { n: number; replicas: number }[];
}

export interface EstudioTamano {
  n: number;
  /** Óptimo en la muestra de cada réplica (lo que "promete" el modelo). */
  prometido: number[];
  /** Costo real (fuera de muestra) del plan elegido en cada réplica. */
  real: number[];
  planes: Plan[];
}

export interface Analisis {
  /** Plan óptimo de cada día de la muestra, resuelto por separado. */
  diarios: Plan[];
  frecuencias: number[];
  voto: Plan;
  promedio: Plan;
  saa: { plan: Plan; valor: number };
  /** Todas las bases (el plan "por las dudas"). */
  todas: Plan;
  /** Costo esperado en la muestra de cada plan destacado (lo que promete). */
  enMuestra: Record<string, number>;
  /** Evaluación fuera de muestra de cada plan que aparece en el análisis. */
  evaluaciones: Record<number, Evaluacion>;
  tamanos: EstudioTamano[];
  /** Combinaciones día × plan resueltas. */
  resueltos: number;
}

export type Progreso = (fase: string, hecho: number, total: number) => void;

export function analizar(C: Ciudad, o: OpcionesAnalisis, progreso?: Progreso): Analisis {
  const P = cantidadPlanes(C);
  const pozo = simularDias(C, o.pozo, o.semillaMuestra);
  const tabla = tablaCostos(C, pozo, (h) => progreso?.('muestra', h * P, o.pozo * P));
  const filas = Array.from({ length: o.muestra }, (_, i) => i);

  const diarios = planesPorDia(C, tabla, filas).map((m) => m.plan);
  const voto = planPorVoto(C, diarios);
  const promedio = planPromedio(C, pozo.slice(0, o.muestra));
  const saa = mejorPlan(C, tabla, filas);
  const todas = P - 1;
  const promesa = (p: Plan) => mejorValor(C, tabla, filas, p);

  // Réplicas: muestras disjuntas (en lo posible) del pozo, de cada tamaño.
  const tamanosCrudos = o.tamanos.map(({ n, replicas }) =>
    Array.from({ length: replicas }, (_, r) => {
      const inicio = (r * n) % Math.max(1, o.pozo - n + 1);
      return mejorPlan(C, tabla, Array.from({ length: n }, (_, i) => inicio + i));
    }),
  );

  const validacion = simularDias(C, o.validacion, o.semillaValidacion);
  const aEvaluar = [...new Set([voto, promedio, saa.plan, todas, ...tamanosCrudos.flat().map((m) => m.plan)])];
  const evaluaciones: Record<number, Evaluacion> = {};
  aEvaluar.forEach((p, k) => {
    evaluaciones[p] = evaluarPlan(C, p, validacion);
    progreso?.('validacion', k + 1, aEvaluar.length);
  });

  return {
    diarios,
    frecuencias: frecuencias(C, diarios),
    voto,
    promedio,
    saa,
    todas,
    enMuestra: { voto: promesa(voto), promedio: promesa(promedio), saa: saa.valor, todas: promesa(todas) },
    evaluaciones,
    tamanos: o.tamanos.map(({ n }, k) => ({
      n,
      prometido: tamanosCrudos[k].map((m) => m.valor),
      real: tamanosCrudos[k].map((m) => evaluaciones[m.plan].media),
      planes: tamanosCrudos[k].map((m) => m.plan),
    })),
    resueltos: o.pozo * P + aEvaluar.length * o.validacion,
  };
}

/** Costo esperado de un plan dado en una muestra (fijo + promedio de la columna). */
function mejorValor(C: Ciudad, tabla: Float64Array, filas: number[], p: Plan): number {
  const P = cantidadPlanes(C);
  let s = 0;
  for (const f of filas) s += tabla[f * P + p];
  return C.bases.reduce((t, b, i) => t + (p & (1 << i) ? b.costoFijo : 0), 0) + s / filas.length;
}
