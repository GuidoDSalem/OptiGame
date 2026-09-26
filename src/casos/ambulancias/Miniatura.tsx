import { useMemo } from 'react';
import { puntosDelDia, simularDia } from '../../engine/ambulancias';
import { CIUDAD as C, SEMILLA_MUESTRA } from './ciudad';
import { Mapa } from './Mapa';

/** Miniatura del menú: un día simulado sobre el mapa. */
export function MiniaturaAmbulancias() {
  const puntos = useMemo(() => puntosDelDia(C, simularDia(C, SEMILLA_MUESTRA, 0), 1), []);
  return <Mapa C={C} puntos={puntos} plan={(1 << C.bases.length) - 1} compacto />;
}
