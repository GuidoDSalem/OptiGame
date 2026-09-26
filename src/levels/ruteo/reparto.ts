import type { VarianteRuteo } from './template';

/** Versión "Reparto": una panadería reparte a comercios del barrio con una camioneta. */
export const reparto: VarianteRuteo = {
  id: 'ruteo-reparto',
  variant: 'Reparto',
  title: 'La vuelta del reparto',
  client: 'Reparto urbano',
  deposito: { id: 'dep', label: 'Panadería', short: 'Panadería', x: 0, y: 0 },
  clientes: [
    { id: 'alm', label: 'Almacén', short: 'Almacén', x: 2, y: 1 },
    { id: 'kio', label: 'Kiosco', short: 'Kiosco', x: 1, y: 4 },
    { id: 'caf', label: 'Café', short: 'Café', x: 3, y: 5 },
    { id: 'esc', label: 'Escuela', short: 'Escuela', x: 5, y: 2 },
    { id: 'ver', label: 'Verdulería', short: 'Verdulería', x: 7, y: 0 },
    { id: 'far', label: 'Farmacia', short: 'Farmacia', x: 8, y: 3 },
    { id: 'clu', label: 'Club', short: 'Club', x: 6, y: 5 },
  ],
  vocab: { vehiculo: 'la camioneta', unidad: 'cuadras' },
  historia: [
    {
      type: 'p',
      text: 'La panadería **La Espiga** reparte todas las mañanas con una sola camioneta. El repartidor sale de la panadería, pasa por cada comercio **una vez** y vuelve. Hoy lo hace "de memoria", y el dueño sospecha que da vueltas de más.',
    },
  ],
};
