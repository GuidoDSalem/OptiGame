import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import { solve } from '../src/engine/solver';
import { escuelaAulas as level } from '../src/levels/escuela-aulas';

const { spec, reference } = level.indexed!;
const OPT = 348;
const run = async (d: IndexedDraft) => {
  const m = compileIndexed(spec, d).model;
  const r = await solve(m);
  return { m, r, d: diagnose(level, m, r, OPT) };
};

describe('Nivel 4: aulas', () => {
  it('el modelo de referencia es binario y su óptimo es 348', async () => {
    const { m, r, d } = await run(reference);
    expect(m.variables.every((v) => v.integer && v.ub === 1)).toBe(true);
    expect(m.constraints).toHaveLength(6 + 3 + 18);
    expect(r.objective).toBeCloseTo(OPT);
    expect(d.verdict).toBe('perfect');
    expect(level.evaluate(r.values).objective).toBeCloseTo(OPT);
  });

  it('con variables continuas la relajación "parte" cursos: 258 pero inválido', async () => {
    const { r, d } = await run({ ...reference, varTypes: { y: 'cont' } });
    expect(r.objective).toBeCloseTo(258);
    expect(Object.values(r.values).some((v) => v > 1e-6 && v < 1 - 1e-6)).toBe(true);
    expect(d.verdict).toBe('unsafe');
    expect(d.messages.join(' ')).toContain('binarias');
  });

  it.each(['horas', 'asientos'])('sin la restricción de %s la solución no sirve', async (key) => {
    const { d } = await run({ ...reference, constraints: reference.constraints.filter((c) => c.key !== key) });
    expect(d.verdict).toBe('unsafe');
  });

  it('asientos con "para cada c" en vez de "para cada c, a" es un error de índices', () => {
    const bad = { ...reference, constraints: reference.constraints.map((c) => (c.key === 'asientos' ? { ...c, forall: ['C'] } : c)) };
    expect(compileIndexed(spec, bad).errors.asientos?.join(' ')).toContain('no se repite');
  });

  it('el mundo detecta un curso en dos aulas y aulas vacías', () => {
    const ev = level.evaluate({ y_c1a_magna: 1, y_c1a_a2: 1 });
    expect(ev.checks.find((c) => c.label === 'Curso 1° A')?.failMessage).toContain('dos aulas');
    expect(ev.checks.find((c) => c.label === 'Curso 2° A')?.value).toBe('sin aula');
  });
});
