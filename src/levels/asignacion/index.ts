import { datacenter } from './datacenter';
import { escuela } from './escuela';
import { hospital } from './hospital';
import { crearNivelAsignacion, type VarianteAsignacion } from './template';

/** Versiones del nivel 4. Para agregar una: definir la variante y sumarla acá. */
export const VARIANTES_ASIGNACION: VarianteAsignacion[] = [escuela, hospital, datacenter];

export const nivelesAsignacion = VARIANTES_ASIGNACION.map(crearNivelAsignacion);
