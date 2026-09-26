/**
 * Plantilla del nivel de ruteo (problema del viajante, TSP).
 *
 * El modelo base (salir una vez / llegar una vez de cada lugar) admite **subtours**: varios
 * circuitos sueltos. El jugador los elimina agregando cortes a demanda desde el resultado.
 * El óptimo de referencia se calcula con la formulación MTZ.
 */
import { compileIndexed, term, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import { analizar, arcId, conMTZ, cortesSubtour, manhattan, type Punto } from '../../engine/routing';
import type { Check, ContentBlock, Level } from '../types';
import { crearArmadorDeRutas } from './RouteBuilder';
import { crearEscenaCiudad } from './Scene';

export interface Lugar extends Punto {
  label: string;
  short: string;
}

export interface VarianteRuteo {
  id: string;
  variant: string;
  title: string;
  client: string;
  deposito: Lugar;
  clientes: Lugar[];
  vocab: {
    vehiculo: string; // "la camioneta"
    unidad: string; // "cuadras"
  };
  historia: ContentBlock[];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Cantidad de recorridos distintos con n clientes: (n−1)!/2 (sentido y punto de partida no importan). */
const recorridos = (n: number) => {
  let f = 1;
  for (let k = 2; k <= n - 1; k++) f *= k;
  return f / 2;
};

export function crearNivelRuteo(v: VarianteRuteo): Level {
  const { deposito: D, clientes: C, vocab: V } = v;
  const lugares = [D, ...C];
  const nodes = lugares.map((l) => l.id);
  const dist = manhattan(lugares);
  const label = (id: string) => lugares.find((l) => l.id === id)!.label;
  const items = lugares.map(({ id, label, short }) => ({ id, label, short }));

  const spec: IndexedSpec = {
    sets: [
      { id: 'I', name: 'Lugares (origen)', index: 'i', items },
      { id: 'J', name: 'Lugares (destino)', index: 'j', items },
    ],
    params: [
      {
        id: 'd',
        name: `Distancia (${V.unidad})`,
        symbol: 'd',
        over: ['I', 'J'],
        values: Object.fromEntries(nodes.flatMap((i) => nodes.map((j) => [`${i}|${j}`, dist(i, j)]))),
      },
    ],
    vars: [{ id: 'x', symbol: 'x', over: ['I', 'J'], label: 'Ir de i a j', unit: '', distinct: ['I', 'J'] }],
  };

  const reference: IndexedDraft = {
    sense: 'min',
    objective: { terms: [term('x', 'd')] },
    varTypes: { x: 'bin' },
    constraints: [
      { key: 'salida', name: 'Salir una vez', forall: ['I'], terms: [term('x')], op: '=', rhs: { kind: 'value', value: '1' } },
      { key: 'llegada', name: 'Llegar una vez', forall: ['J'], terms: [term('x')], op: '=', rhs: { kind: 'value', value: '1' } },
    ],
  };
  const referenceModel = conMTZ(compileIndexed(spec, reference).model, nodes, D.id);

  const n = C.length + 1;
  const teoria: ContentBlock[] = [
    { type: 'h', text: 'El problema del viajante' },
    {
      type: 'p',
      text: 'Visitar todos los lugares **una sola vez** y volver al inicio, recorriendo lo menos posible. Es el famoso **TSP** (*traveling salesman problem*). Aparece en reparto, recolección de residuos, robots de depósito, perforado de placas electrónicas y hasta en secuenciación de ADN.',
    },
    {
      type: 'p',
      text: `¿Por qué no probar todas las rutas? Con ${C.length} clientes hay ${recorridos(n).toLocaleString('es-AR')} recorridos distintos. Pero crecen como un factorial:`,
    },
    {
      type: 'table',
      head: ['Clientes', 'Recorridos posibles'],
      rows: [5, 10, 15, 20].map((k) => [String(k), recorridos(k + 1).toExponential(1).replace('e+', ' × 10^')]),
    },
    { type: 'h', text: 'El modelo' },
    { type: 'p', text: '$x_{ij} = 1$ si se va directo del lugar $i$ al lugar $j$ (con $i \\neq j$).' },
    { type: 'tex', tex: '\\min \\; \\sum_{i} \\sum_{j \\neq i} d_{ij}\\, x_{ij}' },
    { type: 'tex', tex: '\\sum_{j} x_{ij} = 1 \\;\\; \\forall\\, i \\qquad \\sum_{i} x_{ij} = 1 \\;\\; \\forall\\, j' },
    { type: 'p', text: 'De cada lugar se **sale una vez** y a cada lugar se **llega una vez**. ¿Alcanza con eso?' },
    { type: 'h', text: 'La trampa: los subtours' },
    {
      type: 'p',
      text: 'No alcanza. Esas restricciones son las del **problema de asignación** del nivel 4, y el solver puede cumplirlas con **varios circuitos chicos**: Depósito → A → Depósito, y por otro lado B → C → D → B. Cada lugar tiene una entrada y una salida, pero la ruta está partida.',
    },
    { type: 'p', text: 'Para prohibirlo, para cada grupo $S$ de lugares que no los incluye a todos:' },
    { type: 'tex', tex: '\\sum_{i \\in S} \\sum_{j \\in S,\\, j \\neq i} x_{ij} \\leq |S| - 1' },
    {
      type: 'p',
      text: 'Dentro de $S$ se pueden usar a lo sumo $|S| - 1$ tramos: no alcanzan para cerrar un circuito. El problema es que hay **una por cada subconjunto**, unas $2^n$. Imposible escribirlas todas.',
    },
    { type: 'h', text: 'Cortes a demanda' },
    {
      type: 'list',
      items: [
        'Resolver sin esas restricciones.',
        'Mirar la solución. Si tiene subtours, agregar **sólo** los cortes que los prohíben.',
        'Volver a resolver, y repetir hasta que quede un solo recorrido.',
      ],
    },
    {
      type: 'note',
      text: 'Así trabajan los solvers de TSP como **Concorde**, que resolvió de forma exacta un recorrido de 85.900 ciudades. Se llaman **restricciones perezosas** (*lazy constraints*): se agregan recién cuando hacen falta.',
    },
    {
      type: 'p',
      text: 'Otra formulación, llamada **MTZ**, agrega una variable $u_i$ con el orden de visita y $u_i - u_j + n\\, x_{ij} \\leq n - 1$. Son pocas restricciones, pero su relajación lineal es débil y rinde peor en problemas grandes.',
    },
    { type: 'h', text: 'Heurísticas' },
    {
      type: 'p',
      text: 'Cuando el problema es enorme o hay que decidir en milisegundos, se usan reglas rápidas. No garantizan el óptimo:',
    },
    {
      type: 'list',
      items: [
        '**Vecino más cercano**: ir siempre al lugar sin visitar más cercano. Es simple, pero al final suele quedar lejos de casa.',
        '**2-opt**: si dos tramos se "cruzan", invertir el pedazo entre ellos acorta la ruta. Se repite hasta que no hay mejoras (un **óptimo local**).',
      ],
    },
    {
      type: 'p',
      text: 'La diferencia con el solver: el solver **demuestra** que su ruta es la mejor, y la heurística no puede saber cuánto le falta.',
    },
    {
      type: 'note',
      text: 'En el modelador, $i$ y $j$ recorren los mismos lugares y el juego ya excluye $x_{ii}$ (ir de un lugar a sí mismo).',
    },
  ];

  const pistas = [
    '$x_{ij}$ es **binaria**. El objetivo es $\\sum_i \\sum_j d_{ij} x_{ij}$.',
    'Salir una vez: "para cada $i$", $\\sum_j x_{ij} = 1$. Llegar una vez: "para cada $j$", $\\sum_i x_{ij} = 1$.',
    'Si el resultado tiene circuitos separados, no es un error de tu modelo base: usá el botón para **prohibir los subtours** y volvé a resolver.',
  ];

  const circuitoTexto = (c: string[]) => [...c, c[0]].map(label).join(' → ');

  return {
    id: v.id,
    number: 6,
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Ruteo (TSP) · cortes y heurísticas',
    variables: nodes.flatMap((i) =>
      nodes
        .filter((j) => j !== i)
        .map((j) => ({
          id: arcId(i, j),
          symbol: `x_{\\text{${lugares.find((l) => l.id === i)!.short}},\\text{${lugares.find((l) => l.id === j)!.short}}}`,
          label: `${label(i)} → ${label(j)}`,
          unit: '',
          min: 0,
          max: 1,
          step: 1,
        })),
    ),
    objective: { sense: 'min', label: `Recorrido (${V.unidad})`, unit: '' },
    referenceModel,
    starterModel: { sense: 'min', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: crearEscenaCiudad(D, C),
    indexed: {
      spec,
      reference,
      starter: { sense: 'max', objective: { terms: [term('x')] }, constraints: [] },
    },
    manualComponent: crearArmadorDeRutas({ depot: D, clientes: C, dist, unidad: V.unidad }),
    briefing: [
      ...v.historia,
      {
        type: 'table',
        head: ['Lugar', 'Esquina (calle, avenida)'],
        rows: lugares.map((l) => [l.label, `${l.x}, ${l.y}`]),
      },
      {
        type: 'note',
        text: `Objetivo: que ${V.vehiculo} salga del depósito, visite **todos** los lugares una vez y vuelva, recorriendo la menor cantidad de ${V.unidad}. En la grilla no se puede ir en diagonal: la distancia es cuántas cuadras hay en horizontal más cuántas en vertical.`,
      },
    ],
    theory: teoria,
    hints: pistas,

    lazyCuts: {
      generate(values) {
        const { circuitos } = analizar(nodes, values);
        return circuitos.length > 1 ? cortesSubtour(nodes, circuitos, 'Sin subtour', label) : [];
      },
      explain(values) {
        const { circuitos } = analizar(nodes, values);
        return `La solución tiene **${circuitos.length} circuitos separados**: ${circuitos.map(circuitoTexto).join('; ')}. Cumple "salir una vez" y "llegar una vez", pero ${V.vehiculo} no puede saltar de un circuito a otro.`;
      },
      action: 'Prohibir estos subtours y volver a resolver',
    },

    evaluate(values) {
      const { circuitos, gradoMal, fraccionarios } = analizar(nodes, values);
      const checks: Check[] = [];
      checks.push({
        label: 'Visitas',
        value: gradoMal.length ? `${gradoMal.length} lugar(es) mal` : 'una vez cada lugar',
        limit: 'entrar y salir una vez',
        ok: gradoMal.length === 0,
        failMessage: gradoMal.length
          ? `${gradoMal.map(label).join(', ')}: sin visitar o visitados más de una vez.`
          : undefined,
      });
      const unico = circuitos.length === 1 && circuitos[0].length === nodes.length;
      checks.push({
        label: 'Un solo recorrido',
        value: unico ? circuitoTexto(circuitos[0]) : circuitos.length > 1 ? `${circuitos.length} circuitos` : 'sin cerrar',
        limit: 'desde y hasta el depósito',
        ok: unico,
        failMessage:
          circuitos.length > 1
            ? `La ruta se parte en ${circuitos.length} circuitos: ${cap(V.vehiculo)} no puede teletransportarse entre ellos.`
            : `El recorrido no vuelve al depósito pasando por todos.`,
      });
      checks.push({
        label: 'Tramos enteros',
        value: fraccionarios.length ? `${fraccionarios.length} fraccionarios` : 'sí',
        limit: 'ir o no ir',
        ok: fraccionarios.length === 0,
        failMessage: 'No se puede hacer "medio tramo". ¿x es binaria?',
      });
      let objective = 0;
      for (const i of nodes) for (const j of nodes) if (i !== j) objective += dist(i, j) * (values[arcId(i, j)] ?? 0);
      return { feasible: checks.every((c) => c.ok), objective, checks };
    },
  };
}
