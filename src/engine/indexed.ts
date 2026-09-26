/**
 * Modelos con índices (estilo AMPL/Pyomo): conjuntos, parámetros indexados y familias de
 * variables y restricciones. Se "expanden" a un LPModel plano que entiende el solver.
 *
 * Una restricción es una suma de **términos** (signo · coeficiente · variable), cada uno con
 * sus propias sumatorias implícitas: los índices de la variable que no están en el "para cada"
 * se suman. Un término puede tener **desfase** en un conjunto ordenado (p. ej. s_{t-1}).
 */
import { lpName, type Constraint, type LPModel, type Op, type Sense } from './model';

export interface IndexSet {
  id: string; // "I"
  name: string; // "Plantas"
  index: string; // "i"
  items: { id: string; label: string; short: string }[];
  /** Conjunto ordenado (períodos): admite desfases como t−1. */
  ordered?: boolean;
}

export interface Param {
  id: string; // "c"
  name: string; // "Costo por camión"
  symbol: string; // "c"
  over: string[]; // ids de conjuntos
  /** Valores por tupla; la clave es la tupla de ids unida con "|" ("" si es escalar). */
  values: Record<string, number>;
}

export interface VarFamily {
  id: string; // "x"
  symbol: string; // "x"
  over: string[];
  label: string;
  unit: string;
  /**
   * Pares de conjuntos cuyos índices tienen que ser distintos (p. ej. ["I","J"] para no crear
   * x_ii en un ruteo: no se "viaja" de un lugar a sí mismo).
   */
  distinct?: [string, string];
}

/** ¿La asignación es válida para la familia (respeta los índices distintos)? */
export const validFor = (fam: VarFamily, a: Assignment) => !fam.distinct || a[fam.distinct[0]] !== a[fam.distinct[1]];

/** Dominio de una familia de variables: lo elige el jugador. */
export type VarType = 'cont' | 'int' | 'bin';

export const VAR_TYPES: { id: VarType; label: string }[] = [
  { id: 'cont', label: 'continua ≥ 0' },
  { id: 'int', label: 'entera ≥ 0' },
  { id: 'bin', label: 'binaria (0 o 1)' },
];

export interface IndexedSpec {
  sets: IndexSet[];
  params: Param[];
  vars: VarFamily[];
}

export type Rhs = { kind: 'param'; param: string } | { kind: 'value'; value: string };

/** Un término: signo · coeficiente · variable (con desfase opcional en el conjunto ordenado). */
export interface Term {
  sign: 1 | -1;
  /** Parámetro que multiplica a la variable (null = 1). */
  coef: string | null;
  var: string;
  /** Desfase en el conjunto ordenado de la variable: −1 = período anterior. */
  lag?: number;
}

export const term = (v: string, coef: string | null = null, sign: 1 | -1 = 1, lag?: number): Term =>
  lag ? { sign, coef, var: v, lag } : { sign, coef, var: v };

export interface IndexedConstraint {
  key: string;
  name: string;
  /** Conjuntos sobre los que se repite la restricción ("para cada"). */
  forall: string[];
  terms: Term[];
  op: Op;
  rhs: Rhs;
}

export interface IndexedDraft {
  sense: Sense;
  objective: { terms: Term[] };
  constraints: IndexedConstraint[];
  /** Tipo de cada familia de variables (por defecto continua). */
  varTypes?: Record<string, VarType>;
  /**
   * Cortes agregados "a demanda" (p. ej. eliminación de subtours): restricciones planas que se
   * suman al modelo expandido.
   */
  cuts?: Constraint[];
}

export const varType = (d: IndexedDraft, famId: string): VarType => d.varTypes?.[famId] ?? 'cont';

export type Assignment = Record<string, string>; // setId → itemId

export const getSet = (spec: IndexedSpec, id: string) => spec.sets.find((s) => s.id === id)!;
export const getParam = (spec: IndexedSpec, id: string) => spec.params.find((p) => p.id === id)!;
export const getVar = (spec: IndexedSpec, id: string) => spec.vars.find((v) => v.id === id)!;

/** Conjunto ordenado de una familia de variables (si tiene). */
export const orderedSetOf = (spec: IndexedSpec, fam: VarFamily) =>
  fam.over.map((s) => getSet(spec, s)).find((s) => s.ordered);

/** Todas las asignaciones posibles de ítems para una lista de conjuntos (producto cartesiano). */
export function assignments(spec: IndexedSpec, setIds: string[]): Assignment[] {
  let out: Assignment[] = [{}];
  for (const sid of setIds) {
    const set = getSet(spec, sid);
    out = out.flatMap((a) => set.items.map((it) => ({ ...a, [sid]: it.id })));
  }
  return out;
}

export const paramKey = (over: string[], a: Assignment) => over.map((s) => a[s]).join('|');

export function paramValue(spec: IndexedSpec, paramId: string, a: Assignment): number {
  const p = getParam(spec, paramId);
  return p.values[paramKey(p.over, a)] ?? 0;
}

export function varId(fam: VarFamily, a: Assignment): string {
  return lpName([fam.id, ...fam.over.map((s) => a[s])].join('_'));
}

/** Variables planas de todas las familias, con su asignación de índices. */
export function flatVars(spec: IndexedSpec) {
  return spec.vars.flatMap((fam) =>
    assignments(spec, fam.over)
      .filter((a) => validFor(fam, a))
      .map((a) => ({ id: varId(fam, a), fam, a })),
  );
}

/**
 * Aplica el desfase de un término a una asignación. Devuelve null si cae fuera del horizonte
 * (p. ej. s_{t-1} en el primer período): ese término vale 0 (stock inicial nulo).
 */
function shift(spec: IndexedSpec, t: Term, a: Assignment): Assignment | null {
  if (!t.lag) return a;
  const set = orderedSetOf(spec, getVar(spec, t.var));
  if (!set) return a;
  const pos = set.items.findIndex((it) => it.id === a[set.id]) + t.lag;
  if (pos < 0 || pos >= set.items.length) return null;
  return { ...a, [set.id]: set.items[pos].id };
}

const isSubset = (a: string[], b: string[]) => a.every((x) => b.includes(x));

/** Errores de coherencia de índices de una familia de restricciones (vacío si está bien). */
export function validateConstraint(spec: IndexedSpec, c: IndexedConstraint): string[] {
  const errs: string[] = [];
  const idx = (ids: string[]) => ids.map((s) => getSet(spec, s).index).join(', ');
  if (c.terms.length === 0) errs.push('La restricción no tiene términos.');

  const used = new Set(c.terms.flatMap((t) => getVar(spec, t.var).over));
  const unused = c.forall.filter((s) => !used.has(s));
  if (unused.length)
    errs.push(`Se repite "para cada" ${idx(unused)}, pero ninguna variable depende de ${idx(unused)}.`);

  for (const t of c.terms) {
    const fam = getVar(spec, t.var);
    if (t.coef && !isSubset(getParam(spec, t.coef).over, fam.over))
      errs.push(`El coeficiente ${getParam(spec, t.coef).symbol} tiene índices que ${fam.symbol} no tiene.`);
    if (t.lag) {
      const os = orderedSetOf(spec, fam);
      if (!os) errs.push(`${fam.symbol} no depende del tiempo: no se le puede aplicar un desfase.`);
      else if (!c.forall.includes(os.id))
        errs.push(`Para usar ${fam.symbol} con desfase, la restricción tiene que repetirse "para cada" ${os.index}.`);
    }
  }

  if (c.rhs.kind === 'param') {
    const p = getParam(spec, c.rhs.param);
    if (!isSubset(p.over, c.forall))
      errs.push(
        `El lado derecho ${p.symbol} depende de ${idx(p.over)}, pero la restricción no se repite "para cada" ${idx(p.over.filter((s) => !c.forall.includes(s)))}.`,
      );
  } else if (!Number.isFinite(Number(c.rhs.value.replace(',', '.'))) || c.rhs.value.trim() === '') {
    errs.push('El lado derecho no es un número válido.');
  }
  return errs;
}

export interface CompileResult {
  model: LPModel;
  /** Errores por restricción (clave → mensajes). */
  errors: Record<string, string[]>;
}

/** Suma las contribuciones de un término, dado el "para cada" fijado en `a`. */
function addTerm(spec: IndexedSpec, t: Term, forall: string[], a: Assignment, into: Record<string, number>) {
  const fam = getVar(spec, t.var);
  const sumOver = fam.over.filter((s) => !forall.includes(s));
  for (const b of assignments(spec, sumOver)) {
    const full = shift(spec, t, { ...a, ...b });
    if (!full || !validFor(fam, full)) continue;
    const id = varId(fam, full);
    const k = t.sign * (t.coef ? paramValue(spec, t.coef, full) : 1);
    into[id] = (into[id] ?? 0) + k;
  }
}

/** Expande el modelo indexado a un modelo plano. */
export function compileIndexed(spec: IndexedSpec, d: IndexedDraft): CompileResult {
  const variables = flatVars(spec).map(({ id, fam }) => {
    const t = varType(d, fam.id);
    return { id, integer: t !== 'cont', ub: t === 'bin' ? 1 : undefined };
  });

  const objective: Record<string, number> = {};
  for (const t of d.objective.terms) addTerm(spec, { ...t, lag: undefined }, [], {}, objective);

  const errors: Record<string, string[]> = {};
  const constraints: Constraint[] = [];
  d.constraints.forEach((c, ci) => {
    const errs = validateConstraint(spec, c);
    if (errs.length) {
      errors[c.key] = errs;
      return;
    }
    for (const a of assignments(spec, c.forall)) {
      const coefs: Record<string, number> = {};
      for (const t of c.terms) addTerm(spec, t, c.forall, a, coefs);
      const rhs =
        c.rhs.kind === 'param' ? paramValue(spec, c.rhs.param, a) : Number(c.rhs.value.replace(',', '.'));
      const where = c.forall.map((s) => getSet(spec, s).items.find((it) => it.id === a[s])!.label).join(', ');
      constraints.push({
        id: lpName(['k' + (ci + 1), ...c.forall.map((s) => a[s])].join('_')),
        name: where ? `${c.name || `Restricción ${ci + 1}`}: ${where}` : c.name || `Restricción ${ci + 1}`,
        coefs,
        op: c.op,
        rhs,
      });
    }
  });

  constraints.push(...(d.cuts ?? []));
  return { model: { sense: d.sense, objective, variables, constraints }, errors };
}

/* ---------- Notación matemática ---------- */

const sub = (spec: IndexedSpec, over: string[], lag?: number) => {
  if (!over.length) return '';
  const parts = over.map((s) => {
    const set = getSet(spec, s);
    return lag && set.ordered ? `${set.index}${lag < 0 ? '' : '+'}${lag}` : set.index;
  });
  return `_{${parts.join(lag ? ',' : '')}}`;
};

export function paramTex(spec: IndexedSpec, id: string): string {
  const p = getParam(spec, id);
  return `${p.symbol}${sub(spec, p.over)}`;
}

export function varTex(spec: IndexedSpec, id: string, lag?: number): string {
  const v = getVar(spec, id);
  return `${v.symbol}${sub(spec, v.over, lag)}`;
}

const sums = (spec: IndexedSpec, over: string[]) =>
  over.map((s) => `\\sum_{${getSet(spec, s).index} \\in ${s}}`).join(' ');

export const forallTex = (spec: IndexedSpec, over: string[]) =>
  over.length ? `\\forall\\, ${over.map((s) => `${getSet(spec, s).index} \\in ${s}`).join(',\\ ')}` : '';

const OPTEX: Record<Op, string> = { '<=': '\\leq', '>=': '\\geq', '=': '=' };

/** Suma de términos en notación matemática (las sumatorias salen del "para cada"). */
export function termsTex(spec: IndexedSpec, terms: Term[], forall: string[]): string {
  if (!terms.length) return '0';
  return terms
    .map((t, i) => {
      const fam = getVar(spec, t.var);
      const sumOver = fam.over.filter((s) => !forall.includes(s));
      const coef = t.coef ? paramTex(spec, t.coef) + '\\,' : '';
      const body = `${sums(spec, sumOver)} ${coef}${varTex(spec, fam.id, t.lag)}`.trim();
      const sign = t.sign < 0 ? '-' : i > 0 ? '+' : '';
      return `${sign} ${body}`;
    })
    .join(' ');
}

export function objectiveTex(spec: IndexedSpec, d: IndexedDraft): string {
  return `\\${d.sense} \\; ${termsTex(spec, d.objective.terms, [])}`;
}

/** Lado izquierdo y derecho de una familia de restricciones, sin el "para cada". */
export function constraintTex(spec: IndexedSpec, c: IndexedConstraint): string {
  const rhs = c.rhs.kind === 'param' ? paramTex(spec, c.rhs.param) : c.rhs.value || '?';
  return `${termsTex(spec, c.terms, c.forall)} ${OPTEX[c.op]} ${rhs}`;
}

/** Dominio de una familia de variables en notación matemática. */
export function domainTex(spec: IndexedSpec, d: IndexedDraft, famId: string): string {
  const t = varType(d, famId);
  const dom = t === 'bin' ? '\\in \\{0,1\\}' : t === 'int' ? '\\in \\mathbb{Z}_{\\geq 0}' : '\\geq 0';
  return `${varTex(spec, famId)} ${dom}`;
}
