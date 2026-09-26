# OptiGame

Juego educativo de optimización (Vite + React + TypeScript + Three.js + HiGHS-wasm + KaTeX). Todo el texto del juego está en español rioplatense.

- `npm test` corre vitest con el solver real; `npm run typecheck` y `npm run build` deben pasar antes de commitear.
- `src/engine/` no importa nada de React: es lógica pura y testeable en Node.
- Cada nivel separa `referenceModel` (modelo correcto) de `evaluate()` (el mundo). Los números de un nivel viven sólo en su `data.ts`.
- En strings de LaTeX dentro de template literals hay que escapar la barra: `\\leq`, `\;`.
- Estilo visual minimalista: paleta en `src/styles.css` (`:root`) y `PALETTE` en `src/scene/IsoCanvas.tsx`.
