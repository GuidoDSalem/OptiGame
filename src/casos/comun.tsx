import type { ReactNode } from 'react';
import { useEnVista } from './ambulancias/useEnVista';

/** Sección de un caso de estudio: aparece suave cuando entra en pantalla. */
export function Seccion({ n, titulo, children, className = '' }: { n?: number; titulo?: string; children: ReactNode; className?: string }) {
  const [ref, visto] = useEnVista<HTMLElement>();
  return (
    <section ref={ref} className={`paso ${visto ? 'visto' : ''} ${className}`}>
      {titulo && (
        <h2>
          {n !== undefined && <span className="num">{n}</span>}
          {titulo}
        </h2>
      )}
      {children}
    </section>
  );
}
