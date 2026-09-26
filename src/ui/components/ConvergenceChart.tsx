export interface Serie {
  label: string;
  values: (number | null)[];
  className: string;
}

const W = 380;
const H = 200;
const PAD = { l: 48, r: 12, t: 14, b: 30 };

/** Evolución de cotas por ronda (p. ej. cota inferior vs. mejor solución en Benders). */
export function ConvergenceChart({ series, yLabel }: { series: Serie[]; yLabel: string }) {
  const n = Math.max(1, ...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  if (!all.length) return null;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  const yMin = Math.max(0, lo - pad);
  const yMax = hi + pad;
  const sx = (i: number) => PAD.l + (n === 1 ? 0.5 : i / (n - 1)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const ticks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <div className="convergence">
      <svg className="plot" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W * 1.4 }}>
        {ticks.map((t) => (
          <g key={t} className="grid">
            <line x1={PAD.l} y1={sy(t)} x2={W - PAD.r} y2={sy(t)} />
            <text x={PAD.l - 6} y={sy(t) + 4} textAnchor="end">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {Array.from({ length: n }, (_, i) => (
          <text key={i} x={sx(i)} y={H - PAD.b + 14} textAnchor="middle">
            {n <= 20 || i % 2 === 0 ? i + 1 : ''}
          </text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null || !Number.isFinite(v) ? null : `${sx(i)},${sy(v)}`));
          const d = pts.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p}`).join(' ');
          return (
            <g key={s.label} className={s.className}>
              <path d={d} />
              {pts.map((p, i) => p && <circle key={i} cx={p.split(',')[0]} cy={p.split(',')[1]} r={3} />)}
            </g>
          );
        })}
        <text className="axis" x={W - PAD.r} y={H - 4} textAnchor="end">
          ronda
        </text>
        <text className="axis" x={PAD.l} y={10}>
          {yLabel}
        </text>
      </svg>
      <p className="legend">
        {series.map((s) => (
          <span key={s.label}>
            <span className={`dot ${s.className}`} /> {s.label}
          </span>
        ))}
      </p>
    </div>
  );
}
