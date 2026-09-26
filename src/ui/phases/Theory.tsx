import { useState } from 'react';
import type { Level } from '../../levels/types';
import { Content } from '../components/Rich';
import { FeasiblePlot } from '../components/FeasiblePlot';

interface Props {
  level: Level;
  manual: Record<string, number>;
  onNext(): void;
}

export function Theory({ level, manual, onNext }: Props) {
  const plot = level.plot;
  const manualCost = level.evaluate(manual).objective;
  const [iso, setIso] = useState(Math.round(manualCost) || Math.round((plot?.isoMax ?? 0) / 2));
  const vx = level.variables.find((v) => v.id === plot?.x);
  const vy = level.variables.find((v) => v.id === plot?.y);

  return (
    <div className="two-col">
      <div>
        <Content blocks={level.theory} />
        <button className="primary" onClick={onNext}>
          Armar el modelo →
        </button>
      </div>
      {plot && vx && vy && (
        <div className="sticky">
          <FeasiblePlot
            model={level.referenceModel}
            x={plot.x}
            y={plot.y}
            xmax={plot.xmax}
            ymax={plot.ymax}
            xLabel={`${vx.label} (${vx.unit})`}
            yLabel={`${vy.label} (${vy.unit})`}
            point={manual}
            pointLabel="tu intento"
            isoValue={iso}
          />
          <label className="slider">
            <span>
              Recta de {level.objective.label.toLowerCase()} = {level.objective.unit}
              {iso.toLocaleString('es-AR')}
            </span>
            <input type="range" min={0} max={plot.isoMax} step={plot.isoMax / 600} value={iso} onChange={(e) => setIso(Number(e.target.value))} />
          </label>
          <p className="caption">
            La zona sombreada es la región factible. Mové la recta en la dirección que mejora el objetivo hasta que
            apenas toque la región: ese punto es el óptimo.
          </p>
        </div>
      )}
    </div>
  );
}
