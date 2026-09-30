import type { ComponentType } from 'react';
import { CasoAmbulancias } from './ambulancias/CasoAmbulancias';
import { MiniaturaAmbulancias } from './ambulancias/Miniatura';
import { CasoBicis } from './bicis/CasoBicis';
import { MiniaturaBicis } from './bicis/Miniatura';
import { CasoResiliencia } from './resiliencia/CasoResiliencia';
import { MiniaturaResiliencia } from './resiliencia/Miniatura';

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
  {
    id: 'caso-bicis',
    codigo: 'C2',
    title: 'Bicis para la hora pico',
    client: 'Ecobici · datos reales del Centro porteño',
    technique: 'Bootstrap de datos históricos · SAA · validación temporal',
    Pagina: CasoBicis,
    Miniatura: MiniaturaBicis,
  },
  {
    id: 'caso-resiliencia',
    codigo: 'C3',
    title: '¿Qué pieza te para la fábrica?',
    client: 'Agro Pampa · maquinaria agrícola (ficticia)',
    technique: 'Riesgo en la cadena de suministro · TTS/TTR · PL por escenario',
    Pagina: CasoResiliencia,
    Miniatura: MiniaturaResiliencia,
  },
];
