import { useMemo } from 'react';
import {
  describir,
  fasesDeLaTraza,
  patronId,
  sobrante,
  todosLosPatrones,
  variableId,
  type EstadoColumnas,
  type FaseColumnas,
  type ProblemaCorte,
} from '../../engine/columnas';
import { ConvergenceChart } from '../../ui/components/ConvergenceChart';
import { ControlesReproductor, useReproductor } from '../../ui/components/Reproductor';
import { Rich } from '../../ui/components/Rich';
import { Tex } from '../../ui/components/Tex';
import { COLORES_PIEZA, PatronBar, colorCss } from './PatronBar';

const fmt = (n: number, d = 3) => n.toLocaleString('es-AR', { maximumFractionDigits: d });
const tx = (n: number, d = 3) => fmt(n, d).replace(',', '{,}');

const TITULOS: Record<FaseColumnas, string> = {
  maestro: 'Resolver el maestro',
  precios: 'Leer los precios sombra',
  pricing: 'Pricing: la mochila',
  agrega: 'Agregar la columna',
  fin: 'Fin: no hay columna que convenga',
};

interface Props {
  P: ProblemaCorte;
  /** Estados de la generación de columnas: el arranque y uno por ronda. */
  traza: EstadoColumnas[];
  /** Bobinas del modelo entero con los patrones generados, si ya se calculó. */
  entero?: number;
}

/**
 * La generación de columnas contada paso a paso: se puede reproducir entera o ir de a un paso.
 * Cada ronda tiene cuatro pasos: maestro, precios sombra, pricing y columna nueva (o fin).
 */
export function ReproductorColumnas({ P, traza, entero }: Props) {
  const fases = useMemo(() => fasesDeLaTraza(traza), [traza]);
  const catalogo = useMemo(() => todosLosPatrones(P).length, [P]);
  const r = useReproductor(fases.length);
  const { i } = r;

  const { k, fase } = fases[i];
  const e = traza[k];
  const previo = k > 0 ? traza[k - 1] : null;
  const orden = ['maestro', 'precios', 'pricing', 'agrega', 'fin'];
  const ya = (f: FaseColumnas) => orden.indexOf(fase) >= orden.indexOf(f);
  const pi = e.maestro.duales;
  const v = e.sugerido.valor;
  const cr = 1 - v;
  const nombre = (idx: number) => `P_{${idx + 1}}`;
  const idxNuevo = e.patrones.length; // índice que tendrá el patrón del pricing si entra

  // Gráfico: el maestro aparece al resolverlo, la cota al hacer el pricing.
  const lps = traza.map((t, j) => (j <= k ? t.maestro.objetivo : null));
  const cotas = traza.map((t, j) => (j < k || (j === k && ya('pricing')) ? t.cotaInferior : null));
  const todos = traza.flatMap((t) => [t.maestro.objetivo, t.cotaInferior]);

  const usados = e.patrones
    .map((p, j) => ({ p, j, x: e.maestro.x[variableId(P, p)] ?? 0 }))
    .filter((u) => u.x > 1e-6);
  const porCm = P.pedidos.map((q) => ({ q, r: (pi[q.id] ?? 0) / q.ancho })).sort((a, b) => b.r - a.r);

  let texto = '';
  if (fase === 'maestro') {
    texto = previo
      ? `**Ronda ${k}.** El maestro ahora tiene ${e.patrones.length} patrones: se agregó $${nombre(e.patrones.length - 1)}$ = ${describir(P, e.patrones[e.patrones.length - 1])}. Se vuelve a resolver la relajación y el total baja de ${fmt(previo.maestro.objetivo)} a **${fmt(e.maestro.objetivo)}** bobinas (${fmt(e.maestro.objetivo - previo.maestro.objetivo)}). Usa ${usados.length} patrones.`
      : `**Arranque.** El maestro restringido tiene sólo los ${e.patrones.length} patrones obvios: cada bobina corta un solo ancho. Se resuelve su **relajación lineal** (vale cortar fracciones de bobina) y da **${fmt(e.maestro.objetivo)}** bobinas. Es una cota superior de lo que se puede lograr con todos los patrones: con más columnas sólo puede bajar.`;
  } else if (fase === 'precios') {
    const top = porCm[0];
    texto = `El solver devuelve, junto con la solución, un **precio sombra** $\\pi_i$ por pedido: cuántas bobinas se ahorrarían si se pidiera una pieza menos. La más cara por centímetro es la de **${top.q.ancho} cm** (${fmt(top.r, 4)} bobinas por cm)${porCm[porCm.length - 1].r < 1e-9 ? '; las que valen 0 sobran en la solución actual' : ''}. Con estos precios, una bobina "vale" lo que suman sus piezas.`;
  } else if (fase === 'pricing') {
    texto =
      v > 1 + 1e-7
        ? `El pricing busca, entre **todos** los ${catalogo} patrones posibles y sin enumerarlos, el que más vale: una mochila de ${P.ancho} cm con piezas de valor $\\pi_i$. El mejor es **${describir(P, e.sugerido.patron)}**, que vale $v^* = ${tx(v)}$ bobinas. Su costo reducido es $1 - v^* = ${tx(cr)} < 0$: cortar una bobina así devuelve más de lo que cuesta. Además, como ninguna bobina vale más que $v^*$, hacen falta al menos $z / v^* = ${tx(e.maestro.objetivo)} / ${tx(v)} = ${tx(e.maestro.objetivo / v)}$ bobinas (cota de Farley).`
        : `El pricing busca el patrón más valioso con estos precios, y el mejor (**${describir(P, e.sugerido.patron)}**) vale $v^* = ${tx(v)}$: **ninguna** bobina vale más de 1. Todo costo reducido es $\\geq 0$, y la cota de Farley $z / v^*$ toca al maestro.`;
  } else if (fase === 'agrega') {
    texto = `El patrón entra al maestro como una **columna nueva** $x_{${nombre(idxNuevo)}}$: en la fila de cada pedido, las piezas que aporta. Cuesta 1 en el objetivo, como todas. Con una opción más, el maestro sólo puede mejorar: a resolverlo de nuevo.`;
  } else {
    texto = `Ningún patrón tiene costo reducido negativo, así que la relajación de **${fmt(e.maestro.objetivo)}** bobinas es óptima para **todos** los ${catalogo} patrones, aunque sólo se escribieron ${e.patrones.length}. Como no se corta media bobina, hacen falta al menos $\\lceil ${tx(e.maestro.objetivo)} \\rceil = ${Math.ceil(e.maestro.objetivo - 1e-6)}$${entero !== undefined ? `; el modelo entero con estos patrones usa **${entero}**${entero === Math.ceil(e.maestro.objetivo - 1e-6) ? ': es óptimo' : ''}.` : '.'}`;
  }

  const columnaTex = `x_{${nombre(idxNuevo)}}:\\; \\begin{pmatrix} ${P.pedidos.map((q) => e.sugerido.patron[q.id] ?? 0).join(' \\\\ ')} \\end{pmatrix}`;
  const etiquetasTex = `\\begin{matrix} ${P.pedidos.map((q) => `\\text{${q.ancho} cm}`).join(' \\\\ ')} \\end{matrix}`;

  return (
    <div className="repro-columnas">
      <ControlesReproductor r={r} />

      <p className="repro-paso">
        <span className="muted">
          {k === 0 ? 'Arranque' : `Ronda ${k}`} · paso {i + 1} de {fases.length}
        </span>{' '}
        <strong>{TITULOS[fase]}</strong>
      </p>
      <p className="repro-texto">
        <Rich text={texto} />
      </p>

      <div className="repro-grid">
        <div>
          <h5>Maestro restringido · z = {fmt(e.maestro.objetivo)}</h5>
          <table className="data rounds">
            <thead>
              <tr>
                <th>Patrón</th>
                <th />
                <th className="r">Sobra</th>
                <th className="r">x (relajación)</th>
              </tr>
            </thead>
            <tbody>
              {e.patrones.map((p, j) => {
                const x = e.maestro.x[variableId(P, p)] ?? 0;
                const nuevo = previo !== null && j === e.patrones.length - 1;
                return (
                  <tr key={patronId(P, p)} className={`${x > 1e-6 ? 'active' : ''} ${nuevo && fase === 'maestro' ? 'nuevo' : ''}`}>
                    <td>
                      <Tex tex={nombre(j)} />
                      {nuevo && <span className="tag">nuevo</span>}
                    </td>
                    <td>
                      <PatronBar P={P} p={p} compact />
                      <span className="cut">{describir(P, p)}</span>
                    </td>
                    <td className="r">{sobrante(P, p)} cm</td>
                    <td className="r">{x > 1e-6 ? fmt(x) : '—'}</td>
                  </tr>
                );
              })}
              {fase === 'agrega' && (
                <tr className="entrando">
                  <td>
                    <Tex tex={nombre(idxNuevo)} />
                    <span className="tag">entra</span>
                  </td>
                  <td>
                    <PatronBar P={P} p={e.sugerido.patron} compact />
                    <span className="cut">{describir(P, e.sugerido.patron)}</span>
                  </td>
                  <td className="r">{sobrante(P, e.sugerido.patron)} cm</td>
                  <td className="r">?</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h5>Precios sombra</h5>
          <table className="data pricing">
            <thead>
              <tr>
                <th>Pieza</th>
                <th className="r">π</th>
                <th className="r">π por cm</th>
                {ya('pricing') && <th className="r">En el patrón</th>}
              </tr>
            </thead>
            <tbody>
              {P.pedidos.map((q, j) => (
                <tr key={q.id}>
                  <td>
                    <span className="dot" style={{ background: colorCss(COLORES_PIEZA[j % COLORES_PIEZA.length]) }} />
                    {q.ancho} cm
                  </td>
                  <td className={`r ${ya('precios') ? '' : 'oculto'}`}>{ya('precios') ? fmt(pi[q.id] ?? 0) : '·'}</td>
                  <td className={`r ${ya('precios') ? '' : 'oculto'}`}>{ya('precios') ? fmt((pi[q.id] ?? 0) / q.ancho, 4) : '·'}</td>
                  {ya('pricing') && <td className="r">{e.sugerido.patron[q.id] ?? 0}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          {ya('pricing') && (
            <div className="repro-mochila">
              <h5>Mejor patrón con estos precios</h5>
              <PatronBar P={P} p={e.sugerido.patron} />
              <p className="small">
                Vale <strong>{fmt(v)}</strong> → costo reducido{' '}
                <strong className={cr < -1e-7 ? 'good' : ''}>{fmt(cr)}</strong>
                {cr < -1e-7 ? ': entra.' : ': no conviene, se termina.'}
              </p>
            </div>
          )}
          {fase === 'agrega' && (
            <div className="repro-columna">
              <Tex tex={`${etiquetasTex} \\quad ${columnaTex}`} block />
            </div>
          )}
        </div>
      </div>

      <ConvergenceChart
        yLabel="Bobinas"
        rondas={traza.length}
        primera={0}
        dominio={[Math.min(...todos), Math.max(...todos)]}
        marca={k}
        series={[
          { label: 'maestro (relajación)', values: lps, className: 'cota-superior' },
          { label: 'cota inferior (Farley)', values: cotas, className: 'cota-inferior' },
        ]}
      />
    </div>
  );
}
