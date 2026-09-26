import { analizar } from './analisis';
import { CIUDAD, OPCIONES } from './ciudad';

const ctx = self as unknown as { postMessage(m: unknown): void; onmessage: (() => void) | null };

// El análisis tarda unos segundos: corre fuera del hilo de la página y va avisando el progreso.
ctx.onmessage = () => {
  let ultimo = 0;
  const datos = analizar(CIUDAD, OPCIONES, (fase, hecho, total) => {
    const ahora = performance.now();
    if (ahora - ultimo < 80 && hecho < total) return;
    ultimo = ahora;
    ctx.postMessage({ tipo: 'progreso', fase, hecho, total });
  });
  ctx.postMessage({ tipo: 'listo', datos });
};
