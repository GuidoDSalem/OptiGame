import { describe, expect, it } from 'vitest';
import { decodificar, media, mejorReparto, simularEstacion, simularManana, type DatosBicisCrudos, type ViajeReal } from '../src/engine/bicis';
import { rng } from '../src/engine/ambulancias';
import { analizar } from '../src/casos/bicis/analisis';
import crudos from '../src/casos/bicis/datos.json';
import { ANCLAJES, FLOTA, modeloDe } from '../src/casos/bicis/modelo';

describe('Caso C2 · bicis (datos reales)', () => {
  const D = decodificar(crudos as unknown as DatosBicisCrudos);

  it('los datos preprocesados tienen la forma esperada', () => {
    expect(D.estaciones).toHaveLength(30);
    const d23 = D.dias.filter((d) => d.f.startsWith('2023'));
    const d24 = D.dias.filter((d) => d.f.startsWith('2024'));
    expect(d23.length).toBeGreaterThan(250);
    expect(d24.length).toBeGreaterThan(250);
    expect(D.dias.every((d) => d.ds < 5)).toBe(true); // sólo días hábiles
    expect(D.dias[0].c.length).toBe(D.estaciones.length * D.horas.length * 2);
  });

  it('la simulación de una estación cuenta bien las fallas', () => {
    // 3 salidas y 0 llegadas arrancando con 1 bici: fallan 2.
    expect(simularEstacion([3], [0], 1, 5)).toMatchObject({ sinBici: 2, sinLugar: 0 });
    // 0 salidas y 4 llegadas con capacidad 5 arrancando con 3: fallan 2 por falta de lugar.
    expect(simularEstacion([0], [4], 3, 5)).toMatchObject({ sinBici: 0, sinLugar: 2 });
    // Intercaladas parejo: 2 y 2 arrancando vacía, falla sólo la primera salida.
    expect(simularEstacion([2], [2], 0, 5).sinBici).toBe(1);
  });

  it('la programación dinámica da el mejor reparto (comparado con fuerza bruta)', () => {
    const r = rng(3);
    for (let caso = 0; caso < 20; caso++) {
      const C = 4;
      const E = 3;
      const F = 1 + Math.floor(r() * (E * C - 1));
      const g = Array.from({ length: E }, () => Array.from({ length: C + 1 }, () => Math.round(r() * 20)));
      let mejor = Infinity;
      for (let a = 0; a <= C; a++) for (let b = 0; b <= C; b++) {
        const c = F - a - b;
        if (c >= 0 && c <= C) mejor = Math.min(mejor, g[0][a] + g[1][b] + g[2][c]);
      }
      const dp = mejorReparto(g, F, C);
      expect(dp.valor).toBeCloseTo(mejor, 6);
      expect(dp.reparto.reduce((s, x) => s + x, 0)).toBe(F);
    }
  });

  const a = analizar(D, modeloDe(D));
  const m24 = (id: keyof typeof a.planes) => media(a.planes[id].fallas2024);

  it('todos los planes usan toda la flota y respetan los anclajes', () => {
    for (const p of Object.values(a.planes)) {
      expect(p.reparto.reduce((s, x) => s + x, 0)).toBe(FLOTA);
      expect(Math.max(...p.reparto)).toBeLessThanOrEqual(20);
    }
  });

  it('cada mañana quiere otra cosa', () => {
    expect(new Set(a.diarios.map((r) => r.join())).size).toBeGreaterThan(a.n2023 / 2);
  });

  it('en 2024, SAA le gana con claridad a las tentaciones y a la regla', () => {
    expect(m24('saa')).toBeLessThan(0.8 * m24('diaPromedio'));
    expect(m24('saa')).toBeLessThan(0.8 * m24('promDecisiones'));
    expect(m24('diaPromedio')).toBeLessThan(m24('medio'));
  });

  it('decidir con 2023 cuesta poco frente a conocer 2024 de antemano', () => {
    expect(m24('saa')).toBeGreaterThanOrEqual(a.retrospectivo2024.valor - 1e-9);
    expect(m24('saa')).toBeLessThan(1.1 * a.retrospectivo2024.valor);
  });

  it('el pronóstico de lluvia no mejora el reparto', () => {
    expect(Math.abs(a.pronostico.fallas2024 - m24('saa'))).toBeLessThan(1);
  });

  it('con pocas mañanas el modelo promete más de lo que da', () => {
    const chico = a.tamanos[1];
    expect(media(chico.real)).toBeGreaterThan(media(chico.prometido) + 2);
    const grande = a.tamanos[a.tamanos.length - 1];
    expect(Math.abs(media(grande.real) - media(grande.prometido))).toBeLessThan(2);
  });

  it('la reproducción no saca bicis de estaciones vacías ni las hace aparecer en el destino', () => {
    // Un viaje sale de una estación vacía: no se hace y tampoco llega.
    const r = simularManana([[0, 1, 400, 410]], [0, 5], ANCLAJES);
    expect(r.perdido[0]).toBe(1);
    expect(r.sinBici.at(-1)).toBe(1);
    expect(r.niveles.at(-1)).toEqual(Int16Array.from([0, 5]));

    const animados = (crudos as unknown as DatosBicisCrudos).animados!;
    const medio = D.estaciones.map(() => FLOTA / D.estaciones.length);
    for (const viajes of Object.values(animados) as ViajeReal[][]) {
      const sim = simularManana(viajes, medio, ANCLAJES);
      expect(sim.sinBici.at(-1)).toBeGreaterThan(0);
      // Conservación por estación: sólo mueven bicis los viajes que se hicieron.
      const final = [...medio];
      viajes.forEach(([o, d, t0, t1], k) => {
        if (sim.perdido[k]) return;
        if (o >= 0 && t0 < 12 * 60) final[o]--;
        if (d >= 0 && t1 < 12 * 60) final[d]++;
      });
      for (const f of sim.fallas) if (f.tipo === 'sin-lugar') final[f.e]--;
      expect(Array.from(sim.niveles.at(-1)!)).toEqual(final);
    }
  });
});
