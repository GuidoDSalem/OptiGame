import { useState } from 'react';
import { LEVELS } from './levels';
import { LevelView } from './ui/LevelView';

/** Niveles planificados (todavía no implementados), para mostrar el recorrido. */
const UPCOMING = [
  { client: 'Consultora de marketing', technique: 'PL con muchas variables · sensibilidad' },
  { client: 'Distribuidora', technique: 'Transporte y flujo en redes' },
  { client: 'Escuela', technique: 'Asignación · variables binarias' },
  { client: 'Minera y puerto', technique: 'Scheduling · MIP' },
  { client: 'Reparto urbano', technique: 'Ruteo (TSP/VRP) · heurísticas' },
  { client: 'Ciudad en crecimiento', technique: 'Optimización multi-período' },
];

export function App() {
  const [current, setCurrent] = useState<string | null>(null);
  const level = LEVELS.find((l) => l.id === current);

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
        {LEVELS.map((l) => (
          <button key={l.id} className="card" onClick={() => setCurrent(l.id)}>
            <span className="eyebrow">Nivel {l.number}</span>
            <strong>{l.client}</strong>
            <span className="muted">{l.technique}</span>
          </button>
        ))}
        {UPCOMING.map((u, i) => (
          <div key={u.client} className="card locked">
            <span className="eyebrow">Nivel {LEVELS.length + i + 1} · próximamente</span>
            <strong>{u.client}</strong>
            <span className="muted">{u.technique}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
