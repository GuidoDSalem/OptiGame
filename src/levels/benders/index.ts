import { cooperativa } from './cooperativa';
import { crearNivelBenders, type VarianteBenders } from './template';

/** Versiones del nivel avanzado A3 (Benders). */
export const VARIANTES_BENDERS: VarianteBenders[] = [cooperativa];

export const nivelesBenders = VARIANTES_BENDERS.map(crearNivelBenders);
