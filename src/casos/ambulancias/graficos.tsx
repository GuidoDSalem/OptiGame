import type { Dia } from '../../engine/ambulancias';
import { totalLlamadas } from '../../engine/ambulancias';

export const fmt = (n: number, d = 0) => n.toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d });
export const tipoDia = (d: Dia) => (d.critico ? 'critico' : d.evento ? 'evento' : 'normal');

/* ---------- Pila de días: cada punto es un día, apilado según sus llamadas ---------- */

export function PilaDeDias({
  dias,
  visibles = dias.length,
  seleccionado,
  onSelect,
  ancho = 5,
}: {
  dias: Dia[];
  visibles?: number;
  seleccionado?: number | null;
  onSelect?(i: number): void;
  /** Ancho de cada columna (llamadas). */
  ancho?: number;
}) {
  const tot = dias.map(totalLlamadas);
  const lo = Math.floor(Math.min(...tot) / ancho) * ancho;
  const hi = Math.ceil((Math.max(...tot) + 1) / ancho) * ancho;
  const cols = (hi - lo) / ancho;
  const W = 640;
  const R = 4.2;
  const L = 8;
  const alturas = new Array(cols).fill(0);
  const pos = tot.map((t) => {
    const c = Math.min(cols - 1, Math.floor((t - lo) / ancho));
    return { c, k: alturas[c]++ };
  });
  const maxAlto = Math.max(...alturas);
  const H = Math.max(120, maxAlto * R * 2 + 40);
  const cx = (c: number) => L + ((c + 0.5) / cols) * (W - 2 * L);
  const ticks = Array.from({ length: cols + 1 }, (_, i) => lo + i * ancho).filter((_, i) => i % Math.ceil(cols / 8) === 0);

  return (
    <svg className="grafico pila" viewBox={`0 0 ${W} ${H}`} width="100%">
      <line className="eje" x1={L} y1={H - 24} x2={W - L} y2={H - 24} />
      {ticks.map((t) => (
        <text key={t} className="tick" x={L + ((t - lo) / (hi - lo)) * (W - 2 * L)} y={H - 8} textAnchor="middle">
          {t}
        </text>
      ))}
      {dias.map((d, i) => {
        if (i >= visibles) return null;
        const { c, k } = pos[i];
        return (
          <circle
            key={d.n}
            className={`dia ${tipoDia(d)} ${seleccionado === i ? 'sel' : ''}`}
            cx={cx(c)}
            cy={H - 24 - R - k * R * 2}
            r={seleccionado === i ? R + 1.5 : R - 0.4}
            onClick={onSelect ? () => onSelect(i) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            <title>
              Día {d.n + 1}: {tot[i]} llamadas{d.critico ? ' · día crítico' : ''}
              {d.evento ? ` · evento en ${d.evento}` : ''}
            </title>
          </circle>
        );
      })}
      <text className="tick" x={W - L} y={14} textAnchor="end">
        llamadas en el día →
      </text>
    </svg>
  );
}

export function Leyenda({ items }: { items: { clase: string; texto: string }[] }) {
  return (
    <p className="leyenda-caso">
      {items.map((it) => (
        <span key={it.clase}>
          <i className={it.clase} /> {it.texto}
        </span>
      ))}
    </p>
  );
}

/* ---------- Dispersión: llamadas de dos barrios, día por día ---------- */

export function Dispersion({ dias, a, b, labelA, labelB }: { dias: Dia[]; a: string; b: string; labelA: string; labelB: string }) {
  const W = 300;
  const H = 260;
  const L = 36;
  const B = 34;
  const xs = dias.map((d) => d.llamadas[a]);
  const ys = dias.map((d) => d.llamadas[b]);
  const mx = Math.max(...xs) + 2;
  const my = Math.max(...ys) + 2;
  const sx = (v: number) => L + (v / mx) * (W - L - 10);
  const sy = (v: number) => H - B - (v / my) * (H - B - 10);
  const r = correlacion(xs, ys);
  return (
    <figure className="dispersion">
      <svg className="grafico" viewBox={`0 0 ${W} ${H}`} width="100%">
        <line className="eje" x1={L} y1={H - B} x2={W - 10} y2={H - B} />
        <line className="eje" x1={L} y1={10} x2={L} y2={H - B} />
        {dias.map((d, i) => (
          <circle key={d.n} className={`dia ${tipoDia(d)}`} cx={sx(xs[i])} cy={sy(ys[i])} r={3.2} opacity={0.75} />
        ))}
        <text className="tick" x={(W + L) / 2} y={H - 8} textAnchor="middle">
          {labelA}
        </text>
        <text className="tick" x={12} y={(H - B) / 2} textAnchor="middle" transform={`rotate(-90 12 ${(H - B) / 2})`}>
          {labelB}
        </text>
      </svg>
      <figcaption className="caption">Correlación: {fmt(r, 2)}</figcaption>
    </figure>
  );
}

export function correlacion(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/* ---------- Frecuencia de cada base en los óptimos diarios ---------- */

export function BarrasFrecuencia({
  items,
}: {
  items: { label: string; valor: number; enVoto: boolean; enSaa?: boolean }[];
}) {
  const W = 640;
  const fila = 30;
  const L = 170;
  const H = items.length * fila + 30;
  const sx = (v: number) => L + v * (W - L - 50);
  return (
    <svg className="grafico barras" viewBox={`0 0 ${W} ${H}`} width="100%">
      {items.map((it, i) => (
        <g key={it.label} transform={`translate(0, ${i * fila + 6})`}>
          <text className="etiqueta" x={L - 10} y={fila / 2 + 4} textAnchor="end">
            {it.label}
          </text>
          <rect className={`barra ${it.enVoto ? 'gana' : 'pierde'}`} x={L} y={4} width={Math.max(1, sx(it.valor) - L)} height={fila - 10} rx={3} />
          <text className="valor" x={sx(it.valor) + 6} y={fila / 2 + 4}>
            {fmt(it.valor * 100)}%{it.enSaa !== undefined && (it.enSaa ? ' · en el mejor plan' : '')}
          </text>
        </g>
      ))}
      <line className="umbral" x1={sx(0.5)} y1={0} x2={sx(0.5)} y2={H - 20} />
      <text className="tick" x={sx(0.5)} y={H - 6} textAnchor="middle">
        mitad de los días
      </text>
    </svg>
  );
}

/* ---------- Histogramas de costo diario, uno por plan, con el mismo eje ---------- */

export function HistogramasCosto({
  series,
  bins = 36,
}: {
  series: { label: string; valores: number[]; media: number; p95: number; clase: string }[];
  bins?: number;
}) {
  const todos = series.flatMap((s) => s.valores);
  const lo = percentilSimple(todos, 0.005);
  const hi = percentilSimple(todos, 0.995);
  const W = 640;
  const alto = 86;
  const L = 8;
  const H = series.length * (alto + 26) + 24;
  const sx = (v: number) => L + ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (W - 2 * L);
  const conteos = series.map((s) => {
    const c = new Array(bins).fill(0);
    s.valores.forEach((v) => c[Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * bins)))]++);
    return c;
  });
  const maxC = Math.max(...conteos.flat());
  const bw = (W - 2 * L) / bins;
  return (
    <svg className="grafico histos" viewBox={`0 0 ${W} ${H}`} width="100%">
      {series.map((s, k) => {
        const y0 = k * (alto + 26) + 18;
        return (
          <g key={s.label} className={s.clase}>
            <text className="titulo-serie" x={L} y={y0 - 4}>
              {s.label}
            </text>
            {conteos[k].map((c, i) => (
              <rect key={i} className="bin" x={L + i * bw + 0.5} y={y0 + alto - (c / maxC) * alto} width={bw - 1} height={(c / maxC) * alto} />
            ))}
            <line className="eje" x1={L} y1={y0 + alto} x2={W - L} y2={y0 + alto} />
            <line className="media" x1={sx(s.media)} y1={y0 + 4} x2={sx(s.media)} y2={y0 + alto} />
            <text className="marca" x={sx(s.media) + 4} y={y0 + 14}>
              media {fmt(s.media)}
            </text>
            <line className="p95" x1={sx(s.p95)} y1={y0 + 24} x2={sx(s.p95)} y2={y0 + alto} />
            <text className="marca" x={sx(s.p95) + 4} y={y0 + 34}>
              p95 {fmt(s.p95)}
            </text>
          </g>
        );
      })}
      {[lo, (lo + hi) / 2, hi].map((t, i) => (
        <text key={t} className="tick" x={sx(t)} y={H - 4} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>
          {fmt(t)}
        </text>
      ))}
    </svg>
  );
}

function percentilSimple(xs: number[], q: number) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(q * (s.length - 1))];
}

/* ---------- Lo que promete el modelo vs. lo que pasa, según el tamaño de muestra ---------- */

export function CurvaTamanos({
  estudio,
  referencia,
  etiquetaReferencia = 'costo real del mejor plan',
  decimales = 0,
}: {
  estudio: { n: number; prometido: number[]; real: number[] }[];
  /** Costo real del mejor plan (línea de referencia). */
  referencia: number;
  etiquetaReferencia?: string;
  decimales?: number;
}) {
  const W = 640;
  const H = 300;
  const L = 56;
  const B = 36;
  const vals = estudio.flatMap((e) => [...e.prometido, ...e.real]);
  const margen = (Math.max(...vals, referencia) - Math.min(...vals, referencia)) * 0.08 || 1;
  const lo = Math.min(...vals, referencia) - margen;
  const hi = Math.max(...vals, referencia) + margen;
  const sx = (i: number) => L + ((i + 0.5) / estudio.length) * (W - L - 10);
  const sy = (v: number) => H - B - ((v - lo) / (hi - lo)) * (H - B - 12);
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const linea = (f: (e: (typeof estudio)[number]) => number) => estudio.map((e, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(f(e))}`).join(' ');
  const ticks = [lo + margen, (lo + hi) / 2, hi - margen];
  return (
    <svg className="grafico curva" viewBox={`0 0 ${W} ${H}`} width="100%">
      {ticks.map((t) => (
        <g key={t}>
          <line className="grilla" x1={L} y1={sy(t)} x2={W - 10} y2={sy(t)} />
          <text className="tick" x={L - 6} y={sy(t) + 4} textAnchor="end">
            {fmt(t, decimales)}
          </text>
        </g>
      ))}
      <line className="referencia" x1={L} y1={sy(referencia)} x2={W - 10} y2={sy(referencia)} />
      <text className="marca" x={W - 12} y={sy(referencia) - 6} textAnchor="end">
        {etiquetaReferencia}
      </text>
      {estudio.map((e, i) => (
        <g key={e.n}>
          {e.prometido.map((v, k) => (
            <circle key={`p${k}`} className="prometido" cx={sx(i) - 7} cy={sy(v)} r={3} />
          ))}
          {e.real.map((v, k) => (
            <circle key={`r${k}`} className="real" cx={sx(i) + 7} cy={sy(v)} r={3} />
          ))}
          <text className="tick" x={sx(i)} y={H - 14} textAnchor="middle">
            {e.n} días
          </text>
        </g>
      ))}
      <path className="linea-prometido" d={linea((e) => media(e.prometido))} />
      <path className="linea-real" d={linea((e) => media(e.real))} />
    </svg>
  );
}

export function BarraProgreso({ hecho, total, texto }: { hecho: number; total: number; texto: string }) {
  return (
    <div className="progreso-caso">
      <div className="barra">
        <div style={{ width: `${Math.min(100, (hecho / Math.max(1, total)) * 100)}%` }} />
      </div>
      <p className="caption">{texto}</p>
    </div>
  );
}
