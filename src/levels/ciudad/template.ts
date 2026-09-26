/**
 * Plantilla del nivel de cartera de proyectos con reglas lógicas y dos objetivos.
 *
 * Se elige qué proyectos hacer (y_p binaria) con un presupuesto. Hay reglas entre proyectos
 * (requiere / excluye / al menos k de…) y dos objetivos en tensión: maximizar un beneficio y
 * minimizar un impacto. El cliente fija un tope al impacto; el juego muestra además la
 * frontera de Pareto completa.
 */
import { compileIndexed, term, termAt, type IndexedConstraint, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { Check, ContentBlock, Level, SceneSpec } from '../types';
import { crearPanelPareto } from './ParetoPanel';
import { crearSelectorDeProyectos } from './ProjectPicker';

export interface Proyecto {
  id: string;
  label: string;
  short: string;
  costo: number;
  beneficio: number; // p. ej. empleos
  impacto: number; // p. ej. emisiones (puede ser negativo)
}

export type Regla =
  | { tipo: 'requiere'; a: string; b: string[]; texto: string }
  | { tipo: 'excluye'; a: string; b: string; texto: string }
  | { tipo: 'alMenos'; k: number; de: string[]; texto: string };

export interface VarianteCiudad {
  id: string;
  variant: string;
  title: string;
  client: string;
  proyectos: Proyecto[];
  reglas: Regla[];
  presupuesto: number;
  topeImpacto: number;
  vocab: {
    moneda: string; // "$M"
    beneficio: string; // "Empleos"
    impacto: string; // "Emisiones"
    unidadImpacto: string; // "kt CO₂/año"
    compromiso: string; // "Compromiso ambiental"
  };
  historia: ContentBlock[];
  scene: SceneSpec;
}

export const yId = (p: string) => `y_${p}`;

/** Restricción indexada equivalente a una regla lógica. */
function reglaAConstraint(r: Regla, i: number): IndexedConstraint {
  const base = { key: `regla${i}`, forall: [], op: '<=' as const, rhs: { kind: 'value' as const, value: '0' } };
  if (r.tipo === 'requiere')
    return { ...base, name: `Regla ${i + 1}`, terms: [termAt('y', { P: r.a }), ...r.b.map((b) => termAt('y', { P: b }, -1))] };
  if (r.tipo === 'excluye')
    return { ...base, name: `Regla ${i + 1}`, terms: [termAt('y', { P: r.a }), termAt('y', { P: r.b })], rhs: { kind: 'value', value: '1' } };
  return {
    ...base,
    name: `Regla ${i + 1}`,
    terms: r.de.map((p) => termAt('y', { P: p })),
    op: '>=',
    rhs: { kind: 'value', value: String(r.k) },
  };
}

export function crearNivelCiudad(v: VarianteCiudad): Level {
  const { proyectos: P, vocab: V } = v;
  const items = P.map(({ id, label, short }) => ({ id, label, short }));

  const spec: IndexedSpec = {
    sets: [{ id: 'P', name: 'Proyectos', index: 'p', items }],
    params: [
      { id: 'c', name: `Costo (${V.moneda})`, symbol: 'c', over: ['P'], values: Object.fromEntries(P.map((p) => [p.id, p.costo])) },
      { id: 'e', name: V.beneficio, symbol: 'e', over: ['P'], values: Object.fromEntries(P.map((p) => [p.id, p.beneficio])) },
      { id: 'm', name: `${V.impacto} (${V.unidadImpacto})`, symbol: 'm', over: ['P'], values: Object.fromEntries(P.map((p) => [p.id, p.impacto])) },
      { id: 'B', name: 'Presupuesto', symbol: 'B', over: [], values: { '': v.presupuesto } },
      { id: 'E', name: `Tope de ${V.impacto.toLowerCase()}`, symbol: 'E', over: [], values: { '': v.topeImpacto } },
    ],
    vars: [{ id: 'y', symbol: 'y', over: ['P'], label: 'Hacer el proyecto p', unit: '' }],
  };

  const reference: IndexedDraft = {
    sense: 'max',
    objective: { terms: [term('y', 'e')] },
    varTypes: { y: 'bin' },
    constraints: [
      { key: 'presupuesto', name: 'Presupuesto', forall: [], terms: [term('y', 'c')], op: '<=', rhs: { kind: 'param', param: 'B' } },
      { key: 'impacto', name: V.compromiso, forall: [], terms: [term('y', 'm')], op: '<=', rhs: { kind: 'param', param: 'E' } },
      ...v.reglas.map(reglaAConstraint),
    ],
  };
  const referenceModel = compileIndexed(spec, reference).model;

  const ejemplo = (tipo: Regla['tipo']) => v.reglas.find((r) => r.tipo === tipo);
  const req = ejemplo('requiere');
  const exc = ejemplo('excluye');
  const alm = ejemplo('alMenos');
  const y = (id: string) => `y_{\\text{${P.find((p) => p.id === id)!.short}}}`;

  const teoria: ContentBlock[] = [
    { type: 'h', text: 'Elegir proyectos: la mochila con reglas' },
    {
      type: 'p',
      text: 'Cada proyecto se hace o no se hace: $y_p \\in \\{0,1\\}$. Con un presupuesto $\\sum_p c_p y_p \\leq B$, es un problema de **mochila**, como en el nivel 4. Lo nuevo son las **reglas entre decisiones**.',
    },
    { type: 'h', text: 'Lógica con binarias' },
    {
      type: 'table',
      head: ['Regla', 'Restricción'],
      rows: [
        ['"A requiere B" (si A, entonces B)', 'y_A ≤ y_B'],
        ['"A requiere B o C"', 'y_A ≤ y_B + y_C'],
        ['"A y B no pueden ir juntos"', 'y_A + y_B ≤ 1'],
        ['"Al menos k de un grupo"', 'Σ y ≥ k'],
        ['"Exactamente uno de un grupo"', 'Σ y = 1'],
      ],
    },
    ...(req && req.tipo === 'requiere'
      ? [
          {
            type: 'p' as const,
            text: `Por ejemplo: "${req.texto}" se escribe $${y(req.a)} \\leq ${req.b.map(y).join(' + ')}$. Si $${y(req.a)} = 1$, obliga a que al menos uno de la derecha valga 1. Si vale 0, no exige nada.`,
          },
        ]
      : []),
    ...(exc && exc.tipo === 'excluye'
      ? [{ type: 'p' as const, text: `"${exc.texto}": $${y(exc.a)} + ${y(exc.b)} \\leq 1$.` }]
      : []),
    ...(alm && alm.tipo === 'alMenos'
      ? [{ type: 'p' as const, text: `"${alm.texto}": $${alm.de.map(y).join(' + ')} \\geq ${alm.k}$.` }]
      : []),
    {
      type: 'note',
      text: 'En el modelador, cada término puede **sumar sobre todos** los proyectos o referirse a **uno en particular**. Para las reglas vas a necesitar lo segundo.',
    },
    { type: 'h', text: 'Dos objetivos: no hay "un" óptimo' },
    {
      type: 'p',
      text: `Se quiere **más ${V.beneficio.toLowerCase()}** y **menos ${V.impacto.toLowerCase()}**, pero los proyectos que más ${V.beneficio.toLowerCase()} dan suelen ser los que más contaminan. Una solución **domina** a otra si es al menos igual de buena en los dos objetivos y mejor en alguno. Las soluciones que ninguna otra domina forman la **frontera de Pareto**.`,
    },
    { type: 'p', text: 'Elegir un punto de la frontera es una decisión **política**, no matemática. La matemática muestra el menú. Hay dos formas de recorrerlo:' },
    {
      type: 'list',
      items: [
        '**Suma ponderada**: $\\max \\sum e_p y_p - \\lambda \\sum m_p y_p$, probando distintos pesos $\\lambda$. Es simple, pero con decisiones binarias **se saltea puntos**: sólo encuentra los que están sobre la "envolvente convexa" de la frontera.',
        '**ε-restricción**: se maximiza un objetivo y el otro pasa a ser restricción, $\\sum m_p y_p \\leq \\varepsilon$. Moviendo $\\varepsilon$ se recorre **toda** la frontera.',
      ],
    },
    {
      type: 'note',
      text: `El intendente ya eligió: ${V.impacto.toLowerCase()} de a lo sumo **${v.topeImpacto} ${V.unidadImpacto}**. Es una ε-restricción: tu modelo tiene que maximizar ${V.beneficio.toLowerCase()} con ese tope. En el resultado vas a ver dónde cae tu solución en la frontera completa.`,
    },
  ];

  const pistas = [
    `$y_p$ es **binaria**. Objetivo: $\\max \\sum_p e_p\\, y_p$.`,
    `Dos restricciones que suman sobre todos: presupuesto $\\sum_p c_p y_p \\leq B$ y ${V.impacto.toLowerCase()} $\\sum_p m_p y_p \\leq E$.`,
    'Cada regla es una restricción "una sola vez", con términos de proyectos **en particular** (elegí "sólo …" en el selector del término).',
    ...(req && req.tipo === 'requiere' ? [`"${req.texto}": $+\\,${y(req.a)} ${req.b.map((b) => `- ${y(b)}`).join(' ')} \\leq 0$.`] : []),
  ];

  return {
    id: v.id,
    number: 7,
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Reglas lógicas · multi-objetivo (Pareto)',
    variables: P.map((p) => ({ id: yId(p.id), symbol: `y_{\\text{${p.short}}}`, label: p.label, unit: '', min: 0, max: 1, step: 1 })),
    objective: { sense: 'max', label: V.beneficio, unit: '' },
    referenceModel,
    starterModel: { sense: 'max', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: v.scene,
    indexed: {
      spec,
      reference,
      starter: { sense: 'max', objective: { terms: [term('y')] }, constraints: [] },
      pickItems: true,
    },
    manualComponent: crearSelectorDeProyectos(v),
    briefing: [
      ...v.historia,
      {
        type: 'table',
        head: ['Proyecto', `Costo (${V.moneda})`, V.beneficio, `${V.impacto} (${V.unidadImpacto})`],
        rows: P.map((p) => [p.label, String(p.costo), String(p.beneficio), String(p.impacto)]),
      },
      { type: 'h', text: 'Las reglas' },
      {
        type: 'list',
        items: [
          `Presupuesto: **${V.moneda} ${v.presupuesto}**.`,
          `${V.compromiso}: ${V.impacto.toLowerCase()} totales de a lo sumo **${v.topeImpacto} ${V.unidadImpacto}**.`,
          ...v.reglas.map((r) => r.texto),
        ],
      },
      { type: 'note', text: `Objetivo: la mayor cantidad de **${V.beneficio.toLowerCase()}** cumpliendo todo.` },
    ],
    theory: teoria,
    hints: pistas,
    resultsExtra: crearPanelPareto(v, referenceModel),

    evaluate(values) {
      const on = (id: string) => (values[yId(id)] ?? 0) > 0.5;
      const frac = P.filter((p) => {
        const x = values[yId(p.id)] ?? 0;
        return x > 1e-6 && x < 1 - 1e-6;
      });
      // El mundo cuenta como "hecho" lo que tiene y ≥ 0,5; las fracciones fallan aparte.
      const gasto = P.reduce((s, p) => s + (on(p.id) ? p.costo : 0), 0);
      const imp = P.reduce((s, p) => s + (on(p.id) ? p.impacto : 0), 0);
      const checks: Check[] = [
        {
          label: 'Presupuesto',
          value: `${V.moneda} ${gasto}`,
          limit: `≤ ${v.presupuesto}`,
          ok: gasto <= v.presupuesto,
          failMessage: 'La obra se queda sin fondos a mitad de camino.',
        },
        {
          label: V.compromiso,
          value: `${imp} ${V.unidadImpacto}`,
          limit: `≤ ${v.topeImpacto}`,
          ok: imp <= v.topeImpacto,
          failMessage: `Se rompe el compromiso: ${V.impacto.toLowerCase()} por encima del tope.`,
        },
        ...v.reglas.map((r) => {
          const ok =
            r.tipo === 'requiere'
              ? !on(r.a) || r.b.some(on)
              : r.tipo === 'excluye'
                ? !(on(r.a) && on(r.b))
                : r.de.filter(on).length >= r.k;
          return { label: r.texto, value: ok ? 'se cumple' : 'no se cumple', limit: '', ok, failMessage: undefined };
        }),
        {
          label: 'Proyectos enteros',
          value: frac.length ? frac.map((p) => p.label).join(', ') : 'sí',
          limit: 'hacer o no hacer',
          ok: frac.length === 0,
          failMessage: `No se puede hacer "medio ${frac[0]?.label.toLowerCase() ?? 'proyecto'}". ¿y es binaria?`,
        },
      ];
      const beneficio = P.reduce((s, p) => s + (on(p.id) ? p.beneficio : 0), 0);
      return { feasible: checks.every((c) => c.ok), objective: beneficio, checks };
    },
  };
}
