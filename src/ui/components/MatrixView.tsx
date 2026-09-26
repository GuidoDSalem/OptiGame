import { getParam, getSet, getVar, paramValue, varId } from '../../engine/indexed';
import type { IndexedLevel } from '../../levels/types';

interface Props {
  indexed: IndexedLevel;
  values: Record<string, number>;
  /** Si está, las celdas son editables. */
  onChange?(values: Record<string, number>): void;
  /** Muestra totales por fila/columna contra sus parámetros (oferta, demanda…). */
  totals?: boolean;
  format?(n: number): string;
}

const fmtDefault = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Variables de dos índices como matriz: filas = un conjunto, columnas = el otro. */
export function MatrixView({ indexed, values, onChange, totals = true, format = fmtDefault }: Props) {
  const { spec, matrix } = indexed;
  const fam = getVar(spec, matrix.var);
  const rows = getSet(spec, matrix.rows);
  const cols = getSet(spec, matrix.cols);
  const id = (r: string, c: string) => varId(fam, { [matrix.rows]: r, [matrix.cols]: c });
  const val = (r: string, c: string) => values[id(r, c)] ?? 0;
  const rowParam = matrix.rowParam ? getParam(spec, matrix.rowParam) : null;
  const colParam = matrix.colParam ? getParam(spec, matrix.colParam) : null;

  return (
    <table className="matrix">
      <thead>
        <tr>
          <th />
          {cols.items.map((c) => (
            <th key={c.id}>{c.label}</th>
          ))}
          {totals && <th className="tot">Total{rowParam ? ` / ${rowParam.name.split(' ')[0].toLowerCase()}` : ''}</th>}
        </tr>
      </thead>
      <tbody>
        {rows.items.map((r) => {
          const sum = cols.items.reduce((s, c) => s + val(r.id, c.id), 0);
          return (
            <tr key={r.id}>
              <th>{r.label}</th>
              {cols.items.map((c) => (
                <td key={c.id} className={val(r.id, c.id) > 0 ? 'nz' : ''}>
                  {onChange ? (
                    <input
                      className="num-in"
                      inputMode="numeric"
                      value={val(r.id, c.id) || ''}
                      placeholder="0"
                      onChange={(e) => {
                        const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                        onChange({ ...values, [id(r.id, c.id)]: n });
                      }}
                    />
                  ) : (
                    format(val(r.id, c.id))
                  )}
                </td>
              ))}
              {totals && (
                <td className="tot">
                  {format(sum)}
                  {rowParam && <span className="muted"> / {paramValue(spec, rowParam.id, { [matrix.rows]: r.id })}</span>}
                </td>
              )}
            </tr>
          );
        })}
        {totals && (
          <tr className="tot">
            <th>Total{colParam ? ` / ${colParam.name.split(' ')[0].toLowerCase()}` : ''}</th>
            {cols.items.map((c) => {
              const sum = rows.items.reduce((s, r) => s + val(r.id, c.id), 0);
              return (
                <td key={c.id}>
                  {format(sum)}
                  {colParam && <span className="muted"> / {paramValue(spec, colParam.id, { [matrix.cols]: c.id })}</span>}
                </td>
              );
            })}
            <td />
          </tr>
        )}
      </tbody>
    </table>
  );
}
