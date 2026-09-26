/**
 * Caso de estudio C1: bases de ambulancias con días simulados (Montecarlo + SAA).
 *
 * Primera etapa: qué bases operar durante el año (cada una con un costo fijo por día y una
 * cantidad de salidas que sus ambulancias pueden cubrir). Segunda etapa, cada día: asignar las
 * llamadas de cada barrio a las bases abiertas; lo que no se cubre va a una ambulancia privada
 * (cara y lenta). El día se resuelve exacto con un flujo de costo mínimo chico, así se pueden
 * evaluar miles de días y todas las combinaciones de bases.
 */

/* ---------- Números al azar con semilla (reproducibles) ---------- */

/** Generador mulberry32: mismo `seed`, misma secuencia. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normal(r: () => number): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export function poisson(r: () => number, lambda: number): number {
  if (lambda > 40) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal(r)));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= r();
  } while (p > L);
  return k - 1;
}

/* ---------- La ciudad ---------- */

export interface Barrio {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Radio (km) para dibujar y ubicar las llamadas. */
  r: number;
  /** Llamadas por día en un día normal. */
  tasa: number;
}

export interface BaseAmb {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Costo por día de operar la base ($k): personal, alquiler, ambulancias. */
  costoFijo: number;
  /** Salidas por día que pueden cubrir sus ambulancias. */
  capacidad: number;
}

export interface Ciudad {
  barrios: Barrio[];
  bases: BaseAmb[];
  /** Costo de una salida propia: fijo + por km ($k). */
  salida: { fijo: number; porKm: number };
  /** Ambulancia privada: costo por llamada ($k) y minutos de llegada. */
  privada: { costo: number; minutos: number };
  /** Minutos de despacho + minutos por km. */
  tiempo: { despacho: number; porKm: number };
  /** Cómo varían los días. */
  dias: {
    /** Desvío del factor común (log-normal) de un día cualquiera. */
    sigma: number;
    /** Días críticos (ola de calor, fin de semana largo): probabilidad y multiplicador. */
    probCritico: number;
    factorCritico: number;
    /** Eventos locales (recital, partido): probabilidad y llamadas extra en un barrio. */
    probEvento: number;
    extraEvento: number;
  };
}

export interface Dia {
  n: number;
  /** Factor común del día (1 = normal). */
  factor: number;
  critico: boolean;
  /** Barrio con un evento, si hubo. */
  evento: string | null;
  llamadas: Record<string, number>;
}

export const totalLlamadas = (d: Dia) => Object.values(d.llamadas).reduce((a, b) => a + b, 0);

/** Simula `n` días a partir de la semilla. El día k siempre es el mismo para la misma semilla. */
export function simularDias(C: Ciudad, n: number, seed: number, desde = 0): Dia[] {
  return Array.from({ length: n }, (_, i) => simularDia(C, seed, desde + i));
}

export function simularDia(C: Ciudad, seed: number, k: number): Dia {
  const r = rng(seed * 100003 + k * 7919 + 17);
  const { sigma, probCritico, factorCritico, probEvento, extraEvento } = C.dias;
  const critico = r() < probCritico;
  const factor = Math.exp(sigma * normal(r) - (sigma * sigma) / 2) * (critico ? factorCritico : 1);
  const evento = r() < probEvento ? C.barrios[Math.floor(r() * C.barrios.length)].id : null;
  const llamadas = Object.fromEntries(
    C.barrios.map((b) => [b.id, poisson(r, b.tasa * factor + (b.id === evento ? extraEvento : 0))]),
  );
  return { n: k, factor, critico, evento, llamadas };
}

/** Puntos de las llamadas de un día (sólo para dibujar): cada una en algún lugar de su barrio. */
export function puntosDelDia(C: Ciudad, d: Dia, seed: number): { x: number; y: number; barrio: string }[] {
  const r = rng(seed * 31 + d.n * 104729 + 3);
  return C.barrios.flatMap((b) =>
    Array.from({ length: d.llamadas[b.id] ?? 0 }, () => {
      const ang = 2 * Math.PI * r();
      const rad = b.r * Math.sqrt(r());
      return { x: b.x + rad * Math.cos(ang), y: b.y + rad * Math.sin(ang), barrio: b.id };
    }),
  );
}

export const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
export const costoSalida = (C: Ciudad, base: BaseAmb, barrio: Barrio) => C.salida.fijo + C.salida.porKm * distancia(base, barrio);
export const minutosSalida = (C: Ciudad, base: BaseAmb, barrio: Barrio) => C.tiempo.despacho + C.tiempo.porKm * distancia(base, barrio);

/* ---------- Un día: flujo de costo mínimo ---------- */

/** Plan = qué bases se operan, como máscara de bits (bit i = base i). */
export type Plan = number;

export const basesDe = (C: Ciudad, p: Plan) => C.bases.filter((_, i) => p & (1 << i));
export const costoFijo = (C: Ciudad, p: Plan) => C.bases.reduce((s, b, i) => s + (p & (1 << i) ? b.costoFijo : 0), 0);
export const cantidadPlanes = (C: Ciudad) => 1 << C.bases.length;
export const nombrePlan = (C: Ciudad, p: Plan) => basesDe(C, p).map((b) => b.label).join(', ') || 'ninguna base';

export interface ResultadoDia {
  /** Costo de las salidas del día (sin el costo fijo). */
  costo: number;
  /** Llamadas de cada barrio atendidas por cada base: asignacion[base][barrio]. */
  asignacion: number[][];
  /** Llamadas de cada barrio que fueron a una privada. */
  privadas: number[];
  /** Suma de minutos de respuesta de todas las llamadas. */
  minutos: number;
  llamadas: number;
}

/**
 * Asignación óptima de un día con las bases del plan: transporte con capacidad en las bases y
 * la privada como opción ilimitada. Caminos mínimos sucesivos (Dijkstra con potenciales) sobre
 * un grafo de ~20 nodos: exacto y muy rápido.
 */
export function resolverDia(C: Ciudad, p: Plan, d: Dia): ResultadoDia {
  const Z = C.barrios.length;
  const g = grafo(C);
  const costo = flujo(C, g, p, d);
  const cap = g.cap;
  const asignacion = C.bases.map((_, i) => C.barrios.map((_, j) => cap[g.eBarrioBase[i * Z + j] ^ 1]));
  const privadas = C.barrios.map((_, j) => cap[g.ePriv[j] ^ 1]);
  let minutos = 0;
  C.barrios.forEach((z, j) => {
    C.bases.forEach((b, i) => (minutos += asignacion[i][j] * minutosSalida(C, b, z)));
    minutos += privadas[j] * C.privada.minutos;
  });
  return { costo, asignacion, privadas, minutos, llamadas: totalLlamadas(d) };
}

/** Caminos mínimos sucesivos; deja el flujo en `g.cap` y devuelve el costo. */
function flujo(C: Ciudad, g: Grafo, p: Plan, d: Dia): number {
  const B = C.bases.length;
  const { N, T } = g;
  // Capacidades del día: llamadas en la fuente, bases cerradas con capacidad 0.
  const cap = g.cap;
  cap.set(g.cap0);
  C.barrios.forEach((z, j) => (cap[g.eFuente[j]] = d.llamadas[z.id] ?? 0));
  for (let i = 0; i < B; i++) if (!(p & (1 << i))) cap[g.eBaseT[i]] = 0;

  const { to, cost, start, adj, pot, dist, prev, hecho } = g;
  pot.fill(0);
  let costo = 0;
  for (;;) {
    dist.fill(Infinity);
    hecho.fill(0);
    dist[0] = 0;
    for (;;) {
      let u = -1;
      let du = Infinity;
      for (let v = 0; v < N; v++) if (!hecho[v] && dist[v] < du) (du = dist[v]), (u = v);
      if (u < 0) break;
      hecho[u] = 1;
      for (let k = start[u]; k < start[u + 1]; k++) {
        const e = adj[k];
        if (cap[e] <= 1e-9) continue;
        const v = to[e];
        const nd = du + cost[e] + pot[u] - pot[v];
        if (nd < dist[v] - 1e-12) (dist[v] = nd), (prev[v] = e);
      }
    }
    if (dist[T] === Infinity) break;
    for (let v = 0; v < N; v++) if (dist[v] < Infinity) pot[v] += dist[v];
    let f = Infinity;
    for (let v = T; v !== 0; v = to[prev[v] ^ 1]) f = Math.min(f, cap[prev[v]]);
    for (let v = T; v !== 0; v = to[prev[v] ^ 1]) {
      cap[prev[v]] -= f;
      cap[prev[v] ^ 1] += f;
      costo += f * cost[prev[v]];
    }
  }
  return costo;
}

/**
 * Grafo del flujo (se arma una sola vez por ciudad): 0 = fuente, 1..Z = barrios, Z+1..Z+B =
 * bases, Z+B+1 = sumidero. Todas las bases tienen arcos; una base cerrada queda con capacidad 0.
 */
interface Grafo {
  N: number;
  T: number;
  M: number;
  to: Int32Array;
  cost: Float64Array;
  cap0: Float64Array;
  cap: Float64Array;
  start: Int32Array;
  adj: Int32Array;
  eFuente: number[];
  eBarrioBase: number[];
  ePriv: number[];
  eBaseT: number[];
  pot: Float64Array;
  dist: Float64Array;
  prev: Int32Array;
  hecho: Uint8Array;
}

const grafos = new WeakMap<Ciudad, Grafo>();

function grafo(C: Ciudad): Grafo {
  const hit = grafos.get(C);
  if (hit) return hit;
  const B = C.bases.length;
  const Z = C.barrios.length;
  const N = Z + B + 2;
  const T = N - 1;
  const to: number[] = [];
  const cost: number[] = [];
  const cap0: number[] = [];
  const from: number[] = [];
  const arco = (u: number, v: number, c: number, w: number) => {
    const e = to.length;
    to.push(v, u), cost.push(w, -w), cap0.push(c, 0), from.push(u, v);
    return e;
  };
  const BIG = 1e9;
  const eFuente = C.barrios.map((_, j) => arco(0, 1 + j, 0, 0));
  const eBarrioBase: number[] = new Array(B * Z);
  C.bases.forEach((b, i) => C.barrios.forEach((z, j) => (eBarrioBase[i * Z + j] = arco(1 + j, 1 + Z + i, BIG, costoSalida(C, b, z)))));
  const ePriv = C.barrios.map((_, j) => arco(1 + j, T, BIG, C.privada.costo));
  const eBaseT = C.bases.map((b, i) => arco(1 + Z + i, T, b.capacidad, 0));
  const M = to.length;
  // Lista de adyacencia compacta (CSR).
  const start = new Int32Array(N + 1);
  from.forEach((u) => start[u + 1]++);
  for (let v = 0; v < N; v++) start[v + 1] += start[v];
  const fill = start.slice(0, N);
  const adj = new Int32Array(M);
  from.forEach((u, e) => (adj[fill[u]++] = e));
  const g: Grafo = {
    N,
    T,
    M,
    to: Int32Array.from(to),
    cost: Float64Array.from(cost),
    cap0: Float64Array.from(cap0),
    cap: new Float64Array(M),
    start,
    adj,
    eFuente,
    eBarrioBase,
    ePriv,
    eBaseT,
    pot: new Float64Array(N),
    dist: new Float64Array(N),
    prev: new Int32Array(N),
    hecho: new Uint8Array(N),
  };
  grafos.set(C, g);
  return g;
}

/** Sólo el costo de un día (sin armar la asignación): lo que usa la tabla de miles de días. */
export const costoDia = (C: Ciudad, p: Plan, d: Dia) => flujo(C, grafo(C), p, d);

/* ---------- Muchos días ---------- */

/**
 * Tabla de costos de segunda etapa: fila = día, columna = plan. Con ella, el costo esperado de
 * cualquier plan sobre cualquier muestra de días es un promedio de columna.
 */
export function tablaCostos(C: Ciudad, dias: Dia[], alAvanzar?: (hechos: number) => void): Float64Array {
  const P = cantidadPlanes(C);
  const t = new Float64Array(dias.length * P);
  dias.forEach((d, i) => {
    for (let p = 0; p < P; p++) t[i * P + p] = costoDia(C, p, d);
    alAvanzar?.(i + 1);
  });
  return t;
}

/** El mejor plan para una muestra de días (filas de la tabla): prueba todas las combinaciones. */
export function mejorPlan(C: Ciudad, tabla: Float64Array, filas: number[]): { plan: Plan; valor: number } {
  const P = cantidadPlanes(C);
  let mejor = { plan: 0, valor: Infinity };
  for (let p = 0; p < P; p++) {
    let s = 0;
    for (const f of filas) s += tabla[f * P + p];
    const v = costoFijo(C, p) + s / filas.length;
    if (v < mejor.valor - 1e-9) mejor = { plan: p, valor: v };
  }
  return mejor;
}

/** El plan óptimo de cada día por separado (lo que se haría sabiendo cómo viene el día). */
export const planesPorDia = (C: Ciudad, tabla: Float64Array, filas: number[]) => filas.map((f) => mejorPlan(C, tabla, [f]));

/** Frecuencia con que cada base aparece en los planes óptimos de cada día. */
export const frecuencias = (C: Ciudad, planes: Plan[]) => C.bases.map((_, i) => planes.filter((p) => p & (1 << i)).length / planes.length);

/** Plan por votación: las bases que aparecen en más de la mitad de los óptimos diarios. */
export const planPorVoto = (C: Ciudad, planes: Plan[]): Plan =>
  frecuencias(C, planes).reduce((m, f, i) => (f > 0.5 ? m | (1 << i) : m), 0);

/** Plan para el día promedio: las llamadas promedio de la muestra, como si fueran seguras. */
export function planPromedio(C: Ciudad, dias: Dia[]): Plan {
  const prom: Dia = {
    n: -1,
    factor: 1,
    critico: false,
    evento: null,
    llamadas: Object.fromEntries(C.barrios.map((b) => [b.id, dias.reduce((s, d) => s + d.llamadas[b.id], 0) / dias.length])),
  };
  const t = tablaCostos(C, [prom]);
  return mejorPlan(C, t, [0]).plan;
}

export interface Evaluacion {
  plan: Plan;
  /** Costo total (fijo + salidas) de cada día. */
  costos: number[];
  /** Minutos promedio de respuesta de cada día. */
  minutosDia: number[];
  /** Fracción de llamadas que fueron a privadas, cada día. */
  privadasDia: number[];
  media: number;
  p95: number;
  peor: number;
  minutosMedia: number;
  minutosP95: number;
  privadasMedia: number;
  /** Error estándar de la media (para el intervalo de confianza). */
  errorEstandar: number;
}

export const percentil = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};
const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Cómo le va a un plan en una muestra de días (típicamente días nuevos, fuera de muestra). */
export function evaluarPlan(C: Ciudad, p: Plan, dias: Dia[]): Evaluacion {
  const fijo = costoFijo(C, p);
  const rs = dias.map((d) => resolverDia(C, p, d));
  const costos = rs.map((r) => fijo + r.costo);
  const minutosDia = rs.map((r) => (r.llamadas ? r.minutos / r.llamadas : 0));
  const privadasDia = rs.map((r) => (r.llamadas ? r.privadas.reduce((a, b) => a + b, 0) / r.llamadas : 0));
  const m = media(costos);
  const sd = Math.sqrt(costos.reduce((s, c) => s + (c - m) ** 2, 0) / Math.max(1, costos.length - 1));
  return {
    plan: p,
    costos,
    minutosDia,
    privadasDia,
    media: m,
    p95: percentil(costos, 0.95),
    peor: Math.max(...costos),
    minutosMedia: media(minutosDia),
    minutosP95: percentil(minutosDia, 0.95),
    privadasMedia: media(privadasDia),
    errorEstandar: sd / Math.sqrt(costos.length),
  };
}
