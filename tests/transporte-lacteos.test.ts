import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, validateConstraint, type IndexedDraft } from '../src/engine/indexed';
import { solve } from '../src/engine/solver';
import { transporteLacteos as level } from '../src/levels/transporte-lacteos';

const { spec, reference } = level.indexed!;
const OPT = 425;

const withConstraints = (f: (c: IndexedDraft['constraints']) => IndexedDraft['constraints']): IndexedDraft => ({
  ...reference,
  constraints: f(reference.constraints),
});

describe('Motor de modelos con índices', () => {
  it('expande el modelo de referencia a 12 variables y 7 restricciones', () => {
    const { model, errors } = compileIndexed(spec, reference);
    expect(errors).toEqual({});
    expect(model.variables).toHaveLength(12);
    expect(model.constraints).toHaveLength(7);
    expect(model.objective.x_raf_ros).toBe(9);
    const ofertaRaf = model.constraints.find((c) => c.name === 'Oferta: Rafaela')!;
    expect(ofertaRaf.coefs).toEqual({ x_raf_ros: 1, x_raf_sfe: 1, x_raf_cba: 1, x_raf_par: 1 });
    expect(ofertaRaf.rhs).toBe(30);
  });

  it('detecta índices sueltos en el lado derecho', () => {
    const bad = { ...reference.constraints[0], forall: ['J'] }; // Σ_i x_ij ≤ o_i ∀j: la i queda suelta
    expect(validateConstraint(spec, bad).join(' ')).toContain('no se repite');
  });

  it('una restricción "una sola vez" suma todas las variables', () => {
    const { model } = compileIndexed(
      spec,
      withConstraints(() => [
        { key: 't', name: 'Total', forall: [], coef: null, var: 'x', op: '<=', rhs: { kind: 'value', value: '50' } },
      ]),
    );
    expect(model.constraints).toHaveLength(1);
    expect(Object.keys(model.constraints[0].coefs)).toHaveLength(12);
  });
});

describe('Nivel 3: transporte de lácteos', () => {
  it(`el óptimo cuesta $${OPT}k y es entero sin pedirlo`, async () => {
    const r = await solve(level.referenceModel);
    expect(r.status).toBe('optimal');
    expect(r.objective).toBeCloseTo(OPT);
    expect(Object.values(r.values).every((v) => Number.isInteger(v))).toBe(true);
    const ev = level.evaluate(r.values);
    expect(ev.feasible).toBe(true);
    expect(ev.objective).toBeCloseTo(OPT);
  });

  it('"lo más barato primero" es factible pero peor que el óptimo', () => {
    const greedy = { x_esp_sfe: 15, x_esp_par: 5, x_raf_par: 5, x_sun_cba: 20, x_raf_ros: 25 };
    const ev = level.evaluate(greedy);
    expect(ev.feasible).toBe(true);
    expect(ev.objective).toBe(440);
  });

  it('oferta y demanda con "=" es infactible', async () => {
    const d = withConstraints((cs) => cs.map((c) => ({ ...c, op: '=' as const })));
    const m = compileIndexed(spec, d).model;
    expect(diagnose(level, m, await solve(m), OPT).verdict).toBe('infeasible');
  });

  it('oferta con "=" obliga a despachar de más: subóptimo', async () => {
    const d = withConstraints((cs) => cs.map((c) => (c.key === 'oferta' ? { ...c, op: '=' as const } : c)));
    const m = compileIndexed(spec, d).model;
    expect(diagnose(level, m, await solve(m), OPT).verdict).toBe('suboptimal');
  });

  it('sin demanda el costo mínimo es no mandar nada: inválido en la realidad', async () => {
    const d = withConstraints((cs) => cs.filter((c) => c.key !== 'demanda'));
    const m = compileIndexed(spec, d).model;
    expect(diagnose(level, m, await solve(m), OPT).verdict).toBe('unsafe');
  });
});
