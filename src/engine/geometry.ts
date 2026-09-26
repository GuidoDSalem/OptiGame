import type { Constraint } from './model';

export type Point = [number, number];

/**
 * Región factible de un problema con dos variables: recorta el rectángulo [0,xmax]×[0,ymax]
 * con cada semiplano (Sutherland–Hodgman). Sirve para el método gráfico.
 */
export function feasiblePolygon(
  constraints: Constraint[],
  xVar: string,
  yVar: string,
  xmax: number,
  ymax: number,
): Point[] {
  let poly: Point[] = [
    [0, 0],
    [xmax, 0],
    [xmax, ymax],
    [0, ymax],
  ];
  for (const c of constraints) {
    const a = c.coefs[xVar] ?? 0;
    const b = c.coefs[yVar] ?? 0;
    const halfs: Array<[number, number, number]> =
      c.op === '<=' ? [[a, b, c.rhs]] : c.op === '>=' ? [[-a, -b, -c.rhs]] : [[a, b, c.rhs], [-a, -b, -c.rhs]];
    for (const [ha, hb, hc] of halfs) {
      poly = clip(poly, ha, hb, hc);
      if (poly.length === 0) return [];
    }
  }
  return poly;
}

/** Conserva la parte del polígono que cumple a·x + b·y ≤ c. */
function clip(poly: Point[], a: number, b: number, c: number): Point[] {
  const eps = 1e-9;
  const inside = (p: Point) => a * p[0] + b * p[1] <= c + eps;
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur);
    const prevIn = inside(prev);
    if (curIn !== prevIn) {
      const fp = a * prev[0] + b * prev[1] - c;
      const fc = a * cur[0] + b * cur[1] - c;
      const t = fp / (fp - fc);
      out.push([prev[0] + t * (cur[0] - prev[0]), prev[1] + t * (cur[1] - prev[1])]);
    }
    if (curIn) out.push(cur);
  }
  return out;
}

/** Segmento de la recta a·x + b·y = c dentro del rectángulo (para dibujar restricciones o isocostos). */
export function lineInBox(a: number, b: number, c: number, xmax: number, ymax: number): [Point, Point] | null {
  const pts: Point[] = [];
  const add = (x: number, y: number) => {
    if (x >= -1e-9 && x <= xmax + 1e-9 && y >= -1e-9 && y <= ymax + 1e-9) {
      if (!pts.some((p) => Math.abs(p[0] - x) < 1e-7 && Math.abs(p[1] - y) < 1e-7)) pts.push([x, y]);
    }
  };
  if (b !== 0) {
    add(0, c / b);
    add(xmax, (c - a * xmax) / b);
  }
  if (a !== 0) {
    add(c / a, 0);
    add((c - b * ymax) / a, ymax);
  }
  return pts.length >= 2 ? [pts[0], pts[1]] : null;
}
