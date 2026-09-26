import { compileIndexed, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { Check, Level } from '../types';
import { CENTROS, COSTO, PLANTAS } from './data';
import { transporteScene } from './Scene';

const spec: IndexedSpec = {
  sets: [
    { id: 'I', name: 'Plantas', index: 'i', items: PLANTAS.map(({ id, label, short }) => ({ id, label, short })) },
    { id: 'J', name: 'Centros', index: 'j', items: CENTROS.map(({ id, label, short }) => ({ id, label, short })) },
  ],
  params: [
    {
      id: 'c',
      name: 'Costo por camión ($k)',
      symbol: 'c',
      over: ['I', 'J'],
      values: Object.fromEntries(PLANTAS.flatMap((p) => CENTROS.map((c) => [`${p.id}|${c.id}`, COSTO[p.id][c.id]]))),
    },
    { id: 'o', name: 'Oferta de la planta', symbol: 'o', over: ['I'], values: Object.fromEntries(PLANTAS.map((p) => [p.id, p.oferta])) },
    { id: 'd', name: 'Demanda del centro', symbol: 'd', over: ['J'], values: Object.fromEntries(CENTROS.map((c) => [c.id, c.demanda])) },
  ],
  vars: [{ id: 'x', symbol: 'x', over: ['I', 'J'], label: 'Camiones de i a j', unit: 'camiones' }],
};

const reference: IndexedDraft = {
  sense: 'min',
  objective: { coef: 'c', var: 'x' },
  constraints: [
    { key: 'oferta', name: 'Oferta', forall: ['I'], coef: null, var: 'x', op: '<=', rhs: { kind: 'param', param: 'o' } },
    { key: 'demanda', name: 'Demanda', forall: ['J'], coef: null, var: 'x', op: '>=', rhs: { kind: 'param', param: 'd' } },
  ],
};

const referenceModel = compileIndexed(spec, reference).model;
const vid = (p: string, c: string) => `x_${p}_${c}`;
const totalOferta = PLANTAS.reduce((s, p) => s + p.oferta, 0);
const totalDemanda = CENTROS.reduce((s, c) => s + c.demanda, 0);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const costoTex = [
  '\\begin{array}{l|' + 'c'.repeat(CENTROS.length) + '}',
  ' & ' + CENTROS.map((c) => `\\text{${c.short}}`).join(' & ') + ' \\\\ \\hline',
  ...PLANTAS.map((p) => `\\text{${p.short}} & ` + CENTROS.map((c) => COSTO[p.id][c.id]).join(' & ') + ' \\\\'),
  '\\end{array}',
].join('\n');

export const transporteLacteos: Level = {
  id: 'transporte-lacteos',
  number: 3,
  title: 'Leche en camino',
  client: 'Cooperativa láctea',
  technique: 'Problema de transporte · modelos con índices',
  variables: PLANTAS.flatMap((p) =>
    CENTROS.map((c) => ({
      id: vid(p.id, c.id),
      symbol: `x_{\\text{${p.short}},\\text{${c.short}}}`,
      label: `${p.label} → ${c.label}`,
      unit: 'camiones',
      min: 0,
      max: Math.min(p.oferta, c.demanda),
      step: 1,
    })),
  ),
  objective: { sense: 'min', label: 'Costo semanal ($k)', unit: '$' },
  referenceModel,
  starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
  scene: transporteScene,
  indexed: {
    spec,
    reference,
    starter: { sense: 'max', objective: { coef: null, var: 'x' }, constraints: [] },
    matrix: { var: 'x', rows: 'I', cols: 'J', rowParam: 'o', colParam: 'd' },
  },

  briefing: [
    {
      type: 'p',
      text: 'La cooperativa **Tambo Unido** tiene tres plantas lácteas en la cuenca santafesina y abastece a cuatro centros de distribución. Cada semana hay que decidir **cuántos camiones mandar de cada planta a cada centro**.',
    },
    {
      type: 'table',
      head: ['$k por camión', ...CENTROS.map((c) => c.label), 'Oferta'],
      rows: [
        ...PLANTAS.map((p) => [p.label, ...CENTROS.map((c) => String(COSTO[p.id][c.id])), String(p.oferta)]),
        ['Demanda', ...CENTROS.map((c) => String(c.demanda)), ''],
      ],
    },
    {
      type: 'list',
      items: [
        'Cada planta puede despachar como máximo su **oferta** semanal de camiones.',
        'Cada centro necesita recibir al menos su **demanda**.',
        `Ojo: las plantas producen ${totalOferta} camiones y los centros piden ${totalDemanda}. Sobra capacidad.`,
      ],
    },
    { type: 'note', text: 'Objetivo: cubrir toda la demanda con el menor costo de transporte.' },
  ],

  theory: [
    { type: 'h', text: 'El problema de transporte' },
    {
      type: 'p',
      text: 'Es uno de los modelos clásicos de la investigación operativa. Hay **orígenes** con oferta, **destinos** con demanda y un costo por unidad en cada ruta. Aparece en logística, energía, telecomunicaciones y hasta en la asignación de personal.',
    },
    { type: 'h', text: 'Pensar con índices' },
    {
      type: 'p',
      text: `Hay ${PLANTAS.length * CENTROS.length} variables y ${PLANTAS.length + CENTROS.length} restricciones. Escribirlas una por una es tedioso, y con 50 plantas y 300 centros sería imposible. Por eso se modela con **conjuntos** e **índices**:`,
    },
    {
      type: 'list',
      items: [
        '**Conjuntos**: $I$ = plantas (índice $i$), $J$ = centros (índice $j$).',
        '**Parámetros** (datos): $c_{ij}$ costo por camión, $o_i$ oferta de la planta $i$, $d_j$ demanda del centro $j$.',
        '**Variable**: $x_{ij}$ = camiones de la planta $i$ al centro $j$.',
      ],
    },
    { type: 'tex', tex: costoTex },
    { type: 'h', text: 'El modelo' },
    { type: 'tex', tex: '\\min \\; \\sum_{i \\in I} \\sum_{j \\in J} c_{ij}\\, x_{ij}' },
    {
      type: 'p',
      text: 'Cada planta despacha como mucho lo que produce. Se suma sobre los destinos, y hay **una restricción por cada planta**:',
    },
    { type: 'tex', tex: '\\sum_{j \\in J} x_{ij} \\leq o_i \\qquad \\forall\\, i \\in I' },
    { type: 'p', text: 'Cada centro recibe al menos lo que pide. Se suma sobre los orígenes, **una por cada centro**:' },
    { type: 'tex', tex: '\\sum_{i \\in I} x_{ij} \\geq d_j \\qquad \\forall\\, j \\in J' },
    {
      type: 'note',
      text: 'Regla de oro de los índices: el índice que aparece en el "para cada" ($\\forall$) queda **fijo**, y el que no aparece se **suma**. Todo lo que quede suelto tiene que estar en el $\\forall$.',
    },
    { type: 'h', text: 'Dos trampas y un regalo' },
    {
      type: 'list',
      items: [
        `**Oferta con "="**: sobran ${totalOferta - totalDemanda} camiones de capacidad. Si obligás a cada planta a despachar todo, los centros tendrían que recibir más de lo que piden. Con demanda "=" el modelo queda **infactible**.`,
        '**Lo más barato primero** no es óptimo. Llenar la ruta más barata puede gastar una planta que era más valiosa para otro destino. Es un **costo de oportunidad**, y el solver lo ve.',
        '**Solución entera gratis**: si ofertas y demandas son enteras, el simplex devuelve camiones enteros aunque no se lo pidas. La estructura del problema (matriz *totalmente unimodular*) lo garantiza.',
      ],
    },
  ],

  hints: [
    'La función objetivo es $\\min \\sum_i \\sum_j c_{ij} x_{ij}$: elegí el parámetro de costo como coeficiente.',
    'La oferta es una restricción **por planta**: "para cada $i \\in I$", sumando sobre los centros $j$.',
    'La demanda es **por centro**: "para cada $j \\in J$", con signo $\\geq d_j$.',
    `Si te da infactible, revisá los signos: la oferta total (${totalOferta}) supera la demanda (${totalDemanda}), así que la oferta tiene que ser $\\leq$.`,
  ],

  evaluate(v) {
    const x = (p: string, c: string) => v[vid(p, c)] ?? 0;
    const allInt = referenceModel.variables.every((d) => Number.isInteger(Math.round((v[d.id] ?? 0) * 1e6) / 1e6));
    const checks: Check[] = [
      ...PLANTAS.map((p) => {
        const sent = CENTROS.reduce((s, c) => s + x(p.id, c.id), 0);
        return {
          label: `Planta ${p.label}`,
          value: `${fmt(sent)} despachados`,
          limit: `≤ ${p.oferta}`,
          ok: sent <= p.oferta + 1e-6,
          failMessage: `${p.label} no produce tanta leche.`,
        };
      }),
      ...CENTROS.map((c) => {
        const got = PLANTAS.reduce((s, p) => s + x(p.id, c.id), 0);
        return {
          label: `Centro ${c.label}`,
          value: `${fmt(got)} recibidos`,
          limit: `≥ ${c.demanda}`,
          ok: got >= c.demanda - 1e-6,
          failMessage: `Faltan ${fmt(c.demanda - got)} camiones: góndolas vacías en ${c.label}.`,
        };
      }),
      {
        label: 'Camiones enteros',
        value: allInt ? 'sí' : 'no',
        limit: 'sin fracciones',
        ok: allInt,
        failMessage: 'No se puede mandar medio camión.',
      },
    ];
    const cost = PLANTAS.reduce((s, p) => s + CENTROS.reduce((t, c) => t + COSTO[p.id][c.id] * x(p.id, c.id), 0), 0);
    return { feasible: checks.every((c) => c.ok), objective: cost, checks };
  },
};
