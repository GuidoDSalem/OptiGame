import type { LPModel } from './model';
import { solve, type SolveStatus } from './solver';

export interface BumpResult {
  status: SolveStatus;
  /** Objetivo con el lado derecho aumentado. */
  objective?: number;
  /** Cambio real del objetivo respecto de la solución original. */
  delta?: number;
}

/**
 * Re-resuelve el modelo con el lado derecho de la restricción `index` aumentado en `amount`.
 * Sirve para comprobar que el precio sombra predice el cambio del objetivo.
 */
export async function bumpRhs(model: LPModel, index: number, baseObjective: number, amount = 1): Promise<BumpResult> {
  const bumped: LPModel = {
    ...model,
    constraints: model.constraints.map((c, i) => (i === index ? { ...c, rhs: c.rhs + amount } : c)),
  };
  const r = await solve(bumped);
  if (r.status !== 'optimal' || r.objective === undefined) return { status: r.status };
  return { status: r.status, objective: r.objective, delta: Math.round((r.objective - baseObjective) * 1e6) / 1e6 };
}

/** ¿Un cambio `delta` en el objetivo es bueno para el cliente? */
export const improves = (sense: LPModel['sense'], delta: number) => (sense === 'min' ? delta < 0 : delta > 0);
