import type { VarianteColumnas } from './template';

/** Versión "Papelera": una papelera corta bobinas madre en anchos a pedido. */
export const papelera: VarianteColumnas = {
  id: 'columnas-papelera',
  variant: 'Papelera',
  title: 'Bobinas a medida',
  client: 'Papelera del Litoral',
  ancho: 200,
  pedidos: [
    { id: 'emb', label: 'Embalajes Paraná', ancho: 75, cantidad: 15 },
    { id: 'imp', label: 'Imprenta Gráfica Sur', ancho: 60, cantidad: 24 },
    { id: 'bol', label: 'Bolsas El Ceibo', ancho: 45, cantidad: 32 },
    { id: 'eti', label: 'Etiquetas Rosario', ancho: 35, cantidad: 20 },
    { id: 'cin', label: 'Cintas y Rollos', ancho: 20, cantidad: 30 },
  ],
  historia: [
    {
      type: 'p',
      text: 'La **Papelera del Litoral** fabrica bobinas madre de papel de **200 cm** de ancho. Sus clientes no quieren bobinas tan anchas: cada uno pide piezas de su medida. La máquina cortadora parte cada bobina a lo largo, con cuchillas que se pueden ubicar donde uno quiera.',
    },
    {
      type: 'p',
      text: 'La forma de ubicar las cuchillas es un **patrón de corte**: por ejemplo, 2 piezas de 75 cm y 1 de 45 cm (sobran 5 cm). Hay muchísimas combinaciones. ¿Cómo cumplir con todos usando la menor cantidad de bobinas?',
    },
  ],
};
