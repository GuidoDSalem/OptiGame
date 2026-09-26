import { useEffect, useMemo, useState } from 'react';
import {
  basesDe,
  costoFijo,
  nombrePlan,
  puntosDelDia,
  resolverDia,
  simularDias,
  totalLlamadas,
  type Plan,
} from '../../engine/ambulancias';
import { Tex } from '../../ui/components/Tex';
import type { Analisis } from './analisis';
import { CIUDAD as C, OPCIONES } from './ciudad';
import {
  BarraProgreso,
  BarrasFrecuencia,
  CurvaTamanos,
  Dispersion,
  HistogramasCosto,
  Leyenda,
  PilaDeDias,
  fmt,
  tipoDia,
} from './graficos';
import { Mapa } from './Mapa';
import { useAnalisis } from './useAnalisis';
import { useEnVista } from './useEnVista';

const LEYENDA_DIAS = [
  { clase: 'normal', texto: 'día común' },
  { clase: 'critico', texto: 'día crítico (calor, fin de semana largo)' },
  { clase: 'evento', texto: 'evento en un barrio (recital, partido)' },
];

const incluye = (p: Plan, i: number) => !!(p & (1 << i));

/** Caso de estudio C1: una página que se lee scrolleando. */
export function CasoAmbulancias({ onExit }: { onExit(): void }) {
  const dias = useMemo(() => simularDias(C, OPCIONES.muestra, OPCIONES.semillaMuestra), []);
  const estado = useAnalisis();
  const a = estado.tipo === 'listo' ? estado.datos : null;

  return (
    <article className="caso">
      <button className="link volver" onClick={onExit}>
        ← Volver al menú
      </button>
      <Portada dias={dias} />
      <Situacion />
      <UnDia dias={dias} />
      <MuchosDias dias={dias} />
      {!a && estado.tipo === 'progreso' && (
        <section className="paso">
          <BarraProgreso
            hecho={estado.hecho}
            total={estado.total}
            texto={
              estado.fase === 'muestra'
                ? `Resolviendo cada día con cada combinación de bases: ${fmt(estado.hecho)} de ${fmt(estado.total)}…`
                : `Probando los planes en ${fmt(OPCIONES.validacion)} días nuevos…`
            }
          />
        </section>
      )}
      {a && (
        <>
          <UnoAUno dias={dias} a={a} />
          <Tentacion a={a} />
          <Saa a={a} />
          <Validacion a={a} />
          <Tamanos a={a} />
          <Decision a={a} />
          <ParaSeguir onExit={onExit} />
        </>
      )}
    </article>
  );
}

function Seccion({ n, titulo, children, className = '' }: { n?: number; titulo?: string; children: React.ReactNode; className?: string }) {
  const [ref, visto] = useEnVista<HTMLElement>();
  return (
    <section ref={ref} className={`paso ${visto ? 'visto' : ''} ${className}`}>
      {titulo && (
        <h2>
          {n !== undefined && <span className="num">{n}</span>}
          {titulo}
        </h2>
      )}
      {children}
    </section>
  );
}

/* ---------- 0. Portada ---------- */

function Portada({ dias }: { dias: ReturnType<typeof simularDias> }) {
  const d = dias[0];
  const puntos = useMemo(() => puntosDelDia(C, d, 1), [d]);
  return (
    <header className="portada">
      <span className="eyebrow">Caso de estudio · C1 · Montecarlo y optimización</span>
      <h1>Ambulancias para una ciudad que no avisa</h1>
      <p className="lead">
        Cada punto rojo es una llamada al servicio de emergencias en un día cualquiera. Mañana van a ser otras, en
        otros lugares, y no sabemos cuántas. ¿Dónde conviene tener las ambulancias?
      </p>
      <Mapa C={C} puntos={puntos} animar duracion={2.4} etiquetasBarrios />
      <p className="caption">Scrolleá: la historia se arma de a poco.</p>
    </header>
  );
}

/* ---------- 1. La situación ---------- */

function Situacion() {
  return (
    <Seccion n={1} titulo="La situación">
      <p>
        El <strong>Servicio de Emergencias Municipal</strong> tiene que decidir qué <strong>bases</strong> va a operar
        durante el año que viene. Hay {C.bases.length} lugares posibles. Cada base cuesta todos los días (personal,
        alquiler, ambulancias) y sus ambulancias pueden cubrir una cantidad limitada de salidas por día.
      </p>
      <div className="dos-columnas">
        <Mapa C={C} plan={(1 << C.bases.length) - 1} etiquetasBases />
        <table className="data">
          <thead>
            <tr>
              <th>Base candidata</th>
              <th className="r">Costo/día ($k)</th>
              <th className="r">Salidas/día</th>
            </tr>
          </thead>
          <tbody>
            {C.bases.map((b) => (
              <tr key={b.id}>
                <td>{b.label}</td>
                <td className="r">{b.costoFijo}</td>
                <td className="r">{b.capacidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Cada salida propia cuesta ${C.salida.fijo}k más ${C.salida.porKm}k por kilómetro. Si ninguna base abierta
        puede atender una llamada, se contrata una <strong>ambulancia privada</strong>: ${C.privada.costo}k y{' '}
        {C.privada.minutos} minutos en llegar. Las bases se eligen <strong>una vez</strong>, para todo el año; lo que se
        decide cada día es qué base atiende cada llamada.
      </p>
      <p className="note">
        Es la estructura de los niveles A3 y A4: una decisión fija (qué bases) y una que se adapta a lo que pase (a
        quién mandar). La diferencia es que acá la incertidumbre no son tres escenarios prolijos: son las llamadas de
        un día, y hay que <strong>imaginarlas</strong>.
      </p>
    </Seccion>
  );
}

/* ---------- 2. Un día cualquiera ---------- */

function UnDia({ dias }: { dias: ReturnType<typeof simularDias> }) {
  const [i, setI] = useState(1);
  const d = dias[i];
  const puntos = useMemo(() => puntosDelDia(C, d, 1), [d]);
  const [ref, visto] = useEnVista<HTMLDivElement>();
  const barrio = (id: string | null) => C.barrios.find((b) => b.id === id)?.label ?? '';
  return (
    <Seccion n={2} titulo="Un día cualquiera">
      <p>
        Las llamadas no se pueden predecir una por una, pero sí se sabe cómo se comportan: cada barrio tiene un
        promedio de llamadas por día, y algunos días todo se dispara. Con eso se puede armar un <strong>simulador</strong>{' '}
        que invente días creíbles:
      </p>
      <ul>
        <li>
          Un <strong>factor común</strong> del día, que mueve a toda la ciudad a la vez: hay días más tranquilos y
          días más cargados.
        </li>
        <li>
          <strong>Días críticos</strong> (≈{fmt(C.dias.probCritico * 100)}% de los días: olas de calor, fines de semana
          largos) con {fmt((C.dias.factorCritico - 1) * 100)}% más llamadas en todos lados.
        </li>
        <li>
          <strong>Eventos locales</strong> (≈{fmt(C.dias.probEvento * 100)}% de los días): un recital o un partido suma
          unas {C.dias.extraEvento} llamadas en un barrio.
        </li>
        <li>Y encima de todo, el azar de cada barrio: aunque el promedio sea 8, un día hay 5 y otro 12.</li>
      </ul>
      <div ref={ref} className="dia-simulado">
        <Mapa C={C} puntos={visto ? puntos : []} animar clave={i} etiquetasBarrios />
        <div className="dia-info">
          <p className="big">{totalLlamadas(d)}</p>
          <p className="caption">llamadas el día {d.n + 1}</p>
          <p>
            {d.critico && <span className="tag critico">día crítico</span>}
            {d.evento && <span className="tag evento">evento en {barrio(d.evento)}</span>}
            {!d.critico && !d.evento && <span className="tag">día común</span>}
          </p>
          <button className="primary" onClick={() => setI((i + 1) % dias.length)}>
            Simular otro día
          </button>
        </div>
      </div>
    </Seccion>
  );
}

/* ---------- 3. Muchos días ---------- */

function MuchosDias({ dias }: { dias: ReturnType<typeof simularDias> }) {
  const [ref, visto] = useEnVista<HTMLDivElement>();
  const [visibles, setVisibles] = useState(0);
  // Los días van apareciendo de a poco cuando el gráfico entra en pantalla.
  useEffect(() => {
    if (!visto || visibles >= dias.length) return;
    const t = setTimeout(() => setVisibles((v) => Math.min(dias.length, v + 4)), 30);
    return () => clearTimeout(t);
  }, [visto, visibles, dias.length]);
  const tot = dias.map(totalLlamadas);
  const criticos = dias.filter((d) => d.critico).length;
  const ejemplos = [0, 3, 7, 12, 18, 25].map((k) => dias[k]);
  return (
    <Seccion n={3} titulo={`${dias.length} días posibles`}>
      <p>
        Un día solo no dice mucho. Así que simulamos <strong>{dias.length} días</strong>. Cada punto de abajo es un
        día, apilado según cuántas llamadas tuvo.
      </p>
      <div ref={ref}>
        <PilaDeDias dias={dias} visibles={visibles} />
        <Leyenda items={LEYENDA_DIAS} />
      </div>
      <p>
        Hay días de {Math.min(...tot)} llamadas y días de {Math.max(...tot)}. La mayoría anda cerca de{' '}
        {fmt(tot.reduce((s, t) => s + t, 0) / tot.length)}, pero la cola de la derecha, los {criticos} días críticos,
        es la que va a complicar las cosas.
      </p>
      <div className="mapitas">
        {ejemplos.map((d) => (
          <figure key={d.n}>
            <Mapa C={C} puntos={puntosDelDia(C, d, 1)} compacto />
            <figcaption className={`caption ${tipoDia(d)}`}>
              Día {d.n + 1}: {totalLlamadas(d)}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="dos-columnas">
        <Dispersion dias={dias} a="centro" b="sur" labelA="llamadas en el Centro" labelB="llamadas en Villa Sur" />
        <div>
          <h3>Los barrios se mueven juntos</h3>
          <p>
            Cuando el Centro está cargado, Villa Sur también suele estarlo: el calor y los feriados son para toda la
            ciudad. Es la parte más traicionera de la incertidumbre, porque los barrios <strong>no se compensan</strong>{' '}
            entre sí. Los días malos llegan en todos lados a la vez, justo cuando las bases vecinas tampoco dan
            abasto.
          </p>
        </div>
      </div>
    </Seccion>
  );
}

/* ---------- 4. Uno a uno ---------- */

function elegirEjemplos(dias: ReturnType<typeof simularDias>) {
  const idx = dias.map((_, i) => i);
  const tot = (i: number) => totalLlamadas(dias[i]);
  const comunes = idx.filter((i) => !dias[i].critico && !dias[i].evento).sort((x, y) => tot(x) - tot(y));
  const tranquilo = comunes[0];
  const normal = comunes[Math.floor(comunes.length / 2)];
  const critico = idx.filter((i) => dias[i].critico).sort((x, y) => tot(y) - tot(x))[0];
  const evento = idx.filter((i) => dias[i].evento && !dias[i].critico)[0];
  return [
    { i: tranquilo, titulo: 'Un día tranquilo' },
    { i: normal, titulo: 'Un día normal' },
    { i: evento, titulo: 'Un día con evento' },
    { i: critico, titulo: 'El peor día crítico' },
  ].filter((e) => e.i !== undefined);
}

function UnoAUno({ dias, a }: { dias: ReturnType<typeof simularDias>; a: Analisis }) {
  const ejemplos = useMemo(() => elegirEjemplos(dias), [dias]);
  const [sel, setSel] = useState(ejemplos[ejemplos.length - 1].i);
  const res = useMemo(() => resolverDia(C, a.diarios[sel], dias[sel]), [sel, a, dias]);
  const distintos = new Set(a.diarios).size;
  const nBases = a.diarios.map((p) => basesDe(C, p).length);
  const costoDelDia = (i: number) => costoFijo(C, a.diarios[i]) + resolverDia(C, a.diarios[i], dias[i]).costo;
  return (
    <Seccion n={4} titulo="Resolver cada día por separado">
      <p>
        Primera idea: si supiéramos cómo va a ser el día, elegir las bases sería fácil. Con {C.bases.length} bases hay{' '}
        {1 << C.bases.length} combinaciones posibles; para cada una, repartir las llamadas es un problema de transporte
        como el del nivel 3. La computadora prueba todas y se queda con la más barata. Ya hizo eso para los{' '}
        {dias.length} días: <strong>{fmt(dias.length * (1 << C.bases.length))}</strong> problemas resueltos.
      </p>
      <div className="mapitas cuatro">
        {ejemplos.map((e) => (
          <figure key={e.i} className={sel === e.i ? 'sel' : ''} onClick={() => setSel(e.i)}>
            <Mapa C={C} plan={a.diarios[e.i]} resultado={resolverDia(C, a.diarios[e.i], dias[e.i])} compacto />
            <figcaption>
              <strong>{e.titulo}</strong>
              <span className="caption">
                {totalLlamadas(dias[e.i])} llamadas · {basesDe(C, a.diarios[e.i]).length} bases
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p>
        <strong>Cada día quiere otra cosa.</strong> Los días tranquilos se arreglan con pocas bases grandes; los días
        críticos piden abrir casi todo; un recital en un barrio pide una base cerca de ahí. En los {dias.length} días
        aparecen <strong>{distintos} planes óptimos distintos</strong>, con entre {Math.min(...nBases)} y{' '}
        {Math.max(...nBases)} bases.
      </p>
      <p className="caption">Tocá cualquier día de la pila para ver su plan ideal.</p>
      <PilaDeDias dias={dias} seleccionado={sel} onSelect={setSel} />
      <div className="dos-columnas">
        <Mapa C={C} plan={a.diarios[sel]} resultado={res} puntos={puntosDelDia(C, dias[sel], 1)} etiquetasBases />
        <div>
          <h3>Día {dias[sel].n + 1}</h3>
          <p>
            {totalLlamadas(dias[sel])} llamadas. Plan ideal: <strong>{nombrePlan(C, a.diarios[sel])}</strong>.
          </p>
          <p>
            Costo del día: <strong>${fmt(costoDelDia(sel))}k</strong>
            {res.privadas.some((p) => p > 0) && <> · {fmt(res.privadas.reduce((s, p) => s + p, 0))} llamadas a privadas</>}.
          </p>
          <p className="caption">
            Las líneas muestran qué base atiende a cada barrio (más gruesas, más llamadas). Los círculos rojos son
            llamadas derivadas a privadas.
          </p>
        </div>
      </div>
      <p className="note">
        Pero esto es hacer trampa: el plan de cada día usa información que <strong>no vamos a tener</strong>. Las bases
        se eligen hoy para todo el año: no se puede abrir una base sólo los días que la necesitan.
      </p>
    </Seccion>
  );
}

/* ---------- 5. La tentación ---------- */

function Tentacion({ a }: { a: Analisis }) {
  const perdedoras = C.bases.filter((_, i) => incluye(a.saa.plan, i) && !incluye(a.voto, i));
  return (
    <Seccion n={5} titulo="La tentación: votar">
      <p>
        Si cada día tiene su plan ideal, parece razonable <strong>votar</strong>: quedarse con las bases que aparecen
        en la mayoría de los días. Así quedan las frecuencias:
      </p>
      <BarrasFrecuencia
        items={C.bases.map((b, i) => ({ label: b.label, valor: a.frecuencias[i], enVoto: incluye(a.voto, i) }))}
      />
      <p>
        Plan por votación: <strong>{nombrePlan(C, a.voto)}</strong>.
      </p>
      <p>
        Otra idea igual de tentadora: calcular el <strong>día promedio</strong> (las llamadas promedio de cada barrio) y
        optimizar para ese día. Da: <strong>{nombrePlan(C, a.promedio)}</strong>.
      </p>
      <p>
        Las dos parecen sensatas. Las dos tienen el mismo problema: <strong>nunca miran todos los días a la vez</strong>.
        La votación trata igual un día tranquilo que un día crítico, aunque equivocarse en un día crítico cueste diez
        veces más. El promedio borra justamente los días raros, que son los caros.
        {perdedoras.length > 0 && (
          <>
            {' '}
            Fijate en la <strong>{perdedoras.map((b) => b.label).join(' y la ')}</strong>: aparece en menos de la mitad
            de los días ideales. Guardá ese nombre.
          </>
        )}
      </p>
    </Seccion>
  );
}

/* ---------- 6. SAA ---------- */

function Saa({ a }: { a: Analisis }) {
  const perdedoras = C.bases.filter((_, i) => incluye(a.saa.plan, i) && !incluye(a.voto, i));
  const filas = [
    { id: 'voto', label: 'Por votación', plan: a.voto },
    { id: 'promedio', label: 'Para el día promedio', plan: a.promedio },
    { id: 'saa', label: 'Contra todos los días (SAA)', plan: a.saa.plan },
  ];
  return (
    <Seccion n={6} titulo="Optimizar contra todos los días a la vez">
      <p>
        La forma correcta es una sola optimización que <strong>mire todos los días simulados juntos</strong>: elegir
        las bases que minimizan el costo fijo más el costo <strong>promedio</strong> de atender los {OPCIONES.muestra}{' '}
        días, sabiendo que cada día se va a repartir lo mejor posible con esas bases.
      </p>
      <Tex block tex={'\\min_{\\text{bases}} \\;\\; \\text{costo fijo} \\; + \\; \\frac{1}{N} \\sum_{k=1}^{N} \\text{costo de atender el día } k'} />
      <p>
        Se llama <strong>SAA</strong> (<em>sample average approximation</em>, aproximación por promedio de muestra): se
        reemplaza el futuro desconocido por una muestra simulada. Es el modelo en dos etapas del nivel A4, con{' '}
        {OPCIONES.muestra} escenarios en vez de 3.
      </p>
      <div className="dos-columnas">
        <Mapa C={C} plan={a.saa.plan} resaltar={perdedoras.map((b) => b.id)} etiquetasBases />
        <div>
          <h3>El mejor plan</h3>
          <p>
            <strong>{nombrePlan(C, a.saa.plan)}</strong>.
          </p>
          {perdedoras.length > 0 && (
            <p>
              Ahí está la <strong>{perdedoras.map((b) => b.label).join(' y la ')}</strong>, la que perdió la votación.
              En la mayoría de los días no hace falta, pero en los días críticos evita una avalancha de privadas. Es un{' '}
              <strong>seguro</strong>: ningún día por separado lo "elige", pero el conjunto de días sí.
            </p>
          )}
        </div>
      </div>
      <table className="data">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Bases</th>
            <th className="r">Costo promedio en la muestra ($k/día)</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className={f.id === 'saa' ? 'active' : ''}>
              <td>{f.label}</td>
              <td>{basesDe(C, f.plan).length}</td>
              <td className="r">{fmt(a.enMuestra[f.id])}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="caption">
        Por construcción, SAA es el más barato <em>en la muestra</em>. La pregunta honesta es otra: ¿cómo le va con días
        que no vio?
      </p>
    </Seccion>
  );
}

/* ---------- 7. Validación ---------- */

function Validacion({ a }: { a: Analisis }) {
  const planes = [
    { id: 'voto', label: 'Por votación', plan: a.voto, clase: 'voto' },
    { id: 'promedio', label: 'Para el día promedio', plan: a.promedio, clase: 'promedio' },
    { id: 'saa', label: 'SAA', plan: a.saa.plan, clase: 'saa' },
  ];
  const ev = (p: Plan) => a.evaluaciones[p];
  const s = ev(a.saa.plan);
  return (
    <Seccion n={7} titulo={`La prueba de fuego: ${fmt(OPCIONES.validacion)} días nuevos`}>
      <p>
        Simulamos <strong>{fmt(OPCIONES.validacion)} días nuevos</strong>, con otra semilla, que ningún plan vio. Cada
        plan queda fijo y cada día se reparte lo mejor posible. Cada barra cuenta cuántos días costaron eso:
      </p>
      <HistogramasCosto
        series={planes.map((p) => ({ label: `${p.label}: ${nombrePlan(C, p.plan)}`, valores: ev(p.plan).costos, media: ev(p.plan).media, p95: ev(p.plan).p95, clase: p.clase }))}
      />
      <table className="data">
        <thead>
          <tr>
            <th>Plan</th>
            <th className="r">Prometía</th>
            <th className="r">Costó en días nuevos</th>
          </tr>
        </thead>
        <tbody>
          {planes.map((p) => (
            <tr key={p.id} className={p.id === 'saa' ? 'active' : ''}>
              <td>{p.label}</td>
              <td className="r">{fmt(a.enMuestra[p.id])}</td>
              <td className="r">
                <strong>{fmt(ev(p.plan).media)}</strong> ± {fmt(1.96 * ev(p.plan).errorEstandar)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        SAA sigue ganando: ${fmt(ev(a.voto).media - s.media)}k por día contra la votación y ${fmt(ev(a.promedio).media - s.media)}k
        contra el día promedio, unos <strong>${fmt(((ev(a.voto).media - s.media) * 365) / 1000, 1)} millones por año</strong>{' '}
        contra la votación. Y mirá la cola derecha: los días malos del plan SAA son mucho menos malos.
      </p>
      <p className="note">
        Todos los planes cuestan <strong>más de lo que prometían</strong>. No es mala suerte: quien elige el mejor
        resultado en una muestra, elige también la muestra que le tocó favorable. Por eso siempre hay que validar con
        días que el modelo no vio.
      </p>
    </Seccion>
  );
}

/* ---------- 8. Tamaño de muestra ---------- */

function Tamanos({ a }: { a: Analisis }) {
  const ref = a.evaluaciones[a.saa.plan].media;
  const primero = a.tamanos[0];
  const media = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const aciertos = (t: (typeof a.tamanos)[number]) => t.planes.filter((p) => p === a.saa.plan).length / t.planes.length;
  return (
    <Seccion n={8} titulo="¿Cuántos días hay que simular?">
      <p>
        Repetimos todo con muestras de distintos tamaños: {a.tamanos.map((t) => t.n).join(', ')} días, varias veces
        cada una. En celeste, lo que <strong>promete</strong> el modelo (su óptimo en la muestra); en negro, lo que ese
        plan <strong>cuesta de verdad</strong> en los días nuevos.
      </p>
      <CurvaTamanos estudio={a.tamanos} referencia={ref} />
      <Leyenda
        items={[
          { clase: 'prometido', texto: 'lo que promete (en la muestra)' },
          { clase: 'real', texto: 'lo que cuesta (días nuevos)' },
        ]}
      />
      <ul>
        <li>
          Con {primero.n} días, el modelo promete ${fmt(media(primero.prometido))}k y termina costando $
          {fmt(media(primero.real))}k: se <strong>sobreajusta</strong> a unos pocos días y elige planes que parecen
          geniales en la muestra. Acertó el mejor plan en {fmt(aciertos(primero) * 100)}% de las veces.
        </li>
        <li>
          Con más días, la promesa se vuelve honesta y el plan elegido se estabiliza: con{' '}
          {a.tamanos[a.tamanos.length - 2].n} días ya acierta el{' '}
          {fmt(aciertos(a.tamanos[a.tamanos.length - 2]) * 100)}% de las veces.
        </li>
        <li>
          En promedio, lo prometido es una <strong>cota inferior</strong> del costo verdadero, y lo medido en días
          nuevos, una <strong>cota superior</strong>. Cuando se acercan, la muestra alcanza. Son las dos cotas de A3 y A4,
          ahora con estadística.
        </li>
      </ul>
    </Seccion>
  );
}

/* ---------- 9. La decisión ---------- */

function Decision({ a }: { a: Analisis }) {
  const ev = (p: Plan) => a.evaluaciones[p];
  const planes = [
    { label: 'Por votación', plan: a.voto },
    { label: 'Para el día promedio', plan: a.promedio },
    { label: 'SAA', plan: a.saa.plan, destacado: true },
    { label: 'Todas las bases', plan: a.todas },
  ];
  const s = ev(a.saa.plan);
  const t = ev(a.todas);
  const extra = C.bases.filter((_, i) => incluye(a.todas, i) && !incluye(a.saa.plan, i));
  return (
    <Seccion n={9} titulo="La decisión">
      <p>
        Un plan no es sólo su costo promedio. Para un servicio de emergencias importan también los <strong>días
        malos</strong> y los <strong>minutos</strong>. Todo medido en los {fmt(OPCIONES.validacion)} días nuevos:
      </p>
      <div className="tabla-scroll">
        <table className="data decision">
          <thead>
            <tr>
              <th>Plan</th>
              <th className="r">Costo medio ($k/día)</th>
              <th className="r">Costo día malo (p95)</th>
              <th className="r">Minutos promedio</th>
              <th className="r">Minutos día malo (p95)</th>
              <th className="r">A privadas</th>
            </tr>
          </thead>
          <tbody>
            {planes.map((p) => (
              <tr key={p.label} className={p.destacado ? 'active' : ''}>
                <td>
                  <strong>{p.label}</strong>
                  <br />
                  <span className="caption">{basesDe(C, p.plan).length} bases</span>
                </td>
                <td className="r">{fmt(ev(p.plan).media)}</td>
                <td className="r">{fmt(ev(p.plan).p95)}</td>
                <td className="r">{fmt(ev(p.plan).minutosMedia, 1)}</td>
                <td className="r">{fmt(ev(p.plan).minutosP95, 1)}</td>
                <td className="r">{fmt(ev(p.plan).privadasMedia * 100, 1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        El plan SAA es el de menor costo esperado. Pero aparece una pregunta que el modelo no puede contestar solo:
        abrir también la {extra.map((b) => b.label).join(' y la ')} cuesta ${fmt(t.media - s.media)}k más por día en
        promedio, y a cambio el día malo (percentil 95) pasa de {fmt(s.minutosP95, 1)} a {fmt(t.minutosP95, 1)} minutos de
        respuesta. ¿Vale la pena? Eso depende de cuánto valga un minuto en una emergencia: es una decisión{' '}
        <strong>política</strong>, no matemática. Lo que sí hace el análisis es ponerle precio.
      </p>
      <div className="memo">
        <span className="eyebrow">Recomendación al Servicio de Emergencias</span>
        <p>
          Operar <strong>{nombrePlan(C, a.saa.plan)}</strong>. Costo esperado: ${fmt(s.media)}k por día (±
          {fmt(1.96 * s.errorEstandar)}), con {fmt(s.minutosMedia, 1)} minutos de respuesta promedio y{' '}
          {fmt(s.privadasMedia * 100, 1)}% de llamadas derivadas.
        </p>
        <p>
          No usar la votación de días ideales ni el día promedio: en días reales cuestan ${fmt(ev(a.voto).media - s.media)}k
          y ${fmt(ev(a.promedio).media - s.media)}k más por día, y fallan justo en los días críticos.
        </p>
        <p>
          Si el Concejo prioriza el peor caso, sumar la {extra.map((b) => b.label).join(' y la ')}: +${fmt(t.media - s.media)}k
          por día para bajar el p95 de respuesta de {fmt(s.minutosP95, 1)} a {fmt(t.minutosP95, 1)} minutos.
        </p>
      </div>
    </Seccion>
  );
}

/* ---------- 10. Para seguir ---------- */

function ParaSeguir({ onExit }: { onExit(): void }) {
  return (
    <Seccion n={10} titulo="Para seguir">
      <ul>
        <li>
          <strong>Muchas más bases.</strong> Acá se probaron las {1 << C.bases.length} combinaciones. Con 50 bases
          candidatas son más de mil billones: ahí se resuelve el mismo modelo con <strong>Benders por escenarios</strong>{' '}
          (nivel A4), un subproblema por día simulado.
        </li>
        <li>
          <strong>Resolver día por día, pero bien.</strong> La idea de resolver cada día por separado no está muerta:{' '}
          <em>Progressive Hedging</em> resuelve cada escenario solo y los va obligando a ponerse de acuerdo con un
          precio por apartarse del consenso.
        </li>
        <li>
          <strong>Simular con más detalle.</strong> Acá cada salida se cuenta por día. Un simulador de colas, con
          horarios y ambulancias ocupadas, permitiría medir demoras reales y probar los planes finalistas antes de
          decidir.
        </li>
      </ul>
      <button className="primary" onClick={onExit}>
        ← Volver al menú
      </button>
    </Seccion>
  );
}
