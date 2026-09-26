import type { VarianteAsignacion } from './template';

/** Versión "Escuela": cursos a aulas. */
export const escuela: VarianteAsignacion = {
  id: 'asignacion-escuela',
  variant: 'Escuela',
  title: 'Aulas para todos',
  client: 'Escuela',
  estilo: 'aula',
  items: [
    { id: 'c1a', label: '1° A', size: 32, hours: 10 },
    { id: 'c1b', label: '1° B', size: 28, hours: 12 },
    { id: 'c2a', label: '2° A', size: 24, hours: 8 },
    { id: 'c2b', label: '2° B', size: 20, hours: 10 },
    { id: 'c3a', label: '3° A', size: 18, hours: 6 },
    { id: 'rob', label: 'Robótica', size: 12, hours: 8 },
  ],
  bins: [
    { id: 'magna', label: 'Aula Magna', size: 40, hours: 25 },
    { id: 'a2', label: 'Aula 2', size: 30, hours: 25 },
    { id: 'lab', label: 'Laboratorio', size: 20, hours: 20 },
  ],
  vocab: {
    item: { singular: 'curso', plural: 'cursos', el: 'el curso', los: 'los cursos', set: 'C', index: 'c' },
    bin: { singular: 'aula', plural: 'aulas', al: 'al aula', unoSolo: 'una sola aula', set: 'A', index: 'a' },
    size: {
      item: 'alumnos',
      bin: 'asientos',
      Check: 'Asientos',
      regla: 'Un curso sólo puede ir a un aula con **asientos suficientes** para todos sus alumnos.',
      valor: (n) => `hasta ${n} alumnos`,
      falla: (b) => `Hay alumnos parados: el curso más grande de ${b} no entra.`,
    },
    hours: {
      unit: 'h',
      periodo: 'por semana',
      falla: (b) => `No entran todas las clases en el horario de ${b}.`,
    },
    desperdicio: {
      label: 'Desperdicio (asientos vacíos × hora)',
      param: 'Desperdicio (asientos vacíos × horas)',
      nota: 'Objetivo: minimizar el **desperdicio** = asientos vacíos × horas de uso. Un curso de 12 en un aula de 40 durante 8 horas desperdicia $28 \\times 8 = 224$.',
    },
    espera: 'Patio',
  },
  historia: [
    {
      type: 'p',
      text: 'La directora de la **Escuela N° 14** tiene que asignar un aula fija a cada curso para todo el año. El año pasado lo hicieron "a ojo" y quedaron cursos chicos en aulas enormes mientras otros no entraban.',
    },
  ],
};
