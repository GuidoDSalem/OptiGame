/**
 * Plantilla del nivel de planificación multi-período con costos fijos (lot sizing).
 *
 * En cada período se decide cuánto producir/enviar (x_t), cuánto queda en stock (s_t) y si se
 * paga el costo fijo de operar (z_t binaria). El stock conecta los períodos:
 * s_{t-1} + x_t − s_t = d_t. Cada variante aporta datos, vocabulario, historia y escena.
 */
import { compileIndexed, term, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { Check, ContentBlock, Level, SceneSpec } from '../types';

export interface Periodo {
  id: string;
  label: string; // "Semana 1"
  short: string; // "S1"
  demanda: number;
  capacidad: number;
  costo: number; // costo variable por unidad
}

export interface Vocabulario {
  /** Frases con género armadas: "una semana"/"un turno", "la semana"/"el turno", "pocas semanas"… */
  periodo: { singular: string; plural: string; la: string; una: string; pocas: string }; // "semana", "semanas", "la semana", "una semana", "pocas semanas"
  unidad: string; // "kt"
  moneda: string; // "$k"
  x: string; // "Mineral enviado"
  s: string; // "Stock en el puerto"
  z: string; // "Tren contratado"
  demanda: string; // "Carga de barcos"
  capacidad: string; // "Capacidad de la mina"
  costo: string; // "Costo de extracción y flete"
  costoFijo: string; // "Contratar el tren"
  /** Ejemplo absurdo de pagar el costo fijo "a medias", p. ej. 'alquilar "0,4 trenes"'. */
  fijoAMedias: string;
  costoStock: string; // "Guardar en el puerto"
  capStock: string; // "Capacidad del puerto"
  /** Mensajes del mundo. */
  faltante(periodo: string, q: string): string;
  excesoCap(periodo: string): string;
  excesoStock(periodo: string): string;
  sinFijo(periodo: string): string;
  fijoParcial(periodo: string, z: string): string;
}

export interface VariantePlanificacion {
  id: string;
  variant: string;
  title: string;
  client: string;
  periodos: Periodo[];
  costoFijo: number;
  costoStock: number;
  capStock: number;
  vocab: Vocabulario;
  historia: ContentBlock[];
  scene: SceneSpec;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace('.', ','));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const xId = (t: string) => `x_${t}`;
export const sId = (t: string) => `s_${t}`;
export const zId = (t: string) => `z_${t}`;

/** Simula el stock al final de cada período a partir de lo enviado (stock inicial 0). */
export function simularStock(v: VariantePlanificacion, values: Record<string, number>): number[] {
  let s = 0;
  return v.periodos.map((p) => (s = s + (values[xId(p.id)] ?? 0) - p.demanda));
}

export function crearNivelPlanificacion(v: VariantePlanificacion): Level {
  const { vocab: V, periodos: P } = v;
  const T = 'T';

  const spec: IndexedSpec = {
    sets: [{ id: T, name: cap(V.periodo.plural), index: 't', ordered: true, items: P.map(({ id, label, short }) => ({ id, label, short })) }],
    params: [
      { id: 'd', name: V.demanda, symbol: 'd', over: [T], values: Object.fromEntries(P.map((p) => [p.id, p.demanda])) },
      { id: 'K', name: V.capacidad, symbol: 'K', over: [T], values: Object.fromEntries(P.map((p) => [p.id, p.capacidad])) },
      { id: 'c', name: V.costo, symbol: 'c', over: [T], values: Object.fromEntries(P.map((p) => [p.id, p.costo])) },
      { id: 'f', name: V.costoFijo, symbol: 'f', over: [], values: { '': v.costoFijo } },
      { id: 'h', name: V.costoStock, symbol: 'h', over: [], values: { '': v.costoStock } },
      { id: 'S', name: V.capStock, symbol: 'S', over: [], values: { '': v.capStock } },
    ],
    vars: [
      { id: 'x', symbol: 'x', over: [T], label: V.x, unit: V.unidad },
      { id: 's', symbol: 's', over: [T], label: V.s, unit: V.unidad },
      { id: 'z', symbol: 'z', over: [T], label: V.z, unit: '' },
    ],
  };

  const reference: IndexedDraft = {
    sense: 'min',
    objective: { terms: [term('x', 'c'), term('s', 'h'), term('z', 'f')] },
    varTypes: { z: 'bin' },
    constraints: [
      {
        key: 'balance',
        name: 'Balance de stock',
        forall: [T],
        terms: [term('s', null, 1, -1), term('x'), term('s', null, -1)],
        op: '=',
        rhs: { kind: 'param', param: 'd' },
      },
      {
        key: 'activacion',
        name: 'Activación',
        forall: [T],
        terms: [term('x'), term('z', 'K', -1)],
        op: '<=',
        rhs: { kind: 'value', value: '0' },
      },
      { key: 'stock', name: V.capStock, forall: [T], terms: [term('s')], op: '<=', rhs: { kind: 'param', param: 'S' } },
    ],
  };
  const referenceModel = compileIndexed(spec, reference).model;

  const variables = P.flatMap((p) => [
    { id: xId(p.id), symbol: `x_{${p.short}}`, label: `${V.x} (${p.label})`, unit: V.unidad, min: 0, max: p.capacidad, step: 1 },
    { id: sId(p.id), symbol: `s_{${p.short}}`, label: `${V.s} (${p.label})`, unit: V.unidad, min: 0, max: v.capStock, step: 1 },
    { id: zId(p.id), symbol: `z_{${p.short}}`, label: `${V.z} (${p.label})`, unit: '', min: 0, max: 1, step: 1 },
  ]);

  const tabla: ContentBlock = {
    type: 'table',
    head: ['', ...P.map((p) => p.short)],
    rows: [
      [`${V.demanda} (${V.unidad})`, ...P.map((p) => String(p.demanda))],
      [`${V.capacidad} (${V.unidad})`, ...P.map((p) => String(p.capacidad))],
      [`${V.costo} (${V.moneda}/${V.unidad})`, ...P.map((p) => String(p.costo))],
    ],
  };

  const historia: ContentBlock[] = [
    ...v.historia,
    tabla,
    { type: 'h', text: 'Los costos' },
    {
      type: 'list',
      items: [
        `**${V.costoFijo}**: ${V.moneda} ${v.costoFijo} por cada ${V.periodo.singular} en que se opera, sin importar cuánto se mande.`,
        `**${V.costoStock}**: ${V.moneda} ${v.costoStock} por ${V.unidad} que queda al final de cada ${V.periodo.singular}.`,
        `**${V.costo}**: cambia según la ${V.periodo.singular} (tabla de arriba).`,
      ],
    },
    { type: 'h', text: 'Las reglas' },
    {
      type: 'list',
      items: [
        `Hay que cumplir la **${V.demanda.toLowerCase()}** de cada ${V.periodo.singular}.`,
        `En cada ${V.periodo.singular} no se puede superar la **${V.capacidad.toLowerCase()}**.`,
        `La **${V.capStock.toLowerCase()}** es de ${v.capStock} ${V.unidad}. Se arranca con stock 0.`,
      ],
    },
    { type: 'note', text: `Objetivo: cumplir todo al **menor costo total**.` },
  ];

  const teoria: ContentBlock[] = [
    { type: 'h', text: 'Decidir en el tiempo' },
    {
      type: 'p',
      text: `Hasta ahora cada decisión era "de una vez". Acá se planifican **${P.length} ${V.periodo.plural}** y cada decisión afecta a las siguientes. Por eso hay variables **por período**: $x_t$ (cuánto se manda), $s_t$ (cuánto queda en stock) y $z_t$ (si se paga el costo fijo).`,
    },
    { type: 'h', text: 'La ecuación que conecta el tiempo' },
    { type: 'p', text: 'El **balance de stock**: lo que había, más lo que llega, menos lo que queda, es lo que se entrega.' },
    { type: 'tex', tex: 's_{t-1} + x_t - s_t = d_t \\qquad \\forall\\, t \\in T \\qquad (s_0 = 0)' },
    {
      type: 'p',
      text: `El término $s_{t-1}$ es la clave: une cada ${V.periodo.singular} con la anterior. Sin él, el modelo trataría cada ${V.periodo.singular} por separado y no podría **adelantarse** a una ${V.periodo.singular} con poca capacidad.`,
    },
    { type: 'h', text: 'Costos fijos: la binaria que "enciende"' },
    {
      type: 'p',
      text: `Operar ${V.periodo.una} cuesta $f$, sea poco o mucho lo que se mueva. Ese costo es un **escalón**, no es lineal. Se modela con una binaria $z_t$ y una restricción de **activación**:`,
    },
    { type: 'tex', tex: 'x_t \\leq K_t\\, z_t \\qquad \\forall\\, t \\in T' },
    {
      type: 'list',
      items: [
        'Si $z_t = 0$, obliga a $x_t = 0$: no se opera.',
        'Si $z_t = 1$, permite hasta $K_t$. De paso, es la restricción de capacidad.',
        `Como el objetivo suma $f\\, z_t$, el solver sólo "enciende" ${V.periodo.una} si le conviene.`,
      ],
    },
    {
      type: 'note',
      text: 'A $K_t$ en este papel se lo llama "**M grande**" (big-M). Conviene que sea lo más ajustado posible: un M enorme hace que la relajación lineal sea muy débil.',
    },
    {
      type: 'p',
      text: `Si $z_t$ fuera continua, el solver pondría $z_t = x_t / K_t$ y pagaría sólo una **fracción** del costo fijo, como ${V.fijoAMedias}. Otra vez: hay que declararla binaria.`,
    },
    { type: 'h', text: 'El dilema' },
    {
      type: 'list',
      items: [
        `**El costo fijo** empuja a agrupar: mover mucho en ${V.periodo.pocas}.`,
        '**El costo de stock** empuja a mandar justo a tiempo.',
        `**La capacidad** obliga a adelantarse cuando se viene ${V.periodo.una} difícil.`,
      ],
    },
    {
      type: 'p',
      text: 'Este problema clásico se llama **dimensionamiento de lotes** (*lot sizing*). Se usa para planificar producción, compras, energía y logística.',
    },
    {
      type: 'note',
      text: 'En el modelador vas a necesitar **varios términos** en una misma restricción y el **desfase** $t-1$: agregá términos con "+ término" y elegí el período en el selector de cada uno.',
    },
  ];

  const pistas = [
    'Hay tres familias de variables: $x_t$ y $s_t$ continuas, y $z_t$ **binaria**.',
    'El objetivo tiene tres términos: $\\sum_t c_t x_t + h\\, s_t + f\\, z_t$.',
    'Balance, "para cada $t$": $+\\,s_{t-1} + x_t - s_t = d_t$. El primer término usa el período **$t-1$**.',
    'Activación, "para cada $t$": $x_t - K_t z_t \\leq 0$. Y el stock: $s_t \\leq S$.',
  ];

  const tol = 1e-6;
  return {
    id: v.id,
    number: 5,
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Planificación multi-período · costos fijos',
    variables,
    objective: { sense: 'min', label: `Costo total (${V.moneda})`, unit: '' },
    referenceModel,
    starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: v.scene,
    indexed: {
      spec,
      reference,
      starter: { sense: 'max', objective: { terms: [term('x')] }, constraints: [] },
      periodTable: { set: T, manualVar: 'x', params: ['d', 'K'] },
    },
    briefing: historia,
    theory: teoria,
    hints: pistas,

    // En el intento manual sólo se decide x: el stock resulta de simular y el costo fijo se paga
    // en los períodos en que se mueve algo.
    manualDerive(values) {
      const out = { ...values };
      const s = simularStock(v, values);
      P.forEach((p, i) => {
        out[sId(p.id)] = Math.max(0, s[i]);
        out[zId(p.id)] = (values[xId(p.id)] ?? 0) > tol ? 1 : 0;
      });
      return out;
    },

    evaluate(values) {
      const s = simularStock(v, values);
      const x = (p: Periodo) => values[xId(p.id)] ?? 0;
      const checks: Check[] = [];

      const faltas = P.map((p, i) => ({ p, q: -s[i] })).filter((f) => f.q > tol);
      checks.push({
        label: V.demanda,
        value: faltas.length ? `faltan ${fmt(faltas[0].q)} ${V.unidad} (${faltas[0].p.short})` : 'completa',
        limit: `todas las ${V.periodo.plural}`,
        ok: faltas.length === 0,
        failMessage: faltas.length ? V.faltante(faltas[0].p.label.toLowerCase(), fmt(faltas[0].q)) : undefined,
      });

      const sobre = P.filter((p) => x(p) > p.capacidad + tol);
      checks.push({
        label: V.capacidad,
        value: sobre.length ? `${fmt(x(sobre[0]))} ${V.unidad} en ${sobre[0].short}` : 'dentro del límite',
        limit: '≤ capacidad',
        ok: sobre.length === 0,
        failMessage: sobre.length ? V.excesoCap(sobre[0].label.toLowerCase()) : undefined,
      });

      const maxS = Math.max(0, ...s);
      const iMax = s.indexOf(maxS);
      checks.push({
        label: V.capStock,
        value: `máx. ${fmt(maxS)} ${V.unidad}`,
        limit: `≤ ${v.capStock} ${V.unidad}`,
        ok: maxS <= v.capStock + tol,
        failMessage: V.excesoStock(P[Math.max(0, iMax)].label.toLowerCase()),
      });

      // El costo fijo se paga si se opera; el mundo exige que z esté "encendida" entera.
      const malas = P.filter((p) => x(p) > tol && Math.abs((values[zId(p.id)] ?? 0) - 1) > tol);
      const primera = malas[0];
      const zv = primera ? values[zId(primera.id)] ?? 0 : 0;
      checks.push({
        label: V.costoFijo,
        value: primera ? `${primera.short}: z = ${fmt(zv)}` : 'pagado donde se opera',
        limit: 'si se opera',
        ok: malas.length === 0,
        failMessage: primera
          ? zv > tol
            ? V.fijoParcial(primera.label.toLowerCase(), fmt(zv))
            : V.sinFijo(primera.label.toLowerCase())
          : undefined,
      });

      const operadas = P.filter((p) => x(p) > tol).length;
      const objective =
        P.reduce((acc, p, i) => acc + p.costo * x(p) + v.costoStock * Math.max(0, s[i]), 0) + v.costoFijo * operadas;
      return { feasible: checks.every((c) => c.ok), objective, checks };
    },
  };
}
