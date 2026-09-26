import { carpinteria } from './carpinteria';
import { crearNivelSolver, type VarianteSolver } from './template';

/** Versiones del nivel avanzado A1 (dentro del solver). */
export const VARIANTES_SOLVER: VarianteSolver[] = [carpinteria];

export const nivelesSolver = VARIANTES_SOLVER.map(crearNivelSolver);
