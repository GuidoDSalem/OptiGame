/**
 * Plantilla del nivel avanzado "Dentro del solver": branch and bound y planos de corte.
 *
 * Un problema entero de dos variables, chico a propósito, para ver lo que hace un solver por
 * dentro: la relajación lineal, el árbol de ramificación con sus podas, y los cortes de Gomory
 * que salen del tableau óptimo. El jugador hace de solver en el intento manual.
 */
import { compileIndexed, term, type IndexedDraft, type IndexedSpec } from '../../engine/indexed';
import type { Problema2D } from '../../engine/ramificacion';
import type { Check, ContentBlock, Level } from '../types';
import { crearEscenaReticulado } from './Scene';
import { crearPanelSolver } from './SolverPanel';
import { crearSolverPorDentro } from './SolverAuto';

export interface ProductoSolver {
  id: string;
  label: string;
  /** Plural corto para ejes y tablas, p. ej. "mesas". */
  plural: string;
  ganancia: number;
}

export interface RecursoSolver {
  id: string;
  label: string;
  /** Nombre corto (se usa para las holguras del tableau). */
  short: string;
  unidad: string;
  consumo: [number, number];
  capacidad: number;
}

export interface VarianteSolver {
  id: string;
  variant: string;
  title: string;
  client: string;
  productos: [ProductoSolver, ProductoSolver];
  recursos: RecursoSolver[];
  /** Unidad de la ganancia, p. ej. "$k". */
  moneda: string;
  /** Tamaño de los gráficos. */
  xmax: number;
  ymax: number;
  historia: ContentBlock[];
}

export const problemaDe = (v: VarianteSolver): Problema2D => ({
  c: [v.productos[0].ganancia, v.productos[1].ganancia],
  filas: v.recursos.map((r) => ({ a: r.consumo, b: r.capacidad, nombre: r.short })),
});

export const idVar = (p: ProductoSolver) => `x_${p.id}`;

export function crearNivelSolver(v: VarianteSolver): Level {
  const P = problemaDe(v);
  const [p0, p1] = v.productos;
  const tol = 1e-6;

  const spec: IndexedSpec = {
    sets: [
      { id: 'P', name: 'Productos', index: 'p', items: v.productos.map((p) => ({ id: p.id, label: p.label, short: p.plural })) },
      { id: 'R', name: 'Recursos', index: 'r', items: v.recursos.map((r) => ({ id: r.id, label: r.label, short: r.short })) },
    ],
    params: [
      { id: 'g', name: `Ganancia por unidad (${v.moneda})`, symbol: 'g', over: ['P'], values: Object.fromEntries(v.productos.map((p) => [p.id, p.ganancia])) },
      {
        id: 'a',
        name: 'Recurso r que usa una unidad de p',
        symbol: 'a',
        over: ['R', 'P'],
        values: Object.fromEntries(v.recursos.flatMap((r) => v.productos.map((p, k) => [`${r.id}|${p.id}`, r.consumo[k]]))),
      },
      { id: 'K', name: 'Disponible de cada recurso', symbol: 'K', over: ['R'], values: Object.fromEntries(v.recursos.map((r) => [r.id, r.capacidad])) },
    ],
    vars: [{ id: 'x', symbol: 'x', over: ['P'], label: 'Unidades a fabricar de p', unit: 'unidades' }],
  };

  const reference: IndexedDraft = {
    sense: 'max',
    objective: { terms: [term('x', 'g')] },
    varTypes: { x: 'int' },
    constraints: [
      { key: 'recurso', name: 'Recurso', forall: ['R'], terms: [term('x', 'a')], op: '<=', rhs: { kind: 'param', param: 'K' } },
    ],
  };
  const referenceModel = compileIndexed(spec, reference).model;

  const teoria: ContentBlock[] = [
    { type: 'h', text: 'La relajación lineal: una cota' },
    {
      type: 'p',
      text: 'Si se olvida que las variables son enteras queda un LP, la **relajación**. Se resuelve rápido y da una **cota**: ninguna solución entera puede ser mejor, porque las enteras son un subconjunto. Pero su óptimo casi nunca es entero, y redondearlo puede dar algo infactible o malo (lo viste en el nivel 4).',
    },
    { type: 'h', text: 'Branch and bound' },
    {
      type: 'list',
      items: [
        '**Ramificar**: si en la relajación $x = 1{,}6$, ninguna solución entera tiene $1 < x < 2$. Se parte el problema en dos: una rama con $x \\leq 1$ y otra con $x \\geq 2$. El punto fraccionario queda afuera de las dos, y ningún punto entero se pierde.',
        'Cada rama es otro LP (con una cota más) que se resuelve y, si hace falta, se vuelve a partir. Así se arma un **árbol**.',
        'Una rama se **cierra** si: su LP no tiene solución (**infactible**); su óptimo ya es **entero** (candidata a mejor solución); o su cota no puede superar a la mejor entera conocida (**poda por cota**).',
      ],
    },
    {
      type: 'note',
      text: 'La poda por cota es la que ahorra trabajo. Con ganancias enteras, una rama con cota $27{,}9$ no puede dar más de $27$: si ya tenés una solución de $28$, esa rama no se explora.',
    },
    { type: 'h', text: 'Dos cotas otra vez' },
    {
      type: 'list',
      items: [
        '**Incumbente** (cota inferior): la mejor solución entera encontrada. Sube.',
        '**Cota superior**: la mejor relajación entre las ramas abiertas. Baja.',
        'La diferencia es la **brecha** (el *gap* que muestran los solvers). Cuando llega a cero, está demostrado el óptimo.',
      ],
    },
    { type: 'p', text: '¿Qué rama abrir primero? Los solvers suelen elegir la de **mejor cota** y ramificar por la variable **más fraccionaria**, pero también buscan rápido una buena incumbente, porque es lo que habilita las podas.' },
    { type: 'h', text: 'Planos de corte' },
    {
      type: 'p',
      text: 'La otra idea: en vez de partir, **recortar**. Un **corte** es una restricción nueva que cumplen todos los puntos enteros pero que deja afuera al óptimo fraccionario. Si se recorta lo suficiente, el LP termina en un vértice entero.',
    },
    { type: 'h', text: 'El corte de Gomory' },
    {
      type: 'p',
      text: 'Sale de una fila del tableau óptimo del simplex. Si $s_1, s_2$ son las holguras de las restricciones activas, la fila de $x$ dice:',
    },
    { type: 'tex', tex: 'x + m_1\\, s_1 + m_2\\, s_2 = \\bar x' },
    {
      type: 'p',
      text: 'Para un punto entero, $x$, $s_1$ y $s_2$ son enteros y no negativos (los datos son enteros). Si se redondean los coeficientes para abajo, el lado izquierdo no crece, y como es entero no puede pasar de $\\lfloor \\bar x \\rfloor$:',
    },
    { type: 'tex', tex: 'x + \\lfloor m_1 \\rfloor\\, s_1 + \\lfloor m_2 \\rfloor\\, s_2 \\;\\leq\\; \\lfloor \\bar x \\rfloor' },
    {
      type: 'p',
      text: 'En el óptimo del LP las holguras valen 0 y $x = \\bar x > \\lfloor \\bar x \\rfloor$: el corte lo deja afuera. Reemplazando cada holgura ($s = K - a\\cdot x$) queda una restricción en las variables originales, que se dibuja como una recta más.',
    },
    { type: 'h', text: 'Lo que hace un solver de verdad' },
    {
      type: 'p',
      text: 'HiGHS, Gurobi o CPLEX combinan todo: **branch and cut**. Primero *presolve* (simplifica el modelo), después cortes en la raíz (Gomory y muchas otras familias), heurísticas para encontrar incumbentes rápido, y recién ahí el árbol, agregando cortes también en los nodos. Cuando ves el *gap* en el log de un solver, es exactamente la brecha de este nivel.',
    },
  ];

  const pistas = [
    `La variable es $x_p$: cuántas unidades de cada producto. Se maximiza $\\sum_p g_p\\, x_p$.`,
    'Para cada recurso $r$: $\\sum_p a_{rp}\\, x_p \\leq K_r$.',
    'No se venden pedazos de mueble: $x_p$ tiene que ser entera.',
  ];

  return {
    id: v.id,
    number: 101,
    codigo: 'A1',
    seccion: 'avanzada',
    variant: v.variant,
    title: v.title,
    client: v.client,
    technique: 'Branch and bound · planos de corte',
    variables: v.productos.map((p) => ({
      id: idVar(p),
      symbol: `x_{\\text{${p.plural}}}`,
      label: p.label,
      unit: 'unidades',
      min: 0,
      max: p === p0 ? v.xmax : v.ymax,
      step: 1,
    })),
    objective: { sense: 'max', label: `Ganancia (${v.moneda}/semana)`, unit: '$' },
    referenceModel,
    starterModel: { sense: 'max', objective: {}, variables: referenceModel.variables, constraints: [] },
    scene: crearEscenaReticulado(v),
    indexed: {
      spec,
      reference,
      starter: { sense: 'min', objective: { terms: [term('x')] }, constraints: [] },
    },
    manualComponent: crearPanelSolver(v, P),
    resultsExtra: crearSolverPorDentro(v, P),
    briefing: [
      ...v.historia,
      {
        type: 'table',
        head: ['Recurso', p0.label, p1.label, 'Disponible'],
        rows: v.recursos.map((r) => [`${r.label} (${r.unidad})`, String(r.consumo[0]), String(r.consumo[1]), String(r.capacidad)]),
      },
      {
        type: 'table',
        head: ['Producto', `Ganancia (${v.moneda})`],
        rows: v.productos.map((p) => [p.label, String(p.ganancia)]),
      },
    ],
    theory: teoria,
    hints: pistas,

    evaluate(values) {
      const x = [values[idVar(p0)] ?? 0, values[idVar(p1)] ?? 0];
      const checks: Check[] = v.recursos.map((r) => {
        const uso = r.consumo[0] * x[0] + r.consumo[1] * x[1];
        const n = Math.round(uso * 100) / 100;
        return {
          label: r.label,
          value: `${String(n).replace('.', ',')} ${r.unidad}`,
          limit: `≤ ${r.capacidad}`,
          ok: uso <= r.capacidad + tol,
          failMessage: `Hacen falta ${String(n).replace('.', ',')} ${r.unidad} y hay ${r.capacidad}.`,
        };
      });
      const frac = v.productos.filter((_, k) => Math.abs(x[k] - Math.round(x[k])) > 1e-4);
      checks.push({
        label: 'Unidades enteras',
        value: frac.length ? frac.map((p) => `${String(Math.round(x[v.productos.indexOf(p)] * 100) / 100).replace('.', ',')} ${p.plural}`).join(', ') : 'sí',
        limit: 'muebles completos',
        ok: frac.length === 0,
        failMessage: `No se vende ${String(Math.round(x[v.productos.indexOf(frac[0] ?? p0)] * 100) / 100).replace('.', ',')} ${frac[0]?.plural ?? ''}. ¿x es entera?`,
      });
      const objective = P.c[0] * x[0] + P.c[1] * x[1];
      return { feasible: checks.every((c) => c.ok), objective: Math.round(objective * 1e6) / 1e6, checks };
    },
  };
}
