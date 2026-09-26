import type { VarianteAsignacion } from './template';

/**
 * Versión "Hospital": cirugías a quirófanos. La compatibilidad es el nivel de complejidad:
 * una cirugía de nivel n sólo entra en un quirófano equipado para nivel ≥ n.
 */
export const hospital: VarianteAsignacion = {
  id: 'asignacion-hospital',
  variant: 'Hospital',
  title: 'Quirófanos a punto',
  client: 'Hospital',
  estilo: 'quirofano',
  items: [
    { id: 'car', label: 'Cardíaca', size: 3, hours: 10 },
    { id: 'neu', label: 'Neurocirugía', size: 3, hours: 8 },
    { id: 'tra', label: 'Trauma', size: 2, hours: 12 },
    { id: 'lap', label: 'Laparoscopía', size: 2, hours: 8 },
    { id: 'cat', label: 'Cataratas', size: 1, hours: 6 },
    { id: 'her', label: 'Hernia', size: 1, hours: 10 },
  ],
  bins: [
    { id: 'qa', label: 'Quirófano A', size: 3, hours: 24 },
    { id: 'qb', label: 'Quirófano B', size: 2, hours: 24 },
    { id: 'qc', label: 'Quirófano C', size: 1, hours: 12 },
  ],
  vocab: {
    item: { singular: 'cirugía', plural: 'cirugías', el: 'la cirugía', los: 'las cirugías', set: 'C', index: 'c' },
    bin: { singular: 'quirófano', plural: 'quirófanos', al: 'al quirófano', unoSolo: 'un solo quirófano', set: 'Q', index: 'q' },
    size: {
      item: 'nivel de complejidad',
      bin: 'nivel de equipamiento',
      Check: 'Equipamiento',
      regla: 'Una cirugía sólo puede hacerse en un quirófano con **nivel de equipamiento** igual o mayor a su nivel de complejidad.',
      valor: (n) => `requiere nivel ${n}`,
      falla: (b) => `${b} no tiene el equipamiento para una de sus cirugías.`,
    },
    hours: {
      unit: 'h',
      periodo: 'por semana',
      falla: (b) => `No entran todas las cirugías en la agenda de ${b}.`,
    },
    desperdicio: {
      label: 'Sobre-equipamiento (niveles de más × hora)',
      param: 'Sobre-equipamiento (niveles de más × horas)',
      nota: 'Objetivo: minimizar el **sobre-equipamiento**. Usar el quirófano de alta complejidad para una cirugía simple bloquea un recurso caro. Se mide como niveles de más × horas: una cirugía de nivel 1 de 6 horas en un quirófano de nivel 3 desperdicia $2 \\times 6 = 12$.',
    },
    espera: 'En espera',
  },
  historia: [
    {
      type: 'p',
      text: 'El **Hospital del Sur** reorganiza su agenda quirúrgica. Cada tipo de cirugía tiene que tener un quirófano fijo para toda la semana, y los quirófanos no están todos igual de equipados.',
    },
  ],
};
