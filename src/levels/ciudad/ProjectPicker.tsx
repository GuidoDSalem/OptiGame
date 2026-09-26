import { useEffect, useState } from 'react';
import type { ManualProps } from '../types';
import { ParetoPlot, type PlotPoint } from './ParetoPlot';
import type { VarianteCiudad } from './template';

/** Intento manual: prender y apagar proyectos, y ver el rastro de combinaciones probadas. */
export function crearSelectorDeProyectos(v: VarianteCiudad) {
  const { proyectos: P, vocab: V } = v;
  const yId = (p: string) => `y_${p}`;

  return function SelectorDeProyectos({ values, onChange }: ManualProps) {
    const on = (id: string) => (values[yId(id)] ?? 0) > 0.5;
    const f = P.reduce((s, p) => s + (on(p.id) ? p.beneficio : 0), 0);
    const g = P.reduce((s, p) => s + (on(p.id) ? p.impacto : 0), 0);
    const gasto = P.reduce((s, p) => s + (on(p.id) ? p.costo : 0), 0);

    // Rastro de combinaciones probadas (sin repetir).
    const [intentos, setIntentos] = useState<{ f: number; g: number }[]>([]);
    useEffect(() => {
      if (!P.some((p) => on(p.id))) return;
      setIntentos((xs) => (xs.some((x) => x.f === f && x.g === g) ? xs : [...xs, { f, g }]));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [f, g]);

    const points: PlotPoint[] = [
      ...intentos.map((x) => ({ ...x, kind: 'intento' as const })),
      { f, g, kind: 'actual' as const, title: 'Selección actual' },
    ];

    return (
      <div className="picker">
        <div className="project-grid">
          {P.map((p) => (
            <button
              key={p.id}
              className={`project ${on(p.id) ? 'on' : ''}`}
              aria-pressed={on(p.id)}
              onClick={() => onChange({ ...values, [yId(p.id)]: on(p.id) ? 0 : 1 })}
            >
              <strong>{p.label}</strong>
              <span>
                {V.moneda} {p.costo} · {p.beneficio} {V.beneficio.toLowerCase()} · {p.impacto > 0 ? '+' : ''}
                {p.impacto} {V.impacto.toLowerCase()}
              </span>
            </button>
          ))}
        </div>
        <p className={`muted small ${gasto > v.presupuesto ? 'error' : ''}`}>
          Gastado: {V.moneda} {gasto} de {v.presupuesto}.
        </p>
        <ParetoPlot
          points={points}
          tope={v.topeImpacto}
          xLabel={`${V.impacto} (${V.unidadImpacto})`}
          yLabel={V.beneficio}
        />
        <p className="caption">Cada punto gris es una combinación que probaste. ¿Se puede subir sin correrse a la derecha?</p>
      </div>
    );
  };
}
