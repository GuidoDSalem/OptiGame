import type { Evaluation, Level } from '../levels/types';
import { IsoCanvas } from './IsoCanvas';

export function LevelScene({
  level,
  values,
  evaluation,
}: {
  level: Level;
  values: Record<string, number>;
  evaluation: Evaluation;
}) {
  return (
    <IsoCanvas
      key={level.id}
      create={level.scene.create}
      params={{ values, evaluation }}
      viewSize={level.scene.viewSize}
    />
  );
}
