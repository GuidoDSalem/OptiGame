import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import { solve } from '../src/engine/solver';
import { VARIANTES_PLANIFICACION, nivelesPlanificacion } from '../src/levels/planificacion';
import { xId } from '../src/levels/planificacion/template';

/**
 * Chequeos pedagógicos del nivel 5: toda versión tiene que conservar las trampas que enseñan
 * la planificación multi-período con costos fijos.
 */
describe.each(nivelesPlanificacion.map((level, i) => ({ level, v: VARIANTES_PLANIFICACION[i], name: level.variant! })))(
  'Nivel 5 · $name',
  ({ level, v }) => {
    const { spec, reference } = level.indexed!;
    const run = async (d: IndexedDraft) => {
      const m = compileIndexed(spec, d).model;
      return { m, r: await solve(m) };
    };
    const optimum = async () => (await run(reference)).r.objective!;
    const verdict = async (d: IndexedDraft) => {
      const { m, r } = await run(d);
      return diagnose(level, m, r, await optimum()).verdict;
    };

    it('el modelo de referencia expande bien y es óptimo y válido en el mundo', async () => {
      const { m, r } = await run(reference);
      const T = v.periodos.length;
      expect(m.variables).toHaveLength(3 * T);
      expect(m.constraints).toHaveLength(3 * T);
      // Balance del primer período: no hay s_0.
      const b1 = m.constraints.find((c) => c.name.startsWith('Balance de stock: ' + v.periodos[0].label))!;
      expect(Object.keys(b1.coefs).sort()).toEqual([`s_${v.periodos[0].id}`, `x_${v.periodos[0].id}`].sort());
      expect(r.status).toBe('optimal');
      const ev = level.evaluate(r.values);
      expect(ev.feasible).toBe(true);
      expect(ev.objective).toBeCloseTo(r.objective!);
    });

    it('con z continua se paga "medio costo fijo": cota mejor pero inválida', async () => {
      const opt = await optimum();
      const { m, r } = await run({ ...reference, varTypes: { z: 'cont' } });
      expect(r.objective!).toBeLessThan(opt - 1e-6);
      const d = diagnose(level, m, r, opt);
      expect(d.verdict).toBe('unsafe');
      expect(d.messages.join(' ')).toContain('binaria');
    });

    it('sin la restricción de activación se opera sin pagar el costo fijo', async () => {
      expect(await verdict({ ...reference, constraints: reference.constraints.filter((c) => c.key !== 'activacion') })).toBe('unsafe');
    });

    it('sin el desfase t−1 el modelo no conecta los períodos y queda infactible', async () => {
      const sinDesfase = {
        ...reference,
        constraints: reference.constraints.map((c) =>
          c.key === 'balance' ? { ...c, terms: c.terms.map((t) => ({ ...t, lag: undefined })) } : c,
        ),
      };
      expect(await verdict(sinDesfase)).toBe('infeasible');
    });

    it('sin la capacidad de stock la solución desborda el depósito', async () => {
      expect(await verdict({ ...reference, constraints: reference.constraints.filter((c) => c.key !== 'stock') })).toBe('unsafe');
    });

    it('"justo a tiempo" (enviar cada período su demanda) no funciona', () => {
      const values = Object.fromEntries(v.periodos.map((p) => [xId(p.id), p.demanda]));
      const ev = level.evaluate(level.manualDerive!(values));
      expect(ev.feasible).toBe(false);
    });
  },
);
