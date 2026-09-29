import { costoPorAnio, type Evaluacion, type Medidas, type Sensibilidad } from '../../engine/estocastico';
import { fmt } from './EstocasticoPanel';
import type { VarianteEstocastica } from './template';

const pct = (p: number) => `${Math.round(p * 100)}%`;
/** Porcentaje con un decimal, para umbrales. */
const pct1 = (p: number) => `${(Math.round(p * 1000) / 10).toLocaleString('es-AR')}%`;
const mismo = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

interface Props {
  v: VarianteEstocastica;
  m: Medidas;
  sens: Sensibilidad;
}

/** Cierre del nivel: qué significa el plan estocástico, cómo se lee y cómo se usa. */
export function ConclusionEstocastico({ v, m, sens }: Props) {
  const planta = (id: string) => v.plantas.find((d) => d.id === id)!;
  const lista = (ids: string[]) => ids.map((id) => planta(id).label.replace(/^Planta /, '')).join(', ') || 'ninguna';
  const esc = (id: string) => v.escenarios.find((s) => s.id === id)!;
  const { rp, eev, peor } = m;
  const U = v.unidad;
  const $ = v.moneda;

  const anios = costoPorAnio(rp);
  const peorAnio = (e: Evaluacion) => Math.max(...costoPorAnio(e));
  const conSilo = rp.escenarios.filter((r) => r.faltante > 1e-6);
  const propio = m.wsPlanes.some((w) => mismo(w.abiertos, rp.abiertos));
  const nuncaSolas = rp.abiertos.filter((d) => m.wsPlanes.every((w) => !w.abiertos.includes(d)));

  const exigente = esc(sens.escenario);
  const rango = sens;
  // A menos de dos puntos de un umbral, la recomendación está en el borde.
  const enElBorde = (rango.despues && rango.hasta - rango.base < 0.02) || (rango.antes && rango.base - rango.desde < 0.02);

  return (
    <div className="conclusion">
      <h4>Conclusión: qué significa el resultado y cómo usarlo</h4>

      <h5>1. Lo único que se decide hoy</h5>
      <p>
        La recomendación es <strong>alquilar {lista(rp.abiertos)}</strong> ({$} {fmt(rp.fijo)} de costo fijo). Eso es
        todo lo que el modelo manda a firmar. Los repartos de cada escenario no son órdenes: son un{' '}
        <strong>plan de contingencia</strong> que muestra cómo se aprovecharían esas plantas. Cuando se conozca la
        cosecha real, que casi nunca va a coincidir con un escenario, se resuelve de nuevo el reparto con los números
        verdaderos: es un transporte común, como el del nivel 3.
      </p>

      <h5>2. {$} {fmt(rp.total)} es un promedio, no un presupuesto</h5>
      <p>
        Ningún año cuesta {fmt(rp.total)}. Es lo que cuesta <em>en promedio</em>, ponderando cada año por su
        probabilidad. Lo que va a pasar es uno de estos:
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Si el año es…</th>
            <th className="r">Prob.</th>
            <th className="r">Silo bolsa</th>
            <th className="r">Costo del año</th>
          </tr>
        </thead>
        <tbody>
          {rp.escenarios.map((r, k) => (
            <tr key={r.escenario}>
              <td>{esc(r.escenario).label}</td>
              <td className="r">{pct(esc(r.escenario).prob)}</td>
              <td className="r">{r.faltante > 1e-6 ? `${fmt(r.faltante)} ${U}` : '—'}</td>
              <td className="r">
                <strong>{fmt(anios[k])}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Por eso la caja tiene que prepararse para el rango, de {fmt(Math.min(...anios))} a {fmt(Math.max(...anios))}, y
        no para el promedio.
        {conSilo.length > 0 &&
          ` En el escenario ${conSilo.map((r) => `«${esc(r.escenario).label}»`).join(' y ')} el plan acepta a propósito guardar ${conSilo.map((r) => `${fmt(r.faltante)} ${U}`).join(' y ')} en silo bolsa: sale más barato que alquilar otra planta que sólo haría falta ese año. Conviene tener apalabrado ese silo bolsa de antemano.`}
      </p>

      <h5>3. Es una cobertura, no una apuesta</h5>
      <p>
        {propio
          ? 'El plan coincide con el mejor de uno de los años, pero se eligió mirando todos a la vez.'
          : 'Si se supiera cómo viene el año, ninguno elegiría este plan:'}
      </p>
      <ul>
        {m.wsPlanes.map((w) => (
          <li key={w.escenario}>
            {esc(w.escenario).label}: alquilar {lista(w.abiertos)} (costaría {fmt(w.total)}).
          </li>
        ))}
      </ul>
      <p>
        {nuncaSolas.length > 0 && (
          <>
            {lista(nuncaSolas)} no {nuncaSolas.length === 1 ? 'aparece' : 'aparecen'} en ninguno de esos planes y sin
            embargo {nuncaSolas.length === 1 ? 'está' : 'están'} en la recomendación: es lo que hace que el plan funcione
            razonablemente bien en todos los años.{' '}
          </>
        )}
        Frente a planificar para el año promedio (alquilar {lista(eev.abiertos)}), ahorra{' '}
        <strong>
          {$} {fmt(m.vss)}
        </strong>{' '}
        por campaña en promedio
        {peorAnio(eev) > peorAnio(rp) + 1e-6
          ? `, y en el peor año la diferencia es todavía mayor: ${fmt(peorAnio(eev))} contra ${fmt(peorAnio(rp))}.`
          : '.'}
      </p>

      <h5>4. Promedio contra riesgo</h5>
      <p>
        El modelo minimiza el costo <strong>promedio</strong>. Si un año de {fmt(peorAnio(rp))} es más de lo que la
        cooperativa puede aguantar, hay que mirar también el peor caso:
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Plan</th>
            <th className="r">Promedio</th>
            <th className="r">Peor año</th>
          </tr>
        </thead>
        <tbody>
          {[
            { n: 'Estocástico (recomendado)', e: rp, on: true },
            { n: 'Para el año promedio', e: eev, on: false },
            { n: 'Para el peor año', e: peor, on: false },
          ].map(({ n, e, on }) => (
            <tr key={n} className={on ? 'active' : ''}>
              <td>
                {n} <span className="muted small">({lista(e.abiertos)})</span>
              </td>
              <td className="r">{fmt(e.total)}</td>
              <td className="r">{fmt(peorAnio(e))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {peorAnio(peor) < peorAnio(rp) - 1e-6 && (
        <p>
          Pagando {fmt(peor.total - rp.total)} más por campaña en promedio, el peor año baja de {fmt(peorAnio(rp))} a{' '}
          {fmt(peorAnio(peor))}. Es como un seguro: la matemática dice cuánto cuesta y la cooperativa decide si lo
          quiere. Hay modelos que incorporan esa aversión al riesgo (por ejemplo, minimizar el promedio de los peores
          casos), pero la decisión de cuánto riesgo tolerar no la toma el solver.
        </p>
      )}

      <h5>5. Cuánto vale saber más</h5>
      <p>
        Si se conociera el clima antes de alquilar, en promedio se ahorrarían{' '}
        <strong>
          {$} {fmt(m.evpi)}
        </strong>{' '}
        por campaña. Es el techo de lo que vale un pronóstico: uno perfecto no puede valer más que eso, y uno real vale
        menos. Además, sólo sirve si llega <strong>antes</strong> de firmar los alquileres.
      </p>

      <h5>6. Cuándo revisar la decisión</h5>
      <p>
        El resultado depende de las probabilidades, que son estimaciones. Con estos datos, la recomendación se mantiene
        mientras la probabilidad de {exigente.label.toLowerCase()} esté entre{' '}
        <strong>
          {pct1(rango.desde)} y {pct1(rango.hasta)}
        </strong>{' '}
        (hoy es {pct(exigente.prob)}).
        {rango.antes && ` Si bajara de ${pct1(rango.desde)}, convendría ${lista(rango.antes)}.`}
        {rango.despues && ` Si pasara de ${pct1(rango.hasta)}, convendría ${lista(rango.despues)}.`}{' '}
        {enElBorde
          ? `La estimación actual está muy cerca del borde: con menos de dos puntos de diferencia la recomendación cambia. Del lado bueno: en el umbral los dos planes cuestan lo mismo en promedio, así que equivocarse por poco sale barato. Aun así, antes de firmar vale la pena revisar bien esa probabilidad (con datos históricos o un pronóstico estacional) y mirar también el riesgo del punto 4.`
          : rango.hasta - rango.desde < 0.15 + 1e-9
            ? 'Es un margen chico: vale la pena revisar bien esa probabilidad (con datos históricos o un pronóstico estacional) antes de firmar.'
            : 'Es un margen amplio: la decisión no depende de afinar mucho esa probabilidad.'}
      </p>

      <h5>7. Lo que el modelo no sabe</h5>
      <ul>
        <li>
          Sólo conoce {v.escenarios.length} escenarios. La realidad es continua; con más escenarios (años históricos o
          simulados) la recomendación es más confiable, y ahí es donde Benders se vuelve necesario.
        </li>
        <li>Supone fletes, alquileres y costo del silo bolsa fijos. Si cambian, hay que volver a correrlo.</li>
        <li>Mira una sola campaña. Si los alquileres fueran por varios años, el modelo tendría que ser de varias etapas.</li>
      </ul>
    </div>
  );
}
