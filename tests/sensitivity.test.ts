import { describe, expect, it } from 'vitest';
import { bumpRhs, improves } from '../src/engine/sensitivity';
import { solve } from '../src/engine/solver';
import { campanaMarketing } from '../src/levels/campana-marketing';
import { plantaAgua } from '../src/levels/planta-agua';
import { transporteLacteos } from '../src/levels/transporte-lacteos';

/** El precio sombra debe predecir el cambio real del objetivo al subir el lado derecho en 1. */
async function check(model: typeof plantaAgua.referenceModel, rowId: string) {
  const r = await solve(model);
  const i = model.constraints.findIndex((c) => c.id === rowId);
  const b = await bumpRhs(model, i, r.objective!);
  return { dual: r.rows[i].dual!, delta: b.delta! };
}

describe('precio sombra = cambio real con +1', () => {
  it('nivel 1: una unidad más de demanda cuesta $104', async () => {
    const { dual, delta } = await check(plantaAgua.referenceModel, 'demanda');
    expect(dual).toBeCloseTo(104);
    expect(delta).toBeCloseTo(dual);
    expect(improves('min', delta)).toBe(false);
  });

  it('nivel 2: $1k más de presupuesto suma alcance', async () => {
    const { dual, delta } = await check(campanaMarketing.referenceModel, 'presupuesto');
    expect(dual).toBeGreaterThan(0);
    expect(delta).toBeCloseTo(dual, 4);
    expect(improves('max', delta)).toBe(true);
  });

  it('nivel 3: un camión más de capacidad en Esperanza ahorra $3k', async () => {
    const m = transporteLacteos.referenceModel;
    const row = m.constraints.find((c) => c.name === 'Oferta: Esperanza')!;
    const { dual, delta } = await check(m, row.id);
    expect(dual).toBeCloseTo(-3);
    expect(delta).toBeCloseTo(-3);
  });

  it('una restricción con holgura tiene precio sombra 0 y +1 no cambia nada', async () => {
    const { dual, delta } = await check(plantaAgua.referenceModel, 'coagulante');
    expect(dual).toBeCloseTo(0);
    expect(delta).toBeCloseTo(0);
  });
});
