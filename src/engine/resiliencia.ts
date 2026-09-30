/**
 * Caso de estudio C3: riesgo de interrupción en una cadena de suministro (Simchi-Levi et al., el
 * modelo que usó Ford después de Fukushima). En vez de estimar la probabilidad de cada desastre,
 * se mide el impacto de perder cada nodo de la red:
 *
 * - TTR (time to recover): cuánto tarda el nodo en volver. Lo informa el proveedor.
 * - TTS (time to survive): cuánto aguanta la red sin ese nodo cumpliendo toda la demanda,
 *   usando stock, proveedores alternativos y capacidad ociosa. Es un PL: max t.
 * - Impacto: si TTR > TTS, cuánto margen se pierde durante las TTR semanas (otro PL).
 *
 * La red es genérica: ítems (productos, piezas, materiales) con lista de materiales, y sitios
 * (plantas y proveedores) que los producen con cierta capacidad por semana.
 */
import type { Constraint, LPModel, VariableSpec } from './model';
import { solve } from './solver';

export interface Item {
  id: string;
  nombre: string;
  tipo: 'producto' | 'pieza' | 'material';
  unidad: string;
  /** Costo por unidad (US$). Para el stock extra se paga una tasa anual sobre este costo. */
  costo: number;
  /** Stock disponible en la red al momento de la caída (unidades). */
  stock: number;
  /** Productos: demanda por semana y margen por unidad (US$). */
  demanda?: number;
  margen?: number;
  /** Insumos por unidad de este ítem. */
  bom?: Record<string, number>;
}

export interface Sitio {
  id: string;
  nombre: string;
  /** Nombre corto para los gráficos. */
  corto: string;
  lugar: string;
  tipo: 'planta' | 'proveedor';
  /** 0 = planta propia, 1 = proveedor directo, 2 = proveedor de un proveedor. */
  nivel: 0 | 1 | 2;
  /** Ítems que produce: capacidad por semana y volumen normal por semana. */
  produce: Record<string, { cap: number; normal: number }>;
  /** Plantas: capacidad total por semana, compartida entre productos. */
  capTotal?: number;
  /** Semanas que tarda en volver a producir si se cae. */
  ttr: number;
}

/** Una forma de blindar la red: stock extra de un ítem o un proveedor alternativo. */
export type Accion =
  | { id: string; tipo: 'stock'; item: string; nombre: string }
  | { id: string; tipo: 'fuente'; nombre: string; costoAnual: number; sitio: Sitio };

export interface Red {
  items: Item[];
  sitios: Sitio[];
  /** Costo anual de tener una unidad en stock, como fracción de su costo. */
  tasaStock: number;
  /** Horizonte máximo del TTS (semanas): más que esto es "aguanta". */
  horizonte: number;
  acciones: Accion[];
}

/** Decisión de blindaje: unidades extra de stock por ítem y fuentes alternativas habilitadas. */
export interface Blindaje {
  stock: Record<string, number>;
  fuentes: string[];
}

export const SIN_BLINDAJE: Blindaje = { stock: {}, fuentes: [] };

const xv = (s: string, i: string, n = '') => `x${n}|${s}|${i}`;
const lv = (p: string, n = '') => `l${n}|${p}`;

/** Sitios activos: los de la red más las fuentes alternativas habilitadas. */
function sitiosCon(red: Red, fuentes: string[]): Sitio[] {
  const extra = red.acciones.filter((a): a is Extract<Accion, { tipo: 'fuente' }> => a.tipo === 'fuente' && fuentes.includes(a.id));
  return [...red.sitios, ...extra.map((a) => a.sitio)];
}

interface Escenario {
  /** Sitio caído. */
  caido: string;
  /** Semanas fijas (impacto) o null (TTS: t es variable). */
  T: number | null;
  sufijo: string;
  /** Capacidad de cada fuente alternativa: si es variable, la multiplica z|fuente. */
  fuentesVariables?: Extract<Accion, { tipo: 'fuente' }>[];
  /** Stock extra: fijo (número) o variable (e|ítem). */
  stockVariable?: boolean;
}

/**
 * Restricciones de un escenario: producción limitada por capacidad (0 en el sitio caído),
 * balance de cada insumo (stock + lo que se produce ≥ lo que se consume) y demanda.
 */
function restricciones(red: Red, sitios: Sitio[], b: Blindaje, e: Escenario) {
  const vars: VariableSpec[] = [];
  const cons: Constraint[] = [];
  const n = e.sufijo;
  // Escala de tiempo: T fijo, o la variable t.
  const tiempo = (k: number): Record<string, number> => (e.T === null ? { t: -k } : {});
  const rhsT = (k: number) => (e.T === null ? 0 : k * e.T);

  for (const s of sitios) {
    const caido = s.id === e.caido;
    for (const [i, { cap }] of Object.entries(s.produce)) {
      const id = xv(s.id, i, n);
      vars.push({ id });
      const alt = e.fuentesVariables?.find((a) => a.sitio.id === s.id);
      const k = caido ? 0 : cap;
      if (alt && e.T !== null) {
        cons.push({ id: `cap${n}|${s.id}|${i}`, name: `Capacidad ${s.nombre}`, coefs: { [id]: 1, [`z|${alt.id}`]: -k * e.T }, op: '<=', rhs: 0 });
      } else cons.push({ id: `cap${n}|${s.id}|${i}`, name: `Capacidad ${s.nombre}`, coefs: { [id]: 1, ...tiempo(k) }, op: '<=', rhs: rhsT(k) });
    }
    if (s.capTotal !== undefined) {
      const k = s.id === e.caido ? 0 : s.capTotal;
      const coefs: Record<string, number> = { ...tiempo(k) };
      for (const i of Object.keys(s.produce)) coefs[xv(s.id, i, n)] = 1;
      cons.push({ id: `capt${n}|${s.id}`, name: `Capacidad total ${s.nombre}`, coefs, op: '<=', rhs: rhsT(k) });
    }
  }

  for (const it of red.items) {
    const coefs: Record<string, number> = {};
    for (const s of sitios) if (it.id in s.produce) coefs[xv(s.id, it.id, n)] = 1;
    if (it.tipo === 'producto') {
      // Demanda: lo que se produce (más lo perdido, si T es fijo) cubre la demanda del período.
      const d = it.demanda ?? 0;
      if (e.T === null) cons.push({ id: `dem${n}|${it.id}`, name: `Demanda ${it.nombre}`, coefs: { ...coefs, t: -d }, op: '>=', rhs: -it.stock });
      else {
        vars.push({ id: lv(it.id, n) });
        cons.push({ id: `dem${n}|${it.id}`, name: `Demanda ${it.nombre}`, coefs: { ...coefs, [lv(it.id, n)]: 1 }, op: '>=', rhs: d * e.T - it.stock });
      }
      continue;
    }
    // Balance del insumo: stock + producción − consumo ≥ 0.
    for (const s of sitios)
      for (const j of Object.keys(s.produce)) {
        const q = red.items.find((x) => x.id === j)?.bom?.[it.id];
        if (q) coefs[xv(s.id, j, n)] = (coefs[xv(s.id, j, n)] ?? 0) - q;
      }
    if (e.stockVariable) coefs[`e|${it.id}`] = 1;
    cons.push({ id: `bal${n}|${it.id}`, name: `Stock de ${it.nombre}`, coefs, op: '>=', rhs: -(it.stock + (e.stockVariable ? 0 : (b.stock[it.id] ?? 0))) });
  }
  return { vars, cons };
}

/** PL del TTS: max t, cumpliendo toda la demanda sin el sitio caído. */
export function modeloTTS(red: Red, caido: string, b: Blindaje = SIN_BLINDAJE): LPModel {
  const { vars, cons } = restricciones(red, sitiosCon(red, b.fuentes), b, { caido, T: null, sufijo: '' });
  return { sense: 'max', objective: { t: 1 }, variables: [{ id: 't', ub: red.horizonte }, ...vars], constraints: cons };
}

/** PL del impacto: margen perdido si el sitio está caído T semanas (repartiendo lo que hay de la mejor manera). */
export function modeloImpacto(red: Red, caido: string, T: number, b: Blindaje = SIN_BLINDAJE): LPModel {
  const { vars, cons } = restricciones(red, sitiosCon(red, b.fuentes), b, { caido, T, sufijo: '' });
  const objective: Record<string, number> = {};
  for (const it of red.items) if (it.tipo === 'producto') objective[lv(it.id)] = it.margen ?? 0;
  return { sense: 'min', objective, variables: vars, constraints: cons };
}

export async function tts(red: Red, caido: string, b: Blindaje = SIN_BLINDAJE) {
  const r = await solve(modeloTTS(red, caido, b));
  if (r.status !== 'optimal') throw new Error(`TTS de ${caido}: ${r.rawStatus}`);
  return { valor: r.objective!, filas: r.rows };
}

export async function impacto(red: Red, caido: string, T: number, b: Blindaje = SIN_BLINDAJE) {
  if (T <= 0) return { perdida: 0, perdidas: {} as Record<string, number> };
  const r = await solve(modeloImpacto(red, caido, T, b));
  if (r.status !== 'optimal') throw new Error(`Impacto de ${caido}: ${r.rawStatus}`);
  const perdidas: Record<string, number> = {};
  for (const it of red.items) if (it.tipo === 'producto') perdidas[it.id] = r.values[lv(it.id)] ?? 0;
  return { perdida: r.objective!, perdidas };
}

/** Costo anual de un blindaje. */
export function costoBlindaje(red: Red, b: Blindaje): number {
  let c = 0;
  for (const [i, q] of Object.entries(b.stock)) c += q * (red.items.find((x) => x.id === i)!.costo * red.tasaStock);
  for (const f of b.fuentes) {
    const a = red.acciones.find((x) => x.id === f);
    if (a?.tipo === 'fuente') c += a.costoAnual;
  }
  return c;
}

/** Nodos que pueden caerse: proveedores (las plantas propias tienen su propio plan). */
export const nodosDeRiesgo = (red: Red) => red.sitios.filter((s) => s.tipo === 'proveedor');

/**
 * El blindaje que minimiza la peor pérdida (sobre todas las caídas posibles, cada una durante su
 * TTR) con un presupuesto anual. Es un PL entero: las fuentes alternativas son binarias y cada
 * escenario de caída tiene su propio reparto.
 */
export function modeloBlindaje(red: Red, presupuesto: number, factorTTR = 1): LPModel {
  const fuentes = red.acciones.filter((a): a is Extract<Accion, { tipo: 'fuente' }> => a.tipo === 'fuente');
  const stocks = red.acciones.filter((a): a is Extract<Accion, { tipo: 'stock' }> => a.tipo === 'stock');
  const sitios = [...red.sitios, ...fuentes.map((f) => f.sitio)];
  const variables: VariableSpec[] = [{ id: 'W' }];
  const constraints: Constraint[] = [];
  // Stock extra sólo de los ítems con acción de stock.
  for (const it of red.items) variables.push({ id: `e|${it.id}`, ub: stocks.some((a) => a.item === it.id) ? undefined : 0 });
  for (const f of fuentes) variables.push({ id: `z|${f.id}`, ub: 1, integer: true });
  const objective: Record<string, number> = { W: 1 };
  nodosDeRiesgo(red).forEach((s, k) => {
    const n = `@${k}`;
    const { vars, cons } = restricciones(red, sitios, SIN_BLINDAJE, { caido: s.id, T: s.ttr * factorTTR, sufijo: n, fuentesVariables: fuentes, stockVariable: true });
    variables.push(...vars);
    constraints.push(...cons);
    // W ≥ pérdida del escenario; además, un poco de peso a la suma para no dejar mejoras gratis.
    const perdida: Record<string, number> = {};
    for (const it of red.items) if (it.tipo === 'producto') perdida[lv(it.id, n)] = it.margen ?? 0;
    constraints.push({ id: `peor${n}`, name: `Peor caso (${s.nombre})`, coefs: { W: 1, ...Object.fromEntries(Object.entries(perdida).map(([v, c]) => [v, -c])) }, op: '>=', rhs: 0 });
    for (const [v, c] of Object.entries(perdida)) objective[v] = 1e-3 * c;
  });
  const costo: Record<string, number> = {};
  for (const a of stocks) costo[`e|${a.item}`] = red.items.find((x) => x.id === a.item)!.costo * red.tasaStock;
  for (const f of fuentes) costo[`z|${f.id}`] = f.costoAnual;
  constraints.push({ id: 'presupuesto', name: 'Presupuesto', coefs: costo, op: '<=', rhs: presupuesto });
  // Entre blindajes que dejan la misma pérdida, el más barato.
  for (const [v, c] of Object.entries(costo)) objective[v] = 1e-4 * c;
  return { sense: 'min', objective, variables, constraints };
}

export async function mejorBlindaje(red: Red, presupuesto: number, factorTTR = 1): Promise<Blindaje> {
  const r = await solve(modeloBlindaje(red, presupuesto, factorTTR));
  if (r.status !== 'optimal') throw new Error(`Blindaje: ${r.rawStatus}`);
  const stock: Record<string, number> = {};
  for (const a of red.acciones) if (a.tipo === 'stock' && (r.values[`e|${a.item}`] ?? 0) > 1e-6) stock[a.item] = r.values[`e|${a.item}`];
  const fuentes = red.acciones.filter((a) => a.tipo === 'fuente' && (r.values[`z|${a.id}`] ?? 0) > 0.5).map((a) => a.id);
  return { stock, fuentes };
}

/** Gasto anual con cada proveedor directo (volumen normal × costo × 52 semanas). */
export function gastoAnual(red: Red, s: Sitio): number {
  if (s.nivel !== 1) return 0;
  return Object.entries(s.produce).reduce((g, [i, { normal }]) => g + normal * red.items.find((x) => x.id === i)!.costo * 52, 0);
}

/** Unidades de cada ítem que hacen falta por semana para cumplir toda la demanda (explotando la lista de materiales). */
export function necesidadSemanal(red: Red): Record<string, number> {
  const n: Record<string, number> = {};
  const sumar = (id: string, q: number) => {
    n[id] = (n[id] ?? 0) + q;
    for (const [j, b] of Object.entries(red.items.find((x) => x.id === id)?.bom ?? {})) sumar(j, q * b);
  };
  for (const p of red.items) if (p.tipo === 'producto') sumar(p.id, p.demanda ?? 0);
  return n;
}
