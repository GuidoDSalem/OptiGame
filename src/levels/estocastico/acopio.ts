import type { VarianteEstocastica } from './template';

/** Versión "Acopio": una cooperativa decide qué plantas de acopio abrir antes de saber cómo viene la cosecha. */
export const acopio: VarianteEstocastica = {
  id: 'estocastico-acopio',
  variant: 'Acopio de granos',
  title: 'Cuando llueve y cuando no',
  client: 'Cooperativa Agrícola del Oeste',
  // Coordenadas en un mapa de la región (unidades de ~15 km).
  plantas: [
    { id: 'jun', label: 'Planta Junín', short: 'P. Junín', x: 1, y: 6, costoFijo: 84, capacidad: 90 },
    { id: 'per', label: 'Planta Pergamino', short: 'P. Pergamino', x: 5, y: 5, costoFijo: 63, capacidad: 60 },
    { id: 'ros', label: 'Planta Rosario', short: 'P. Rosario', x: 8, y: 2, costoFijo: 98, capacidad: 110 },
    { id: 'lin', label: 'Planta Lincoln', short: 'P. Lincoln', x: 2, y: 1, costoFijo: 56, capacidad: 50 },
    { id: 'col', label: 'Planta Colón', short: 'P. Colón', x: 5, y: 0, costoFijo: 49, capacidad: 40 },
  ],
  zonas: [
    { id: 'z1', label: 'Zona Norte', short: 'Norte', x: 0, y: 7, cosecha: [60, 40, 20] },
    { id: 'z2', label: 'Zona Arrecifes', short: 'Arrecifes', x: 4, y: 6, cosecha: [45, 30, 15] },
    { id: 'z3', label: 'Zona Ramallo', short: 'Ramallo', x: 8, y: 4, cosecha: [70, 50, 25] },
    { id: 'z4', label: 'Zona Chacabuco', short: 'Chacabuco', x: 1, y: 3, cosecha: [40, 30, 20] },
    { id: 'z5', label: 'Zona Salto', short: 'Salto', x: 6, y: 1, cosecha: [50, 35, 20] },
    { id: 'z6', label: 'Zona Sur', short: 'Sur', x: 3, y: -1, cosecha: [30, 20, 10] },
  ],
  escenarios: [
    { id: 'llu', label: 'Año lluvioso', short: 'lluvioso', prob: 0.2 },
    { id: 'nor', label: 'Año normal', short: 'normal', prob: 0.6 },
    { id: 'sec', label: 'Sequía', short: 'sequía', prob: 0.2 },
  ],
  costoPorDistancia: 0.1,
  penalidad: 5,
  unidad: 'kt',
  moneda: '$M',
  historia: [
    {
      type: 'p',
      text: 'La **Cooperativa Agrícola del Oeste** tiene que decidir **ahora**, antes de sembrar, qué **plantas de acopio** alquilar para la próxima cosecha. Cada planta tiene un costo fijo por la campaña y una capacidad en miles de toneladas (kt).',
    },
    {
      type: 'p',
      text: 'El problema: la cosecha depende de **cómo llueva**, y eso no se sabe. Con un año lluvioso hay grano de sobra; con sequía, poco. Lo que no entre en ninguna planta se guarda en **silo bolsa**, que sale bastante más caro. El flete de cada zona a cada planta depende de la distancia.',
    },
    {
      type: 'p',
      text: 'Una vez que se sepa cómo vino el año, el reparto se ajusta. Pero las plantas ya están alquiladas. ¿Cuáles conviene elegir?',
    },
  ],
};
