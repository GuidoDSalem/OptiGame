# OptiGame

Juego educativo de **optimización matemática**. Sos un consultor: cada nivel es un cliente distinto
(una planta potabilizadora, una escuela, una minera…) con un problema real. Lo modelás y lo resolvés
con un **solver de verdad** ([HiGHS](https://highs.dev/) compilado a WebAssembly, corre en el navegador).

## Cómo correrlo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests del motor y de los niveles (usan el solver real)
npm run build      # build estático en dist/
```

## Ciclo de cada nivel

1. **Situación**: la historia, los datos y la escena 2.5D.
2. **Intento manual**: el jugador prueba con sliders, sin fórmulas. El "mundo" le dice qué reglas rompe.
3. **Teoría**: la clase, con fórmulas (KaTeX) y, si hay 2 variables, el método gráfico interactivo.
4. **Modelado**: arma función objetivo y restricciones. Se ve en notación matemática y en formato LP.
5. **Resultado**: HiGHS resuelve el modelo del jugador. La solución se prueba contra el mundo real y
   se compara con el óptimo. Hay diagnóstico (infactible, no acotado, "óptimo de tu modelo pero
   inválido en la realidad", subóptimo) y análisis de sensibilidad (holguras y precios sombra).

## Estructura

```
src/
  engine/                 Lógica pura, sin UI (testeable en Node)
    model.ts              Tipos LPModel/Constraint + serialización a formato CPLEX LP
    solver.ts             Wrapper de HiGHS (wasm): solve(model) → status, valores, precios sombra
    diagnose.ts           Traduce el resultado del solver a feedback pedagógico
    score.ts              Estrellas y distancia al óptimo
    geometry.ts           Región factible 2D (método gráfico)
  levels/
    types.ts              Contrato `Level`: historia, teoría, variables, modelo de referencia, mundo, escena
    index.ts              Registro de niveles
    planta-agua/          Nivel 1
      data.ts             Todos los números del nivel
      index.ts            Definición: textos, modelo de referencia, evaluate() del mundo, pistas
      Scene.tsx           Escena isométrica
  scene/IsoCanvas.tsx     Lienzo Three.js isométrico reutilizable + primitivas (box, cylinder, pipe)
  ui/
    LevelView.tsx         Orquesta las 5 fases
    phases/               Briefing, Manual, Theory, Modeler, Results (+ draft.ts: estado del modelador)
    components/           Tex, Rich (texto con **negrita** y $LaTeX$), FeasiblePlot, Checks, ModelTex
tests/                    Vitest
```

### Idea clave: modelo ≠ mundo

Cada nivel define dos cosas separadas:

- `referenceModel`: el modelo correcto, que se usa para calcular el óptimo.
- `evaluate(values)`: el **mundo real**, código que simula qué pasa con una decisión (salinidad,
  stock, demanda…).

La solución del jugador siempre se prueba contra el mundo, no contra su propio modelo. Así el juego
puede decir "tu modelo es coherente, pero te olvidaste de la salinidad y el agua sale salada".

## Agregar un nivel

1. Crear `src/levels/<id>/` con `data.ts`, `index.ts` (un objeto `Level`) y `Scene.tsx`.
2. Registrarlo en `src/levels/index.ts`.
3. Agregar `tests/<id>.test.ts` que verifique el óptimo de referencia y que `evaluate` coincida con él.

Si el nivel necesita variables enteras o binarias (asignación, scheduling), `VariableSpec` ya soporta
`integer: true` y HiGHS resuelve MIP.

## Próximos pasos posibles

- Más niveles (ver el mapa en la pantalla de inicio).
- Modelador con más variables: tablas indexadas (`x[i,j]`) para transporte y asignación.
- Modo "código": escribir el modelo en formato LP o en Python (PuLP vía Pyodide).
- Guardar el progreso (estrellas por nivel).
- Resolver en un Web Worker para modelos grandes.
