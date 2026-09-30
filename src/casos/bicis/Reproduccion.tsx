import { useEffect, useMemo, useRef, useState } from 'react';
import { FIN, INICIO, simularManana, type EstacionBici, type ViajeReal } from '../../engine/bicis';
import { fmt } from '../ambulancias/graficos';
import { MapaCentro } from './MapaCentro';

export type { ViajeReal };

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
  // Cada reparto tiene los suyos: un viaje que no encontró bici en su estación no sale.
  const enViaje = (perdido: Uint8Array) =>
    viajes
      .map((v, k) => ({ v, k }))
      .filter(({ v: [o, d, t0, t1], k }) => !perdido[k] && o !== d && t0 <= t && t < t1)
      .map(({ v: [o, d, t0, t1, lao, loo, lad, lod] }) => {
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
              <MapaCentro estaciones={estaciones} capacidad={capacidad} niveles={Array.from(sim.niveles[i])} alertas={alertas} viajes={enViaje(sim.perdido)} etiquetas={etiquetas} />
            </figure>
          );
        })}
      </div>
      {controles && <p className="caption">{fmt(viajes.length)} viajes reales tocaron estas estaciones esa mañana.</p>}
    </div>
  );
}
