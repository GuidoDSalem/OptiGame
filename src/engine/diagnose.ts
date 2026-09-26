import type { Evaluation, Level } from '../levels/types';
import type { LPModel } from './model';
import { gap } from './score';
import type { SolveResult } from './solver';

export type Verdict = 'perfect' | 'suboptimal' | 'unsafe' | 'infeasible' | 'unbounded' | 'error';

export interface Diagnosis {
  verdict: Verdict;
  title: string;
  messages: string[];
  /** Evaluación en el mundo real de la solución del jugador (si hubo solución). */
  evaluation?: Evaluation;
}

/**
 * Traduce el resultado del solver sobre el modelo del jugador a feedback pedagógico,
 * contrastándolo con el "mundo" del nivel y con el óptimo de referencia.
 */
export function diagnose(level: Level, model: LPModel, res: SolveResult, optimum: number | undefined): Diagnosis {
  const extra: string[] = [];
  const ref = level.referenceModel;
  if (model.sense !== ref.sense) {
    extra.push(
      `Ojo: estás **${model.sense === 'min' ? 'minimizando' : 'maximizando'}**. ¿Es eso lo que quiere el cliente?`,
    );
  }
  const objDiffers = level.variables.some((v) => (model.objective[v.id] ?? 0) !== (ref.objective[v.id] ?? 0));
  if (objDiffers) extra.push('Los coeficientes de tu función objetivo no coinciden con los datos del problema.');

  if (res.status === 'error') {
    return {
      verdict: 'error',
      title: 'El solver no pudo leer el modelo',
      messages: [res.error ?? res.rawStatus, ...extra],
    };
  }
  if (res.status === 'unbounded') {
    return {
      verdict: 'unbounded',
      title: 'Modelo no acotado',
      messages: [
        'El objetivo puede mejorar **sin límite**: alguna variable puede crecer (o decrecer) para siempre. Falta una restricción que la frene.',
        ...extra,
      ],
    };
  }
  if (res.status === 'infeasible') {
    return {
      verdict: 'infeasible',
      title: 'Modelo infactible',
      messages: [
        'No existe ninguna decisión que cumpla **todas** tus restricciones a la vez. Revisá los signos (≤ / ≥), los lados derechos y las restricciones duplicadas o contradictorias.',
        ...extra,
      ],
    };
  }

  const evaluation = level.evaluate(res.values);
  if (!evaluation.feasible) {
    const broken = evaluation.checks.filter((c) => !c.ok);
    return {
      verdict: 'unsafe',
      title: 'Óptimo para tu modelo… pero no para la realidad',
      evaluation,
      messages: [
        'El solver encontró la mejor solución **de tu modelo**, pero al aplicarla en la planta se rompen reglas que el modelo no captura:',
        ...broken.map((c) => `**${c.label}** (${c.value}, límite ${c.limit}): ${c.failMessage ?? ''}`),
        ...extra,
      ],
    };
  }

  if (optimum !== undefined && gap(evaluation.objective, optimum) > 1e-3) {
    return {
      verdict: 'suboptimal',
      title: 'Solución válida, pero se puede mejorar',
      evaluation,
      messages: [
        'La decisión cumple todas las reglas, pero no es la mejor posible. Tu modelo probablemente tiene una restricción **más estricta** de lo necesario, o un objetivo distinto del real.',
        ...extra,
      ],
    };
  }

  return {
    verdict: 'perfect',
    title: '¡Óptimo!',
    evaluation,
    messages: ['Tu modelo captura el problema y el solver encontró la mejor decisión posible.', ...extra],
  };
}
