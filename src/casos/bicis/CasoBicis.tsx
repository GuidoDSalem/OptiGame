import { useMemo, useState } from 'react';
import { flujos, media, percentil, type DatosBicis, type DatosBicisCrudos } from '../../engine/bicis';
import { Tex } from '../../ui/components/Tex';
import { BarraProgreso, CurvaTamanos, HistogramasCosto, Leyenda, fmt } from '../ambulancias/graficos';
import { useEnVista } from '../ambulancias/useEnVista';
import { Seccion } from '../comun';
import type { AnalisisBicis, Plan } from './analisis';
import {
  BarrasMeses,
  CurvaFallas,
  DispersionLluvia,
  Espagueti,
  MapaCalor,
  PilaMananas,
  TablaRepartos,
  esLluvia,
  fechaLarga,
  nombreCorto,
} from './graficos';
import { MapaCentro } from './MapaCentro';
import { ANCLAJES, FLOTA, HORA_FIN, HORA_INICIO, modeloDe } from './modelo';
import { Reproduccion, type ViajeReal } from './Reproduccion';
import { useDatos } from './useDatos';

const NOMBRES: Record<Plan['id'], string> = {
  medio: 'Todas a medio llenar',
  promDecisiones: 'Promedio de los repartos diarios',
  diaPromedio: 'Para el día promedio',
  saa: 'Contra todos los días (SAA)',
};

interface Ctx {
  D: DatosBicis;
  crudos: DatosBicisCrudos;
  a: AnalisisBicis | null;
  /** Estaciones ordenadas de la que más se vacía a la que más se llena a la mañana. */
  orden: number[];
  netos: number[];
}

/** Caso de estudio C2: una página que se lee scrolleando, con datos reales de Ecobici. */
export function CasoBicis({ onExit }: { onExit(): void }) {
  const estado = useDatos();
  const ctx = useMemo<Ctx | null>(() => {
    if (estado.tipo === 'cargando') return null;
    const { D } = estado;
    const M = modeloDe(D);
    const d23 = D.dias.filter((d) => d.f.startsWith('2023'));
    const netos = D.estaciones.map((_, e) =>
      media(d23.map((d) => {
        const { sal, lleg } = flujos(D, d, e, M.ventana);
        return lleg.reduce((s, x) => s + x, 0) - sal.reduce((s, x) => s + x, 0);
      })),
    );
    const orden = netos.map((_, i) => i).sort((x, y) => netos[x] - netos[y]);
    return { D, crudos: estado.crudos, a: estado.tipo === 'listo' ? estado.a : null, orden, netos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.tipo]);

  return (
    <article className="caso">
      <button className="link volver" onClick={onExit}>
        ← Volver al menú
      </button>
      {!ctx ? (
        <p className="muted">Cargando los datos de Ecobici…</p>
      ) : (
        <>
          <Portada c={ctx} />
          <Situacion c={ctx} />
          <UnaManana c={ctx} />
          <MuchasMananas c={ctx} />
          {!ctx.a && estado.tipo === 'progreso' && (
            <section className="paso">
              <BarraProgreso hecho={estado.hecho} total={estado.total} texto="Simulando cada estación en cada mañana real con cada cantidad de bicis…" />
            </section>
          )}
          {ctx.a && (
            <>
              <UnoAUno c={ctx} a={ctx.a} />
              <Tentacion c={ctx} a={ctx.a} />
              <Saa c={ctx} a={ctx.a} />
              <Validacion c={ctx} a={ctx.a} />
              <Tamanos a={ctx.a} />
              <Pasado c={ctx} a={ctx.a} />
              <Decision c={ctx} a={ctx.a} />
              <Datos c={ctx} onExit={onExit} />
            </>
          )}
        </>
      )}
    </article>
  );
}

const diaTipico = (c: Ctx) => Object.keys(c.crudos.animados ?? {})[0];
const viajesDe = (c: Ctx, f: string) => (c.crudos.animados?.[f] ?? []) as ViajeReal[];
const medioLleno = (c: Ctx) => c.D.estaciones.map(() => FLOTA / c.D.estaciones.length);

/* ---------- 0. Portada ---------- */

function Portada({ c }: { c: Ctx }) {
  const f = diaTipico(c);
  return (
    <header className="portada">
      <span className="eyebrow">Caso de estudio · C2 · Datos reales de Ecobici</span>
      <h1>Bicis para la hora pico</h1>
      <p className="lead">
        Cada punto que se mueve es un viaje real en bici pública por el Centro de Buenos Aires, el {fechaLarga(f)} a la
        mañana. Algunas estaciones se vacían, otras se llenan. ¿Cuántas bicis hay que dejar en cada una antes de que
        arranque el día?
      </p>
      <Reproduccion estaciones={c.D.estaciones} viajes={viajesDe(c, f)} repartos={[{ reparto: medioLleno(c) }]} capacidad={ANCLAJES} auto duracion={30} controles={false} etiquetas="algunas" />
      <p className="caption">Scrolleá: la historia se arma de a poco. Todos los datos son reales.</p>
    </header>
  );
}

/* ---------- 1. La situación ---------- */

function Situacion({ c }: { c: Ctx }) {
  const n = c.D.estaciones.length;
  return (
    <Seccion n={1} titulo="La situación">
      <p>
        Ecobici, el sistema de bicis públicas de la Ciudad, reparte bicis con camiones durante la noche. Nos
        concentramos en las <strong>{n} estaciones más usadas del Centro</strong>: Constitución, Retiro, el
        Microcentro y Puerto Madero.
      </p>
      <p>
        La pregunta: con <strong>{FLOTA} bicis</strong> para la zona y estaciones de <strong>{ANCLAJES} anclajes</strong>,
        ¿cuántas dejar en cada estación a las {HORA_INICIO} de la mañana para que el reparto aguante hasta las{' '}
        {HORA_FIN}, cuando pasa el segundo camión?
      </p>
      <ul>
        <li>
          Si alguien quiere sacar una bici y la estación está vacía: <strong>viaje perdido</strong>.
        </li>
        <li>
          Si alguien quiere devolverla y la estación está llena: <strong>viaje con problema</strong> (tiene que ir a
          otra).
        </li>
      </ul>
      <p>
        Queremos el reparto con menos viajes fallidos. La trampa: no sabemos cómo va a ser la mañana de mañana. Pero
        tenemos algo mejor que un simulador: <strong>dos años de viajes reales</strong>.
      </p>
      <MapaCentro estaciones={c.D.estaciones} capacidad={ANCLAJES} niveles={medioLleno(c)} etiquetas="todas" />
      <p className="caption">Cada tubo es una estación; el relleno, las bicis que tiene (acá, todas a medio llenar).</p>
    </Seccion>
  );
}

/* ---------- 2. Una mañana real ---------- */

function UnaManana({ c }: { c: Ctx }) {
  const f = diaTipico(c);
  const [ref, visto] = useEnVista<HTMLDivElement>();
  const peor = c.orden[0];
  const mejor = c.orden[c.orden.length - 1];
  return (
    <Seccion n={2} titulo="Una mañana real">
      <p>
        Probemos la regla más natural: <strong>todas las estaciones a medio llenar</strong> ({FLOTA / c.D.estaciones.length}{' '}
        bicis cada una). Apretá play y mirá la mañana del {fechaLarga(f)}, minuto a minuto, con los viajes que
        realmente se hicieron.
      </p>
      <div ref={ref}>
        {visto && <Reproduccion estaciones={c.D.estaciones} viajes={viajesDe(c, f)} repartos={[{ titulo: 'Todas a medio llenar', reparto: medioLleno(c) }]} capacidad={ANCLAJES} />}
      </div>
      <Leyenda
        items={[
          { clase: 'sin-bici', texto: 'se quedó sin bicis' },
          { clase: 'sin-lugar', texto: 'se llenó' },
        ]}
      />
      <p>
        A las 7 la gente llega en tren a <strong>{nombreCorto(c.D.estaciones[peor].nombre)}</strong> y se lleva las
        bicis: en promedio salen {fmt(-c.netos[peor])} bicis más de las que entran en la mañana. Mientras tanto, las
        estaciones de oficinas como <strong>{nombreCorto(c.D.estaciones[mejor].nombre)}</strong> se llenan (+
        {fmt(c.netos[mejor])}). Medio llenar todo es justo lo contrario de lo que hace falta.
      </p>
    </Seccion>
  );
}

/* ---------- 3. Muchas mañanas ---------- */

function MuchasMananas({ c }: { c: Ctx }) {
  const M = modeloDe(c.D);
  const d23 = c.D.dias.filter((d) => d.f.startsWith('2023'));
  const manana = (d: (typeof d23)[number]) =>
    c.D.estaciones.reduce((s, _, e) => {
      const { sal } = flujos(c.D, d, e, M.ventana);
      return s + sal.reduce((a, b) => a + b, 0);
    }, 0);
  const valores = d23.map(manana);
  const [ref, visto] = useEnVista<HTMLDivElement>();
  const lluvias = d23.filter((d) => esLluvia(d));
  const curvas = (e: number) =>
    d23.map((d) => {
      const { sal, lleg } = flujos(c.D, d, e, M.ventana);
      let acc = 0;
      return sal.map((s, h) => (acc += lleg[h] - s));
    });
  const [a, b] = [c.orden[0], c.orden[c.orden.length - 1]];
  return (
    <Seccion n={3} titulo={`${d23.length} mañanas de 2023`}>
      <p>
        Una mañana es una historia; muchas mañanas son datos. Cada punto es un <strong>día hábil real de 2023</strong>,
        apilado según cuántas bicis salieron de estas estaciones entre las {HORA_INICIO} y las {HORA_FIN}.
      </p>
      <div ref={ref}>
        <PilaMananas dias={d23} valores={valores} visibles={visto ? d23.length : 0} ancho={25} etiqueta="salidas a la mañana" />
      </div>
      <Leyenda
        items={[
          { clase: 'seco', texto: 'día sin lluvia' },
          { clase: 'lluvia', texto: `día de lluvia (${lluvias.length} en el año)` },
        ]}
      />
      <p>
        La mayoría de las mañanas tiene entre {fmt(percentil(valores, 0.1))} y {fmt(percentil(valores, 0.9))} salidas. Los
        días de lluvia y los feriados puente quedan a la izquierda. Pero el total no es lo importante: lo que complica
        es <strong>el saldo de cada estación</strong>.
      </p>
      <div className="dos-columnas iguales">
        <Espagueti titulo={nombreCorto(c.D.estaciones[a].nombre)} curvas={curvas(a)} horas={M.ventana.map((i) => c.D.horas[i])} capacidad={ANCLAJES} />
        <Espagueti titulo={nombreCorto(c.D.estaciones[b].nombre)} curvas={curvas(b)} horas={M.ventana.map((i) => c.D.horas[i])} capacidad={ANCLAJES} />
      </div>
      <p>
        Cada línea es una mañana. Las líneas punteadas marcan ±{ANCLAJES}: lo que cabe en una estación. En{' '}
        {nombreCorto(c.D.estaciones[a].nombre)} ningún reparto alcanza: se vacía aunque arranque llena. En{' '}
        {nombreCorto(c.D.estaciones[b].nombre)} conviene arrancar casi vacía. Y entre un día y otro, las líneas se
        abren en abanico: <strong>eso es la incertidumbre</strong>, medida, no inventada.
      </p>
    </Seccion>
  );
}

/* ---------- 4. Uno a uno ---------- */

function UnoAUno({ c, a }: { c: Ctx; a: AnalisisBicis }) {
  const d23 = c.D.dias.slice(0, a.n2023);
  const [sel, setSel] = useState(Math.floor(a.n2023 / 2));
  const distintos = new Set(a.diarios.map((r) => r.join())).size;
  const rangos = c.orden.map((e) => {
    const xs = a.diarios.map((r) => r[e]);
    return Math.max(...xs) - Math.min(...xs);
  });
  const variables = rangos.filter((r) => r >= ANCLAJES / 2).length;
  return (
    <Seccion n={4} titulo="Resolver cada mañana por separado">
      <p>
        Si supiéramos exactamente cómo va a ser la mañana, podríamos calcular el reparto perfecto. Con {c.D.estaciones.length}{' '}
        estaciones y {ANCLAJES + 1} opciones por estación hay más combinaciones que átomos en el universo, pero no hace
        falta probarlas todas: para cada estación calculamos cuántos viajes fallan arrancando con 0, 1, 2… {ANCLAJES}{' '}
        bicis, y una <strong>programación dinámica</strong> reparte las {FLOTA} bicis de la mejor manera.
      </p>
      <p>Lo hicimos para cada una de las {a.n2023} mañanas de 2023. Cada columna es un día; cada fila, una estación; más oscuro, más bicis:</p>
      <MapaCalor filas={c.orden.map((e) => nombreCorto(c.D.estaciones[e].nombre))} repartos={a.diarios.map((r) => c.orden.map((e) => r[e]))} capacidad={ANCLAJES} seleccionado={sel} onSelect={setSel} />
      <p>
        <strong>Cada mañana quiere otra cosa.</strong> Hay {distintos} repartos distintos en {a.n2023} días, y en{' '}
        {variables} de las {c.D.estaciones.length} estaciones el reparto ideal va de casi vacía a casi llena según el día.
        Tocá una columna para ver ese día.
      </p>
      <div className="dos-columnas">
        <MapaCentro estaciones={c.D.estaciones} capacidad={ANCLAJES} niveles={a.diarios[sel]} numeros etiquetas="ninguna" />
        <div>
          <h3>{fechaLarga(d23[sel].f)}</h3>
          <p>
            {fmt(d23[sel].zona)} viajes en la zona{d23[sel].ll >= 0.1 ? `, ${fmt(d23[sel].ll, 1)} mm de lluvia` : ', sin lluvia'}.
          </p>
          <p>
            Con el reparto perfecto de ese día fallan <strong>{fmt(fallasDia(c, a, sel, a.diarios[sel]))}</strong> viajes;
            con todas a medio llenar, {fmt(a.planes.medio.fallas2023[sel])}.
          </p>
        </div>
      </div>
      <p className="note">
        Pero es hacer trampa: el camión sale de noche, sin saber cómo va a venir la mañana. Necesitamos <strong>un solo
        reparto</strong> que funcione bien en mañanas que todavía no pasaron.
      </p>
    </Seccion>
  );
}

function fallasDia(c: Ctx, a: AnalisisBicis, fila: number, r: number[]) {
  const E = c.D.estaciones.length;
  const S = ANCLAJES + 1;
  return r.reduce((s, x, e) => s + a.tabla[(fila * E + e) * S + x], 0);
}

/* ---------- 5. La tentación ---------- */

function Tentacion({ c, a }: { c: Ctx; a: AnalisisBicis }) {
  return (
    <Seccion n={5} titulo="Las tentaciones">
      <p>Con {a.n2023} repartos ideales en la mano, hay dos atajos que parecen razonables:</p>
      <ul>
        <li>
          <strong>Promediar los repartos</strong>: para cada estación, el promedio de sus {a.n2023} repartos ideales.
        </li>
        <li>
          <strong>Armar el día promedio</strong>: promediar las salidas y llegadas de cada estación y cada hora, y
          calcular el reparto perfecto para esa mañana "típica".
        </li>
      </ul>
      <TablaRepartos
        estaciones={c.D.estaciones}
        orden={c.orden}
        capacidad={ANCLAJES}
        columnas={[
          { titulo: 'Medio llenar', reparto: a.planes.medio.reparto },
          { titulo: 'Promedio de repartos', reparto: a.planes.promDecisiones.reparto },
          { titulo: 'Día promedio', reparto: a.planes.diaPromedio.reparto },
        ]}
      />
      <p>
        Los dos se parecen bastante entre sí y los dos mejoran la regla de medio llenar. Pero tienen el mismo punto
        ciego: <strong>ninguno mira todas las mañanas a la vez</strong>. El día promedio es una mañana suave que nunca
        existió: borra los picos, que son justo los que vacían o llenan una estación. Y promediar repartos mezcla
        decisiones que sólo tenían sentido cada una en su día.
      </p>
    </Seccion>
  );
}

/* ---------- 6. SAA ---------- */

function Saa({ c, a }: { c: Ctx; a: AnalisisBicis }) {
  const E = c.D.estaciones.length;
  const S = ANCLAJES + 1;
  const ejemplos = [c.orden[1], c.orden[c.orden.length - 2]];
  const porDia = (e: number) => Array.from({ length: a.n2023 }, (_, k) => Array.from({ length: S }, (_, s) => a.tabla[(k * E + e) * S + s]));
  const filas: Plan['id'][] = ['medio', 'promDecisiones', 'diaPromedio', 'saa'];
  return (
    <Seccion n={6} titulo="Un reparto contra todas las mañanas">
      <p>
        La forma correcta: elegir el reparto que minimiza los viajes fallidos <strong>en promedio sobre las{' '}
        {a.n2023} mañanas reales</strong>, simulando cada una con ese mismo reparto.
      </p>
      <Tex block tex={'\\min_{s_1, \\dots, s_E} \\; \\frac{1}{N} \\sum_{k=1}^{N} \\sum_{e=1}^{E} \\text{fallas}_e(s_e,\\, \\text{mañana}_k) \\qquad \\sum_e s_e = F, \\;\\; 0 \\leq s_e \\leq C'} />
      <p>
        Es el mismo SAA del caso de las ambulancias, pero con una diferencia enorme: los escenarios no salen de un
        simulador, son <strong>mañanas que pasaron de verdad</strong> (se lo suele llamar <em>bootstrap</em> de datos
        históricos).
      </p>
      <div className="dos-columnas iguales">
        {ejemplos.map((e) => (
          <CurvaFallas key={e} titulo={nombreCorto(c.D.estaciones[e].nombre)} porDia={porDia(e)} elegido={a.planes.saa.reparto[e]} capacidad={ANCLAJES} />
        ))}
      </div>
      <p>
        Cada estación tiene su curva: con pocas bicis faltan, con muchas sobran y se llena. El promedio de las curvas
        de todas las mañanas (en negro) tiene forma de U, y SAA elige en cada estación un punto de esa U,
        repartiendo las {FLOTA} bicis donde más rinden.
      </p>
      <TablaRepartos
        estaciones={c.D.estaciones}
        orden={c.orden}
        capacidad={ANCLAJES}
        columnas={[
          { titulo: 'Día promedio', reparto: a.planes.diaPromedio.reparto },
          { titulo: 'SAA', reparto: a.planes.saa.reparto, destacada: true },
        ]}
      />
      <table className="data">
        <thead>
          <tr>
            <th>Plan</th>
            <th className="r">Viajes fallidos por mañana (2023)</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((id) => (
            <tr key={id} className={id === 'saa' ? 'active' : ''}>
              <td>{NOMBRES[id]}</td>
              <td className="r">{fmt(media(a.planes[id].fallas2023), 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="caption">Ojo: todos medidos en 2023, los mismos días con los que se eligió SAA. Falta la prueba de verdad.</p>
    </Seccion>
  );
}

/* ---------- 7. Validación con 2024 ---------- */

function Validacion({ a }: { c?: Ctx; a: AnalisisBicis }) {
  const ids: Plan['id'][] = ['medio', 'diaPromedio', 'promDecisiones', 'saa'];
  const m24 = (id: Plan['id']) => media(a.planes[id].fallas2024);
  return (
    <Seccion n={7} titulo={`La prueba de fuego: las ${a.n2024} mañanas de 2024`}>
      <p>
        Congelamos los repartos elegidos con 2023 y los probamos en <strong>todas las mañanas hábiles de 2024</strong>,
        que ningún plan vio. Nada de simulación: son los viajes que la gente hizo.
      </p>
      <HistogramasCosto
        series={ids.map((id) => ({
          label: NOMBRES[id],
          valores: a.planes[id].fallas2024,
          media: m24(id),
          p95: percentil(a.planes[id].fallas2024, 0.95),
          clase: id === 'saa' ? 'saa' : 'otro',
        }))}
      />
      <table className="data">
        <thead>
          <tr>
            <th>Plan</th>
            <th className="r">2023 (elegido con estos días)</th>
            <th className="r">2024 (días nuevos)</th>
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => (
            <tr key={id} className={id === 'saa' ? 'active' : ''}>
              <td>{NOMBRES[id]}</td>
              <td className="r">{fmt(media(a.planes[id].fallas2023), 1)}</td>
              <td className="r">
                <strong>{fmt(m24(id), 1)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        SAA sigue ganando con claridad: {fmt(m24('saa'), 1)} viajes fallidos por mañana contra {fmt(m24('diaPromedio'), 1)} del
        día promedio y {fmt(m24('medio'), 1)} de medio llenar. Son unos{' '}
        <strong>{fmt((m24('medio') - m24('saa')) * a.n2024)} viajes por año</strong> que dejan de fallar respecto de la
        regla, sólo en estas estaciones y sólo a la mañana, sin comprar una bici más.
      </p>
      <p className="note">
        Curiosidad honesta: en 2024 <strong>todos</strong> los planes fallan menos que en 2023. No es mérito de nadie:
        cambió la ciudad. Lo vemos en la sección 9.
      </p>
    </Seccion>
  );
}

/* ---------- 8. Tamaño de muestra ---------- */

function Tamanos({ a }: { a: AnalisisBicis }) {
  const ref = media(a.tamanos[a.tamanos.length - 1].real);
  const t0 = a.tamanos[1];
  return (
    <Seccion n={8} titulo="¿Cuántas mañanas hacen falta?">
      <p>
        Para aislar el efecto del tamaño de muestra, usamos sólo 2023: elegimos el reparto con unas pocas mañanas
        (sorteadas entre los días pares) y lo probamos en las otras (los días impares). En celeste, lo que promete el
        modelo; en negro, lo que pasa.
      </p>
      <CurvaTamanos estudio={a.tamanos.map((t) => ({ ...t }))} referencia={ref} etiquetaReferencia="con todas las mañanas pares" decimales={0} />
      <Leyenda
        items={[
          { clase: 'prometido', texto: 'lo que promete (en su muestra)' },
          { clase: 'real', texto: 'lo que pasa (otras mañanas)' },
        ]}
      />
      <p>
        Con {t0.n} mañanas el modelo promete {fmt(media(t0.prometido), 1)} fallas y termina dando {fmt(media(t0.real), 1)}: un
        reparto "a medida" de unos pocos días. Con 50 mañanas la promesa y la realidad ya casi coinciden. Un año de
        datos sobra; unas semanas no alcanzan.
      </p>
    </Seccion>
  );
}

/* ---------- 9. ¿El pasado sirve para el futuro? ---------- */

function Pasado({ c, a }: { c: Ctx; a: AnalisisBicis }) {
  const porMes = (y: string) => Array.from({ length: 12 }, (_, m) => c.D.dias.filter((d) => d.f.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).reduce((s, d) => s + d.sis, 0));
  const s23 = porMes('2023');
  const s24 = porMes('2024');
  const suba = s24.reduce((x, y) => x + y, 0) / s23.reduce((x, y) => x + y, 0) - 1;
  const M = modeloDe(c.D);
  const e0 = c.orden[0];
  const salidas = (y: string) =>
    media(c.D.dias.filter((d) => d.f.startsWith(y)).map((d) => flujos(c.D, d, e0, M.ventana).sal.reduce((s, x) => s + x, 0)));
  const saa24 = media(a.planes.saa.fallas2024);
  return (
    <Seccion n={9} titulo="¿El pasado sirve para el futuro?">
      <p>
        Con datos reales aparece una pregunta que el simulador escondía: ¿2024 se parece a 2023? No del todo. En los
        días hábiles, el sistema entero tuvo un <strong>{fmt(suba * 100)}% más de viajes</strong>:
      </p>
      <BarrasMeses
        series={[
          { etiqueta: '2023', clase: 'y2023', valores: s23 },
          { etiqueta: '2024', clase: 'y2024', valores: s24 },
        ]}
      />
      <Leyenda
        items={[
          { clase: 'y2023', texto: 'viajes en días hábiles, 2023' },
          { clase: 'y2024', texto: '2024' },
        ]}
      />
      <p>
        Y no creció parejo: en {nombreCorto(c.D.estaciones[e0].nombre)}, la estación más difícil, las salidas de la mañana{' '}
        <strong>bajaron</strong> de {fmt(salidas('2023'))} a {fmt(salidas('2024'))} por día. Por eso en 2024 todos los planes
        fallan menos.
      </p>
      <p>
        ¿Cuánto nos costó decidir con el año anterior? Si hubiéramos conocido 2024 de antemano (el diario del lunes),
        el mejor reparto posible habría dado {fmt(a.retrospectivo2024.valor, 1)} fallas por mañana. El de 2023 dio{' '}
        {fmt(saa24, 1)}: <strong>casi lo mismo</strong>. El patrón de fondo (Constitución se vacía, las oficinas se
        llenan) es estable aunque el volumen cambie.
      </p>
      <h3>¿Y si miramos el pronóstico?</h3>
      <div className="dos-columnas">
        <DispersionLluvia dias={c.D.dias.slice(0, a.n2023)} />
        <p>
          La lluvia baja los viajes. Así que probamos dos repartos: uno para días de lluvia (≥{a.pronostico.umbral} mm,
          calculado con los {a.pronostico.diasLluvia2023} de 2023) y otro para días secos, eligiendo cada mañana de 2024
          según si llovió (como si el pronóstico fuera perfecto). Resultado: {fmt(a.pronostico.fallas2024, 1)} fallas contra{' '}
          {fmt(saa24, 1)} del reparto único. <strong>No mejora nada.</strong> La lluvia cambia cuánta gente pedalea, no
          hacia dónde: el mismo reparto sirve.
        </p>
      </div>
      <p className="note">
        Un resultado "negativo" también es un resultado: ahorra construir un sistema de pronóstico que no iba a
        servir para esta decisión.
      </p>
    </Seccion>
  );
}

/* ---------- 10. La decisión ---------- */

function Decision({ c, a }: { c: Ctx; a: AnalisisBicis }) {
  const f = diaTipico(c);
  const saa = a.planes.saa;
  const medio = a.planes.medio;
  const ids: Plan['id'][] = ['medio', 'diaPromedio', 'promDecisiones', 'saa'];
  const total = saa.porEstacion2024.reduce((s, x) => s + x, 0);
  const peores = saa.porEstacion2024.map((x, e) => ({ e, x })).sort((p, q) => q.x - p.x).slice(0, 2);
  const parte = (peores[0].x + peores[1].x) / total;
  return (
    <Seccion n={10} titulo="La decisión">
      <p>La misma mañana real del principio, con los dos repartos lado a lado:</p>
      <Reproduccion
        estaciones={c.D.estaciones}
        viajes={viajesDe(c, f)}
        repartos={[
          { titulo: 'Todas a medio llenar', reparto: medio.reparto },
          { titulo: 'Reparto SAA', reparto: saa.reparto },
        ]}
        capacidad={ANCLAJES}
        etiquetas="ninguna"
      />
      <div className="tabla-scroll">
        <table className="data decision">
          <thead>
            <tr>
              <th>Plan (medido en 2024)</th>
              <th className="r">Fallas por mañana</th>
              <th className="r">Mañana mala (p95)</th>
              <th className="r">Peor mañana</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => (
              <tr key={id} className={id === 'saa' ? 'active' : ''}>
                <td>{NOMBRES[id]}</td>
                <td className="r">{fmt(media(a.planes[id].fallas2024), 1)}</td>
                <td className="r">{fmt(percentil(a.planes[id].fallas2024, 0.95))}</td>
                <td className="r">{fmt(Math.max(...a.planes[id].fallas2024))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        Con SAA, la mayor parte de las fallas que quedan se concentra en dos estaciones:{' '}
        <strong>
          {nombreCorto(c.D.estaciones[peores[0].e].nombre)} y {nombreCorto(c.D.estaciones[peores[1].e].nombre)}
        </strong>{' '}
        ({fmt(parte * 100)}% del total). Ahí ningún reparto alcanza: el problema no es cómo repartir, es que
        {' '}
        {ANCLAJES} anclajes no alcanzan para la ola de las 7.
      </p>
      <div className="memo">
        <span className="eyebrow">Recomendación a la operación de Ecobici (zona Centro)</span>
        <p>
          Cargar las estaciones a la madrugada según el reparto SAA, no a medio llenar: en las mañanas de 2024 los viajes
          fallidos bajan de {fmt(media(medio.fallas2024), 1)} a {fmt(media(saa.fallas2024), 1)} por día, con las mismas {FLOTA} bicis.
        </p>
        <p>
          Para {nombreCorto(c.D.estaciones[peores[0].e].nombre)} y {nombreCorto(c.D.estaciones[peores[1].e].nombre)}, evaluar
          más anclajes o una reposición a media mañana: es donde está casi todo lo que queda por ganar.
        </p>
        <p>
          Recalcular el reparto una vez por año con los datos nuevos. No vale la pena ajustarlo según el pronóstico.
        </p>
      </div>
    </Seccion>
  );
}

/* ---------- 11. Datos y supuestos ---------- */

function Datos({ c, onExit }: { c: Ctx; onExit(): void }) {
  return (
    <Seccion n={11} titulo="Datos y supuestos">
      <ul>
        <li>
          <strong>Viajes:</strong> {c.crudos.fuente?.recorridos}. Se usaron los días hábiles y las {c.D.estaciones.length}{' '}
          estaciones más usadas del Centro; cuentan todos los viajes que salen o llegan a ellas.
        </li>
        <li>
          <strong>Lluvia:</strong> {c.crudos.fuente?.clima}.
        </li>
        <li>
          <strong>Anclajes:</strong> el dataset no publica cuántos tiene cada estación; supusimos {ANCLAJES} en todas. La API
          de Ecobici (GBFS, con registro) sí los informa: sería la primera mejora.
        </li>
        <li>
          <strong>Demanda censurada:</strong> sólo vemos los viajes que se pudieron hacer. Si una estación estaba vacía y
          alguien se fue caminando, ese viaje no está en los datos: la demanda real es algo mayor.
        </li>
        <li>
          <strong>Estaciones independientes:</strong> un viaje que falla en su origen igual cuenta como llegada en su
          destino, y dentro de cada hora las salidas y llegadas se intercalan parejo (los datos del análisis van por hora;
          la animación usa los minutos reales).
        </li>
        <li>
          <strong>Sin reposición a la mañana:</strong> en la realidad los camiones también trabajan de día; por eso los
          datos muestran viajes que en nuestro modelo fallarían.
        </li>
      </ul>
      <p className="caption">
        El preprocesamiento es reproducible: <code>scripts/ecobici/preprocesar.py</code> baja de los datos crudos (cientos de
        MB) a un resumen de menos de 1 MB.
      </p>
      <button className="primary" onClick={onExit}>
        ← Volver al menú
      </button>
    </Seccion>
  );
}
