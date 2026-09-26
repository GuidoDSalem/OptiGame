import type { Ciudad, Plan, ResultadoDia } from '../../engine/ambulancias';

export interface Punto {
  x: number;
  y: number;
  barrio: string;
}

interface Props {
  C: Ciudad;
  /** Llamadas del día (puntos). */
  puntos?: Punto[];
  /** Bases operando (las demás se ven como candidatas vacías). */
  plan?: Plan | null;
  /** Asignación del día: líneas de cada barrio a sus bases. */
  resultado?: ResultadoDia | null;
  /** Bases a resaltar con un anillo (p. ej. "la que perdió la votación"). */
  resaltar?: string[];
  etiquetasBarrios?: boolean;
  etiquetasBases?: boolean;
  /** Las llamadas aparecen de a una (se reinicia al cambiar `clave`). */
  animar?: boolean;
  clave?: string | number;
  /** Duración total de la animación de las llamadas (s). */
  duracion?: number;
  compacto?: boolean;
  titulo?: string;
}

const W = 12;
const H = 10;

/** Mapa de la ciudad: barrios, bases candidatas, llamadas y la asignación del día. */
export function Mapa({
  C,
  puntos = [],
  plan = null,
  resultado = null,
  resaltar = [],
  etiquetasBarrios = false,
  etiquetasBases = false,
  animar = false,
  clave,
  duracion = 1.6,
  compacto = false,
  titulo,
}: Props) {
  const S = compacto ? 16 : 50;
  const px = (x: number) => x * S;
  const py = (y: number) => (H - y) * S;
  const abierta = (i: number) => plan !== null && !!(plan & (1 << i));
  const Z = C.barrios.length;

  return (
    <svg className={`mapa ${compacto ? 'compacto' : ''}`} viewBox={`0 0 ${W * S} ${H * S}`} width="100%" role="img" aria-label={titulo ?? 'Mapa de la ciudad'}>
      <rect className="fondo" x={0} y={0} width={W * S} height={H * S} rx={compacto ? 4 : 10} />
      {/* El río, al este. */}
      <path className="rio" d={`M ${px(11.9)} 0 C ${px(11.2)} ${py(7)}, ${px(12.3)} ${py(3.5)}, ${px(11.7)} ${H * S} L ${W * S} ${H * S} L ${W * S} 0 Z`} />
      {!compacto &&
        Array.from({ length: W - 1 }, (_, i) => <line key={`v${i}`} className="calle" x1={px(i + 1)} y1={0} x2={px(i + 1)} y2={H * S} />)}
      {!compacto &&
        Array.from({ length: H - 1 }, (_, i) => <line key={`h${i}`} className="calle" x1={0} y1={py(i + 1)} x2={W * S} y2={py(i + 1)} />)}

      {C.barrios.map((b) => (
        <circle key={b.id} className="barrio" cx={px(b.x)} cy={py(b.y)} r={b.r * S * 1.15} />
      ))}

      {resultado &&
        C.bases.map((base, i) =>
          C.barrios.map((b, j) => {
            const n = resultado.asignacion[i][j];
            if (n < 1e-9) return null;
            return (
              <line
                key={`${i}-${j}`}
                className="asignacion"
                x1={px(b.x)}
                y1={py(b.y)}
                x2={px(base.x)}
                y2={py(base.y)}
                strokeWidth={(compacto ? 0.5 : 1) + Math.sqrt(n) * (compacto ? 0.35 : 0.9)}
              />
            );
          }),
        )}

      <g key={clave} className={animar ? 'llamadas animar' : 'llamadas'}>
        {puntos.map((p, k) => (
          <circle
            key={k}
            className="llamada"
            cx={px(p.x)}
            cy={py(p.y)}
            r={compacto ? 1.3 : 3.2}
            style={animar ? { animationDelay: `${(k / Math.max(1, puntos.length)) * duracion}s` } : undefined}
          />
        ))}
      </g>

      {resultado &&
        C.barrios.map((b, j) =>
          resultado.privadas[j] > 1e-9 ? (
            <g key={`p${j}`} className="privada">
              <circle cx={px(b.x + b.r * 0.8)} cy={py(b.y + b.r * 0.8)} r={compacto ? 3 : 9} />
              {!compacto && (
                <text x={px(b.x + b.r * 0.8)} y={py(b.y + b.r * 0.8) + 3.5} textAnchor="middle">
                  {Math.round(resultado.privadas[j])}
                </text>
              )}
            </g>
          ) : null,
        )}

      {C.bases.map((b, i) => {
        const s = compacto ? 6 : 16;
        return (
          <g key={b.id} className={`base ${abierta(i) ? 'abierta' : 'cerrada'} ${resaltar.includes(b.id) ? 'resaltada' : ''}`}>
            {resaltar.includes(b.id) && <circle className="anillo" cx={px(b.x)} cy={py(b.y)} r={s * 1.2} />}
            <rect x={px(b.x) - s / 2} y={py(b.y) - s / 2} width={s} height={s} rx={compacto ? 1 : 3} />
            {!compacto && <path className="cruz" d={`M ${px(b.x) - 4} ${py(b.y)} h 8 M ${px(b.x)} ${py(b.y) - 4} v 8`} />}
            {etiquetasBases && (
              <text x={px(b.x)} y={py(b.y) + s / 2 + 12} textAnchor="middle">
                {b.label}
              </text>
            )}
          </g>
        );
      })}

      {etiquetasBarrios &&
        C.barrios.map((b) => (
          <text key={b.id} className="nombre-barrio" x={px(b.x)} y={py(b.y) - b.r * S * 1.15 - 4} textAnchor="middle">
            {b.label}
          </text>
        ))}
      {!compacto && Z > 0 && (
        <g className="escala">
          <line x1={px(0.4)} y1={py(0.4)} x2={px(1.4)} y2={py(0.4)} />
          <text x={px(0.9)} y={py(0.4) - 5} textAnchor="middle">
            1 km
          </text>
        </g>
      )}
    </svg>
  );
}
