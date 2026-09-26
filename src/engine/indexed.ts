/**
 * Modelos con índices (estilo AMPL/Pyomo): conjuntos, parámetros indexados y familias de
 * variables y restricciones. Se "expanden" a un LPModel plano que entiende el solver.
 */
import { lpName, type Constraint, type LPModel, type Op, type Sense } from './model';

export interface IndexSet {
  id: string; // "I"
  name: string; // "Plantas"
  index: string; // "i"
  items: { id: string; label: string; short: string }[];
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
  integer?: boolean;
}

export interface IndexedSpec {
  sets: IndexSet[];
  params: Param[];
  vars: VarFamily[];
}

export type Rhs = { kind: 'param'; param: string } | { kind: 'value'; value: string };

export interface IndexedConstraint {
  key: string;
  name: string;
  /** Conjuntos sobre los que se repite la restricción ("para cada"). */
  forall: string[];
  /** Parámetro que multiplica a la variable dentro de la suma (null = 1). */
  coef: string | null;
  var: string;
  op: Op;
  rhs: Rhs;
}

export interface IndexedDraft {
  sense: Sense;
  objective: { coef: string | null; var: string };
  constraints: IndexedConstraint[];
}

export type Assignment = Record<string, string>; // setId → itemId

export const getSet = (spec: IndexedSpec, id: string) => spec.sets.find((s) => s.id === id)!;
export const getParam = (spec: IndexedSpec, id: string) => spec.params.find((p) => p.id === id)!;
export const getVar = (spec: IndexedSpec, id: string) => spec.vars.find((v) => v.id === id)!;

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
    assignments(spec, fam.over).map((a) => ({ id: varId(fam, a), fam, a })),
  );
}

const isSubset = (a: string[], b: string[]) => a.every((x) => b.includes(x));

/** Errores de coherencia de índices de una familia de restricciones (vacío si está bien). */
export function validateConstraint(spec: IndexedSpec, c: IndexedConstraint): string[] {
  const errs: string[] = [];
  const fam = getVar(spec, c.var);
  const idx = (ids: string[]) => ids.map((s) => getSet(spec, s).index).join(', ');
  if (!isSubset(c.forall, fam.over)) errs.push(`"para cada" usa índices que ${fam.symbol} no tiene.`);
  if (c.coef && !isSubset(getParam(spec, c.coef).over, fam.over))
    errs.push(`El coeficiente ${getParam(spec, c.coef).symbol} tiene índices que ${fam.symbol} no tiene.`);
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

/** Expande el modelo indexado a un modelo plano. */
export function compileIndexed(spec: IndexedSpec, d: IndexedDraft): CompileResult {
  const variables = flatVars(spec).map(({ id, fam }) => ({ id, integer: fam.integer }));

  const objective: Record<string, number> = {};
  const ofam = getVar(spec, d.objective.var);
  for (const a of assignments(spec, ofam.over)) {
    objective[varId(ofam, a)] = d.objective.coef ? paramValue(spec, d.objective.coef, a) : 1;
  }

  const errors: Record<string, string[]> = {};
  const constraints: Constraint[] = [];
  d.constraints.forEach((c, ci) => {
    const errs = validateConstraint(spec, c);
    if (errs.length) {
      errors[c.key] = errs;
      return;
    }
    const fam = getVar(spec, c.var);
    const sumOver = fam.over.filter((s) => !c.forall.includes(s));
    for (const a of assignments(spec, c.forall)) {
      const coefs: Record<string, number> = {};
      for (const b of assignments(spec, sumOver)) {
        const full = { ...a, ...b };
        coefs[varId(fam, full)] = c.coef ? paramValue(spec, c.coef, full) : 1;
      }
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

  return { model: { sense: d.sense, objective, variables, constraints }, errors };
}

/* ---------- Notación matemática ---------- */

const sub = (spec: IndexedSpec, over: string[]) =>
  over.length ? `_{${over.map((s) => getSet(spec, s).index).join('')}}` : '';

export function paramTex(spec: IndexedSpec, id: string): string {
  const p = getParam(spec, id);
  return `${p.symbol}${sub(spec, p.over)}`;
}

export function varTex(spec: IndexedSpec, id: string): string {
  const v = getVar(spec, id);
  return `${v.symbol}${sub(spec, v.over)}`;
}

const sums = (spec: IndexedSpec, over: string[]) =>
  over.map((s) => `\\sum_{${getSet(spec, s).index} \\in ${s}}`).join(' ');

export const forallTex = (spec: IndexedSpec, over: string[]) =>
  over.length ? `\\forall\\, ${over.map((s) => `${getSet(spec, s).index} \\in ${s}`).join(',\\ ')}` : '';

const OPTEX: Record<Op, string> = { '<=': '\\leq', '>=': '\\geq', '=': '=' };

export function objectiveTex(spec: IndexedSpec, d: IndexedDraft): string {
  const fam = getVar(spec, d.objective.var);
  const coef = d.objective.coef ? paramTex(spec, d.objective.coef) + '\\,' : '';
  return `\\${d.sense} \\; ${sums(spec, fam.over)} ${coef}${varTex(spec, fam.id)}`;
}

/** Lado izquierdo y derecho de una familia de restricciones, sin el "para cada". */
export function constraintTex(spec: IndexedSpec, c: IndexedConstraint): string {
  const fam = getVar(spec, c.var);
  const sumOver = fam.over.filter((s) => !c.forall.includes(s));
  const coef = c.coef ? paramTex(spec, c.coef) + '\\,' : '';
  const rhs = c.rhs.kind === 'param' ? paramTex(spec, c.rhs.param) : c.rhs.value || '?';
  return `${sums(spec, sumOver)} ${coef}${varTex(spec, fam.id)} ${OPTEX[c.op]} ${rhs}`;
}
