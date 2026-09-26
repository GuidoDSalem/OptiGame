import { useEffect, useState } from 'react';
import { solve } from '../../engine/solver';
import type { Level } from '../../levels/types';
import { renderThumbnail } from '../../scene/thumbnail';

const cache = new Map<string, string>();

/** Miniatura estática de la escena del nivel, mostrando la solución óptima. */
export function LevelThumb({ level }: { level: Level }) {
  const [url, setUrl] = useState(() => cache.get(level.id));

  useEffect(() => {
    if (cache.has(level.id)) return;
    let alive = true;
    (async () => {
      const r = await solve(level.referenceModel);
      const values = r.status === 'optimal' ? r.values : {};
      const src = await renderThumbnail(level.scene, { values, evaluation: level.evaluate(values) });
      cache.set(level.id, src);
      if (alive) setUrl(src);
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [level]);

  return <div className="thumb">{url && <img src={url} alt="" />}</div>;
}
