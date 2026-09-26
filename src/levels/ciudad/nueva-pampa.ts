import { crearEscenaLotes, type Forma } from './Scene';
import type { Proyecto, VarianteCiudad } from './template';

const proyectos: (Proyecto & { forma: Forma })[] = [
  { id: 'fab', label: 'Fábrica textil', short: 'Fábrica', costo: 30, beneficio: 400, impacto: 24, forma: 'fabrica' },
  { id: 'hosp', label: 'Hospital', short: 'Hospital', costo: 25, beneficio: 130, impacto: 8, forma: 'hospital' },
  { id: 'esc', label: 'Escuela técnica', short: 'Escuela', costo: 12, beneficio: 60, impacto: 2, forma: 'escuela' },
  { id: 'viv', label: 'Barrio de viviendas', short: 'Viviendas', costo: 20, beneficio: 90, impacto: 10, forma: 'viviendas' },
  { id: 'par', label: 'Parque', short: 'Parque', costo: 8, beneficio: 20, impacto: -6, forma: 'parque' },
  { id: 'sol', label: 'Planta solar', short: 'Solar', costo: 18, beneficio: 50, impacto: -15, forma: 'solar' },
  { id: 'ruta', label: 'Ruta', short: 'Ruta', costo: 15, beneficio: 70, impacto: 12, forma: 'ruta' },
  { id: 'tren', label: 'Tren', short: 'Tren', costo: 28, beneficio: 120, impacto: 4, forma: 'tren' },
  { id: 'log', label: 'Centro logístico', short: 'Logística', costo: 22, beneficio: 260, impacto: 30, forma: 'logistica' },
];

/** Versión "Nueva Pampa": la intendencia elige obras con presupuesto y compromiso ambiental. */
export const nuevaPampa: VarianteCiudad = {
  id: 'ciudad-nueva-pampa',
  variant: 'Nueva Pampa',
  title: 'La ciudad que queremos',
  client: 'Ciudad en crecimiento',
  proyectos: proyectos.map(({ forma: _f, ...p }) => p),
  presupuesto: 100,
  topeImpacto: 36,
  reglas: [
    { tipo: 'requiere', a: 'hosp', b: ['ruta'], texto: 'El hospital necesita la ruta para las ambulancias.' },
    { tipo: 'requiere', a: 'fab', b: ['tren'], texto: 'La fábrica necesita el tren para sacar la producción.' },
    { tipo: 'excluye', a: 'par', b: 'fab', texto: 'El parque y la fábrica compiten por el mismo terreno.' },
    { tipo: 'alMenos', k: 2, de: ['esc', 'hosp', 'viv'], texto: 'Al menos dos obras sociales: escuela, hospital o viviendas.' },
  ],
  vocab: {
    moneda: '$M',
    beneficio: 'Empleos',
    impacto: 'Emisiones',
    unidadImpacto: 'kt CO₂/año',
    compromiso: 'Compromiso ambiental',
  },
  scene: crearEscenaLotes(proyectos.map(({ id, short, forma }) => ({ id, short, forma }))),
  historia: [
    {
      type: 'p',
      text: 'La intendencia de **Nueva Pampa** tiene un presupuesto de obras para los próximos cuatro años y nueve proyectos sobre la mesa. Todos quieren empleo, pero la ciudad firmó un **compromiso ambiental**: las obras nuevas no pueden sumar más de 36 kt de CO₂ por año.',
    },
    {
      type: 'p',
      text: 'Algunos proyectos **dependen** de otros, otros **compiten** por el mismo terreno, y el concejo exige un mínimo de obras sociales. Las emisiones negativas (parque, planta solar) **compensan** las de otros proyectos.',
    },
  ],
};
