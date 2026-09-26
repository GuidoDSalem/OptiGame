import type { Evaluation } from '../levels/types';

/** Distancia relativa al óptimo (0 = óptimo). Sirve igual para min y max. */
export function gap(value: number, optimum: number): number {
  return Math.abs(value - optimum) / Math.max(Math.abs(optimum), 1e-9);
}

/**
 * 3 estrellas: factible y a menos de 0,1 % del óptimo.
 * 2: factible y a menos de 5 %. 1: factible. 0: viola alguna regla del mundo.
 */
export function stars(ev: Evaluation, optimum: number | undefined): number {
  if (!ev.feasible) return 0;
  if (optimum === undefined) return 1;
  const g = gap(ev.objective, optimum);
  if (g <= 1e-3) return 3;
  if (g <= 0.05) return 2;
  return 1;
}
