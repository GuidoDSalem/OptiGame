import type { LPModel } from '../../engine/model';
import { improves } from '../../engine/sensitivity';
import type { SolveResult } from '../../engine/solver';
import type { Level } from '../../levels/types';

const num = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });

/** Explicación de cómo leer el precio sombra, con un ejemplo tomado de la solución actual. */
export function ShadowPriceHelp({ level, model, result }: { level: Level; model: LPModel; result: SolveResult }) {
  const obj = level.objective.label.replace(/\s*\(.*\)/, '').toLowerCase();
  const u = level.objective.unit;
  const sense = model.sense;

  // Ejemplo: la restricción con el precio sombra más grande (en valor absoluto).
  const ex = result.rows
    .map((r, i) => ({ r, c: model.constraints[i] }))
    .filter(({ r }) => r.dual !== undefined && Math.abs(r.dual) > 1e-9)
    .sort((a, b) => Math.abs(b.r.dual!) - Math.abs(a.r.dual!))[0];

  return (
    <>
      <p>
        El <strong>precio sombra</strong> de una restricción dice cuánto cambiaría el objetivo ({obj}) si su{' '}
        <strong>lado derecho aumentara en 1</strong>, dejando todo lo demás igual. Es el "valor marginal" de
        ese límite.
      </p>

      {ex && result.objective !== undefined && (
        <p className="example">
          <strong>En tu solución:</strong> si <em>{ex.r.name}</em> pasara de {num(ex.c.rhs)} a {num(ex.c.rhs + 1)}, el{' '}
          {obj} pasaría de {u}
          {num(result.objective)} a aproximadamente {u}
          {num(result.objective + ex.r.dual!)} ({ex.r.dual! > 0 ? '+' : ''}
          {num(ex.r.dual!)}). Eso es {improves(sense, ex.r.dual!) ? 'bueno' : 'malo'} para el cliente, porque estás{' '}
          {sense === 'min' ? 'minimizando' : 'maximizando'}.
        </p>
      )}

      <h5>Cómo leerlo</h5>
      <ul>
        <li>
          <strong>El signo</strong> dice hacia dónde se mueve el objetivo. Positivo: sube. Negativo: baja. Si
          minimizás un costo, que suba es malo; si maximizás, es bueno.
        </li>
        <li>
          <strong>En una restricción ≤ de recurso</strong> (presupuesto, capacidad, stock), subir el lado derecho es
          tener <em>más</em> recurso. El precio sombra es lo máximo que convendría pagar por una unidad extra.
        </li>
        <li>
          <strong>En una restricción ≥ de requisito</strong> (demanda, mínimo de cobertura), subir el lado derecho es{' '}
          <em>exigir más</em>. El precio sombra es lo que cuesta ese requisito extra.
        </li>
        <li>
          <strong>Si tiene holgura, vale 0.</strong> Sobra recurso: conseguir más no cambia nada. Sólo las
          restricciones <strong>activas</strong> (los cuellos de botella) tienen precio sombra distinto de 0.
        </li>
        <li>
          <strong>Vale para cambios chicos.</strong> Si movés mucho un límite, el óptimo salta a otro vértice y el
          precio sombra cambia. Por eso es una tasa, no una promesa.
        </li>
      </ul>
      <p className="muted">
        Probalo: el botón <strong>+1</strong> de cada fila vuelve a resolver el modelo con ese límite aumentado en una
        unidad y muestra el cambio real.
      </p>
    </>
  );
}

export function ReducedCostHelp({ level }: { level: Level }) {
  const obj = level.objective.label.replace(/\s*\(.*\)/, '').toLowerCase();
  return (
    <>
      <p>
        El <strong>costo reducido</strong> es el "precio sombra" de una variable. Dice cuánto cambiaría el {obj} si
        obligaras a esa variable a valer 1 unidad más.
      </p>
      <ul>
        <li>
          Las variables que el solver <strong>usa</strong> (valor &gt; 0) tienen costo reducido 0: ya están en su
          punto justo.
        </li>
        <li>
          Una variable que quedó en <strong>0</strong> con costo reducido distinto de 0 no conviene. El número dice
          cuánto se perdería por cada unidad forzada.
        </li>
        <li>
          También indica <strong>cuánto tendría que mejorar</strong> su coeficiente en el objetivo para empezar a
          convenir. Por ejemplo, cuánto más barata tendría que ser una ruta o cuánto más alcance tendría que dar un
          canal.
        </li>
      </ul>
    </>
  );
}
