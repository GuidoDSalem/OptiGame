import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe('LaTeX en el código', () => {
  // En un string de JS, una barra sola antes de ";" se pierde y KaTeX muestra un ";" suelto.
  // Hay que escribir la barra doble.
  it('no hay espacios LaTeX sin escapar', () => {
    const bad = files('src').flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ f, i: i + 1, line }))
        .filter(({ line }) => /(^|[^\\])\\;/.test(line)),
    );
    expect(bad.map(({ f, i }) => `${f}:${i}`)).toEqual([]);
  });
});
