import type { Level } from '../../levels/types';
import { Content } from '../components/Rich';

export function Briefing({ level, onNext }: { level: Level; onNext(): void }) {
  const zero = Object.fromEntries(level.variables.map((v) => [v.id, 0]));
  return (
    <div className="two-col">
      <div>
        <Content blocks={level.briefing} />
        <button className="primary" onClick={onNext}>
          Intentarlo a mano →
        </button>
      </div>
      <div className="sticky">
        <level.Scene values={zero} evaluation={level.evaluate(zero)} />
      </div>
    </div>
  );
}
