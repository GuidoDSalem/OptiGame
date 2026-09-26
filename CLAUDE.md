# OptiGame

Juego educativo de optimización (Vite + React + TypeScript + Three.js + HiGHS-wasm + KaTeX). Todo el texto del juego está en español rioplatense.

- `npm test` corre vitest con el solver real; `npm run typecheck` y `npm run build` deben pasar antes de commitear.
- `src/engine/` no importa nada de React: es lógica pura y testeable en Node.
- Cada nivel separa `referenceModel` (modelo correcto) de `evaluate()` (el mundo). Los números de un nivel viven sólo en su `data.ts`.
- En strings de LaTeX dentro de template literals hay que escapar la barra: `\\leq`, `\\;`. Ojo: al escribir archivos con heredocs de bash, `\\;` puede quedar como `\;`; verificar después.
- Niveles con estructura repetida usan `indexed` (ver `src/engine/indexed.ts` y el nivel 3); `referenceModel` se obtiene con `compileIndexed`.
- Niveles con varias versiones usan una plantilla (ver `src/levels/asignacion/`); cada versión nueva tiene que pasar los tests pedagógicos genéricos.
- Las escenas son `SceneSpec` (`create` + `viewSize`) para poder renderizarlas también como miniatura.
- Estilo visual minimalista: paleta en `src/styles.css` (`:root`) y `PALETTE` en `src/scene/IsoCanvas.tsx`.
