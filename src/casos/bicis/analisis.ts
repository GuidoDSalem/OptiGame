/**
 * Todo el análisis del caso C2 como función pura: la corre el Web Worker de la página y la usan
 * los tests. No importa nada de React.
 */
import {
  ajustarAFlota,
  curvasDiaPromedio,
  curvasPromedio,
  fallasPorDia,
  media,
  mejorReparto,
  tablaFallas,
  type DatosBicis,
  type Modelo,
  type Reparto,
} from '../../engine/bicis';
import { rng } from '../../engine/ambulancias';

export interface Plan {
  id: 'medio' | 'promDecisiones' | 'diaPromedio' | 'saa';
  reparto: Reparto;
  /** Fallas por mañana en cada día hábil de 2023 y de 2024. */
  fallas2023: number[];
  fallas2024: number[];
  /** Fallas promedio por estación en 2024. */
  porEstacion2024: number[];
}

export interface AnalisisBicis {
  /** Filas de la tabla: primero los días de 2023, después los de 2024. */
  n2023: number;
  n2024: number;
  /** Tabla de fallas día × estación × bicis iniciales (ver `tablaFallas`). */
  tabla: Float32Array;
  /** Reparto ideal de cada día de 2023, resuelto por separado. */
  diarios: Reparto[];
  planes: Record<Plan['id'], Plan>;
  /** Lo que "promete" SAA en 2023 (fallas promedio en la muestra). */
  promesaSaa: number;
  /** El mejor reparto posible para 2024 mirando 2024 (el diario del lunes). */
  retrospectivo2024: { reparto: Reparto; valor: number };
  /** Un plan para días de lluvia y otro para días secos (como si el pronóstico fuera perfecto). */
  pronostico: { umbral: number; lluvia: Reparto; seco: Reparto; fallas2024: number; diasLluvia2023: number };
  /** Muestras chicas: se entrena con días pares de 2023 y se prueba con los impares. */
  tamanos: { n: number; prometido: number[]; real: number[] }[];
}

export type Progreso = (fase: string, hecho: number, total: number) => void;

export function analizar(D: DatosBicis, M: Modelo, progreso?: Progreso): AnalisisBicis {
  const E = D.estaciones.length;
  const { capacidad: C, flota: F } = M;
  const d23 = D.dias.filter((d) => d.f.startsWith('2023'));
  const d24 = D.dias.filter((d) => d.f.startsWith('2024'));
  const tabla = tablaFallas(D, M, [...d23, ...d24]);
  const f23 = d23.map((_, i) => i);
  const f24 = d24.map((_, i) => d23.length + i);
  progreso?.('tabla', 1, 4);

  const diarios = f23.map((k) => mejorReparto(curvasPromedio(E, C, tabla, [k]), F, C).reparto);
  progreso?.('diarios', 2, 4);

  const saa = mejorReparto(curvasPromedio(E, C, tabla, f23), F, C);
  const repartos: Record<Plan['id'], Reparto> = {
    medio: ajustarAFlota(new Array(E).fill(F / E), F, C),
    promDecisiones: ajustarAFlota(
      Array.from({ length: E }, (_, e) => media(diarios.map((r) => r[e]))),
      F,
      C,
    ),
    diaPromedio: mejorReparto(curvasDiaPromedio(D, M, d23), F, C).reparto,
    saa: saa.reparto,
  };
  const S = C + 1;
  const planes = Object.fromEntries(
    (Object.keys(repartos) as Plan['id'][]).map((id) => {
      const r = repartos[id];
      const porEstacion2024 = r.map((x, e) => media(f24.map((k) => tabla[(k * E + e) * S + x])));
      return [id, { id, reparto: r, fallas2023: fallasPorDia(E, C, tabla, f23, r), fallas2024: fallasPorDia(E, C, tabla, f24, r), porEstacion2024 }];
    }),
  ) as Record<Plan['id'], Plan>;

  const retrospectivo2024 = mejorReparto(curvasPromedio(E, C, tabla, f24), F, C);

  const umbral = 2;
  const lluvia = mejorReparto(curvasPromedio(E, C, tabla, f23.filter((k) => d23[k].ll >= umbral)), F, C).reparto;
  const seco = mejorReparto(curvasPromedio(E, C, tabla, f23.filter((k) => d23[k].ll < umbral)), F, C).reparto;
  const cond = f24.map((k) => fallasPorDia(E, C, tabla, [k], D.dias[k].ll >= umbral ? lluvia : seco)[0]);
  progreso?.('pronostico', 3, 4);

  // Tamaño de muestra: réplicas con días sorteados (con semilla) entre los pares de 2023.
  const pares = f23.filter((k) => k % 2 === 0);
  const impares = f23.filter((k) => k % 2 === 1);
  const r = rng(11);
  const tamanos = [3, 5, 10, 20, 50, 130].map((n) => {
    const prometido: number[] = [];
    const real: number[] = [];
    for (let k = 0; k < 12; k++) {
      const filas = n >= pares.length ? pares : Array.from({ length: n }, () => pares[Math.floor(r() * pares.length)]);
      const m = mejorReparto(curvasPromedio(E, C, tabla, filas), F, C);
      prometido.push(m.valor);
      real.push(media(fallasPorDia(E, C, tabla, impares, m.reparto)));
      if (n >= pares.length) break;
    }
    return { n: Math.min(n, pares.length), prometido, real };
  });
  progreso?.('tamanos', 4, 4);

  return {
    n2023: d23.length,
    n2024: d24.length,
    tabla,
    diarios,
    planes,
    promesaSaa: saa.valor,
    retrospectivo2024,
    pronostico: { umbral, lluvia, seco, fallas2024: media(cond), diasLluvia2023: f23.filter((k) => d23[k].ll >= umbral).length },
    tamanos,
  };
}
