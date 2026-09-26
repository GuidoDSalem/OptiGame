import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import type { LPModel } from '../src/engine/model';
import { stars } from '../src/engine/score';
import { solve } from '../src/engine/solver';
import { campanaMarketing as level } from '../src/levels/campana-marketing';

const without = (id: string): LPModel => ({
  ...level.referenceModel,
  constraints: level.referenceModel.constraints.filter((c) => c.id !== id),
});

describe('Nivel 2: campaña de marketing', () => {
  it('el óptimo de referencia es TV 56, radio 28, redes 16, vía pública 0 → 268 mil personas', async () => {
    const r = await solve(level.referenceModel);
    expect(r.status).toBe('optimal');
    expect(r.values).toEqual({ tv: 56, radio: 28, redes: 16, via: 0 });
    expect(r.objective).toBeCloseTo(268);
  });

  it('presupuesto, público joven y convenio quedan activos; vía pública tiene costo reducido negativo', async () => {
    const r = await solve(level.referenceModel);
    const row = (id: string) => r.rows.find((x) => x.id === id)!;
    expect(Math.abs(row('presupuesto').dual!)).toBeGreaterThan(0);
    expect(Math.abs(row('jovenes').dual!)).toBeGreaterThan(0);
    expect(Math.abs(row('convenio').dual!)).toBeGreaterThan(0);
    expect(row('horas').dual).toBe(0);
    expect(r.reducedCosts.via).toBeLessThan(0);
  });

  it('el mundo real coincide con el modelo de referencia', async () => {
    const r = await solve(level.referenceModel);
    const ev = level.evaluate(r.values);
    expect(ev.feasible).toBe(true);
    expect(ev.objective).toBeCloseTo(r.objective!);
    expect(stars(ev, r.objective)).toBe(3);
  });

  it.each(['jovenes', 'convenio', 'presupuesto'])('diagnostica "unsafe" si falta la restricción %s', async (id) => {
    const m = without(id);
    const d = diagnose(level, m, await solve(m), 268);
    expect(d.verdict).toBe('unsafe');
  });

  it('diagnostica "suboptimal" si se exige usar vía pública', async () => {
    const m: LPModel = {
      ...level.referenceModel,
      constraints: [...level.referenceModel.constraints, { id: 'x', name: 'vp', coefs: { via: 1 }, op: '>=', rhs: 10 }],
    };
    const d = diagnose(level, m, await solve(m), 268);
    expect(d.verdict).toBe('suboptimal');
  });
});
