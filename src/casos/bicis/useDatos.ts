import { useEffect, useState } from 'react';
import { decodificar, type DatosBicis, type DatosBicisCrudos } from '../../engine/bicis';
import type { AnalisisBicis } from './analisis';

export type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'progreso'; D: DatosBicis; crudos: DatosBicisCrudos; hecho: number; total: number }
  | { tipo: 'listo'; D: DatosBicis; crudos: DatosBicisCrudos; a: AnalisisBicis };

// Se carga y se analiza una sola vez por sesión.
let memo: Estado | null = null;
const oyentes = new Set<(e: Estado) => void>();
let arrancado = false;

function avisar(e: Estado) {
  memo = e;
  oyentes.forEach((f) => f(e));
}

async function arrancar() {
  if (arrancado) return;
  arrancado = true;
  // Los datos (~800 KB) se cargan recién al abrir el caso, no con el menú.
  const crudos = (await import('./datos.json')).default as unknown as DatosBicisCrudos;
  const D = decodificar(crudos);
  avisar({ tipo: 'progreso', D, crudos, hecho: 0, total: 4 });
  const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (ev: MessageEvent<{ tipo: string; hecho?: number; total?: number; datos?: AnalisisBicis }>) => {
    if (ev.data.tipo === 'listo') {
      avisar({ tipo: 'listo', D, crudos, a: ev.data.datos! });
      w.terminate();
    } else avisar({ tipo: 'progreso', D, crudos, hecho: ev.data.hecho ?? 0, total: ev.data.total ?? 4 });
  };
  w.postMessage(crudos);
}

export function useDatos(): Estado {
  const [e, setE] = useState<Estado>(() => memo ?? { tipo: 'cargando' });
  useEffect(() => {
    oyentes.add(setE);
    arrancar();
    return () => void oyentes.delete(setE);
  }, []);
  return e;
}
