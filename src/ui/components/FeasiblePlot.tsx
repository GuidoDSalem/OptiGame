import { feasiblePolygon, lineInBox, type Point } from '../../engine/geometry';
import type { LPModel } from '../../engine/model';

interface Props {
  model: LPModel;
  x: string;
  y: string;
  xmax: number;
  ymax: number;
  xLabel: string;
  yLabel: string;
  /** Punto a marcar (decisión del jugador o solución). */
  point?: Record<string, number>;
  pointLabel?: string;
  /** Valor del objetivo para dibujar la recta de isocosto. */
  isoValue?: number;
  size?: number;
}

const PAD = 36;
const TOP = 24;

export function FeasiblePlot({
  model,
  x,
  y,
  xmax,
  ymax,
  xLabel,
  yLabel,
  point,
  pointLabel,
  isoValue,
  size = 340,
}: Props) {
  const W = size;
  const H = size;
  const sx = (v: number) => PAD + (v / xmax) * (W - PAD - 10);
  const sy = (v: number) => H - PAD - (v / ymax) * (H - PAD - TOP);
  const toPath = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])},${sy(p[1])}`).join(' ') + 'Z';

  const twoVar = model.constraints.filter((c) => Object.keys(c.coefs).every((k) => k === x || k === y));
  const poly = feasiblePolygon(twoVar, x, y, xmax, ymax);
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const iso =
    isoValue !== undefined
      ? lineInBox(model.objective[x] ?? 0, model.objective[y] ?? 0, isoValue, xmax, ymax)
      : null;

  return (
    <svg className="plot" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
      {ticks.map((t) => (
        <g key={t} className="grid">
          <line x1={sx(t * xmax)} y1={sy(0)} x2={sx(t * xmax)} y2={sy(ymax)} />
          <line x1={sx(0)} y1={sy(t * ymax)} x2={sx(xmax)} y2={sy(t * ymax)} />
          <text x={sx(t * xmax)} y={H - PAD + 14} textAnchor="middle">
            {Math.round(t * xmax)}
          </text>
          <text x={PAD - 6} y={sy(t * ymax) + 4} textAnchor="end">
            {Math.round(t * ymax)}
          </text>
        </g>
      ))}

      {twoVar.map((c) => {
        const seg = lineInBox(c.coefs[x] ?? 0, c.coefs[y] ?? 0, c.rhs, xmax, ymax);
        if (!seg) return null;
        return (
          <g key={c.id} className="cline">
            <line x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} />
          </g>
        );
      })}

      {poly.length > 0 && <path className="region" d={toPath(poly)} />}

      {iso && (
        <line className="iso" x1={sx(iso[0][0])} y1={sy(iso[0][1])} x2={sx(iso[1][0])} y2={sy(iso[1][1])} />
      )}

      {point && (
        <g className="pt">
          <circle cx={sx(point[x] ?? 0)} cy={sy(point[y] ?? 0)} r={5} />
          {pointLabel && (
            <text
              x={sx(point[x] ?? 0) + ((point[x] ?? 0) > xmax * 0.55 ? -8 : 8)}
              y={sy(point[y] ?? 0) - 8}
              textAnchor={(point[x] ?? 0) > xmax * 0.55 ? 'end' : 'start'}
            >
              {pointLabel}
            </text>
          )}
        </g>
      )}

      <text className="axis" x={W - 10} y={H - 6} textAnchor="end">
        {xLabel}
      </text>
      <text className="axis" x={PAD} y={14}>
        {yLabel}
      </text>
    </svg>
  );
}
