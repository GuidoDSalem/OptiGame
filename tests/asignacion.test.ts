import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import { solve } from '../src/engine/solver';
import { VARIANTES_ASIGNACION, nivelesAsignacion } from '../src/levels/asignacion';

/**
 * Chequeos "pedagógicos": cualquier versión del nivel tiene que conservar las trampas que
 * enseñan la técnica. Si se agregan datos nuevos y alguno falla, la versión no enseña lo mismo.
 */
describe.each(nivelesAsignacion.map((level, i) => ({ level, v: VARIANTES_ASIGNACION[i], name: level.variant! })))(
  'Nivel 4 · $name',
  ({ level, v }) => {
    const { spec, reference } = level.indexed!;
    const run = async (d: IndexedDraft) => {
      const m = compileIndexed(spec, d).model;
      const r = await solve(m);
      return { m, r };
    };
    const without = (key: string): IndexedDraft => ({
      ...reference,
      constraints: reference.constraints.filter((c) => c.key !== key),
    });

    it('el modelo de referencia es binario, óptimo y válido en el mundo', async () => {
      const { m, r } = await run(reference);
      expect(m.variables.every((x) => x.integer && x.ub === 1)).toBe(true);
      expect(r.status).toBe('optimal');
      const ev = level.evaluate(r.values);
      expect(ev.feasible).toBe(true);
      expect(ev.objective).toBeCloseTo(r.objective!);
    });

    it('la relajación continua da una cota mejor pero "parte" ítems, y el mundo lo detecta', async () => {
      const opt = (await run(reference)).r.objective!;
      const { m, r } = await run({ ...reference, varTypes: { y: 'cont' } });
      expect(r.objective!).toBeLessThan(opt - 1e-6);
      expect(Object.values(r.values).some((x) => x > 1e-6 && x < 1 - 1e-6)).toBe(true);
      const d = diagnose(level, m, r, opt);
      expect(d.verdict).toBe('unsafe');
      expect(d.messages.join(' ')).toContain('binarias');
    });

    it.each(['horas', 'tamano'])('sin la restricción "%s" la solución no sirve en la realidad', async (key) => {
      const opt = (await run(reference)).r.objective!;
      const { m, r } = await run(without(key));
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
    });

    it('la estrategia "a ojo" (cada ítem al contenedor más chico donde entra) no es óptima', async () => {
      const opt = (await run(reference)).r.objective!;
      const values: Record<string, number> = {};
      for (const it of v.items) {
        const fit = [...v.bins].filter((b) => b.size >= it.size).sort((a, b) => a.size - b.size)[0];
        values[`y_${it.id}_${fit.id}`] = 1;
      }
      const ev = level.evaluate(values);
      expect(!ev.feasible || ev.objective > opt + 1e-6).toBe(true);
    });
  },
);

describe('Nivel 4 · Escuela (valores conocidos)', () => {
  const level = nivelesAsignacion.find((l) => l.variant === 'Escuela')!;
  it('óptimo 348, relajación 258', async () => {
    const { spec, reference } = level.indexed!;
    const opt = await solve(compileIndexed(spec, reference).model);
    const rel = await solve(compileIndexed(spec, { ...reference, varTypes: { y: 'cont' } }).model);
    expect(opt.objective).toBeCloseTo(348);
    expect(rel.objective).toBeCloseTo(258);
  });

  it('un curso en dos aulas y cursos sin aula se detectan', () => {
    const ev = level.evaluate({ y_c1a_magna: 1, y_c1a_a2: 1 });
    expect(ev.checks.find((c) => c.label === 'Curso 1° A')?.failMessage).toContain('dos aulas');
    expect(ev.checks.find((c) => c.label === 'Curso 2° A')?.value).toBe('sin asignar');
  });
});
