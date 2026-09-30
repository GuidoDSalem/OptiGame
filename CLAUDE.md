# OptiGame

Juego educativo de optimización (Vite + React + TypeScript + Three.js + HiGHS-wasm + KaTeX). Todo el texto del juego está en español rioplatense.

- `npm test` corre vitest con el solver real; `npm run typecheck` y `npm run build` deben pasar antes de commitear.
- `src/engine/` no importa nada de React: es lógica pura y testeable en Node.
- Cada nivel separa `referenceModel` (modelo correcto) de `evaluate()` (el mundo). Los números de un nivel viven sólo en su `data.ts`.
- En strings de LaTeX dentro de template literals hay que escapar la barra: `\\leq`, `\\;`. Ojo: al escribir archivos con heredocs de bash, `\\;` puede quedar como `\;`; verificar después.
- Niveles con estructura repetida usan `indexed` (ver `src/engine/indexed.ts` y el nivel 3); `referenceModel` se obtiene con `compileIndexed`.
- Las restricciones indexadas son listas de términos (`term(var, coef, sign, lag)`); el desfase sólo aplica a conjuntos `ordered`.
- Un término puede fijar un elemento en vez de sumar (`termAt('y', { P: 'hosp' })`); en el modelador se habilita con `indexed.pickItems`.
- `Level.resultsExtra` agrega un panel al resultado (p. ej. la frontera de Pareto del nivel 7).
- `Level.lazyCuts` permite cortes a demanda (el jugador los agrega desde el resultado); `Level.manualComponent` reemplaza los controles del intento manual.
- Los niveles de "Técnicas avanzadas" llevan `seccion: 'avanzada'` y `codigo` (A1…A5); el menú los muestra aparte.
- Un coeficiente puede tener índices del "para cada" que la variable no tiene (`a_{ip}·x_p` para cada `i`, ver A2).
- Un término puede llevar dos coeficientes (`termProd('x', 'p', 't')` = p_s·t_dc·x); en el modelador se habilita con `indexed.twoCoefs` (ver A4).
- Una familia de variables puede descartar combinaciones de índices con `valida` (p. ej. tramos con i ≤ j, ver A6).
- Los casos de estudio (`src/casos/`, códigos C1…) son páginas largas, no `Level`: se registran en `CASOS`. Su análisis es una función pura (testeable) que la página corre en un Web Worker; los números viven en su `ciudad.ts`/datos y la simulación usa semillas fijas. Los datos reales crudos no se suben: un script en `scripts/` los resume a un JSON chico (ver C2).
- Niveles con varias versiones usan una plantilla (ver `src/levels/asignacion/`); cada versión nueva tiene que pasar los tests pedagógicos genéricos.
- Las escenas son `SceneSpec` (`create` + `viewSize`) para poder renderizarlas también como miniatura.
- Estilo visual minimalista: paleta en `src/styles.css` (`:root`) y `PALETTE` en `src/scene/IsoCanvas.tsx`.
