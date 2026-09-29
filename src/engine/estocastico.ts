/**
 * Benders estocástico (método L-shaped) para localización con escenarios.
 *
 * Primera etapa: qué plantas abrir (y_d), antes de saber cómo viene el año.
 * Segunda etapa, en cada escenario s: cómo repartir (x_dcs) y cuánto queda sin lugar (w_cs,
 * que se guarda en silo bolsa a un costo u por unidad; así cada escenario siempre tiene solución).
 *
 * El maestro estima el costo de cada escenario con θ_s; cada subproblema devuelve su propio
 * corte (multi-corte) o se suman en uno solo ponderado por probabilidad (corte único).
 */
import type { Corte, Deposito } from './benders';
import type { Constraint, LPModel } from './model';
import { solve } from './solver';

export interface Escenario {
  id: string;
  prob: number;
  /** Cantidad de cada cliente (zona) en este escenario. */
  demanda: Record<string, number>;
}

export interface ProblemaEstocastico {
  depositos: Deposito[];
  clientes: { id: string }[];
  escenarios: Escenario[];
  costo(d: string, c: string): number;
  /** Costo por unidad que no entra en ninguna planta (silo bolsa, compra a terceros…). */
  penalidad: number;
}

export const flujoId = (d: string, c: string, s: string) => `x_${d}_${c}_${s}`;
export const faltaId = (c: string, s: string) => `w_${c}_${s}`;
export const aperturaId = (d: string) => `y_${d}`;

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export const costoFijo = (P: ProblemaEstocastico, abiertos: Set<string>) =>
  P.depositos.reduce((s, d) => s + (abiertos.has(d.id) ? d.costoFijo : 0), 0);

export interface ResultadoEscenario {
  escenario: string;
  transporte: number;
  faltante: number;
  /** transporte + penalidad·faltante */
  costo: number;
  valores: Record<string, number>;
  corte: Corte;
}

/** Subproblema de un escenario con las plantas dadas. Siempre factible gracias a w. */
export async function resolverEscenario(P: ProblemaEstocastico, s: Escenario, abiertos: Set<string>): Promise<ResultadoEscenario> {
  const variables = [
    ...P.depositos.flatMap((d) => P.clientes.map((c) => ({ id: flujoId(d.id, c.id, s.id) }))),
    ...P.clientes.map((c) => ({ id: faltaId(c.id, s.id) })),
  ];
  const objective = {
    ...Object.fromEntries(P.depositos.flatMap((d) => P.clientes.map((c) => [flujoId(d.id, c.id, s.id), P.costo(d.id, c.id)]))),
    ...Object.fromEntries(P.clientes.map((c) => [faltaId(c.id, s.id), P.penalidad])),
  };
  const constraints: Constraint[] = [
    ...P.clientes.map((c) => ({
      id: `dem_${c.id}`,
      name: `Demanda ${c.id}`,
      coefs: { ...Object.fromEntries(P.depositos.map((d) => [flujoId(d.id, c.id, s.id), 1])), [faltaId(c.id, s.id)]: 1 },
      op: '>=' as const,
      rhs: s.demanda[c.id] ?? 0,
    })),
    ...P.depositos.map((d) => ({
      id: `cap_${d.id}`,
      name: `Capacidad ${d.id}`,
      coefs: Object.fromEntries(P.clientes.map((c) => [flujoId(d.id, c.id, s.id), 1])),
      op: '<=' as const,
      rhs: abiertos.has(d.id) ? d.capacidad : 0,
    })),
  ];
  const r = await solve({ sense: 'min', objective, variables, constraints });
  if (r.status !== 'optimal') throw new Error(`Escenario ${s.id}: ${r.status}`);
  const dual = (id: string) => r.rows.find((x) => x.id === id)?.dual ?? 0;
  const faltante = P.clientes.reduce((t, c) => t + (r.values[faltaId(c.id, s.id)] ?? 0), 0);
  return {
    escenario: s.id,
    transporte: r6(r.objective! - P.penalidad * faltante),
    faltante: r6(faltante),
    costo: r6(r.objective!),
    valores: r.values,
    corte: {
      constante: r6(P.clientes.reduce((t, c) => t + dual(`dem_${c.id}`) * (s.demanda[c.id] ?? 0), 0)),
      coefs: Object.fromEntries(P.depositos.map((d) => [d.id, r6(dual(`cap_${d.id}`) * d.capacidad)])),
    },
  };
}

export interface Evaluacion {
  abiertos: string[];
  fijo: number;
  escenarios: ResultadoEscenario[];
  /** Σ_s p_s · costo_s */
  esperado: number;
  total: number;
}

/** Costo real de una apertura: fijo + costo esperado de la segunda etapa. */
export async function evaluar(P: ProblemaEstocastico, abiertos: Set<string>): Promise<Evaluacion> {
  const escenarios = await Promise.all(P.escenarios.map((s) => resolverEscenario(P, s, abiertos)));
  const esperado = r6(P.escenarios.reduce((t, s, k) => t + s.prob * escenarios[k].costo, 0));
  const fijo = costoFijo(P, abiertos);
  return { abiertos: P.depositos.filter((d) => abiertos.has(d.id)).map((d) => d.id), fijo, escenarios, esperado, total: r6(fijo + esperado) };
}

/** Valores de todas las variables (y, x, w) de una evaluación, para dibujar y evaluar en el mundo. */
export const valoresDe = (P: ProblemaEstocastico, e: Evaluacion): Record<string, number> => ({
  ...Object.fromEntries(P.depositos.map((d) => [aperturaId(d.id), e.abiertos.includes(d.id) ? 1 : 0])),
  ...Object.assign({}, ...e.escenarios.map((r) => r.valores)),
});

export type ModoCortes = 'multi' | 'unico';

/** Maestro: aperturas + θ_s por escenario (multi) o un θ para el esperado (único). */
export async function resolverMaestro(P: ProblemaEstocastico, cortes: Corte[][], modo: ModoCortes = 'multi') {
  const th = (k: number) => (modo === 'multi' ? `theta_${P.escenarios[k].id}` : 'theta');
  const thetas = modo === 'multi' ? P.escenarios.map((_, k) => th(k)) : ['theta'];
  const model: LPModel = {
    sense: 'min',
    objective: {
      ...Object.fromEntries(P.depositos.map((d) => [aperturaId(d.id), d.costoFijo])),
      ...(modo === 'multi' ? Object.fromEntries(P.escenarios.map((s, k) => [th(k), s.prob])) : { theta: 1 }),
    },
    variables: [...P.depositos.map((d) => ({ id: aperturaId(d.id), integer: true, ub: 1 })), ...thetas.map((id) => ({ id, lb: 0 }))],
    constraints: cortes.flatMap((ronda, r) => {
      if (modo === 'multi')
        return ronda.map((c, k) => ({
          id: `c${r + 1}_${P.escenarios[k].id}`,
          name: `Corte ${r + 1} (${P.escenarios[k].id})`,
          coefs: { [th(k)]: 1, ...Object.fromEntries(Object.entries(c.coefs).map(([d, v]) => [aperturaId(d), -v])) },
          op: '>=' as const,
          rhs: c.constante,
        }));
      // Corte único: la suma ponderada de los cortes de la ronda.
      const coefs: Record<string, number> = { theta: 1 };
      let rhs = 0;
      ronda.forEach((c, k) => {
        const p = P.escenarios[k].prob;
        rhs += p * c.constante;
        for (const [d, v] of Object.entries(c.coefs)) coefs[aperturaId(d)] = (coefs[aperturaId(d)] ?? 0) - p * v;
      });
      return [{ id: `c${r + 1}`, name: `Corte ${r + 1}`, coefs, op: '>=' as const, rhs: r6(rhs) }];
    }),
  };
  const r = await solve(model);
  if (r.status !== 'optimal') throw new Error(`Maestro ${r.status}`);
  const abiertos = new Set(P.depositos.filter((d) => (r.values[aperturaId(d.id)] ?? 0) > 0.5).map((d) => d.id));
  return { abiertos, cotaInferior: r6(r.objective!) };
}

export interface Ronda extends Evaluacion {
  origen: 'jugador' | 'maestro' | 'promedio' | 'peor';
  mejor: number;
  cotaInferior: number;
}

export interface EstadoEstocastico {
  modo: ModoCortes;
  cortes: Corte[][];
  rondas: Ronda[];
  mejor: number;
  cotaInferior: number;
}

export const iniciar = (modo: ModoCortes = 'multi'): EstadoEstocastico => ({ modo, cortes: [], rondas: [], mejor: Infinity, cotaInferior: 0 });

export const propuestaMaestro = async (P: ProblemaEstocastico, e: EstadoEstocastico) => (await resolverMaestro(P, e.cortes, e.modo)).abiertos;

/** Una ronda: evaluar la apertura en todos los escenarios, sumar sus cortes y recalcular la cota. */
export async function paso(P: ProblemaEstocastico, e: EstadoEstocastico, abiertos: Set<string>, origen: Ronda['origen']) {
  const ev = await evaluar(P, abiertos);
  const cortes = [...e.cortes, ev.escenarios.map((r) => r.corte)];
  const { cotaInferior } = await resolverMaestro(P, cortes, e.modo);
  const mejor = Math.min(e.mejor, ev.total);
  const ci = Math.max(e.cotaInferior, cotaInferior);
  const estado: EstadoEstocastico = { ...e, cortes, mejor, cotaInferior: ci, rondas: [...e.rondas, { ...ev, origen, mejor, cotaInferior: ci }] };
  return { estado, evaluacion: ev };
}

export const convergio = (e: EstadoEstocastico) => e.rondas.length > 0 && e.mejor - e.cotaInferior < 1e-6 * Math.max(1, Math.abs(e.mejor));

export async function bendersEstocastico(P: ProblemaEstocastico, modo: ModoCortes = 'multi', max = 60): Promise<EstadoEstocastico> {
  let e = iniciar(modo);
  for (let k = 0; k < max && !convergio(e); k++) e = (await paso(P, e, await propuestaMaestro(P, e), 'maestro')).estado;
  return e;
}

/* ---------- Modelos "de una vez" y medidas clásicas ---------- */

/** Modelo determinístico: decide aperturas para una sola demanda (con silo bolsa). */
export async function planDeterministico(P: ProblemaEstocastico, demanda: Record<string, number>): Promise<Set<string>> {
  const s: Escenario = { id: 'det', prob: 1, demanda };
  return (await resolverExtensivo({ ...P, escenarios: [s] })).abiertos;
}

/** Forma extensiva: todos los escenarios en un solo modelo entero. */
export async function resolverExtensivo(P: ProblemaEstocastico): Promise<{ abiertos: Set<string>; total: number }> {
  const variables = [
    ...P.depositos.map((d) => ({ id: aperturaId(d.id), integer: true, ub: 1 })),
    ...P.escenarios.flatMap((s) => [
      ...P.depositos.flatMap((d) => P.clientes.map((c) => ({ id: flujoId(d.id, c.id, s.id) }))),
      ...P.clientes.map((c) => ({ id: faltaId(c.id, s.id) })),
    ]),
  ];
  const objective: Record<string, number> = Object.fromEntries(P.depositos.map((d) => [aperturaId(d.id), d.costoFijo]));
  for (const s of P.escenarios) {
    for (const d of P.depositos) for (const c of P.clientes) objective[flujoId(d.id, c.id, s.id)] = s.prob * P.costo(d.id, c.id);
    for (const c of P.clientes) objective[faltaId(c.id, s.id)] = s.prob * P.penalidad;
  }
  const constraints: Constraint[] = P.escenarios.flatMap((s) => [
    ...P.clientes.map((c) => ({
      id: `dem_${c.id}_${s.id}`,
      name: `Demanda ${c.id} ${s.id}`,
      coefs: { ...Object.fromEntries(P.depositos.map((d) => [flujoId(d.id, c.id, s.id), 1])), [faltaId(c.id, s.id)]: 1 },
      op: '>=' as const,
      rhs: s.demanda[c.id] ?? 0,
    })),
    ...P.depositos.map((d) => ({
      id: `cap_${d.id}_${s.id}`,
      name: `Capacidad ${d.id} ${s.id}`,
      coefs: { ...Object.fromEntries(P.clientes.map((c) => [flujoId(d.id, c.id, s.id), 1])), [aperturaId(d.id)]: -d.capacidad },
      op: '<=' as const,
      rhs: 0,
    })),
  ]);
  const r = await solve({ sense: 'min', objective, variables, constraints });
  if (r.status !== 'optimal') throw new Error(`Extensivo ${r.status}`);
  return { abiertos: new Set(P.depositos.filter((d) => (r.values[aperturaId(d.id)] ?? 0) > 0.5).map((d) => d.id)), total: r6(r.objective!) };
}

export const demandaPromedio = (P: ProblemaEstocastico) =>
  Object.fromEntries(P.clientes.map((c) => [c.id, r6(P.escenarios.reduce((t, s) => t + s.prob * (s.demanda[c.id] ?? 0), 0))]));

export const peorEscenario = (P: ProblemaEstocastico) =>
  P.escenarios.reduce((m, s) => (Object.values(s.demanda).reduce((a, b) => a + b, 0) > Object.values(m.demanda).reduce((a, b) => a + b, 0) ? s : m));

export interface Medidas {
  /** Solución estocástica (recourse problem). */
  rp: Evaluacion;
  /** Planificar para el año promedio y después vivir los escenarios. */
  eev: Evaluacion;
  /** Planificar para el peor año. */
  peor: Evaluacion;
  /** Esperanza con información perfecta (wait and see). */
  ws: number;
  /** El mejor plan de cada escenario si se supiera de antemano que va a pasar. */
  wsPlanes: { escenario: string; abiertos: string[]; total: number }[];
  /** Valor de la solución estocástica: EEV − RP. */
  vss: number;
  /** Valor esperado de la información perfecta: RP − WS. */
  evpi: number;
}

export async function medidas(P: ProblemaEstocastico): Promise<Medidas> {
  const rp = await evaluar(P, (await resolverExtensivo(P)).abiertos);
  const eev = await evaluar(P, await planDeterministico(P, demandaPromedio(P)));
  const peor = await evaluar(P, await planDeterministico(P, peorEscenario(P).demanda));
  const wsPlanes: Medidas['wsPlanes'] = [];
  for (const s of P.escenarios) {
    const r = await resolverExtensivo({ ...P, escenarios: [{ ...s, prob: 1 }] });
    wsPlanes.push({ escenario: s.id, abiertos: P.depositos.filter((d) => r.abiertos.has(d.id)).map((d) => d.id), total: r.total });
  }
  const ws = r6(P.escenarios.reduce((t, s, k) => t + s.prob * wsPlanes[k].total, 0));
  return { rp, eev, peor, ws, wsPlanes, vss: r6(eev.total - rp.total), evpi: r6(rp.total - ws) };
}

/** Costo de cada año con un plan ya decidido: fijo + segunda etapa de ese escenario. */
export const costoPorAnio = (e: Evaluacion) => e.escenarios.map((r) => r6(e.fijo + r.costo));

export interface Sensibilidad {
  /** Escenario más exigente, cuya probabilidad se mueve. */
  escenario: string;
  /** Su probabilidad en los datos. */
  base: number;
  /** Rango de esa probabilidad en el que la recomendación no cambia (umbrales exactos). */
  desde: number;
  hasta: number;
  /** El plan que conviene por debajo de `desde` y por encima de `hasta` (null si no cambia). */
  antes: string[] | null;
  despues: string[] | null;
}

/**
 * ¿Cambia la decisión si el escenario más exigente es más o menos probable? Se mueve su
 * probabilidad (entre 0 y `hasta`) contra la del escenario más probable de los otros.
 *
 * Con las plantas fijas, el costo de cada año no depende de las probabilidades: el costo
 * esperado de un plan es una recta en p. Una grilla gruesa dice qué planes compiten con la
 * recomendación a cada lado, y el umbral es donde se cruzan sus rectas.
 */
export async function sensibilidadPeor(P: ProblemaEstocastico, paso = 0.05, hasta = 0.5): Promise<Sensibilidad> {
  const peor = peorEscenario(P);
  const otro = P.escenarios.filter((s) => s !== peor).reduce((m, s) => (s.prob > m.prob ? s : m));
  const masa = peor.prob + otro.prob;
  const tope = Math.min(hasta, masa);
  const conP = (p: number) => P.escenarios.map((s) => (s === peor ? { ...s, prob: p } : s === otro ? { ...s, prob: r6(masa - p) } : s));
  const plan = async (p: number) => {
    const r = await resolverExtensivo({ ...P, escenarios: conP(p) });
    return P.depositos.filter((d) => r.abiertos.has(d.id)).map((d) => d.id);
  };
  const mismo = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

  // Costo esperado de un plan como recta a + b·p.
  const rectas = new Map<string, { a: number; b: number }>();
  const recta = async (abiertos: string[]) => {
    const clave = abiertos.join();
    if (!rectas.has(clave)) {
      const ev = await evaluar(P, new Set(abiertos));
      const c = (s: Escenario) => ev.escenarios[P.escenarios.indexOf(s)].costo;
      const resto = P.escenarios.reduce((t, s) => (s === peor || s === otro ? t : t + s.prob * c(s)), 0);
      rectas.set(clave, { a: ev.fijo + resto + masa * c(otro), b: c(peor) - c(otro) });
    }
    return rectas.get(clave)!;
  };
  const cruce = async (x: string[], y: string[]) => {
    const [rx, ry] = [await recta(x), await recta(y)];
    return Math.abs(ry.b - rx.b) < 1e-12 ? null : (rx.a - ry.a) / (ry.b - rx.b);
  };

  const actual = await plan(peor.prob);
  let desde = 0;
  let antes: string[] | null = null;
  for (let p = r6(peor.prob - paso); p >= -1e-9; p = r6(p - paso)) {
    const otroPlan = await plan(Math.max(0, p));
    if (!mismo(otroPlan, actual)) {
      antes = otroPlan;
      desde = Math.min(peor.prob, Math.max(0, (await cruce(actual, otroPlan)) ?? p));
      break;
    }
  }
  let hastaP = tope;
  let despues: string[] | null = null;
  for (let p = r6(peor.prob + paso); p <= tope + 1e-9; p = r6(p + paso)) {
    const otroPlan = await plan(Math.min(tope, p));
    if (!mismo(otroPlan, actual)) {
      despues = otroPlan;
      hastaP = Math.max(peor.prob, Math.min(tope, (await cruce(actual, otroPlan)) ?? p));
      break;
    }
  }
  return { escenario: peor.id, base: peor.prob, desde: r6(desde), hasta: r6(hastaP), antes, despues };
}
