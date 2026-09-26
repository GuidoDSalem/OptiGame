/**
 * Representación de un modelo de programación lineal (entera) independiente del solver.
 * Es lo que construye el jugador en el modelador y lo que define cada nivel como referencia.
 */

export type Sense = 'min' | 'max';
export type Op = '<=' | '>=' | '=';

export interface VariableSpec {
  id: string;
  lb?: number; // por defecto 0
  ub?: number; // por defecto +∞
  integer?: boolean;
}

export interface Constraint {
  id: string;
  /** Nombre legible para el jugador, p. ej. "Demanda". */
  name: string;
  coefs: Record<string, number>;
  op: Op;
  rhs: number;
}

export interface LPModel {
  sense: Sense;
  objective: Record<string, number>;
  variables: VariableSpec[];
  constraints: Constraint[];
}

const EPS = 1e-6;

export function lhs(coefs: Record<string, number>, values: Record<string, number>): number {
  let s = 0;
  for (const [v, c] of Object.entries(coefs)) s += c * (values[v] ?? 0);
  return s;
}

export function isSatisfied(c: Constraint, values: Record<string, number>, eps = EPS): boolean {
  const a = lhs(c.coefs, values);
  if (c.op === '<=') return a <= c.rhs + eps;
  if (c.op === '>=') return a >= c.rhs - eps;
  return Math.abs(a - c.rhs) <= eps;
}

export function objectiveValue(model: LPModel, values: Record<string, number>): number {
  return lhs(model.objective, values);
}

/** Nombre seguro para el formato LP (letras, dígitos y _; no puede empezar con dígito). */
export function lpName(s: string): string {
  const clean = s.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[0-9]/.test(clean) ? `_${clean}` : clean || '_';
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toPrecision(12)));
}

function linExpr(coefs: Record<string, number>): string {
  const parts: string[] = [];
  for (const [v, c] of Object.entries(coefs)) {
    if (c === 0) continue;
    const sign = c < 0 ? '-' : '+';
    const abs = Math.abs(c);
    const term = `${abs === 1 ? '' : fmtNum(abs) + ' '}${lpName(v)}`;
    parts.push(parts.length === 0 ? (sign === '-' ? `- ${term}` : term) : `${sign} ${term}`);
  }
  return parts.length ? parts.join(' ') : '0';
}

/** Serializa el modelo en formato CPLEX LP (el que entiende HiGHS y casi cualquier solver). */
export function toLpFormat(model: LPModel): string {
  const lines: string[] = [];
  lines.push(model.sense === 'min' ? 'Minimize' : 'Maximize');
  const obj = linExpr(model.objective);
  // El formato LP no acepta un objetivo vacío: usamos 0 x para la primera variable.
  lines.push(` obj: ${obj === '0' && model.variables[0] ? `0 ${lpName(model.variables[0].id)}` : obj}`);
  lines.push('Subject To');
  model.constraints.forEach((c, i) => {
    const name = lpName(c.id || `c${i + 1}`);
    lines.push(` ${name}: ${linExpr(c.coefs)} ${c.op} ${fmtNum(c.rhs)}`);
  });
  lines.push('Bounds');
  for (const v of model.variables) {
    const lb = v.lb ?? 0;
    const ub = v.ub ?? Infinity;
    const lbs = lb === -Infinity ? '-inf' : fmtNum(lb);
    const ubs = ub === Infinity ? '+inf' : fmtNum(ub);
    lines.push(` ${lbs} <= ${lpName(v.id)} <= ${ubs}`);
  }
  const ints = model.variables.filter((v) => v.integer).map((v) => lpName(v.id));
  if (ints.length) {
    lines.push('Generals');
    lines.push(' ' + ints.join(' '));
  }
  lines.push('End');
  return lines.join('\n');
}
