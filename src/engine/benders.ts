/**
 * Descomposición de Benders para localización de depósitos (con capacidad).
 *
 * - Maestro: decide qué depósitos abrir (y_d binarias) y estima el costo de transporte con θ.
 * - Subproblema: con los depósitos fijos, resuelve el transporte (un LP) y, con sus precios
 *   sombra, devuelve un corte θ ≥ constante + Σ_d coef_d · y_d válido para cualquier apertura.
 */
import type { Constraint, LPModel } from './model';
import { solve } from './solver';

export interface Deposito {
  id: string;
  costoFijo: number;
  capacidad: number;
}

export interface Cliente {
  id: string;
  demanda: number;
}

export interface ProblemaLocalizacion {
  depositos: Deposito[];
  clientes: Cliente[];
  /** Costo de mandar una unidad del depósito d al cliente c. */
  costo(d: string, c: string): number;
}

/** Corte de optimalidad: θ ≥ constante + Σ_d coefs[d] · y_d. */
export interface Corte {
  constante: number;
  coefs: Record<string, number>;
}

export const flujoId = (d: string, c: string) => `x_${d}_${c}`;
export const aperturaId = (d: string) => `y_${d}`;

const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

export function costoFijo(P: ProblemaLocalizacion, abiertos: Set<string>) {
  return P.depositos.reduce((s, d) => s + (abiertos.has(d.id) ? d.costoFijo : 0), 0);
}

export type Subresultado =
  | { factible: true; transporte: number; flujos: Record<string, number>; corte: Corte }
  | { factible: false; faltante: number };

/** Subproblema: transporte más barato con los depósitos abiertos. */
export async function resolverSubproblema(P: ProblemaLocalizacion, abiertos: Set<string>): Promise<Subresultado> {
  const demanda = P.clientes.reduce((s, c) => s + c.demanda, 0);
  const cap = P.depositos.reduce((s, d) => s + (abiertos.has(d.id) ? d.capacidad : 0), 0);
  if (cap < demanda - 1e-9) return { factible: false, faltante: demanda - cap };

  const variables = P.depositos.flatMap((d) => P.clientes.map((c) => ({ id: flujoId(d.id, c.id) })));
  const objective = Object.fromEntries(
    P.depositos.flatMap((d) => P.clientes.map((c) => [flujoId(d.id, c.id), P.costo(d.id, c.id)])),
  );
  const constraints: Constraint[] = [
    ...P.clientes.map((c) => ({
      id: `dem_${c.id}`,
      name: `Demanda ${c.id}`,
      coefs: Object.fromEntries(P.depositos.map((d) => [flujoId(d.id, c.id), 1])),
      op: '>=' as const,
      rhs: c.demanda,
    })),
    ...P.depositos.map((d) => ({
      id: `cap_${d.id}`,
      name: `Capacidad ${d.id}`,
      coefs: Object.fromEntries(P.clientes.map((c) => [flujoId(d.id, c.id), 1])),
      op: '<=' as const,
      rhs: abiertos.has(d.id) ? d.capacidad : 0,
    })),
  ];
  const r = await solve({ sense: 'min', objective, variables, constraints });
  if (r.status !== 'optimal') return { factible: false, faltante: 0 };

  // Precios sombra: u_c ≥ 0 (demanda) y v_d ≤ 0 (capacidad). Por dualidad fuerte,
  // Q(ȳ) = Σ u_c q_c + Σ v_d K_d ȳ_d, y la misma expresión con y cualquiera es una cota inferior.
  const dual = (id: string) => r.rows.find((x) => x.id === id)?.dual ?? 0;
  const constante = P.clientes.reduce((s, c) => s + dual(`dem_${c.id}`) * c.demanda, 0);
  const coefs = Object.fromEntries(P.depositos.map((d) => [d.id, redondear(dual(`cap_${d.id}`) * d.capacidad)]));
  return { factible: true, transporte: r.objective!, flujos: r.values, corte: { constante: redondear(constante), coefs } };
}

/** Maestro: aperturas y estimación θ del transporte, con los cortes acumulados. */
export async function resolverMaestro(P: ProblemaLocalizacion, cortes: Corte[]) {
  const demanda = P.clientes.reduce((s, c) => s + c.demanda, 0);
  const model: LPModel = {
    sense: 'min',
    objective: { ...Object.fromEntries(P.depositos.map((d) => [aperturaId(d.id), d.costoFijo])), theta: 1 },
    variables: [...P.depositos.map((d) => ({ id: aperturaId(d.id), integer: true, ub: 1 })), { id: 'theta', lb: 0 }],
    constraints: [
      // Corte de factibilidad "de fábrica": la capacidad abierta tiene que alcanzar la demanda.
      {
        id: 'cobertura',
        name: 'Capacidad suficiente',
        coefs: Object.fromEntries(P.depositos.map((d) => [aperturaId(d.id), d.capacidad])),
        op: '>=',
        rhs: demanda,
      },
      ...cortes.map((c, k) => ({
        id: `corte${k + 1}`,
        name: `Corte ${k + 1}`,
        coefs: { theta: 1, ...Object.fromEntries(Object.entries(c.coefs).map(([d, v]) => [aperturaId(d), -v])) },
        op: '>=' as const,
        rhs: c.constante,
      })),
    ],
  };
  const r = await solve(model);
  const abiertos = new Set(P.depositos.filter((d) => (r.values[aperturaId(d.id)] ?? 0) > 0.5).map((d) => d.id));
  return { abiertos, theta: r.values.theta ?? 0, cotaInferior: r.objective ?? 0 };
}

export interface Ronda {
  abiertos: string[];
  origen: 'jugador' | 'maestro';
  costoFijo: number;
  transporte: number;
  total: number;
  corte: Corte;
  /** Mejor solución encontrada hasta esta ronda (cota superior). */
  mejor: number;
  /** Cota inferior del maestro después de agregar el corte de esta ronda. */
  cotaInferior: number;
}

/** Estado del algoritmo: cortes acumulados, rondas jugadas y cota inferior actual. */
export interface EstadoBenders {
  cortes: Corte[];
  rondas: Ronda[];
  cotaInferior: number;
  mejor: number;
}

export async function iniciarBenders(P: ProblemaLocalizacion): Promise<EstadoBenders> {
  const m = await resolverMaestro(P, []);
  return { cortes: [], rondas: [], cotaInferior: m.cotaInferior, mejor: Infinity };
}

/** Lo que propondría el maestro con los cortes que tiene. */
export async function propuestaMaestro(P: ProblemaLocalizacion, e: EstadoBenders): Promise<Set<string>> {
  return (await resolverMaestro(P, e.cortes)).abiertos;
}

export type ResultadoPaso =
  | { factible: true; estado: EstadoBenders; ronda: Ronda; flujos: Record<string, number> }
  | { factible: false; faltante: number };

/**
 * Una ronda: evalúa una apertura (subproblema), agrega su corte y recalcula la cota inferior
 * del maestro con el corte nuevo.
 */
export async function paso(
  P: ProblemaLocalizacion,
  e: EstadoBenders,
  abiertos: Set<string>,
  origen: Ronda['origen'],
): Promise<ResultadoPaso> {
  const sub = await resolverSubproblema(P, abiertos);
  if (!sub.factible) return sub;
  const cortes = [...e.cortes, sub.corte];
  const m = await resolverMaestro(P, cortes);
  const fijo = costoFijo(P, abiertos);
  const total = redondear(fijo + sub.transporte);
  const mejor = Math.min(e.mejor, total);
  const ronda: Ronda = {
    abiertos: [...abiertos],
    origen,
    costoFijo: fijo,
    transporte: sub.transporte,
    total,
    corte: sub.corte,
    mejor,
    cotaInferior: redondear(m.cotaInferior),
  };
  return {
    factible: true,
    estado: { cortes, rondas: [...e.rondas, ronda], cotaInferior: ronda.cotaInferior, mejor },
    ronda,
    flujos: sub.flujos,
  };
}

/** ¿Las cotas se tocaron? Entonces la mejor solución encontrada es óptima (demostrado). */
export const convergio = (e: EstadoBenders) =>
  e.rondas.length > 0 && e.mejor - e.cotaInferior <= 1e-6 * Math.max(1, Math.abs(e.mejor));

/** Una ronda de Benders automático, con lo que creía el maestro al proponer. */
export interface RondaTraza {
  /** Lo que propuso el maestro con los cortes que tenía: apertura, su estimación θ y su cota. */
  maestro: { abiertos: string[]; theta: number; cotaInferior: number };
  ronda: Ronda;
  /** Transporte óptimo del subproblema (id de variable → camiones). */
  flujos: Record<string, number>;
  /** Estado después de la ronda (con el corte nuevo). */
  estado: EstadoBenders;
}

/** Benders automático guardando cada ronda: el maestro propone, el subproblema corta. */
export async function trazaBenders(P: ProblemaLocalizacion, maxRondas = 40): Promise<RondaTraza[]> {
  let e = await iniciarBenders(P);
  const traza: RondaTraza[] = [];
  for (let k = 0; k < maxRondas && !convergio(e); k++) {
    const m = await resolverMaestro(P, e.cortes);
    const r = await paso(P, e, m.abiertos, 'maestro');
    if (!r.factible) break;
    traza.push({
      maestro: { abiertos: [...m.abiertos], theta: redondear(m.theta), cotaInferior: redondear(m.cotaInferior) },
      ronda: r.ronda,
      flujos: r.flujos,
      estado: r.estado,
    });
    e = r.estado;
  }
  return traza;
}

/** Benders automático: el maestro propone, el subproblema corta, hasta que las cotas se tocan. */
export async function benders(P: ProblemaLocalizacion, maxRondas = 40): Promise<EstadoBenders> {
  const traza = await trazaBenders(P, maxRondas);
  return traza.length ? traza[traza.length - 1].estado : iniciarBenders(P);
}

/**
 * Los pasos que muestra la reproducción: en cada ronda el maestro propone, el subproblema
 * calcula el transporte real y devuelve un corte; al final, las cotas se tocan.
 */
export type FaseBenders = 'maestro' | 'subproblema' | 'corte' | 'fin';

export function fasesBenders(traza: RondaTraza[]): { k: number; fase: FaseBenders }[] {
  const fases = traza.flatMap((_, k) => (['maestro', 'subproblema', 'corte'] as const).map((fase) => ({ k, fase })));
  return traza.length ? [...fases, { k: traza.length - 1, fase: 'fin' as const }] : fases;
}
