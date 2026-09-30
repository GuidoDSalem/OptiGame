/**
 * Stock de seguridad en una cadena de varias etapas: el modelo de servicio garantizado
 * (Simpson 1958; Graves y Willems 2000), en su versión en serie.
 *
 * Cada etapa j tarda T_j en procesar y le promete a la siguiente un tiempo de servicio S_j (el
 * pedido sale a lo sumo S_j días después de llegar). Recibe lo que pide en SI_j = S_{j-1} días.
 * Tiene que cubrir con stock el "tiempo neto de reposición" NRT_j = SI_j + T_j − S_j, y para un
 * nivel de servicio z el stock de seguridad es z·σ·√NRT_j. El costo es cóncavo en NRT: en el
 * óptimo cada etapa guarda todo el stock que le toca o nada (NRT_j = 0 o S_j = 0), y el problema
 * se vuelve elegir tramos consecutivos de etapas, cada uno cubierto por un stock al final.
 */

export interface Etapa {
  id: string;
  nombre: string;
  corto: string;
  lugar: string;
  /** Días que tarda la etapa en procesar un pedido. */
  T: number;
  /** Valor acumulado de una unidad al salir de la etapa (US$ por unidad). */
  valor: number;
}

export interface Cadena {
  etapas: Etapa[];
  /** Días que tarda el proveedor externo en entregarle a la primera etapa. */
  entrada: number;
  /** Días que se le prometen al cliente final (tiempo de servicio máximo de la última etapa). */
  servicio: number;
  /** Desvío estándar de la demanda por día (unidades). */
  sigma: number;
  /** Nivel de servicio (fracción de los días en que se cumple) y su factor de seguridad (0,95 → 1,65). */
  nivel: number;
  z: number;
  /** Costo anual de tener una unidad en stock, como fracción de su valor. */
  tasa: number;
  unidad: string;
}

export interface Evaluacion {
  /** Tiempo en que recibe cada etapa (SI), tiempo neto de reposición (NRT) y stock de seguridad. */
  SI: number[];
  NRT: number[];
  stock: number[];
  costo: number[];
  total: number;
  /** Etapas que prometen más rápido de lo que pueden (NRT < 0 no se puede: faltaría stock). */
  imposibles: number[];
  /** ¿La última etapa cumple lo prometido al cliente? */
  cumpleCliente: boolean;
}

export const stockPara = (c: Cadena, nrt: number) => c.z * c.sigma * Math.sqrt(Math.max(0, nrt));

/** Evalúa una combinación de tiempos de servicio prometidos (uno por etapa). */
export function evaluarServicios(c: Cadena, S: number[]): Evaluacion {
  const N = c.etapas.length;
  const SI: number[] = [];
  const NRT: number[] = [];
  const stock: number[] = [];
  const costo: number[] = [];
  const imposibles: number[] = [];
  for (let j = 0; j < N; j++) {
    SI.push(j === 0 ? c.entrada : S[j - 1]);
    NRT.push(SI[j] + c.etapas[j].T - S[j]);
    if (NRT[j] < -1e-9) imposibles.push(j);
    stock.push(stockPara(c, NRT[j]));
    costo.push(stock[j] * c.etapas[j].valor * c.tasa);
  }
  return { SI, NRT, stock, costo, total: costo.reduce((a, b) => a + b, 0), imposibles, cumpleCliente: S[N - 1] <= c.servicio + 1e-9 };
}

/** Tiempo neto que cubre un stock en la etapa j (base 0) para el tramo de etapas i..j. */
export function nrtTramo(c: Cadena, i: number, j: number): number {
  let t = i === 0 ? c.entrada : 0;
  for (let k = i; k <= j; k++) t += c.etapas[k].T;
  return Math.max(0, t - (j === c.etapas.length - 1 ? c.servicio : 0));
}

/** Costo anual del tramo i..j (base 0), cubierto por un stock en la etapa j. */
export const costoTramo = (c: Cadena, i: number, j: number) => stockPara(c, nrtTramo(c, i, j)) * c.etapas[j].valor * c.tasa;

export type Tramo = [number, number];

/** Tiempos de servicio de una partición en tramos: las etapas con stock prometen 0, las otras pasan de largo. */
export function serviciosDeTramos(c: Cadena, tramos: Tramo[]): number[] {
  const N = c.etapas.length;
  const S = new Array(N).fill(0);
  const conStock = new Set(tramos.map(([, j]) => j));
  for (let k = 0; k < N; k++) {
    const SI = k === 0 ? c.entrada : S[k - 1];
    if (k === N - 1) S[k] = Math.min(c.servicio, SI + c.etapas[k].T);
    else S[k] = conStock.has(k) ? 0 : SI + c.etapas[k].T;
  }
  return S;
}

/** ¿Los tramos cubren cada etapa exactamente una vez, en orden? */
export function particionValida(N: number, tramos: Tramo[]): boolean {
  const cub = new Array(N).fill(0);
  for (const [i, j] of tramos) {
    if (i > j || i < 0 || j >= N) return false;
    for (let k = i; k <= j; k++) cub[k]++;
  }
  return cub.every((x) => x === 1);
}

export interface PasoDP {
  /** f[j]: menor costo para cubrir las etapas 0..j−1 (f[0] = 0). */
  f: number[];
  /** De dónde viene cada f[j]: el tramo que termina en j−1 empieza en desde[j]. */
  desde: number[];
}

/**
 * Programación dinámica exacta: f(j) = min_{i ≤ j} f(i) + costo del tramo i..j−1. Es un camino más
 * corto en un grafo acíclico (las etapas en orden).
 */
export function mejorColocacion(c: Cadena, costo = costoTramo): { tramos: Tramo[]; costo: number; dp: PasoDP } {
  const N = c.etapas.length;
  const f = [0];
  const desde = [0];
  for (let j = 1; j <= N; j++) {
    let mejor = Infinity;
    let arg = 0;
    for (let i = 0; i < j; i++) {
      const v = f[i] + costo(c, i, j - 1);
      if (v < mejor - 1e-9) (mejor = v), (arg = i);
    }
    f.push(mejor);
    desde.push(arg);
  }
  const tramos: Tramo[] = [];
  for (let j = N; j > 0; j = desde[j]) tramos.unshift([desde[j], j - 1]);
  return { tramos, costo: f[N], dp: { f, desde } };
}

/** Todas las formas de partir la cadena en tramos (2^(N−1)), con su costo. */
export function todasLasColocaciones(c: Cadena, costo = costoTramo): { tramos: Tramo[]; costo: number }[] {
  const N = c.etapas.length;
  const out: { tramos: Tramo[]; costo: number }[] = [];
  for (let m = 0; m < 1 << (N - 1); m++) {
    const tramos: Tramo[] = [];
    let i = 0;
    for (let k = 0; k < N; k++)
      if (k === N - 1 || m & (1 << k)) {
        tramos.push([i, k]);
        i = k + 1;
      }
    out.push({ tramos, costo: tramos.reduce((s, [a, b]) => s + costo(c, a, b), 0) });
  }
  return out.sort((a, b) => a.costo - b.costo);
}

/** Etapas con stock (los finales de cada tramo), sin contar la última si no necesita stock. */
export const etapasConStock = (c: Cadena, tramos: Tramo[]) => tramos.filter(([i, j]) => nrtTramo(c, i, j) > 1e-9).map(([, j]) => j);
