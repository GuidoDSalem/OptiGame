import { getParam, getSet, paramValue, varId } from '../../engine/indexed';
import type { IndexedLevel } from '../../levels/types';
import { MatrixView } from './MatrixView';
import { Tex } from './Tex';

interface Props {
  indexed: IndexedLevel;
  values: Record<string, number>;
  onChange?(values: Record<string, number>): void;
  totals?: boolean;
  format?(n: number): string;
  /** Mostrar las filas de parámetros de contexto (sólo en tablas por período). */
  showParams?: boolean;
}

const fmtDefault = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));

/** Tabla por períodos: una columna por período, una fila por parámetro de contexto y por variable. */
function PeriodTable({ indexed, values, onChange, format = fmtDefault, showParams = true }: Props) {
  const { spec } = indexed;
  const cfg = indexed.periodTable!;
  const periods = getSet(spec, cfg.set);
  const fams = spec.vars.filter((v) => v.over.length === 1 && v.over[0] === cfg.set);
  const params = showParams ? (cfg.params ?? []).map((id) => getParam(spec, id)) : [];

  return (
    <table className="matrix period">
      <thead>
        <tr>
          <th />
          {periods.items.map((p) => (
            <th key={p.id}>{p.short}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {params.map((p) => (
          <tr key={p.id} className="ctx">
            <th>
              <Tex tex={`${p.symbol}_${getSet(spec, cfg.set).index}`} /> {p.name.toLowerCase()}
            </th>
            {periods.items.map((it) => (
              <td key={it.id}>{format(paramValue(spec, p.id, { [cfg.set]: it.id }))}</td>
            ))}
          </tr>
        ))}
        {fams.map((f) => {
          const editable = onChange && f.id === cfg.manualVar;
          return (
            <tr key={f.id}>
              <th>
                <Tex tex={`${f.symbol}_${getSet(spec, cfg.set).index}`} /> {f.label.toLowerCase()}
              </th>
              {periods.items.map((it) => {
                const id = varId(f, { [cfg.set]: it.id });
                const v = values[id] ?? 0;
                return (
                  <td key={it.id} className={v > 1e-9 ? 'nz' : ''}>
                    {editable ? (
                      <input
                        className="num-in"
                        inputMode="numeric"
                        value={v || ''}
                        placeholder="0"
                        onChange={(e) => onChange({ ...values, [id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      />
                    ) : (
                      format(v)
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Decisión de un nivel con índices: tabla por período o matriz, según cómo esté definido. */
export function DecisionTable(props: Props) {
  if (props.indexed.periodTable) return <PeriodTable {...props} />;
  if (props.indexed.matrix) return <MatrixView {...props} />;
  return null;
}
