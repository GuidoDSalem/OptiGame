export interface PlotPoint {
  g: number; // impacto (eje x)
  f: number; // beneficio (eje y)
  kind: 'frontera' | 'no-soportado' | 'intento' | 'actual' | 'solucion';
  title?: string;
}

const W = 360;
const H = 240;
const PAD = { l: 44, r: 12, t: 26, b: 34 };

/** Dispersión impacto (x) vs. beneficio (y), con el tope del cliente como línea vertical. */
export function ParetoPlot({
  points,
  tope,
  xLabel,
  yLabel,
  escalera,
}: {
  points: PlotPoint[];
  tope: number;
  xLabel: string;
  yLabel: string;
  /** Unir los puntos de la frontera en escalera. */
  escalera?: boolean;
}) {
  const gs = [...points.map((p) => p.g), tope];
  const fs = points.map((p) => p.f);
  const gMin = Math.min(0, ...gs);
  const gMax = Math.max(...gs) + 5;
  const fMax = Math.max(1, ...fs) * 1.08;
  const sx = (g: number) => PAD.l + ((g - gMin) / (gMax - gMin)) * (W - PAD.l - PAD.r);
  const sy = (f: number) => H - PAD.b - (f / fMax) * (H - PAD.t - PAD.b);
  const front = points.filter((p) => p.kind === 'frontera' || p.kind === 'no-soportado').sort((a, b) => a.g - b.g);
  const stair = front.map((p, i) => (i === 0 ? `M${sx(p.g)},${sy(p.f)}` : `H${sx(p.g)} V${sy(p.f)}`)).join(' ');
  const ticksX = [gMin, (gMin + gMax) / 2, gMax].map((t) => Math.round(t));
  const ticksY = [0, fMax / 2, fMax].map((t) => Math.round(t));

  return (
    <svg className="plot pareto" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.4 }}>
      {ticksX.map((t) => (
        <g key={`x${t}`} className="grid">
          <line x1={sx(t)} y1={sy(0)} x2={sx(t)} y2={PAD.t} />
          <text x={sx(t)} y={H - PAD.b + 14} textAnchor="middle">
            {t}
          </text>
        </g>
      ))}
      {ticksY.map((t) => (
        <g key={`y${t}`} className="grid">
          <line x1={PAD.l} y1={sy(t)} x2={W - PAD.r} y2={sy(t)} />
          <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      <line className="tope" x1={sx(tope)} y1={PAD.t} x2={sx(tope)} y2={sy(0)} />
      <text className="tope-label" x={sx(tope) + 4} y={PAD.t + 10}>
        tope
      </text>
      {escalera && front.length > 1 && <path className="stair" d={stair} />}
      {points.map((p, i) => (
        <circle key={i} className={`pt-${p.kind}`} cx={sx(p.g)} cy={sy(p.f)} r={p.kind === 'solucion' || p.kind === 'actual' ? 6 : 4}>
          {p.title && <title>{p.title}</title>}
        </circle>
      ))}
      <text className="axis" x={W - PAD.r} y={H - 4} textAnchor="end">
        {xLabel}
      </text>
      <text className="axis" x={PAD.l} y={12}>
        {yLabel}
      </text>
    </svg>
  );
}
