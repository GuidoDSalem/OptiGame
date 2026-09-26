import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import {
  agregarCorte,
  branchAndBound,
  cotaSuperior,
  iniciarArbol,
  iniciarCortes,
  optimoEntero,
  planosDeCorte,
  ramificar,
  resolverLP,
  tableau,
  type Fila,
  type Vec,
} from '../src/engine/ramificacion';
import { solve } from '../src/engine/solver';
import { VARIANTES_SOLVER, nivelesSolver } from '../src/levels/solver';
import { idVar, problemaDe } from '../src/levels/solver/template';

const cumple = (filas: Fila[], p: Vec) => filas.every((f) => f.a[0] * p[0] + f.a[1] * p[1] <= f.b + 1e-9);

describe.each(nivelesSolver.map((level, i) => ({ level, v: VARIANTES_SOLVER[i], name: level.variant! })))(
  'Avanzado A1 · $name',
  ({ level, v }) => {
    const P = problemaDe(v);
    const { spec, reference } = level.indexed!;
    const run = async (d: IndexedDraft) => {
      const m = compileIndexed(spec, d).model;
      return { m, r: await solve(m) };
    };
    const opt = optimoEntero(P, 50)!;
    const puntosEnteros = Array.from({ length: 51 * 51 }, (_, k) => [Math.floor(k / 51), k % 51] as Vec).filter((p) => cumple(P.filas, p));

    it('el modelo es óptimo, coincide con la fuerza bruta y es válido en el mundo', async () => {
      const { r } = await run(reference);
      expect(r.status).toBe('optimal');
      expect(r.objective).toBeCloseTo(opt.z, 6);
      const ev = level.evaluate(r.values);
      expect(ev.feasible).toBe(true);
      expect(ev.objective).toBeCloseTo(opt.z, 6);
    });

    it('la relajación de dos variables coincide con HiGHS', async () => {
      const lp = resolverLP(P.c, P.filas);
      const { r } = await run({ ...reference, varTypes: {} });
      expect(lp.z).toBeCloseTo(r.objective!, 6);
      expect(lp.x[0]).toBeCloseTo(r.values[idVar(v.productos[0])], 6);
    });

    it('trampas: la relajación es fraccionaria, redondear no sirve y el óptimo está lejos', () => {
      const lp = resolverLP(P.c, P.filas);
      expect(lp.x.every((n) => Math.abs(n - Math.round(n)) > 1e-6)).toBe(true);
      const cercano: Vec = [Math.round(lp.x[0]), Math.round(lp.x[1])];
      expect(cumple(P.filas, cercano)).toBe(false);
      const abajo: Vec = [Math.floor(lp.x[0]), Math.floor(lp.x[1])];
      expect(P.c[0] * abajo[0] + P.c[1] * abajo[1]).toBeLessThan(opt.z - 1);
      expect(Math.abs(opt.x[0] - lp.x[0]) >= 1.5 || Math.abs(opt.x[1] - lp.x[1]) >= 1.5).toBe(true);
    });

    it('branch and bound llega al óptimo, con un árbol interesante', () => {
      const a = branchAndBound(P);
      expect(a.incumbente!.z).toBe(opt.z);
      expect(a.nodos.length).toBeGreaterThanOrEqual(7);
      expect(a.nodos.some((n) => n.estado === 'infactible')).toBe(true);
      expect(a.nodos.some((n) => n.estado === 'podado' || n.estado === 'entero')).toBe(true);
      // Cada hijo tiene relajación ≤ a la del padre.
      for (const n of a.nodos) if (n.padre !== null && n.lp.factible) expect(n.lp.z).toBeLessThanOrEqual(a.nodos[n.padre].lp.z + 1e-9);
    });

    it('ramificar a mano en cualquier orden también termina en el óptimo', () => {
      // Siempre el primer nodo abierto, y la primera variable fraccionaria (lo contrario de la estrategia automática).
      let a = iniciarArbol(P);
      for (let i = 0; i < 100; i++) {
        const n = a.nodos.find((x) => x.estado === 'abierto');
        if (!n) break;
        const k = Math.abs(n.lp.x[0] - Math.round(n.lp.x[0])) > 1e-7 ? 0 : 1;
        a = ramificar(P, a, n.id, k)!;
        expect(cotaSuperior(a)).toBeGreaterThanOrEqual(opt.z - 1e-9);
      }
      expect(a.incumbente!.z).toBe(opt.z);
    });

    it('los cortes de Gomory son válidos para todo punto entero y dejan afuera al LP', () => {
      let e = iniciarCortes(P);
      const lp0 = e.lp;
      const T = tableau(lp0, P.filas);
      // Cada fila del tableau se cumple en el óptimo con las holguras en 0.
      for (const f of T.filas.filter((f) => f.basica === 'x' || f.basica === 'y')) expect(f.valor).toBeCloseTo(f.basica === 'x' ? lp0.x[0] : lp0.x[1], 9);
      for (const b of ['x', 'y']) {
        const s = agregarCorte(P, e, b);
        if (!s) continue;
        const c = s.cortes[s.cortes.length - 1];
        for (const p of puntosEnteros) expect(cumple([c], p)).toBe(true);
        expect(cumple([c], lp0.x)).toBe(false);
      }
      const g = planosDeCorte(P);
      expect(g.lp.z).toBe(opt.z);
      expect(g.pasos.length).toBeGreaterThanOrEqual(1);
      for (const c of g.cortes) for (const p of puntosEnteros) expect(cumple([c], p)).toBe(true);
      e = g;
    });

    it('con x continua el solver da la relajación (muebles fraccionarios)', async () => {
      const { m, r } = await run({ ...reference, varTypes: {} });
      expect(r.objective!).toBeGreaterThan(opt.z + 1e-6);
      expect(diagnose(level, m, r, opt.z).verdict).toBe('unsafe');
    });
  },
);
