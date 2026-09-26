import { useId } from 'react';
import type { EstacionBici } from '../../engine/bicis';
import { nombreCorto } from './graficos';

type LatLon = [number, number];

/** Referencias del Centro (esquemáticas): para ubicarse, no para navegar. */
const AV_9_DE_JULIO: LatLon[] = [
  [-34.6275, -58.3812],
  [-34.6037, -58.3816],
  [-34.5955, -58.3806],
  [-34.5905, -58.3775],
];
const AV_DE_MAYO: LatLon[] = [
  [-34.6084, -58.3722],
  [-34.6093, -58.3925],
];
const DIQUES: LatLon[] = [
  [-34.5975, -58.3695],
  [-34.6045, -58.3662],
  [-34.6125, -58.3643],
  [-34.6215, -58.3628],
];
const LUGARES: { nombre: string; p: LatLon }[] = [
  { nombre: 'Obelisco', p: [-34.6037, -58.3816] },
  { nombre: 'Plaza de Mayo', p: [-34.6083, -58.3712] },
  { nombre: 'Estación Constitución', p: [-34.6283, -58.3805] },
  { nombre: 'Estación Retiro', p: [-34.5905, -58.3745] },
  { nombre: 'Puerto Madero', p: [-34.6105, -58.3625] },
];

export interface Proyeccion {
  W: number;
  H: number;
  xy(lat: number, lon: number): [number, number];
}

/** Proyección simple (equirectangular) que encuadra las estaciones. */
export function proyeccion(estaciones: EstacionBici[], W = 640): Proyeccion {
  const lats = estaciones.map((e) => e.lat);
  const lons = estaciones.map((e) => e.lon);
  const pad = 0.004;
  const la0 = Math.min(...lats) - pad;
  const la1 = Math.max(...lats) + pad;
  const lo0 = Math.min(...lons) - pad;
  const lo1 = Math.max(...lons) + pad;
  const k = Math.cos((((la0 + la1) / 2) * Math.PI) / 180);
  const escala = W / ((lo1 - lo0) * k);
  const H = (la1 - la0) * escala;
  return { W, H, xy: (lat, lon) => [(lon - lo0) * k * escala, (la1 - lat) * escala] };
}

interface Props {
  estaciones: EstacionBici[];
  capacidad: number;
  /** Bicis en cada estación (si no, se dibujan vacías). */
  niveles?: number[];
  /** Estaciones que en este momento fallan: 'sin-bici' | 'sin-lugar'. */
  alertas?: (null | 'sin-bici' | 'sin-lugar')[];
  /** Número a mostrar en cada estación (p. ej. el reparto). */
  numeros?: boolean;
  /** Viajes en curso: puntos entre dos coordenadas (t de 0 a 1). */
  viajes?: { de: LatLon; a: LatLon; t: number }[];
  etiquetas?: 'todas' | 'algunas' | 'ninguna';
  resaltar?: number[];
  compacto?: boolean;
  onClick?(i: number): void;
}

/** Alto máximo del mapa (px), para que no ocupe toda la pantalla. */
const ALTO_MAX = 620;

export function MapaCentro({
  estaciones,
  capacidad,
  niveles,
  alertas,
  numeros = false,
  viajes = [],
  etiquetas = 'algunas',
  resaltar = [],
  compacto = false,
  onClick,
}: Props) {
  const P = proyeccion(estaciones);
  // Los viajes que vienen de afuera de la zona se recortan en el borde del mapa.
  const clip = useId().replace(/:/g, '');
  const linea = (pts: LatLon[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${P.xy(p[0], p[1]).join(',')}`).join(' ');
  const tw = compacto ? 5 : 9;
  const th = compacto ? 12 : 24;
  const principales = new Set(
    [...estaciones.map((e, i) => ({ i, v: e.viajes2023 }))]
      .sort((a, b) => b.v - a.v)
      .slice(0, 8)
      .map((x) => x.i),
  );
  // Etiquetas: arriba del tubo, salvo que choquen con otra ya ubicada; en ese caso, abajo.
  const conEtiqueta = estaciones
    .map((_, i) => i)
    .filter((i) => !compacto && (etiquetas === 'todas' || (etiquetas === 'algunas' && principales.has(i))));
  const abajo = new Set<number>();
  const ocupadas: { x: number; y: number }[] = [];
  for (const i of conEtiqueta) {
    const [x, y] = P.xy(estaciones[i].lat, estaciones[i].lon);
    const ly = y - th / 2 - 4;
    if (ocupadas.some((o) => Math.abs(o.x - x) < 90 && Math.abs(o.y - ly) < 13)) {
      abajo.add(i);
      ocupadas.push({ x, y: y + th / 2 + 12 });
    } else ocupadas.push({ x, y: ly });
  }

  return (
    <svg
      className={`mapa-centro ${compacto ? 'compacto' : ''}`}
      viewBox={`0 0 ${P.W} ${P.H}`}
      width="100%"
      // El ancho sigue la proporción del mapa: así nunca sobra lugar a los costados.
      style={compacto ? undefined : { maxWidth: `${(ALTO_MAX * P.W) / P.H}px` }}
      role="img"
      aria-label="Mapa del Centro con las estaciones"
    >
      <defs>
        <clipPath id={clip}>
          <rect width={P.W} height={P.H} rx={compacto ? 4 : 10} />
        </clipPath>
      </defs>
      <rect className="fondo" width={P.W} height={P.H} rx={compacto ? 4 : 10} />
      <g clipPath={`url(#${clip})`}>
      <path className="agua" d={linea(DIQUES)} />
      <path className="avenida" d={linea(AV_9_DE_JULIO)} />
      <path className="avenida" d={linea(AV_DE_MAYO)} />
      {!compacto &&
        LUGARES.map((l) => {
          const [x, y] = P.xy(l.p[0], l.p[1]);
          return (
            <text key={l.nombre} className="lugar" x={x} y={y}>
              {l.nombre}
            </text>
          );
        })}

      {viajes.map((v, k) => {
        const [x0, y0] = P.xy(v.de[0], v.de[1]);
        const [x1, y1] = P.xy(v.a[0], v.a[1]);
        return <circle key={k} className="viaje" cx={x0 + (x1 - x0) * v.t} cy={y0 + (y1 - y0) * v.t} r={compacto ? 1.2 : 2.6} />;
      })}

      {estaciones.map((e, i) => {
        const [x, y] = P.xy(e.lat, e.lon);
        const n = niveles?.[i] ?? 0;
        const h = (Math.min(capacidad, Math.max(0, n)) / capacidad) * th;
        const alerta = alertas?.[i];
        return (
          <g
            key={e.id}
            className={`estacion ${alerta ?? ''} ${resaltar.includes(i) ? 'resaltada' : ''}`}
            onClick={onClick ? () => onClick(i) : undefined}
            style={onClick ? { cursor: 'pointer' } : undefined}
          >
            <title>
              {e.nombre}
              {niveles ? `: ${Math.round(n)} bicis de ${capacidad}` : ''}
            </title>
            {resaltar.includes(i) && <circle className="anillo" cx={x} cy={y} r={th * 0.85} />}
            <rect className="tubo" x={x - tw / 2} y={y - th / 2} width={tw} height={th} rx={2} />
            <rect className="bicis" x={x - tw / 2} y={y + th / 2 - h} width={tw} height={h} rx={2} />
            {numeros && !compacto && (
              <text className="numero" x={x + tw / 2 + 3} y={y + 4}>
                {Math.round(n)}
              </text>
            )}
            {conEtiqueta.includes(i) && (
              <text className="nombre" x={x} y={abajo.has(i) ? y + th / 2 + 12 : y - th / 2 - 4} textAnchor="middle">
                {nombreCorto(e.nombre)}
              </text>
            )}
          </g>
        );
      })}
      </g>
    </svg>
  );
}
