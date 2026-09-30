import type { Red, Sitio } from '../../engine/resiliencia';
import { fmt } from '../ambulancias/graficos';
import type { AnalisisResiliencia, Nodo, PlanBlindaje } from './analisis';

/** "US$ 3,8 M", "US$ 285 mil", "US$ 900". */
export function usd(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return `US$ ${fmt(n / 1e6, 1)} M`;
  if (a >= 1e4) return `US$ ${fmt(n / 1e3)} mil`;
  return `US$ ${fmt(n, a < 10 && a % 1 ? 2 : 0)}`;
}

export const semanas = (s: number, horizonte = 52) => (s >= horizonte - 1e-6 ? 'más de un año' : `${fmt(s, s % 1 ? 1 : 0)} ${s === 1 ? 'semana' : 'semanas'}`);

export const expuesto = (n: Nodo) => n.ttr > n.tts + 1e-6;

/* ---------- La red: nivel 2 → nivel 1 → plantas → productos ---------- */

/** Ítems (y productos) que dejan de llegar si se cae un sitio. */
export function afectados(red: Red, caido: string): Set<string> {
  const s = red.sitios.find((x) => x.id === caido);
  const out = new Set<string>(s ? Object.keys(s.produce) : []);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const it of red.items)
      if (!out.has(it.id) && Object.keys(it.bom ?? {}).some((j) => out.has(j))) {
        out.add(it.id);
        cambio = true;
      }
  }
  return out;
}

/** Orden vertical de los proveedores directos: cerca de sus proveedores de nivel 2. */
const ORDEN_N1 = ['mdc', 'ery', 'dbr', 'rie', 'hro', 'oht', 'npa', 'nsi', 'pco', 'pba', 'bsj', 'epr'];

interface Arista {
  de: string;
  a: string;
}

function aristas(red: Red): Arista[] {
  const out: Arista[] = [];
  const usa = (item: string, consume: string) => !!red.items.find((x) => x.id === item)?.bom?.[consume];
  for (const s of red.sitios)
    for (const t of red.sitios) {
      if (s === t) continue;
      // s abastece a t si t produce algo que usa algo de lo que produce s.
      if (Object.keys(t.produce).some((i) => Object.keys(s.produce).some((j) => usa(i, j)))) out.push({ de: s.id, a: t.id });
    }
  for (const p of red.sitios.filter((x) => x.tipo === 'planta')) for (const i of Object.keys(p.produce)) out.push({ de: p.id, a: i });
  return out;
}

export function RedDiagrama({
  red,
  nodos,
  caido,
  sel,
  onSelect,
  riesgo = false,
  compacto = false,
  animada = true,
}: {
  red: Red;
  nodos?: Nodo[];
  /** Sitio caído: sus flujos se cortan y los productos que dependen de él se marcan. */
  caido?: string | null;
  sel?: string | null;
  onSelect?(id: string): void;
  /** Pintar los proveedores expuestos (TTR > TTS). */
  riesgo?: boolean;
  compacto?: boolean;
  animada?: boolean;
}) {
  const W = compacto ? 320 : 700;
  const H = compacto ? 220 : 430;
  const top = compacto ? 12 : 24;
  const cols = compacto ? [20, 110, 215, 290] : [125, 320, 480, 565];
  const n1 = ORDEN_N1.map((id) => red.sitios.find((s) => s.id === id)!).filter(Boolean);
  const paso = (H - 2 * top) / (n1.length - 1);
  const pos = new Map<string, [number, number]>();
  n1.forEach((s, k) => pos.set(s.id, [cols[1], top + k * paso]));
  const yMedia = (ids: string[]) => ids.reduce((a, id) => a + pos.get(id)![1], 0) / ids.length;
  const ars = aristas(red);
  for (const s of red.sitios.filter((x) => x.nivel === 2))
    pos.set(s.id, [cols[0], yMedia(ars.filter((a) => a.de === s.id).map((a) => a.a))]);
  const plantas = red.sitios.filter((x) => x.tipo === 'planta');
  plantas.forEach((p, k) => pos.set(p.id, [cols[2], top + ((k + 1) * (H - 2 * top)) / (plantas.length + 1)]));
  const productos = red.items.filter((x) => x.tipo === 'producto');
  productos.forEach((p, k) => pos.set(p.id, [cols[3], top + ((k + 1) * (H - 2 * top)) / (productos.length + 1)]));

  const gastoMax = Math.max(1, ...(nodos ?? []).map((n) => n.gasto));
  const radio = (s: Sitio) => {
    if (compacto) return s.nivel === 2 ? 3 : 3.5;
    const g = nodos?.find((n) => n.id === s.id)?.gasto;
    if (s.nivel === 2 || !g) return 6;
    return 4 + 9 * Math.sqrt(g / gastoMax);
  };
  const cortados = caido ? afectados(red, caido) : new Set<string>();
  const perdida = nodos?.find((n) => n.id === caido);
  // Productos que se dejan de vender si el caído tarda su TTR (o todos los afectados, sin análisis).
  const sinVenta = (p: string) => (caido ? (perdida ? (perdida.perdidas[p] ?? 0) > 1e-6 : cortados.has(p)) : false);
  const esExpuesto = (id: string) => riesgo && !!nodos?.find((n) => n.id === id && expuesto(n));

  const curva = (a: [number, number], b: [number, number]) => {
    const mx = (a[0] + b[0]) / 2;
    return `M${a[0]},${a[1]} C${mx},${a[1]} ${mx},${b[1]} ${b[0]},${b[1]}`;
  };

  return (
    <svg className={`grafico red-cadena ${compacto ? 'compacto' : ''} ${animada ? 'animada' : ''}`} viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Red de proveedores, plantas y productos">
      {!compacto &&
        ['Proveedores de\nproveedores', 'Proveedores\ndirectos', 'Plantas', 'Productos'].map((t, k) => (
          <text key={t} className="tick" x={cols[k]} y={H - 2} textAnchor="middle">
            {t.replace('\n', ' ')}
          </text>
        ))}
      {ars.map((a) => {
        const corta = a.de === caido;
        return <path key={`${a.de}-${a.a}`} className={`flujo ${corta ? 'cortado' : ''}`} d={curva(pos.get(a.de)!, pos.get(a.a)!)} />;
      })}
      {red.sitios.map((s) => {
        const [x, y] = pos.get(s.id)!;
        const planta = s.tipo === 'planta';
        const r = radio(s);
        const clase = ['nodo', `nivel${s.nivel}`, s.id === caido ? 'caido' : '', esExpuesto(s.id) ? 'expuesto' : '', sel === s.id ? 'sel' : ''].join(' ');
        const n = nodos?.find((x) => x.id === s.id);
        return (
          <g key={s.id} className={clase} onClick={onSelect && !planta ? () => onSelect(s.id) : undefined} style={onSelect && !planta ? { cursor: 'pointer' } : undefined}>
            <title>
              {s.nombre} ({s.lugar})
              {n ? ` · aguanta ${semanas(n.tts, red.horizonte)}, tarda ${semanas(n.ttr)} en volver${expuesto(n) ? ' · expuesto' : ''}` : ''}
            </title>
            {!planta && <circle className="hit" cx={x} cy={y} r={Math.max(r + 6, 11)} />}
            {planta ? <rect x={x - 7} y={y - 7} width={14} height={14} rx={2} /> : <circle cx={x} cy={y} r={r} />}
            {!compacto && (
              <text className="nombre" x={s.nivel === 2 ? x - r - 5 : planta ? x : x + r + 5} y={planta ? y - 12 : y + 4} textAnchor={s.nivel === 2 ? 'end' : planta ? 'middle' : 'start'}>
                {s.corto}
              </text>
            )}
          </g>
        );
      })}
      {productos.map((p) => {
        const [x, y] = pos.get(p.id)!;
        return (
          <g key={p.id} className={`producto ${sinVenta(p.id) ? 'sin-venta' : ''}`}>
            <title>{p.nombre}</title>
            <rect x={x - (compacto ? 5 : 8)} y={y - (compacto ? 5 : 8)} width={compacto ? 10 : 16} height={compacto ? 10 : 16} rx={compacto ? 5 : 8} />
            {!compacto && (
              <text className="nombre" x={x + 12} y={y + 4}>
                {p.nombre}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Gasto anual por proveedor ---------- */

export function BarrasGasto({ red, nodos }: { red: Red; nodos: { id: string; gasto: number }[] }) {
  const filas = [...nodos].sort((a, b) => b.gasto - a.gasto);
  const max = Math.max(...filas.map((n) => n.gasto));
  const W = 640;
  const L = 150;
  const R = 90;
  const fila = 24;
  const H = filas.length * fila + 8;
  return (
    <svg className="grafico barras-gasto" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Gasto anual con cada proveedor">
      {filas.map((n, k) => {
        const s = red.sitios.find((x) => x.id === n.id)!;
        const y = 4 + k * fila;
        const w = ((W - L - R) * n.gasto) / max;
        return (
          <g key={n.id}>
            <title>
              {s.nombre}: {n.gasto ? `${usd(n.gasto)} por año` : 'no le comprás directo (es proveedor de un proveedor)'}
            </title>
            <text className="etiqueta" x={L - 8} y={y + fila / 2 + 4} textAnchor="end">
              {s.corto}
            </text>
            {n.gasto > 0 ? (
              <rect className="barra" x={L} y={y + 5} width={Math.max(2, w)} height={fila - 10} rx={3} />
            ) : (
              <line className="grilla" x1={L} x2={L + 40} y1={y + fila / 2} y2={y + fila / 2} strokeDasharray="3 3" />
            )}
            <text className="valor" x={L + (n.gasto ? Math.max(2, w) : 40) + 6} y={y + fila / 2 + 4}>
              {n.gasto ? usd(n.gasto) : 'no le comprás directo'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Dos relojes: cuánto aguanta (TTS) y cuánto tarda en volver (TTR) ---------- */

export function Relojes({ red, nodos, sel, onSelect, max = 20 }: { red: Red; nodos: Nodo[]; sel?: string | null; onSelect?(id: string): void; max?: number }) {
  const filas = [...nodos].sort((a, b) => b.ttr - b.tts - (a.ttr - a.tts));
  const W = 640;
  const L = 150;
  const R = 44;
  const fila = 26;
  const top = 22;
  const H = top + filas.length * fila + 8;
  const x = (s: number) => L + ((W - L - R) * Math.min(s, max)) / max;
  const ticks = Array.from({ length: max / 4 + 1 }, (_, k) => k * 4);
  return (
    <svg className="grafico relojes" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Semanas que aguanta la red y semanas que tarda cada proveedor en volver">
      {ticks.map((t) => (
        <g key={t}>
          <line className="grilla" x1={x(t)} x2={x(t)} y1={top - 4} y2={H - 6} />
          <text className="tick" x={x(t)} y={top - 8} textAnchor="middle">
            {t === max ? `${t}+ sem.` : t}
          </text>
        </g>
      ))}
      {filas.map((n, k) => {
        const s = red.sitios.find((z) => z.id === n.id)!;
        const y = top + k * fila;
        const cy = y + fila / 2;
        const exp = expuesto(n);
        return (
          <g key={n.id} className={`reloj ${exp ? 'expuesto' : ''} ${sel === n.id ? 'sel' : ''}`} onClick={onSelect ? () => onSelect(n.id) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
            <title>
              {s.nombre}: la red aguanta {semanas(n.tts, red.horizonte)} sin él; tarda {semanas(n.ttr)} en volver.
              {exp ? ` Quedan ${fmt(n.ttr - n.tts, 1)} semanas sin poder cumplir.` : ' Llega a tiempo.'}
            </title>
            <rect className="hit" x={0} y={y} width={W} height={fila} />
            <text className="etiqueta" x={L - 8} y={cy + 4} textAnchor="end">
              {s.corto}
            </text>
            <rect className="aguanta" x={L} y={cy - 6} width={Math.max(0, x(n.tts) - L)} height={12} rx={3} />
            {exp && <rect className="parado" x={x(n.tts)} y={cy - 6} width={Math.max(0, x(n.ttr) - x(n.tts))} height={12} rx={3} />}
            <line className="ttr" x1={x(n.ttr)} x2={x(n.ttr)} y1={cy - 10} y2={cy + 10} />
            {n.tts > max && <text className="valor" x={x(max) + 4} y={cy + 4}>→</text>}
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Dos rankings: por gasto y por pérdida ---------- */

export function Pendiente({ red, nodos, resaltar = [] }: { red: Red; nodos: Nodo[]; resaltar?: string[] }) {
  const porGasto = [...nodos].sort((a, b) => b.gasto - a.gasto);
  const porPerdida = [...nodos].sort((a, b) => b.perdida - a.perdida || b.gasto - a.gasto);
  const W = 700;
  const fila = 26;
  const top = 30;
  const H = top + nodos.length * fila;
  const xa = 225;
  const xb = W - 225;
  const y = (k: number) => top + k * fila + fila / 2;
  return (
    <svg className="grafico pendiente" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Ranking de proveedores por gasto y por pérdida si se caen">
      <text className="tick" x={xa} y={14} textAnchor="end">
        por lo que les comprás
      </text>
      <text className="tick" x={xb} y={14}>
        por lo que perdés si se caen
      </text>
      {nodos.map((n) => {
        const s = red.sitios.find((z) => z.id === n.id)!;
        const ka = porGasto.indexOf(n);
        const kb = porPerdida.indexOf(n);
        const clase = resaltar.includes(n.id) ? 'resaltado' : n.perdida > 0 ? 'con-perdida' : '';
        return (
          <g key={n.id} className={`linea-rank ${clase}`}>
            <title>
              {s.nombre}: {n.gasto ? `${usd(n.gasto)} por año` : 'no le comprás directo'} · si se cae {semanas(n.ttr)}:{' '}
              {n.perdida ? `se pierden ${usd(n.perdida)}` : 'no se pierde nada'}
            </title>
            <line x1={xa + 6} y1={y(ka)} x2={xb - 6} y2={y(kb)} />
            <circle cx={xa + 6} cy={y(ka)} r={3.5} />
            <circle cx={xb - 6} cy={y(kb)} r={3.5} />
            <text className="etiqueta" x={xa - 4} y={y(ka) + 4} textAnchor="end">
              {s.corto} · {n.gasto ? usd(n.gasto) : '—'}
            </text>
            <text className="etiqueta" x={xb + 4} y={y(kb) + 4}>
              {n.perdida ? usd(n.perdida) : 'US$ 0'} · {s.corto}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Pérdida según las semanas caído ---------- */

export function CurvasPerdida({
  red,
  a,
  sel,
  onSelect,
}: {
  red: Red;
  a: AnalisisResiliencia;
  sel: string;
  onSelect(id: string): void;
}) {
  const W = 640;
  const H = 300;
  const L = 64;
  const R = 130;
  const T = 16;
  const B = 36;
  const max = Math.max(...a.curvas.map((c) => c.semanas[c.semanas.length - 1]));
  const pmax = Math.ceil(Math.max(...a.curvas.flatMap((c) => c.perdida)) / 2e6) * 2e6;
  const x = (s: number) => L + ((W - L - R) * s) / max;
  const y = (p: number) => H - B - ((H - T - B) * p) / pmax;
  const orden = [...a.curvas].sort((p, q) => (p.id === sel ? 1 : q.id === sel ? -1 : 0));
  const yticks = Array.from({ length: pmax / 2e6 + 1 }, (_, k) => k * 2e6);
  // Etiquetas al final de cada curva, separadas para que no se pisen.
  const finales = a.curvas.map((c) => ({ id: c.id, y: y(c.perdida[c.perdida.length - 1]) })).sort((p, q) => p.y - q.y);
  for (let k = 1; k < finales.length; k++) finales[k].y = Math.max(finales[k].y, finales[k - 1].y + 13);
  const nodo = a.nodos.find((n) => n.id === sel)!;
  return (
    <svg className="grafico curvas-perdida" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Margen perdido según las semanas que el proveedor está caído">
      {yticks.map((t) => (
        <g key={t}>
          <line className="grilla" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="tick" x={L - 6} y={y(t) + 4} textAnchor="end">
            {t ? `${fmt(t / 1e6)} M` : '0'}
          </text>
        </g>
      ))}
      {Array.from({ length: max / 4 + 1 }, (_, k) => k * 4).map((t) => (
        <text key={t} className="tick" x={x(t)} y={H - B + 16} textAnchor="middle">
          {t}
        </text>
      ))}
      <text className="tick" x={W - R} y={H - 4} textAnchor="end">
        semanas caído →
      </text>
      <text className="tick" x={L} y={10}>
        margen perdido (US$)
      </text>
      <line className="eje" x1={L} x2={W - R} y1={y(0)} y2={y(0)} />
      {nodo && (
        <g className="marcas-sel">
          <line className="marca-tts" x1={x(nodo.tts)} x2={x(nodo.tts)} y1={T} y2={H - B} />
          <text className="marca" x={x(nodo.tts) + 4} y={T + 10}>
            aguanta {semanas(nodo.tts)}
          </text>
          <line className="marca-ttr" x1={x(nodo.ttr)} x2={x(nodo.ttr)} y1={T + 16} y2={H - B} />
          <text className="marca" x={x(nodo.ttr) + 4} y={T + 26}>
            tarda {semanas(nodo.ttr)}
          </text>
        </g>
      )}
      {orden.map((c) => {
        const s = red.sitios.find((z) => z.id === c.id)!;
        const d = c.semanas.map((w, k) => `${k ? 'L' : 'M'}${x(w)},${y(c.perdida[k])}`).join(' ');
        const fy = finales.find((f) => f.id === c.id)!.y;
        return (
          <g key={c.id} className={`curva ${c.id === sel ? 'sel' : ''}`} onClick={() => onSelect(c.id)} style={{ cursor: 'pointer' }}>
            <title>
              {s.nombre}: {c.semanas.filter((w) => w % 4 === 0).map((w) => `${w} sem. → ${usd(c.perdida[w])}`).join(' · ')}
            </title>
            <path className="hit" d={d} />
            <path className="linea" d={d} />
            <text className="etiqueta" x={W - R + 6} y={fy + 4}>
              {s.corto}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Peor pérdida según el presupuesto ---------- */

export function CurvaPresupuesto({ planes, intuitivo, sel, onSelect }: { planes: PlanBlindaje[]; intuitivo: PlanBlindaje; sel?: number; onSelect?(p: number): void }) {
  const W = 640;
  const H = 280;
  const L = 64;
  const R = 24;
  const T = 16;
  const B = 40;
  const serie = planes.filter((p) => p.factor === 1);
  const bmax = Math.max(...serie.map((p) => p.presupuesto));
  const pmax = Math.ceil(Math.max(intuitivo.peor, ...serie.map((p) => p.peor)) / 1e6) * 1e6;
  const x = (b: number) => L + ((W - L - R) * b) / bmax;
  const y = (p: number) => H - B - ((H - T - B) * p) / pmax;
  const d = serie.map((p, k) => `${k ? 'L' : 'M'}${x(p.presupuesto)},${y(p.peor)}`).join(' ');
  return (
    <svg className="grafico curva-presupuesto" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Peor pérdida posible según el presupuesto anual de blindaje">
      {Array.from({ length: pmax / 1e6 + 1 }, (_, k) => k * 1e6).map((t) => (
        <g key={t}>
          <line className="grilla" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text className="tick" x={L - 6} y={y(t) + 4} textAnchor="end">
            {t ? `${fmt(t / 1e6)} M` : '0'}
          </text>
        </g>
      ))}
      {serie.filter((p, k) => k === 0 || x(p.presupuesto) - x(serie[k - 1].presupuesto) > 28).map((p) => (
        <text key={p.presupuesto} className="tick" x={x(p.presupuesto)} y={H - B + 16} textAnchor="middle">
          {p.presupuesto ? fmt(p.presupuesto / 1e3) : '0'}
        </text>
      ))}
      <text className="tick" x={W - R} y={H - 4} textAnchor="end">
        presupuesto anual (miles de US$) →
      </text>
      <text className="tick" x={L} y={10}>
        peor pérdida si se cae un proveedor (US$)
      </text>
      <path className="linea-plan" d={d} />
      {serie.map((p) => (
        <g key={p.presupuesto} className={`punto-plan ${sel === p.presupuesto ? 'sel' : ''}`} onClick={onSelect ? () => onSelect(p.presupuesto) : undefined} style={onSelect ? { cursor: 'pointer' } : undefined}>
          <title>
            Con {usd(p.presupuesto)} por año, la peor caída cuesta {usd(p.peor)}
          </title>
          <circle className="hit" cx={x(p.presupuesto)} cy={y(p.peor)} r={12} />
          <circle cx={x(p.presupuesto)} cy={y(p.peor)} r={sel === p.presupuesto ? 6 : 4.5} />
        </g>
      ))}
      <g className="punto-intuitivo">
        <title>Reforzar al proveedor más grande ({usd(intuitivo.costo)} por año): la peor caída sigue costando {usd(intuitivo.peor)}</title>
        <circle cx={x(intuitivo.costo)} cy={y(intuitivo.peor)} r={5} />
        <text className="etiqueta" x={x(intuitivo.costo) - 8} y={y(intuitivo.peor) + 4} textAnchor="end">
          reforzar al más grande
        </text>
      </g>
    </svg>
  );
}
