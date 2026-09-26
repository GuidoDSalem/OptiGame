import type { EstacionBici } from '../../engine/bicis';
import estaciones from './estaciones.json';
import { MapaCentro } from './MapaCentro';
import { ANCLAJES } from './modelo';

/** Miniatura del menú: las estaciones del Centro con un reparto ilustrativo (sin cargar los datos). */
export function MiniaturaBicis() {
  const E = estaciones as EstacionBici[];
  return <MapaCentro estaciones={E} capacidad={ANCLAJES} niveles={E.map((_, i) => ((i * 7) % 5) * 5)} compacto etiquetas="ninguna" />;
}
