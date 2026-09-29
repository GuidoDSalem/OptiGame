/**
 * Generación de columnas para el problema de corte de bobinas (cutting stock).
 *
 * - Maestro restringido: con los patrones conocidos, min Σ_p x_p s.a. Σ_p a_ip x_p ≥ d_i
 *   (relajación lineal). Sus precios sombra π_i dicen cuánto "vale" cada pieza.
 * - Pricing: la mochila max Σ_i π_i a_i s.a. Σ_i w_i a_i ≤ W (a_i enteras). Si el mejor
 *   patrón vale más que 1 (lo que cuesta una bobina), su costo reducido 1 − Σ π_i a_i es
 *   negativo y conviene agregarlo como columna nueva.
 */
import type { LPModel } from './model';
import { solve } from './solver';

export interface Pedido {
  id: string;
  ancho: number;
  cantidad: number;
}

export interface ProblemaCorte {
  /** Ancho de la bobina madre. */
  ancho: number;
  pedidos: Pedido[];
}

/** Patrón de corte: cuántas piezas de cada pedido salen de una bobina. */
export type Patron = Record<string, number>;

const EPS = 1e-7;
const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

export const piezas = (P: ProblemaCorte, p: Patron) => P.pedidos.map((q) => p[q.id] ?? 0);

/** Id estable del patrón: "p2_1_0_0" (piezas por pedido, en el orden de los pedidos). */
export const patronId = (P: ProblemaCorte, p: Patron) => `p${piezas(P, p).join('_')}`;
export const variableId = (P: ProblemaCorte, p: Patron) => `x_${patronId(P, p)}`;

/** Inversa de `variableId`: null si el id no es de un patrón de este problema. */
export function patronDeVariable(P: ProblemaCorte, id: string): Patron | null {
  const m = /^x_p(\d+(?:_\d+)*)$/.exec(id);
  if (!m) return null;
  const n = m[1].split('_').map(Number);
  if (n.length !== P.pedidos.length) return null;
  return Object.fromEntries(P.pedidos.map((q, i) => [q.id, n[i]]));
}

export const usado = (P: ProblemaCorte, p: Patron) => P.pedidos.reduce((s, q) => s + q.ancho * (p[q.id] ?? 0), 0);
export const sobrante = (P: ProblemaCorte, p: Patron) => P.ancho - usado(P, p);
export const esFactible = (P: ProblemaCorte, p: Patron) =>
  usado(P, p) <= P.ancho && P.pedidos.some((q) => (p[q.id] ?? 0) > 0) && P.pedidos.every((q) => (p[q.id] ?? 0) >= 0);
/** Maximal: no entra ninguna pieza más. */
export const esMaximal = (P: ProblemaCorte, p: Patron) => P.pedidos.every((q) => q.ancho > sobrante(P, p));

/** Completa el sobrante con las piezas más anchas que todavía entren (no cambia su valor si π ≥ 0). */
export function completar(P: ProblemaCorte, p: Patron): Patron {
  const r = { ...p };
  for (const q of [...P.pedidos].sort((a, b) => b.ancho - a.ancho))
    while (q.ancho <= sobrante(P, r)) r[q.id] = (r[q.id] ?? 0) + 1;
  return r;
}

/** "2×60 + 1×45": el patrón en anchos de pieza (de la más ancha a la más angosta). */
export const describir = (P: ProblemaCorte, p: Patron) =>
  [...P.pedidos]
    .sort((a, b) => b.ancho - a.ancho)
    .filter((q) => (p[q.id] ?? 0) > 0)
    .map((q) => `${p[q.id]}×${q.ancho}`)
    .join(' + ') || '(vacío)';

/** Todos los patrones factibles (o sólo los maximales). */
export function todosLosPatrones(P: ProblemaCorte, soloMaximales = true): Patron[] {
  const out: Patron[] = [];
  const rec = (i: number, p: Patron, libre: number) => {
    if (i === P.pedidos.length) {
      if (esFactible(P, p) && (!soloMaximales || esMaximal(P, p))) out.push({ ...p });
      return;
    }
    const q = P.pedidos[i];
    for (let k = Math.floor(libre / q.ancho); k >= 0; k--) rec(i + 1, { ...p, [q.id]: k }, libre - k * q.ancho);
  };
  rec(0, {}, P.ancho);
  return out;
}

/** Patrones "obvios" del arranque: cada bobina corta un solo ancho, todas las piezas que entren. */
export const patronesIniciales = (P: ProblemaCorte): Patron[] =>
  P.pedidos.map((q) => Object.fromEntries(P.pedidos.map((o) => [o.id, o.id === q.id ? Math.floor(P.ancho / q.ancho) : 0])));

/** Modelo de patrones: min Σ x_p s.a. Σ_p a_ip x_p ≥ d_i. */
export function modeloPatrones(P: ProblemaCorte, patrones: Patron[], entero: boolean): LPModel {
  return {
    sense: 'min',
    objective: Object.fromEntries(patrones.map((p) => [variableId(P, p), 1])),
    variables: patrones.map((p) => ({ id: variableId(P, p), integer: entero })),
    constraints: P.pedidos.map((q) => ({
      id: `dem_${q.id}`,
      name: `Pedido ${q.id}`,
      coefs: Object.fromEntries(patrones.filter((p) => (p[q.id] ?? 0) > 0).map((p) => [variableId(P, p), p[q.id]])),
      op: '>=' as const,
      rhs: q.cantidad,
    })),
  };
}

export interface Maestro {
  objetivo: number;
  /** Bobinas por patrón (id de variable → valor). */
  x: Record<string, number>;
  /** Precio sombra de cada pedido: cuánto baja el total si se pide una pieza menos. */
  duales: Record<string, number>;
}

/** Maestro restringido (relajación lineal) con los patrones conocidos. */
export async function resolverMaestro(P: ProblemaCorte, patrones: Patron[]): Promise<Maestro> {
  const r = await solve(modeloPatrones(P, patrones, false));
  if (r.status !== 'optimal') throw new Error(`Maestro ${r.status}`);
  const dual = (id: string) => r.rows.find((x) => x.id === id)?.dual ?? 0;
  return {
    objetivo: redondear(r.objective!),
    x: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, redondear(v)])),
    duales: Object.fromEntries(P.pedidos.map((q) => [q.id, redondear(Math.max(0, dual(`dem_${q.id}`)))])),
  };
}

/** Valor de un patrón con los precios sombra: Σ π_i a_i. */
export const valorPatron = (P: ProblemaCorte, duales: Record<string, number>, p: Patron) =>
  redondear(P.pedidos.reduce((s, q) => s + (duales[q.id] ?? 0) * (p[q.id] ?? 0), 0));

/** Costo reducido de la columna: una bobina cuesta 1, y "devuelve" Σ π_i a_i. */
export const costoReducido = (P: ProblemaCorte, duales: Record<string, number>, p: Patron) =>
  redondear(1 - valorPatron(P, duales, p));

/** Pricing: la mochila que busca el patrón más valioso con los precios sombra actuales. */
export async function pricing(P: ProblemaCorte, duales: Record<string, number>): Promise<{ patron: Patron; valor: number }> {
  const a = (id: string) => `a_${id}`;
  const r = await solve({
    sense: 'max',
    // Desempate: entre patrones de igual valor, preferir el que desperdicia menos.
    objective: Object.fromEntries(P.pedidos.map((q) => [a(q.id), (duales[q.id] ?? 0) + q.ancho * 1e-6])),
    variables: P.pedidos.map((q) => ({ id: a(q.id), integer: true })),
    constraints: [
      { id: 'ancho', name: 'Ancho de la bobina', coefs: Object.fromEntries(P.pedidos.map((q) => [a(q.id), q.ancho])), op: '<=', rhs: P.ancho },
    ],
  });
  if (r.status !== 'optimal') throw new Error(`Pricing ${r.status}`);
  const patron = completar(P, Object.fromEntries(P.pedidos.map((q) => [q.id, Math.round(r.values[a(q.id)] ?? 0)])));
  return { patron, valor: valorPatron(P, duales, patron) };
}

/**
 * Cota de Farley: si ninguna bobina puede "valer" más que v* con los precios π, entonces
 * cualquier solución (aun fraccionaria) usa al menos z_LP / v* bobinas.
 */
export const cotaFarley = (lp: number, mejorValor: number) => redondear(lp / Math.max(1, mejorValor));

export interface Ronda {
  patron: Patron;
  origen: 'jugador' | 'pricing';
  costoReducido: number;
  /** Relajación del maestro después de agregar el patrón. */
  lp: number;
  cotaInferior: number;
}

export interface EstadoColumnas {
  patrones: Patron[];
  maestro: Maestro;
  /** Mejor patrón según el pricing con los precios actuales (para la cota y para "que busque el pricing"). */
  sugerido: { patron: Patron; valor: number };
  cotaInferior: number;
  /** Relajación y cota con los patrones del arranque (el punto 0 del gráfico). */
  inicial: { lp: number; cotaInferior: number };
  rondas: Ronda[];
}

async function armarEstado(P: ProblemaCorte, patrones: Patron[], cotaPrevia: number) {
  const maestro = await resolverMaestro(P, patrones);
  const sugerido = await pricing(P, maestro.duales);
  const cotaInferior = Math.max(cotaPrevia, cotaFarley(maestro.objetivo, sugerido.valor));
  return { patrones, maestro, sugerido, cotaInferior };
}

export async function iniciarColumnas(P: ProblemaCorte): Promise<EstadoColumnas> {
  const e = await armarEstado(P, patronesIniciales(P), 0);
  return { ...e, inicial: { lp: e.maestro.objetivo, cotaInferior: e.cotaInferior }, rondas: [] };
}

/** Terminó: ningún patrón tiene costo reducido negativo (la relajación con todos los patrones es óptima). */
export const convergio = (e: EstadoColumnas) => e.sugerido.valor <= 1 + EPS;

export const yaEsta = (P: ProblemaCorte, e: EstadoColumnas, p: Patron) =>
  e.patrones.some((q) => patronId(P, q) === patronId(P, p));

export type Paso =
  | { ok: true; estado: EstadoColumnas }
  | { ok: false; motivo: 'no-entra' | 'vacio' | 'repetido' | 'no-mejora'; costoReducido?: number };

/** Una ronda: si el patrón tiene costo reducido negativo, entra como columna y se re-resuelve el maestro. */
export async function paso(P: ProblemaCorte, e: EstadoColumnas, patron: Patron, origen: Ronda['origen']): Promise<Paso> {
  if (P.pedidos.every((q) => (patron[q.id] ?? 0) <= 0)) return { ok: false, motivo: 'vacio' };
  if (!esFactible(P, patron)) return { ok: false, motivo: 'no-entra' };
  if (yaEsta(P, e, patron)) return { ok: false, motivo: 'repetido' };
  const cr = costoReducido(P, e.maestro.duales, patron);
  if (cr >= -EPS) return { ok: false, motivo: 'no-mejora', costoReducido: cr };
  const patrones = [...e.patrones, patron];
  const provisorio = await armarEstado(P, patrones, e.cotaInferior);
  const ronda: Ronda = {
    patron,
    origen,
    costoReducido: cr,
    lp: provisorio.maestro.objetivo,
    cotaInferior: provisorio.cotaInferior,
  };
  return { ok: true, estado: { ...provisorio, inicial: e.inicial, rondas: [...e.rondas, ronda] } };
}

/**
 * Generación de columnas completa, guardando cada estado: el del arranque y uno por ronda.
 * Siempre agrega el patrón que encuentra el pricing.
 */
export async function trazaColumnas(P: ProblemaCorte, maxRondas = 100): Promise<EstadoColumnas[]> {
  const traza = [await iniciarColumnas(P)];
  for (let k = 0; k < maxRondas && !convergio(traza[traza.length - 1]); k++) {
    const r = await paso(P, traza[traza.length - 1], traza[traza.length - 1].sugerido.patron, 'pricing');
    if (!r.ok) break;
    traza.push(r.estado);
  }
  return traza;
}

export async function generacionDeColumnas(P: ProblemaCorte, maxRondas = 100): Promise<EstadoColumnas> {
  const traza = await trazaColumnas(P, maxRondas);
  return traza[traza.length - 1];
}

/**
 * Los pasos que muestra la reproducción de una traza. En cada estado k: se resuelve el
 * maestro, se leen sus precios sombra, el pricing busca el mejor patrón, y ese patrón entra
 * (lo que lleva al estado k + 1) o, si no conviene, se termina.
 */
export type FaseColumnas = 'maestro' | 'precios' | 'pricing' | 'agrega' | 'fin';

export function fasesDeLaTraza(traza: EstadoColumnas[]): { k: number; fase: FaseColumnas }[] {
  return traza.flatMap((_, k) => {
    const cierre: FaseColumnas = k < traza.length - 1 ? 'agrega' : 'fin';
    return (['maestro', 'precios', 'pricing', cierre] as const).map((fase) => ({ k, fase }));
  });
}

export interface SolucionEntera {
  bobinas: number;
  x: Record<string, number>;
}

/** Redondeo ingenuo: cada patrón de la relajación, hacia arriba. */
export function redondeoHaciaArriba(x: Record<string, number>): SolucionEntera {
  const r = Object.fromEntries(Object.entries(x).map(([k, v]) => [k, Math.ceil(v - 1e-6)]).filter(([, v]) => (v as number) > 0));
  return { bobinas: Object.values(r).reduce((s: number, v) => s + (v as number), 0), x: r };
}

/** El modelo entero sólo con los patrones dados (los generados, o todos). */
export async function enteroConPatrones(P: ProblemaCorte, patrones: Patron[]): Promise<SolucionEntera> {
  const r = await solve(modeloPatrones(P, patrones, true));
  if (r.status !== 'optimal') throw new Error(`Entero ${r.status}`);
  const x = Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => (v as number) > 0));
  return { bobinas: Math.round(r.objective!), x };
}

/** Piezas producidas de cada pedido con una decisión (id de variable → bobinas). */
export function producido(P: ProblemaCorte, values: Record<string, number>): Record<string, number> {
  const out = Object.fromEntries(P.pedidos.map((q) => [q.id, 0]));
  for (const [k, v] of Object.entries(values)) {
    const p = patronDeVariable(P, k);
    if (!p || !(v > 0)) continue;
    for (const q of P.pedidos) out[q.id] += v * (p[q.id] ?? 0);
  }
  return out;
}
