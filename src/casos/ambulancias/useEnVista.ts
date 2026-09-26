import { useEffect, useRef, useState } from 'react';

/** true la primera vez que el elemento entra en pantalla (para disparar animaciones al scrollear). */
export function useEnVista<T extends Element>(margen = '-15% 0px'): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visto) return;
    if (typeof IntersectionObserver === 'undefined') return setVisto(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setVisto(true), io.disconnect()), { rootMargin: margen });
    io.observe(el);
    return () => io.disconnect();
  }, [visto, margen]);
  return [ref, visto];
}
