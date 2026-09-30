import { useEffect, useState } from 'react';
import { gastoAnual, necesidadSemanal, nodosDeRiesgo, type Blindaje } from '../../engine/resiliencia';
import { Tex } from '../../ui/components/Tex';
import { BarraProgreso, Leyenda, fmt } from '../ambulancias/graficos';
import { Seccion } from '../comun';
import type { AnalisisResiliencia, PlanBlindaje } from './analisis';
import { BarrasGasto, CurvaPresupuesto, CurvasPerdida, Pendiente, RedDiagrama, Relojes, expuesto, semanas, usd } from './graficos';
import { OPCIONES, PRESUPUESTO_RECOMENDADO, RED } from './planta';
import { useAnalisis } from './useAnalisis';

const sitio = (id: string) => RED.sitios.find((s) => s.id === id)!;
const item = (id: string) => RED.items.find((x) => x.id === id)!;
const NEC = necesidadSemanal(RED);
const productos = RED.items.filter((x) => x.tipo === 'producto');
const margenSemanal = productos.reduce((s, p) => s + (p.demanda ?? 0) * (p.margen ?? 0), 0);
const accion = (id: string) => RED.acciones.find((a) => a.id === id)!;

/** Caso de estudio C3: qué proveedor te para la fábrica (TTS/TTR, Simchi-Levi). */
export function CasoResiliencia({ onExit }: { onExit(): void }) {
  const estado = useAnalisis();
  const a = estado.tipo === 'listo' ? estado.datos : null;
  return (
    <article className="caso">
      <button className="link volver" onClick={onExit}>
        ← Volver al menú
      </button>
      <Portada />
      <Situacion />
      <PreguntaDeSiempre />
      <DosRelojes />
      {!a && estado.tipo === 'progreso' && (
        <section className="paso">
          <BarraProgreso hecho={estado.hecho} total={estado.total} texto="Resolviendo un PL por cada proveedor que se puede caer…" />
        </section>
      )}
      {a && (
        <>
          <ElModelo a={a} />
          <TodosLosRelojes a={a} />
          <CuantoCuesta a={a} />
          <SiTardaMas a={a} />
          <Blindar a={a} />
          <Decision a={a} />
          <Datos onExit={onExit} />
        </>
      )}
    </article>
  );
}

/* ---------- 0. Portada ---------- */

function Portada() {
  const [caido, setCaido] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => setCaido((c) => (c ? null : 'bsj')), 3500);
    return () => clearInterval(id);
  }, []);
  return (
    <header className="portada">
      <span className="eyebrow">Caso de estudio · C3 · Cadena de suministro</span>
      <h1>¿Qué pieza te para la fábrica?</h1>
      <p className="lead">
        Una fábrica de sembradoras de Córdoba compra a {RED.sitios.filter((s) => s.nivel === 1).length} proveedores. Si mañana
        se incendia uno, ¿cuál es el que más duele? Spoiler: no es al que más le compran.
      </p>
      <RedDiagrama red={RED} caido={caido} />
      <p className="caption">
        {caido ? `Se cae ${sitio('bsj').nombre}: se frenan las tres líneas.` : 'La red funcionando: cada línea es un flujo de piezas.'}{' '}
        Empresa y números ficticios; el método es el que usó Ford después de Fukushima.
      </p>
    </header>
  );
}

/* ---------- 1. La situación ---------- */

function Situacion() {
  const [sel, setSel] = useState<string | null>('rie');
  const s = sel ? sitio(sel) : null;
  return (
    <Seccion n={1} titulo="La situación">
      <p>
        <strong>Agro Pampa</strong> fabrica tres máquinas en dos plantas del este de Córdoba. Vende todo lo que produce: cada
        semana que no fabrica, pierde el margen de lo que no entrega.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>Producto</th>
            <th className="r">Demanda por semana</th>
            <th className="r">Margen por unidad</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td className="r">{p.demanda}</td>
              <td className="r">{usd(p.margen ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        En total, <strong>{usd(margenSemanal)} de margen por semana</strong>. Para fabricar necesita chasis, cajas de engranajes,
        cilindros, monitores, neumáticos, discos, bulones y pintura. Algunas piezas tienen dos proveedores; otras, uno solo. Y
        algunos proveedores dependen a su vez de otros: la acería que les vende chapa a las metalúrgicas, la fábrica de chips que
        abastece a los monitores.
      </p>
      <RedDiagrama red={RED} sel={sel} onSelect={setSel} />
      {s && <FichaProveedor id={s.id} />}
      <p className="caption">Tocá un proveedor para ver qué entrega, cuánto stock hay y cuánto tardaría en volver si se cae.</p>
    </Seccion>
  );
}

function FichaProveedor({ id }: { id: string }) {
  const s = sitio(id);
  return (
    <div className="ficha">
      <strong>{s.nombre}</strong> <span className="muted">· {s.lugar}</span>
      <ul>
        {Object.entries(s.produce).map(([i, { cap, normal }]) => {
          const it = item(i);
          const otros = RED.sitios.filter((x) => x.id !== id && i in x.produce);
          return (
            <li key={i}>
              {it.nombre}: entrega {fmt(normal, normal % 1 ? 1 : 0)} {it.unidad} por semana (puede hasta {fmt(cap)}).{' '}
              {otros.length ? `También lo hace ${otros.map((o) => o.nombre).join(' y ')}.` : 'Es el único que lo hace.'} Stock:{' '}
              {semanas(it.stock / NEC[i])} de consumo.
            </li>
          );
        })}
        <li>
          Si se cae, dice que tarda <strong>{semanas(s.ttr)}</strong> en volver.
        </li>
      </ul>
    </div>
  );
}

/* ---------- 2. La pregunta de siempre ---------- */

function PreguntaDeSiempre() {
  return (
    <Seccion n={2} titulo="La pregunta de siempre">
      <p>
        ¿Cuáles son los proveedores críticos? La respuesta habitual mira la plata: a los que más se les compra, se los audita,
        se los visita y se les busca un reemplazo. Así se ve Agro Pampa desde Compras:
      </p>
      <BarrasGasto red={RED} nodos={nodosDeRiesgo(RED).map((s) => ({ id: s.id, gasto: gastoAnual(RED, s) }))} />
      <p>
        La otra respuesta clásica es la matriz de <strong>probabilidad × impacto</strong>. El problema: ¿cuál es la probabilidad
        de que se incendie la bulonera de San Justo? ¿De que un tifón pare una fábrica de chips en Taiwán? ¿De una pandemia? Para
        los eventos raros no hay datos para estimarla, y son justo los que más duelen.
      </p>
      <p className="note">
        La idea de David Simchi-Levi (MIT), que Ford aplicó a sus miles de proveedores: <strong>no preguntes por qué se puede
        caer un proveedor ni qué tan probable es. Preguntá qué pasa si se cae</strong>, por el motivo que sea.
      </p>
    </Seccion>
  );
}

/* ---------- 3. Dos relojes ---------- */

function DosRelojes() {
  const mdc = sitio('mdc');
  const chasis = item('chasis');
  const altChasis = RED.sitios.filter((s) => s.id !== 'mdc' && 'chasis' in s.produce).reduce((c, s) => c + s.produce.chasis.cap, 0);
  const falta = NEC.chasis - altChasis;
  const bsj = sitio('bsj');
  const bulon = item('bulon');
  return (
    <Seccion n={3} titulo="Dos relojes">
      <p>Cuando se cae un proveedor arrancan dos relojes:</p>
      <ul>
        <li>
          <strong>Tiempo para recuperarse</strong> (TTR, <em>time to recover</em>): cuánto tarda el proveedor en volver a
          entregar. Lo sabe él: se le pregunta.
        </li>
        <li>
          <strong>Tiempo para sobrevivir</strong> (TTS, <em>time to survive</em>): cuánto puede seguir la fábrica cumpliendo
          toda la demanda sin él, con el stock que tiene, los otros proveedores y la capacidad que sobra. Eso se calcula.
        </li>
      </ul>
      <p>Si el primer reloj es más largo que el segundo, hay semanas sin poder cumplir. Dos ejemplos que salen con una cuenta:</p>
      <div className="dos-columnas iguales">
        <div className="ficha">
          <strong>{mdc.nombre}</strong>
          <p>
            Hacen falta {fmt(NEC.chasis)} chasis por semana. Hay {fmt(chasis.stock)} en stock y la otra metalúrgica puede subir hasta{' '}
            {fmt(altChasis)} por semana: faltan {fmt(falta)} por semana, así que el stock dura{' '}
            <Tex tex={`${fmt(chasis.stock)} / ${fmt(falta)} = ${fmt(chasis.stock / falta, 1)}`} /> semanas.
          </p>
          <p>
            Tarda {semanas(mdc.ttr)} en volver: <strong>llega a tiempo</strong>, aunque es el proveedor al que más le compran.
          </p>
        </div>
        <div className="ficha">
          <strong>{bsj.nombre}</strong>
          <p>
            Hacen falta {fmt(NEC.bulon)} bulones por semana y hay {fmt(bulon.stock)}: {semanas(bulon.stock / NEC.bulon)}. Nadie
            más los fabrica con la certificación que piden las sembradoras.
          </p>
          <p>
            Tarda {semanas(bsj.ttr)} en volver (hay que rehacer el horno de tratamiento térmico):{' '}
            <strong>{fmt(bsj.ttr - bulon.stock / NEC.bulon)} semanas con la fábrica parada</strong>, por una pieza de{' '}
            {usd(bulon.costo)}.
          </p>
        </div>
      </div>
      <p>
        Pero la mayoría de los casos no sale con una cuenta. Si se cae la acería, las metalúrgicas tienen chapa por unos días,
        hay chasis armados y también se frenan los discos. Si una planta tiene capacidad libre, ¿conviene pasar ahí la
        producción? ¿Qué producto se sacrifica primero? Para eso hace falta un modelo.
      </p>
    </Seccion>
  );
}

/* ---------- 4. El modelo ---------- */

function ElModelo({ a }: { a: AnalisisResiliencia }) {
  const [sel, setSel] = useState('apa');
  const n = a.nodos.find((x) => x.id === sel)!;
  const s = sitio(sel);
  return (
    <Seccion n={4} titulo="El tiempo para sobrevivir es un PL">
      <p>
        Para cada proveedor <Tex tex="n" /> que se cae, buscamos el mayor tiempo <Tex tex="t" /> en el que la red puede cumplir toda
        la demanda. Las variables son cuánto produce cada sitio <Tex tex="j" /> de cada ítem <Tex tex="i" /> en esas{' '}
        <Tex tex="t" /> semanas:
      </p>
      <Tex
        block
        tex={
          '\\begin{aligned} \\max \\quad & t \\\\ \\text{s.a.} \\quad & \\textstyle\\sum_j x_{jp} \\geq d_p \\, t && \\text{demanda de cada producto} \\\\ & \\textstyle s_i + \\sum_j x_{ji} \\geq \\sum_{j,k} b_{ki} \\, x_{jk} && \\text{stock + lo producido cubre lo consumido} \\\\ & x_{ji} \\leq c_{ji} \\, t, \\quad x_{ni} = 0 && \\text{capacidad (cero en el caído)} \\\\ & \\textstyle\\sum_i x_{ji} \\leq C_j \\, t && \\text{capacidad de cada planta} \\end{aligned}'
        }
      />
      <p>
        <Tex tex="b_{ki}" /> es la lista de materiales: cuántas unidades de <Tex tex="i" /> lleva una unidad de <Tex tex="k" />{' '}
        (una sembradora grande lleva {item('sg').bom?.bulon} bulones; un chasis, {item('chasis').bom?.acero} toneladas de acero).
        Parece raro que <Tex tex="t" /> multiplique a las capacidades, pero es lineal: en <Tex tex="t" /> semanas se puede producir
        hasta <Tex tex="c \, t" />. El stock, en cambio, está una sola vez.
      </p>
      <p>Son {a.nodos.length} PL, uno por proveedor. Elegí uno:</p>
      <RedDiagrama red={RED} nodos={a.nodos} caido={sel} sel={sel} onSelect={setSel} />
      <div>
        <div className="ficha">
          <strong>Si se cae {s.nombre}</strong>
          <p className="big-num">{semanas(n.tts, RED.horizonte)}</p>
          <p>es lo que la red aguanta cumpliendo todo. Tarda {semanas(n.ttr)} en volver.</p>
          {n.frenos.length > 0 && (
            <>
              <p className="muted">Lo que pone el límite (restricciones activas):</p>
              <ul>
                {n.frenos.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}
          {n.frenos.length === 0 && <p className="muted">No lo frena nada: los demás pueden reemplazarlo del todo.</p>}
        </div>
      </div>
    </Seccion>
  );
}

/* ---------- 5. Todos los relojes ---------- */

function TodosLosRelojes({ a }: { a: AnalisisResiliencia }) {
  const [sel, setSel] = useState<string | null>(null);
  const exp = a.nodos.filter(expuesto);
  const nivel2 = exp.filter((n) => sitio(n.id).nivel === 2).length;
  return (
    <Seccion n={5} titulo="Los dos relojes de cada proveedor">
      <Relojes red={RED} nodos={a.nodos} sel={sel} onSelect={setSel} />
      <Leyenda
        items={[
          { clase: 'aguanta', texto: 'semanas que la red aguanta sin él (TTS)' },
          { clase: 'ttr', texto: 'semanas que tarda en volver (TTR)' },
          { clase: 'parado', texto: 'semanas sin poder cumplir' },
        ]}
      />
      {sel && <FichaProveedor id={sel} />}
      <p>
        <strong>
          {exp.length} de {a.nodos.length}
        </strong>{' '}
        proveedores están expuestos: tardan más en volver de lo que la red aguanta sin ellos. Los demás pueden caerse mañana y
        nadie afuera se entera.
      </p>
      <p>
        Son {exp.map((n) => sitio(n.id).nombre).join(', ')}.{' '}
        {nivel2 > 0 && (
          <>
            {nivel2 === 1 ? 'Uno es proveedor de un proveedor' : `${nivel2} son proveedores de proveedores`}: Agro Pampa no les
            compra nada y no aparecen en ninguna planilla.
          </>
        )}
      </p>
    </Seccion>
  );
}

/* ---------- 6. Cuánto cuesta cada caída ---------- */

function CuantoCuesta({ a }: { a: AnalisisResiliencia }) {
  const orden = [...a.nodos].sort((p, q) => q.perdida - p.perdida);
  const [primero, segundo] = orden;
  const total = a.nodos.reduce((s, n) => s + n.gasto, 0);
  // El proveedor de proveedores (nivel 2) que más pérdida genera, y su puesto.
  const k2 = orden.findIndex((n) => sitio(n.id).nivel === 2 && n.perdida > 0);
  const mayor = a.nodos.reduce((m, n) => (n.gasto > m.gasto ? n : m));
  return (
    <Seccion n={6} titulo="¿Cuánto cuesta cada caída?">
      <p>
        El TTS dice <em>si</em> hay problema. Para saber <em>cuánto</em>, un segundo PL: el proveedor está caído exactamente su TTR,
        y la fábrica reparte lo que tiene para perder el menor margen posible.
      </p>
      <Tex
        block
        tex={'\\begin{aligned} \\min \\quad & \\textstyle\\sum_p m_p \\, \\ell_p \\\\ \\text{s.a.} \\quad & \\textstyle\\sum_j x_{jp} + \\ell_p \\geq d_p \\cdot \\text{TTR}_n \\\\ & \\text{y las mismas restricciones de antes, con } t = \\text{TTR}_n \\end{aligned}'}
      />
      <p>
        <Tex tex="\ell_p" /> son las unidades que se dejan de vender y <Tex tex="m_p" /> su margen. Si faltan piezas, el modelo las
        manda a la máquina que más deja por pieza. Ahora sí, los dos rankings lado a lado:
      </p>
      <Pendiente red={RED} nodos={a.nodos} resaltar={[primero.id, ...(k2 >= 0 ? [orden[k2].id] : [])]} />
      <p>
        La caída más cara es <strong>{sitio(primero.id).nombre}</strong>: {usd(primero.perdida)}, y se lleva el{' '}
        {fmt((100 * primero.gasto) / total, 1)}% del gasto. Le sigue {sitio(segundo.id).nombre} ({usd(segundo.perdida)}).
        {k2 >= 0 && (
          <>
            {' '}
            En el puesto {k2 + 1} está <strong>{sitio(orden[k2].id).nombre}</strong>, a la que la fábrica ni siquiera le compra.
          </>
        )}{' '}
        Y {sitio(mayor.id).nombre}, a la que más le compran, {mayor.perdida > 0 ? `genera ${usd(mayor.perdida)}` : 'no genera pérdida'}.
      </p>
      <p className="note">
        Es lo mismo que encontró Ford: los riesgos más grandes estaban en proveedores chicos, de piezas de centavos, que nadie
        miraba porque en la planilla de compras no pesaban nada.
      </p>
    </Seccion>
  );
}

/* ---------- 7. Si tarda más ---------- */

function SiTardaMas({ a }: { a: AnalisisResiliencia }) {
  const [sel, setSel] = useState(a.curvas[0]?.id ?? '');
  const c = a.curvas.find((x) => x.id === sel);
  const n = a.nodos.find((x) => x.id === sel)!;
  // Pendiente de la curva una vez que se acaba el stock: margen perdido por semana.
  const pendiente = c ? c.perdida[c.perdida.length - 1] - c.perdida[c.perdida.length - 2] : 0;
  return (
    <Seccion n={7} titulo="¿Y si tarda más de lo que dice?">
      <p>
        El TTR es una estimación del proveedor, y los proveedores son optimistas. Resolviendo el PL de pérdida para 0, 1, 2… 20
        semanas se ve cómo crece el daño:
      </p>
      <div className="botones-nodo">
        {a.curvas.map((x) => (
          <button key={x.id} className={x.id === sel ? 'on' : ''} aria-pressed={x.id === sel} onClick={() => setSel(x.id)}>
            {sitio(x.id).corto}
          </button>
        ))}
      </div>
      <CurvasPerdida red={RED} a={a} sel={sel} onSelect={setSel} />
      <p>
        Cada curva es plana hasta el TTS (el stock y los demás proveedores cubren todo) y después sube. Con{' '}
        {sitio(sel).nombre} caído, cada semana más cuesta unos <strong>{usd(pendiente)}</strong>. Llega a tiempo si tarda hasta{' '}
        {semanas(n.tts)}; tarda {semanas(n.ttr)}.
      </p>
      <p>
        La forma también dice algo: la curva es <strong>convexa</strong>. Las primeras semanas de más se pueden absorber sacrificando
        la máquina que menos deja; después ya no queda qué sacrificar.
      </p>
    </Seccion>
  );
}

/* ---------- 8. Blindar ---------- */

function DescribirBlindaje({ b }: { b: Blindaje }) {
  const stock = Object.entries(b.stock).filter(([, q]) => q > 1e-6);
  if (!stock.length && !b.fuentes.length) return <p className="muted">Nada: todo queda como está.</p>;
  return (
    <ul>
      {stock.map(([i, q]) => (
        <li key={i}>
          {item(i).nombre}: {fmt(q / NEC[i], 1)} semanas más de stock ({fmt(q)} {item(i).unidad}, {usd(q * item(i).costo * RED.tasaStock)} por año)
        </li>
      ))}
      {b.fuentes.map((f) => {
        const x = accion(f);
        return x.tipo === 'fuente' ? (
          <li key={f}>
            {x.nombre} ({x.sitio.nombre}, {usd(x.costoAnual)} por año)
          </li>
        ) : null;
      })}
    </ul>
  );
}

const describirFuentes = (b: Blindaje) =>
  b.fuentes
    .map((f) => accion(f))
    .map((x) => x.nombre)
    .join(' y ');

function Blindar({ a }: { a: AnalisisResiliencia }) {
  const [B, setB] = useState(150000);
  const plan = a.planes.find((p) => p.factor === 1 && p.presupuesto === B)!;
  const conMargen = a.planes.find((p) => p.factor === OPCIONES.factorLento && p.presupuesto === B);
  const peorNodo = (p: PlanBlindaje) => Object.entries(p.porNodo).sort((x, y) => y[1] - x[1])[0];
  const [idPeor, valPeor] = peorNodo(plan);
  const acciones = RED.acciones;
  const serie = a.planes.filter((p) => p.factor === 1);
  const primerPaso = serie[1];
  const conFuente = serie.find((p) => p.blindaje.fuentes.length > 0);
  return (
    <Seccion n={8} titulo="Blindar la red con poca plata">
      <p>Hay varias formas de achicar el daño, cada una con su costo anual:</p>
      <ul>
        <li>
          <strong>Más stock</strong> de una pieza: cuesta el {fmt(RED.tasaStock * 100)}% de su valor por año (capital inmovilizado,
          depósito, seguro). Sirve para cualquier caída, pero sólo por las semanas que cubre.
        </li>
        <li>
          <strong>Homologar un segundo proveedor</strong>: pruebas, auditorías y un volumen mínimo para que te atienda. Es caro,
          pero no se acaba.
        </li>
      </ul>
      <p>
        Con {acciones.length} opciones y {a.nodos.length} caídas posibles, elegimos el blindaje que minimiza{' '}
        <strong>la peor pérdida</strong> sin pasarse del presupuesto. Es un PL entero (homologar o no es sí o no), con un reparto
        distinto para cada caída:
      </p>
      <Tex
        block
        tex={'\\begin{aligned} \\min \\quad & W \\\\ \\text{s.a.} \\quad & W \\geq \\textstyle\\sum_p m_p \\, \\ell^{n}_p \\quad \\text{para cada caída } n \\text{ (con su propio reparto)} \\\\ & \\textstyle\\sum_i h_i \\, e_i + \\sum_f F_f \\, z_f \\leq \\text{presupuesto}, \\quad z_f \\in \\{0, 1\\} \\end{aligned}'}
      />
      <CurvaPresupuesto planes={a.planes} intuitivo={a.intuitivo} sel={B} onSelect={setB} />
      <p className="caption">Tocá un punto para ver qué compra cada presupuesto.</p>
      <div className="dos-columnas">
        <div>
          <h3>Con {usd(B)} por año</h3>
          <DescribirBlindaje b={plan.blindaje} />
          <p>
            La peor caída pasa de {usd(a.planes[0].peor)} a <strong>{usd(plan.peor)}</strong>
            {valPeor > 0 ? ` (${sitio(idPeor).nombre})` : ''}.
          </p>
        </div>
        <div className="ficha">
          <strong>La intuición: reforzar al más grande</strong>
          <p>
            {describirFuentes(a.intuitivo.blindaje)} cuesta {usd(a.intuitivo.costo)} por año. La peor caída sigue costando{' '}
            <strong>{usd(a.intuitivo.peor)}</strong>: {sitio(a.nodos.reduce((m, n) => (n.gasto > m.gasto ? n : m)).id).nombre} ya
            llegaba a tiempo.
          </p>
        </div>
      </div>
      <p>
        Los primeros dólares rinden muchísimo: con {usd(primerPaso.presupuesto)} por año la peor caída baja de{' '}
        {usd(a.planes[0].peor)} a {usd(primerPaso.peor)}, casi todo con stock de piezas baratas.
        {conFuente && (
          <>
            {' '}
            Desde {usd(conFuente.presupuesto)} conviene además{' '}
            {conFuente.blindaje.fuentes.map((f) => accion(f).nombre.toLowerCase()).join(' y ')}: para una pieza cara, tener stock
            por muchas semanas cuesta más que un segundo proveedor.
          </>
        )}
      </p>
      {conMargen && (
        <>
          <h3>¿Y si los proveedores son optimistas?</h3>
          <p>
            El mismo presupuesto, planeado con los TTR que informan o con un {fmt((OPCIONES.factorLento - 1) * 100)}% de margen:
          </p>
          <div className="tabla-scroll">
            <table className="data decision">
              <thead>
                <tr>
                  <th>Plan con {usd(B)} por año</th>
                  <th className="r">Peor caída si tardan lo que dicen</th>
                  <th className="r">Si tardan un {fmt((OPCIONES.factorLento - 1) * 100)}% más</th>
                </tr>
              </thead>
              <tbody>
                {[plan, conMargen].map((p) => (
                  <tr key={p.factor} className={p.factor > 1 ? 'active' : ''}>
                    <td>{p.factor === 1 ? 'Planeado con el TTR informado' : 'Planeado con margen'}</td>
                    <td className="r">{usd(p.peor)}</td>
                    <td className="r">{usd(p.peorLento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {conMargen.peorLento < plan.peorLento - 1
              ? `Planear con margen ${conMargen.peor > plan.peor + 1 ? `cuesta algo en el caso previsto (${usd(conMargen.peor)} contra ${usd(plan.peor)})` : 'no cuesta nada en el caso previsto'} y, si los proveedores tardan más, baja la peor caída de ${usd(plan.peorLento)} a ${usd(conMargen.peorLento)}.`
              : 'Con este presupuesto no alcanza para cubrir un margen: conviene tapar primero lo seguro.'}{' '}
            El stock se agota; un segundo proveedor, no.
          </p>
        </>
      )}
    </Seccion>
  );
}

/* ---------- 9. La decisión ---------- */

function Decision({ a }: { a: AnalisisResiliencia }) {
  const plan = a.planes.find((p) => p.factor === OPCIONES.factorLento && p.presupuesto === PRESUPUESTO_RECOMENDADO)!;
  const [primero] = [...a.nodos].sort((p, q) => q.perdida - p.perdida);
  const gastoTotal = a.nodos.reduce((s, n) => s + n.gasto, 0);
  // Caídas que el plan intuitivo abarata respecto de no hacer nada.
  const mejoraIntuitivo = a.nodos.filter((n) => a.intuitivo.porNodo[n.id] < n.perdida - 1).length;
  return (
    <Seccion n={9} titulo="La decisión">
      <div className="memo">
        <span className="eyebrow">Recomendación al directorio de Agro Pampa</span>
        <p>
          Dejar de medir el riesgo de los proveedores por lo que se les compra. Hoy la caída más cara es la de{' '}
          {sitio(primero.id).nombre} ({usd(primero.perdida)}), que se lleva el {fmt((100 * primero.gasto) / gastoTotal, 1)}% del
          gasto.
        </p>
        <p>Destinar {usd(plan.costo)} por año a blindar la red, planeando con un margen sobre los TTR informados:</p>
        <DescribirBlindaje b={plan.blindaje} />
        <p>
          Con eso {plan.peor > 0 ? `ninguna caída de las previstas cuesta más de ${usd(plan.peor)}` : 'ninguna de las caídas previstas genera pérdidas'}, y si
          los proveedores tardan un {fmt((OPCIONES.factorLento - 1) * 100)}% más, la peor cuesta {usd(plan.peorLento)}. Sumar una
          tercera metalúrgica, que era la idea inicial, cuesta {usd(a.intuitivo.costo)} y{' '}
          {mejoraIntuitivo ? `abarata sólo ${mejoraIntuitivo} de las ${a.nodos.length} caídas` : 'no abarata ninguna caída'}.
        </p>
        <p>
          Pedirle el TTR a cada proveedor una vez por año (y a los proveedores de los proveedores) y volver a correr el análisis:
          son {a.nodos.length} PL, se resuelven en segundos.
        </p>
      </div>
    </Seccion>
  );
}

/* ---------- 10. Datos y supuestos ---------- */

function Datos({ onExit }: { onExit(): void }) {
  return (
    <Seccion n={10} titulo="Datos y supuestos">
      <p>
        La empresa, sus proveedores y todos los números son <strong>ficticios</strong>, armados para que se parezcan a una fábrica
        de maquinaria agrícola real. El método es real: lo publicaron Simchi-Levi, Schmidt y Wei en Harvard Business Review (2014)
        y lo aplicaron en Ford.
      </p>
      <h3>Los supuestos</h3>
      <ul>
        <li>
          <strong>Se cae un proveedor por vez</strong>, del todo, y vuelve entero al cabo de su TTR. Una inundación que afecta a
          dos a la vez es otro escenario.
        </li>
        <li>
          <strong>El TTR es conocido</strong>: lo informa cada proveedor. En la sección 7 se ve qué pasa si es más largo.
        </li>
        <li>
          <strong>Las plantas propias no se analizan</strong>: tienen su propio plan de contingencia y seguro. Sí cuentan como
          capacidad, que se puede reasignar entre productos.
        </li>
        <li>
          <strong>Demanda y márgenes constantes</strong>: lo que no se entrega se pierde (no se recupera después) y no hay
          sustitutos entre máquinas.
        </li>
        <li>
          <strong>Los proveedores alternativos pueden subir hasta su capacidad</strong> apenas se cae el otro, sin demora ni
          sobreprecio.
        </li>
        <li>
          <strong>Costos de blindaje</strong>: el stock cuesta el {fmt(RED.tasaStock * 100)}% de su valor por año; homologar un
          proveedor, un monto fijo anual.
        </li>
      </ul>
      <h3>Las simplificaciones del modelo</h3>
      <ul>
        <li>
          <strong>Sin calendario:</strong> el PL mira totales en el período (lo producido contra lo consumido), no semana por
          semana. Supone que el stock se puede usar en el momento justo; con plazos de entrega largos, el TTS real puede ser
          algo menor.
        </li>
        <li>
          <strong>Stock en un solo lugar:</strong> no importa si está en la planta o en el depósito del proveedor, ni cuánto
          tarda en moverse.
        </li>
        <li>
          <strong>Reparto perfecto:</strong> el modelo reasigna piezas y capacidad de la mejor manera posible. En la realidad
          la reacción tarda y es peor: el TTS es un techo.
        </li>
      </ul>
      <p className="caption">
        Fuentes: D. Simchi-Levi, W. Schmidt e Y. Wei, "From Superstorms to Factory Fires", Harvard Business Review, 2014; D.
        Simchi-Levi et al., "Identifying Risks and Mitigating Disruptions in the Automotive Supply Chain", Interfaces, 2015.
      </p>
      <button className="primary" onClick={onExit}>
        ← Volver al menú
      </button>
    </Seccion>
  );
}
