import { describe, expect, it } from 'vitest';
import { benders, resolverSubproblema } from '../src/engine/benders';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import { solve } from '../src/engine/solver';
import { VARIANTES_BENDERS, nivelesBenders } from '../src/levels/benders';
import { problemaDe } from '../src/levels/benders/template';

/** Todos los subconjuntos de depósitos. */
const subconjuntos = (ids: string[]) =>
  Array.from({ length: 2 ** ids.length }, (_, m) => new Set(ids.filter((_, i) => m & (1 << i))));

describe.each(nivelesBenders.map((level, i) => ({ level, v: VARIANTES_BENDERS[i], name: level.variant! })))(
  'Avanzado A3 · $name',
  ({ level, v }) => {
    const P = problemaDe(v);
    const { spec, reference } = level.indexed!;
    const run = async (d: IndexedDraft) => {
      const m = compileIndexed(spec, d).model;
      return { m, r: await solve(m) };
    };

    it('el modelo completo es óptimo y válido en el mundo', async () => {
      const { r } = await run(reference);
      expect(r.status).toBe('optimal');
      const ev = level.evaluate(r.values);
      expect(ev.feasible).toBe(true);
      expect(ev.objective).toBeCloseTo(r.objective!, 4);
    });

    it('Benders llega al mismo óptimo, con cotas monótonas que se tocan', async () => {
      const full = (await run(reference)).r.objective!;
      const e = await benders(P);
      expect(e.mejor).toBeCloseTo(full, 4);
      expect(e.cotaInferior).toBeCloseTo(full, 4);
      expect(e.rondas.length).toBeGreaterThanOrEqual(3);
      e.rondas.forEach((r, i) => {
        if (i === 0) return;
        expect(r.cotaInferior).toBeGreaterThanOrEqual(e.rondas[i - 1].cotaInferior - 1e-6);
        expect(r.mejor).toBeLessThanOrEqual(e.rondas[i - 1].mejor + 1e-6);
      });
    });

    it('cada corte es válido para toda apertura y exacto para la que lo generó', async () => {
      const e = await benders(P);
      const ids = v.depositos.map((d) => d.id);
      const Q = new Map<string, number>();
      for (const S of subconjuntos(ids)) {
        const sub = await resolverSubproblema(P, S);
        if (sub.factible) Q.set([...S].sort().join(), sub.transporte);
      }
      for (const r of e.rondas) {
        const cota = (S: Set<string>) => r.corte.constante + ids.reduce((s, d) => s + (S.has(d) ? r.corte.coefs[d] : 0), 0);
        for (const S of subconjuntos(ids)) {
          const q = Q.get([...S].sort().join());
          if (q !== undefined) expect(cota(S)).toBeLessThanOrEqual(q + 1e-4);
        }
        expect(cota(new Set(r.abiertos))).toBeCloseTo(r.transporte, 4);
      }
    });

    it('sin la restricción que une x con y se despacha desde depósitos cerrados', async () => {
      const opt = (await run(reference)).r.objective!;
      const { m, r } = await run({ ...reference, constraints: reference.constraints.filter((c) => c.key !== 'vinculo') });
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
    });

    it('con y continua se abren "pedazos" de depósito', async () => {
      const opt = (await run(reference)).r.objective!;
      const { m, r } = await run({ ...reference, varTypes: {} });
      expect(r.objective!).toBeLessThan(opt - 1e-6);
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
    });

    it('abrir los depósitos más baratos hasta cubrir la demanda no es óptimo', async () => {
      const opt = (await run(reference)).r.objective!;
      const demanda = v.clientes.reduce((s, c) => s + c.demanda, 0);
      const S = new Set<string>();
      let cap = 0;
      for (const d of [...v.depositos].sort((a, b) => a.costoFijo - b.costoFijo)) {
        if (cap >= demanda) break;
        S.add(d.id);
        cap += d.capacidad;
      }
      const sub = await resolverSubproblema(P, S);
      expect(sub.factible).toBe(true);
      const fijo = v.depositos.reduce((s, d) => s + (S.has(d.id) ? d.costoFijo : 0), 0);
      expect(fijo + (sub.factible ? sub.transporte : 0)).toBeGreaterThan(opt + 1e-6);
    });
  },
);
