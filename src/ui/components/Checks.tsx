import type { Evaluation } from '../../levels/types';

export function Checks({ evaluation, showFailures = true }: { evaluation: Evaluation; showFailures?: boolean }) {
  return (
    <div className="checks">
      {evaluation.checks.map((c) => (
        <div key={c.label} className={`check ${c.ok ? 'ok' : 'fail'}`}>
          <span className="dot" />
          <span className="check-label">{c.label}</span>
          <span className="check-value">{c.value}</span>
          <span className="check-limit">{c.limit}</span>
          {!c.ok && showFailures && c.failMessage && <span className="check-msg">{c.failMessage}</span>}
        </div>
      ))}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <span className="stars" aria-label={`${n} de 3 estrellas`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}
