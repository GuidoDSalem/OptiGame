import { compileIndexed, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { Check, Level } from '../types';
import { AULAS, CURSOS, desperdicio } from './data';
import { escuelaScene } from './Scene';

const spec: IndexedSpec = {
  sets: [
    { id: 'C', name: 'Cursos', index: 'c', items: CURSOS.map(({ id, label }) => ({ id, label, short: label })) },
    { id: 'A', name: 'Aulas', index: 'a', items: AULAS.map(({ id, label }) => ({ id, label, short: label })) },
  ],
  params: [
    {
      id: 'w',
      name: 'Desperdicio (asientos vacíos × horas)',
      symbol: 'w',
      over: ['C', 'A'],
      values: Object.fromEntries(CURSOS.flatMap((c) => AULAS.map((a) => [`${c.id}|${a.id}`, desperdicio(c, a)]))),
    },
    { id: 'n', name: 'Alumnos del curso', symbol: 'n', over: ['C'], values: Object.fromEntries(CURSOS.map((c) => [c.id, c.alumnos])) },
    { id: 'h', name: 'Horas del curso', symbol: 'h', over: ['C'], values: Object.fromEntries(CURSOS.map((c) => [c.id, c.horas])) },
    { id: 'K', name: 'Asientos del aula', symbol: 'K', over: ['A'], values: Object.fromEntries(AULAS.map((a) => [a.id, a.asientos])) },
    { id: 'H', name: 'Horas disponibles del aula', symbol: 'H', over: ['A'], values: Object.fromEntries(AULAS.map((a) => [a.id, a.horas])) },
  ],
  vars: [{ id: 'y', symbol: 'y', over: ['C', 'A'], label: 'Curso c en aula a', unit: '' }],
};

const reference: IndexedDraft = {
  sense: 'min',
  objective: { coef: 'w', var: 'y' },
  varTypes: { y: 'bin' },
  constraints: [
    { key: 'una', name: 'Un aula por curso', forall: ['C'], coef: null, var: 'y', op: '=', rhs: { kind: 'value', value: '1' } },
    { key: 'horas', name: 'Horas del aula', forall: ['A'], coef: 'h', var: 'y', op: '<=', rhs: { kind: 'param', param: 'H' } },
    { key: 'asientos', name: 'Asientos', forall: ['C', 'A'], coef: 'n', var: 'y', op: '<=', rhs: { kind: 'param', param: 'K' } },
  ],
};

const referenceModel = compileIndexed(spec, reference).model;
const vid = (c: string, a: string) => `y_${c}_${a}`;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));
const near = (x: number, v: number) => Math.abs(x - v) < 1e-6;

export const escuelaAulas: Level = {
  id: 'escuela-aulas',
  number: 4,
  title: 'Aulas para todos',
  client: 'Escuela',
  technique: 'Asignación · variables binarias',
  variables: CURSOS.flatMap((c) =>
    AULAS.map((a) => ({
      id: vid(c.id, a.id),
      symbol: `y_{\\text{${c.label.replace('°', '')}},\\text{${a.label.split(' ').pop()}}}`,
      label: `${c.label} en ${a.label}`,
      unit: '',
      min: 0,
      max: 1,
      step: 1,
    })),
  ),
  objective: { sense: 'min', label: 'Desperdicio (asientos vacíos × hora)', unit: '' },
  referenceModel,
  starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
  scene: escuelaScene,
  indexed: {
    spec,
    reference,
    starter: { sense: 'max', objective: { coef: null, var: 'y' }, constraints: [] },
    matrix: { var: 'y', rows: 'C', cols: 'A', binary: true, totals: false },
  },

  briefing: [
    {
      type: 'p',
      text: 'La directora de la **Escuela N° 14** tiene que asignar un aula fija a cada curso para todo el año. El año pasado lo hicieron "a ojo" y quedaron cursos chicos en aulas enormes mientras otros no entraban.',
    },
    {
      type: 'table',
      head: ['Curso', 'Alumnos', 'Horas/semana'],
      rows: CURSOS.map((c) => [c.label, String(c.alumnos), String(c.horas)]),
    },
    {
      type: 'table',
      head: ['Aula', 'Asientos', 'Horas disponibles'],
      rows: AULAS.map((a) => [a.label, String(a.asientos), String(a.horas)]),
    },
    { type: 'h', text: 'Las reglas' },
    {
      type: 'list',
      items: [
        'Cada curso va a **una sola aula**, entera. No se puede partir un curso.',
        'Las horas de los cursos de un aula no pueden superar sus **horas disponibles**.',
        'Un curso sólo puede ir a un aula con **asientos suficientes** para sus alumnos.',
      ],
    },
    {
      type: 'note',
      text: 'Objetivo: minimizar el **desperdicio** = asientos vacíos × horas de uso. Un curso de 12 en un aula de 40 durante 8 horas desperdicia $28 \\times 8 = 224$.',
    },
  ],

  theory: [
    { type: 'h', text: 'Decisiones de sí o no' },
    {
      type: 'p',
      text: 'Hasta ahora las variables eran cantidades: litros, pesos, camiones. Acá la decisión es **sí o no**: ¿el curso $c$ va al aula $a$? Eso se modela con una **variable binaria**:',
    },
    { type: 'tex', tex: 'y_{ca} = \\begin{cases} 1 & \\text{si el curso } c \\text{ va al aula } a \\\\ 0 & \\text{si no} \\end{cases}' },
    {
      type: 'p',
      text: 'Un modelo con variables enteras o binarias es de **programación lineal entera** (PLE o MIP). Asignar turnos, elegir proyectos, abrir o no una fábrica: son todos problemas de este tipo.',
    },
    { type: 'h', text: 'El modelo' },
    { type: 'tex', tex: '\\min \\; \\sum_{c \\in C} \\sum_{a \\in A} w_{ca}\\, y_{ca}' },
    { type: 'p', text: '**Exactamente una** aula por curso. Es la restricción típica de asignación:' },
    { type: 'tex', tex: '\\sum_{a \\in A} y_{ca} = 1 \\qquad \\forall\\, c \\in C' },
    {
      type: 'p',
      text: '**Capacidad de horas**: sumo las horas de los cursos que caen en cada aula. Es una restricción tipo **mochila**: cada curso "pesa" sus horas.',
    },
    { type: 'tex', tex: '\\sum_{c \\in C} h_c\\, y_{ca} \\leq H_a \\qquad \\forall\\, a \\in A' },
    {
      type: 'p',
      text: '**Asientos**: acá no se suma nada. Hay una restricción por cada par curso–aula:',
    },
    { type: 'tex', tex: 'n_c\\, y_{ca} \\leq K_a \\qquad \\forall\\, c \\in C,\\ a \\in A' },
    {
      type: 'note',
      text: 'Mirá el truco: si $y_{ca} = 0$ la restricción dice $0 \\leq K_a$, que siempre se cumple. Si $y_{ca} = 1$ exige $n_c \\leq K_a$. La binaria **prende o apaga** la restricción.',
    },
    { type: 'h', text: 'La relajación lineal (y por qué no alcanza)' },
    {
      type: 'p',
      text: 'Si dejás $y_{ca}$ continua entre 0 y 1, el solver hace trampa: pone, por ejemplo, **0,625 del 1° A** en el laboratorio. Cumple $32 \\times 0{,}625 = 20 \\leq 20$, pero medio curso no existe. Esa versión se llama **relajación lineal**. Su óptimo es una **cota**: ninguna solución real puede ser mejor, pero casi nunca es una solución real.',
    },
    {
      type: 'p',
      text: '¿Y si redondeo? Redondear una solución fraccionaria puede dejar cursos sin aula, pasarse de horas o terminar lejos del óptimo. No es un atajo confiable.',
    },
    { type: 'h', text: 'Cómo resuelve el solver: branch and bound' },
    {
      type: 'list',
      items: [
        'Resuelve la relajación lineal. Si todo sale entero, listo.',
        'Si alguna variable es fraccionaria, por ejemplo $y = 0{,}625$, **ramifica** en dos subproblemas: uno con $y = 0$ y otro con $y = 1$.',
        'Resuelve cada rama. Si una rama ya es peor que la mejor solución entera encontrada, la **poda** sin explorarla.',
        'HiGHS suma además **planos de corte**: restricciones extra que achican la relajación sin perder soluciones enteras.',
      ],
    },
    {
      type: 'p',
      text: 'En el nivel 3 las soluciones enteras salían gratis por la estructura del transporte. Acá la restricción de horas, con "pesos" $h_c$ distintos, rompe esa estructura. Por eso hay que decirle al solver que las variables son binarias.',
    },
  ],

  hints: [
    'Las decisiones son sí/no: en **Variables** elegí el tipo **binaria**.',
    'Cada curso en exactamente un aula: "para cada $c \\in$ Cursos", $\\sum_a y_{ca} = 1$. El lado derecho es el número 1.',
    'Horas: "para cada $a \\in$ Aulas", con coeficiente $h_c$: $\\sum_c h_c\\, y_{ca} \\leq H_a$.',
    'Asientos: "para cada $c$ y cada $a$" (sin suma), con coeficiente $n_c$: $n_c\\, y_{ca} \\leq K_a$.',
  ],

  evaluate(v) {
    const y = (c: string, a: string) => v[vid(c, a)] ?? 0;
    const checks: Check[] = [];

    for (const c of CURSOS) {
      const parts = AULAS.filter((a) => y(c.id, a.id) > 1e-6);
      const whole = parts.length === 1 && near(y(c.id, parts[0].id), 1);
      checks.push({
        label: `Curso ${c.label}`,
        value:
          parts.length === 0
            ? 'sin aula'
            : whole
              ? parts[0].label
              : parts.map((a) => `${fmt(y(c.id, a.id))} ${a.label}`).join(' + '),
        limit: 'una sola aula',
        ok: whole,
        failMessage:
          parts.length === 0
            ? 'El curso se queda sin aula.'
            : parts.length > 1 && parts.every((a) => near(y(c.id, a.id), 1))
              ? 'El curso no puede estar en dos aulas a la vez.'
              : 'No se puede partir un curso entre aulas. ¿Las variables son binarias?',
      });
    }

    for (const a of AULAS) {
      const hs = CURSOS.reduce((s, c) => s + c.horas * y(c.id, a.id), 0);
      checks.push({
        label: `Horas ${a.label}`,
        value: `${fmt(hs)} h`,
        limit: `≤ ${a.horas} h`,
        ok: hs <= a.horas + 1e-4, // tolerancia para soluciones fraccionarias redondeadas
        failMessage: `No entran todas las clases en el horario de ${a.label}.`,
      });
    }

    for (const a of AULAS) {
      // Sólo cuentan los cursos asignados enteros: los "partidos" ya fallan en su propio chequeo.
      const big = CURSOS.filter((c) => near(y(c.id, a.id), 1)).reduce((m, c) => Math.max(m, c.alumnos), 0);
      checks.push({
        label: `Asientos ${a.label}`,
        value: big ? `hasta ${big} alumnos` : 'vacía',
        limit: `≤ ${a.asientos}`,
        ok: big <= a.asientos,
        failMessage: `Hay alumnos parados: el curso más grande de ${a.label} no entra.`,
      });
    }

    const objective = CURSOS.reduce((s, c) => s + AULAS.reduce((t, a) => t + desperdicio(c, a) * y(c.id, a.id), 0), 0);
    return { feasible: checks.every((c) => c.ok), objective, checks };
  },
};
