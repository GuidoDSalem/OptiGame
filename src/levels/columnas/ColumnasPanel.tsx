import { useEffect, useRef, useState } from 'react';
import {
  convergio,
  costoReducido,
  describir,
  enteroConPatrones,
  iniciarColumnas,
  paso,
  redondeoHaciaArriba,
  sobrante,
  usado,
  valorPatron,
  variableId,
  type EstadoColumnas,
  type Patron,
  type ProblemaCorte,
  type Ronda,
} from '../../engine/columnas';
import { ConvergenceChart } from '../../ui/components/ConvergenceChart';
import type { ManualProps } from '../types';
import { COLORES_PIEZA, PatronBar, colorCss } from './PatronBar';
import type { VarianteColumnas } from './template';

const fmt = (n: number, d = 2) => n.toLocaleString('es-AR', { maximumFractionDigits: d });

/** Serie del gráfico: el arranque (ronda 0) y una entrada por ronda. */
export const serieLp = (e: EstadoColumnas) => [e.inicial.lp, ...e.rondas.map((r) => r.lp)];
export const serieCota = (e: EstadoColumnas) => [e.inicial.cotaInferior, ...e.rondas.map((r) => r.cotaInferior)];

// El estado del algoritmo sobrevive a cambiar de fase dentro del nivel.
const memoria = new Map<string, EstadoColumnas>();

const MOTIVOS = {
  vacio: 'El patrón está vacío: agregale alguna pieza.',
  'no-entra': 'Ese patrón no entra en la bobina.',
  repetido: 'Ese patrón ya está en el maestro.',
  'no-mejora': '',
};

/** Intento manual del nivel de generación de columnas: el jugador hace de pricing. */
export function crearPanelColumnas(v: VarianteColumnas, P: ProblemaCorte) {
  const vacio = (): Patron => Object.fromEntries(v.pedidos.map((q) => [q.id, 0]));

  return function PanelColumnas({ onChange }: ManualProps) {
    const [estado, setEstado] = useState<EstadoColumnas | null>(memoria.get(v.id) ?? null);
    const [propuesta, setPropuesta] = useState<Patron>(vacio);
    const [aviso, setAviso] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);
    const vivo = useRef(true);

    const guardar = (e: EstadoColumnas) => {
      memoria.set(v.id, e);
      setEstado(e);
      // Lo que se ve (y se evalúa) es la relajación redondeada para arriba: siempre cumple.
      onChange(redondeoHaciaArriba(e.maestro.x).x);
    };

    useEffect(() => {
      vivo.current = true;
      if (!estado) iniciarColumnas(P).then((e) => vivo.current && guardar(e));
      else onChange(redondeoHaciaArriba(estado.maestro.x).x);
      return () => {
        vivo.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const accion = async (f: () => Promise<void>) => {
      setOcupado(true);
      try {
        await f();
      } finally {
        if (vivo.current) setOcupado(false);
      }
    };

    const jugar = async (e: EstadoColumnas, p: Patron, origen: Ronda['origen']) => {
      const r = await paso(P, e, p, origen);
      if (!vivo.current) return null;
      if (!r.ok) {
        setAviso(
          r.motivo === 'no-mejora'
            ? `Ese patrón tiene costo reducido ${fmt(r.costoReducido ?? 0, 3)} ≥ 0: no le gana a los que ya hay, el maestro no lo usaría.`
            : MOTIVOS[r.motivo],
        );
        return null;
      }
      setAviso(null);
      guardar(r.estado);
      return r.estado;
    };

    if (!estado) return <p className="muted">Resolviendo el maestro…</p>;

    const pi = estado.maestro.duales;
    const listo = convergio(estado);
    const valor = valorPatron(P, pi, propuesta);
    const cr = costoReducido(P, pi, propuesta);
    const resto = sobrante(P, propuesta);
    const vaciaProp = v.pedidos.every((q) => (propuesta[q.id] ?? 0) === 0);
    const setN = (id: string, n: number) => setPropuesta({ ...propuesta, [id]: Math.max(0, n) });

    return (
      <div className="benders columnas">
        <p className="lead small">
          El maestro arranca con los patrones obvios (un solo ancho por bobina). Vos sos el <strong>pricing</strong>:
          con los precios sombra, armá un patrón que valga <strong>más de 1 bobina</strong>. Si lo encontrás, entra al
          maestro y los precios cambian.
        </p>

        <table className="data pricing">
          <thead>
            <tr>
              <th>Pieza</th>
              <th className="r">Pedido</th>
              <th className="r" title="Precio sombra del pedido: cuántas bobinas vale una pieza">
                π (bobinas)
              </th>
              <th className="r">Tu patrón</th>
            </tr>
          </thead>
          <tbody>
            {v.pedidos.map((q, i) => (
              <tr key={q.id}>
                <td>
                  <span className="dot" style={{ background: colorCss(COLORES_PIEZA[i % COLORES_PIEZA.length]) }} />
                  <strong>{q.ancho} cm</strong> <span className="muted">{q.label}</span>
                </td>
                <td className="r">{q.cantidad}</td>
                <td className="r">{fmt(pi[q.id] ?? 0, 3)}</td>
                <td className="r nowrap">
                  <button className="icon" disabled={(propuesta[q.id] ?? 0) === 0} onClick={() => setN(q.id, (propuesta[q.id] ?? 0) - 1)}>
                    −
                  </button>
                  <span className="n">{propuesta[q.id] ?? 0}</span>
                  <button className="icon" disabled={q.ancho > resto} onClick={() => setN(q.id, (propuesta[q.id] ?? 0) + 1)}>
                    +
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <PatronBar P={P} p={propuesta} />
        <p className="small">
          Usa <strong>{usado(P, propuesta)}</strong> de {v.ancho} cm. Vale{' '}
          <strong>{fmt(valor, 3)}</strong> bobinas → costo reducido{' '}
          <strong className={cr < -1e-7 ? 'good' : ''}>{fmt(cr, 3)}</strong>
          {vaciaProp ? '' : cr < -1e-7 ? ': ¡conviene!' : ': no conviene.'}
        </p>

        <div className="actions">
          <button
            className="primary"
            disabled={ocupado || vaciaProp}
            onClick={() =>
              accion(async () => {
                if (await jugar(estado, propuesta, 'jugador')) setPropuesta(vacio());
              })
            }
          >
            Agregar este patrón
          </button>
          <button disabled={ocupado || listo} onClick={() => accion(async () => void (await jugar(estado, estado.sugerido.patron, 'pricing')))}>
            Que busque el pricing
          </button>
          <button
            disabled={ocupado || listo}
            onClick={() =>
              accion(async () => {
                let e: EstadoColumnas | null = estado;
                for (let k = 0; e && !convergio(e) && k < 40 && vivo.current; k++) {
                  e = await jugar(e, e.sugerido.patron, 'pricing');
                  await new Promise((r) => setTimeout(r, 250));
                }
              })
            }
          >
            Piloto automático
          </button>
          <button
            disabled={ocupado}
            onClick={() =>
              accion(async () => {
                memoria.delete(v.id);
                setAviso(null);
                setPropuesta(vacio());
                guardar(await iniciarColumnas(P));
              })
            }
          >
            Reiniciar
          </button>
        </div>
        {aviso && <p className="error small">{aviso}</p>}

        <div className="bounds">
          <span>
            Maestro (relajación): <strong>{fmt(estado.maestro.objetivo)}</strong> bobinas
          </span>
          <span>
            Cota inferior: <strong>{fmt(estado.cotaInferior)}</strong> → al menos{' '}
            <strong>{Math.ceil(estado.cotaInferior - 1e-6)}</strong> bobinas
          </span>
          {!listo && (
            <span className="muted">
              Mejor patrón posible ahora: vale {fmt(estado.sugerido.valor, 3)}
            </span>
          )}
        </div>
        {listo && (
          <div className="note">
            <p>
              ¡Ningún patrón tiene costo reducido negativo! La relajación de <strong>{fmt(estado.maestro.objetivo)}</strong>{' '}
              bobinas es óptima para <em>todos</em> los patrones, y sólo hicieron falta {estado.patrones.length}.
              Ahora hay que pasar a bobinas enteras:
            </p>
            <div className="actions">
              <button disabled={ocupado} onClick={() => onChange(redondeoHaciaArriba(estado.maestro.x).x)}>
                Redondear cada patrón para arriba ({redondeoHaciaArriba(estado.maestro.x).bobinas})
              </button>
              <button
                className="primary"
                disabled={ocupado}
                onClick={() =>
                  accion(async () => {
                    const s = await enteroConPatrones(P, estado.patrones);
                    if (vivo.current) onChange(s.x);
                  })
                }
              >
                Resolver entero con estos patrones
              </button>
            </div>
          </div>
        )}

        <ConvergenceChart
          yLabel="Bobinas"
          series={[
            { label: 'maestro (relajación)', values: serieLp(estado), className: 'cota-superior' },
            { label: 'cota inferior (Farley)', values: serieCota(estado), className: 'cota-inferior' },
          ]}
        />

        <h4>Patrones del maestro</h4>
        <table className="data rounds">
          <thead>
            <tr>
              <th>#</th>
              <th>Quién</th>
              <th>Patrón</th>
              <th className="r">Sobra</th>
              <th className="r">Costo red. al entrar</th>
              <th className="r">Bobinas (relajación)</th>
            </tr>
          </thead>
          <tbody>
            {estado.patrones.map((p, i) => {
              const k = i - (estado.patrones.length - estado.rondas.length);
              const r = k >= 0 ? estado.rondas[k] : null;
              const x = estado.maestro.x[variableId(P, p)] ?? 0;
              return (
                <tr key={i} className={x > 1e-6 ? 'active' : ''}>
                  <td>{i + 1}</td>
                  <td>{r ? (r.origen === 'pricing' ? 'pricing' : 'vos') : 'inicial'}</td>
                  <td>
                    <PatronBar P={P} p={p} compact />
                    <span className="cut">{describir(P, p)}</span>
                  </td>
                  <td className="r">{sobrante(P, p)} cm</td>
                  <td className="r">{r ? fmt(r.costoReducido, 3) : '—'}</td>
                  <td className="r">{fmt(x)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
}
