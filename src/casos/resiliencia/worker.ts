import { analizar } from './analisis';
import { OPCIONES, RED } from './planta';

const ctx = self as unknown as { postMessage(m: unknown): void; onmessage: (() => void) | null };

// Son unos cientos de PL chicos: corren fuera del hilo de la página y van avisando el progreso.
ctx.onmessage = async () => {
  const datos = await analizar(RED, OPCIONES, (fase, hecho, total) => ctx.postMessage({ tipo: 'progreso', fase, hecho, total }));
  ctx.postMessage({ tipo: 'listo', datos });
};
