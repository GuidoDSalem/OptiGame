/**
 * Optimización con dos objetivos: maximizar F y minimizar G (p. ej. empleos vs. emisiones).
 */
import { lhs, type LPModel } from './model';
import { solve } from './solver';

export interface ParetoPoint {
  /** Valor del objetivo a maximizar (F). */
  f: number;
  /** Valor del objetivo a minimizar (G). */
  g: number;
  values: Record<string, number>;
  /** ¿La suma ponderada max F − λG lo encuentra para algún λ ≥ 0? */
  soportado: boolean;
}

/**
 * Frontera de Pareto exacta por ε-restricción: max F con G ≤ ε, y para ese F se minimiza G
 * (para no quedarse con puntos "débilmente" eficientes). Después se baja ε por debajo del G
 * encontrado y se repite hasta que no haya solución.
 */
export async function fronteraEpsilon(
  base: LPModel,
  F: Record<string, number>,
  G: Record<string, number>,
  paso = 1,
  maxPuntos = 60,
): Promise<ParetoPoint[]> {
  const out: Omit<ParetoPoint, 'soportado'>[] = [];
  let eps = Infinity;
  for (let k = 0; k < maxPuntos; k++) {
    const cap = Number.isFinite(eps) ? [{ id: 'eps_cap', name: 'ε', coefs: G, op: '<=' as const, rhs: eps }] : [];
    const r1 = await solve({ ...base, sense: 'max', objective: F, constraints: [...base.constraints, ...cap] });
    if (r1.status !== 'optimal') break;
    const fStar = r1.objective!;
    const r2 = await solve({
      ...base,
      sense: 'min',
      objective: G,
      constraints: [...base.constraints, ...cap, { id: 'f_fix', name: 'F', coefs: F, op: '>=', rhs: fStar - 1e-6 }],
    });
    const values = r2.status === 'optimal' ? r2.values : r1.values;
    const g = lhs(G, values);
    out.push({ f: lhs(F, values), g, values });
    eps = g - paso;
  }
  return marcarSoportados(out);
}

/**
 * Un punto es "soportado" si está sobre la envolvente cóncava de la frontera (en el plano
 * G→F): son los únicos que la suma ponderada puede encontrar.
 */
export function marcarSoportados(points: Omit<ParetoPoint, 'soportado'>[]): ParetoPoint[] {
  const sorted = [...points].sort((a, b) => a.g - b.g || b.f - a.f);
  const hull: typeof sorted = [];
  const cross = (o: (typeof sorted)[0], a: (typeof sorted)[0], b: (typeof sorted)[0]) =>
    (a.g - o.g) * (b.f - o.f) - (a.f - o.f) * (b.g - o.g);
  for (const p of sorted) {
    // Envolvente superior: se descartan los puntos que quedan por debajo del segmento.
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) >= 0) hull.pop();
    hull.push(p);
  }
  const onHull = new Set(hull);
  // Los puntos alineados sobre un segmento de la envolvente también son soportados.
  const soportado = (p: (typeof sorted)[0]) =>
    onHull.has(p) ||
    hull.some((a, i) => {
      const b = hull[i + 1];
      return b && p.g >= a.g && p.g <= b.g && Math.abs(cross(a, b, p)) < 1e-9;
    });
  return sorted.map((p) => ({ ...p, soportado: soportado(p) }));
}
