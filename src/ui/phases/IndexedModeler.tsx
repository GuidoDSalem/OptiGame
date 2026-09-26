import { useMemo, useState } from 'react';
import {
  compileIndexed,
  constraintTex,
  forallTex,
  coefsOf,
  getParam,
  getSet,
  getVar,
  objectiveTex,
  paramTex,
  varTex,
  domainTex,
  orderedSetOf,
  summedSets,
  term,
  type IndexedSpec,
  type Term,
  varType,
  VAR_TYPES,
  type VarType,
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

/** Editor de una suma de términos: signo · coeficiente · variable (con desfase opcional). */
function TermsEditor({
  spec,
  terms,
  forall,
  allowLag,
  allowPick,
  allowCoef2,
  onChange,
}: {
  spec: IndexedSpec;
  terms: Term[];
  forall: string[];
  allowLag: boolean;
  /** Permite elegir un elemento particular en vez de sumar (p. ej. y_Hospital). */
  allowPick?: boolean;
  /** Permite un segundo coeficiente (p. ej. probabilidad × costo). */
  allowCoef2?: boolean;
  onChange(t: Term[]): void;
}) {
  const set = (i: number, patch: Partial<Term>) => onChange(terms.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className="terms">
      {terms.map((t, i) => {
        const fam = getVar(spec, t.var);
        const free = fam.over.filter((s) => !forall.includes(s));
        const sumOver = summedSets(fam, t, forall);
        const os = orderedSetOf(spec, fam);
        const pick = (s: string, item: string) => {
          const at = { ...(t.at ?? {}) };
          if (item) at[s] = item;
          else delete at[s];
          set(i, { at: Object.keys(at).length ? at : undefined });
        };
        return (
          <div key={i} className="irow iterm">
            <select className="sign" value={t.sign} onChange={(e) => set(i, { sign: Number(e.target.value) as 1 | -1 })}>
              <option value={1}>+</option>
              <option value={-1}>−</option>
            </select>
            {allowPick
              ? free.map((s) => {
                  const S = getSet(spec, s);
                  return (
                    <select key={s} value={t.at?.[s] ?? ''} onChange={(e) => pick(s, e.target.value)} title={`Sumar o elegir ${S.index}`}>
                      <option value="">Σ todos los {S.name.toLowerCase()}</option>
                      {S.items.map((it) => (
                        <option key={it.id} value={it.id}>
                          sólo {it.label}
                        </option>
                      ))}
                    </select>
                  );
                })
              : sumOver.length > 0 && <Tex tex={sumOver.map((s) => `\\sum_{${getSet(spec, s).index}}`).join(' ')} />}
            <select value={t.coef ?? ''} onChange={(e) => set(i, { coef: e.target.value || null })} title="Coeficiente">
              <option value="">1</option>
              {spec.params.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.symbol} · {p.name.toLowerCase()}
                </option>
              ))}
            </select>
            {allowCoef2 && t.coef && (
              <select value={t.coef2 ?? ''} onChange={(e) => set(i, { coef2: e.target.value || null })} title="Otro coeficiente">
                <option value="">· 1</option>
                {spec.params
                  .filter((p) => p.id !== t.coef)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      · {p.symbol} · {p.name.toLowerCase()}
                    </option>
                  ))}
              </select>
            )}
            {spec.vars.length > 1 ? (
              <select value={t.var} onChange={(e) => set(i, { var: e.target.value, lag: undefined })} title="Variable">
                {spec.vars.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.symbol} · {v.label.toLowerCase()}
                  </option>
                ))}
              </select>
            ) : null}
            <Tex tex={varTex(spec, t.var, t.lag, t.at)} />
            {allowLag && os && (
              <select
                value={t.lag ?? 0}
                onChange={(e) => set(i, { lag: Number(e.target.value) || undefined })}
                title="Período"
              >
                <option value={0}>{os.index}</option>
                <option value={-1}>{os.index}−1</option>
              </select>
            )}
            {terms.length > 1 && (
              <button className="icon" title="Quitar término" onClick={() => onChange(terms.filter((_, j) => j !== i))}>
                ×
              </button>
            )}
          </div>
        );
      })}
      <button className="link small" onClick={() => onChange([...terms, term(spec.vars[0].id)])}>
        + término
      </button>
    </div>
  );
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
        { key: newKey(), name: '', forall: [], terms: [term(spec.vars[0].id)], op: '<=', rhs: { kind: 'value', value: '' } },
      ],
    });

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

        <h4>Variables</h4>
        {spec.vars.map((v) => (
          <div key={v.id} className="irow">
            <Tex tex={varTex(spec, v.id)} />
            <span className="muted">{v.label.toLowerCase()}:</span>
            <select
              value={varType(draft, v.id)}
              onChange={(e) =>
                onChange({ ...draft, varTypes: { ...draft.varTypes, [v.id]: e.target.value as VarType } })
              }
            >
              {VAR_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        <h4>Función objetivo</h4>
        <div className="irow">
          <select value={draft.sense} onChange={(e) => onChange({ ...draft, sense: e.target.value as IndexedDraft['sense'] })}>
            <option value="min">min</option>
            <option value="max">max</option>
          </select>
        </div>
        <TermsEditor
          spec={spec}
          terms={draft.objective.terms}
          forall={[]}
          allowLag={false}
          allowPick={level.indexed.pickItems}
          allowCoef2={level.indexed.twoCoefs}
          onChange={(terms) => onChange({ ...draft, objective: { terms } })}
        />

        <h4>Restricciones</h4>
        {draft.constraints.length === 0 && <p className="muted">Todavía no agregaste restricciones.</p>}
        {draft.constraints.map((c) => {
          // "Para cada" puede usar cualquier conjunto del que dependan las variables de la restricción.
          // Se puede repetir sobre los índices de las variables y de los coeficientes (a_{ip}·x_p para cada i).
          const indexable = [
            ...new Set(c.terms.flatMap((t) => [...getVar(spec, t.var).over, ...coefsOf(t).flatMap((k) => getParam(spec, k).over)])),
          ];
          const forallOptions = subsets(indexable);
          if (!forallOptions.some((o) => o.join(',') === c.forall.join(','))) forallOptions.push(c.forall);
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
                  {forallOptions.map((sub) => (
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
              <TermsEditor
                spec={spec}
                terms={c.terms}
                forall={c.forall}
                allowLag
                allowPick={level.indexed.pickItems}
                allowCoef2={level.indexed.twoCoefs}
                onChange={(terms) => setRow(c.key, { terms })}
              />
              <div className="irow">
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
        {(draft.cuts?.length ?? 0) > 0 && (
          <p className="note">
            Además hay <strong>{draft.cuts!.length}</strong> cortes agregados desde el resultado.{' '}
            <button className="link small" onClick={() => onChange({ ...draft, cuts: [] })}>
              Quitar cortes
            </button>
          </p>
        )}

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
            `& ${spec.vars.map((v) => domainTex(spec, draft, v.id)).join(',\\; ')}`,
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
