import { describe, expect, it } from 'vitest';
import {
  basesDe,
  cantidadPlanes,
  costoSalida,
  frecuencias,
  resolverDia,
  simularDia,
  simularDias,
  totalLlamadas,
} from '../src/engine/ambulancias';
import { resolverEscenario, type ProblemaEstocastico } from '../src/engine/estocastico';
import { analizar } from '../src/casos/ambulancias/analisis';
import { CIUDAD as C, OPCIONES } from '../src/casos/ambulancias/ciudad';

describe('Caso C1 · ambulancias', () => {
  it('la simulación es reproducible: misma semilla, mismos días', () => {
    const a = simularDias(C, 20, 5);
    const b = simularDias(C, 20, 5);
    expect(a).toEqual(b);
    expect(simularDia(C, 5, 7)).toEqual(a[7]);
    expect(simularDias(C, 20, 6)).not.toEqual(a);
  });

  it('el flujo de costo mínimo de cada día coincide con HiGHS', async () => {
    const P: ProblemaEstocastico = {
      depositos: C.bases.map((b) => ({ id: b.id, costoFijo: b.costoFijo, capacidad: b.capacidad })),
      clientes: C.barrios,
      escenarios: [],
      costo: (d, c) => costoSalida(C, C.bases.find((b) => b.id === d)!, C.barrios.find((z) => z.id === c)!),
      penalidad: C.privada.costo,
    };
    const dias = simularDias(C, 12, 99);
    for (const [k, d] of dias.entries()) {
      const plan = (k * 37 + 11) % cantidadPlanes(C);
      const propio = resolverDia(C, plan, d);
      const abiertas = new Set(basesDe(C, plan).map((b) => b.id));
      const highs = await resolverEscenario(P, { id: 's', prob: 1, demanda: d.llamadas }, abiertas);
      expect(propio.costo).toBeCloseTo(highs.costo, 6);
      // Todas las llamadas se atienden, y ninguna base pasa su capacidad.
      const atendidas = propio.asignacion.flat().reduce((s, v) => s + v, 0) + propio.privadas.reduce((s, v) => s + v, 0);
      expect(atendidas).toBeCloseTo(totalLlamadas(d), 9);
      C.bases.forEach((b, i) => expect(propio.asignacion[i].reduce((s, v) => s + v, 0)).toBeLessThanOrEqual(b.capacidad + 1e-9));
    }
  });

  // El análisis completo tarda unos segundos: se corre una vez para todas las conclusiones.
  const a = analizar(C, OPCIONES);
  const ev = (p: number) => a.evaluaciones[p];

  it('cada día quiere otra cosa: muchos planes óptimos distintos', () => {
    expect(new Set(a.diarios).size).toBeGreaterThanOrEqual(10);
    const nBases = a.diarios.map((p) => basesDe(C, p).length);
    expect(Math.max(...nBases) - Math.min(...nBases)).toBeGreaterThanOrEqual(3);
  });

  it('el giro: el mejor plan incluye una base que pierde la votación', () => {
    const f = frecuencias(C, a.diarios);
    const perdedoras = C.bases.filter((_, i) => a.saa.plan & (1 << i) && f[i] <= 0.5);
    expect(perdedoras.length).toBeGreaterThanOrEqual(1);
    expect(a.voto).not.toBe(a.saa.plan);
    expect(a.promedio).not.toBe(a.saa.plan);
  });

  it('en días nuevos, SAA le gana a la votación y al día promedio (también en el día malo)', () => {
    const s = ev(a.saa.plan);
    for (const p of [a.voto, a.promedio]) {
      expect(ev(p).media).toBeGreaterThan(s.media + 2 * s.errorEstandar);
      expect(ev(p).p95).toBeGreaterThan(s.p95);
    }
    // Comparación pareada (mismos días): SAA es mejor en promedio con mucho margen.
    const dif = ev(a.voto).costos.map((c, i) => c - s.costos[i]);
    const m = dif.reduce((x, y) => x + y, 0) / dif.length;
    const sd = Math.sqrt(dif.reduce((x, y) => x + (y - m) ** 2, 0) / (dif.length - 1));
    expect(m / (sd / Math.sqrt(dif.length))).toBeGreaterThan(3);
  });

  it('todo plan cuesta más de lo que promete, y con muestras chicas mucho más', () => {
    for (const k of ['voto', 'promedio', 'saa'] as const) {
      const plan = k === 'saa' ? a.saa.plan : a[k];
      expect(ev(plan).media).toBeGreaterThan(a.enMuestra[k]);
    }
    const media = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    const brecha = a.tamanos.map((t) => media(t.real) - media(t.prometido));
    expect(brecha[0]).toBeGreaterThan(2 * brecha[brecha.length - 1]);
    // Con muestras grandes siempre se elige el mismo plan; con 5 días, no.
    expect(new Set(a.tamanos[0].planes).size).toBeGreaterThan(1);
    expect(new Set(a.tamanos[a.tamanos.length - 1].planes)).toEqual(new Set([a.saa.plan]));
  });

  it('el dilema final: todas las bases cuesta un poco más pero mejora el peor caso', () => {
    const s = ev(a.saa.plan);
    const t = ev(a.todas);
    expect(t.media).toBeGreaterThan(s.media);
    expect(t.minutosP95).toBeLessThan(s.minutosP95 - 0.5);
  });
});
