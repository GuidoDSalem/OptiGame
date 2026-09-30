/**
 * Todo el análisis del caso C3 como función pura (asíncrona: usa HiGHS). La corre el Web Worker
 * de la página y la usan los tests. No importa nada de React.
 */
import {
  costoBlindaje,
  gastoAnual,
  impacto,
  mejorBlindaje,
  nodosDeRiesgo,
  tts,
  type Blindaje,
  type Red,
} from '../../engine/resiliencia';

export interface Nodo {
  id: string;
  gasto: number;
  ttr: number;
  tts: number;
  /** Margen perdido si se cae durante su TTR. */
  perdida: number;
  /** Unidades que se dejan de vender de cada producto. */
  perdidas: Record<string, number>;
  /** Restricciones que frenan el TTS (las activas con precio sombra distinto de cero). */
  frenos: string[];
}

export interface PlanBlindaje {
  presupuesto: number;
  /** Margen con el que se planeó: 1 = el TTR informado, 1,5 = un 50% más. */
  factor: number;
  blindaje: Blindaje;
  costo: number;
  /** Peor pérdida si cada proveedor tarda lo que dice y si tarda un 50% más. */
  peor: number;
  peorLento: number;
  /** Pérdida de cada nodo con este blindaje (con el TTR informado). */
  porNodo: Record<string, number>;
}

export interface AnalisisResiliencia {
  nodos: Nodo[];
  /** Pérdida según las semanas caído, para los nodos expuestos. */
  curvas: { id: string; semanas: number[]; perdida: number[] }[];
  planes: PlanBlindaje[];
  intuitivo: PlanBlindaje;
}

export interface Opciones {
  presupuestos: number[];
  factores: number[];
  intuitivo: Blindaje;
  /** Semanas máximas de las curvas de pérdida. */
  semanasCurva: number;
  /** Factor del TTR para la prueba de "tarda más". */
  factorLento: number;
}

export type Progreso = (fase: string, hecho: number, total: number) => void;

async function evaluar(red: Red, b: Blindaje, presupuesto: number, factor: number, lento: number): Promise<PlanBlindaje> {
  const porNodo: Record<string, number> = {};
  let peor = 0;
  let peorLento = 0;
  for (const s of nodosDeRiesgo(red)) {
    porNodo[s.id] = (await impacto(red, s.id, s.ttr, b)).perdida;
    peor = Math.max(peor, porNodo[s.id]);
    peorLento = Math.max(peorLento, (await impacto(red, s.id, s.ttr * lento, b)).perdida);
  }
  return { presupuesto, factor, blindaje: b, costo: costoBlindaje(red, b), peor, peorLento, porNodo };
}

export async function analizar(red: Red, o: Opciones, progreso?: Progreso): Promise<AnalisisResiliencia> {
  const riesgo = nodosDeRiesgo(red);
  const total = riesgo.length + o.presupuestos.length * o.factores.length + 2;
  let hecho = 0;
  const avanzar = (fase: string) => progreso?.(fase, ++hecho, total);

  const nodos: Nodo[] = [];
  for (const s of riesgo) {
    const t = await tts(red, s.id);
    const imp = await impacto(red, s.id, s.ttr);
    // Lo que frena: stocks y capacidades activas (no la demanda ni la capacidad del caído, que es 0).
    const frenos = [
      ...new Set(
        t.filas
          .filter((f) => Math.abs(f.dual ?? 0) > 1e-9 && !f.id.startsWith('dem') && f.id.split('|')[1] !== s.id)
          .map((f) => f.name),
      ),
    ];
    nodos.push({ id: s.id, gasto: gastoAnual(red, s), ttr: s.ttr, tts: t.valor, perdida: imp.perdida, perdidas: imp.perdidas, frenos });
    avanzar('relojes');
  }

  const curvas: AnalisisResiliencia['curvas'] = [];
  for (const n of nodos.filter((x) => x.perdida > 0)) {
    const semanas = Array.from({ length: o.semanasCurva + 1 }, (_, k) => k);
    const perdida: number[] = [];
    for (const T of semanas) perdida.push((await impacto(red, n.id, T)).perdida);
    curvas.push({ id: n.id, semanas, perdida });
  }
  avanzar('curvas');

  const planes: PlanBlindaje[] = [];
  for (const f of o.factores)
    for (const B of o.presupuestos) {
      planes.push(await evaluar(red, await mejorBlindaje(red, B, f), B, f, o.factorLento));
      avanzar('blindaje');
    }
  const intuitivo = await evaluar(red, o.intuitivo, costoBlindaje(red, o.intuitivo), 1, o.factorLento);
  avanzar('intuitivo');
  return { nodos, curvas, planes, intuitivo };
}
