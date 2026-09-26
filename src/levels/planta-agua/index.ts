import type { LPModel } from '../../engine/model';
import type { Check, Level } from '../types';
import { DATA as D } from './data';
import { plantaScene } from './Scene';

const referenceModel: LPModel = {
  sense: 'min',
  objective: { rio: D.costoRio, pozo: D.costoPozo },
  variables: [{ id: 'rio' }, { id: 'pozo' }],
  constraints: [
    { id: 'demanda', name: 'Demanda', coefs: { rio: 1, pozo: 1 }, op: '>=', rhs: D.demanda },
    { id: 'cap_rio', name: 'Capacidad río', coefs: { rio: 1 }, op: '<=', rhs: D.capRio },
    { id: 'cap_pozo', name: 'Capacidad pozo', coefs: { pozo: 1 }, op: '<=', rhs: D.capPozo },
    {
      id: 'salinidad',
      name: 'Salinidad',
      coefs: { rio: D.salRio - D.salMax, pozo: D.salPozo - D.salMax },
      op: '<=',
      rhs: 0,
    },
    { id: 'coagulante', name: 'Coagulante', coefs: { rio: D.coagRio, pozo: D.coagPozo }, op: '<=', rhs: D.coagStock },
  ],
};

const fmt = (n: number, d = 1) => (Number.isInteger(n) ? String(n) : n.toFixed(d));

export const plantaAgua: Level = {
  id: 'planta-agua',
  number: 1,
  title: 'Agua para Villa Mezcla',
  client: 'Planta potabilizadora municipal',
  technique: 'Programación lineal · método gráfico',
  variables: [
    { id: 'rio', symbol: 'x_r', label: 'Agua del río', unit: 'ML/día', min: 0, max: D.capRio, step: 1 },
    { id: 'pozo', symbol: 'x_p', label: 'Agua del pozo', unit: 'ML/día', min: 0, max: D.capPozo, step: 1 },
  ],
  objective: { sense: 'min', label: 'Costo diario', unit: '$' },
  referenceModel,
  starterModel: {
    sense: 'max',
    objective: { rio: 0, pozo: 0 },
    variables: [{ id: 'rio' }, { id: 'pozo' }],
    constraints: [],
  },
  plot: { x: 'rio', y: 'pozo', xmax: 60, ymax: 60, isoMax: 12000 },
  scene: plantaScene,

  briefing: [
    {
      type: 'p',
      text: 'La planta potabilizadora de Villa Mezcla abastece a toda la ciudad. El intendente te contrató porque la factura del agua se disparó y quiere saber cuánta agua sacar de cada fuente.',
    },
    { type: 'h', text: 'Las fuentes' },
    {
      type: 'list',
      items: [
        `**Río**: agua dulce pero turbia. Hay que tratarla con coagulante (${D.coagRio} kg por megalitro). Cuesta $${D.costoRio} por ML. Se pueden bombear hasta ${D.capRio} ML/día.`,
        `**Pozo**: agua limpia pero salada (${D.salPozo} mg/L). Necesita poco coagulante (${D.coagPozo} kg/ML). Cuesta $${D.costoPozo} por ML. Da hasta ${D.capPozo} ML/día.`,
      ],
    },
    { type: 'h', text: 'Las reglas' },
    {
      type: 'list',
      items: [
        `La ciudad consume **${D.demanda} ML por día**. No puede faltar agua.`,
        `El agua del río tiene ${D.salRio} mg/L de sales. La mezcla que sale de la planta no puede superar **${D.salMax} mg/L**.`,
        `Hay **${D.coagStock} kg de coagulante** por día.`,
      ],
    },
    {
      type: 'table',
      head: ['', 'Río', 'Pozo', 'Límite'],
      rows: [
        ['Costo ($/ML)', String(D.costoRio), String(D.costoPozo), '—'],
        ['Capacidad (ML/día)', String(D.capRio), String(D.capPozo), '—'],
        ['Sales (mg/L)', String(D.salRio), String(D.salPozo), `mezcla ≤ ${D.salMax}`],
        ['Coagulante (kg/ML)', String(D.coagRio), String(D.coagPozo), `total ≤ ${D.coagStock}`],
      ],
    },
    { type: 'note', text: 'Objetivo: cubrir la demanda cumpliendo todo, al menor costo posible.' },
  ],

  theory: [
    { type: 'h', text: '¿Qué es un problema de programación lineal?' },
    {
      type: 'p',
      text: 'Un modelo de optimización tiene tres partes: **variables de decisión** (lo que vos elegís), una **función objetivo** (lo que querés minimizar o maximizar) y **restricciones** (las reglas que hay que cumplir). Si todo es lineal (sumas de variables multiplicadas por constantes), es un problema de **programación lineal (PL)**.',
    },
    { type: 'h', text: '1 · Variables' },
    { type: 'p', text: 'Acá decidís dos cantidades: $x_r$ = ML/día del río, y $x_p$ = ML/día del pozo. Ambas $\\geq 0$.' },
    { type: 'h', text: '2 · Objetivo' },
    { type: 'p', text: 'El costo total es precio × cantidad de cada fuente:' },
    { type: 'tex', tex: `\\min \\; ${D.costoRio}\\,x_r + ${D.costoPozo}\\,x_p` },
    { type: 'h', text: '3 · Restricciones' },
    { type: 'p', text: 'Demanda y capacidades son directas:' },
    { type: 'tex', tex: `x_r + x_p \\geq ${D.demanda} \\qquad x_r \\leq ${D.capRio} \\qquad x_p \\leq ${D.capPozo}` },
    {
      type: 'p',
      text: 'El coagulante también: cada ML de río usa 3 kg y cada ML de pozo usa 1 kg.',
    },
    { type: 'tex', tex: `${D.coagRio}\\,x_r + ${D.coagPozo}\\,x_p \\leq ${D.coagStock}` },
    { type: 'h', text: 'El truco: restricciones de mezcla' },
    {
      type: 'p',
      text: 'La salinidad de la mezcla es un **promedio ponderado**, que es una fracción y por lo tanto no es lineal:',
    },
    { type: 'tex', tex: `\\frac{${D.salRio}\\,x_r + ${D.salPozo}\\,x_p}{x_r + x_p} \\leq ${D.salMax}` },
    {
      type: 'p',
      text: 'Pero como $x_r + x_p > 0$, podemos multiplicar ambos lados sin cambiar el sentido de la desigualdad y pasar todo a la izquierda:',
    },
    {
      type: 'tex',
      tex: `${D.salRio}\\,x_r + ${D.salPozo}\\,x_p \\leq ${D.salMax}\\,(x_r + x_p) \\;\\Longrightarrow\\; ${D.salRio - D.salMax}\\,x_r + ${D.salPozo - D.salMax}\\,x_p \\leq 0`,
    },
    { type: 'note', text: 'Esta linealización aparece en cualquier problema de mezclas: alimentos, combustibles, aleaciones, fertilizantes…' },
    { type: 'h', text: 'Método gráfico' },
    {
      type: 'p',
      text: 'Con dos variables se puede dibujar: cada restricción es un semiplano y su intersección es la **región factible**. Las rectas de igual costo son paralelas. Si las desplazás en la dirección que baja el costo, la última que toca la región lo hace en un **vértice**. Ese vértice es el óptimo.',
    },
    {
      type: 'p',
      text: 'Por eso los solvers como el **método simplex** no buscan en toda la región: saltan de vértice en vértice mejorando el objetivo.',
    },
  ],

  hints: [
    'El objetivo es de **minimización**, y sus coeficientes son los costos por ML de cada fuente.',
    'Sin la restricción de demanda, lo más barato es no producir nada. ¿Qué signo lleva $x_r + x_p$ respecto de 60?',
    'No te olvides las capacidades de cada fuente ni el stock de coagulante.',
    'Salinidad: $200x_r + 950x_p \\leq 500(x_r + x_p)$. Pasá todo a la izquierda: los coeficientes son $200-500$ y $950-500$, con lado derecho $0$.',
  ],

  evaluate(v) {
    const r = v.rio ?? 0;
    const p = v.pozo ?? 0;
    const total = r + p;
    const sal = total > 0 ? (D.salRio * r + D.salPozo * p) / total : 0;
    const coag = D.coagRio * r + D.coagPozo * p;
    const checks: Check[] = [
      {
        label: 'Demanda',
        value: `${fmt(total)} ML`,
        limit: `≥ ${D.demanda} ML`,
        ok: total >= D.demanda - 1e-6,
        failMessage: `Faltan ${fmt(D.demanda - total)} ML: hay barrios sin agua.`,
      },
      {
        label: 'Salinidad',
        value: `${fmt(sal, 0)} mg/L`,
        limit: `≤ ${D.salMax} mg/L`,
        ok: sal <= D.salMax + 1e-6,
        failMessage: 'El agua sale salada y el ente regulador clausura la planta.',
      },
      {
        label: 'Coagulante',
        value: `${fmt(coag)} kg`,
        limit: `≤ ${D.coagStock} kg`,
        ok: coag <= D.coagStock + 1e-6,
        failMessage: 'No alcanza el coagulante: el agua de río sale turbia.',
      },
      {
        label: 'Capacidad río',
        value: `${fmt(r)} ML`,
        limit: `≤ ${D.capRio} ML`,
        ok: r <= D.capRio + 1e-6,
        failMessage: 'Las bombas del río no dan para tanto.',
      },
      {
        label: 'Capacidad pozo',
        value: `${fmt(p)} ML`,
        limit: `≤ ${D.capPozo} ML`,
        ok: p <= D.capPozo + 1e-6,
        failMessage: 'El pozo no da para tanto.',
      },
    ];
    return {
      feasible: checks.every((c) => c.ok),
      objective: D.costoRio * r + D.costoPozo * p,
      checks,
    };
  },
};
