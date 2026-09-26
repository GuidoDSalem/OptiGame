import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import type { LPModel } from '../src/engine/model';
import { stars } from '../src/engine/score';
import { solve } from '../src/engine/solver';
import { plantaAgua as level } from '../src/levels/planta-agua';

const withoutSalinity: LPModel = {
  ...level.referenceModel,
  constraints: level.referenceModel.constraints.filter((c) => c.id !== 'salinidad'),
};

describe('Nivel 1: planta potabilizadora', () => {
  it('el óptimo de referencia es 36 ML de río y 24 de pozo, $6240', async () => {
    const r = await solve(level.referenceModel);
    expect(r.status).toBe('optimal');
    expect(r.values.rio).toBeCloseTo(36);
    expect(r.values.pozo).toBeCloseTo(24);
    expect(r.objective).toBeCloseTo(6240);
  });

  it('el mundo real coincide con el modelo de referencia', async () => {
    const r = await solve(level.referenceModel);
    const ev = level.evaluate(r.values);
    expect(ev.feasible).toBe(true);
    expect(ev.objective).toBeCloseTo(r.objective!);
    expect(stars(ev, r.objective)).toBe(3);
  });

  it('el mundo marca como inválida una mezcla muy salada', () => {
    const ev = level.evaluate({ rio: 20, pozo: 40 });
    expect(ev.feasible).toBe(false);
    expect(ev.checks.find((c) => c.label === 'Salinidad')?.ok).toBe(false);
  });

  it('diagnostica "perfect" con el modelo correcto', async () => {
    const r = await solve(level.referenceModel);
    expect(diagnose(level, level.referenceModel, r, 6240).verdict).toBe('perfect');
  });

  it('diagnostica "unsafe" si falta la restricción de salinidad', async () => {
    const r = await solve(withoutSalinity);
    const d = diagnose(level, withoutSalinity, r, 6240);
    expect(d.verdict).toBe('unsafe');
    expect(d.messages.join(' ')).toContain('Salinidad');
  });

  it('diagnostica "unbounded" si falta la demanda y se maximiza', async () => {
    const m: LPModel = { ...level.referenceModel, sense: 'max', constraints: [] };
    const d = diagnose(level, m, await solve(m), 6240);
    expect(d.verdict).toBe('unbounded');
  });

  it('diagnostica "suboptimal" con una restricción de más', async () => {
    const m: LPModel = {
      ...level.referenceModel,
      constraints: [...level.referenceModel.constraints, { id: 'x', name: 'extra', coefs: { pozo: 1 }, op: '<=', rhs: 10 }],
    };
    const d = diagnose(level, m, await solve(m), 6240);
    expect(d.verdict).toBe('suboptimal');
  });

  it('diagnostica "infeasible" con restricciones contradictorias', async () => {
    const m: LPModel = {
      ...level.referenceModel,
      constraints: [...level.referenceModel.constraints, { id: 'x', name: 'mal', coefs: { rio: 1, pozo: 1 }, op: '<=', rhs: 30 }],
    };
    const d = diagnose(level, m, await solve(m), 6240);
    expect(d.verdict).toBe('infeasible');
  });
});
