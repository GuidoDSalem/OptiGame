import { useState } from 'react';
import { etapasConStock, mejorColocacion, nrtTramo, todasLasColocaciones, type Tramo } from '../../engine/stockSeguridad';
import type { ResultsExtraProps } from '../types';
import { costoDeTramos, costoRedondeado, tramosDeValores, usd, type VarianteStock } from './template';

/** Implementación de referencia (Python y C++) del modelo en serie. */
export const REPO_EJEMPLO = 'https://github.com/cosmosanalytics/multi-echelon-inventory-optimization';

/** Panel del resultado: dónde quedó el stock, la programación dinámica y qué cambia con la promesa al cliente. */
export function crearStockAutomatico(v: VarianteStock) {
  const C = v.cadena;
  const E = C.etapas;
  const N = E.length;
  const nombreTramos = (tramos: Tramo[]) => {
    const con = etapasConStock(C, tramos);
    return con.length ? con.map((j) => E[j].corto).join(' + ') : 'sin stock';
  };

  return function StockAutomatico({ result }: ResultsExtraProps) {
    const [servicio, setServicio] = useState(C.servicio);
    // Con los costos de tramo redondeados, los mismos que ve el jugador en el modelo.
    const opt = mejorColocacion(C, costoRedondeado);
    const optCosto = opt.costo;
    const todas = todasLasColocaciones(C, costoRedondeado);
    const intuitivas: { nombre: string; tramos: Tramo[] }[] = [
      { nombre: `Todo en ${E[N - 1].corto}`, tramos: [[0, N - 1]] },
      { nombre: 'Un poco en cada etapa', tramos: E.map((_, k) => [k, k] as Tramo) },
    ];
    const costoDe = (t: Tramo[]) => costoDeTramos(C, t);
    const suyos = result.status === 'optimal' ? tramosDeValores(C, result.values).tramos : [];
    const otro = { ...C, servicio };
    const optS = mejorColocacion(otro, costoRedondeado);
    const optSCosto = optS.costo;

    return (
      <div className="pareto-panel stock">
        <h4>Dónde quedó el stock</h4>
        <CadenaTramos v={v} tramos={suyos.length ? suyos : opt.tramos} />
        <p>
          El óptimo guarda stock en <strong>{nombreTramos(opt.tramos)}</strong> y en ninguna otra etapa: {usd(optCosto)} por
          año. Las etapas del medio no tienen stock de seguridad y le pasan el pedido de largo a la siguiente.
        </p>

        <h4>Contra las reglas intuitivas</h4>
        <table className="data">
          <tbody>
            {intuitivas.map((x) => (
              <tr key={x.nombre}>
                <td>{x.nombre}</td>
                <td className="r">{usd(costoDe(x.tramos))}</td>
                <td className="r muted">+{Math.round((100 * costoDe(x.tramos)) / optCosto - 100)}%</td>
              </tr>
            ))}
            <tr className="active">
              <td>Óptimo ({nombreTramos(opt.tramos)})</td>
              <td className="r">
                <strong>{usd(optCosto)}</strong>
              </td>
              <td />
            </tr>
          </tbody>
        </table>

        <h4>Las {todas.length} formas de partir la cadena</h4>
        <BarrasColocaciones v={v} todas={todas} />
        <p className="muted small">
          Con {N} etapas hay {todas.length} particiones posibles (cada una de las {N - 1} uniones entre etapas se corta o no).
          Con 50 etapas serían más de 500 billones: por eso se usa programación dinámica o el PL.
        </p>

        <h4>Programación dinámica: el camino más corto</h4>
        <p className="small">
          <em>f(j)</em> es el menor costo para cubrir las primeras <em>j</em> etapas. Cada una mira todas las formas de
          terminar su último tramo:
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Hasta</th>
              <th className="r">f(j)</th>
              <th>Último tramo</th>
            </tr>
          </thead>
          <tbody>
            {E.map((e, k) => {
              const j = k + 1;
              const i = opt.dp.desde[j];
              return (
                <tr key={e.id}>
                  <td>{e.corto}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    {usd(opt.dp.f[j])}
                  </td>
                  <td>
                    {i === k ? E[k].corto : `${E[i].corto} → ${E[k].corto}`} ({nrtTramo(C, i, k)} días de stock en {E[k].corto})
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h4>¿Y si les prometés más días a los supermercados?</h4>
        <label className="slider">
          <span>
            Entrega prometida: <b>{servicio}</b> {servicio === 1 ? 'día' : 'días'}
          </span>
          <input type="range" min={0} max={10} step={1} value={servicio} onChange={(x) => setServicio(Number(x.target.value))} />
        </label>
        <CadenaTramos v={{ ...v, cadena: otro }} tramos={optS.tramos} />
        <p>
          Stock en <strong>{nombreTramos(optS.tramos)}</strong>: {usd(optSCosto)} por año
          {servicio !== C.servicio && ` (${optSCosto < optCosto ? '−' : '+'}${usd(Math.abs(optCosto - optSCosto))} contra prometer ${C.servicio})`}. Cada día
          de plazo que acepta el cliente es un día que la cadena no tiene que cubrir con stock.
        </p>

        <div className="note">
          <p>
            Si te interesa el código, hay una implementación clara en GitHub:{' '}
            <a href={REPO_EJEMPLO} target="_blank" rel="noopener noreferrer">
              multi-echelon-inventory-optimization
            </a>
            . Resuelve este mismo modelo en serie en Python y en C++, con la programación dinámica exacta, la heurística de
            "stock en todas las etapas" y un modelo entero con PuLP.
          </p>
        </div>
      </div>
    );
  };
}

/** La cadena como una fila de etapas; cada tramo se marca con una llave y su stock al final. */
export function CadenaTramos({ v, tramos }: { v: VarianteStock; tramos: Tramo[] }) {
  const C = v.cadena;
  const E = C.etapas;
  const W = 640;
  const H = 96;
  const paso = (W - 20) / E.length;
  const x = (k: number) => 10 + k * paso;
  return (
    <svg className="grafico cadena-tramos" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Etapas de la cadena y dónde hay stock">
      {E.map((e, k) => {
        const tramo = tramos.find(([i, j]) => i <= k && k <= j);
        const conStock = !!tramo && tramo[1] === k && nrtTramo(C, tramo[0], tramo[1]) > 1e-9;
        return (
          <g key={e.id} className={`etapa ${conStock ? 'con-stock' : ''}`}>
            <title>
              {e.nombre} ({e.T} días){conStock && tramo ? ` · stock para ${nrtTramo(C, tramo[0], tramo[1])} días` : ''}
            </title>
            <rect x={x(k) + 4} y={14} width={paso - 8} height={34} rx={6} />
            <text className="etiqueta" x={x(k) + paso / 2} y={35} textAnchor="middle">
              {e.corto}
            </text>
            {conStock && <circle cx={x(k) + paso - 12} cy={20} r={7} />}
          </g>
        );
      })}
      {tramos.map(([i, j]) => (
        <g key={`${i}-${j}`} className="llave">
          <path d={`M${x(i) + 6},58 v8 H${x(j) + paso - 6} v-8`} />
          <text className="tick" x={(x(i) + x(j) + paso) / 2} y={84} textAnchor="middle">
            {nrtTramo(C, i, j) > 1e-9 ? `${nrtTramo(C, i, j)} días de stock` : 'sin stock (alcanza el plazo)'}
          </text>
        </g>
      ))}
    </svg>
  );
}

function BarrasColocaciones({ v, todas }: { v: VarianteStock; todas: { tramos: Tramo[]; costo: number }[] }) {
  const C = v.cadena;
  const E = C.etapas;
  const W = 640;
  const fila = 20;
  const top = 22;
  const celda = 30;
  const L = E.length * celda + 16;
  const H = top + todas.length * fila + 6;
  const max = Math.max(...todas.map((t) => t.costo));
  const ancho = (c: number) => ((W - L - 90) * c) / max;
  return (
    <svg className="grafico colocaciones" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Costo de cada forma de partir la cadena">
      {E.map((e, k) => (
        <text key={e.id} className="tick" x={k * celda + celda / 2} y={top - 6} textAnchor="middle">
          <title>{e.nombre}</title>
          {e.corto.split(' ')[0].slice(0, 3)}
        </text>
      ))}
      {todas.map((t, k) => {
        const con = etapasConStock(C, t.tramos);
        const y = top + k * fila;
        return (
          <g key={k} className={k === 0 ? 'optima' : ''}>
            <title>
              {con.length ? con.map((j) => E[j].corto).join(' + ') : 'sin stock'}: {usd(t.costo)} por año
            </title>
            {E.map((e, j) => (
              <rect key={e.id} className={`casilla ${con.includes(j) ? 'con-stock' : ''}`} x={j * celda + 3} y={y + 4} width={celda - 6} height={fila - 8} rx={2} />
            ))}
            <rect className="barra" x={L} y={y + 5} width={ancho(t.costo)} height={fila - 8} rx={3} />
            <text className="valor" x={L + ancho(t.costo) + 6} y={y + fila / 2 + 4}>
              {usd(t.costo)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
