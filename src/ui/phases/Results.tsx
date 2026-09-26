import { FEATURES } from '../../config';
import { LevelScene } from '../../scene/LevelScene';
import type { Diagnosis } from '../../engine/diagnose';
import type { LPModel } from '../../engine/model';
import { stars } from '../../engine/score';
import type { SolveResult } from '../../engine/solver';
import type { Level } from '../../levels/types';
import { Checks, Stars } from '../components/Checks';
import { FeasiblePlot } from '../components/FeasiblePlot';
import { MatrixView } from '../components/MatrixView';
import { Rich } from '../components/Rich';
import { Tex } from '../components/Tex';

interface Props {
  level: Level;
  model: LPModel;
  result: SolveResult;
  diagnosis: Diagnosis;
  optimum?: number;
  manualBest?: number;
  onBack(): void;
  /** Carga el modelo de referencia en el modelador (provisorio, ver FEATURES). */
  onShowSolution(): void;
}

const money = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

export function Results({ level, model, result, diagnosis, optimum, manualBest, onBack, onShowSolution }: Props) {
  const ev = diagnosis.evaluation;
  const n = ev ? stars(ev, optimum) : 0;
  const plot = level.plot;
  const u = level.objective.unit;
  const isMin = level.objective.sense === 'min';
  // Cuánto mejoró el solver respecto del mejor intento manual (positivo = mejor).
  const improvement = ev && manualBest !== undefined ? (isMin ? manualBest - ev.objective : ev.objective - manualBest) : 0;

  return (
    <div className="two-col">
      <div>
        <div className={`verdict v-${diagnosis.verdict}`}>
          <h3>
            {diagnosis.title} <Stars n={n} />
          </h3>
          {diagnosis.messages.map((m, i) => (
            <p key={i}>
              <Rich text={m} />
            </p>
          ))}
        </div>

        {result.status === 'optimal' && ev && (
          <>
            <h4>Decisión del solver</h4>
            {level.indexed && <MatrixView indexed={level.indexed} values={result.values} format={money} />}
            <table className="data">
              <tbody>
                {!level.indexed &&
                  level.variables.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Tex tex={v.symbol} /> {v.label}
                    </td>
                    <td className="r">
                      {money(result.values[v.id] ?? 0)} {v.unit}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>{level.objective.label} real</td>
                  <td className="r">
                    <strong>
                      {u}
                      {money(ev.objective)}
                    </strong>
                  </td>
                </tr>
                {manualBest !== undefined && (
                  <tr>
                    <td>Tu intento a mano</td>
                    <td className="r">
                      {u}
                      {money(manualBest)}
                    </td>
                  </tr>
                )}
                {diagnosis.verdict === 'perfect' && improvement > 1e-6 && (
                  <tr>
                    <td>Mejora vs. intuición</td>
                    <td className="r">
                      {u}
                      {money(improvement)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <h4>En el mundo real</h4>
            <Checks evaluation={ev} showFailures={false} />

            {result.rows.length > 0 && (
              <>
                <h4>Análisis de sensibilidad</h4>
                <p className="muted">
                  Una restricción <strong>activa</strong> es la que "aprieta" (holgura 0). Su <strong>precio sombra</strong>{' '}
                  indica cuánto cambia el objetivo si su lado derecho sube una unidad.
                </p>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Restricción</th>
                      <th className="r">Valor</th>
                      <th className="r">Límite</th>
                      <th className="r">Holgura</th>
                      <th className="r">Precio sombra</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r, i) => {
                      const c = model.constraints[i];
                      const slack = Math.abs(c.rhs - r.activity);
                      return (
                        <tr key={r.id} className={slack < 1e-6 ? 'active' : ''}>
                          <td>{r.name}</td>
                          <td className="r">{money(r.activity)}</td>
                          <td className="r">
                            {c.op === '<=' ? '≤' : c.op === '>=' ? '≥' : '='} {c.rhs}
                          </td>
                          <td className="r">{slack < 1e-6 ? 'activa' : money(slack)}</td>
                          <td className="r">{r.dual === undefined ? '—' : money(r.dual)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            )}

            {Object.keys(result.reducedCosts).length > 0 && level.indexed && (
              <>
                <p className="muted">
                  <strong>Costos reducidos</strong> de cada ruta: cuánto aumentaría el costo por cada camión que
                  mandes por una ruta que el solver dejó sin usar.
                </p>
                <MatrixView indexed={level.indexed} values={result.reducedCosts} totals={false} format={money} />
              </>
            )}

            {Object.keys(result.reducedCosts).length > 0 && !level.indexed && (
              <>
                <p className="muted">
                  El <strong>costo reducido</strong> de una variable que quedó en 0 indica cuánto empeoraría el
                  objetivo por cada unidad que la fuerces a usar.
                </p>
                <table className="data">
                  <thead>
                    <tr>
                      <th>Variable</th>
                      <th className="r">Valor</th>
                      <th className="r">Costo reducido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {level.variables.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <Tex tex={v.symbol} /> {v.label}
                        </td>
                        <td className="r">{money(result.values[v.id] ?? 0)}</td>
                        <td className="r">{money(result.reducedCosts[v.id] ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        <div className="actions">
          <button onClick={onBack}>← Volver al modelo</button>
          {FEATURES.showSolutionButton && (
            <button onClick={onShowSolution} title="Función provisoria">
              Ver modelo correcto
            </button>
          )}
        </div>
      </div>

      <div className="sticky">
        {ev && <LevelScene level={level} values={result.values} evaluation={ev} />}
        {plot && result.status === 'optimal' && (
          <FeasiblePlot
            model={model}
            x={plot.x}
            y={plot.y}
            xmax={plot.xmax}
            ymax={plot.ymax}
            xLabel={level.variables.find((v) => v.id === plot.x)?.label ?? plot.x}
            yLabel={level.variables.find((v) => v.id === plot.y)?.label ?? plot.y}
            point={result.values}
            pointLabel="óptimo de tu modelo"
            isoValue={result.objective}
            size={300}
          />
        )}
        {plot && result.status === 'optimal' && (
          <p className="caption">Región factible según tu modelo (no según la realidad).</p>
        )}
      </div>
    </div>
  );
}
