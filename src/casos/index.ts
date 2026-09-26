import type { ComponentType } from 'react';
import { CasoAmbulancias } from './ambulancias/CasoAmbulancias';
import { MiniaturaAmbulancias } from './ambulancias/Miniatura';

/**
 * Casos de estudio: páginas largas que se leen scrolleando (no tienen las 5 fases de un nivel).
 * Cuentan un análisis completo, de la situación a la recomendación.
 */
export interface CasoDeEstudio {
  id: string;
  codigo: string;
  title: string;
  client: string;
  technique: string;
  Pagina: ComponentType<{ onExit(): void }>;
  Miniatura: ComponentType;
}

export const CASOS: CasoDeEstudio[] = [
  {
    id: 'caso-ambulancias',
    codigo: 'C1',
    title: 'Ambulancias para una ciudad que no avisa',
    client: 'Servicio de Emergencias Municipal',
    technique: 'Simulación de Montecarlo · SAA',
    Pagina: CasoAmbulancias,
    Miniatura: MiniaturaAmbulancias,
  },
];
