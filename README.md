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
    routing.ts            Ruteo: circuitos, heurísticas, cortes de subtour, formulación MTZ
    indexed.ts            Modelos con índices: conjuntos (ordenados o no), parámetros, familias de
                          variables y restricciones como sumas de términos (con desfase t−1) → LPModel
  levels/
    types.ts              Contrato `Level`: historia, teoría, variables, modelo de referencia, mundo, escena
    index.ts              Registro de niveles
    planta-agua/          Nivel 1: PL con 2 variables, método gráfico, restricción de mezcla
      data.ts             Todos los números del nivel
      index.ts            Definición: textos, modelo de referencia, evaluate() del mundo, pistas
      Scene.tsx           Escena isométrica
    campana-marketing/    Nivel 2: PL con 4 variables, precios sombra y costos reducidos
    transporte-lacteos/   Nivel 3: problema de transporte, modelado con índices
    asignacion/           Nivel 4 como PLANTILLA: asignación con binarias, relajación vs. MIP
      template.ts         crearNivelAsignacion(variante): modelo, teoría, pistas y mundo
      Scene.ts            Escena genérica (estilos "aula", "quirofano", "rack")
      escuela.ts          Variante: cursos → aulas
      hospital.ts         Variante: cirugías → quirófanos (compatibilidad por nivel de complejidad)
      datacenter.ts       Variante: trabajos nocturnos → servidores (RAM y ventana horaria)
    planificacion/        Nivel 5 como PLANTILLA: multi-período con costos fijos (lot sizing)
      template.ts         crearNivelPlanificacion(variante): balance de stock, activación big-M
      Scene.ts            Escena de línea de tiempo (envío / stock / demanda), estilos "minera" e "hidro"
      minera.ts           Variante: mina → tren → puerto → barcos
      hidro.ts            Variante: central de bombeo (bombear barato, entregar en el pico)
    ruteo/                Nivel 6 como PLANTILLA: TSP con subtours y cortes a demanda
      template.ts         crearNivelRuteo(variante): modelo base, teoría, mundo, cortes (lazyCuts)
      RouteBuilder.tsx    Intento manual: armar la ruta + heurísticas (vecino más cercano, 2-opt)
      Scene.ts            Ciudad en grilla con la ruta por las calles
      reparto.ts          Variante: panadería que reparte a comercios del barrio
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

## Versiones de un nivel (plantillas)

Un nivel puede tener varias **versiones**: misma técnica, teoría y modelo, distinta situación. El
nivel 4 es el ejemplo: `crearNivelAsignacion(variante)` arma todo a partir de datos + vocabulario
(`"curso"/"aula"`, `"cirugía"/"quirófano"`) + historia + estilo de escena. En el menú, los niveles
con el mismo `number` se agrupan en una tarjeta con botones para elegir la versión.

Para agregar una versión: crear `src/levels/asignacion/<nueva>.ts` y sumarla a
`VARIANTES_ASIGNACION`. El test `tests/asignacion.test.ts` corre sobre todas las versiones y
verifica que conserven las trampas pedagógicas (la relajación "parte" ítems, sacar cada
restricción rompe algo en el mundo real, la estrategia "a ojo" no es óptima). Si los datos nuevos
no pasan ese test, la versión no enseña lo mismo.

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
