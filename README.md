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
   inválido en la realidad", subóptimo) y análisis de sensibilidad (holguras, precios sombra y
   costos reducidos). Provisoriamente hay un botón "Ver modelo correcto" que carga el modelo de
   referencia en el modelador; se apaga con `FEATURES.showSolutionButton` en `src/config.ts`.

## Estructura

```
src/
  engine/                 Lógica pura, sin UI (testeable en Node)
    model.ts              Tipos LPModel/Constraint + serialización a formato CPLEX LP
    solver.ts             Wrapper de HiGHS (wasm): solve(model) → status, valores, precios sombra
    diagnose.ts           Traduce el resultado del solver a feedback pedagógico
    score.ts              Estrellas y distancia al óptimo
    geometry.ts           Región factible 2D (método gráfico)
    indexed.ts            Modelos con índices (conjuntos, parámetros, familias) → expansión a LPModel
  levels/
    types.ts              Contrato `Level`: historia, teoría, variables, modelo de referencia, mundo, escena
    index.ts              Registro de niveles
    planta-agua/          Nivel 1: PL con 2 variables, método gráfico, restricción de mezcla
      data.ts             Todos los números del nivel
      index.ts            Definición: textos, modelo de referencia, evaluate() del mundo, pistas
      Scene.tsx           Escena isométrica
    campana-marketing/    Nivel 2: PL con 4 variables, precios sombra y costos reducidos
    transporte-lacteos/   Nivel 3: problema de transporte, modelado con índices
    escuela-aulas/        Nivel 4: asignación con variables binarias, relajación lineal vs. MIP
  config.ts               Funcionalidades en prueba (p. ej. botón "Ver modelo correcto")
  scene/IsoCanvas.tsx     Lienzo Three.js isométrico reutilizable + primitivas (box, cylinder, pipe)
  scene/thumbnail.ts      Render único de una escena a imagen (miniaturas del menú)
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

1. Crear `src/levels/<id>/` con `data.ts`, `index.ts` (un objeto `Level`) y `Scene.ts` (un `SceneSpec`
   con la función `create`; se usa en el juego y para la miniatura del menú).
2. Registrarlo en `src/levels/index.ts`.
3. Agregar `tests/<id>.test.ts` que verifique el óptimo de referencia y que `evaluate` coincida con él.

Si el problema tiene estructura repetida (orígenes × destinos, cursos × aulas…), definí `indexed`
en el nivel: conjuntos, parámetros y familias de variables. El jugador modela con "para cada" y
sumatorias, y `compileIndexed` lo expande al modelo plano. Ver el nivel 3.

En niveles con índices, el tipo de cada familia de variables (continua, entera o binaria) lo elige
el jugador en el modelador (`IndexedDraft.varTypes`); HiGHS resuelve MIP con branch and cut.

## Próximos pasos posibles

- Más niveles (ver el mapa en la pantalla de inicio).
- Modo "código": escribir el modelo en formato LP o en Python (PuLP vía Pyodide).
- Guardar el progreso (estrellas por nivel).
- Resolver en un Web Worker para modelos grandes.
