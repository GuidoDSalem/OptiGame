import type { VarianteSolver } from './template';

/** Versión "Carpintería": un taller chico decide cuántas mesas y bibliotecas fabricar. */
export const carpinteria: VarianteSolver = {
  id: 'solver-carpinteria',
  variant: 'Carpintería',
  title: 'Dentro del solver',
  client: 'Carpintería San José',
  productos: [
    { id: 'mesa', label: 'Mesas', plural: 'mesas', ganancia: 5 },
    { id: 'bib', label: 'Bibliotecas', plural: 'bibliotecas', ganancia: 4 },
  ],
  recursos: [
    { id: 'horas', label: 'Horas de carpintero', short: 'horas', unidad: 'h', consumo: [2, 4], capacidad: 24 },
    { id: 'madera', label: 'Tablones de madera', short: 'madera', unidad: 'tablones', consumo: [4, 3], capacidad: 22 },
  ],
  moneda: '$k',
  xmax: 7,
  ymax: 7,
  historia: [
    {
      type: 'p',
      text: 'La **Carpintería San José** es chiquita: dos productos, dos recursos. Parece el problema del nivel 1… salvo por un detalle: **no se venden pedazos de mueble**. Una mesa y media no existe.',
    },
    {
      type: 'p',
      text: 'El problema es tan chico que HiGHS lo resuelve en un parpadeo. Justamente por eso sirve para **abrir el solver** y ver qué hace por dentro con las variables enteras: cómo se ramifica, cómo se poda y cómo se corta.',
    },
  ],
};
