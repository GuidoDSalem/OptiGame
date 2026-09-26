import { minera } from './minera';
import { crearNivelPlanificacion, type VariantePlanificacion } from './template';

/** Versiones del nivel 5. Para agregar una: definir la variante y sumarla acá. */
export const VARIANTES_PLANIFICACION: VariantePlanificacion[] = [minera];

export const nivelesPlanificacion = VARIANTES_PLANIFICACION.map(crearNivelPlanificacion);
