import { describe, expect, it } from 'vitest';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import { solve } from '../src/engine/solver';
import {
  costoTramo,
  evaluarServicios,
  mejorColocacion,
  particionValida,
  serviciosDeTramos,
  todasLasColocaciones,
} from '../src/engine/stockSeguridad';
import { VARIANTES_STOCK, nivelesStock } from '../src/levels/stock';
import { claveServicio } from '../src/levels/stock/template';

describe.each(nivelesStock.map((level, i) => ({ level, v: VARIANTES_STOCK[i], name: level.variant! })))('Avanzado A6 · $name', ({ level, v }) => {
  const C = v.cadena;
  const N = C.etapas.length;
  const { spec, reference } = level.indexed!;
  const run = async (d: IndexedDraft) => {
    const m = compileIndexed(spec, d).model;
    return { m, r: await solve(m) };
  };

  it('el modelo de tramos llega al óptimo de la programación dinámica y es válido en el mundo', async () => {
    const { r } = await run(reference);
    expect(r.status).toBe('optimal');
    const dp = mejorColocacion(C);
    expect(r.objective!).toBeCloseTo(dp.tramos.reduce((s, [i, j]) => s + Math.round(costoTramo(C, i, j)), 0), 6);
    const ev = level.evaluate(r.values);
    expect(ev.feasible).toBe(true);
    expect(ev.objective).toBeCloseTo(r.objective!, 6);
  });

  it('la relajación lineal ya es entera (matriz de unos consecutivos)', async () => {
    const { r } = await run({ ...reference, varTypes: { u: 'cont' } });
    expect(r.status).toBe('optimal');
    for (const x of Object.values(r.values)) expect(Math.min(Math.abs(x), Math.abs(1 - x))).toBeLessThan(1e-6);
  });

  it('la programación dinámica coincide con probar todas las particiones', () => {
    const todas = todasLasColocaciones(C);
    expect(todas).toHaveLength(2 ** (N - 1));
    for (const t of todas) expect(particionValida(N, t.tramos)).toBe(true);
    expect(mejorColocacion(C).costo).toBeCloseTo(todas[0].costo, 6);
  });

  it('las reglas intuitivas son claramente peores y el óptimo guarda stock en el medio de la cadena', () => {
    const opt = mejorColocacion(C);
    const alFinal = costoTramo(C, 0, N - 1);
    const enTodas = C.etapas.reduce((s, _, k) => s + costoTramo(C, k, k), 0);
    expect(alFinal).toBeGreaterThan(opt.costo * 1.15);
    expect(enTodas).toBeGreaterThan(opt.costo * 1.15);
    expect(opt.tramos.length).toBeGreaterThan(1);
    expect(opt.tramos.length).toBeLessThan(N);
  });

  it('todo o nada: ningún tiempo de servicio intermedio le gana al óptimo', () => {
    const opt = mejorColocacion(C).costo;
    // Recorre muchas combinaciones de tiempos de servicio factibles (NRT ≥ 0, cliente cumplido).
    let probadas = 0;
    const rec = (k: number, S: number[]) => {
      if (k === N) {
        const ev = evaluarServicios(C, S);
        if (!ev.imposibles.length && ev.cumpleCliente) {
          probadas++;
          expect(ev.total).toBeGreaterThanOrEqual(opt - 1e-6);
        }
        return;
      }
      const max = (k === 0 ? C.entrada : S[k - 1]) + C.etapas[k].T;
      const paso = Math.max(1, Math.ceil(max / 6));
      for (let x = 0; x <= max; x += paso) rec(k + 1, [...S, k === N - 1 ? Math.min(x, C.servicio) : x]);
    };
    rec(0, []);
    expect(probadas).toBeGreaterThan(100);
  });

  it('el mundo rechaza modelos incompletos y tiempos imposibles', async () => {
    // Sin la restricción de cobertura, lo más barato es no guardar nada: el mundo no cumple.
    const { r } = await run({ ...reference, constraints: [] });
    expect(level.evaluate(r.values).feasible).toBe(false);
    // Intento manual: una etapa que promete más rápido de lo que puede.
    const S = serviciosDeTramos(C, [[0, N - 1]]);
    S[0] = 0;
    S[1] = C.etapas[1].T + 5;
    const manual = Object.fromEntries(C.etapas.map((e, k) => [claveServicio(e.id), S[k]]));
    expect(level.evaluate(manual).feasible).toBe(false);
  });

  it('prometer más días al cliente nunca encarece el stock', () => {
    let antes = Infinity;
    for (let s = 0; s <= 10; s++) {
      const c = mejorColocacion({ ...C, servicio: s }).costo;
      expect(c).toBeLessThanOrEqual(antes + 1e-6);
      antes = c;
    }
  });
});
