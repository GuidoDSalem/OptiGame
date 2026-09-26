import type { Constraint, LPModel, Op, Sense } from '../../engine/model';

/**
 * Estado editable del modelador. Los números se guardan como texto para poder tipear
 * "-", "0," etc. sin que el input salte.
 */
export interface DraftRow {
  key: string;
  name: string;
  coefs: Record<string, string>;
  op: Op;
  rhs: string;
}

export interface Draft {
  sense: Sense;
  objective: Record<string, string>;
  rows: DraftRow[];
}

let seq = 0;
export const newKey = () => `r${++seq}`;

export function draftFromModel(m: LPModel): Draft {
  const s = (n: number | undefined) => (n === undefined || n === 0 ? '' : String(n));
  return {
    sense: m.sense,
    objective: Object.fromEntries(m.variables.map((v) => [v.id, s(m.objective[v.id])])),
    rows: m.constraints.map((c) => ({
      key: newKey(),
      name: c.name,
      coefs: Object.fromEntries(m.variables.map((v) => [v.id, s(c.coefs[v.id])])),
      op: c.op,
      rhs: String(c.rhs),
    })),
  };
}

export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface DraftParse {
  model: LPModel;
  /** Campos inválidos, como "fila:variable". */
  invalid: Set<string>;
}

export function modelFromDraft(d: Draft, base: LPModel): DraftParse {
  const invalid = new Set<string>();
  const num = (s: string, key: string) => {
    const n = parseNum(s);
    if (n === null) invalid.add(key);
    return n ?? 0;
  };
  const objective = Object.fromEntries(
    Object.entries(d.objective).map(([v, s]) => [v, num(s, `obj:${v}`)]),
  );
  const constraints: Constraint[] = d.rows.map((r, i) => ({
    id: `c${i + 1}`,
    name: r.name.trim() || `Restricción ${i + 1}`,
    coefs: Object.fromEntries(Object.entries(r.coefs).map(([v, s]) => [v, num(s, `${r.key}:${v}`)])),
    op: r.op,
    rhs: num(r.rhs, `${r.key}:rhs`),
  }));
  return { model: { sense: d.sense, objective, variables: base.variables, constraints }, invalid };
}
