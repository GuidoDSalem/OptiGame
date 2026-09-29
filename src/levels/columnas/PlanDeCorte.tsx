import { describir, patronDeVariable, sobrante, type Patron, type ProblemaCorte } from '../../engine/columnas';
import { COLORES_PIEZA, PatronBar, colorCss } from './PatronBar';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const letra = (k: number) => String.fromCharCode(65 + (k % 26)) + (k >= 26 ? String(Math.floor(k / 26)) : '');
/** Más bobinas que esto se muestran sólo con el número. */
const MAX_ICONOS = 40;

/**
 * La solución como plan de corte: cada patrón usado con sus bobinas, y cómo esos cortes
 * cubren las piezas de cada pedido (y cuántas sobran).
 */
export function PlanDeCorte({ P, values }: { P: ProblemaCorte; values: Record<string, number> }) {
  const usados = Object.entries(values)
    .map(([k, n]) => ({ p: patronDeVariable(P, k), n }))
    .filter((u): u is { p: Patron; n: number } => u.p !== null && u.n > 1e-6)
    .sort((a, b) => b.n - a.n)
    .map((u, k) => ({ ...u, letra: letra(k) }));
  if (!usados.length) return null;

  const bobinas = usados.reduce((s, u) => s + u.n, 0);
  const tirado = usados.reduce((s, u) => s + u.n * Math.max(0, sobrante(P, u.p)), 0);
  const pedidos = P.pedidos.map((q, i) => {
    const aportes = usados.map((u) => ({ letra: u.letra, piezas: u.n * (u.p[q.id] ?? 0) })).filter((a) => a.piezas > 1e-6);
    return { q, i, aportes, hecho: aportes.reduce((s, a) => s + a.piezas, 0) };
  });
  const deMas = pedidos
    .filter((x) => x.hecho > x.q.cantidad + 1e-6)
    .map((x) => `${fmt(x.hecho - x.q.cantidad)} de ${x.q.ancho} cm`);
  const escala = Math.max(...pedidos.map((x) => Math.max(x.hecho, x.q.cantidad)));
  const pct = (n: number) => `${(100 * n) / escala}%`;

  return (
    <div className="plan-corte">
      <h4>Plan de corte</h4>
      <p className="muted small">
        {fmt(bobinas)} bobinas de {P.ancho} cm con {usados.length} patrones. Se tiran {fmt(tirado)} cm de recortes (
        {fmt((100 * tirado) / (bobinas * P.ancho))}% del papel)
        {deMas.length ? ` y salen piezas de más: ${deMas.join(', ')}.` : '.'}
      </p>
      <div className="plan-patrones">
        {usados.map((u) => {
          const entero = Math.abs(u.n - Math.round(u.n)) < 1e-6;
          const iconos = entero && u.n <= MAX_ICONOS ? Math.round(u.n) : 0;
          return (
            <div key={u.letra} className="plan-patron">
              <span className="plan-letra">{u.letra}</span>
              <div className="plan-barra">
                <PatronBar P={P} p={u.p} />
                <span className="cut">
                  {describir(P, u.p)} · sobran {sobrante(P, u.p)} cm
                </span>
              </div>
              <div className="plan-veces">
                <strong>× {fmt(u.n)}</strong> {u.n === 1 ? 'bobina' : 'bobinas'}
                {iconos > 0 && (
                  <span className="plan-rollos" aria-hidden>
                    {Array.from({ length: iconos }, (_, k) => (
                      <i key={k} />
                    ))}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <h4>Cómo se cubre cada pedido</h4>
      <div className="plan-demanda">
        {pedidos.map(({ q, i, aportes, hecho }) => {
          const color = colorCss(COLORES_PIEZA[i % COLORES_PIEZA.length]);
          const extra = hecho - q.cantidad;
          return (
            <div key={q.id} className="plan-pedido">
              <span className="plan-nombre">
                <strong>{q.ancho} cm</strong> <span className="muted">{q.cantidad} piezas</span>
              </span>
              <div className="plan-pista">
                <div className="plan-aportes" style={{ width: pct(hecho) }}>
                  {aportes.map((a) => (
                    <span
                      key={a.letra}
                      style={{ flexGrow: a.piezas, background: color }}
                      title={`Patrón ${a.letra}: ${fmt(a.piezas)} piezas`}
                    >
                      {a.letra} · {fmt(a.piezas)}
                    </span>
                  ))}
                </div>
                {extra > 1e-6 && <div className="plan-sobra" style={{ left: pct(q.cantidad), width: pct(extra) }} />}
                <div className="plan-meta" style={{ left: pct(q.cantidad) }} title={`Pedido: ${q.cantidad} piezas`} />
              </div>
              <span className={`plan-cuenta ${hecho < q.cantidad - 1e-6 ? 'falta' : ''}`}>
                {fmt(hecho)} / {q.cantidad}
                {extra > 1e-6 && <span className="muted"> (+{fmt(extra)})</span>}
              </span>
            </div>
          );
        })}
      </div>
      <p className="muted small">
        Cada tramo es lo que aporta un patrón (bobinas × piezas por bobina). La línea marca lo pedido; lo rayado son
        piezas de más.
      </p>
    </div>
  );
}
