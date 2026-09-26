/**
 * Plantilla del nivel avanzado de descomposición de Benders (localización de depósitos).
 *
 * El modelo completo (aperturas binarias + transporte) se puede resolver de una vez, pero el
 * nivel enseña a resolverlo "partido": el maestro elige aperturas y el subproblema de
 * transporte devuelve cortes. El jugador juega de maestro en el intento manual.
 */
import type { ProblemaLocalizacion } from '../../engine/benders';
import { compileIndexed, term, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { Check, ContentBlock, Level } from '../types';
import { crearBendersAutomatico } from './BendersAuto';
import { crearPanelBenders } from './BendersPanel';
import { crearEscenaDepositos } from './Scene';

export interface LugarMapa {
  id: string;
  label: string;
  short: string;
  x: number;
  y: number;
}

export interface VarianteBenders {
  id: string;
  variant: string;
  title: string;
  client: string;
  depositos: (LugarMapa & { costoFijo: number; capacidad: number })[];
  clientes: (LugarMapa & { demanda: number })[];
  /** Costo por camión = distancia × este factor. */
  costoPorDistancia: number;
  historia: ContentBlock[];
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));

export function problemaDe(v: VarianteBenders): ProblemaLocalizacion {
  const lugar = new Map([...v.depositos, ...v.clientes].map((l) => [l.id, l]));
  return {
    depositos: v.depositos,
    clientes: v.clientes,
    costo: (d, c) => {
      const a = lugar.get(d)!;
      const b = lugar.get(c)!;
      return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * v.costoPorDistancia * 10) / 10;
    },
  };
}

export function crearNivelBenders(v: VarianteBenders): Level {
  const P = problemaDe(v);
  const D = v.depositos;
  const C = v.clientes;
  const tol = 1e-6;

  const spec: IndexedSpec = {
    sets: [
      { id: 'D', name: 'Depósitos', index: 'd', items: D.map(({ id, label, short }) => ({ id, label, short })) },
      { id: 'C', name: 'Clientes', index: 'c', items: C.map(({ id, label, short }) => ({ id, label, short })) },
    ],
    params: [
      { id: 'f', name: 'Costo fijo del depósito ($k/sem)', symbol: 'f', over: ['D'], values: Object.fromEntries(D.map((d) => [d.id, d.costoFijo])) },
      { id: 'K', name: 'Capacidad del depósito', symbol: 'K', over: ['D'], values: Object.fromEntries(D.map((d) => [d.id, d.capacidad])) },
      { id: 'q', name: 'Demanda del cliente', symbol: 'q', over: ['C'], values: Object.fromEntries(C.map((c) => [c.id, c.demanda])) },
      {
        id: 't',
        name: 'Costo por camión ($k)',
        symbol: 't',
        over: ['D', 'C'],
        values: Object.fromEntries(D.flatMap((d) => C.map((c) => [`${d.id}|${c.id}`, P.costo(d.id, c.id)]))),
      },
    ],
    vars: [
      { id: 'y', symbol: 'y', over: ['D'], label: 'Abrir el depósito d', unit: '' },
      { id: 'x', symbol: 'x', over: ['D', 'C'], label: 'Camiones de d a c', unit: 'camiones' },
    ],
  };

  const reference: IndexedDraft = {
    sense: 'min',
    objective: { terms: [term('y', 'f'), term('x', 't')] },
    varTypes: { y: 'bin' },
    constraints: [
      { key: 'demanda', name: 'Demanda', forall: ['C'], terms: [term('x')], op: '>=', rhs: { kind: 'param', param: 'q' } },
      { key: 'vinculo', name: 'Capacidad si está abierto', forall: ['D'], terms: [term('x'), term('y', 'K', -1)], op: '<=', rhs: { kind: 'value', value: '0' } },
    ],
  };
  const referenceModel = compileIndexed(spec, reference).model;

  const teoria: ContentBlock[] = [
    { type: 'h', text: 'El modelo completo' },
    {
      type: 'p',
      text: 'Es una **localización de depósitos con capacidad**: binarias $y_d$ (abrir o no) y continuas $x_{dc}$ (camiones de $d$ a $c$). Junta el costo fijo del nivel 5 con el transporte del nivel 3:',
    },
    { type: 'tex', tex: '\\min \\; \\sum_d f_d\\, y_d + \\sum_d \\sum_c t_{dc}\\, x_{dc}' },
    { type: 'tex', tex: '\\sum_d x_{dc} \\geq q_c \\;\\; \\forall\\, c \\qquad \\sum_c x_{dc} \\leq K_d\\, y_d \\;\\; \\forall\\, d' },
    {
      type: 'p',
      text: 'Con 5 depósitos se resuelve de una vez en milisegundos. Pero con 500 depósitos, 10.000 clientes y 50 escenarios de demanda, el modelo completo es gigante. Ahí conviene **partirlo**.',
    },
    { type: 'h', text: 'La idea de Benders' },
    {
      type: 'list',
      items: [
        '**Maestro**: decide sólo lo difícil, **qué depósitos abrir**. Como no sabe cuánto va a costar el transporte, lo estima con una variable $\\theta$.',
        '**Subproblema**: con los depósitos ya elegidos, el transporte es un LP chico y fácil, como el del nivel 3. Lo resuelve y devuelve el costo real.',
        'Con los **precios sombra** del subproblema se arma un **corte**: una restricción nueva para el maestro que le enseña cuánto cuesta el transporte.',
      ],
    },
    { type: 'h', text: 'De dónde sale el corte' },
    {
      type: 'p',
      text: 'Sean $u_c$ los precios sombra de la demanda y $v_d \\leq 0$ los de la capacidad. Por dualidad, el costo de transporte de **cualquier** apertura $y$ es al menos:',
    },
    { type: 'tex', tex: '\\theta \\;\\geq\\; \\sum_c u_c\\, q_c \\; + \\; \\sum_d v_d\\, K_d\\, y_d' },
    {
      type: 'p',
      text: 'Para la apertura que se probó, vale con igualdad: es el costo exacto. Para las demás es una **cota**. Los $v_d K_d$ negativos se leen así: "si abrís este depósito, el transporte baja a lo sumo tanto". Cada ronda agrega un corte y el maestro se va volviendo más realista.',
    },
    { type: 'h', text: 'Dos cotas que se encuentran' },
    {
      type: 'list',
      items: [
        '**Cota inferior**: lo que cree el maestro. Como todavía no conoce todos los costos, es optimista. Con cada corte sube (o se queda igual).',
        '**Cota superior**: la mejor solución real probada hasta ahora (costo fijo + transporte real). Baja (o se queda igual).',
        'Cuando **se tocan**, está **demostrado** que la mejor solución encontrada es la óptima, sin haber probado todas las combinaciones.',
      ],
    },
    {
      type: 'note',
      text: 'Hay otro tipo de corte, el de **factibilidad**: si una apertura no alcanza para cubrir la demanda, el subproblema no tiene solución y avisa "esta combinación no sirve". Acá lo resumimos en una restricción del maestro desde el arranque: la capacidad abierta tiene que alcanzar la demanda total.',
    },
    { type: 'h', text: 'Parientes' },
    {
      type: 'p',
      text: 'Es **generación de filas**, como los cortes de subtours del nivel 6, pero los cortes los calcula otro problema de optimización. Su "hermana" dual es la **generación de columnas**, que agrega variables en vez de restricciones. Benders brilla en problemas con **incertidumbre**: un maestro con las decisiones de hoy y un subproblema por cada escenario futuro.',
    },
  ];

  const pistas = [
    '$y_d$ binaria y $x_{dc}$ continua. El objetivo tiene dos términos: $\\sum_d f_d y_d + \\sum_d \\sum_c t_{dc} x_{dc}$.',
    'Demanda, "para cada $c$": $\\sum_d x_{dc} \\geq q_c$.',
    'La clave: un depósito cerrado no despacha. "Para cada $d$": $\\sum_c x_{dc} - K_d\\, y_d \\leq 0$ (la activación del nivel 5).',
  ];

  const label = (id: string) => [...D, ...C].find((l) => l.id === id)!.label;

  return {
    id: v.id,
    number: 103,
    codigo: 'A3',
    seccion: 'avanzada',
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Descomposición de Benders',
    variables: [
      ...D.map((d) => ({ id: `y_${d.id}`, symbol: `y_{\\text{${d.short}}}`, label: `Abrir ${d.label}`, unit: '', min: 0, max: 1, step: 1 })),
      ...D.flatMap((d) =>
        C.map((c) => ({
          id: `x_${d.id}_${c.id}`,
          symbol: `x_{\\text{${d.short}},\\text{${c.short}}}`,
          label: `${d.label} → ${c.label}`,
          unit: 'camiones',
          min: 0,
          max: c.demanda,
          step: 1,
        })),
      ),
    ],
    objective: { sense: 'min', label: 'Costo semanal ($k)', unit: '$' },
    referenceModel,
    starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: crearEscenaDepositos(v),
    indexed: {
      spec,
      reference,
      starter: { sense: 'max', objective: { terms: [term('x')] }, constraints: [] },
      matrix: { var: 'x', rows: 'D', cols: 'C', rowParam: 'K', colParam: 'q' },
    },
    manualComponent: crearPanelBenders(v, P),
    resultsExtra: crearBendersAutomatico(v, P),
    briefing: [
      ...v.historia,
      {
        type: 'table',
        head: ['Depósito candidato', 'Costo fijo ($k/sem)', 'Capacidad (camiones/sem)'],
        rows: D.map((d) => [d.label, String(d.costoFijo), String(d.capacidad)]),
      },
      {
        type: 'table',
        head: ['Cliente', 'Demanda (camiones/sem)'],
        rows: C.map((c) => [c.label, String(c.demanda)]),
      },
      {
        type: 'note',
        text: 'El costo de cada camión depende de la distancia entre el depósito y el cliente (lo ves en el mapa). Objetivo: **costo fijo + transporte** mínimo.',
      },
    ],
    theory: teoria,
    hints: pistas,

    evaluate(values) {
      const y = (d: string) => values[`y_${d}`] ?? 0;
      const x = (d: string, c: string) => values[`x_${d}_${c}`] ?? 0;
      const checks: Check[] = [];

      const faltan = C.map((c) => ({ c, got: D.reduce((s, d) => s + x(d.id, c.id), 0) })).filter((r) => r.got < r.c.demanda - tol);
      checks.push({
        label: 'Demanda',
        value: faltan.length ? `${faltan.length} cliente(s) sin cubrir` : 'cubierta',
        limit: 'todos los clientes',
        ok: faltan.length === 0,
        failMessage: faltan.length
          ? `${faltan[0].c.label} recibe ${fmt(faltan[0].got)} de ${faltan[0].c.demanda} camiones.`
          : undefined,
      });

      const cerradosQueDespachan = D.filter((d) => y(d.id) < 0.5 && C.some((c) => x(d.id, c.id) > tol));
      checks.push({
        label: 'Depósitos cerrados',
        value: cerradosQueDespachan.length ? cerradosQueDespachan.map((d) => d.short).join(', ') : 'no despachan',
        limit: 'sin envíos',
        ok: cerradosQueDespachan.length === 0,
        failMessage: `Salen camiones de ${cerradosQueDespachan[0]?.label ?? ''}, que está cerrado. ¿Falta la restricción que une x con y?`,
      });

      const excedidos = D.filter((d) => C.reduce((s, c) => s + x(d.id, c.id), 0) > d.capacidad + tol);
      checks.push({
        label: 'Capacidad',
        value: excedidos.length ? excedidos.map((d) => d.short).join(', ') : 'dentro del límite',
        limit: '≤ K_d',
        ok: excedidos.length === 0,
        failMessage: `${excedidos[0]?.label ?? ''} no da abasto.`,
      });

      const frac = D.filter((d) => y(d.id) > tol && y(d.id) < 1 - tol);
      checks.push({
        label: 'Aperturas enteras',
        value: frac.length ? frac.map((d) => `${fmt(y(d.id))} ${d.short}`).join(', ') : 'sí',
        limit: 'abrir o no abrir',
        ok: frac.length === 0,
        failMessage: `No se puede abrir "${fmt(y(frac[0]?.id ?? ''))}" de ${label(frac[0]?.id ?? D[0].id)}. ¿y es binaria?`,
      });

      const objective =
        D.reduce((s, d) => s + (y(d.id) > 0.5 ? d.costoFijo : 0), 0) +
        D.reduce((s, d) => s + C.reduce((t, c) => t + P.costo(d.id, c.id) * x(d.id, c.id), 0), 0);
      return { feasible: checks.every((c) => c.ok), objective: Math.round(objective * 1e6) / 1e6, checks };
    },
  };
}
