import { useEffect, useState } from 'react';
import { diagnose, type Diagnosis } from '../engine/diagnose';
import { compileIndexed, type IndexedDraft } from '../engine/indexed';
import type { LPModel } from '../engine/model';
import { solve, type SolveResult } from '../engine/solver';
import type { IndexedLevel, Level } from '../levels/types';
import { Briefing } from './phases/Briefing';
import { IndexedModeler } from './phases/IndexedModeler';
import { draftFromModel, modelFromDraft, type Draft } from './phases/draft';
import { Manual } from './phases/Manual';
import { Modeler } from './phases/Modeler';
import { Results } from './phases/Results';
import { Theory } from './phases/Theory';

const PHASES = ['Situación', 'Intento manual', 'Teoría', 'Modelado', 'Resultado'] as const;

interface Solved {
  model: LPModel;
  result: SolveResult;
  diagnosis: Diagnosis;
}

export function LevelView({ level, onExit }: { level: Level; onExit(): void }) {
  const [phase, setPhase] = useState(0);
  const derive = (v: Record<string, number>) => (level.manualDerive ? level.manualDerive(v) : v);
  const [manual, setManualRaw] = useState<Record<string, number>>(() =>
    derive(
    // En niveles con índices se arranca de cero (la tabla vacía); si no, a mitad de cada slider.
      Object.fromEntries(level.variables.map((v) => [v.id, level.indexed ? 0 : Math.round((v.min + v.max) / 2)])),
    ),
  );
  const setManual = (v: Record<string, number>) => setManualRaw(derive(v));
  const [manualBest, setManualBest] = useState<number | undefined>();
  const [draft, setDraft] = useState<Draft>(() => draftFromModel(level.starterModel));
  const [idraft, setIdraft] = useState<IndexedDraft | null>(() => level.indexed?.starter ?? null);
  const [optimum, setOptimum] = useState<number | undefined>();
  const [solved, setSolved] = useState<Solved | null>(null);
  const [solving, setSolving] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // El óptimo real se calcula con el mismo solver, a partir del modelo de referencia.
  useEffect(() => {
    solve(level.referenceModel).then((r) => setOptimum(r.objective));
  }, [level]);

  // Guarda el mejor intento manual factible para compararlo después.
  useEffect(() => {
    const ev = level.evaluate(manual);
    if (!ev.feasible) return;
    setManualBest((b) => {
      if (b === undefined) return ev.objective;
      return level.objective.sense === 'min' ? Math.min(b, ev.objective) : Math.max(b, ev.objective);
    });
  }, [manual, level]);

  const runSolve = async (override?: IndexedDraft) => {
    setSolving(true);
    const d = override ?? idraft;
    const model =
      level.indexed && d ? compileIndexed(level.indexed.spec, d).model : modelFromDraft(draft, level.starterModel).model;
    const result = await solve(model);
    setSolved({ model, result, diagnosis: diagnose(level, model, result, optimum) });
    setSolving(false);
    setPhase(4);
  };

  return (
    <div className="level">
      <header className="level-head">
        <button className="link" onClick={onExit}>
          ← Niveles
        </button>
        <div>
          <div className="eyebrow">
            {level.codigo ? `Avanzado · ${level.codigo}` : `Nivel ${level.number}`} · {level.client}
          </div>
          <h2>{level.title}</h2>
        </div>
        <div className="technique">{level.technique}</div>
      </header>

      <nav className="stepper">
        {PHASES.map((p, i) => (
          <button
            key={p}
            className={i === phase ? 'on' : ''}
            disabled={i === 4 && !solved}
            onClick={() => setPhase(i)}
          >
            <span className="n">{i + 1}</span> {p}
          </button>
        ))}
      </nav>

      <main>
        {phase === 0 && <Briefing level={level} onNext={() => setPhase(1)} />}
        {phase === 1 && <Manual level={level} values={manual} onChange={setManual} onNext={() => setPhase(2)} />}
        {phase === 2 && <Theory level={level} manual={manual} onNext={() => setPhase(3)} />}
        {phase === 3 && level.indexed && idraft && (
          <IndexedModeler
            level={level as Level & { indexed: IndexedLevel }}
            draft={idraft}
            onChange={setIdraft}
            onSolve={() => runSolve()}
            solving={solving}
            revealed={revealed}
          />
        )}
        {phase === 3 && !level.indexed && (
          <Modeler
            level={level}
            draft={draft}
            onChange={setDraft}
            onSolve={() => runSolve()}
            solving={solving}
            revealed={revealed}
          />
        )}
        {phase === 4 && solved && (
          <Results
            level={level}
            model={solved.model}
            result={solved.result}
            diagnosis={solved.diagnosis}
            optimum={optimum}
            manualBest={manualBest}
            onBack={() => setPhase(3)}
            solving={solving}
            onAddCuts={
              level.lazyCuts && idraft
                ? (cuts) => {
                    // Agrega los cortes al modelo del jugador y vuelve a resolver en el mismo paso.
                    const next = { ...idraft, cuts: [...(idraft.cuts ?? []), ...cuts] };
                    setIdraft(next);
                    runSolve(next);
                  }
                : undefined
            }
            onShowSolution={() => {
              if (level.indexed) setIdraft(level.indexed.reference);
              else setDraft(draftFromModel(level.referenceModel));
              setRevealed(true);
              setPhase(3);
            }}
          />
        )}
      </main>
    </div>
  );
}
