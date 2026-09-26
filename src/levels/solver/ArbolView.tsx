import type { Arbol, Nodo } from '../../engine/ramificacion';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

const ETIQUETA: Record<Nodo['estado'], string> = {
  abierto: 'abierto',
  ramificado: '',
  infactible: 'infactible',
  entero: 'entero',
  podado: 'podado',
};

/** El árbol de branch and bound: cada nodo es una relajación con cotas extra. */
export function ArbolView({ arbol, seleccionado, onSelect }: { arbol: Arbol; seleccionado?: number | null; onSelect?(id: number): void }) {
  const hijos = (id: number) => arbol.nodos.filter((n) => n.padre === id);
  const pos = new Map<number, { x: number; y: number }>();
  let hoja = 0;
  const ubicar = (n: Nodo): number => {
    const hs = hijos(n.id);
    const x = hs.length ? hs.map(ubicar).reduce((a, b) => a + b, 0) / hs.length : hoja++;
    pos.set(n.id, { x, y: n.profundidad });
    return x;
  };
  ubicar(arbol.nodos[0]);
  const hojas = Math.max(1, hoja);
  const prof = Math.max(...arbol.nodos.map((n) => n.profundidad)) + 1;
  const DX = 88;
  const DY = 76;
  const BW = 80;
  const BH = 40;
  const W = hojas * DX + 8;
  const H = prof * DY;
  const cx = (id: number) => 4 + pos.get(id)!.x * DX + DX / 2;
  const cy = (id: number) => 6 + pos.get(id)!.y * DY + BH / 2;

  return (
    <div className="arbol-wrap">
      <svg className="arbol" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        {arbol.nodos
          .filter((n) => n.padre !== null)
          .map((n) => (
            <g key={`e${n.id}`} className="edge">
              <line x1={cx(n.padre!)} y1={cy(n.padre!) + BH / 2} x2={cx(n.id)} y2={cy(n.id) - BH / 2} />
              <text x={(cx(n.padre!) + cx(n.id)) / 2 + (cx(n.id) < cx(n.padre!) ? -4 : 4)} y={(cy(n.padre!) + cy(n.id)) / 2 + 2} textAnchor={cx(n.id) < cx(n.padre!) ? 'end' : 'start'}>
                {n.rama}
              </text>
            </g>
          ))}
        {arbol.nodos.map((n) => {
          const sel = seleccionado === n.id;
          const inc = arbol.incumbente?.nodo === n.id;
          const clickable = onSelect && n.estado === 'abierto';
          return (
            <g
              key={n.id}
              className={`nodo ${n.estado} ${sel ? 'sel' : ''} ${inc ? 'inc' : ''}`}
              transform={`translate(${cx(n.id) - BW / 2}, ${cy(n.id) - BH / 2})`}
              onClick={clickable ? () => onSelect!(n.id) : undefined}
              style={clickable ? { cursor: 'pointer' } : undefined}
            >
              <rect width={BW} height={BH} rx={6} />
              {n.lp.factible ? (
                <>
                  <text x={BW / 2} y={15} textAnchor="middle" className="z">
                    z = {fmt(n.lp.z)}
                  </text>
                  <text x={BW / 2} y={30} textAnchor="middle" className="xy">
                    ({fmt(n.lp.x[0])} ; {fmt(n.lp.x[1])})
                  </text>
                </>
              ) : (
                <text x={BW / 2} y={24} textAnchor="middle" className="xy">
                  sin solución
                </text>
              )}
              {ETIQUETA[n.estado] && (
                <text x={BW / 2} y={BH + 11} textAnchor="middle" className="tag">
                  {inc ? 'mejor entera' : ETIQUETA[n.estado]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
