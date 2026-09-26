import type { LPModel } from '../../engine/model';
import { Tex } from './Tex';

function expr(coefs: Record<string, number>, sym: Record<string, string>): string {
  const parts: string[] = [];
  for (const [v, c] of Object.entries(coefs)) {
    if (!c) continue;
    const abs = Math.abs(c);
    const t = `${abs === 1 ? '' : abs}\\,${sym[v] ?? v}`;
    parts.push(parts.length === 0 ? (c < 0 ? `-${t}` : t) : `${c < 0 ? '-' : '+'} ${t}`);
  }
  return parts.length ? parts.join(' ') : '0';
}

const OP: Record<string, string> = { '<=': '\\leq', '>=': '\\geq', '=': '=' };

/** Muestra el modelo del jugador en notación matemática. */
export function ModelTex({ model, symbols }: { model: LPModel; symbols: Record<string, string> }) {
  const vars = model.variables.map((v) => symbols[v.id] ?? v.id).join(',\\,');
  const rows = model.constraints.map(
    (c) => `& ${expr(c.coefs, symbols)} ${OP[c.op]} ${c.rhs} && \\text{(${c.name.replace(/[{}\\$&%#_^~]/g, '')})}`,
  );
  const tex = [
    '\\begin{aligned}',
    `\\${model.sense} \\quad & ${expr(model.objective, symbols)} \\\\`,
    `\\text{s.a.} \\quad ${rows.length ? rows.join(' \\\\ ') : '& \\text{(sin restricciones)}'} \\\\`,
    `& ${vars} \\geq 0`,
    '\\end{aligned}',
  ].join('\n');
  return <Tex tex={tex} block />;
}
