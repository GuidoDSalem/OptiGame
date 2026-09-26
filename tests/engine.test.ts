import { describe, expect, it } from 'vitest';
import { feasiblePolygon } from '../src/engine/geometry';
import { toLpFormat, type LPModel } from '../src/engine/model';
import { solve } from '../src/engine/solver';

const base: LPModel = {
  sense: 'max',
  objective: { a: 30, b: 50 },
  variables: [{ id: 'a' }, { id: 'b' }],
  constraints: [
    { id: 'c1', name: 'Carpintería', coefs: { a: 1, b: 2 }, op: '<=', rhs: 40 },
    { id: 'c2', name: 'Terminación', coefs: { a: 2, b: 1 }, op: '<=', rhs: 50 },
  ],
};

describe('toLpFormat', () => {
  it('genera formato CPLEX LP', () => {
    expect(toLpFormat(base)).toBe(
      ['Maximize', ' obj: 30 a + 50 b', 'Subject To', ' c1: a + 2 b <= 40', ' c2: 2 a + b <= 50', 'Bounds', ' 0 <= a <= +inf', ' 0 <= b <= +inf', 'End'].join('\n'),
    );
  });

  it('maneja coeficientes negativos y objetivo vacío', () => {
    const lp = toLpFormat({ ...base, objective: {}, constraints: [{ id: 'x', name: 'x', coefs: { a: -3, b: 1 }, op: '>=', rhs: 0 }] });
    expect(lp).toContain('obj: 0 a');
    expect(lp).toContain('x: - 3 a + b >= 0');
  });
});

describe('solve', () => {
  it('resuelve un LP y devuelve precios sombra', async () => {
    const r = await solve(base);
    expect(r.status).toBe('optimal');
    expect(r.objective).toBeCloseTo(1100);
    expect(r.values.a).toBeCloseTo(20);
    expect(r.values.b).toBeCloseTo(10);
    expect(r.rows[0].dual).toBeDefined();
  });

  it('detecta modelos no acotados', async () => {
    const r = await solve({ ...base, constraints: [] });
    expect(r.status).toBe('unbounded');
  });

  it('detecta modelos infactibles', async () => {
    const r = await solve({
      ...base,
      constraints: [
        { id: 'c1', name: 'a', coefs: { a: 1 }, op: '>=', rhs: 10 },
        { id: 'c2', name: 'b', coefs: { a: 1 }, op: '<=', rhs: 5 },
      ],
    });
    expect(r.status).toBe('infeasible');
  });

  it('resuelve modelos enteros', async () => {
    const r = await solve({
      ...base,
      variables: [{ id: 'a', integer: true }, { id: 'b', integer: true }],
      constraints: [{ id: 'c1', name: 'c', coefs: { a: 2, b: 2 }, op: '<=', rhs: 5 }],
    });
    expect(r.status).toBe('optimal');
    expect(Number.isInteger(r.values.a) && Number.isInteger(r.values.b)).toBe(true);
    expect(r.objective).toBe(100);
  });
});

describe('feasiblePolygon', () => {
  it('recorta el cuadrado con semiplanos', () => {
    const poly = feasiblePolygon(base.constraints, 'a', 'b', 50, 50);
    const has = (x: number, y: number) => poly.some((p) => Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6);
    expect(has(0, 0)).toBe(true);
    expect(has(25, 0)).toBe(true);
    expect(has(20, 10)).toBe(true);
    expect(has(0, 20)).toBe(true);
    expect(poly).toHaveLength(4);
  });
});
