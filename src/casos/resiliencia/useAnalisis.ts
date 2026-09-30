import { useEffect, useState } from 'react';
import type { AnalisisResiliencia } from './analisis';

export type EstadoAnalisis =
  | { tipo: 'progreso'; hecho: number; total: number }
  | { tipo: 'listo'; datos: AnalisisResiliencia };

// Se calcula una sola vez por sesión: volver a la página no repite el trabajo.
let resultado: AnalisisResiliencia | null = null;
let worker: Worker | null = null;
const oyentes = new Set<(e: EstadoAnalisis) => void>();

function arrancar() {
  if (worker || resultado) return;
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev: MessageEvent<EstadoAnalisis>) => {
    if (ev.data.tipo === 'listo') {
      resultado = ev.data.datos;
      worker?.terminate();
      worker = null;
    }
    oyentes.forEach((f) => f(ev.data));
  };
  worker.postMessage('analizar');
}

/** Corre el análisis del caso en un Web Worker y devuelve el progreso o los datos. */
export function useAnalisis(): EstadoAnalisis {
  const [estado, setEstado] = useState<EstadoAnalisis>(() => (resultado ? { tipo: 'listo', datos: resultado } : { tipo: 'progreso', hecho: 0, total: 1 }));
  useEffect(() => {
    oyentes.add(setEstado);
    arrancar();
    return () => void oyentes.delete(setEstado);
  }, []);
  return estado;
}
