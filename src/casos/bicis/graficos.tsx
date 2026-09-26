import type { DiaBici, EstacionBici } from '../../engine/bicis';
import { fmt } from '../ambulancias/graficos';

/** "RETIRO II" → "Retiro II"; los nombres ya prolijos quedan igual. Sin el número de estación. */
export function nombreCorto(n: string): string {
  const sinNumero = n.replace(/^\d+\s*-\s*/, '');
  if (sinNumero !== sinNumero.toUpperCase()) return sinNumero;
  return sinNumero
    .split(' ')
    .map((w) => (/^[IVX]+°?$/.test(w) || w.length <= 1 ? w : w[0] + w.slice(1).toLowerCase()))
    .join(' ');
}

export const esLluvia = (d: DiaBici, umbral = 2) => d.ll >= umbral;

/* ---------- Pila de mañanas: cada punto es un día hábil ---------- */

export function PilaMananas({
  dias,
  valores,
  visibles = dias.length,
  seleccionado,
  onSelect,
  ancho,
  etiqueta,
}: {
  dias: DiaBici[];
  valores: number[];
  visibles?: number;
  seleccionado?: number | null;
  onSelect?(i: number): void;
  ancho: number;
  etiqueta: string;
}) {
  const lo = Math.floor(Math.min(...valores) / ancho) * ancho;
  const hi = Math.ceil((Math.max(...valores) + 1) / ancho) * ancho;
  const cols = Math.max(1, (hi - lo) / ancho);
  const W = 640;
  const R = 4;
  const L = 8;
  const alt = new Array(cols).fill(0);
  const pos = valores.map((v) => {
    const c = Math.min(cols - 1, Math.floor((v - lo) / ancho));
    return { c, k: alt[c]++ };
  });
  const H = Math.max(120, Math.max(...alt) * R * 2 + 40);
  const cx = (c: number) => L + ((c + 0.5) / cols) * (W - 2 * L);
  const cada = Math.ceil(cols / 8);
  return (
    <svg className="grafico pila" viewBox={`0 0 ${W} ${H}`} width="100%">
      <line className="eje" x1={L} y1={H - 24} x2={W - L} y2={H - 24} />
      {Array.from({ length: cols + 1 }, (_, i) => i)
        .filter((i) => i % cada === 0)
        .map((i) => (
          <text key={i} className="tick" x={L + (i / cols) * (W - 2 * L)} y={H - 8} textAnchor="middle">
            {lo + i * ancho}
          </text>
        ))}
      {dias.map((d, i) =>
        i < visibles ? (
          <circle
            key={d.f}
            className={`dia ${esLluvia(d) ? 'lluvia' : 'seco'} ${seleccionado === i ? 'sel' : ''}`}
            cx={cx(pos[i].c)}
            cy={H - 24 - R - pos[i].k * R * 2}
            r={seleccionado === i ? R + 1.5 : R - 0.4}
            onClick={onSelect ? () => onSelect(i) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            <title>
              {fechaLarga(d.f)}: {valores[i]} {etiqueta}
              {d.ll >= 0.1 ? ` · ${fmt(d.ll, 1)} mm de lluvia` : ''}
            </title>
          </circle>
        ) : null,
      )}
      <text className="tick" x={W - L} y={14} textAnchor="end">
        {etiqueta} →
      </text>
    </svg>
  );
}

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaLarga(f: string): string {
  const [y, m, d] = f.split('-').map(Number);
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS[(dia + 6) % 7]} ${d} de ${MESES[m - 1]} de ${y}`;
}

/* ---------- Espagueti: saldo acumulado de una estación, un trazo por día ---------- */

export function Espagueti({
  titulo,
  curvas,
  horas,
  capacidad,
}: {
  titulo: string;
  /** Saldo acumulado (llegadas − salidas) al final de cada hora, un arreglo por día. */
  curvas: number[][];
  horas: number[];
  capacidad: number;
}) {
  const W = 300;
  const H = 220;
  const L = 34;
  const B = 26;
  const todos = curvas.flat();
  const lo = Math.min(-capacidad, ...todos);
  const hi = Math.max(capacidad, ...todos);
  const n = horas.length;
  const sx = (i: number) => L + (i / n) * (W - L - 8);
  const sy = (v: number) => 10 + ((hi - v) / (hi - lo)) * (H - B - 10);
  const prom = Array.from({ length: n }, (_, i) => curvas.reduce((s, c) => s + c[i], 0) / curvas.length);
  const path = (c: number[]) => `M${sx(0)},${sy(0)} ` + c.map((v, i) => `L${sx(i + 1)},${sy(v)}`).join(' ');
  return (
    <figure className="espagueti">
      <svg className="grafico" viewBox={`0 0 ${W} ${H}`} width="100%">
        <line className="grilla" x1={L} y1={sy(0)} x2={W - 8} y2={sy(0)} />
        {[capacidad, -capacidad].map((v) => (
          <g key={v}>
            <line className="limite" x1={L} y1={sy(v)} x2={W - 8} y2={sy(v)} />
            <text className="tick" x={L - 4} y={sy(v) + 4} textAnchor="end">
              {v > 0 ? `+${v}` : v}
            </text>
          </g>
        ))}
        {curvas.map((c, k) => (
          <path key={k} className="trazo" d={path(c)} />
        ))}
        <path className="trazo-medio" d={path(prom)} />
        {[0, n].map((i) => (
          <text key={i} className="tick" x={sx(i)} y={H - 6} textAnchor="middle">
            {i === 0 ? horas[0] : horas[n - 1] + 1} h
          </text>
        ))}
      </svg>
      <figcaption className="caption">
        <strong>{titulo}</strong>: bicis que entran menos las que salen, desde las {horas[0]} h. Cada línea es un día.
      </figcaption>
    </figure>
  );
}

/* ---------- Mapa de calor: el reparto ideal de cada día ---------- */

export function MapaCalor({
  filas,
  repartos,
  capacidad,
  seleccionado,
  onSelect,
}: {
  filas: string[];
  /** repartos[día][estación] */
  repartos: number[][];
  capacidad: number;
  seleccionado?: number | null;
  onSelect?(i: number): void;
}) {
  const W = 640;
  const L = 130;
  const fh = 11;
  const H = filas.length * fh + 22;
  const cw = (W - L) / repartos.length;
  return (
    <svg className="grafico calor" viewBox={`0 0 ${W} ${H}`} width="100%">
      {filas.map((f, e) => (
        <text key={f + e} className="etiqueta chica" x={L - 6} y={e * fh + fh - 2} textAnchor="end">
          {f}
        </text>
      ))}
      {repartos.map((r, d) => (
        <g key={d} onClick={onSelect ? () => onSelect(d) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
          {r.map((v, e) => (
            <rect key={e} x={L + d * cw} y={e * fh} width={cw + 0.3} height={fh - 1} style={{ fillOpacity: 0.08 + 0.92 * (v / capacidad) }} className="celda" />
          ))}
        </g>
      ))}
      {seleccionado != null && <rect className="columna-sel" x={L + seleccionado * cw - 1} y={-1} width={cw + 2} height={filas.length * fh + 1} />}
      <text className="tick" x={L} y={H - 4}>
        enero
      </text>
      <text className="tick" x={W} y={H - 4} textAnchor="end">
        diciembre →
      </text>
    </svg>
  );
}

/* ---------- Varios repartos, lado a lado ---------- */

export function TablaRepartos({
  estaciones,
  columnas,
  capacidad,
  orden,
}: {
  estaciones: EstacionBici[];
  columnas: { titulo: string; reparto: number[]; destacada?: boolean }[];
  capacidad: number;
  orden?: number[];
}) {
  const idx = orden ?? estaciones.map((_, i) => i);
  return (
    <div className="tabla-scroll">
      <table className="data repartos">
        <thead>
          <tr>
            <th>Estación</th>
            {columnas.map((c) => (
              <th key={c.titulo} className={c.destacada ? 'destacada' : ''}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {idx.map((e) => (
            <tr key={estaciones[e].id}>
              <td className="nowrap">{nombreCorto(estaciones[e].nombre)}</td>
              {columnas.map((c) => (
                <td key={c.titulo} className={c.destacada ? 'destacada' : ''}>
                  <span className="mini-barra">
                    <i style={{ width: `${(c.reparto[e] / capacidad) * 100}%` }} />
                  </span>
                  <span className="num">{c.reparto[e]}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Curva de fallas de una estación según con cuántas bicis arranca ---------- */

export function CurvaFallas({
  titulo,
  porDia,
  elegido,
  capacidad,
}: {
  titulo: string;
  /** porDia[día][s] */
  porDia: number[][];
  elegido: number;
  capacidad: number;
}) {
  const W = 320;
  const H = 220;
  const L = 34;
  const B = 30;
  const S = capacidad + 1;
  const prom = Array.from({ length: S }, (_, s) => porDia.reduce((t, d) => t + d[s], 0) / porDia.length);
  const hi = Math.max(4, ...prom.map((v) => v * 1.8), ...porDia.map((d) => Math.min(d[0], d[S - 1])));
  const sx = (s: number) => L + (s / capacidad) * (W - L - 10);
  const sy = (v: number) => 10 + (1 - Math.min(v, hi) / hi) * (H - B - 10);
  const path = (c: number[]) => c.map((v, s) => `${s ? 'L' : 'M'}${sx(s)},${sy(v)}`).join(' ');
  return (
    <figure className="curva-fallas">
      <svg className="grafico" viewBox={`0 0 ${W} ${H}`} width="100%">
        {porDia.map((c, k) => (
          <path key={k} className="trazo" d={path(c)} />
        ))}
        <path className="trazo-medio" d={path(prom)} />
        <line className="elegido" x1={sx(elegido)} y1={10} x2={sx(elegido)} y2={H - B} />
        <circle className="punto-elegido" cx={sx(elegido)} cy={sy(prom[elegido])} r={5} />
        <line className="eje" x1={L} y1={H - B} x2={W - 10} y2={H - B} />
        {[0, capacidad / 2, capacidad].map((s) => (
          <text key={s} className="tick" x={sx(s)} y={H - B + 14} textAnchor="middle">
            {s}
          </text>
        ))}
        <text className="tick" x={(W + L) / 2} y={H - 2} textAnchor="middle">
          bicis a las 6 de la mañana
        </text>
        {[0, hi / 2, hi].map((v) => (
          <text key={v} className="tick" x={L - 4} y={sy(v) + 4} textAnchor="end">
            {fmt(v)}
          </text>
        ))}
      </svg>
      <figcaption className="caption">
        <strong>{titulo}</strong>: viajes que fallan según con cuántas bicis arranca. Gris: cada día; negro: el
        promedio. La línea marca la mejor opción.
      </figcaption>
    </figure>
  );
}

/* ---------- Barras por mes: 2023 contra 2024 ---------- */

export function BarrasMeses({ series }: { series: { etiqueta: string; clase: string; valores: number[] }[] }) {
  const W = 640;
  const H = 220;
  const L = 44;
  const B = 26;
  const max = Math.max(...series.flatMap((s) => s.valores));
  const gw = (W - L - 8) / 12;
  const bw = (gw - 6) / series.length;
  const sy = (v: number) => 10 + (1 - v / max) * (H - B - 10);
  return (
    <svg className="grafico meses" viewBox={`0 0 ${W} ${H}`} width="100%">
      {[0, max / 2, max].map((v) => (
        <g key={v}>
          <line className="grilla" x1={L} y1={sy(v)} x2={W - 8} y2={sy(v)} />
          <text className="tick" x={L - 4} y={sy(v) + 4} textAnchor="end">
            {fmt(v / 1000)}k
          </text>
        </g>
      ))}
      {MESES.map((m, i) => (
        <g key={m}>
          {series.map((s, k) => (
            <rect key={s.etiqueta} className={`barra ${s.clase}`} x={L + i * gw + 3 + k * bw} y={sy(s.valores[i])} width={bw - 1} height={H - B - sy(s.valores[i])} />
          ))}
          <text className="tick" x={L + i * gw + gw / 2} y={H - 8} textAnchor="middle">
            {m.slice(0, 3)}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Dispersión: lluvia contra viajes ---------- */

export function DispersionLluvia({ dias }: { dias: DiaBici[] }) {
  const W = 320;
  const H = 240;
  const L = 44;
  const B = 34;
  const xs = dias.map((d) => Math.min(60, d.ll));
  const ys = dias.map((d) => d.zona);
  const mx = Math.max(...xs) || 1;
  const my = Math.max(...ys);
  const sx = (v: number) => L + (v / mx) * (W - L - 10);
  const sy = (v: number) => 10 + (1 - v / my) * (H - B - 10);
  return (
    <figure>
      <svg className="grafico" viewBox={`0 0 ${W} ${H}`} width="100%">
        <line className="eje" x1={L} y1={H - B} x2={W - 10} y2={H - B} />
        <line className="eje" x1={L} y1={10} x2={L} y2={H - B} />
        {dias.map((d, i) => (
          <circle key={d.f} className={`dia ${esLluvia(d) ? 'lluvia' : 'seco'}`} cx={sx(xs[i])} cy={sy(ys[i])} r={3} opacity={0.7} />
        ))}
        {[0, my / 2, my].map((v) => (
          <text key={v} className="tick" x={L - 4} y={sy(v) + 4} textAnchor="end">
            {fmt(v)}
          </text>
        ))}
        <text className="tick" x={(W + L) / 2} y={H - 8} textAnchor="middle">
          lluvia del día (mm)
        </text>
      </svg>
      <figcaption className="caption">Viajes por día en la zona según la lluvia (2023).</figcaption>
    </figure>
  );
}
