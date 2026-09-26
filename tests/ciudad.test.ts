import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../src/engine/indexed';
import { fronteraEpsilon, marcarSoportados } from '../src/engine/pareto';
import { solve } from '../src/engine/solver';
import { VARIANTES_CIUDAD, nivelesCiudad } from '../src/levels/ciudad';

describe('Frontera de Pareto: puntos soportados', () => {
  const pt = (g: number, f: number) => ({ g, f, values: {} });
  it('un punto por debajo de la envolvente no es soportado', () => {
    const r = marcarSoportados([pt(0, 0), pt(1, 1), pt(2, 4)]);
    expect(r.map((p) => p.soportado)).toEqual([true, false, true]);
  });
  it('un punto por encima sí lo es', () => {
    const r = marcarSoportados([pt(0, 0), pt(1, 3), pt(2, 4)]);
    expect(r.every((p) => p.soportado)).toBe(true);
  });
});

describe.each(nivelesCiudad.map((level, i) => ({ level, v: VARIANTES_CIUDAD[i], name: level.variant! })))(
  'Nivel 7 · $name',
  ({ level, v }) => {
    const { spec, reference } = level.indexed!;
    const run = async (d: IndexedDraft) => {
      const m = compileIndexed(spec, d).model;
      return { m, r: await solve(m) };
    };
    const optimum = async () => (await run(reference)).r.objective!;

    it('el modelo de referencia es óptimo y válido en el mundo', async () => {
      const { r } = await run(reference);
      expect(r.status).toBe('optimal');
      const ev = level.evaluate(r.values);
      expect(ev.feasible).toBe(true);
      expect(ev.objective).toBeCloseTo(r.objective!);
    });

    it('las reglas usan proyectos puntuales (y_Hospital) y se expanden a una fila cada una', () => {
      const m = compileIndexed(spec, reference).model;
      expect(m.constraints).toHaveLength(2 + v.reglas.length);
      const r0 = m.constraints[2];
      expect(Object.keys(r0.coefs).length).toBeLessThan(v.proyectos.length);
    });

    it.each(reference.constraints.map((c) => c.key))('sin la restricción "%s" la solución rompe algo', async (key) => {
      const opt = await optimum();
      const { m, r } = await run({ ...reference, constraints: reference.constraints.filter((c) => c.key !== key) });
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
    });

    it('con y continua aparecen "medios proyectos"', async () => {
      const opt = await optimum();
      const { m, r } = await run({ ...reference, varTypes: {} });
      expect(r.objective!).toBeGreaterThan(opt);
      expect(diagnose(level, m, r, opt).verdict).toBe('unsafe');
    });

    it('la frontera tiene puntos que la suma ponderada no encuentra', async () => {
      const m = compileIndexed(spec, reference).model;
      const base = { ...m, constraints: m.constraints.filter((c) => c.name !== v.vocab.compromiso) };
      const F = Object.fromEntries(v.proyectos.map((p) => [`y_${p.id}`, p.beneficio]));
      const G = Object.fromEntries(v.proyectos.map((p) => [`y_${p.id}`, p.impacto]));
      const fr = await fronteraEpsilon(base, F, G, 1);
      expect(fr.length).toBeGreaterThan(3);
      expect(fr.some((p) => !p.soportado)).toBe(true);
      // El punto del tope coincide con el óptimo del modelo de referencia.
      const elegido = fr.filter((p) => p.g <= v.topeImpacto).sort((a, b) => b.f - a.f)[0];
      expect(elegido.f).toBeCloseTo(await optimum());
    });
  },
);
