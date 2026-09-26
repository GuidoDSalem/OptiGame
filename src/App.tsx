import { useState } from 'react';
import { LEVELS } from './levels';
import type { Level } from './levels/types';
import { LevelThumb } from './ui/components/LevelThumb';
import { LevelView } from './ui/LevelView';

/** Niveles planificados (todavía no implementados), para mostrar el recorrido. */
const UPCOMING = [
  { client: 'Ciudad en crecimiento', technique: 'Multi-objetivo · decisiones encadenadas' },
];

/** Agrupa las versiones de un mismo nivel (mismo número), respetando el orden del registro. */
function groupByNumber(levels: Level[]): Level[][] {
  const groups = new Map<number, Level[]>();
  for (const l of levels) groups.set(l.number, [...(groups.get(l.number) ?? []), l]);
  return [...groups.values()];
}

function LevelCard({ versions, onOpen }: { versions: Level[]; onOpen(id: string): void }) {
  const [sel, setSel] = useState(0);
  const l = versions[sel];
  const open = () => onOpen(l.id);
  return (
    <div
      className="card"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
    >
      <LevelThumb level={l} />
      <span className="card-text">
        <span className="eyebrow">Nivel {l.number}</span>
        <strong>{l.title}</strong>
        <span>{l.client}</span>
        <span className="muted">{l.technique}</span>
        {versions.length > 1 && (
          <span className="versions" onClick={(e) => e.stopPropagation()}>
            {versions.map((v, i) => (
              <button
                key={v.id}
                className={i === sel ? 'on' : ''}
                aria-pressed={i === sel}
                onClick={() => setSel(i)}
              >
                {v.variant}
              </button>
            ))}
          </span>
        )}
      </span>
    </div>
  );
}

export function App() {
  const [current, setCurrent] = useState<string | null>(null);
  const level = LEVELS.find((l) => l.id === current);
  const groups = groupByNumber(LEVELS);
  const lastNumber = Math.max(...LEVELS.map((l) => l.number));

  if (level) return <LevelView key={level.id} level={level} onExit={() => setCurrent(null)} />;

  return (
    <div className="home">
      <header>
        <h1>OptiGame</h1>
        <p className="lead">
          Sos consultor en optimización. Cada cliente trae un problema real: lo modelás y lo resolvés con un solver
          de verdad.
        </p>
      </header>
      <div className="cards">
        {groups.map((versions) => (
          <LevelCard key={versions[0].number} versions={versions} onOpen={setCurrent} />
        ))}
        {UPCOMING.map((u, i) => (
          <div key={u.client} className="card locked">
            <div className="thumb">?</div>
            <span className="card-text">
              <span className="eyebrow">Nivel {lastNumber + i + 1} · próximamente</span>
              <strong>{u.client}</strong>
              <span className="muted">{u.technique}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
