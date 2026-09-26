import loadHighs from 'highs';
import { lpName, toLpFormat, type LPModel } from './model';

export type SolveStatus = 'optimal' | 'infeasible' | 'unbounded' | 'error';

export interface RowResult {
  id: string;
  name: string;
  activity: number;
  /** Precio sombra (sólo en LP continuos). */
  dual?: number;
}

export interface SolveResult {
  status: SolveStatus;
  /** Estado tal cual lo reporta HiGHS. */
  rawStatus: string;
  objective?: number;
  values: Record<string, number>;
  rows: RowResult[];
  lp: string;
  error?: string;
}

type Highs = Awaited<ReturnType<typeof loadHighs>>;
let highsPromise: Promise<Highs> | null = null;

/**
 * Carga HiGHS (WebAssembly) una sola vez. En el navegador hay que decirle dónde está el .wasm;
 * en Node (tests) lo encuentra solo.
 */
function getHighs(): Promise<Highs> {
  if (!highsPromise) {
    highsPromise = (async () => {
      if (typeof window === 'undefined') return loadHighs();
      const { default: wasmUrl } = await import('highs/runtime?url');
      return loadHighs({ locateFile: () => wasmUrl });
    })();
  }
  return highsPromise;
}

export async function solve(model: LPModel): Promise<SolveResult> {
  const lp = toLpFormat(model);
  let highs: Highs;
  try {
    highs = await getHighs();
  } catch (e) {
    return { status: 'error', rawStatus: 'Load error', values: {}, rows: [], lp, error: String(e) };
  }

  let res: ReturnType<Highs['solve']>;
  try {
    res = highs.solve(lp, { output_flag: false });
  } catch (e) {
    // Un solver de una sola llamada puede quedar en mal estado tras un error: lo recargamos.
    highsPromise = null;
    return { status: 'error', rawStatus: 'Solve error', values: {}, rows: [], lp, error: String(e) };
  }

  const raw = res.Status as string;
  const status: SolveStatus =
    raw === 'Optimal'
      ? 'optimal'
      : raw === 'Infeasible'
        ? 'infeasible'
        : raw === 'Unbounded' || raw === 'Primal infeasible or unbounded'
          ? 'unbounded'
          : 'error';

  if (status !== 'optimal') return { status, rawStatus: raw, values: {}, rows: [], lp };

  const values: Record<string, number> = {};
  for (const v of model.variables) {
    const col = (res.Columns as Record<string, { Primal?: number }>)[lpName(v.id)];
    values[v.id] = clean(col?.Primal ?? 0);
  }
  const rows: RowResult[] = model.constraints.map((c, i) => {
    const r = res.Rows[i] as { Primal?: number; Dual?: number } | undefined;
    return {
      id: c.id,
      name: c.name,
      activity: clean(r?.Primal ?? 0),
      dual: r?.Dual === undefined ? undefined : clean(r.Dual),
    };
  });
  return { status, rawStatus: raw, objective: clean(res.ObjectiveValue), values, rows, lp };
}

/** Evita mostrar cosas como -0 o 23.999999999. */
function clean(n: number): number {
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}
