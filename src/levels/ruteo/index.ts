import { reparto } from './reparto';
import { crearNivelRuteo, type VarianteRuteo } from './template';

/** Versiones del nivel 6. Para agregar una: definir la variante y sumarla acá. */
export const VARIANTES_RUTEO: VarianteRuteo[] = [reparto];

export const nivelesRuteo = VARIANTES_RUTEO.map(crearNivelRuteo);
