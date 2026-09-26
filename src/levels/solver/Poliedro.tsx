import { feasiblePolygon, lineInBox, type Point } from '../../engine/geometry';
import type { Constraint } from '../../engine/model';
import type { Fila, Problema2D, Vec } from '../../engine/ramificacion';

const aRestriccion = (f: Fila, k: number): Constraint => ({
  id: `f${k}`,
  name: f.nombre ?? `f${k}`,
  coefs: { x: f.a[0], y: f.a[1] },
  op: '<=',
  rhs: f.b,
});

const poligono = (filas: Fila[], xmax: number, ymax: number) => feasiblePolygon(filas.map(aRestriccion), 'x', 'y', xmax, ymax);

interface Props {
  P: Problema2D;
  xmax: number;
  ymax: number;
  xLabel: string;
  yLabel: string;
  /** Cortes agregados: recortan la región y se dibujan punteados. */
  cortes?: Fila[];
  /** Cotas de un nodo del árbol: se resalta esa parte de la región. */
  cotas?: Fila[];
  /** Otras regiones (hojas del árbol) en tono suave. */
  otras?: Fila[][];
  /** Óptimo de la relajación. */
  lp?: Vec | null;
  /** Mejor solución entera conocida. */
  incumbente?: Vec | null;
  /** Punto elegido por el jugador. */
  elegido?: Vec | null;
  onPick?(p: Vec): void;
}

/** El poliedro del problema con la grilla de puntos enteros, a escala. */
export function Poliedro({ P, xmax, ymax, xLabel, yLabel, cortes = [], cotas, otras = [], lp, incumbente, elegido, onPick }: Props) {
  const W = 360;
  const H = 330;
  const L = 40;
  const B = 34;
  const T = 12;
  const R = 12;
  const sx = (v: number) => L + (v / xmax) * (W - L - R);
  const sy = (v: number) => H - B - (v / ymax) * (H - B - T);
  const path = (pts: Point[]) => (pts.length ? pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0])},${sy(p[1])}`).join(' ') + 'Z' : '');

  const base = poligono(P.filas, xmax, ymax);
  const conCortes = poligono([...P.filas, ...cortes], xmax, ymax);
  const nodo = cotas ? poligono([...P.filas, ...cortes, ...cotas], xmax, ymax) : null;
  const dentro = (x: number, y: number, filas: Fila[]) => filas.every((f) => f.a[0] * x + f.a[1] * y <= f.b + 1e-9);
  const igual = (p: Vec | null | undefined, x: number, y: number) => !!p && Math.abs(p[0] - x) < 1e-9 && Math.abs(p[1] - y) < 1e-9;

  return (
    <svg className="plot poliedro" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 440 }}>
      {Array.from({ length: xmax + 1 }, (_, i) => (
        <g key={`x${i}`} className="grid">
          <line x1={sx(i)} y1={sy(0)} x2={sx(i)} y2={sy(ymax)} />
          <text x={sx(i)} y={sy(0) + 14} textAnchor="middle">
            {i}
          </text>
        </g>
      ))}
      {Array.from({ length: ymax + 1 }, (_, i) => (
        <g key={`y${i}`} className="grid">
          <line x1={sx(0)} y1={sy(i)} x2={sx(xmax)} y2={sy(i)} />
          <text x={sx(0) - 6} y={sy(i) + 4} textAnchor="end">
            {i}
          </text>
        </g>
      ))}
      <text className="axis" x={sx(xmax)} y={H - 4} textAnchor="end">
        {xLabel}
      </text>
      <text className="axis" x={L + 4} y={T + 2} dominantBaseline="hanging">
        {yLabel}
      </text>

      <path className="region base" d={path(base)} />
      {cortes.length > 0 && <path className="region cortada" d={path(conCortes)} />}
      {otras.map((o, i) => (
        <path key={i} className="region hoja" d={path(poligono([...P.filas, ...cortes, ...o], xmax, ymax))} />
      ))}
      {nodo && <path className="region nodo" d={path(nodo)} />}

      {P.filas.map((f, i) => {
        const seg = lineInBox(f.a[0], f.a[1], f.b, xmax, ymax);
        return seg && <line key={i} className="restr" x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} />;
      })}
      {cortes.map((f, i) => {
        const seg = lineInBox(f.a[0], f.a[1], f.b, xmax, ymax);
        return seg && <line key={i} className="corte" x1={sx(seg[0][0])} y1={sy(seg[0][1])} x2={sx(seg[1][0])} y2={sy(seg[1][1])} />;
      })}

      {Array.from({ length: xmax + 1 }, (_, x) =>
        Array.from({ length: ymax + 1 }, (_, y) => {
          const ok = dentro(x, y, P.filas);
          const cls = ['pt', ok ? 'factible' : 'fuera', igual(incumbente, x, y) ? 'incumbente' : '', igual(elegido, x, y) ? 'elegido' : ''].join(' ');
          return (
            <circle
              key={`${x},${y}`}
              className={cls}
              cx={sx(x)}
              cy={sy(y)}
              r={igual(incumbente, x, y) || igual(elegido, x, y) ? 6 : ok ? 3.6 : 2}
              onClick={onPick && ok ? () => onPick([x, y]) : undefined}
              style={onPick && ok ? { cursor: 'pointer' } : undefined}
            >
              <title>
                ({x}, {y}) · ganancia {P.c[0] * x + P.c[1] * y}
              </title>
            </circle>
          );
        }),
      )}
      {lp && (
        <g className="lp">
          <circle cx={sx(lp[0])} cy={sy(lp[1])} r={6} />
          <line x1={sx(lp[0]) - 4} y1={sy(lp[1]) - 4} x2={sx(lp[0]) + 4} y2={sy(lp[1]) + 4} />
          <line x1={sx(lp[0]) - 4} y1={sy(lp[1]) + 4} x2={sx(lp[0]) + 4} y2={sy(lp[1]) - 4} />
        </g>
      )}
    </svg>
  );
}
