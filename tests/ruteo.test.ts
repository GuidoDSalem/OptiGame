import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import { analizar, arcsFromRoute, dosOpt, manhattan, routeLength, vecinoMasCercano } from '../src/engine/routing';
import { solve } from '../src/engine/solver';
import { VARIANTES_RUTEO, nivelesRuteo } from '../src/levels/ruteo';

/** Óptimo por fuerza bruta: prueba todas las permutaciones de clientes. */
function bruteForce(depot: string, clients: string[], d: (a: string, b: string) => number) {
  let best = Infinity;
  const perm = (rest: string[], acc: string[]) => {
    if (!rest.length) {
      best = Math.min(best, routeLength([depot, ...acc], d));
      return;
    }
    rest.forEach((c, k) => perm([...rest.slice(0, k), ...rest.slice(k + 1)], [...acc, c]));
  };
  perm(clients, []);
  return best;
}

describe.each(nivelesRuteo.map((level, i) => ({ level, v: VARIANTES_RUTEO[i], name: level.variant! })))(
  'Nivel 6 · $name',
  ({ level, v }) => {
    const { spec, reference } = level.indexed!;
    const nodes = [v.deposito.id, ...v.clientes.map((c) => c.id)];
    const d = manhattan([v.deposito, ...v.clientes]);
    const opt = bruteForce(v.deposito.id, v.clientes.map((c) => c.id), d);

    it('el modelo de referencia (MTZ) da el óptimo de la fuerza bruta', async () => {
      const r = await solve(level.referenceModel);
      expect(r.status).toBe('optimal');
      expect(r.objective).toBeCloseTo(opt);
      const ev = level.evaluate(r.values);
      expect(ev.feasible).toBe(true);
      expect(ev.objective).toBeCloseTo(opt);
    });

    it('el modelo base expande sin x_ii', () => {
      const m = compileIndexed(spec, reference).model;
      expect(m.variables).toHaveLength(nodes.length * (nodes.length - 1));
      expect(m.variables.some((x) => /^x_(\w+)_\1$/.test(x.id))).toBe(false);
    });

    it('sin cortes aparecen subtours y el mundo los detecta', async () => {
      const m = compileIndexed(spec, reference).model;
      const r = await solve(m);
      expect(analizar(nodes, r.values).circuitos.length).toBeGreaterThan(1);
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
      expect(level.lazyCuts!.generate(r.values).length).toBeGreaterThan(0);
    });

    it('agregando cortes a demanda se llega al óptimo en pocas rondas', async () => {
      let draft: IndexedDraft = reference;
      let rondas = 0;
      for (;;) {
        const m = compileIndexed(spec, draft).model;
        const r = await solve(m);
        const cuts = level.lazyCuts!.generate(r.values);
        if (!cuts.length) {
          expect(r.objective).toBeCloseTo(opt);
          expect(diagnose(level, m, r, opt).verdict).toBe('perfect');
          break;
        }
        draft = { ...draft, cuts: [...(draft.cuts ?? []), ...cuts] };
        rondas++;
        expect(rondas).toBeLessThan(10);
      }
      expect(rondas).toBeGreaterThanOrEqual(1);
    });

    it('el vecino más cercano no es óptimo y 2-opt no empeora', () => {
      const nn = vecinoMasCercano(nodes, v.deposito.id, d);
      const two = dosOpt(nn, d);
      expect(routeLength(nn, d)).toBeGreaterThan(opt);
      expect(routeLength(two, d)).toBeLessThanOrEqual(routeLength(nn, d));
      expect(level.evaluate(arcsFromRoute(nn, true)).feasible).toBe(true);
    });
  },
);
