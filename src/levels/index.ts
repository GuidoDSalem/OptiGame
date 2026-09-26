import type { Level } from './types';
import { campanaMarketing } from './campana-marketing';
import { plantaAgua } from './planta-agua';

/** Registro de niveles en orden de juego. Para agregar uno: crear su carpeta y sumarlo acá. */
export const LEVELS: Level[] = [plantaAgua, campanaMarketing];
