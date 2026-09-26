import type { ComponentType } from 'react';
import type { LPModel } from '../engine/model';

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

export interface SceneProps {
  values: Record<string, number>;
  evaluation: Evaluation;
}

export interface Level {
  id: string;
  number: number;
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
  /** Si el nivel tiene 2 variables, se puede mostrar el método gráfico. */
  plot?: { x: string; y: string; xmax: number; ymax: number };
  Scene: ComponentType<SceneProps>;
}
