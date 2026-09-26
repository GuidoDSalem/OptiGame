import type { LPModel } from '../../engine/model';
import type { Check, Level } from '../types';
import { CANALES, DATA as D } from './data';
import { MarketingScene } from './Scene';

const ids = CANALES.map((c) => c.id);
const by = <K extends 'alcance' | 'jovenes' | 'horas'>(k: K) => Object.fromEntries(CANALES.map((c) => [c.id, c[k]]));

const referenceModel: LPModel = {
  sense: 'max',
  objective: by('alcance'),
  variables: ids.map((id) => ({ id })),
  constraints: [
    { id: 'presupuesto', name: 'Presupuesto', coefs: Object.fromEntries(ids.map((id) => [id, 1])), op: '<=', rhs: D.presupuesto },
    { id: 'horas', name: 'Horas creativas', coefs: by('horas'), op: '<=', rhs: D.horas },
    { id: 'jovenes', name: 'Público joven', coefs: by('jovenes'), op: '>=', rhs: D.jovenesMin },
    { id: 'convenio', name: 'Convenio radios', coefs: { tv: 1, radio: -D.tvPorRadio }, op: '<=', rhs: 0 },
    ...CANALES.map((c) => ({ id: `max_${c.id}`, name: `Máximo ${c.label.toLowerCase()}`, coefs: { [c.id]: 1 }, op: '<=' as const, rhs: c.max })),
  ],
};

/** Expresión LaTeX con los coeficientes de un atributo de los canales. */
const texExpr = (k: 'alcance' | 'jovenes' | 'horas') => CANALES.map((c) => `${c[k]}\\,${c.symbol}`).join(' + ');

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const sum = (v: Record<string, number>, k: 'alcance' | 'jovenes' | 'horas' | null) =>
  CANALES.reduce((s, c) => s + (v[c.id] ?? 0) * (k ? c[k] : 1), 0);

export const campanaMarketing: Level = {
  id: 'campana-marketing',
  number: 2,
  title: 'La campaña de Mate Norte',
  client: 'Consultora de marketing',
  technique: 'PL con muchas variables · análisis de sensibilidad',
  variables: CANALES.map((c) => ({ id: c.id, symbol: c.symbol, label: c.label, unit: '$k', min: 0, max: c.max, step: 1 })),
  objective: { sense: 'max', label: 'Alcance (mil personas)', unit: '' },
  referenceModel,
  starterModel: {
    sense: 'max',
    objective: {},
    variables: ids.map((id) => ({ id })),
    constraints: [],
  },
  Scene: MarketingScene,

  briefing: [
    {
      type: 'p',
      text: 'La consultora "Ruido" lanza la campaña de **Mate Norte**, una yerba nueva. Tenés que repartir el presupuesto entre cuatro canales para llegar a la mayor cantidad de gente posible.',
    },
    {
      type: 'table',
      head: ['Por cada $1k', 'Alcance (mil personas)', 'Jóvenes (mil)', 'Horas creativas', 'Máximo ($k)'],
      rows: CANALES.map((c) => [c.label, String(c.alcance), String(c.jovenes), String(c.horas), String(c.max)]),
    },
    { type: 'h', text: 'Las reglas' },
    {
      type: 'list',
      items: [
        `Presupuesto total: **$${D.presupuesto}k**.`,
        `El equipo creativo tiene **${D.horas} horas**. Cada canal necesita piezas distintas: las redes piden mucho contenido.`,
        `La marca apunta a jóvenes: hay que alcanzar al menos **${D.jovenesMin} mil jóvenes**.`,
        `**Convenio con radios locales**: lo que se invierte en TV no puede superar el doble de lo invertido en radio.`,
        'Cada canal tiene un máximo de espacios disponibles para comprar (última columna).',
      ],
    },
    { type: 'note', text: 'Objetivo: maximizar el alcance total (en miles de personas).' },
  ],

  theory: [
    { type: 'h', text: 'Más variables, misma lógica' },
    {
      type: 'p',
      text: 'Con cuatro variables ya no se puede dibujar la región factible: vive en 4 dimensiones. Pero la idea es la misma. Es un poliedro, el óptimo está en un vértice, y el simplex salta de vértice en vértice. Los solvers industriales resuelven así modelos con **millones** de variables.',
    },
    { type: 'p', text: 'Variables: $x_{tv}, x_{ra}, x_{re}, x_{vp}$ = miles de $ invertidos en cada canal.' },
    { type: 'tex', tex: `\\max \\; ${texExpr('alcance')}` },
    { type: 'h', text: 'Tipos de restricciones' },
    {
      type: 'list',
      items: [
        '**Recursos** ($\\leq$): presupuesto y horas. Suman lo que consume cada variable.',
        '**Cobertura** ($\\geq$): hay que llegar a un mínimo, como el público joven. Mismo formato, otros coeficientes.',
        '**Relación entre variables**: "la TV no puede superar el doble de la radio" se escribe $x_{tv} \\leq 2\\,x_{ra}$. Llevando todo a la izquierda queda $x_{tv} - 2\\,x_{ra} \\leq 0$.',
        '**Cotas**: el máximo de cada canal, como $x_{tv} \\leq 60$.',
      ],
    },
    { type: 'h', text: 'Análisis de sensibilidad' },
    {
      type: 'p',
      text: 'Resolver da más que la mejor decisión: también dice **qué te está limitando**. Es lo que el cliente de verdad quiere saber.',
    },
    {
      type: 'list',
      items: [
        '**Restricción activa**: se cumple justo en el límite (holgura 0). Es un cuello de botella.',
        '**Precio sombra**: cuánto mejora el objetivo si el lado derecho de una restricción sube una unidad. Si el presupuesto tiene precio sombra 2,5, cada $1k extra suma 2,5 mil personas. Una restricción con holgura tiene precio sombra 0: tener más de ese recurso no sirve.',
        '**Costo reducido**: para una variable que quedó en 0, cuánto empeora el objetivo por cada unidad que la fuerces a usar. También indica cuánto tendría que mejorar su coeficiente para que convenga incluirla.',
      ],
    },
    {
      type: 'note',
      text: 'Estos valores valen en un **rango**: si cambiás mucho un dato, el vértice óptimo cambia y hay que volver a resolver.',
    },
    { type: 'h', text: 'Una advertencia' },
    {
      type: 'p',
      text: 'Un modelo lineal supone **rendimientos constantes**: el millonésimo peso en TV rinde lo mismo que el primero. En la realidad hay saturación. Los máximos por canal son una forma simple de capturarlo; más adelante vamos a ver funciones lineales por tramos.',
    },
  ],

  hints: [
    'Es un problema de **maximización**. Los coeficientes del objetivo son el alcance por $1k de cada canal.',
    'Las horas creativas se modelan igual que el presupuesto, pero con los coeficientes de horas de cada canal.',
    `Público joven: $${texExpr('jovenes')} \\geq ${D.jovenesMin}$.`,
    `Convenio: $x_{tv} \\leq ${D.tvPorRadio}\\,x_{ra}$, o sea coeficiente $1$ para TV, $-${D.tvPorRadio}$ para radio, $\\leq 0$. No te olvides los máximos por canal.`,
  ],

  evaluate(v) {
    const gasto = sum(v, null);
    const horas = sum(v, 'horas');
    const jovenes = sum(v, 'jovenes');
    const tv = v.tv ?? 0;
    const radio = v.radio ?? 0;
    const checks: Check[] = [
      {
        label: 'Presupuesto',
        value: `$${fmt(gasto)}k`,
        limit: `≤ $${D.presupuesto}k`,
        ok: gasto <= D.presupuesto + 1e-6,
        failMessage: 'Te pasaste del presupuesto: el cliente no paga la diferencia.',
      },
      {
        label: 'Horas creativas',
        value: `${fmt(horas)} h`,
        limit: `≤ ${D.horas} h`,
        ok: horas <= D.horas + 1e-6,
        failMessage: 'El equipo no llega a producir todas las piezas a tiempo.',
      },
      {
        label: 'Público joven',
        value: `${fmt(jovenes)} mil`,
        limit: `≥ ${D.jovenesMin} mil`,
        ok: jovenes >= D.jovenesMin - 1e-6,
        failMessage: 'La campaña no llega al público objetivo de la marca.',
      },
      {
        label: 'Convenio radios',
        value: `TV ${fmt(tv)} / radio ${fmt(radio)}`,
        limit: `TV ≤ ${D.tvPorRadio}× radio`,
        ok: tv <= D.tvPorRadio * radio + 1e-6,
        failMessage: 'Se rompe el convenio con las radios locales.',
      },
      ...CANALES.map((c) => ({
        label: `Máx. ${c.label.toLowerCase()}`,
        value: `$${fmt(v[c.id] ?? 0)}k`,
        limit: `≤ $${c.max}k`,
        ok: (v[c.id] ?? 0) <= c.max + 1e-6,
        failMessage: 'No hay tantos espacios disponibles para comprar.',
      })),
    ];
    return { feasible: checks.every((c) => c.ok), objective: sum(v, 'alcance'), checks };
  },
};
