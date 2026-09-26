import type { Level } from './types';
import { campanaMarketing } from './campana-marketing';
import { nivelesAsignacion } from './asignacion';
import { nivelesCiudad } from './ciudad';
import { nivelesPlanificacion } from './planificacion';
import { nivelesRuteo } from './ruteo';
import { plantaAgua } from './planta-agua';
import { transporteLacteos } from './transporte-lacteos';

/** Registro de niveles en orden de juego. Para agregar uno: crear su carpeta y sumarlo acá. */
export const LEVELS: Level[] = [plantaAgua, campanaMarketing, transporteLacteos, ...nivelesAsignacion, ...nivelesPlanificacion, ...nivelesRuteo, ...nivelesCiudad];
