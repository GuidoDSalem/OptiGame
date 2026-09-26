import { useEffect, useState } from 'react';
import { bendersEstocastico, medidas, type EstadoEstocastico, type Medidas, type ProblemaEstocastico } from '../../engine/estocastico';
import { ConvergenceChart } from '../../ui/components/ConvergenceChart';
import type { ResultsExtraProps } from '../types';
import { TablaEscenarios, fmt, recortar } from './EstocasticoPanel';
import type { VarianteEstocastica } from './template';

interface Datos {
  m: Medidas;
  multi: EstadoEstocastico;
  unico: EstadoEstocastico;
}

/** Panel del resultado: el valor de pensar en escenarios, y Benders multi-corte vs. corte único. */
export function crearEstocasticoAutomatico(v: VarianteEstocastica, P: ProblemaEstocastico) {
  let cache: Promise<Datos> | null = null;
  const short = (id: string) => v.plantas.find((d) => d.id === id)?.short ?? id;
  const lista = (ids: string[]) => ids.map(short).join(', ') || 'ninguna';

  return function EstocasticoAutomatico({ result }: ResultsExtraProps) {
    const [d, setD] = useState<Datos | null>(null);
    useEffect(() => {
      cache ??= (async () => ({ m: await medidas(P), multi: await bendersEstocastico(P, 'multi'), unico: await bendersEstocastico(P, 'unico') }))();
      cache.then(setD);
    }, []);
    if (!d) return <p className="muted">Resolviendo los escenarios…</p>;
    const { m, multi, unico } = d;
    const coincide = result.status === 'optimal' && Math.abs((result.objective ?? NaN) - m.rp.total) < 1e-4;

    return (
      <div className="pareto-panel">
        <h4>¿Cuánto vale pensar en escenarios?</h4>
        <table className="data">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Plantas</th>
              <th className="r">Costo esperado real</th>
            </tr>
          </thead>
          <tbody>
            <tr className="active">
              <td>Estocástico (todos los escenarios)</td>
              <td>{lista(m.rp.abiertos)}</td>
              <td className="r">
                <strong>{fmt(m.rp.total)}</strong>
              </td>
            </tr>
            <tr>
              <td>Para el año promedio</td>
              <td>{lista(m.eev.abiertos)}</td>
              <td className="r">{fmt(m.eev.total)}</td>
            </tr>
            <tr>
              <td>Para el peor año</td>
              <td>{lista(m.peor.abiertos)}</td>
              <td className="r">{fmt(m.peor.total)}</td>
            </tr>
            <tr>
              <td>Con información perfecta (sabiendo el clima)</td>
              <td className="muted">cambia según el año</td>
              <td className="r">{fmt(m.ws)}</td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Valor de la solución estocástica:</strong> {v.moneda} {fmt(m.vss)} por campaña, lo que se pierde por
          planificar con el promedio. <strong>Valor de la información perfecta:</strong> {v.moneda} {fmt(m.evpi)}, lo
          máximo que valdría pagar por un pronóstico infalible.
        </p>
        <details className="small">
          <summary>El plan del año promedio, escenario por escenario</summary>
          <TablaEscenarios v={v} ev={m.eev} />
        </details>
        <details className="small">
          <summary>El plan estocástico, escenario por escenario</summary>
          <TablaEscenarios v={v} ev={m.rp} />
        </details>
        {result.status === 'optimal' && (
          <p>
            {coincide
              ? 'Tu modelo llegó exactamente al plan estocástico.'
              : `Tu modelo dio ${v.moneda} ${fmt(result.objective ?? 0)}; el plan estocástico cuesta ${fmt(m.rp.total)} en esperanza.`}
          </p>
        )}

        <h4>Benders con escenarios</h4>
        <ConvergenceChart
          yLabel={`Costo esperado (${v.moneda})`}
          series={[
            { label: 'mejor plan', values: multi.rondas.map((r) => recortar(r.mejor, multi.mejor)), className: 'cota-superior' },
            { label: 'cota inferior (multi-corte)', values: multi.rondas.map((r) => r.cotaInferior), className: 'cota-inferior' },
            { label: 'cota inferior (corte único)', values: unico.rondas.map((r) => r.cotaInferior), className: 'propuesta' },
          ]}
        />
        <p>
          Con un corte por escenario, Benders converge en <strong>{multi.rondas.length} rondas</strong>
          {' '}({multi.rondas.length * v.escenarios.length} cortes). Sumando los cortes de cada ronda en uno solo hacen falta{' '}
          <strong>{unico.rondas.length} rondas</strong>: el maestro es más chico pero aprende menos por vuelta.
        </p>
        <p className="muted small">
          Con miles de escenarios, cada ronda resuelve miles de transportes chicos e independientes: se reparten entre
          muchos procesadores. Esa es la gracia de descomponer.
        </p>
      </div>
    );
  };
}
