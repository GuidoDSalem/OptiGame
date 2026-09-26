import { useState } from 'react';
import { CASOS } from './casos';
import { LEVELS } from './levels';
import type { Level } from './levels/types';
import { LevelThumb } from './ui/components/LevelThumb';
import { LevelView } from './ui/LevelView';

/** Técnicas avanzadas planificadas (todavía no implementadas), para mostrar el recorrido. */
const UPCOMING_AVANZADOS = [
  { codigo: 'A1', client: 'Dentro del solver', technique: 'Branch and bound · planos de corte' },
  { codigo: 'A2', client: 'Bobinas a medida', technique: 'Generación de columnas' },
  { codigo: 'A4', client: 'Cuando llueve y cuando no', technique: 'Benders estocástico' },
  { codigo: 'A5', client: 'Reparto a gran escala', technique: 'Metaheurísticas' },
];

/** Texto chico arriba del título: "Nivel 3" o "Avanzado · A3". */
export const etiquetaNivel = (l: Level) => (l.codigo ? `Avanzado · ${l.codigo}` : `Nivel ${l.number}`);

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
        <span className="eyebrow">{etiquetaNivel(l)}</span>
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
  const caso = CASOS.find((c) => c.id === current);
  const groups = groupByNumber(LEVELS.filter((l) => l.seccion !== 'avanzada'));
  const avanzados = groupByNumber(LEVELS.filter((l) => l.seccion === 'avanzada'));

  if (level) return <LevelView key={level.id} level={level} onExit={() => setCurrent(null)} />;
  if (caso) return <caso.Pagina onExit={() => setCurrent(null)} />;

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
      </div>

      <section className="advanced">
        <h2>Técnicas avanzadas</h2>
        <p className="muted">
          Cómo piensan los algoritmos por dentro: problemas demasiado grandes para resolverse de una vez, que se
          parten y se resuelven de a pedazos. Usan conceptos de los niveles 2, 4, 5 y 6.
        </p>
        <div className="cards">
          {avanzados.map((versions) => (
            <LevelCard key={versions[0].number} versions={versions} onOpen={setCurrent} />
          ))}
          {UPCOMING_AVANZADOS.filter((u) => !LEVELS.some((l) => l.codigo === u.codigo)).map((u) => (
            <div key={u.codigo} className="card locked">
              <div className="thumb">?</div>
              <span className="card-text">
                <span className="eyebrow">Avanzado · {u.codigo} · próximamente</span>
                <strong>{u.client}</strong>
                <span className="muted">{u.technique}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="advanced casos">
        <h2>Casos de estudio</h2>
        <p className="muted">
          Un análisis completo contado de principio a fin, para leer scrolleando: de la situación a la recomendación,
          con simulación, gráficos y estadística.
        </p>
        <div className="cards">
          {CASOS.map((c) => (
            <div
              key={c.id}
              className="card"
              role="button"
              tabIndex={0}
              onClick={() => setCurrent(c.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setCurrent(c.id))}
            >
              <div className="thumb">
                <c.Miniatura />
              </div>
              <span className="card-text">
                <span className="eyebrow">Caso de estudio · {c.codigo}</span>
                <strong>{c.title}</strong>
                <span>{c.client}</span>
                <span className="muted">{c.technique}</span>
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
