/**
 * "Dentro del solver": branch and bound y planos de corte de Gomory para un problema entero
 * de dos variables, max c·x s.a. A·x ≤ b, x ≥ 0 enteras (A, b, c enteros).
 *
 * Con dos variables la relajación lineal se resuelve exacto enumerando vértices, y la base
 * óptima (las dos restricciones activas) da la fila del tableau de donde sale el corte.
 */

export type Vec = [number, number];

/** Restricción a·x ≤ b (coeficientes enteros). */
export interface Fila {
  a: Vec;
  b: number;
  nombre?: string;
}

export interface Problema2D {
  c: Vec;
  filas: Fila[];
}

export interface LP2D {
  factible: boolean;
  x: Vec;
  z: number;
  /** Índices (en filas + no negatividad) de las dos restricciones de la base óptima. */
  base: [number, number];
}

const EPS = 1e-9;
export const frac = (v: number) => v - Math.floor(v + EPS);
export const esEntero = (v: number) => Math.abs(v - Math.round(v)) < 1e-7;
const limpiar = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v);
const dot = (a: Vec, x: Vec) => a[0] * x[0] + a[1] * x[1];

/** Filas del problema más la no negatividad (−x ≤ 0, −y ≤ 0) al final. */
export const conSignos = (filas: Fila[]): Fila[] => [
  ...filas,
  { a: [-1, 0], b: 0, nombre: 'x ≥ 0' },
  { a: [0, -1], b: 0, nombre: 'y ≥ 0' },
];

/** Relajación lineal exacta: el mejor vértice. Supone región acotada. */
export function resolverLP(c: Vec, filasBase: Fila[]): LP2D {
  const filas = conSignos(filasBase);
  const factible = (x: Vec) => filas.every((f) => dot(f.a, x) <= f.b + 1e-7);
  let mejor: LP2D = { factible: false, x: [0, 0], z: -Infinity, base: [0, 0] };
  for (let i = 0; i < filas.length; i++)
    for (let j = i + 1; j < filas.length; j++) {
      const [a1, b1] = filas[i].a;
      const [a2, b2] = filas[j].a;
      const det = a1 * b2 - a2 * b1;
      if (Math.abs(det) < EPS) continue;
      const x: Vec = [limpiar((filas[i].b * b2 - filas[j].b * b1) / det), limpiar((a1 * filas[j].b - a2 * filas[i].b) / det)];
      if (!factible(x)) continue;
      const z = limpiar(dot(c, x));
      // Desempate determinístico: mayor z, después mayor x, después mayor y.
      if (z > mejor.z + 1e-9 || (Math.abs(z - mejor.z) <= 1e-9 && (x[0] > mejor.x[0] + 1e-9 || (Math.abs(x[0] - mejor.x[0]) <= 1e-9 && x[1] > mejor.x[1] + 1e-9))))
        mejor = { factible: true, x, z, base: [i, j] };
    }
  if (!mejor.factible) return mejor;
  return { ...mejor, base: baseOptima(c, filas, mejor.x) ?? mejor.base };
}

/** Dos restricciones activas en x con c = λ₁a₁ + λ₂a₂, λ ≥ 0 (base dual factible). */
function baseOptima(c: Vec, filas: Fila[], x: Vec): [number, number] | null {
  const activas = filas.map((f, i) => ({ f, i })).filter(({ f }) => Math.abs(dot(f.a, x) - f.b) < 1e-7);
  for (let p = 0; p < activas.length; p++)
    for (let q = p + 1; q < activas.length; q++) {
      const [u, v] = [activas[p].f.a, activas[q].f.a];
      const det = u[0] * v[1] - v[0] * u[1];
      if (Math.abs(det) < EPS) continue;
      const l1 = (c[0] * v[1] - v[0] * c[1]) / det;
      const l2 = (u[0] * c[1] - c[0] * u[1]) / det;
      if (l1 >= -1e-9 && l2 >= -1e-9) return [activas[p].i, activas[q].i];
    }
  return null;
}

/* ---------------- Planos de corte (Gomory) ---------------- */

export interface FilaTableau {
  /** Variable básica: 'x', 'y' o la holgura de una restricción. */
  basica: string;
  valor: number;
  /** Coeficientes de las dos holguras no básicas (s de las restricciones activas). */
  coefs: [number, number];
}

export interface CorteGomory {
  fila: FilaTableau;
  /** Nombres de las holguras no básicas. */
  holguras: [string, string];
  /** El corte en las variables originales. */
  corte: Fila;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/**
 * Filas del tableau óptimo. Con la base de restricciones activas B (2×2) y M = B⁻¹:
 * x = M·b_B − M·s_B, o sea x_k + Σ_l M_kl s_l = x̄_k.
 */
export function tableau(lp: LP2D, filasBase: Fila[]): { filas: FilaTableau[]; holguras: [string, string]; B: [Fila, Fila] } {
  const filas = conSignos(filasBase);
  const [i, j] = lp.base;
  const B: [Fila, Fila] = [filas[i], filas[j]];
  const det = B[0].a[0] * B[1].a[1] - B[0].a[1] * B[1].a[0];
  // B = [a_i; a_j] por filas; x = B⁻¹(b_B − s_B). Fila k de B⁻¹ = coeficientes de s_i, s_j en x_k.
  const Mk: [Vec, Vec] = [
    [limpiar(B[1].a[1] / det), limpiar(-B[0].a[1] / det)],
    [limpiar(-B[1].a[0] / det), limpiar(B[0].a[0] / det)],
  ];
  const nombre = (f: Fila, idx: number) => f.nombre ?? `r${idx + 1}`;
  const holguras: [string, string] = [nombre(B[0], i), nombre(B[1], j)];
  const out: FilaTableau[] = ['x', 'y'].map((v, k) => ({ basica: v, valor: lp.x[k], coefs: Mk[k] }));
  // Holguras básicas: s_m = b_m − a_m·x = (b_m − a_m·x̄) + Σ_l (a_m·M_{·l}) s_l.
  filas.forEach((f, m) => {
    // Las holguras de x ≥ 0 e y ≥ 0 son x e y mismas: no agregan filas nuevas.
    if (m === i || m === j || m >= filasBase.length) return;
    const col = (l: number): Vec => [Mk[0][l], Mk[1][l]];
    out.push({
      basica: `s(${nombre(f, m)})`,
      valor: limpiar(f.b - dot(f.a, lp.x)),
      coefs: [limpiar(-dot(f.a, col(0))), limpiar(-dot(f.a, col(1)))],
    });
  });
  return { filas: out, holguras, B };
}

/**
 * Corte de Gomory (Chvátal–Gomory) desde una fila x_k + Σ M_kl s_l = x̄_k:
 * x_k + Σ ⌊M_kl⌋ s_l ≤ ⌊x̄_k⌋, y reemplazando s_l = b_l − a_l·x queda en x e y.
 * Vale para todo punto entero (las holguras de filas enteras son enteras) y deja afuera x̄.
 */
export function corteDesdeFila(P: Problema2D, cortes: Fila[], lp: LP2D, basica: string): CorteGomory | null {
  const T = tableau(lp, [...P.filas, ...cortes]);
  const fila = T.filas.find((f) => f.basica === basica);
  if (!fila || esEntero(fila.valor)) return null;
  const fl = fila.coefs.map((m) => Math.floor(m + EPS)) as Vec;
  // Parte de la variable básica en x,y: para x/y es e_k; para una holgura s_m es b_m − a_m·x.
  let a: Vec;
  let b: number;
  if (basica === 'x' || basica === 'y') {
    a = basica === 'x' ? [1, 0] : [0, 1];
    b = Math.floor(fila.valor + EPS);
  } else {
    const fm = conSignos([...P.filas, ...cortes]).find((f, m) => `s(${f.nombre ?? `r${m + 1}`})` === basica)!;
    // s_m + Σ ⌊·⌋ s_l ≤ ⌊valor⌋ con s_m = b_m − a_m x  →  −a_m x + ... ≤ ⌊valor⌋ − b_m
    a = [-fm.a[0], -fm.a[1]];
    b = Math.floor(fila.valor + EPS) - fm.b;
  }
  T.B.forEach((f, l) => {
    a = [a[0] - fl[l] * f.a[0], a[1] - fl[l] * f.a[1]];
    b -= fl[l] * f.b;
  });
  const g = gcd(gcd(Math.round(a[0]), Math.round(a[1])), 0) || 1;
  // Dividir por el mcd de los coeficientes y redondear el lado derecho hacia abajo (sigue valiendo y es más fuerte).
  const corte: Fila = { a: [Math.round(a[0]) / g, Math.round(a[1]) / g], b: Math.floor(b / g + EPS) };
  return { fila, holguras: T.holguras, corte };
}

/** La fila más fraccionaria (la que suele dar el corte más profundo). */
export function filaMasFraccionaria(P: Problema2D, cortes: Fila[], lp: LP2D): string | null {
  const T = tableau(lp, [...P.filas, ...cortes]);
  const cands = T.filas.filter((f) => !esEntero(f.valor));
  if (!cands.length) return null;
  const d = (v: number) => Math.abs(frac(v) - 0.5);
  // Preferir x e y ante empates: son las que el jugador ve en el gráfico.
  return cands.reduce((m, f) => (d(f.valor) < d(m.valor) - 1e-9 ? f : m)).basica;
}

export interface PasoCorte {
  corte: Fila;
  desde: string;
  /** Relajación después de agregar el corte. */
  lp: LP2D;
}

export interface EstadoCortes {
  cortes: Fila[];
  lp: LP2D;
  inicial: LP2D;
  pasos: PasoCorte[];
}

export function iniciarCortes(P: Problema2D): EstadoCortes {
  const lp = resolverLP(P.c, P.filas);
  return { cortes: [], lp, inicial: lp, pasos: [] };
}

export const lpEntero = (lp: LP2D) => lp.factible && esEntero(lp.x[0]) && esEntero(lp.x[1]);

export function agregarCorte(P: Problema2D, e: EstadoCortes, basica: string): EstadoCortes | null {
  const g = corteDesdeFila(P, e.cortes, e.lp, basica);
  if (!g) return null;
  const nombre = `corte ${e.cortes.length + 1}`;
  const corte = { ...g.corte, nombre };
  const cortes = [...e.cortes, corte];
  const lp = resolverLP(P.c, [...P.filas, ...cortes]);
  return { ...e, cortes, lp, pasos: [...e.pasos, { corte, desde: basica, lp }] };
}

export function planosDeCorte(P: Problema2D, max = 30): EstadoCortes {
  let e = iniciarCortes(P);
  for (let k = 0; k < max && !lpEntero(e.lp); k++) {
    const f = filaMasFraccionaria(P, e.cortes, e.lp);
    const s = f && agregarCorte(P, e, f);
    if (!s) break;
    e = s;
  }
  return e;
}

/* ---------------- Branch and bound ---------------- */

export type EstadoNodo = 'abierto' | 'ramificado' | 'infactible' | 'entero' | 'podado';

export interface Nodo {
  id: number;
  padre: number | null;
  /** Rama que lo creó, p. ej. "x ≤ 2". */
  rama: string | null;
  /** Cotas agregadas en el camino desde la raíz. */
  cotas: Fila[];
  lp: LP2D;
  estado: EstadoNodo;
  profundidad: number;
  /** Variable por la que se ramificó (si se ramificó). */
  variable?: 0 | 1;
}

export interface Arbol {
  nodos: Nodo[];
  incumbente: { x: Vec; z: number; nodo: number } | null;
}

/** Cota del objetivo: con c entero, ninguna solución entera de la rama supera ⌊z⌋. */
export const cotaEntera = (z: number) => Math.floor(z + 1e-7);

function clasificar(n: Nodo, a: Arbol): Nodo {
  if (!n.lp.factible) return { ...n, estado: 'infactible' };
  if (esEntero(n.lp.x[0]) && esEntero(n.lp.x[1])) return { ...n, estado: 'entero' };
  if (a.incumbente && cotaEntera(n.lp.z) <= a.incumbente.z) return { ...n, estado: 'podado' };
  return n;
}

function nuevoNodo(P: Problema2D, a: Arbol, padre: Nodo | null, cota: Fila | null, rama: string | null): Nodo {
  const cotas = [...(padre?.cotas ?? []), ...(cota ? [cota] : [])];
  const lp = resolverLP(P.c, [...P.filas, ...cotas]);
  return clasificar(
    { id: a.nodos.length, padre: padre?.id ?? null, rama, cotas, lp, estado: 'abierto', profundidad: padre ? padre.profundidad + 1 : 0 },
    a,
  );
}

function registrarEnteros(a: Arbol, nuevos: Nodo[]): Arbol {
  let inc = a.incumbente;
  for (const n of nuevos)
    if (n.estado === 'entero' && (!inc || n.lp.z > inc.z + 1e-9)) inc = { x: [Math.round(n.lp.x[0]), Math.round(n.lp.x[1])], z: Math.round(n.lp.z), nodo: n.id };
  // Con una incumbente mejor, se podan los nodos abiertos que ya no pueden superarla.
  const nodos = a.nodos.map((n) => (n.estado === 'abierto' && inc && cotaEntera(n.lp.z) <= inc.z ? { ...n, estado: 'podado' as const } : n));
  return { nodos, incumbente: inc };
}

export function iniciarArbol(P: Problema2D): Arbol {
  const a: Arbol = { nodos: [], incumbente: null };
  const raiz = nuevoNodo(P, a, null, null, null);
  return registrarEnteros({ nodos: [raiz], incumbente: null }, [raiz]);
}

export const nombreVar = (k: 0 | 1) => (k === 0 ? 'x' : 'y');

/** Ramifica un nodo abierto por la variable k (que tiene que ser fraccionaria). */
export function ramificar(P: Problema2D, a: Arbol, id: number, k: 0 | 1): Arbol | null {
  const n = a.nodos[id];
  if (!n || n.estado !== 'abierto' || esEntero(n.lp.x[k])) return null;
  const v = n.lp.x[k];
  const lo = Math.floor(v);
  const e: Vec = k === 0 ? [1, 0] : [0, 1];
  const base: Arbol = { ...a, nodos: a.nodos.map((m) => (m.id === id ? { ...m, estado: 'ramificado' as const, variable: k } : m)) };
  const izq = nuevoNodo(P, base, n, { a: e, b: lo, nombre: `${nombreVar(k)} ≤ ${lo}` }, `${nombreVar(k)} ≤ ${lo}`);
  const conIzq = { ...base, nodos: [...base.nodos, izq] };
  const der = nuevoNodo(P, conIzq, n, { a: [-e[0], -e[1]], b: -(lo + 1), nombre: `${nombreVar(k)} ≥ ${lo + 1}` }, `${nombreVar(k)} ≥ ${lo + 1}`);
  return registrarEnteros({ ...conIzq, nodos: [...conIzq.nodos, der] }, [izq, der]);
}

export const abiertos = (a: Arbol) => a.nodos.filter((n) => n.estado === 'abierto');
export const termino = (a: Arbol) => abiertos(a).length === 0;

/** Cota superior global: la mejor relajación entre las hojas abiertas (o la incumbente si no quedan). */
export function cotaSuperior(a: Arbol): number {
  const ab = abiertos(a);
  if (!ab.length) return a.incumbente?.z ?? -Infinity;
  return Math.max(...ab.map((n) => n.lp.z), a.incumbente?.z ?? -Infinity);
}

/** Estrategia del solver: el nodo con mejor cota, y la variable más fraccionaria. */
export function eleccionAutomatica(a: Arbol): { id: number; k: 0 | 1 } | null {
  const ab = abiertos(a);
  if (!ab.length) return null;
  const n = ab.reduce((m, x) => (x.lp.z > m.lp.z + 1e-9 ? x : m));
  const d = (v: number) => (esEntero(v) ? Infinity : Math.abs(frac(v) - 0.5));
  const k: 0 | 1 = d(n.lp.x[0]) <= d(n.lp.x[1]) ? 0 : 1;
  return { id: n.id, k };
}

export function branchAndBound(P: Problema2D, max = 200): Arbol {
  let a = iniciarArbol(P);
  for (let i = 0; i < max; i++) {
    const e = eleccionAutomatica(a);
    if (!e) break;
    a = ramificar(P, a, e.id, e.k)!;
  }
  return a;
}

/** Óptimo entero por fuerza bruta (para tests y para verificar). */
export function optimoEntero(P: Problema2D, max = 200): { x: Vec; z: number } | null {
  let best: { x: Vec; z: number } | null = null;
  for (let x = 0; x <= max; x++)
    for (let y = 0; y <= max; y++) {
      const p: Vec = [x, y];
      if (!P.filas.every((f) => dot(f.a, p) <= f.b)) continue;
      const z = dot(P.c, p);
      if (!best || z > best.z) best = { x: p, z };
    }
  return best;
}
