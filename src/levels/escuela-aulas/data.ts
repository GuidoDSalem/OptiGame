/** Datos del nivel 4. */
export const CURSOS = [
  { id: 'c1a', label: '1° A', alumnos: 32, horas: 10 },
  { id: 'c1b', label: '1° B', alumnos: 28, horas: 12 },
  { id: 'c2a', label: '2° A', alumnos: 24, horas: 8 },
  { id: 'c2b', label: '2° B', alumnos: 20, horas: 10 },
  { id: 'c3a', label: '3° A', alumnos: 18, horas: 6 },
  { id: 'rob', label: 'Robótica', alumnos: 12, horas: 8 },
] as const;

export const AULAS = [
  { id: 'magna', label: 'Aula Magna', asientos: 40, horas: 25 },
  { id: 'a2', label: 'Aula 2', asientos: 30, horas: 25 },
  { id: 'lab', label: 'Laboratorio', asientos: 20, horas: 20 },
] as const;

/**
 * Desperdicio de asignar el curso c al aula a: asientos vacíos × horas semanales.
 * (Negativo si el curso no entra: ahí la restricción de asientos tiene que impedirlo.)
 */
export const desperdicio = (c: (typeof CURSOS)[number], a: (typeof AULAS)[number]) =>
  (a.asientos - c.alumnos) * c.horas;
