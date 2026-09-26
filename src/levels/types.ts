import type { ComponentType } from 'react';
import type * as THREE from 'three';
import type { Constraint, LPModel } from '../engine/model';
import type { SolveResult } from '../engine/solver';
import type { IndexedDraft, IndexedSpec } from '../engine/indexed';
import type { IsoSceneHandle } from '../scene/IsoCanvas';

/**
 * Bloques de contenido para la historia y la clase teórica.
 * En `text` se puede usar LaTeX en línea entre $...$.
 */
export type ContentBlock =
  | { type: 'h'; text: string }
  | { type: 'p'; text: string }
  | { type: 'tex'; tex: string }
  | { type: 'list'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'table'; head: string[]; rows: string[][] };

/** Variable de decisión tal como la ve el jugador. */
export interface DecisionVar {
  id: string;
  /** Símbolo LaTeX, p. ej. "x_r". */
  symbol: string;
  label: string;
  unit: string;
  /** Rango de los sliders del intento manual. */
  min: number;
  max: number;
  step: number;
}

export interface Check {
  label: string;
  /** Valor ya formateado, p. ej. "480 mg/L". */
  value: string;
  /** Límite formateado, p. ej. "≤ 500 mg/L". */
  limit: string;
  ok: boolean;
  /** Explicación cuando no se cumple (lo que "pasa en el mundo"). */
  failMessage?: string;
}

/** Cómo le va a una decisión en el "mundo real" del nivel (independiente del modelo del jugador). */
export interface Evaluation {
  feasible: boolean;
  objective: number;
  checks: Check[];
}

export interface ResultsExtraProps {
  result: SolveResult;
  model: LPModel;
}

export interface ManualProps {
  values: Record<string, number>;
  onChange(values: Record<string, number>): void;
}

export interface SceneProps {
  values: Record<string, number>;
  evaluation: Evaluation;
}

export interface Level {
  id: string;
  number: number;
  /**
   * Nombre de la versión cuando un mismo nivel (misma técnica y teoría) tiene varias
   * situaciones, p. ej. "Escuela" y "Hospital". Los niveles con el mismo número se agrupan.
   */
  variant?: string;
  /** Sección del menú: los niveles avanzados (técnicas de gran escala) van aparte. */
  seccion?: 'avanzada';
  /** Código visible en vez del número, p. ej. "A3". */
  codigo?: string;
  title: string;
  client: string;
  /** Técnica que enseña el nivel. */
  technique: string;
  briefing: ContentBlock[];
  theory: ContentBlock[];
  variables: DecisionVar[];
  objective: { sense: 'min' | 'max'; label: string; unit: string };
  /** Modelo correcto; se usa para calcular el óptimo y comparar. */
  referenceModel: LPModel;
  /** Modelo con el que arranca el modelador (normalmente vacío). */
  starterModel: LPModel;
  /** El "mundo": evalúa una decisión contra la realidad del nivel. */
  evaluate(values: Record<string, number>): Evaluation;
  /** Pistas progresivas para el modelador. */
  hints: string[];
  /**
   * En el intento manual el jugador puede decidir sólo algunas variables; esta función completa
   * el resto (p. ej. el stock que resulta de lo enviado) antes de evaluar y dibujar.
   */
  manualDerive?(values: Record<string, number>): Record<string, number>;
  /** Panel extra en el resultado (p. ej. la frontera de Pareto). */
  resultsExtra?: ComponentType<ResultsExtraProps>;
  /** Controles propios para el intento manual (reemplazan a los sliders o la tabla). */
  manualComponent?: ComponentType<ManualProps>;
  /**
   * Cortes "a demanda": dada una solución del solver, devuelve restricciones que la prohíben
   * si viola algo que el modelo base no captura (p. ej. subtours). El jugador los agrega y
   * vuelve a resolver hasta que no queden.
   */
  lazyCuts?: {
    generate(values: Record<string, number>): Constraint[];
    /** Texto del panel, p. ej. "La solución tiene 3 circuitos separados." */
    explain(values: Record<string, number>): string;
    /** Texto del botón, p. ej. "Prohibir estos subtours y volver a resolver". */
    action: string;
  };
  /** Si el nivel tiene 2 variables, se puede mostrar el método gráfico. */
  plot?: { x: string; y: string; xmax: number; ymax: number; /** Máximo del slider de la recta de isocosto. */ isoMax: number };
  scene: SceneSpec;
  /**
   * Niveles con índices: el modelador trabaja con conjuntos, parámetros y familias de
   * restricciones, y el modelo se expande al plano antes de resolver.
   */
  indexed?: IndexedLevel;
}

export interface IndexedLevel {
  spec: IndexedSpec;
  reference: IndexedDraft;
  starter: IndexedDraft;
  /** Familia de variables de 2 índices que se muestra como matriz (intento manual y resultado). */
  matrix?: {
    var: string;
    rows: string;
    cols: string;
    rowParam?: string;
    colParam?: string;
    /** En el intento manual, cada celda es un casillero sí/no. */
    binary?: boolean;
    /** Mostrar totales por fila y columna (por defecto sí). */
    totals?: boolean;
  };
  /**
   * Niveles multi-período: tabla con una columna por período y una fila por familia de
   * variables (y parámetros de contexto). Reemplaza a la matriz si está definida.
   */
  /** En el modelador, cada término puede fijar un elemento (y_Hospital) en vez de sumar. */
  pickItems?: boolean;
  /** En el modelador, cada término puede llevar dos coeficientes (p_s · t_{dc}). */
  twoCoefs?: boolean;
  periodTable?: {
    set: string;
    /** Familia que el jugador edita en el intento manual. */
    manualVar: string;
    /** Parámetros indexados por período que se muestran como contexto (demanda, capacidad…). */
    params?: string[];
  };
}

/** Escena isométrica del nivel: se usa en el juego y para la miniatura del menú. */
export interface SceneSpec {
  create(scene: THREE.Scene): IsoSceneHandle<SceneProps>;
  /** Mitad del ancho visible en unidades del mundo (zoom). */
  viewSize?: number;
}
