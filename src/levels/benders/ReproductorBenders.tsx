import { useMemo } from 'react';
import { fasesBenders, flujoId, type Corte, type FaseBenders, type RondaTraza } from '../../engine/benders';
import { ConvergenceChart } from '../../ui/components/ConvergenceChart';
import { ControlesReproductor, useReproductor } from '../../ui/components/Reproductor';
import { Rich } from '../../ui/components/Rich';
import { Tex } from '../../ui/components/Tex';
import type { VarianteBenders } from './template';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });
const tx = (n: number) => fmt(n).replace(/\./g, '').replace(',', '{,}');

const TITULOS: Record<FaseBenders, string> = {
  maestro: 'El maestro propone',
  subproblema: 'El subproblema calcula el transporte',
  corte: 'El corte vuelve al maestro',
  fin: 'Fin: las cotas se tocan',
};

/** Nombre corto del lugar para fórmulas y el mapa ("D. Rosario" → "Rosario"). */
const corto = (s: string) => s.replace(/^D\.\s*/, '');

/**
 * Benders contado paso a paso: se puede reproducir entero o ir de a un paso.
 * Cada ronda tiene tres pasos: el maestro propone, el subproblema calcula, el corte vuelve.
 */
export function ReproductorBenders({ v, traza }: { v: VarianteBenders; traza: RondaTraza[] }) {
  const fases = useMemo(() => fasesBenders(traza), [traza]);
  const r = useReproductor(fases.length);
  const { k, fase } = fases[r.i];
  const t = traza[k];
  const orden: FaseBenders[] = ['maestro', 'subproblema', 'corte', 'fin'];
  const ya = (f: FaseBenders) => orden.indexOf(fase) >= orden.indexOf(f);

  const nombre = (id: string) => corto(v.depositos.find((d) => d.id === id)?.short ?? id);
  const lista = (ids: string[]) => ids.map(nombre).join(', ');
  const optima = traza.find((x) => Math.abs(x.ronda.total - t.ronda.mejor) < 1e-6) ?? t;
  // Al final se muestra la apertura óptima; antes, la de la ronda.
  const vista = fase === 'fin' ? optima : t;
  const abiertos = new Set(vista.ronda.abiertos);
  const demanda = v.clientes.reduce((s, c) => s + c.demanda, 0);
  const fijo = t.ronda.costoFijo;
  const mejorAntes = k > 0 ? traza[k - 1].ronda.mejor : Infinity;
  const lbAntes = t.maestro.cotaInferior;
  const combinaciones = 2 ** v.depositos.length;

  const corteTex = (c: Corte) => {
    const partes = Object.entries(c.coefs)
      .filter(([, x]) => Math.abs(x) > 1e-6)
      .map(([d, x]) => `${x < 0 ? '-' : '+'} ${tx(Math.abs(x))}\\, y_{\\text{${nombre(d)}}}`);
    return `\\theta \\geq ${tx(c.constante)} ${partes.join(' ')}`;
  };

  // Montos en $k por semana, sin signo: en `Rich` el "$" abre LaTeX.
  let texto = '';
  if (fase === 'maestro') {
    const cabeza = `**Ronda ${k + 1}.** `;
    if (k === 0)
      texto = `${cabeza}Sin cortes, el maestro no sabe nada del transporte: cree que es **gratis** ($\\theta = 0$). Sólo le pide a la capacidad que alcance los ${demanda} camiones de demanda, así que abre lo más barato que alcanza: **${lista(t.maestro.abiertos)}**, con ${fmt(fijo)} de costo fijo (todo en miles de pesos por semana). Su cota inferior es **${fmt(lbAntes)}**: nadie puede gastar menos.`;
    else if (t.maestro.theta < 1e-6)
      texto = `${cabeza}El maestro tiene ${k} ${k === 1 ? 'corte' : 'cortes'}, pero ninguno le cobra transporte a esta apertura: para **${lista(t.maestro.abiertos)}** todos dan $\\theta \\geq$ algo negativo o cero, así que sigue creyendo que el transporte le sale gratis. Costo fijo ${fmt(fijo)}, cota inferior **${fmt(lbAntes)}**.`;
    else
      texto = `${cabeza}Con ${k} ${k === 1 ? 'corte' : 'cortes'} el maestro ya aprendió algo del transporte. Propone **${lista(t.maestro.abiertos)}** (costo fijo ${fmt(fijo)}) y estima el transporte en $\\theta = ${tx(t.maestro.theta)}$. Su cota inferior es $${tx(fijo)} + ${tx(t.maestro.theta)} = ${tx(lbAntes)}$.`;
  } else if (fase === 'subproblema') {
    const mejora = t.ronda.total < mejorAntes - 1e-6;
    texto = `Con esos depósitos fijos, el transporte es un LP chico (como el del nivel 3). El subproblema lo resuelve: cuesta **${fmt(t.ronda.transporte)}**, y el maestro esperaba ${fmt(t.maestro.theta)}. El costo real de la apertura es $${tx(fijo)} + ${tx(t.ronda.transporte)} = ${tx(t.ronda.total)}$. ${
      mejora
        ? k === 0
          ? 'Es la primera solución real: la **cota superior** arranca ahí.'
          : `Es la mejor hasta ahora: la **cota superior** baja de ${fmt(mejorAntes)} a **${fmt(t.ronda.total)}**.`
        : `No mejora a la mejor encontrada (${fmt(mejorAntes)}), pero sirve igual: de acá sale un corte.`
    }`;
  } else if (fase === 'corte') {
    const ahorros = Object.entries(t.ronda.corte.coefs)
      .filter(([, x]) => x < -1e-6)
      .sort((a, b) => a[1] - b[1]);
    const lectura = ahorros.length
      ? ` Se lee así: abrir ${nombre(ahorros[0][0])} bajaría el transporte a lo sumo ${fmt(-ahorros[0][1])}.`
      : ' No tiene términos en $y$: dice que, abra lo que abra, el transporte cuesta al menos eso.';
    texto = `Con los **precios sombra** del transporte (demanda $u_c$, capacidad $v_d$) se arma un corte que vale para **cualquier** apertura. Para la que se probó da exactamente ${fmt(t.ronda.transporte)}; para las demás es una cota.${lectura} Con el corte nuevo, la cota inferior sube de ${fmt(lbAntes)} a **${fmt(t.ronda.cotaInferior)}**. Brecha: ${fmt(t.ronda.mejor - t.ronda.cotaInferior)}.`;
  } else {
    const ronda = traza.indexOf(optima) + 1;
    texto = `La cota inferior llegó a la mejor solución: **${fmt(t.ronda.mejor)}**. Está **demostrado** que abrir **${lista(optima.ronda.abiertos)}** es óptimo.`;
    texto += ` Se encontró en la ronda ${ronda}${ronda < traza.length ? `, pero hicieron falta ${traza.length - ronda} rondas más para probar que nada es mejor` : ''}, evaluando ${traza.length} de las ${combinaciones} combinaciones posibles.`;
  }

  // Gráfico: la propuesta y la mejor aparecen con el subproblema, la cota con el corte.
  const serie = (f: (x: RondaTraza) => number, desde: FaseBenders) =>
    traza.map((x, j) => (j < k || (j === k && ya(desde)) ? f(x) : null));
  const todos = traza.flatMap((x) => [x.ronda.total, x.ronda.cotaInferior, x.maestro.cotaInferior]);

  const cortes = traza.slice(0, ya('corte') ? k + 1 : k).map((x) => x.ronda.corte);

  return (
    <div className="repro-benders">
      <ControlesReproductor r={r} />
      <p className="repro-paso">
        <span className="muted">
          Ronda {k + 1} de {traza.length} · paso {r.i + 1} de {fases.length}
        </span>{' '}
        <strong>{TITULOS[fase]}</strong>
      </p>
      <p className="repro-texto">
        <Rich text={texto} />
      </p>

      <div className="repro-grid">
        <div>
          <MapaBenders v={v} abiertos={abiertos} flujos={ya('subproblema') ? vista.flujos : null} />
          <div className="bounds">
            <span className="muted">fijo + transporte</span>
            {fase === 'fin' ? (
              <span>
                Óptimo: {fmt(optima.ronda.costoFijo)} + {fmt(optima.ronda.transporte)} = <strong>{fmt(optima.ronda.total)}</strong>
              </span>
            ) : (
              <span>
                Según el maestro: {fmt(fijo)} + {fmt(t.maestro.theta)} = <strong>{fmt(lbAntes)}</strong>
              </span>
            )}
            {ya('subproblema') && fase !== 'fin' && (
              <span>
                Real: {fmt(fijo)} + {fmt(t.ronda.transporte)} = <strong>{fmt(t.ronda.total)}</strong>
              </span>
            )}
          </div>
        </div>
        <div>
          <h5>Depósitos</h5>
          <table className="data rounds">
            <thead>
              <tr>
                <th>Depósito</th>
                <th className="r">Fijo</th>
                <th className="r">Capac.</th>
                <th className="r">¿Abre?</th>
                {fase === 'corte' && <th className="r">En el corte</th>}
              </tr>
            </thead>
            <tbody>
              {v.depositos.map((d) => (
                <tr key={d.id} className={abiertos.has(d.id) ? 'active' : ''}>
                  <td>{nombre(d.id)}</td>
                  <td className="r">{d.costoFijo}</td>
                  <td className="r">{d.capacidad}</td>
                  <td className="r">{abiertos.has(d.id) ? 'sí' : '—'}</td>
                  {fase === 'corte' && <td className="r">{fmt(t.ronda.corte.coefs[d.id] ?? 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          <h5>Cortes del maestro ({cortes.length})</h5>
          {cortes.length === 0 ? (
            <p className="muted small">Todavía ninguno: el maestro sólo pide capacidad ≥ {demanda}.</p>
          ) : (
            // Del más nuevo al más viejo, para que el último siempre se vea.
            <ol className="repro-cortes" reversed>
              {cortes
                .map((c, j) => (
                  <li key={j} value={j + 1} className={j === k && fase === 'corte' ? 'nuevo' : ''}>
                    <Tex tex={corteTex(c)} />
                  </li>
                ))
                .reverse()}
            </ol>
          )}
        </div>
      </div>

      <ConvergenceChart
        yLabel="Costo ($k/sem)"
        rondas={traza.length}
        dominio={[Math.min(...todos), Math.max(...todos)]}
        marca={k}
        series={[
          { label: 'propuesta del maestro', values: serie((x) => x.ronda.total, 'subproblema'), className: 'propuesta' },
          { label: 'mejor solución', values: serie((x) => x.ronda.mejor, 'subproblema'), className: 'cota-superior' },
          { label: 'cota inferior', values: serie((x) => x.ronda.cotaInferior, 'corte'), className: 'cota-inferior' },
        ]}
      />
    </div>
  );
}

/** Mapa chiquito: depósitos (abiertos o no), clientes y, si ya se resolvió el transporte, los envíos. */
function MapaBenders({ v, abiertos, flujos }: { v: VarianteBenders; abiertos: Set<string>; flujos: Record<string, number> | null }) {
  const todos = [...v.depositos, ...v.clientes];
  const xs = todos.map((l) => l.x);
  const ys = todos.map((l) => l.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // Margen extra a la derecha para los nombres.
  const W = 340;
  const H = Math.max(160, Math.round((W * (y1 - y0 + 2)) / (x1 - x0 + 3.5)));
  const sx = (x: number) => ((x - x0 + 1) / (x1 - x0 + 3.5)) * W;
  // Si hay otro cliente pegado a la derecha, el nombre va a la izquierda.
  const aLaIzquierda = (c: (typeof v.clientes)[number]) =>
    v.clientes.some((o) => o !== c && o.x > c.x && o.x - c.x <= 2 && Math.abs(o.y - c.y) < 0.6);
  const sy = (y: number) => H - ((y - y0 + 1) / (y1 - y0 + 2)) * H;
  const maxQ = Math.max(...v.clientes.map((c) => c.demanda));

  return (
    <svg className="mapa-benders" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Mapa de depósitos y clientes">
      {flujos &&
        v.depositos.flatMap((d) =>
          v.clientes.map((c) => {
            const q = flujos[flujoId(d.id, c.id)] ?? 0;
            return q > 1e-6 ? (
              <line key={`${d.id}-${c.id}`} className="envio" x1={sx(d.x)} y1={sy(d.y)} x2={sx(c.x)} y2={sy(c.y)} strokeWidth={1 + (4 * q) / maxQ}>
                <title>{`${corto(d.short)} → ${c.short}: ${fmt(q)} camiones`}</title>
              </line>
            ) : null;
          }),
        )}
      {v.clientes.map((c) => (
        <g key={c.id} className="cliente">
          <circle cx={sx(c.x)} cy={sy(c.y)} r={3 + (4 * c.demanda) / maxQ} />
          <text x={sx(c.x) + (aLaIzquierda(c) ? -8 : 8)} y={sy(c.y) + 4} textAnchor={aLaIzquierda(c) ? 'end' : 'start'}>
            {c.short}
          </text>
        </g>
      ))}
      {v.depositos.map((d) => (
        <rect
          key={d.id}
          className={`deposito ${abiertos.has(d.id) ? 'abierto' : ''}`}
          x={sx(d.x) - 7}
          y={sy(d.y) - 7}
          width={14}
          height={14}
          rx={2}
        >
          <title>{`${d.label}${abiertos.has(d.id) ? ' (abierto)' : ''}`}</title>
        </rect>
      ))}
    </svg>
  );
}
