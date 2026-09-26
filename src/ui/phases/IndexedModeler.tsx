import { useMemo, useState } from 'react';
import {
  compileIndexed,
  constraintTex,
  forallTex,
  getSet,
  getVar,
  objectiveTex,
  paramTex,
  varTex,
  type IndexedConstraint,
  type IndexedDraft,
} from '../../engine/indexed';
import { toLpFormat, type Op } from '../../engine/model';
import type { IndexedLevel, Level } from '../../levels/types';
import { ModelTex } from '../components/ModelTex';
import { Rich } from '../components/Rich';
import { Tex } from '../components/Tex';
import { newKey } from './draft';

interface Props {
  level: Level & { indexed: IndexedLevel };
  draft: IndexedDraft;
  onChange(d: IndexedDraft): void;
  onSolve(): void;
  solving: boolean;
  revealed?: boolean;
}

/** Todos los subconjuntos de una lista, del más chico al más grande. */
function subsets<T>(xs: T[]): T[][] {
  return xs.reduce<T[][]>((acc, x) => acc.concat(acc.map((s) => [...s, x])), [[]]).sort((a, b) => a.length - b.length);
}

export function IndexedModeler({ level, draft, onChange, onSolve, solving, revealed }: Props) {
  const { spec } = level.indexed;
  const [hints, setHints] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const { model, errors } = useMemo(() => compileIndexed(spec, draft), [spec, draft]);
  const hasErrors = Object.keys(errors).length > 0;
  const symbols = Object.fromEntries(level.variables.map((v) => [v.id, v.symbol]));

  const setRow = (key: string, patch: Partial<IndexedConstraint>) =>
    onChange({ ...draft, constraints: draft.constraints.map((c) => (c.key === key ? { ...c, ...patch } : c)) });

  const addRow = () =>
    onChange({
      ...draft,
      constraints: [
        ...draft.constraints,
        { key: newKey(), name: '', forall: [], coef: null, var: spec.vars[0].id, op: '<=', rhs: { kind: 'value', value: '' } },
      ],
    });

  const coefSelect = (value: string | null, set: (v: string | null) => void) => (
    <select value={value ?? ''} onChange={(e) => set(e.target.value || null)}>
      <option value="">1</option>
      {spec.params.map((p) => (
        <option key={p.id} value={p.id}>
          {p.symbol} · {p.name.toLowerCase()}
        </option>
      ))}
    </select>
  );

  return (
    <div className="two-col">
      <div>
        {revealed && (
          <p className="note">
            Este es el <strong>modelo correcto</strong>. Comparalo con el tuyo, resolvelo y mirá qué cambia.
          </p>
        )}
        <p className="lead">
          Modelá con índices: cada fila es una <strong>familia</strong> de restricciones que se repite "para cada"
          elemento de un conjunto.
        </p>

        <div className="glossary">
          {spec.sets.map((s) => (
            <span key={s.id}>
              <Tex tex={`${s.index} \\in ${s.id}`} /> {s.name.toLowerCase()}
            </span>
          ))}
          {spec.params.map((p) => (
            <span key={p.id}>
              <Tex tex={paramTex(spec, p.id)} /> {p.name.toLowerCase()}
            </span>
          ))}
          {spec.vars.map((v) => (
            <span key={v.id}>
              <Tex tex={varTex(spec, v.id)} /> {v.label.toLowerCase()}
            </span>
          ))}
        </div>

        <h4>Función objetivo</h4>
        <div className="irow">
          <select value={draft.sense} onChange={(e) => onChange({ ...draft, sense: e.target.value as IndexedDraft['sense'] })}>
            <option value="min">min</option>
            <option value="max">max</option>
          </select>
          <Tex tex={getVar(spec, draft.objective.var).over.map((s) => `\\sum_{${getSet(spec, s).index}}`).join(' ')} />
          {coefSelect(draft.objective.coef, (coef) => onChange({ ...draft, objective: { ...draft.objective, coef } }))}
          <Tex tex={varTex(spec, draft.objective.var)} />
        </div>

        <h4>Restricciones</h4>
        {draft.constraints.length === 0 && <p className="muted">Todavía no agregaste restricciones.</p>}
        {draft.constraints.map((c) => {
          const fam = getVar(spec, c.var);
          const sumOver = fam.over.filter((s) => !c.forall.includes(s));
          const errs = errors[c.key];
          return (
            <div key={c.key} className={`icard ${errs ? 'bad' : ''}`}>
              <div className="irow">
                <input
                  className="name-in"
                  placeholder="Nombre"
                  value={c.name}
                  onChange={(e) => setRow(c.key, { name: e.target.value })}
                />
                <select
                  value={c.forall.join(',')}
                  onChange={(e) => setRow(c.key, { forall: e.target.value ? e.target.value.split(',') : [] })}
                  title="Para cada"
                >
                  {subsets(fam.over).map((sub) => (
                    <option key={sub.join(',')} value={sub.join(',')}>
                      {sub.length === 0
                        ? 'una sola vez'
                        : 'para cada ' + sub.map((s) => `${getSet(spec, s).index} ∈ ${getSet(spec, s).name}`).join(', ')}
                    </option>
                  ))}
                </select>
                <button
                  className="icon"
                  title="Quitar"
                  onClick={() => onChange({ ...draft, constraints: draft.constraints.filter((x) => x.key !== c.key) })}
                >
                  ×
                </button>
              </div>
              <div className="irow">
                {sumOver.length > 0 && <Tex tex={sumOver.map((s) => `\\sum_{${getSet(spec, s).index}}`).join(' ')} />}
                {coefSelect(c.coef, (coef) => setRow(c.key, { coef }))}
                <Tex tex={varTex(spec, c.var)} />
                <select className="op" value={c.op} onChange={(e) => setRow(c.key, { op: e.target.value as Op })}>
                  <option value="<=">≤</option>
                  <option value=">=">≥</option>
                  <option value="=">=</option>
                </select>
                <select
                  value={c.rhs.kind === 'param' ? c.rhs.param : ''}
                  onChange={(e) =>
                    setRow(c.key, {
                      rhs: e.target.value ? { kind: 'param', param: e.target.value } : { kind: 'value', value: '' },
                    })
                  }
                >
                  <option value="">número</option>
                  {spec.params.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.symbol} · {p.name.toLowerCase()}
                    </option>
                  ))}
                </select>
                {c.rhs.kind === 'value' && (
                  <input
                    className="num-in"
                    inputMode="decimal"
                    placeholder="0"
                    value={c.rhs.value}
                    onChange={(e) => setRow(c.key, { rhs: { kind: 'value', value: e.target.value } })}
                  />
                )}
              </div>
              <div className="ipreview">
                <Tex tex={`${constraintTex(spec, c)} \\qquad ${forallTex(spec, c.forall)}`} />
              </div>
              {errs?.map((e, i) => (
                <p key={i} className="error small">
                  {e}
                </p>
              ))}
            </div>
          );
        })}
        <button onClick={addRow}>+ Agregar familia de restricciones</button>

        <div className="actions">
          <button className="primary" disabled={hasErrors || solving} onClick={onSolve}>
            {solving ? 'Resolviendo…' : 'Resolver con HiGHS'}
          </button>
          {hints < level.hints.length && <button onClick={() => setHints(hints + 1)}>Pedir pista</button>}
        </div>
        {level.hints.slice(0, hints).map((h, i) => (
          <p key={i} className="note">
            <strong>Pista {i + 1}.</strong> <Rich text={h} />
          </p>
        ))}
      </div>

      <div className="sticky">
        <h4>Tu modelo</h4>
        <Tex
          block
          tex={[
            '\\begin{aligned}',
            `& ${objectiveTex(spec, draft)} \\\\`,
            ...draft.constraints.map(
              (c) => `& ${constraintTex(spec, c)} && ${forallTex(spec, c.forall)} \\\\`,
            ),
            `& ${spec.vars.map((v) => varTex(spec, v.id)).join(', ')} \\geq 0`,
            '\\end{aligned}',
          ].join('\n')}
        />
        <p className="muted">
          Se expande a <strong>{model.variables.length}</strong> variables y{' '}
          <strong>{model.constraints.length}</strong> restricciones.
        </p>
        <button className="link" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Ocultar' : 'Ver'} modelo expandido (lo que recibe el solver)
        </button>
        {expanded && (
          <>
            <div className="expanded">
              <ModelTex model={model} symbols={symbols} />
            </div>
            <pre className="lp">{toLpFormat(model)}</pre>
          </>
        )}
      </div>
    </div>
  );
}
