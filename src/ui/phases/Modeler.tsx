import { useMemo, useState } from 'react';
import type { Op } from '../../engine/model';
import { toLpFormat } from '../../engine/model';
import type { Level } from '../../levels/types';
import { ModelTex } from '../components/ModelTex';
import { Rich } from '../components/Rich';
import { Tex } from '../components/Tex';
import { modelFromDraft, newKey, type Draft } from './draft';

interface Props {
  level: Level;
  draft: Draft;
  onChange(d: Draft): void;
  onSolve(): void;
  solving: boolean;
}

export function Modeler({ level, draft, onChange, onSolve, solving }: Props) {
  const [hints, setHints] = useState(0);
  const [showLp, setShowLp] = useState(false);
  const { model, invalid } = useMemo(() => modelFromDraft(draft, level.starterModel), [draft, level]);
  const symbols = Object.fromEntries(level.variables.map((v) => [v.id, v.symbol]));

  const setRow = (key: string, patch: Partial<Draft['rows'][number]>) =>
    onChange({ ...draft, rows: draft.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) });

  const addRow = () =>
    onChange({
      ...draft,
      rows: [
        ...draft.rows,
        { key: newKey(), name: '', coefs: Object.fromEntries(level.variables.map((v) => [v.id, ''])), op: '<=', rhs: '' },
      ],
    });

  const numInput = (value: string, key: string, set: (s: string) => void) => (
    <input
      className={`num-in ${invalid.has(key) ? 'bad' : ''}`}
      inputMode="decimal"
      placeholder="0"
      value={value}
      onChange={(e) => set(e.target.value)}
    />
  );

  return (
    <div className="two-col">
      <div>
        <p className="lead">
          Traducí el problema a un modelo. Variables:{' '}
          {level.variables.map((v, i) => (
            <span key={v.id}>
              {i > 0 && ', '}
              <Tex tex={v.symbol} /> = {v.label.toLowerCase()} ({v.unit})
            </span>
          ))}
          . Todas <Tex tex="\geq 0" />.
        </p>

        <h4>Función objetivo</h4>
        <div className="row-edit">
          <select value={draft.sense} onChange={(e) => onChange({ ...draft, sense: e.target.value as Draft['sense'] })}>
            <option value="min">min</option>
            <option value="max">max</option>
          </select>
          {level.variables.map((v, i) => (
            <span key={v.id} className="term">
              {i > 0 && <span className="plus">+</span>}
              {numInput(draft.objective[v.id] ?? '', `obj:${v.id}`, (s) =>
                onChange({ ...draft, objective: { ...draft.objective, [v.id]: s } }),
              )}
              <Tex tex={v.symbol} />
            </span>
          ))}
        </div>

        <h4>Restricciones</h4>
        {draft.rows.length === 0 && <p className="muted">Todavía no agregaste restricciones.</p>}
        {draft.rows.map((r) => (
          <div key={r.key} className="row-edit">
            <input
              className="name-in"
              placeholder="Nombre"
              value={r.name}
              onChange={(e) => setRow(r.key, { name: e.target.value })}
            />
            {level.variables.map((v, i) => (
              <span key={v.id} className="term">
                {i > 0 && <span className="plus">+</span>}
                {numInput(r.coefs[v.id] ?? '', `${r.key}:${v.id}`, (s) =>
                  setRow(r.key, { coefs: { ...r.coefs, [v.id]: s } }),
                )}
                <Tex tex={v.symbol} />
              </span>
            ))}
            <select value={r.op} onChange={(e) => setRow(r.key, { op: e.target.value as Op })}>
              <option value="<=">≤</option>
              <option value=">=">≥</option>
              <option value="=">=</option>
            </select>
            {numInput(r.rhs, `${r.key}:rhs`, (s) => setRow(r.key, { rhs: s }))}
            <button
              className="icon"
              title="Quitar"
              onClick={() => onChange({ ...draft, rows: draft.rows.filter((x) => x.key !== r.key) })}
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={addRow}>+ Agregar restricción</button>

        <div className="actions">
          <button className="primary" disabled={invalid.size > 0 || solving} onClick={onSolve}>
            {solving ? 'Resolviendo…' : 'Resolver con HiGHS'}
          </button>
          {hints < level.hints.length && <button onClick={() => setHints(hints + 1)}>Pedir pista</button>}
        </div>
        {invalid.size > 0 && <p className="error">Hay números inválidos (marcados en rojo).</p>}
        {level.hints.slice(0, hints).map((h, i) => (
          <p key={i} className="note">
            <strong>Pista {i + 1}.</strong> <Rich text={h} />
          </p>
        ))}
      </div>

      <div className="sticky">
        <h4>Tu modelo</h4>
        <ModelTex model={model} symbols={symbols} />
        <button className="link" onClick={() => setShowLp(!showLp)}>
          {showLp ? 'Ocultar' : 'Ver'} formato LP (lo que recibe el solver)
        </button>
        {showLp && <pre className="lp">{toLpFormat(model)}</pre>}
      </div>
    </div>
  );
}
