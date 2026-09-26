import { sobrante, type Patron, type ProblemaCorte } from '../../engine/columnas';

/** Colores de cada pedido (en el orden de los pedidos), compartidos con la escena. */
export const COLORES_PIEZA = [0x3d8bfd, 0x86b886, 0xd9a441, 0x9b7fd1, 0xb9b3a2, 0x2a6fd6];
export const colorCss = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Una bobina vista desde arriba: las piezas del patrón, en escala, y lo que sobra. */
export function PatronBar({ P, p, compact = false }: { P: ProblemaCorte; p: Patron; compact?: boolean }) {
  const piezas = P.pedidos.flatMap((q, i) => Array.from({ length: Math.max(0, p[q.id] ?? 0) }, () => ({ q, i })));
  const resto = sobrante(P, p);
  return (
    <div className={`bobina-bar ${compact ? 'compact' : ''} ${resto < 0 ? 'excede' : ''}`} title={`sobran ${resto} cm`}>
      {piezas.map(({ q, i }, k) => (
        <span key={k} className="seg" style={{ flexGrow: q.ancho, background: colorCss(COLORES_PIEZA[i % COLORES_PIEZA.length]) }}>
          {!compact && q.ancho}
        </span>
      ))}
      {resto > 0 && (
        <span className="sobra" style={{ flexGrow: resto }}>
          {!compact && resto >= 10 ? resto : ''}
        </span>
      )}
    </div>
  );
}
