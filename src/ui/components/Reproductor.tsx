import { useEffect, useState } from 'react';

/** Milisegundos por paso según la velocidad. */
const VELOCIDADES = [
  { id: 'lenta', label: 'Lenta', ms: 3600 },
  { id: 'normal', label: 'Normal', ms: 2200 },
  { id: 'rapida', label: 'Rápida', ms: 900 },
];

export interface Reproductor {
  /** Paso actual (0 … pasos − 1). */
  i: number;
  pasos: number;
  corriendo: boolean;
  vel: string;
  ir(n: number): void;
  alternar(): void;
  setVel(v: string): void;
}

/** Estado de una reproducción paso a paso: avanza sola mientras corre y se detiene al final. */
export function useReproductor(pasos: number): Reproductor {
  const [i, setI] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [vel, setVel] = useState('normal');
  const ultimo = pasos - 1;

  useEffect(() => {
    if (!corriendo) return;
    if (i >= ultimo) {
      setCorriendo(false);
      return;
    }
    const t = setTimeout(() => setI((x) => Math.min(ultimo, x + 1)), VELOCIDADES.find((v) => v.id === vel)!.ms);
    return () => clearTimeout(t);
  }, [corriendo, i, vel, ultimo]);

  return {
    i,
    pasos,
    corriendo,
    vel,
    setVel,
    ir: (n) => {
      setCorriendo(false);
      setI(Math.max(0, Math.min(ultimo, n)));
    },
    alternar: () => {
      if (!corriendo && i >= ultimo) setI(0);
      setCorriendo(!corriendo);
    },
  };
}

/** Botones de la reproducción: principio, anterior, reproducir/pausa, siguiente, final, barra y velocidad. */
export function ControlesReproductor({ r }: { r: Reproductor }) {
  const { i, corriendo, vel } = r;
  const ultimo = r.pasos - 1;
  return (
    <div className="repro-controles">
      <button className="icon" onClick={() => r.ir(0)} disabled={i === 0} title="Al principio" aria-label="Al principio">
        ⏮
      </button>
      <button className="icon" onClick={() => r.ir(i - 1)} disabled={i === 0} title="Paso anterior" aria-label="Paso anterior">
        ◀
      </button>
      <button className="primary" onClick={r.alternar}>
        {corriendo ? 'Pausa' : i >= ultimo ? '▶ Ver de nuevo' : i === 0 ? '▶ Reproducir' : '▶ Seguir'}
      </button>
      <button className="icon" onClick={() => r.ir(i + 1)} disabled={i === ultimo} title="Paso siguiente" aria-label="Paso siguiente">
        ▶
      </button>
      <button className="icon" onClick={() => r.ir(ultimo)} disabled={i === ultimo} title="Al final" aria-label="Al final">
        ⏭
      </button>
      <input type="range" min={0} max={ultimo} value={i} onChange={(ev) => r.ir(Number(ev.target.value))} aria-label="Paso" />
      <select value={vel} onChange={(ev) => r.setVel(ev.target.value)} aria-label="Velocidad">
        {VELOCIDADES.map((x) => (
          <option key={x.id} value={x.id}>
            {x.label}
          </option>
        ))}
      </select>
    </div>
  );
}
