import { crearNivelStock, type VarianteStock } from './template';
import { yerba } from './yerba';

/** Versiones del nivel avanzado A6 (stock de seguridad en varias etapas). */
export const VARIANTES_STOCK: VarianteStock[] = [yerba];

export const nivelesStock = VARIANTES_STOCK.map(crearNivelStock);
