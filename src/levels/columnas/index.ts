import { papelera } from './papelera';
import { crearNivelColumnas, type VarianteColumnas } from './template';

/** Versiones del nivel avanzado A2 (generación de columnas). */
export const VARIANTES_COLUMNAS: VarianteColumnas[] = [papelera];

export const nivelesColumnas = VARIANTES_COLUMNAS.map(crearNivelColumnas);
