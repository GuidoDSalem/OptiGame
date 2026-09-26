import { decodificar, type DatosBicisCrudos } from '../../engine/bicis';
import { analizar } from './analisis';
import { modeloDe } from './modelo';

const ctx = self as unknown as {
  postMessage(m: unknown, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent<DatosBicisCrudos>) => void) | null;
};

// La página le pasa los datos crudos (ya cargados) y recibe el análisis completo.
ctx.onmessage = (ev) => {
  const D = decodificar(ev.data);
  const datos = analizar(D, modeloDe(D), (fase, hecho, total) => ctx.postMessage({ tipo: 'progreso', fase, hecho, total }));
  ctx.postMessage({ tipo: 'listo', datos }, [datos.tabla.buffer]);
};
