import { useState, type ReactNode } from 'react';

export interface Serie {
  label: string;
  values: (number | null)[];
  className: string;
}

const W = 380;
const H = 200;
const PAD = { l: 48, r: 12, t: 14, b: 30 };

interface Props {
  series: Serie[];
  yLabel: string;
  /** Rondas del eje x aunque las series todavía no las tengan (para reproducir paso a paso). */
  rondas?: number;
  /** Rango fijo del eje y: [mínimo, máximo] de los valores que van a aparecer. */
  dominio?: [number, number];
  /** Ronda que se está mirando: se marca con una línea vertical. */
  marca?: number;
  /** Número de la primera ronda en el eje (1 por defecto; 0 si la primera es el arranque). */
  primera?: number;
  /** Detalle de una ronda al pasar el mouse (o tocarla); null si esa ronda no tiene nada que mostrar. */
  detalle?: (i: number) => ReactNode | null;
}

/** Evolución de cotas por ronda (p. ej. cota inferior vs. mejor solución en Benders). */
export function ConvergenceChart({ series, yLabel, rondas, dominio, marca, primera = 1, detalle }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const n = Math.max(1, rondas ?? 0, ...series.map((s) => s.values.length));
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  if (!all.length && !dominio) return null;
  const lo = dominio?.[0] ?? Math.min(...all);
  const hi = dominio?.[1] ?? Math.max(...all);
  const pad = (hi - lo) * 0.08 || 1;
  const yMin = Math.max(0, lo - pad);
  const yMax = hi + pad;
  const sx = (i: number) => PAD.l + (n === 1 ? 0.5 : i / (n - 1)) * (W - PAD.l - PAD.r);
  const sy = (v: number) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const paso = n === 1 ? W - PAD.l - PAD.r : (W - PAD.l - PAD.r) / (n - 1);
  const info = detalle && hover !== null ? detalle(hover) : null;

  return (
    <div className="convergence">
      <div className="plot-wrap" style={{ maxWidth: W * 1.4 }} onMouseLeave={() => setHover(null)}>
        <svg className="plot" viewBox={`0 0 ${W} ${H}`} width="100%">
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
              {n <= 20 || i % 2 === 0 ? i + primera : ''}
            </text>
          ))}
          {marca !== undefined && <line className="marca" x1={sx(marca)} y1={PAD.t} x2={sx(marca)} y2={H - PAD.b} />}
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
          {detalle && hover !== null && info && (
            <line className="hover" x1={sx(hover)} y1={PAD.t} x2={sx(hover)} y2={H - PAD.b} />
          )}
          {detalle &&
            Array.from({ length: n }, (_, i) => (
              <rect
                key={i}
                className="zona"
                x={sx(i) - paso / 2}
                y={PAD.t}
                width={paso}
                height={H - PAD.t - PAD.b + 16}
                onMouseEnter={() => setHover(i)}
                onClick={() => setHover(i)}
              />
            ))}
        </svg>
        {info && hover !== null && (
          <div
            className={`chart-tip ${sx(hover) > W * 0.6 ? 'izq' : ''}`}
            style={{ left: `${(100 * sx(hover)) / W}%` }}
            role="tooltip"
          >
            {info}
          </div>
        )}
      </div>
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
