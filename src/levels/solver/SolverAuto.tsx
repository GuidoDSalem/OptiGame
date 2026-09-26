import { branchAndBound, planosDeCorte, resolverLP, type Problema2D } from '../../engine/ramificacion';
import type { ResultsExtraProps } from '../types';
import { ArbolView } from './ArbolView';
import { Poliedro } from './Poliedro';
import { fmt, filaTexto } from './SolverPanel';
import { idVar, type VarianteSolver } from './template';

/** Panel del resultado: lo que hizo el solver por dentro para llegar al óptimo entero. */
export function crearSolverPorDentro(v: VarianteSolver, P: Problema2D) {
  const arbol = branchAndBound(P);
  const cortes = planosDeCorte(P);
  const lp = resolverLP(P.c, P.filas);
  const [p0, p1] = v.productos;

  return function SolverPorDentro({ result }: ResultsExtraProps) {
    const inc = arbol.incumbente!;
    const x = [result.values[idVar(p0)] ?? 0, result.values[idVar(p1)] ?? 0];
    const fraccionaria = result.status === 'optimal' && x.some((n) => Math.abs(n - Math.round(n)) > 1e-6);

    return (
      <div className="pareto-panel solver-panel">
        <h4>Lo que pasa adentro del solver</h4>
        <table className="data">
          <tbody>
            <tr>
              <td>Relajación lineal (sin pedir enteros)</td>
              <td className="r">
                {v.moneda} {fmt(lp.z)} en ({fmt(lp.x[0])} ; {fmt(lp.x[1])})
              </td>
            </tr>
            <tr>
              <td>Redondear la relajación para abajo</td>
              <td className="r">
                {v.moneda} {P.c[0] * Math.floor(lp.x[0]) + P.c[1] * Math.floor(lp.x[1])} en ({Math.floor(lp.x[0])}, {Math.floor(lp.x[1])})
              </td>
            </tr>
            <tr>
              <td>Óptimo entero</td>
              <td className="r">
                <strong>
                  {v.moneda} {inc.z}
                </strong>{' '}
                en ({inc.x.join(', ')})
              </td>
            </tr>
          </tbody>
        </table>
        {fraccionaria && (
          <p className="error small">
            Tu modelo dio una solución fraccionaria: es la relajación. Marcá x como entera y el solver hace todo lo de
            abajo por vos.
          </p>
        )}
        <p>
          <strong>Branch and bound</strong> (mejor cota, variable más fraccionaria): {arbol.nodos.length} relajaciones.
        </p>
        <ArbolView arbol={arbol} />
        <p>
          <strong>Planos de corte</strong> (fila más fraccionaria): {cortes.pasos.length} corte
          {cortes.pasos.length === 1 ? '' : 's'} hasta que el LP cae en ({cortes.lp.x.join(', ')}).
        </p>
        <Poliedro P={P} xmax={v.xmax} ymax={v.ymax} xLabel={`x: ${p0.plural}`} yLabel={`y: ${p1.plural}`} cortes={cortes.cortes} lp={cortes.lp.x} />
        <ul className="small cortes-lista">
          {cortes.pasos.map((p, i) => (
            <li key={i} className="mono">
              {filaTexto(p.corte)}
            </li>
          ))}
        </ul>
        <p className="muted small">
          HiGHS combina las dos cosas (branch and cut), con presolve y heurísticas. En un problema con miles de
          variables enteras, el árbol puede tener millones de nodos: por eso importa tanto podar y cortar bien.
        </p>
      </div>
    );
  };
}
