import type { Level } from '../../levels/types';
import { LevelScene } from '../../scene/LevelScene';
import { Checks } from '../components/Checks';
import { DecisionTable } from '../components/DecisionTable';
import { Tex } from '../components/Tex';

interface Props {
  level: Level;
  values: Record<string, number>;
  onChange(v: Record<string, number>): void;
  onNext(): void;
}

export function Manual({ level, values, onChange, onNext }: Props) {
  const ev = level.evaluate(values);
  return (
    <div className="two-col">
      <div>
        <p className="lead">
          {level.manualComponent ? 'Armá tu propia solución' : level.indexed ? 'Completá la tabla' : 'Mové los controles'}{' '}
          y buscá la mejor decisión que cumpla todas las reglas. Sin fórmulas: pura intuición.
        </p>
        {level.manualComponent && <level.manualComponent values={values} onChange={onChange} />}
        {!level.manualComponent && level.indexed && (
          <DecisionTable indexed={level.indexed} values={values} onChange={onChange} />
        )}
        {!level.manualComponent && !level.indexed &&
          level.variables.map((v) => (
          <label key={v.id} className="slider">
            <span>
              <Tex tex={v.symbol} /> {v.label}
            </span>
            <input
              type="range"
              min={v.min}
              max={v.max}
              step={v.step}
              value={values[v.id] ?? 0}
              onChange={(e) => onChange({ ...values, [v.id]: Number(e.target.value) })}
            />
            <span className="num">
              {values[v.id] ?? 0} {v.unit}
            </span>
          </label>
        ))}
        <div className={`objective-box ${ev.feasible ? 'ok' : 'fail'}`}>
          <span>{level.objective.label}</span>
          <strong>
            {level.objective.unit}
            {ev.objective.toLocaleString('es-AR')}
          </strong>
          <span className="tag">{ev.feasible ? 'cumple todo' : 'no cumple'}</span>
        </div>
        <Checks evaluation={ev} />
        <button className="primary" onClick={onNext}>
          ¿Se puede mejor? Ver la teoría →
        </button>
      </div>
      <div className="sticky">
        <LevelScene level={level} values={values} evaluation={ev} />
      </div>
    </div>
  );
}
