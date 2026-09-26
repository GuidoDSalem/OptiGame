import { Fragment, type ReactNode } from 'react';
import type { ContentBlock } from '../../levels/types';
import { Tex } from './Tex';

/** Texto con **negrita** y LaTeX en línea entre $...$. */
export function Rich({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const re = /\$([^$]+)\$|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    out.push(m[1] !== undefined ? <Tex key={k++} tex={m[1]} /> : <strong key={k++}>{m[2]}</strong>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return <>{out}</>;
}

export function Content({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="content">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h':
            return <h3 key={i}>{b.text}</h3>;
          case 'p':
            return (
              <p key={i}>
                <Rich text={b.text} />
              </p>
            );
          case 'tex':
            return <Tex key={i} tex={b.tex} block />;
          case 'note':
            return (
              <p key={i} className="note">
                <Rich text={b.text} />
              </p>
            );
          case 'list':
            return (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Rich text={it} />
                  </li>
                ))}
              </ul>
            );
          case 'table':
            return (
              <table key={i} className="data">
                <thead>
                  <tr>
                    {b.head.map((h, j) => (
                      <th key={j}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j}>
                      {r.map((c, l) => (
                        <td key={l}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
        }
      })}
    </div>
  );
}
