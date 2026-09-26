import { useEffect, useState } from 'react';
import { benders, type EstadoBenders, type ProblemaLocalizacion } from '../../engine/benders';
import { ConvergenceChart } from '../../ui/components/ConvergenceChart';
import type { ResultsExtraProps } from '../types';
import type { VarianteBenders } from './template';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/** Panel del resultado: Benders automático, comparado con el modelo completo del jugador. */
export function crearBendersAutomatico(v: VarianteBenders, P: ProblemaLocalizacion) {
  let cache: Promise<EstadoBenders> | null = null;
  const short = (id: string) => v.depositos.find((d) => d.id === id)?.short ?? id;

  return function BendersAutomatico({ result }: ResultsExtraProps) {
    const [e, setE] = useState<EstadoBenders | null>(null);
    useEffect(() => {
      cache ??= benders(P);
      cache.then(setE);
    }, []);
    if (!e) return <p className="muted">Corriendo Benders…</p>;

    const final = e.rondas.find((r) => r.total === e.mejor)!;
    const coincide = result.status === 'optimal' && Math.abs((result.objective ?? NaN) - e.mejor) < 1e-4;

    return (
      <div className="pareto-panel">
        <h4>Benders, ronda por ronda</h4>
        <ConvergenceChart
          yLabel="Costo ($k/sem)"
          series={[
            { label: 'propuesta del maestro', values: e.rondas.map((r) => r.total), className: 'propuesta' },
            { label: 'mejor solución', values: e.rondas.map((r) => r.mejor), className: 'cota-superior' },
            { label: 'cota inferior', values: e.rondas.map((r) => r.cotaInferior), className: 'cota-inferior' },
          ]}
        />
        <p>
          En <strong>{e.rondas.length} rondas</strong> (un maestro chico y un transporte por ronda) Benders llegó a{' '}
          <strong>$k {fmt(e.mejor)}</strong>, abriendo {final.abiertos.map(short).join(', ')}.{' '}
          {result.status === 'optimal' &&
            (coincide
              ? 'Es exactamente el mismo óptimo que tu modelo completo resuelto de una vez. Dos caminos, un mismo resultado.'
              : `Tu modelo completo dio $k ${fmt(result.objective ?? 0)}: revisalo, porque Benders demuestra que el óptimo es otro.`)}
        </p>
        <p className="muted small">
          Con 5 depósitos, resolver todo junto es más rápido. Benders gana cuando el problema es enorme o tiene
          muchos escenarios: el maestro queda chico y los subproblemas se pueden resolver en paralelo.
        </p>
      </div>
    );
  };
}
