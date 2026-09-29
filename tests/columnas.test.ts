import { describe, expect, it } from 'vitest';
import {
  costoReducido,
  enteroConPatrones,
  fasesDeLaTraza,
  generacionDeColumnas,
  iniciarColumnas,
  paso,
  patronesIniciales,
  pricing,
  redondeoHaciaArriba,
  resolverMaestro,
  todosLosPatrones,
  trazaColumnas,
  valorPatron,
} from '../src/engine/columnas';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import { solve } from '../src/engine/solver';
import { VARIANTES_COLUMNAS, nivelesColumnas } from '../src/levels/columnas';
import { problemaDe } from '../src/levels/columnas/template';

describe.each(nivelesColumnas.map((level, i) => ({ level, v: VARIANTES_COLUMNAS[i], name: level.variant! })))(
  'Avanzado A2 · $name',
  ({ level, v }) => {
    const P = problemaDe(v);
    const { spec, reference } = level.indexed!;
    const run = async (d: IndexedDraft) => {
      const m = compileIndexed(spec, d).model;
      return { m, r: await solve(m) };
    };

    it('el modelo de patrones es óptimo y válido en el mundo', async () => {
      const { r } = await run(reference);
      expect(r.status).toBe('optimal');
      const ev = level.evaluate(r.values);
      expect(ev.feasible).toBe(true);
      expect(ev.objective).toBeCloseTo(r.objective!, 4);
    });

    it('generación de columnas llega a la relajación con todos los patrones, usando pocos', async () => {
      const todos = todosLosPatrones(P);
      const lpTodos = await resolverMaestro(P, todos);
      const e = await generacionDeColumnas(P);
      expect(e.maestro.objetivo).toBeCloseTo(lpTodos.objetivo, 5);
      expect(e.cotaInferior).toBeCloseTo(e.maestro.objetivo, 5);
      expect(e.rondas.length).toBeGreaterThanOrEqual(4);
      expect(e.patrones.length).toBeLessThan(todos.length / 3);
      // Al final ningún patrón factible (maximal o no) tiene costo reducido negativo.
      for (const p of todosLosPatrones(P, false)) expect(costoReducido(P, e.maestro.duales, p)).toBeGreaterThanOrEqual(-1e-6);
    });

    it('el maestro baja, la cota sube, y la cota nunca supera a la relajación completa', async () => {
      const lp = (await resolverMaestro(P, todosLosPatrones(P))).objetivo;
      const e = await generacionDeColumnas(P);
      const lps = [e.inicial.lp, ...e.rondas.map((r) => r.lp)];
      const cotas = [e.inicial.cotaInferior, ...e.rondas.map((r) => r.cotaInferior)];
      for (let i = 1; i < lps.length; i++) {
        expect(lps[i]).toBeLessThanOrEqual(lps[i - 1] + 1e-6);
        expect(cotas[i]).toBeGreaterThanOrEqual(cotas[i - 1] - 1e-6);
      }
      cotas.forEach((c) => expect(c).toBeLessThanOrEqual(lp + 1e-6));
      e.rondas.forEach((r) => expect(r.costoReducido).toBeLessThan(0));
    });

    it('la traza guarda un estado por ronda y la reproducción es corta', async () => {
      const traza = await trazaColumnas(P);
      const e = await generacionDeColumnas(P);
      expect(traza.length).toBe(e.rondas.length + 1);
      expect(traza[traza.length - 1].maestro.objetivo).toBeCloseTo(e.maestro.objetivo, 6);
      traza.forEach((t, k) => {
        expect(t.rondas.length).toBe(k);
        // El patrón que sugiere el pricing en un estado es el que entra en el siguiente.
        if (k > 0) expect(t.patrones[t.patrones.length - 1]).toEqual(traza[k - 1].sugerido.patron);
      });
      const fases = fasesDeLaTraza(traza);
      expect(fases.length).toBe(4 * traza.length);
      expect(fases.filter((f) => f.fase === 'agrega').length).toBe(traza.length - 1);
      expect(fases[fases.length - 1]).toEqual({ k: traza.length - 1, fase: 'fin' });
      expect(fases.length).toBeLessThanOrEqual(40);
    });

    it('el pricing encuentra el patrón más valioso (comparado con todos)', async () => {
      const e = await iniciarColumnas(P);
      const { valor } = await pricing(P, e.maestro.duales);
      const mejor = Math.max(...todosLosPatrones(P, false).map((p) => valorPatron(P, e.maestro.duales, p)));
      expect(valor).toBeCloseTo(mejor, 5);
      expect(valor).toBeGreaterThan(1);
    });

    it('un patrón que no conviene no entra al maestro', async () => {
      const e = await iniciarColumnas(P);
      const r = await paso(P, e, patronesIniciales(P)[0], 'jugador');
      expect(r.ok).toBe(false);
      const peor = todosLosPatrones(P).find((p) => costoReducido(P, e.maestro.duales, p) >= 0)!;
      const r2 = await paso(P, e, peor, 'jugador');
      expect(r2).toMatchObject({ ok: false, motivo: 'no-mejora' });
    });

    it('redondear para arriba desperdicia bobinas; el entero con los patrones generados llega a la cota', async () => {
      const e = await generacionDeColumnas(P);
      const optimo = (await run(reference)).r.objective!;
      const redondeo = redondeoHaciaArriba(e.maestro.x);
      const entero = await enteroConPatrones(P, e.patrones);
      expect(Number.isInteger(e.maestro.objetivo)).toBe(false);
      expect(redondeo.bobinas).toBeGreaterThan(optimo);
      expect(level.evaluate(redondeo.x).feasible).toBe(true);
      expect(entero.bobinas).toBe(optimo);
      expect(optimo).toBe(Math.ceil(e.maestro.objetivo));
      expect(level.evaluate(entero.x).objective).toBe(optimo);
    });

    it('con sólo los patrones obvios hacen falta más bobinas', async () => {
      const optimo = (await run(reference)).r.objective!;
      const s = await enteroConPatrones(P, patronesIniciales(P));
      expect(s.bobinas).toBeGreaterThanOrEqual(optimo + 3);
    });

    it('con x continua se cortan bobinas fraccionarias', async () => {
      const opt = (await run(reference)).r.objective!;
      const { m, r } = await run({ ...reference, varTypes: {} });
      expect(r.objective!).toBeLessThan(opt - 1e-6);
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
    });

    it('con ≤ en vez de ≥ no se corta nada', async () => {
      const opt = (await run(reference)).r.objective!;
      const { m, r } = await run({ ...reference, constraints: reference.constraints.map((c) => ({ ...c, op: '<=' as const })) });
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
    });
  },
);
