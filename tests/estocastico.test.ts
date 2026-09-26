import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import {
  bendersEstocastico,
  evaluar,
  medidas,
  resolverEscenario,
  resolverExtensivo,
  valoresDe,
} from '../src/engine/estocastico';
import { compileIndexed, term, termProd, type IndexedDraft } from '../src/engine/indexed';
import { solve } from '../src/engine/solver';
import { VARIANTES_ESTOCASTICO, nivelesEstocastico } from '../src/levels/estocastico';
import { problemaDe } from '../src/levels/estocastico/template';

const subconjuntos = (ids: string[]) =>
  Array.from({ length: 2 ** ids.length }, (_, m) => new Set(ids.filter((_, i) => m & (1 << i))));

describe.each(nivelesEstocastico.map((level, i) => ({ level, v: VARIANTES_ESTOCASTICO[i], name: level.variant! })))(
  'Avanzado A4 · $name',
  ({ level, v }) => {
    const P = problemaDe(v);
    const { spec, reference } = level.indexed!;
    const run = async (d: IndexedDraft) => {
      const m = compileIndexed(spec, d).model;
      return { m, r: await solve(m) };
    };

    it('el modelo en dos etapas es óptimo, válido en el mundo e igual a la forma extensiva', async () => {
      const { r } = await run(reference);
      expect(r.status).toBe('optimal');
      const ev = level.evaluate(r.values);
      expect(ev.feasible).toBe(true);
      expect(ev.objective).toBeCloseTo(r.objective!, 4);
      expect((await resolverExtensivo(P)).total).toBeCloseTo(r.objective!, 4);
    });

    it('la evaluación de una apertura coincide con el mundo', async () => {
      const ev = await evaluar(P, new Set(v.plantas.slice(0, 3).map((d) => d.id)));
      const w = level.evaluate(valoresDe(P, ev));
      expect(w.feasible).toBe(true);
      expect(w.objective).toBeCloseTo(ev.total, 4);
    });

    it('Benders multi-corte y corte único llegan al óptimo; multi-corte en menos rondas', async () => {
      const opt = (await run(reference)).r.objective!;
      const multi = await bendersEstocastico(P, 'multi');
      const unico = await bendersEstocastico(P, 'unico');
      for (const e of [multi, unico]) {
        expect(e.mejor).toBeCloseTo(opt, 4);
        expect(e.cotaInferior).toBeCloseTo(opt, 4);
        e.rondas.forEach((r, i) => i > 0 && expect(r.cotaInferior).toBeGreaterThanOrEqual(e.rondas[i - 1].cotaInferior - 1e-6));
      }
      expect(multi.rondas.length).toBeGreaterThanOrEqual(4);
      expect(multi.rondas.length).toBeLessThan(unico.rondas.length);
    });

    it('cada corte de escenario es válido para toda apertura y exacto para la suya', async () => {
      const ids = v.plantas.map((d) => d.id);
      const e = await bendersEstocastico(P, 'multi');
      for (const [k, s] of P.escenarios.entries()) {
        const Q = new Map<string, number>();
        for (const A of subconjuntos(ids)) Q.set([...A].sort().join(), (await resolverEscenario(P, s, A)).costo);
        for (const r of e.rondas) {
          const c = r.escenarios[k].corte;
          const cota = (A: Set<string>) => c.constante + ids.reduce((t, d) => t + (A.has(d) ? c.coefs[d] : 0), 0);
          for (const A of subconjuntos(ids)) expect(cota(A)).toBeLessThanOrEqual(Q.get([...A].sort().join())! + 1e-4);
          expect(cota(new Set(r.abiertos))).toBeCloseTo(r.escenarios[k].costo, 4);
        }
      }
    });

    it('trampas: el plan del promedio y el del peor año son peores, y distintos entre sí', async () => {
      const m = await medidas(P);
      const clave = (a: string[]) => [...a].sort().join();
      expect(m.vss).toBeGreaterThan(0.03 * m.rp.total);
      expect(m.peor.total).toBeGreaterThan(m.rp.total + 1);
      expect(m.evpi).toBeGreaterThan(0);
      expect(new Set([clave(m.rp.abiertos), clave(m.eev.abiertos), clave(m.peor.abiertos)]).size).toBe(3);
      // El plan del promedio usa silo bolsa en el año lluvioso.
      expect(m.eev.escenarios.some((s) => s.faltante > 0)).toBe(true);
    });

    it('sin silo bolsa hay que guardar todo en cualquier año: sale más caro', async () => {
      const opt = (await run(reference)).r.objective!;
      const sinW: IndexedDraft = {
        ...reference,
        objective: { terms: [term('y', 'f'), termProd('x', 'p', 't')] },
        constraints: reference.constraints.map((c) => (c.key === 'cosecha' ? { ...c, terms: [term('x')] } : c)),
      };
      const { m, r } = await run(sinW);
      expect(r.status).toBe('optimal');
      expect(diagnose(level, m, r, opt).verdict).toBe('suboptimal');
    });

    it('sin ponderar por probabilidad se elige otro plan', async () => {
      const opt = (await run(reference)).r.objective!;
      const sinP: IndexedDraft = { ...reference, objective: { terms: [term('y', 'f'), term('x', 't'), term('w', 'u')] } };
      const { m, r } = await run(sinP);
      expect(diagnose(level, m, r, opt).verdict).toBe('suboptimal');
    });

    it('con y continua se alquilan pedazos de planta', async () => {
      const opt = (await run(reference)).r.objective!;
      const { m, r } = await run({ ...reference, varTypes: {} });
      expect(r.objective!).toBeLessThan(opt - 1e-6);
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
    });
  },
);
