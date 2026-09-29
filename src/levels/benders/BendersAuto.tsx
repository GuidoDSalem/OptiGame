import { useEffect, useState } from 'react';
import { trazaBenders, type ProblemaLocalizacion, type RondaTraza } from '../../engine/benders';
import type { ResultsExtraProps } from '../types';
import { ReproductorBenders } from './ReproductorBenders';
import type { VarianteBenders } from './template';

/** Implementación de referencia en Julia (JuMP) de Benders, con cortes de optimalidad y de factibilidad. */
export const TUTORIAL_JUMP = 'https://jump.dev/JuMP.jl/stable/tutorials/algorithms/benders_decomposition/';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/** Panel del resultado: Benders automático, comparado con el modelo completo del jugador. */
export function crearBendersAutomatico(v: VarianteBenders, P: ProblemaLocalizacion) {
  let cache: Promise<RondaTraza[]> | null = null;
  const short = (id: string) => v.depositos.find((d) => d.id === id)?.short ?? id;

  return function BendersAutomatico({ result }: ResultsExtraProps) {
    const [traza, setTraza] = useState<RondaTraza[] | null>(null);
    useEffect(() => {
      cache ??= trazaBenders(P);
      cache.then(setTraza);
    }, []);
    if (!traza) return <p className="muted">Corriendo Benders…</p>;
    const e = traza[traza.length - 1].estado;

    const final = e.rondas.find((r) => r.total === e.mejor)!;
    const coincide = result.status === 'optimal' && Math.abs((result.objective ?? NaN) - e.mejor) < 1e-4;

    return (
      <div className="pareto-panel">
        <h4>Benders, ronda por ronda</h4>
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
        <p>Miralo paso a paso: reproducilo entero o avanzá de a un paso.</p>
        <ReproductorBenders v={v} traza={traza} />

        <div className="note">
          <p>
            Si te interesa ver cómo se implementa en código, hay un tutorial muy bueno en la documentación de JuMP (Julia):{' '}
            <a href={TUTORIAL_JUMP} target="_blank" rel="noopener noreferrer">
              Benders decomposition
            </a>
            . Resuelve un problema de flujo con arcos que hay que pagar para abrir, y muestra la versión iterativa (como
            esta), una con callbacks que agrega los cortes dentro del branch and bound, y los cortes de factibilidad
            para cuando el subproblema no tiene solución.
          </p>
        </div>
      </div>
    );
  };
}
