import { useEffect, useState } from 'react';
import {
  describir,
  enteroConPatrones,
  generacionDeColumnas,
  patronDeVariable,
  redondeoHaciaArriba,
  type EstadoColumnas,
  type ProblemaCorte,
  type SolucionEntera,
} from '../../engine/columnas';
import { ConvergenceChart } from '../../ui/components/ConvergenceChart';
import type { ResultsExtraProps } from '../types';
import { serieCota, serieLp } from './ColumnasPanel';
import { PatronBar } from './PatronBar';
import type { VarianteColumnas } from './template';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 3 });

/** Panel del resultado: los patrones que eligió el solver y la generación de columnas automática. */
export function crearColumnasAutomatico(v: VarianteColumnas, P: ProblemaCorte) {
  let cache: Promise<{ e: EstadoColumnas; entero: SolucionEntera }> | null = null;

  return function ColumnasAutomatico({ result, model }: ResultsExtraProps) {
    const [datos, setDatos] = useState<{ e: EstadoColumnas; entero: SolucionEntera } | null>(null);
    useEffect(() => {
      cache ??= generacionDeColumnas(P).then(async (e) => ({ e, entero: await enteroConPatrones(P, e.patrones) }));
      cache.then(setDatos);
    }, []);

    const usados = Object.entries(result.values)
      .map(([k, n]) => ({ p: patronDeVariable(P, k), n }))
      .filter((u) => u.p && u.n > 1e-6)
      .sort((a, b) => b.n - a.n);

    return (
      <div className="pareto-panel columnas">
        {result.status === 'optimal' && usados.length > 0 && (
          <>
            <h4>Los patrones que eligió el solver</h4>
            <p className="muted small">
              Tu modelo tenía {model.variables.length} columnas (una por patrón); se usan {usados.length}.
            </p>
            <table className="data rounds">
              <tbody>
                {usados.map(({ p, n }, i) => (
                  <tr key={i}>
                    <td className="r">
                      <strong>{fmt(n)}</strong> ×
                    </td>
                    <td>
                      <PatronBar P={P} p={p!} compact />
                      <span className="cut">{describir(P, p!)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <h4>Generación de columnas, sin escribir el catálogo</h4>
        {!datos ? (
          <p className="muted">Generando columnas…</p>
        ) : (
          <>
            <ConvergenceChart
              yLabel="Bobinas"
              series={[
                { label: 'maestro (relajación)', values: serieLp(datos.e), className: 'cota-superior' },
                { label: 'cota inferior (Farley)', values: serieCota(datos.e), className: 'cota-inferior' },
              ]}
            />
            <p>
              Arrancando con {v.pedidos.length} patrones obvios, en <strong>{datos.e.rondas.length} rondas</strong> de
              pricing llegó a la relajación óptima con sólo <strong>{datos.e.patrones.length}</strong> patrones (de los{' '}
              {model.variables.length} posibles).
            </p>
            <table className="data">
              <tbody>
                <tr>
                  <td>Relajación lineal (cota: nadie usa menos)</td>
                  <td className="r">{fmt(datos.e.maestro.objetivo)}</td>
                </tr>
                <tr>
                  <td>Redondear cada patrón para arriba</td>
                  <td className="r">{redondeoHaciaArriba(datos.e.maestro.x).bobinas}</td>
                </tr>
                <tr>
                  <td>Modelo entero con los patrones generados</td>
                  <td className="r">
                    <strong>{datos.entero.bobinas}</strong>
                  </td>
                </tr>
                {result.status === 'optimal' && (
                  <tr>
                    <td>Tu modelo, con todos los patrones</td>
                    <td className="r">{fmt(result.objective ?? 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {datos.entero.bobinas === Math.ceil(datos.e.maestro.objetivo - 1e-6) && (
              <p className="muted small">
                Como la relajación da {fmt(datos.e.maestro.objetivo)}, hacen falta al menos{' '}
                {Math.ceil(datos.e.maestro.objetivo - 1e-6)} bobinas: la solución entera con los patrones generados es
                óptima, y se demostró sin mirar el catálogo completo.
              </p>
            )}
          </>
        )}
      </div>
    );
  };
}
