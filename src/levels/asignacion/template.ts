/**
 * Plantilla del nivel de asignación con variables binarias (asignación generalizada).
 *
 * Ítems con un tamaño y una carga horaria se asignan, cada uno entero, a contenedores con
 * capacidad de tamaño y de horas. La técnica, el modelo, la teoría y la lógica del mundo son
 * siempre los mismos; cada variante (escuela, hospital…) aporta datos, vocabulario e historia.
 */
import { compileIndexed, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { Check, ContentBlock, Level } from '../types';
import { crearEscenaAsignacion, type EstiloContenedor } from './Scene';

export interface Item {
  id: string;
  label: string;
  /** Tamaño que tiene que "entrar" en el contenedor (alumnos, nivel de complejidad…). */
  size: number;
  /** Horas que ocupa por semana/día. */
  hours: number;
}

export interface Contenedor {
  id: string;
  label: string;
  /** Tamaño máximo que admite (asientos, nivel de equipamiento…). */
  size: number;
  /** Horas disponibles. */
  hours: number;
}

/** Palabras de la historia. Las frases con género van completas para que el castellano cierre. */
export interface Vocabulario {
  item: {
    singular: string; // "curso"
    plural: string; // "cursos"
    el: string; // "el curso"
    los: string; // "los cursos"
    set: string; // "C"
    index: string; // "c"
  };
  bin: {
    singular: string; // "aula"
    plural: string; // "aulas"
    al: string; // "al aula"
    unoSolo: string; // "una sola aula"
    set: string; // "A"
    index: string; // "a"
  };
  /** Tamaño del ítem vs. capacidad del contenedor. */
  size: {
    item: string; // "alumnos"
    bin: string; // "asientos"
    Check: string; // "Asientos" (título del chequeo)
    /** Regla de compatibilidad para la historia, p. ej. "Un curso sólo puede ir a un aula con asientos para todos sus alumnos." */
    regla: string;
    valor(n: number): string; // "hasta 32 alumnos"
    falla(bin: string): string;
  };
  hours: {
    unit: string; // "h"
    periodo: string; // "por semana"
    falla(bin: string): string;
  };
  desperdicio: {
    label: string; // "Desperdicio (asientos vacíos × hora)"
    param: string; // "Desperdicio (asientos vacíos × horas)"
    /** Explicación para la historia, con un ejemplo. */
    nota: string;
  };
  /** Lugar de la escena donde esperan los ítems sin asignar. */
  espera: string;
}

export interface VarianteAsignacion {
  id: string;
  variant: string;
  title: string;
  client: string;
  vocab: Vocabulario;
  items: Item[];
  bins: Contenedor[];
  /** Historia inicial (antes de las tablas de datos, que arma la plantilla). */
  historia: ContentBlock[];
  /** Estilo visual de los contenedores en la escena. */
  estilo: EstiloContenedor;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));
const near = (x: number, v: number) => Math.abs(x - v) < 1e-6;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Desperdicio de poner el ítem en el contenedor: capacidad sobrante × horas. */
export const desperdicio = (it: Item, b: Contenedor) => (b.size - it.size) * it.hours;

export function crearNivelAsignacion(v: VarianteAsignacion): Level {
  const { vocab: V, items, bins } = v;
  const I = V.item.set;
  const B = V.bin.set;
  const ii = V.item.index;
  const bi = V.bin.index;

  const spec: IndexedSpec = {
    sets: [
      { id: I, name: cap(V.item.plural), index: ii, items: items.map(({ id, label }) => ({ id, label, short: label })) },
      { id: B, name: cap(V.bin.plural), index: bi, items: bins.map(({ id, label }) => ({ id, label, short: label })) },
    ],
    params: [
      {
        id: 'w',
        name: V.desperdicio.param,
        symbol: 'w',
        over: [I, B],
        values: Object.fromEntries(items.flatMap((it) => bins.map((b) => [`${it.id}|${b.id}`, desperdicio(it, b)]))),
      },
      { id: 'n', name: `${cap(V.size.item)} (${V.item.singular})`, symbol: 'n', over: [I], values: Object.fromEntries(items.map((it) => [it.id, it.size])) },
      { id: 'h', name: `Horas (${V.item.singular})`, symbol: 'h', over: [I], values: Object.fromEntries(items.map((it) => [it.id, it.hours])) },
      { id: 'K', name: `${cap(V.size.bin)} (${V.bin.singular})`, symbol: 'K', over: [B], values: Object.fromEntries(bins.map((b) => [b.id, b.size])) },
      { id: 'H', name: `Horas disponibles (${V.bin.singular})`, symbol: 'H', over: [B], values: Object.fromEntries(bins.map((b) => [b.id, b.hours])) },
    ],
    vars: [{ id: 'y', symbol: 'y', over: [I, B], label: `${cap(V.item.singular)} ${ii} en ${V.bin.singular} ${bi}`, unit: '' }],
  };

  const reference: IndexedDraft = {
    sense: 'min',
    objective: { coef: 'w', var: 'y' },
    varTypes: { y: 'bin' },
    constraints: [
      { key: 'una', name: `${cap(V.bin.unoSolo)} por ${V.item.singular}`, forall: [I], coef: null, var: 'y', op: '=', rhs: { kind: 'value', value: '1' } },
      { key: 'horas', name: `Horas (${V.bin.singular})`, forall: [B], coef: 'h', var: 'y', op: '<=', rhs: { kind: 'param', param: 'H' } },
      { key: 'tamano', name: cap(V.size.bin), forall: [I, B], coef: 'n', var: 'y', op: '<=', rhs: { kind: 'param', param: 'K' } },
    ],
  };

  const referenceModel = compileIndexed(spec, reference).model;
  const vid = (it: string, b: string) => `y_${it}_${b}`;

  // Ejemplo de "trampa" de la relajación para la teoría: el ítem más grande en el contenedor más chico.
  const grande = [...items].sort((a, b) => b.size - a.size)[0];
  const chico = [...bins].sort((a, b) => a.size - b.size)[0];
  const frac = chico.size / grande.size;

  const teoria: ContentBlock[] = [
    { type: 'h', text: 'Decisiones de sí o no' },
    {
      type: 'p',
      text: `Hasta ahora las variables eran cantidades: litros, pesos, camiones. Acá la decisión es **sí o no**: ¿${V.item.el} $${ii}$ va ${V.bin.al} $${bi}$? Eso se modela con una **variable binaria**:`,
    },
    {
      type: 'tex',
      tex: `y_{${ii}${bi}} = \\begin{cases} 1 & \\text{si ${V.item.el} } ${ii} \\text{ va ${V.bin.al} } ${bi} \\\\ 0 & \\text{si no} \\end{cases}`,
    },
    {
      type: 'p',
      text: 'Un modelo con variables enteras o binarias es de **programación lineal entera** (PLE o MIP). Asignar turnos, elegir proyectos, abrir o no una fábrica: son todos problemas de este tipo.',
    },
    { type: 'h', text: 'El modelo' },
    { type: 'tex', tex: `\\min \\; \\sum_{${ii} \\in ${I}} \\sum_{${bi} \\in ${B}} w_{${ii}${bi}}\\, y_{${ii}${bi}}` },
    { type: 'p', text: `**${cap(V.bin.unoSolo)}** por ${V.item.singular}, ni más ni menos. Es la restricción típica de asignación:` },
    { type: 'tex', tex: `\\sum_{${bi} \\in ${B}} y_{${ii}${bi}} = 1 \\qquad \\forall\\, ${ii} \\in ${I}` },
    {
      type: 'p',
      text: `**Capacidad de horas**: sumo las horas de ${V.item.los} que caen en cada ${V.bin.singular}. Es una restricción tipo **mochila**: cada ${V.item.singular} "pesa" sus horas.`,
    },
    { type: 'tex', tex: `\\sum_{${ii} \\in ${I}} h_{${ii}}\\, y_{${ii}${bi}} \\leq H_{${bi}} \\qquad \\forall\\, ${bi} \\in ${B}` },
    { type: 'p', text: `**${cap(V.size.bin)}**: acá no se suma nada. Hay una restricción por cada par ${V.item.singular}–${V.bin.singular}:` },
    { type: 'tex', tex: `n_{${ii}}\\, y_{${ii}${bi}} \\leq K_{${bi}} \\qquad \\forall\\, ${ii} \\in ${I},\\ ${bi} \\in ${B}` },
    {
      type: 'note',
      text: `Mirá el truco: si $y_{${ii}${bi}} = 0$ la restricción dice $0 \\leq K_{${bi}}$, que siempre se cumple. Si $y_{${ii}${bi}} = 1$ exige $n_{${ii}} \\leq K_{${bi}}$. La binaria **prende o apaga** la restricción.`,
    },
    { type: 'h', text: 'La relajación lineal (y por qué no alcanza)' },
    {
      type: 'p',
      text: `Si dejás $y_{${ii}${bi}}$ continua entre 0 y 1, el solver hace trampa. Por ejemplo, puede poner **${fmt(frac)} de ${grande.label}** en ${chico.label}: cumple $${grande.size} \\times \\tfrac{${chico.size}}{${grande.size}} = ${chico.size} \\leq ${chico.size}$, pero un pedazo de ${V.item.singular} no existe. Esa versión se llama **relajación lineal**. Su óptimo es una **cota**: ninguna solución real puede ser mejor, pero casi nunca es una solución real.`,
    },
    {
      type: 'p',
      text: `¿Y si redondeo? Redondear una solución fraccionaria puede dejar ${V.item.plural} sin asignar, pasarse de horas o terminar lejos del óptimo. No es un atajo confiable.`,
    },
    { type: 'h', text: 'Cómo resuelve el solver: branch and bound' },
    {
      type: 'list',
      items: [
        'Resuelve la relajación lineal. Si todo sale entero, listo.',
        'Si alguna variable es fraccionaria, por ejemplo $y = 0{,}6$, **ramifica** en dos subproblemas: uno con $y = 0$ y otro con $y = 1$.',
        'Resuelve cada rama. Si una rama ya es peor que la mejor solución entera encontrada, la **poda** sin explorarla.',
        'HiGHS suma además **planos de corte**: restricciones extra que achican la relajación sin perder soluciones enteras.',
      ],
    },
    {
      type: 'p',
      text: 'En el nivel 3 las soluciones enteras salían gratis por la estructura del transporte. Acá la restricción de horas, con "pesos" $h$ distintos, rompe esa estructura. Por eso hay que decirle al solver que las variables son binarias.',
    },
  ];

  const historia: ContentBlock[] = [
    ...v.historia,
    {
      type: 'table',
      head: [cap(V.item.singular), cap(V.size.item), `Horas ${V.hours.periodo}`],
      rows: items.map((it) => [it.label, String(it.size), String(it.hours)]),
    },
    {
      type: 'table',
      head: [cap(V.bin.singular), cap(V.size.bin), 'Horas disponibles'],
      rows: bins.map((b) => [b.label, String(b.size), String(b.hours)]),
    },
    { type: 'h', text: 'Las reglas' },
    {
      type: 'list',
      items: [
        `Cada ${V.item.singular} va a **${V.bin.unoSolo}**, sin partirse.`,
        `Las horas de ${V.item.los} de cada ${V.bin.singular} no pueden superar sus **horas disponibles**.`,
        V.size.regla,
      ],
    },
    { type: 'note', text: V.desperdicio.nota },
  ];

  const pistas = [
    'Las decisiones son sí/no: en **Variables** elegí el tipo **binaria**.',
    `Cada ${V.item.singular} en exactamente un ${V.bin.singular}: "para cada $${ii} \\in$ ${cap(V.item.plural)}", $\\sum_${bi} y_{${ii}${bi}} = 1$. El lado derecho es el número 1.`,
    `Horas: "para cada $${bi} \\in$ ${cap(V.bin.plural)}", con coeficiente $h_${ii}$: $\\sum_${ii} h_${ii}\\, y_{${ii}${bi}} \\leq H_${bi}$.`,
    `${cap(V.size.bin)}: "para cada $${ii}$ y cada $${bi}$" (sin suma), con coeficiente $n_${ii}$: $n_${ii}\\, y_{${ii}${bi}} \\leq K_${bi}$.`,
  ];

  return {
    id: v.id,
    number: 4,
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Asignación · variables binarias',
    variables: items.flatMap((it) =>
      bins.map((b) => ({
        id: vid(it.id, b.id),
        symbol: `y_{\\text{${it.label.replace(/[°#$%&_{}\\^~]/g, '')}},\\text{${b.label.split(' ').pop()!.replace(/[#$%&_{}\\^~]/g, '')}}}`,
        label: `${it.label} en ${b.label}`,
        unit: '',
        min: 0,
        max: 1,
        step: 1,
      })),
    ),
    objective: { sense: 'min', label: V.desperdicio.label, unit: '' },
    referenceModel,
    starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: crearEscenaAsignacion({ items, bins, estilo: v.estilo, espera: V.espera }),
    indexed: {
      spec,
      reference,
      starter: { sense: 'max', objective: { coef: null, var: 'y' }, constraints: [] },
      matrix: { var: 'y', rows: I, cols: B, binary: true, totals: false },
    },
    briefing: historia,
    theory: teoria,
    hints: pistas,

    evaluate(values) {
      const y = (it: string, b: string) => values[vid(it, b)] ?? 0;
      const checks: Check[] = [];

      for (const it of items) {
        const parts = bins.filter((b) => y(it.id, b.id) > 1e-6);
        const whole = parts.length === 1 && near(y(it.id, parts[0].id), 1);
        checks.push({
          label: `${cap(V.item.singular)} ${it.label}`,
          value:
            parts.length === 0
              ? 'sin asignar'
              : whole
                ? parts[0].label
                : parts.map((b) => `${fmt(y(it.id, b.id))} ${b.label}`).join(' + '),
          limit: V.bin.unoSolo,
          ok: whole,
          failMessage:
            parts.length === 0
              ? `${cap(V.item.el)} queda sin ${V.bin.singular}.`
              : parts.length > 1 && parts.every((b) => near(y(it.id, b.id), 1))
                ? `${cap(V.item.el)} no puede estar en dos ${V.bin.plural} a la vez.`
                : `No se puede partir ${V.item.el} entre ${V.bin.plural}. ¿Las variables son binarias?`,
        });
      }

      for (const b of bins) {
        const hs = items.reduce((s, it) => s + it.hours * y(it.id, b.id), 0);
        checks.push({
          label: `Horas ${b.label}`,
          value: `${fmt(hs)} ${V.hours.unit}`,
          limit: `≤ ${b.hours} ${V.hours.unit}`,
          ok: hs <= b.hours + 1e-4, // tolerancia para soluciones fraccionarias redondeadas
          failMessage: V.hours.falla(b.label),
        });
      }

      for (const b of bins) {
        // Sólo cuentan los ítems asignados enteros: los "partidos" ya fallan en su propio chequeo.
        const big = items.filter((it) => near(y(it.id, b.id), 1)).reduce((m, it) => Math.max(m, it.size), 0);
        checks.push({
          label: `${V.size.Check} ${b.label}`,
          value: big ? V.size.valor(big) : 'vacío',
          limit: `≤ ${b.size}`,
          ok: big <= b.size,
          failMessage: V.size.falla(b.label),
        });
      }

      const objective = items.reduce((s, it) => s + bins.reduce((t, b) => t + desperdicio(it, b) * y(it.id, b.id), 0), 0);
      return { feasible: checks.every((c) => c.ok), objective, checks };
    },
  };
}
