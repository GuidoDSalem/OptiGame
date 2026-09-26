import { nuevaPampa } from './nueva-pampa';
import { crearNivelCiudad, type VarianteCiudad } from './template';

/** Versiones del nivel 7. Para agregar una: definir la variante y sumarla acá. */
export const VARIANTES_CIUDAD: VarianteCiudad[] = [nuevaPampa];

export const nivelesCiudad = VARIANTES_CIUDAD.map(crearNivelCiudad);
