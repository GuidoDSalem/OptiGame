/**
 * Plantilla del nivel avanzado de stock de seguridad en varias etapas (servicio garantizado,
 * Graves y Willems). El costo es cóncavo (una raíz), pero en el óptimo cada etapa guarda todo o
 * nada: el problema se vuelve partir la cadena en tramos, cada uno cubierto por un stock al final.
 * El modelo del jugador es una partición de conjuntos con matriz de unos consecutivos.
 */
import {
  costoTramo,
  evaluarServicios,
  nrtTramo,
  particionValida,
  serviciosDeTramos,
  type Cadena,
  type Tramo,
} from '../../engine/stockSeguridad';
import { compileIndexed, term, varId, type IndexedDraft, type IndexedSpec, type VarFamily } from '../../engine/indexed';
import type { Check, ContentBlock, Level } from '../types';
import { crearPanelStock } from './StockPanel';
import { REPO_EJEMPLO, crearStockAutomatico } from './StockAuto';
import { crearEscenaCadena } from './Scene';

export interface VarianteStock {
  id: string;
  variant: string;
  title: string;
  client: string;
  cadena: Cadena;
  historia: ContentBlock[];
}

const fmt = (n: number, d = 0) => n.toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d });
export const usd = (n: number) => `US$ ${fmt(n)}`;
/** En textos con LaTeX ($…$) no se puede usar "US$": ahí va "USD". */
const dolares = (n: number, d = 0) => `USD ${fmt(n, d)}`;
export const toneladas = (kg: number) => `${fmt(kg / 1000, kg < 10000 ? 1 : 0)} t`;

/** Costo anual de una partición con el costo de cada tramo redondeado (el que ve el jugador en el modelo). */
export const costoRedondeado = (c: Cadena, i: number, j: number) => Math.round(costoTramo(c, i, j));
export const costoDeTramos = (c: Cadena, tramos: Tramo[]) => tramos.reduce((s, [i, j]) => s + costoRedondeado(c, i, j), 0);

/** Clave de los valores del intento manual: tiempo de servicio que promete cada etapa. */
export const claveServicio = (id: string) => `S|${id}`;

/** La familia de variables de tramos (desde ≤ hasta). */
export function familiaTramos(c: Cadena): VarFamily {
  const pos = new Map(c.etapas.map((e, k) => [e.id, k]));
  return {
    id: 'u',
    symbol: 'u',
    over: ['I', 'J'],
    label: 'Tramo de i a j, cubierto por un stock en j',
    unit: '',
    valida: (a) => pos.get(a.I)! <= pos.get(a.J)!,
  };
}

/** Tramos elegidos en una solución del modelo (u = 1). */
export function tramosDeValores(c: Cadena, values: Record<string, number>): { tramos: Tramo[]; fraccion: boolean } {
  const fam = familiaTramos(c);
  const tramos: Tramo[] = [];
  let fraccion = false;
  c.etapas.forEach((a, i) =>
    c.etapas.forEach((b, j) => {
      if (i > j) return;
      const v = values[varId(fam, { I: a.id, J: b.id })] ?? 0;
      if (v > 1e-6 && v < 1 - 1e-6) fraccion = true;
      if (v > 0.5) tramos.push([i, j]);
    }),
  );
  return { tramos, fraccion };
}

/**
 * Tiempos de servicio de una decisión: los del intento manual si están, o los que salen de los
 * tramos del modelo. Devuelve null si los tramos no parten la cadena.
 */
export function serviciosDeValores(c: Cadena, values: Record<string, number>): number[] | null {
  if (c.etapas.some((e) => claveServicio(e.id) in values)) return c.etapas.map((e) => values[claveServicio(e.id)] ?? 0);
  const { tramos } = tramosDeValores(c, values);
  return particionValida(c.etapas.length, tramos) ? serviciosDeTramos(c, tramos) : null;
}

export function crearNivelStock(v: VarianteStock): Level {
  const C = v.cadena;
  const E = C.etapas;
  const N = E.length;
  const items = E.map((e) => ({ id: e.id, label: e.nombre, short: e.corto }));
  const fam = familiaTramos(C);

  const spec: IndexedSpec = {
    sets: [
      { id: 'I', name: 'Inicio del tramo', index: 'i', items },
      { id: 'J', name: 'Etapa con stock', index: 'j', items },
      { id: 'K', name: 'Etapas', index: 'k', items },
    ],
    params: [
      {
        id: 'c',
        name: 'Costo anual del stock que cubre el tramo i..j (US$)',
        symbol: 'c',
        over: ['I', 'J'],
        values: Object.fromEntries(E.flatMap((a, i) => E.map((b, j) => [`${a.id}|${b.id}`, i <= j ? Math.round(costoTramo(C, i, j)) : 0]))),
      },
      {
        id: 'a',
        name: '1 si el tramo i..j incluye a la etapa k',
        symbol: 'a',
        over: ['K', 'I', 'J'],
        values: Object.fromEntries(
          E.flatMap((k, kk) => E.flatMap((a, i) => E.map((b, j) => [`${k.id}|${a.id}|${b.id}`, i <= kk && kk <= j ? 1 : 0]))),
        ),
      },
    ],
    vars: [fam],
  };

  const reference: IndexedDraft = {
    sense: 'min',
    objective: { terms: [term('u', 'c')] },
    varTypes: { u: 'bin' },
    constraints: [{ key: 'cubre', name: 'Cada etapa en un tramo', forall: ['K'], terms: [term('u', 'a')], op: '=', rhs: { kind: 'value', value: '1' } }],
  };
  const referenceModel = compileIndexed(spec, reference).model;

  const ejemplo = (i: number, j: number) => `${E[i].corto} → ${E[j].corto}`;
  const nFinal = nrtTramo(C, 0, N - 1);

  const teoria: ContentBlock[] = [
    { type: 'h', text: 'Dos tiempos por etapa' },
    {
      type: 'p',
      text: 'Cada etapa $j$ tarda $T_j$ días en procesar y le **promete** a la siguiente un tiempo de servicio $S_j$: lo que le pidan sale a lo sumo $S_j$ días después. A su vez recibe lo que pide en $SI_j = S_{j-1}$ días (la primera, en lo que tarda el proveedor). Lo que no llega a cubrir con esos plazos lo tiene que cubrir con **stock**:',
    },
    { type: 'tex', tex: '\\text{NRT}_j = SI_j + T_j - S_j \\qquad \\text{stock}_j = z\\, \\sigma \\sqrt{\\text{NRT}_j}' },
    {
      type: 'p',
      text: '$\\text{NRT}_j$ es el **tiempo neto de reposición**: los días de demanda que la etapa tiene que aguantar con lo que tiene. Si la demanda de cada día varía con desvío $\\sigma$, la de $n$ días varía con $\\sigma\\sqrt{n}$ (las varianzas se suman). $z$ fija el nivel de servicio: $1{,}65$ cubre el 95% de los casos.',
    },
    { type: 'h', text: 'La raíz premia juntar' },
    {
      type: 'p',
      text: 'Un stock que cubre 9 días necesita $\\sqrt 9 = 3$ unidades de desvío; tres stocks de 3 días cada uno, $3\\sqrt 3 \\approx 5{,}2$. **Juntar el tiempo en un solo lugar ahorra**, porque los días buenos compensan los malos. Pero cada etapa agrega valor: guardar abajo (cerca del cliente) es más caro por kilo. El costo anual es $h_j \\cdot \\text{stock}_j$, con $h_j$ el valor de un kilo en la etapa por la tasa anual.',
    },
    { type: 'h', text: 'Todo o nada' },
    {
      type: 'p',
      text: 'El costo es una raíz: **cóncavo**. Minimizar una función cóncava sobre un poliedro da siempre un **vértice**, y en este problema los vértices tienen una forma muy clara: cada etapa, o **promete 0** (tiene stock para todo lo que le toca) o **no tiene stock** (promete $SI_j + T_j$ y pasa el pedido de largo). Nunca conviene "un poco".',
    },
    { type: 'h', text: 'De raíces a un modelo lineal' },
    {
      type: 'p',
      text: `Entonces la decisión es partir la cadena en **tramos** de etapas seguidas, cada uno cubierto por un stock en su última etapa. Hay ${(N * (N + 1)) / 2} tramos posibles y el costo de cada uno se calcula de antemano con la fórmula: por ejemplo, un stock en ${E[N - 1].corto} que cubra toda la cadena aguanta ${fmt(nFinal)} días y cuesta ${dolares(costoTramo(C, 0, N - 1))} por año. Con $u_{ij} = 1$ si se elige el tramo de $i$ a $j$:`,
    },
    { type: 'tex', tex: '\\min \\sum_{i \\le j} c_{ij}\\, u_{ij} \\qquad \\sum_{i \\le k \\le j} u_{ij} = 1 \\;\\; \\forall\\, k \\qquad u_{ij} \\in \\{0, 1\\}' },
    {
      type: 'p',
      text: 'Cada etapa queda en **exactamente un tramo**. Es un problema de partición, como la asignación del nivel 4, con una propiedad extra: en cada columna los unos están **seguidos** (un tramo cubre etapas consecutivas). Esas matrices son totalmente unimodulares, así que la relajación lineal ya da una solución entera.',
    },
    { type: 'h', text: 'Y también es un camino más corto' },
    {
      type: 'p',
      text: 'Recorriendo la cadena en orden: el menor costo para cubrir las primeras $j$ etapas es $f(j) = \\min_{i \\le j} \\; f(i-1) + c_{ij}$. Es **programación dinámica**, como el caso C2. Graves y Willems (2000) la extendieron a redes con forma de árbol (ensamble y distribución), que es como lo resuelven los programas comerciales de inventario multi-etapa.',
    },
    {
      type: 'note',
      text: 'Supuestos del modelo: la demanda que excede $z\\sigma\\sqrt{n}$ se cubre con medidas extra (horas extra, envíos urgentes) y no se cuenta; el stock "en tránsito" dentro de cada etapa no depende de la decisión y tampoco. Por eso sólo se compara el stock de seguridad.',
    },
    { type: 'h', text: 'Para ver el código' },
    {
      type: 'p',
      text: `Hay una implementación clara en GitHub: [multi-echelon-inventory-optimization](${REPO_EJEMPLO}). Resuelve este mismo modelo en serie en Python y en C++: programación dinámica exacta, la heurística de "stock en todas las etapas" y un modelo entero con PuLP.`,
    },
  ];

  const pistas = [
    'Una variable binaria por tramo: $u_{ij} = 1$ si el stock de la etapa $j$ cubre las etapas de $i$ a $j$. Se minimiza $\\sum c_{ij}\\, u_{ij}$.',
    'Cada etapa tiene que estar cubierta por **un** tramo, ni cero ni dos. La restricción se repite para cada etapa $k$ y suma los tramos que la incluyen.',
    'El coeficiente $a_{kij}$ vale 1 si el tramo de $i$ a $j$ pasa por $k$: $\\sum_{i,j} a_{kij}\\, u_{ij} = 1$ para cada $k$.',
  ];

  return {
    id: v.id,
    number: 106,
    codigo: 'A6',
    seccion: 'avanzada',
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Stock de seguridad en varias etapas · servicio garantizado',
    variables: E.flatMap((a, i) =>
      E.flatMap((b, j) =>
        i <= j
          ? [{ id: varId(fam, { I: a.id, J: b.id }), symbol: `u_{${i + 1},${j + 1}}`, label: ejemplo(i, j), unit: '', min: 0, max: 1, step: 1 }]
          : [],
      ),
    ),
    objective: { sense: 'min', label: 'Costo anual del stock de seguridad', unit: 'US$' },
    referenceModel,
    starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: crearEscenaCadena(v),
    indexed: {
      spec,
      reference,
      starter: { sense: 'min', objective: { terms: [] }, constraints: [] },
    },
    manualComponent: crearPanelStock(v),
    resultsExtra: crearStockAutomatico(v),
    briefing: [
      ...v.historia,
      {
        type: 'table',
        head: ['Etapa', 'Dónde', 'Tarda (días)', 'Valor de 1 kg al salir'],
        rows: E.map((e) => [e.nombre, e.lugar, String(e.T), dolares(e.valor, 2)]),
      },
      {
        type: 'note',
        text: `Los productores entregan la hoja verde en ${C.entrada} días. Lo que piden los supermercados cambia de un día a otro, con un desvío de ${fmt(C.sigma / 1000, 1)} t por día, y la yerbatera les promete entregar en **${C.servicio} ${C.servicio === 1 ? 'día' : 'días'}** el ${fmt(C.nivel * 100)}% de las veces. Tener un kilo en stock cuesta el ${fmt(C.tasa * 100)}% de su valor por año. Objetivo: cumplir la promesa con el **menor costo anual de stock de seguridad**.`,
      },
    ],
    theory: teoria,
    hints: pistas,

    evaluate(values) {
      const checks: Check[] = [];
      const manual = E.some((e) => claveServicio(e.id) in values);
      if (!manual) {
        const { tramos, fraccion } = tramosDeValores(C, values);
        const cub = new Array(N).fill(0);
        for (const [i, j] of tramos) for (let k = i; k <= j; k++) cub[k]++;
        const mal = cub.findIndex((x) => x !== 1);
        checks.push({
          label: 'Cada etapa cubierta',
          value: mal < 0 ? 'una vez cada una' : `${E[mal].corto}: ${cub[mal]} veces`,
          limit: 'exactamente una',
          ok: mal < 0 && !fraccion,
          failMessage: fraccion
            ? 'Hay tramos elegidos a medias: un stock existe o no existe.'
            : mal >= 0 && cub[mal] === 0
              ? `Nadie cubre la demora de ${E[mal].nombre.toLowerCase()}: cuando la demanda sube, no hay de dónde sacar yerba.`
              : `${E[mal]?.nombre} queda cubierta por dos stocks: se paga dos veces por lo mismo, y la cadena no tiene tiempos coherentes.`,
        });
        if (mal >= 0 || fraccion) return { feasible: false, objective: 0, checks };
      }

      const S = serviciosDeValores(C, values)!;
      const ev = evaluarServicios(C, S);
      checks.push({
        label: 'Tiempos posibles',
        value: ev.imposibles.length ? `${E[ev.imposibles[0]].corto} promete de más` : 'sí',
        limit: 'NRT ≥ 0 en cada etapa',
        ok: ev.imposibles.length === 0,
        failMessage: ev.imposibles.length
          ? `${E[ev.imposibles[0]].nombre} recibe en ${fmt(ev.SI[ev.imposibles[0]])} días y tarda ${E[ev.imposibles[0]].T}: no puede prometer ${fmt(S[ev.imposibles[0]])}.`
          : undefined,
      });
      checks.push({
        label: 'Entrega a los supermercados',
        value: `${fmt(S[N - 1], 1)} días`,
        limit: `≤ ${C.servicio} ${C.servicio === 1 ? 'día' : 'días'}`,
        ok: ev.cumpleCliente,
        failMessage: `Los supermercados esperarían ${fmt(S[N - 1], 1)} días: la yerbatera prometió ${C.servicio}. Falta stock cerca del cliente.`,
      });
      const total = ev.stock.reduce((a, b) => a + b, 0);
      checks.push({
        label: 'Stock de seguridad',
        value: toneladas(total),
        limit: 'informativo',
        ok: true,
      });
      // Redondeado etapa por etapa, igual que los costos de los tramos del modelo.
      const objective = ev.costo.reduce((a, b) => a + Math.round(b), 0);
      return { feasible: checks.every((c) => c.ok), objective, checks };
    },
  };
}

