import { useEffect, useMemo, useRef, useState } from 'react';
import type { EstacionBici } from '../../engine/bicis';
import { fmt } from '../ambulancias/graficos';
import { MapaCentro } from './MapaCentro';

/**
 * Viaje real: [estación origen, estación destino, minuto de salida, minuto de llegada,
 * lat/lon del origen y del destino cuando están fuera de la zona (índice -1)].
 */
export type ViajeReal = [number, number, number, number, number?, number?, number?, number?];

interface Simulacion {
  /** niveles[minuto][estación] */
  niveles: Int16Array[];
  /** Fallas acumuladas hasta cada minuto. */
  sinBici: number[];
  sinLugar: number[];
  fallas: { t: number; e: number; tipo: 'sin-bici' | 'sin-lugar' }[];
}

const INICIO = 6 * 60;
const FIN = 12 * 60;

/** Simula la mañana minuto a minuto con los viajes reales del día y un reparto inicial. */
export function simularManana(viajes: ViajeReal[], reparto: number[], C: number): Simulacion {
  const eventos: { t: number; e: number; delta: 1 | -1 }[] = [];
  for (const [o, d, t0, t1] of viajes) {
    if (o >= 0 && t0 >= INICIO && t0 < FIN) eventos.push({ t: t0, e: o, delta: -1 });
    if (d >= 0 && t1 >= INICIO && t1 < FIN) eventos.push({ t: t1, e: d, delta: 1 });
  }
  eventos.sort((a, b) => a.t - b.t);
  const s = Int16Array.from(reparto);
  const niveles: Int16Array[] = [];
  const sinBici: number[] = [];
  const sinLugar: number[] = [];
  const fallas: Simulacion['fallas'] = [];
  let k = 0;
  let nb = 0;
  let nl = 0;
  for (let t = INICIO; t <= FIN; t++) {
    while (k < eventos.length && eventos[k].t <= t) {
      const ev = eventos[k++];
      if (ev.delta < 0) {
        if (s[ev.e] > 0) s[ev.e]--;
        else nb++, fallas.push({ t: ev.t, e: ev.e, tipo: 'sin-bici' });
      } else if (s[ev.e] < C) s[ev.e]++;
      else nl++, fallas.push({ t: ev.t, e: ev.e, tipo: 'sin-lugar' });
    }
    niveles.push(Int16Array.from(s));
    sinBici.push(nb);
    sinLugar.push(nl);
  }
  return { niveles, sinBici, sinLugar, fallas };
}

const reloj = (t: number) => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;

interface Props {
  estaciones: EstacionBici[];
  viajes: ViajeReal[];
  /** Uno o varios repartos: con varios, se ven lado a lado con el mismo reloj. */
  repartos: { titulo?: string; reparto: number[] }[];
  capacidad: number;
  /** Arranca sola y vuelve a empezar al terminar. */
  auto?: boolean;
  /** Segundos que dura toda la mañana. */
  duracion?: number;
  controles?: boolean;
  etiquetas?: 'todas' | 'algunas' | 'ninguna';
}

export function Reproduccion({ estaciones, viajes, repartos, capacidad, auto = false, duracion = 24, controles = true, etiquetas }: Props) {
  const sims = useMemo(() => repartos.map((r) => simularManana(viajes, r.reparto, capacidad)), [viajes, repartos, capacidad]);
  const [t, setT] = useState(auto ? INICIO : FIN);
  const [corriendo, setCorriendo] = useState(auto);
  const ultimo = useRef<number | null>(null);

  useEffect(() => {
    if (!corriendo) return;
    let raf = 0;
    const paso = (ahora: number) => {
      const dt = ultimo.current === null ? 0 : (ahora - ultimo.current) / 1000;
      ultimo.current = ahora;
      setT((x) => {
        const n = x + (dt * (FIN - INICIO)) / duracion;
        if (n >= FIN) {
          if (!auto) setCorriendo(false);
          return auto ? INICIO : FIN;
        }
        return n;
      });
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(raf);
      ultimo.current = null;
    };
  }, [corriendo, duracion, auto]);

  const m = Math.floor(t);
  const i = Math.min(sims[0].niveles.length - 1, m - INICIO);
  const lugar = (e: number, lat?: number, lon?: number): [number, number] | null =>
    e >= 0 ? [estaciones[e].lat, estaciones[e].lon] : lat ? [lat, lon!] : null;
  // Viajes en curso: los que entran o salen de la zona también se ven (llegan o se van por el borde).
  const enViaje = viajes
    .filter(([o, d, t0, t1]) => o !== d && t0 <= t && t < t1)
    .map(([o, d, t0, t1, lao, loo, lad, lod]) => {
      const de = lugar(o, lao, loo);
      const a = lugar(d, lad, lod);
      return de && a ? { de, a, t: (t - t0) / Math.max(1, t1 - t0) } : null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return (
    <div className="reproduccion">
      <div className="reloj">
        <span className="hora">{reloj(m)}</span>
        {controles && (
          <>
            <button
              className="primary"
              onClick={() => {
                if (t >= FIN) setT(INICIO);
                setCorriendo(!corriendo);
              }}
            >
              {corriendo ? 'Pausa' : t >= FIN ? '▶ Ver la mañana' : '▶ Seguir'}
            </button>
            <input
              type="range"
              min={INICIO}
              max={FIN}
              value={m}
              onChange={(e) => {
                setCorriendo(false);
                setT(Number(e.target.value));
              }}
              aria-label="Hora"
            />
          </>
        )}
      </div>
      <div className={repartos.length > 1 ? 'lado-a-lado' : ''}>
        {repartos.map((r, k) => {
          const sim = sims[k];
          const alertas = estaciones.map(() => null as null | 'sin-bici' | 'sin-lugar');
          for (const f of sim.fallas) if (f.t <= m && f.t > m - 12) alertas[f.e] = f.tipo;
          return (
            <figure key={k}>
              <figcaption className="contador">
                {r.titulo && <strong>{r.titulo}</strong>}
                <span>
                  <b className="sin-bici">{sim.sinBici[i]}</b> sin bici · <b className="sin-lugar">{sim.sinLugar[i]}</b> sin lugar
                </span>
              </figcaption>
              <MapaCentro estaciones={estaciones} capacidad={capacidad} niveles={Array.from(sim.niveles[i])} alertas={alertas} viajes={enViaje} etiquetas={etiquetas} />
            </figure>
          );
        })}
      </div>
      {controles && <p className="caption">{fmt(viajes.length)} viajes reales tocaron estas estaciones esa mañana.</p>}
    </div>
  );
}
