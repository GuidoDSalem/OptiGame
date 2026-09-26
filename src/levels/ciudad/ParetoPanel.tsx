import { useEffect, useState } from 'react';
import type { LPModel } from '../../engine/model';
import { fronteraEpsilon, type ParetoPoint } from '../../engine/pareto';
import type { ResultsExtraProps } from '../types';
import { ParetoPlot, type PlotPoint } from './ParetoPlot';
import type { VarianteCiudad } from './template';

/**
 * Panel del resultado: frontera de Pareto completa (ε-restricción), qué puntos encuentra la
 * suma ponderada, y dónde cae la solución del jugador.
 */
export function crearPanelPareto(v: VarianteCiudad, referenceModel: LPModel) {
  const { proyectos: P, vocab: V } = v;
  const F = Object.fromEntries(P.map((p) => [`y_${p.id}`, p.beneficio]));
  const G = Object.fromEntries(P.map((p) => [`y_${p.id}`, p.impacto]));
  // Sin el tope: la frontera se calcula para todos los niveles de impacto.
  const base: LPModel = { ...referenceModel, constraints: referenceModel.constraints.filter((c) => c.name !== V.compromiso) };
  let cache: Promise<ParetoPoint[]> | null = null;

  return function PanelPareto({ result }: ResultsExtraProps) {
    const [front, setFront] = useState<ParetoPoint[] | null>(null);
    useEffect(() => {
      cache ??= fronteraEpsilon(base, F, G, 1);
      cache.then(setFront);
    }, []);
    if (!front) return <p className="muted">Calculando la frontera de Pareto…</p>;

    const on = (id: string) => (result.values[`y_${id}`] ?? 0) > 0.5;
    const sol = result.status === 'optimal' ? { f: P.reduce((s, p) => s + (on(p.id) ? p.beneficio : 0), 0), g: P.reduce((s, p) => s + (on(p.id) ? p.impacto : 0), 0) } : null;
    const soportados = front.filter((p) => p.soportado).length;
    const elegido = front.filter((p) => p.g <= v.topeImpacto).sort((a, b) => b.f - a.f)[0];
    const nombres = (p: ParetoPoint) =>
      P.filter((q) => (p.values[`y_${q.id}`] ?? 0) > 0.5)
        .map((q) => q.short)
        .join(', ');

    const points: PlotPoint[] = [
      ...front.map((p) => ({
        f: p.f,
        g: p.g,
        kind: p.soportado ? ('frontera' as const) : ('no-soportado' as const),
        title: `${nombres(p)} → ${p.f} ${V.beneficio.toLowerCase()}, ${p.g} ${V.unidadImpacto}`,
      })),
      ...(sol ? [{ ...sol, kind: 'solucion' as const, title: 'Tu solución' }] : []),
    ];

    return (
      <div className="pareto-panel">
        <h4>Frontera de Pareto</h4>
        <ParetoPlot
          points={points}
          tope={v.topeImpacto}
          xLabel={`${V.impacto} (${V.unidadImpacto})`}
          yLabel={V.beneficio}
          escalera
        />
        <p className="legend">
          <span className="dot frontera" /> la suma ponderada lo encuentra <span className="dot no-soportado" /> sólo con
          ε-restricción <span className="dot solucion" /> tu solución
        </p>
        <p>
          La frontera tiene <strong>{front.length}</strong> soluciones eficientes: ninguna mejora en un objetivo sin empeorar
          el otro. La suma ponderada encuentra <strong>{soportados}</strong>. Las otras{' '}
          <strong>{front.length - soportados}</strong> quedan "escondidas" en huecos de la frontera, y sólo las encuentra
          la ε-restricción.
        </p>
        {elegido && (
          <p className="note">
            Con el tope de <strong>{v.topeImpacto} {V.unidadImpacto}</strong>, la mejor opción es {nombres(elegido)} (
            {elegido.f} {V.beneficio.toLowerCase()}).{' '}
            {elegido.soportado
              ? 'Esta la podría encontrar también la suma ponderada.'
              : 'Ojo: la suma ponderada nunca la encontraría, con ningún peso. Por eso el compromiso se modela como ε-restricción.'}
          </p>
        )}
      </div>
    );
  };
}
