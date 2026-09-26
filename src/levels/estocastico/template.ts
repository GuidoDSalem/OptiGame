/**
 * Plantilla del nivel avanzado de Benders estocástico (programación estocástica en dos etapas).
 *
 * Primera etapa: qué plantas abrir, sin saber cómo viene el año. Segunda etapa: el reparto en
 * cada escenario, con silo bolsa para lo que no entra. El modelo completo pondera cada escenario
 * por su probabilidad; el nivel lo resuelve también con Benders multi-corte (L-shaped).
 */
import type { ProblemaEstocastico } from '../../engine/estocastico';
import { compileIndexed, term, termProd, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { LugarMapa } from '../benders/template';
import type { Check, ContentBlock, Level } from '../types';
import { crearEstocasticoAutomatico } from './EstocasticoAuto';
import { crearPanelEstocastico } from './EstocasticoPanel';
import { crearEscenaAcopio } from './Scene';

export interface VarianteEstocastica {
  id: string;
  variant: string;
  title: string;
  client: string;
  plantas: (LugarMapa & { costoFijo: number; capacidad: number })[];
  /** Cantidad de cada zona en cada escenario (en el orden de `escenarios`). */
  zonas: (LugarMapa & { cosecha: number[] })[];
  escenarios: { id: string; label: string; short: string; prob: number }[];
  costoPorDistancia: number;
  /** Costo por unidad que no entra en ninguna planta. */
  penalidad: number;
  unidad: string;
  moneda: string;
  historia: ContentBlock[];
}

const coma = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function problemaDe(v: VarianteEstocastica): ProblemaEstocastico {
  const lugar = new Map([...v.plantas, ...v.zonas].map((l) => [l.id, l]));
  return {
    depositos: v.plantas,
    clientes: v.zonas,
    escenarios: v.escenarios.map((s, k) => ({ id: s.id, prob: s.prob, demanda: Object.fromEntries(v.zonas.map((z) => [z.id, z.cosecha[k]])) })),
    costo: (d, c) => {
      const a = lugar.get(d)!;
      const b = lugar.get(c)!;
      return Math.round(Math.hypot(a.x - b.x, a.y - b.y) * v.costoPorDistancia * 10) / 10;
    },
    penalidad: v.penalidad,
  };
}

export function crearNivelEstocastico(v: VarianteEstocastica): Level {
  const P = problemaDe(v);
  const D = v.plantas;
  const C = v.zonas;
  const S = v.escenarios;
  const tol = 1e-6;
  const U = v.unidad;

  const spec: IndexedSpec = {
    sets: [
      { id: 'D', name: 'Plantas', index: 'd', items: D.map(({ id, label, short }) => ({ id, label, short })) },
      { id: 'C', name: 'Zonas', index: 'c', items: C.map(({ id, label, short }) => ({ id, label, short })) },
      { id: 'S', name: 'Escenarios', index: 's', items: S.map(({ id, label, short }) => ({ id, label, short })) },
    ],
    params: [
      { id: 'f', name: 'Costo fijo de la planta', symbol: 'f', over: ['D'], values: Object.fromEntries(D.map((d) => [d.id, d.costoFijo])) },
      { id: 'K', name: `Capacidad de la planta (${U})`, symbol: 'K', over: ['D'], values: Object.fromEntries(D.map((d) => [d.id, d.capacidad])) },
      {
        id: 'q',
        name: `Cosecha de la zona en el escenario (${U})`,
        symbol: 'q',
        over: ['C', 'S'],
        values: Object.fromEntries(C.flatMap((c) => S.map((s, k) => [`${c.id}|${s.id}`, c.cosecha[k]]))),
      },
      { id: 'p', name: 'Probabilidad del escenario', symbol: 'p', over: ['S'], values: Object.fromEntries(S.map((s) => [s.id, s.prob])) },
      {
        id: 't',
        name: `Flete por ${U}`,
        symbol: 't',
        over: ['D', 'C'],
        values: Object.fromEntries(D.flatMap((d) => C.map((c) => [`${d.id}|${c.id}`, P.costo(d.id, c.id)]))),
      },
      { id: 'u', name: `Costo de silo bolsa por ${U}`, symbol: 'u', over: [], values: { '': v.penalidad } },
    ],
    vars: [
      { id: 'y', symbol: 'y', over: ['D'], label: 'Alquilar la planta d', unit: '' },
      { id: 'x', symbol: 'x', over: ['D', 'C', 'S'], label: 'Grano de c a d en el escenario s', unit: U },
      { id: 'w', symbol: 'w', over: ['C', 'S'], label: 'Grano de c en silo bolsa en s', unit: U },
    ],
  };

  const reference: IndexedDraft = {
    sense: 'min',
    objective: { terms: [term('y', 'f'), termProd('x', 'p', 't'), termProd('w', 'p', 'u')] },
    varTypes: { y: 'bin' },
    constraints: [
      { key: 'cosecha', name: 'Cosecha guardada', forall: ['C', 'S'], terms: [term('x'), term('w')], op: '>=', rhs: { kind: 'param', param: 'q' } },
      { key: 'vinculo', name: 'Capacidad si está alquilada', forall: ['D', 'S'], terms: [term('x'), term('y', 'K', -1)], op: '<=', rhs: { kind: 'value', value: '0' } },
    ],
  };
  const referenceModel = compileIndexed(spec, reference).model;

  const teoria: ContentBlock[] = [
    { type: 'h', text: 'Decidir sin saber' },
    {
      type: 'p',
      text: 'Hay decisiones de **primera etapa**, que se toman hoy y no se pueden cambiar (alquilar plantas: $y_d$), y de **segunda etapa**, que se ajustan cuando se conoce el escenario (el reparto $x_{dcs}$ y el silo bolsa $w_{cs}$). Por eso $x$ y $w$ llevan el índice $s$ y $y$ no: la planta es la misma pase lo que pase.',
    },
    { type: 'h', text: 'El modelo en dos etapas' },
    { type: 'p', text: 'Se minimiza el costo fijo más el **costo esperado** de la segunda etapa, ponderando cada escenario por su probabilidad $p_s$:' },
    { type: 'tex', tex: '\\min \\; \\sum_d f_d\\, y_d + \\sum_s p_s \\Big( \\sum_{d,c} t_{dc}\\, x_{dcs} + \\sum_c u\\, w_{cs} \\Big)' },
    { type: 'tex', tex: '\\sum_d x_{dcs} + w_{cs} \\geq q_{cs} \\;\\; \\forall\\, c, s \\qquad \\sum_c x_{dcs} \\leq K_d\\, y_d \\;\\; \\forall\\, d, s' },
    {
      type: 'p',
      text: 'Es el modelo de A3 **copiado una vez por escenario**, con las $y$ compartidas. Con 3 escenarios se resuelve de una vez; con 1.000 escenarios (años de lluvia históricos, simulaciones de precios) el modelo se multiplica por mil.',
    },
    { type: 'h', text: 'Planificar para el promedio no alcanza' },
    {
      type: 'list',
      items: [
        '**Plan para el año promedio**: se reemplaza la cosecha por su valor esperado y se resuelve un modelo común. Es rápido, pero después hay que vivir los años reales: el lluvioso llena los silos bolsa.',
        '**Plan para el peor año**: alquilar para el año lluvioso. Nunca falta lugar, pero la mayoría de los años sobran plantas pagadas.',
        '**Plan estocástico**: el que minimiza el costo esperado considerando todos los escenarios a la vez. La diferencia con el plan del promedio se llama **valor de la solución estocástica** (VSS).',
      ],
    },
    { type: 'note', text: 'Y si supieras el clima de antemano, ¿cuánto ahorrarías? Esa diferencia es el **valor esperado de la información perfecta** (EVPI): lo máximo que valdría pagar por un pronóstico infalible.' },
    { type: 'h', text: 'Benders con escenarios (L-shaped)' },
    {
      type: 'list',
      items: [
        '**Maestro**: decide qué plantas alquilar y estima el costo de cada escenario con una variable $\\theta_s$.',
        '**Subproblemas**: con las plantas fijas, **cada escenario es un transporte independiente**. Se resuelven por separado (y en un solver real, en paralelo).',
        'Cada escenario devuelve **su propio corte** con sus precios sombra: $\\theta_s \\geq \\sum_c \\pi_{cs}\\, q_{cs} + \\sum_d v_{ds}\\, K_d\\, y_d$.',
      ],
    },
    {
      type: 'p',
      text: 'Es la versión **multi-corte**. También se pueden sumar los cortes de una ronda ponderados por $p_s$ y agregar uno solo (**corte único**): el maestro queda más chico, pero aprende menos por ronda.',
    },
    { type: 'note', text: 'El silo bolsa hace que todo escenario tenga solución con cualquier apertura (se dice que el problema tiene **recurso completo**): no hacen falta cortes de factibilidad.' },
  ];

  const pistas = [
    '$y_d$ binaria, sin escenario. $x_{dcs}$ y $w_{cs}$ continuas, una por escenario.',
    'En el objetivo, el flete y el silo bolsa se ponderan por la probabilidad: el término de $x$ lleva dos coeficientes, $p_s \\cdot t_{dc}$; el de $w$, $p_s \\cdot u$.',
    'Para cada zona y escenario: $\\sum_d x_{dcs} + w_{cs} \\geq q_{cs}$. Para cada planta y escenario: $\\sum_c x_{dcs} - K_d\\, y_d \\leq 0$.',
  ];

  const lbl = (id: string) => [...D, ...C].find((l) => l.id === id)!.label;

  return {
    id: v.id,
    number: 104,
    codigo: 'A4',
    seccion: 'avanzada',
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Benders estocástico',
    variables: [
      ...D.map((d) => ({ id: `y_${d.id}`, symbol: `y_{\\text{${d.short}}}`, label: `Alquilar ${d.label}`, unit: '', min: 0, max: 1, step: 1 })),
      ...S.flatMap((s, k) =>
        C.flatMap((c) => [
          ...D.map((d) => ({
            id: `x_${d.id}_${c.id}_${s.id}`,
            symbol: `x_{\\text{${d.short}},\\text{${c.short}},\\text{${s.short}}}`,
            label: `${c.label} → ${d.label} (${s.label})`,
            unit: U,
            min: 0,
            max: c.cosecha[k],
            step: 1,
          })),
          { id: `w_${c.id}_${s.id}`, symbol: `w_{\\text{${c.short}},\\text{${s.short}}}`, label: `${c.label} en silo bolsa (${s.label})`, unit: U, min: 0, max: c.cosecha[k], step: 1 },
        ]),
      ),
    ],
    objective: { sense: 'min', label: `Costo esperado (${v.moneda})`, unit: '$' },
    referenceModel,
    starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: crearEscenaAcopio(v),
    indexed: {
      spec,
      reference,
      starter: { sense: 'max', objective: { terms: [term('x')] }, constraints: [] },
      twoCoefs: true,
    },
    manualComponent: crearPanelEstocastico(v, P),
    resultsExtra: crearEstocasticoAutomatico(v, P),
    briefing: [
      ...v.historia,
      {
        type: 'table',
        head: ['Planta candidata', `Costo fijo (${v.moneda})`, `Capacidad (${U})`],
        rows: D.map((d) => [d.label, String(d.costoFijo), String(d.capacidad)]),
      },
      {
        type: 'table',
        head: ['Zona', ...S.map((s) => `${s.label} (p = ${coma(s.prob)})`)],
        rows: [
          ...C.map((c) => [c.label, ...c.cosecha.map(String)]),
          ['Total', ...S.map((_, k) => String(C.reduce((t, c) => t + c.cosecha[k], 0)))],
        ],
      },
      {
        type: 'note',
        text: `Flete: ${coma(v.costoPorDistancia)} ${v.moneda} por ${U} y por unidad de distancia en el mapa. Silo bolsa: **${coma(v.penalidad)} ${v.moneda} por ${U}**. Capacidad total si se alquila todo: ${D.reduce((t, d) => t + d.capacidad, 0)} ${U}.`,
      },
    ],
    theory: teoria,
    hints: pistas,

    evaluate(values) {
      const y = (d: string) => values[`y_${d}`] ?? 0;
      const x = (d: string, c: string, s: string) => values[`x_${d}_${c}_${s}`] ?? 0;
      const w = (c: string, s: string) => values[`w_${c}_${s}`] ?? 0;
      const checks: Check[] = [];

      const faltas = S.flatMap((s, k) =>
        C.map((c) => ({ s, c, got: D.reduce((t, d) => t + x(d.id, c.id, s.id), 0) + w(c.id, s.id), q: c.cosecha[k] })),
      ).filter((r) => r.got < r.q - tol);
      checks.push({
        label: 'Cosecha guardada',
        value: faltas.length ? `${faltas.length} zona(s)/escenario sin guardar` : 'en todos los escenarios',
        limit: 'todo el grano',
        ok: faltas.length === 0,
        failMessage: faltas.length
          ? `${faltas[0].s.label}: de ${faltas[0].c.label} se guardan ${coma(faltas[0].got)} de ${faltas[0].q} ${U}. El grano no se puede dejar en el campo.`
          : undefined,
      });

      const cerradas = D.filter((d) => y(d.id) < 0.5 && S.some((s) => C.some((c) => x(d.id, c.id, s.id) > tol)));
      checks.push({
        label: 'Plantas no alquiladas',
        value: cerradas.length ? cerradas.map((d) => d.short).join(', ') : 'no reciben grano',
        limit: 'sin envíos',
        ok: cerradas.length === 0,
        failMessage: `Llega grano a ${cerradas[0]?.label ?? ''}, que no está alquilada. ¿Falta la restricción que une x con y?`,
      });

      const excedidas = D.flatMap((d) => S.filter((s) => C.reduce((t, c) => t + x(d.id, c.id, s.id), 0) > d.capacidad + tol).map((s) => ({ d, s })));
      checks.push({
        label: 'Capacidad',
        value: excedidas.length ? excedidas.map((e) => `${e.d.short} (${e.s.short})`).join(', ') : 'dentro del límite',
        limit: '≤ K_d en cada escenario',
        ok: excedidas.length === 0,
        failMessage: `${excedidas[0]?.d.label ?? ''} no da abasto en el ${excedidas[0]?.s.label.toLowerCase() ?? ''}.`,
      });

      const frac = D.filter((d) => y(d.id) > tol && y(d.id) < 1 - tol);
      checks.push({
        label: 'Alquileres enteros',
        value: frac.length ? frac.map((d) => `${coma(y(d.id))} ${d.short}`).join(', ') : 'sí',
        limit: 'alquilar o no',
        ok: frac.length === 0,
        failMessage: `No se puede alquilar "${coma(y(frac[0]?.id ?? ''))}" de ${lbl(frac[0]?.id ?? D[0].id)}. ¿y es binaria?`,
      });

      const fijo = D.reduce((t, d) => t + (y(d.id) > 0.5 ? d.costoFijo : 0), 0);
      const segunda = S.reduce(
        (t, s) =>
          t +
          s.prob *
            (D.reduce((a, d) => a + C.reduce((b, c) => b + P.costo(d.id, c.id) * x(d.id, c.id, s.id), 0), 0) +
              C.reduce((a, c) => a + v.penalidad * w(c.id, s.id), 0)),
        0,
      );
      return { feasible: checks.every((c) => c.ok), objective: Math.round((fijo + segunda) * 1e6) / 1e6, checks };
    },
  };
}
