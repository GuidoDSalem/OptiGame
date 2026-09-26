import { acopio } from './acopio';
import { crearNivelEstocastico, type VarianteEstocastica } from './template';

/** Versiones del nivel avanzado A4 (Benders estocástico). */
export const VARIANTES_ESTOCASTICO: VarianteEstocastica[] = [acopio];

export const nivelesEstocastico = VARIANTES_ESTOCASTICO.map(crearNivelEstocastico);
