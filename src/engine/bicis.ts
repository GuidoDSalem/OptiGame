/**
 * Caso de estudio C2: cuántas bicis dejar en cada estación a la madrugada (datos reales de Ecobici).
 *
 * Primera etapa: repartir una flota de F bicis entre las estaciones antes de que arranque el día
 * (cada estación tiene C anclajes). Segunda etapa: el día real pasa; cada salida necesita una
 * bici y cada llegada un anclaje libre. Lo que falla se cuenta como "viaje con problema".
 * Como las estaciones sólo se conectan por la flota total, el reparto óptimo para cualquier
 * conjunto de días se calcula exacto con programación dinámica.
 */

export interface EstacionBici {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  viajes2023: number;
  viajes2024: number;
}

export interface DiaBici {
  f: string;
  /** Día de la semana (0 = lunes). */
  ds: number;
  /** Lluvia del día (mm). */
  ll: number;
  /** Temperatura máxima (°C). */
  t: number;
  /** Viajes de todo el sistema ese día. */
  sis: number;
  /** Viajes que tocan la zona. */
  zona: number;
  /** Salidas y llegadas por estación y hora: [(est·H + h)·2 + (0 salida | 1 llegada)]. */
  c: Uint8Array;
}

export interface DatosBicis {
  horas: number[];
  estaciones: EstacionBici[];
  dias: DiaBici[];
}

/** Datos tal como vienen del JSON (conteos en base64). */
export interface DatosBicisCrudos extends Omit<DatosBicis, 'dias'> {
  dias: (Omit<DiaBici, 'c'> & { c: string })[];
  fuente?: Record<string, string>;
  animados?: Record<string, [number, number, number, number][]>;
}

function base64ABytes(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function decodificar(crudos: DatosBicisCrudos): DatosBicis {
  return { horas: crudos.horas, estaciones: crudos.estaciones, dias: crudos.dias.map((d) => ({ ...d, c: base64ABytes(d.c) })) };
}

export interface Modelo {
  /** Anclajes por estación (supuesto: el dataset no los publica). */
  capacidad: number;
  /** Bicis de la flota para la zona. */
  flota: number;
  /** Horas que tiene que aguantar el reparto (índices en `horas`): de 6 a 12. */
  ventana: number[];
}

/** Salidas y llegadas de una estación en cada hora de la ventana. */
export function flujos(D: DatosBicis, d: DiaBici, est: number, ventana: number[]) {
  const H = D.horas.length;
  return {
    sal: ventana.map((h) => d.c[(est * H + h) * 2]),
    lleg: ventana.map((h) => d.c[(est * H + h) * 2 + 1]),
  };
}

export interface Fallas {
  sinBici: number;
  sinLugar: number;
  /** Bicis en la estación al final de cada hora. */
  trayectoria: number[];
}

/**
 * Simula una estación a lo largo del día arrancando con `s0` bicis. Dentro de cada hora las
 * salidas y llegadas se intercalan de forma pareja (los datos vienen agregados por hora).
 */
export function simularEstacion(sal: ArrayLike<number>, lleg: ArrayLike<number>, s0: number, C: number): Fallas {
  let s = s0;
  let sinBici = 0;
  let sinLugar = 0;
  const trayectoria: number[] = [];
  for (let h = 0; h < sal.length; h++) {
    const a = sal[h];
    const b = lleg[h];
    let i = 0;
    let j = 0;
    while (i < a || j < b) {
      // Próximo evento: el que "toca" antes si se reparten parejo en la hora.
      const salida = j >= b || (i < a && (i + 0.5) / a <= (j + 0.5) / b);
      if (salida) {
        if (s > 0) s--;
        else sinBici++;
        i++;
      } else {
        if (s < C) s++;
        else sinLugar++;
        j++;
      }
    }
    trayectoria.push(s);
  }
  return { sinBici, sinLugar, trayectoria };
}

/**
 * Tabla de fallas: para cada día, estación y bicis iniciales s = 0..C, cuántos viajes fallan.
 * Índice: (dia·E + est)·(C+1) + s.
 */
export function tablaFallas(D: DatosBicis, M: Modelo, dias: DiaBici[]): Float32Array {
  const E = D.estaciones.length;
  const S = M.capacidad + 1;
  const t = new Float32Array(dias.length * E * S);
  dias.forEach((d, k) => {
    for (let e = 0; e < E; e++) {
      const { sal, lleg } = flujos(D, d, e, M.ventana);
      for (let s = 0; s < S; s++) {
        const f = simularEstacion(sal, lleg, s, M.capacidad);
        t[(k * E + e) * S + s] = f.sinBici + f.sinLugar;
      }
    }
  });
  return t;
}

export type Reparto = number[];

/** Curva promedio de fallas de cada estación sobre un conjunto de días (filas de la tabla). */
export function curvasPromedio(E: number, C: number, tabla: Float32Array, filas: number[]): number[][] {
  const S = C + 1;
  const g = Array.from({ length: E }, () => new Array(S).fill(0));
  for (const k of filas) for (let e = 0; e < E; e++) for (let s = 0; s < S; s++) g[e][s] += tabla[(k * E + e) * S + s];
  for (let e = 0; e < E; e++) for (let s = 0; s < S; s++) g[e][s] /= filas.length;
  return g;
}

/**
 * El mejor reparto para unas curvas de fallas: min Σ g_e(s_e) con Σ s_e = F, 0 ≤ s_e ≤ C
 * (toda la flota está en la calle: cada bici queda en alguna estación).
 * Programación dinámica exacta (estaciones × bicis).
 */
export function mejorReparto(g: number[][], F: number, C: number): { reparto: Reparto; valor: number } {
  const E = g.length;
  const INF = 1e18;
  // val[b] = menor falla usando exactamente b bicis en las estaciones ya vistas.
  let val = new Float64Array(F + 1).fill(INF);
  val[0] = 0;
  const eleccion: Int16Array[] = [];
  for (let e = 0; e < E; e++) {
    const nuevo = new Float64Array(F + 1).fill(INF);
    const el = new Int16Array(F + 1);
    for (let b = 0; b <= F; b++)
      for (let s = 0; s <= Math.min(C, b); s++) {
        // Desempate neutro: si da lo mismo, preferir estaciones a medio llenar.
        const v = val[b - s] + g[e][s] + 1e-6 * (s - C / 2) ** 2;
        if (v < nuevo[b] - 1e-9) (nuevo[b] = v), (el[b] = s);
      }
    eleccion.push(el);
    val = nuevo;
  }
  let b = F;
  const valor = val[b] - 1e-6 * reg(g, F, C, eleccion);
  const reparto = new Array(E).fill(0);
  for (let e = E - 1; e >= 0; e--) {
    reparto[e] = eleccion[e][b];
    b -= reparto[e];
  }
  return { reparto, valor };
}

/** Parte del desempate incluida en el valor (para devolver sólo las fallas). */
function reg(g: number[][], F: number, C: number, eleccion: Int16Array[]): number {
  let b = F;
  let t = 0;
  for (let e = g.length - 1; e >= 0; e--) {
    const s = eleccion[e][b];
    t += (s - C / 2) ** 2;
    b -= s;
  }
  return t;
}

/** Fallas totales de un reparto en cada día (a partir de la tabla). */
export function fallasPorDia(E: number, C: number, tabla: Float32Array, filas: number[], r: Reparto): number[] {
  const S = C + 1;
  return filas.map((k) => r.reduce((s, x, e) => s + tabla[(k * E + e) * S + x], 0));
}

/**
 * Redondea un reparto fraccionario (p. ej. un promedio de repartos) a bicis enteras que sumen
 * exactamente la flota, respetando los anclajes (método del mayor resto).
 */
export function ajustarAFlota(r: number[], F: number, C: number): Reparto {
  const x = r.map((v) => Math.max(0, Math.min(C, Math.floor(v))));
  let falta = F - x.reduce((a, b) => a + b, 0);
  const orden = r.map((v, i) => ({ i, resto: v - Math.floor(v) })).sort((a, b) => b.resto - a.resto);
  for (let k = 0; falta > 0 && k < 10 * r.length; k++) {
    const { i } = orden[k % orden.length];
    if (x[i] < C) x[i]++, falta--;
  }
  for (let k = 0; falta < 0 && k < 10 * r.length; k++) {
    const { i } = orden[orden.length - 1 - (k % orden.length)];
    if (x[i] > 0) x[i]--, falta++;
  }
  return x;
}

/** Día promedio: salidas y llegadas promedio de cada estación y hora (fraccionarias). */
export function diaPromedio(dias: DiaBici[]): Float64Array {
  const c = new Float64Array(dias[0].c.length);
  for (const d of dias) for (let i = 0; i < c.length; i++) c[i] += d.c[i];
  for (let i = 0; i < c.length; i++) c[i] /= dias.length;
  return c;
}

/**
 * Simulación "de fluido" para flujos fraccionarios (el día promedio): cada hora se parte en
 * pasos chicos y en cada paso entra y sale la parte proporcional.
 */
export function simularFluido(sal: ArrayLike<number>, lleg: ArrayLike<number>, s0: number, C: number, pasos = 60): number {
  let s = s0;
  let fallas = 0;
  for (let h = 0; h < sal.length; h++) {
    const a = sal[h] / pasos;
    const b = lleg[h] / pasos;
    for (let k = 0; k < pasos; k++) {
      s -= a;
      if (s < 0) (fallas -= s), (s = 0);
      s += b;
      if (s > C) (fallas += s - C), (s = C);
    }
  }
  return fallas;
}

/** Curvas de fallas del día promedio (una por estación). */
export function curvasDiaPromedio(D: DatosBicis, M: Modelo, dias: DiaBici[]): number[][] {
  const c = diaPromedio(dias);
  const H = D.horas.length;
  return D.estaciones.map((_, e) => {
    const sal = M.ventana.map((h) => c[(e * H + h) * 2]);
    const lleg = M.ventana.map((h) => c[(e * H + h) * 2 + 1]);
    return Array.from({ length: M.capacidad + 1 }, (_, s) => simularFluido(sal, lleg, s, M.capacidad));
  });
}

export const percentil = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))];
};
export const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

/**
 * Viaje real: [estación origen, estación destino, minuto de salida, minuto de llegada,
 * lat/lon del origen y del destino cuando están fuera de la zona (índice -1)].
 */
export type ViajeReal = [number, number, number, number, number?, number?, number?, number?];

export interface SimulacionManana {
  /** niveles[minuto][estación] */
  niveles: Int16Array[];
  /** Fallas acumuladas hasta cada minuto. */
  sinBici: number[];
  sinLugar: number[];
  fallas: { t: number; e: number; tipo: 'sin-bici' | 'sin-lugar' }[];
  /** perdido[k] = 1 si el viaje k no encontró bici al salir: no se hace (ni llega a destino). */
  perdido: Uint8Array;
}

export const INICIO = 6 * 60;
export const FIN = 12 * 60;

/**
 * Simula la mañana minuto a minuto con los viajes reales del día y un reparto inicial. Si en la
 * estación de origen no hay bici, ese viaje no existe: no sale ni suma una bici en el destino.
 */
export function simularManana(viajes: ViajeReal[], reparto: number[], C: number): SimulacionManana {
  const eventos: { t: number; e: number; v: number; delta: 1 | -1 }[] = [];
  viajes.forEach(([o, d, t0, t1], v) => {
    if (o >= 0 && t0 >= INICIO && t0 < FIN) eventos.push({ t: t0, e: o, v, delta: -1 });
    if (d >= 0 && t1 >= INICIO && t1 < FIN) eventos.push({ t: t1, e: d, v, delta: 1 });
  });
  // Orden estable: la salida de un viaje queda antes que su llegada aunque sean el mismo minuto.
  eventos.sort((a, b) => a.t - b.t);
  const s = Int16Array.from(reparto);
  const perdido = new Uint8Array(viajes.length);
  const niveles: Int16Array[] = [];
  const sinBici: number[] = [];
  const sinLugar: number[] = [];
  const fallas: SimulacionManana['fallas'] = [];
  let k = 0;
  let nb = 0;
  let nl = 0;
  for (let t = INICIO; t <= FIN; t++) {
    while (k < eventos.length && eventos[k].t <= t) {
      const ev = eventos[k++];
      if (ev.delta < 0) {
        if (s[ev.e] > 0) s[ev.e]--;
        else nb++, (perdido[ev.v] = 1), fallas.push({ t: ev.t, e: ev.e, tipo: 'sin-bici' });
      } else if (perdido[ev.v]) continue;
      else if (s[ev.e] < C) s[ev.e]++;
      else nl++, fallas.push({ t: ev.t, e: ev.e, tipo: 'sin-lugar' });
    }
    niveles.push(Int16Array.from(s));
    sinBici.push(nb);
    sinLugar.push(nl);
  }
  return { niveles, sinBici, sinLugar, fallas, perdido };
}
