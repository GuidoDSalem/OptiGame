/**
 * Utilidades de ruteo (TSP): circuitos, heurísticas y cortes. Trabaja con variables de arco
 * `x_{i}_{j}` (1 = se va de i a j).
 */
import type { Constraint, LPModel, VariableSpec } from './model';

export interface Punto {
  id: string;
  x: number;
  y: number;
}

export type Dist = (a: string, b: string) => number;

/** Distancia "en cuadras": en una ciudad en grilla no se puede ir en diagonal. */
export function manhattan(points: Punto[]): Dist {
  const byId = new Map(points.map((p) => [p.id, p]));
  return (a, b) => {
    const p = byId.get(a)!;
    const q = byId.get(b)!;
    return Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
  };
}

export const arcId = (i: string, j: string) => `x_${i}_${j}`;

/** Largo de un recorrido que sale y vuelve al primer lugar de la lista. */
export function routeLength(route: string[], d: Dist, closed = true): number {
  let s = 0;
  for (let k = 1; k < route.length; k++) s += d(route[k - 1], route[k]);
  if (closed && route.length > 1) s += d(route[route.length - 1], route[0]);
  return s;
}

/** Valores de las variables de arco para un recorrido (cerrado si visita todo). */
export function arcsFromRoute(route: string[], closed: boolean): Record<string, number> {
  const out: Record<string, number> = {};
  for (let k = 1; k < route.length; k++) out[arcId(route[k - 1], route[k])] = 1;
  if (closed && route.length > 1) out[arcId(route[route.length - 1], route[0])] = 1;
  return out;
}

export interface Analisis {
  /** Circuitos encontrados siguiendo los arcos usados (cada uno como lista de lugares). */
  circuitos: string[][];
  /** Lugares con cantidad de salidas o llegadas distinta de 1. */
  gradoMal: string[];
  /** Arcos con valor fraccionario. */
  fraccionarios: string[];
}

/** Descompone una solución en circuitos. */
export function analizar(nodes: string[], values: Record<string, number>): Analisis {
  const next = new Map<string, string>();
  const outDeg = new Map(nodes.map((n) => [n, 0]));
  const inDeg = new Map(nodes.map((n) => [n, 0]));
  const fraccionarios: string[] = [];
  for (const i of nodes)
    for (const j of nodes) {
      if (i === j) continue;
      const v = values[arcId(i, j)] ?? 0;
      if (v > 1e-6 && v < 1 - 1e-6) fraccionarios.push(arcId(i, j));
      if (v > 0.5) {
        next.set(i, j);
        outDeg.set(i, outDeg.get(i)! + 1);
        inDeg.set(j, inDeg.get(j)! + 1);
      }
    }
  const gradoMal = nodes.filter((n) => outDeg.get(n) !== 1 || inDeg.get(n) !== 1);

  const circuitos: string[][] = [];
  const seen = new Set<string>();
  for (const start of nodes) {
    if (seen.has(start) || !next.has(start)) continue;
    const c: string[] = [];
    let cur: string | undefined = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      c.push(cur);
      cur = next.get(cur);
    }
    if (cur === start) circuitos.push(c);
  }
  return { circuitos, gradoMal, fraccionarios };
}

/** Heurística del vecino más cercano: siempre ir al lugar sin visitar más cercano. */
export function vecinoMasCercano(nodes: string[], depot: string, d: Dist): string[] {
  const route = [depot];
  const left = new Set(nodes.filter((n) => n !== depot));
  while (left.size) {
    const cur = route[route.length - 1];
    let best: string | null = null;
    for (const n of left) if (best === null || d(cur, n) < d(cur, best)) best = n;
    route.push(best!);
    left.delete(best!);
  }
  return route;
}

/**
 * Mejora 2-opt: si dos tramos se "cruzan", invertir el pedazo entre ellos acorta la ruta.
 * Repite mientras encuentre mejoras. El depósito queda primero.
 */
export function dosOpt(route: string[], d: Dist): string[] {
  let r = [...route];
  let improved = true;
  while (improved) {
    improved = false;
    for (let a = 1; a < r.length - 1; a++) {
      for (let b = a + 1; b < r.length; b++) {
        const cand = [...r.slice(0, a), ...r.slice(a, b + 1).reverse(), ...r.slice(b + 1)];
        if (routeLength(cand, d) < routeLength(r, d) - 1e-9) {
          r = cand;
          improved = true;
        }
      }
    }
  }
  return r;
}

/**
 * Cortes de eliminación de subtours: para cada circuito S que no pasa por todos los lugares,
 * Σ_{i,j ∈ S} x_ij ≤ |S| − 1 (no se puede cerrar un circuito dentro de S).
 */
export function cortesSubtour(
  nodes: string[],
  circuitos: string[][],
  nombre = 'Sin subtour',
  label: (id: string) => string = (id) => id,
): Constraint[] {
  return circuitos
    .filter((c) => c.length < nodes.length)
    .map((S) => {
      const coefs: Record<string, number> = {};
      for (const i of S) for (const j of S) if (i !== j) coefs[arcId(i, j)] = 1;
      return { id: `cut_${S.join('_')}`, name: `${nombre}: {${S.map(label).join(', ')}}`, coefs, op: '<=' as const, rhs: S.length - 1 };
    });
}

/**
 * Formulación MTZ (Miller–Tucker–Zemlin): agrega un "orden de visita" u_i a cada cliente y
 * u_i − u_j + n·x_ij ≤ n − 1 prohíbe los subtours sin enumerarlos. Se usa para el óptimo de
 * referencia.
 */
export function conMTZ(model: LPModel, nodes: string[], depot: string): LPModel {
  const clients = nodes.filter((n) => n !== depot);
  const n = clients.length;
  const u = (i: string) => `u_${i}`;
  const variables: VariableSpec[] = [...model.variables, ...clients.map((i) => ({ id: u(i), lb: 1, ub: n }))];
  const constraints: Constraint[] = [...model.constraints];
  for (const i of clients)
    for (const j of clients) {
      if (i === j) continue;
      constraints.push({
        id: `mtz_${i}_${j}`,
        name: `MTZ ${i}→${j}`,
        coefs: { [u(i)]: 1, [u(j)]: -1, [arcId(i, j)]: n },
        op: '<=',
        rhs: n - 1,
      });
    }
  return { ...model, variables, constraints };
}
