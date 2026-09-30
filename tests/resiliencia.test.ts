import { beforeAll, describe, expect, it } from 'vitest';
import { costoBlindaje, gastoAnual, impacto, necesidadSemanal, nodosDeRiesgo, tts, type Red } from '../src/engine/resiliencia';
import { analizar, type AnalisisResiliencia } from '../src/casos/resiliencia/analisis';
import { OPCIONES, PRESUPUESTO_RECOMENDADO, RED } from '../src/casos/resiliencia/planta';

/** Red mínima: un producto con una pieza de un proveedor único y otra con dos. */
const CHICA: Red = {
  tasaStock: 0.25,
  horizonte: 52,
  items: [
    { id: 'p', nombre: 'P', tipo: 'producto', unidad: 'u', costo: 0, stock: 0, demanda: 10, margen: 100, bom: { a: 1, b: 2 } },
    { id: 'a', nombre: 'A', tipo: 'pieza', unidad: 'u', costo: 1, stock: 30 },
    { id: 'b', nombre: 'B', tipo: 'pieza', unidad: 'u', costo: 1, stock: 40 },
  ],
  sitios: [
    { id: 'f', nombre: 'F', corto: 'F', lugar: '', tipo: 'planta', nivel: 0, ttr: 10, capTotal: 20, produce: { p: { cap: 20, normal: 10 } } },
    { id: 'sa', nombre: 'SA', corto: 'SA', lugar: '', tipo: 'proveedor', nivel: 1, ttr: 5, produce: { a: { cap: 12, normal: 10 } } },
    { id: 'b1', nombre: 'B1', corto: 'B1', lugar: '', tipo: 'proveedor', nivel: 1, ttr: 4, produce: { b: { cap: 20, normal: 12 } } },
    { id: 'b2', nombre: 'B2', corto: 'B2', lugar: '', tipo: 'proveedor', nivel: 1, ttr: 4, produce: { b: { cap: 10, normal: 8 } } },
  ],
  acciones: [],
};

describe('Motor de riesgo de suministro (TTS / TTR)', () => {
  it('el TTS coincide con la cuenta a mano', async () => {
    // Proveedor único: el stock de A dura 30 / 10 = 3 semanas.
    expect((await tts(CHICA, 'sa')).valor).toBeCloseTo(3);
    // Se cae B1: B2 da 10 de las 20 por semana; 40 de stock / 10 que faltan = 4 semanas.
    expect((await tts(CHICA, 'b1')).valor).toBeCloseTo(4);
    // Se cae B2: B1 sube a 20 y cubre todo.
    expect((await tts(CHICA, 'b2')).valor).toBe(52);
  });

  it('la pérdida es cero hasta el TTS y después crece con el margen', async () => {
    expect((await impacto(CHICA, 'sa', 3)).perdida).toBeCloseTo(0);
    // 5 semanas sin A: sólo se fabrican 30 de 50 → 20 × 100.
    expect((await impacto(CHICA, 'sa', 5)).perdida).toBeCloseTo(2000);
  });
});

describe('Caso C3 · Agro Pampa', () => {
  let a: AnalisisResiliencia;
  beforeAll(async () => {
    a = await analizar(RED, OPCIONES);
  }, 120000);

  it('la red normal es factible: los volúmenes normales cubren la necesidad y respetan la capacidad', () => {
    const nec = necesidadSemanal(RED);
    for (const it of RED.items.filter((x) => x.tipo !== 'producto')) {
      const normal = RED.sitios.reduce((s, x) => s + (x.produce[it.id]?.normal ?? 0), 0);
      expect(normal, it.id).toBeGreaterThanOrEqual(nec[it.id] - 1e-6);
    }
    for (const s of RED.sitios) for (const { cap, normal } of Object.values(s.produce)) expect(normal).toBeLessThanOrEqual(cap);
  });

  it('la caída más cara es la bulonera, uno de los proveedores a los que menos se les compra', () => {
    const porPerdida = [...a.nodos].sort((p, q) => q.perdida - p.perdida);
    expect(porPerdida[0].id).toBe('bsj');
    const directos = nodosDeRiesgo(RED).filter((s) => s.nivel === 1).sort((p, q) => gastoAnual(RED, p) - gastoAnual(RED, q));
    expect(directos.findIndex((s) => s.id === 'bsj')).toBeLessThan(3);
    // Entre las tres más caras hay un proveedor de proveedores (no se le compra nada).
    expect(porPerdida.slice(0, 3).some((n) => RED.sitios.find((s) => s.id === n.id)?.nivel === 2)).toBe(true);
    // El proveedor al que más se le compra llega a tiempo.
    const mayor = a.nodos.reduce((m, n) => (n.gasto > m.gasto ? n : m));
    expect(mayor.perdida).toBe(0);
  });

  it('la pérdida es cero justo hasta el TTS de cada proveedor expuesto', () => {
    for (const c of a.curvas) {
      const n = a.nodos.find((x) => x.id === c.id)!;
      c.semanas.forEach((w, k) => {
        if (w <= n.tts + 1e-6) expect(c.perdida[k], `${c.id} en ${w}`).toBeCloseTo(0, 3);
        else expect(c.perdida[k], `${c.id} en ${w}`).toBeGreaterThan(0);
      });
      // Convexa: cada semana más cuesta al menos lo que la anterior.
      for (let k = 2; k < c.perdida.length; k++) expect(c.perdida[k] - c.perdida[k - 1]).toBeGreaterThanOrEqual(c.perdida[k - 1] - c.perdida[k - 2] - 1e-3);
    }
  });

  it('el blindaje respeta el presupuesto y más plata nunca empeora el peor caso', () => {
    for (const f of OPCIONES.factores) {
      const serie = a.planes.filter((p) => p.factor === f);
      for (const p of serie) expect(costoBlindaje(RED, p.blindaje)).toBeLessThanOrEqual(p.presupuesto + 1e-3);
      for (let k = 1; k < serie.length; k++) expect(serie[k].peor).toBeLessThanOrEqual(serie[k - 1].peor + 1e-3);
    }
  });

  it('reforzar al proveedor más grande no mejora el peor caso; el blindaje óptimo con la misma plata sí', () => {
    expect(a.intuitivo.peor).toBeCloseTo(a.planes[0].peor);
    const mismo = a.planes.find((p) => p.factor === 1 && p.presupuesto >= a.intuitivo.costo)!;
    expect(mismo.peor).toBeLessThan(a.intuitivo.peor / 2);
  });

  it('planear con margen protege más si los proveedores tardan más', () => {
    const conMargen = a.planes.find((p) => p.factor === OPCIONES.factorLento && p.presupuesto === PRESUPUESTO_RECOMENDADO)!;
    const sinMargen = a.planes.find((p) => p.factor === 1 && p.presupuesto === PRESUPUESTO_RECOMENDADO)!;
    expect(conMargen.peorLento).toBeLessThan(sinMargen.peorLento);
  });
});
