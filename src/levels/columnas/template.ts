/**
 * Plantilla del nivel avanzado de generación de columnas (corte de bobinas).
 *
 * El modelo de patrones se puede resolver entero con el catálogo completo, pero el nivel
 * enseña a no enumerarlo: se arranca con patrones obvios y los precios sombra del maestro
 * dicen qué patrón nuevo conviene (el pricing es una mochila). El jugador hace de pricing.
 */
import {
  describir,
  patronDeVariable,
  patronId,
  producido,
  sobrante,
  todosLosPatrones,
  usado,
  variableId,
  type ProblemaCorte,
} from '../../engine/columnas';
import { compileIndexed, term, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { Check, ContentBlock, Level } from '../types';
import { crearColumnasAutomatico } from './ColumnasAuto';
import { crearPanelColumnas } from './ColumnasPanel';
import { crearEscenaBobinas } from './Scene';

export interface VarianteColumnas {
  id: string;
  variant: string;
  title: string;
  client: string;
  /** Ancho de la bobina madre (cm). */
  ancho: number;
  pedidos: { id: string; label: string; ancho: number; cantidad: number }[];
  historia: ContentBlock[];
}

export const problemaDe = (v: VarianteColumnas): ProblemaCorte => ({ ancho: v.ancho, pedidos: v.pedidos });

export function crearNivelColumnas(v: VarianteColumnas): Level {
  const P = problemaDe(v);
  const catalogo = todosLosPatrones(P);
  const pid = (p: (typeof catalogo)[number]) => patronId(P, p);

  const spec: IndexedSpec = {
    sets: [
      { id: 'I', name: 'Pedidos', index: 'i', items: v.pedidos.map((q) => ({ id: q.id, label: `${q.label} (${q.ancho} cm)`, short: `${q.ancho} cm` })) },
      {
        id: 'P',
        name: 'Patrones de corte',
        index: 'p',
        items: catalogo.map((p, k) => ({ id: pid(p), label: describir(P, p), short: `P${k + 1}` })),
      },
    ],
    params: [
      {
        id: 'a',
        name: 'Piezas del pedido i en el patrón p',
        symbol: 'a',
        over: ['I', 'P'],
        values: Object.fromEntries(v.pedidos.flatMap((q) => catalogo.map((p) => [`${q.id}|${pid(p)}`, p[q.id] ?? 0]))),
      },
      { id: 'd', name: 'Piezas pedidas', symbol: 'd', over: ['I'], values: Object.fromEntries(v.pedidos.map((q) => [q.id, q.cantidad])) },
      { id: 'w', name: 'Ancho de la pieza (cm)', symbol: 'w', over: ['I'], values: Object.fromEntries(v.pedidos.map((q) => [q.id, q.ancho])) },
    ],
    vars: [{ id: 'x', symbol: 'x', over: ['P'], label: 'Bobinas cortadas con el patrón p', unit: 'bobinas' }],
  };

  const reference: IndexedDraft = {
    sense: 'min',
    objective: { terms: [term('x')] },
    varTypes: { x: 'int' },
    constraints: [
      { key: 'pedido', name: 'Pedido', forall: ['I'], terms: [term('x', 'a')], op: '>=', rhs: { kind: 'param', param: 'd' } },
    ],
  };
  const referenceModel = compileIndexed(spec, reference).model;

  const teoria: ContentBlock[] = [
    { type: 'h', text: 'El modelo de patrones' },
    {
      type: 'p',
      text: 'Un **patrón** es una forma de cortar una bobina: cuántas piezas de cada ancho salen de ella, sin pasarse del ancho $W$. Si $a_{ip}$ son las piezas del pedido $i$ en el patrón $p$ y $x_p$ las bobinas que se cortan así:',
    },
    { type: 'tex', tex: '\\min \\; \\sum_p x_p \\qquad \\sum_p a_{ip}\\, x_p \\geq d_i \\;\\; \\forall\\, i \\qquad x_p \\in \\mathbb{Z}_{\\geq 0}' },
    {
      type: 'p',
      text: `Cada patrón es una **columna** de la matriz. Con estos ${v.pedidos.length} anchos hay ${catalogo.length} patrones que aprovechan la bobina, y el solver los maneja de una vez. Pero una papelera real tiene 30 o 40 anchos y bobinas de 5 metros: los patrones son **millones**. No se pueden ni escribir.`,
    },
    { type: 'h', text: 'La idea: agregar columnas de a una' },
    {
      type: 'list',
      items: [
        '**Maestro restringido**: el modelo (con $x_p$ continua) pero sólo con algunos patrones. Arranca con los obvios: cada bobina corta un solo ancho.',
        'Sus **precios sombra** $\\pi_i$ dicen cuánto vale, en bobinas, una pieza más del pedido $i$ (nivel 2).',
        '**Pricing**: ¿hay algún patrón que no esté y que convenga? Se busca con otro problema de optimización. Si hay, se agrega y se vuelve a resolver el maestro.',
      ],
    },
    { type: 'h', text: 'El costo reducido de un patrón' },
    {
      type: 'p',
      text: 'Cortar una bobina más con el patrón $p$ cuesta 1 bobina, y "devuelve" piezas que valen $\\sum_i \\pi_i a_{ip}$. Su **costo reducido** es la diferencia:',
    },
    { type: 'tex', tex: '\\bar c_p \\;=\\; 1 - \\sum_i \\pi_i\\, a_{ip}' },
    {
      type: 'p',
      text: 'Si es **negativo**, el patrón paga más de lo que cuesta: meterlo en el maestro baja el total. Si ningún patrón tiene costo reducido negativo, el maestro ya es óptimo **para todos los patrones**, aunque nunca los hayamos escrito.',
    },
    { type: 'h', text: 'El pricing es una mochila' },
    {
      type: 'p',
      text: 'Encontrar el patrón de menor costo reducido es llenar una **mochila** de capacidad $W$ con piezas de ancho $w_i$ y valor $\\pi_i$ (como las binarias del nivel 4, pero enteras):',
    },
    { type: 'tex', tex: '\\max \\; \\sum_i \\pi_i\\, a_i \\qquad \\sum_i w_i\\, a_i \\leq W \\qquad a_i \\in \\mathbb{Z}_{\\geq 0}' },
    {
      type: 'p',
      text: 'Si el valor óptimo $v^*$ es mayor que 1, ese patrón entra. Si es 1 o menos, se terminó.',
    },
    { type: 'h', text: 'Dos cotas, otra vez' },
    {
      type: 'list',
      items: [
        '**El maestro** $z$ baja con cada patrón nuevo: más opciones, igual o mejor.',
        '**Cota inferior**: ninguna bobina puede valer más que $v^*$, así que hacen falta al menos $z / v^*$ bobinas (cota de Farley). Sube hasta tocar al maestro.',
        'Como las bobinas son enteras, la cota se redondea para arriba. Si una solución entera la alcanza, está **demostrado** que es óptima.',
      ],
    },
    {
      type: 'note',
      text: 'Ojo al final: la relajación da bobinas fraccionarias. Redondear cada patrón para arriba es fácil pero puede sobrar bastante; resolver el modelo **entero** con los patrones generados suele llegar a la cota.',
    },
    { type: 'h', text: 'Parientes' },
    {
      type: 'p',
      text: 'Es la **hermana dual de Benders** (A3): allá se agregaban **filas** (cortes) al maestro; acá se agregan **columnas** (variables). Se usa en turnos de tripulaciones de aviones, ruteo de flotas y horarios de hospitales. Combinada con branch and bound se llama **branch and price**.',
    },
  ];

  const pistas = [
    'La variable es $x_p$: cuántas bobinas se cortan con cada patrón. Lo que se minimiza es el total de bobinas: $\\sum_p x_p$.',
    'Para cada pedido $i$, las piezas que salen de todos los patrones tienen que alcanzar: $\\sum_p a_{ip}\\, x_p \\geq d_i$.',
    'No se corta media bobina: $x_p$ tiene que ser entera. El ancho $w_i$ ya está "adentro" de cada patrón, no hace falta en el modelo.',
  ];

  const tol = 1e-6;
  return {
    id: v.id,
    number: 102,
    codigo: 'A2',
    seccion: 'avanzada',
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Generación de columnas',
    variables: catalogo.map((p, k) => ({
      id: variableId(P, p),
      symbol: `x_{P${k + 1}}`,
      label: describir(P, p),
      unit: 'bobinas',
      min: 0,
      max: Math.max(...v.pedidos.map((q) => q.cantidad)),
      step: 1,
    })),
    objective: { sense: 'min', label: 'Bobinas madre', unit: '' },
    referenceModel,
    starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: crearEscenaBobinas(v),
    indexed: {
      spec,
      reference,
      starter: { sense: 'max', objective: { terms: [term('x')] }, constraints: [] },
    },
    manualComponent: crearPanelColumnas(v, P),
    resultsExtra: crearColumnasAutomatico(v, P),
    briefing: [
      ...v.historia,
      {
        type: 'table',
        head: ['Pedido', 'Ancho (cm)', 'Piezas'],
        rows: v.pedidos.map((q) => [q.label, String(q.ancho), String(q.cantidad)]),
      },
      {
        type: 'note',
        text: `Cada bobina madre mide **${v.ancho} cm** de ancho y se corta a lo largo en piezas más angostas. Lo que sobra de cada bobina se tira. Objetivo: cumplir todos los pedidos con la **menor cantidad de bobinas**.`,
      },
    ],
    theory: teoria,
    hints: pistas,

    evaluate(values) {
      const checks: Check[] = [];
      const usados = Object.entries(values)
        .map(([k, n]) => ({ p: patronDeVariable(P, k), n }))
        .filter((u) => u.p && u.n > tol) as { p: NonNullable<ReturnType<typeof patronDeVariable>>; n: number }[];
      const hecho = producido(P, values);

      const faltan = v.pedidos.filter((q) => hecho[q.id] < q.cantidad - tol);
      checks.push({
        label: 'Pedidos',
        value: faltan.length ? `${faltan.length} incompleto(s)` : 'completos',
        limit: 'todas las piezas',
        ok: faltan.length === 0,
        failMessage: faltan.length
          ? `De ${faltan[0].ancho} cm salen ${Math.round(hecho[faltan[0].id] * 100) / 100} de ${faltan[0].cantidad} piezas.`
          : undefined,
      });

      const largos = usados.filter((u) => usado(P, u.p) > v.ancho);
      checks.push({
        label: 'Patrones',
        value: largos.length ? `${largos.length} no entran` : 'entran en la bobina',
        limit: `≤ ${v.ancho} cm`,
        ok: largos.length === 0,
        failMessage: `${describir(P, largos[0]?.p ?? {})} no entra en ${v.ancho} cm.`,
      });

      const frac = usados.filter((u) => Math.abs(u.n - Math.round(u.n)) > 1e-4);
      checks.push({
        label: 'Bobinas enteras',
        value: frac.length ? `${Math.round(frac[0].n * 100) / 100} de ${describir(P, frac[0].p)}` : 'sí',
        limit: 'bobinas completas',
        ok: frac.length === 0,
        failMessage: 'No se puede cortar un pedazo de bobina con un patrón y el resto con otro. ¿x es entera?',
      });

      const tirado = usados.reduce((s, u) => s + u.n * Math.max(0, sobrante(P, u.p)), 0);
      checks.push({
        label: 'Recortes tirados',
        value: `${Math.round(tirado)} cm`,
        limit: 'informativo',
        ok: true,
      });

      const bobinas = usados.reduce((s, u) => s + u.n, 0);
      return { feasible: checks.every((c) => c.ok), objective: Math.round(bobinas * 1e6) / 1e6, checks };
    },
  };
}
