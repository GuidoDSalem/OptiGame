import { useEffect, useRef, useState } from 'react';
import {
  convergio,
  iniciarBenders,
  paso,
  propuestaMaestro,
  resolverSubproblema,
  type Corte,
  type EstadoBenders,
  type ProblemaLocalizacion,
  type Ronda,
} from '../../engine/benders';
import { ConvergenceChart } from '../../ui/components/ConvergenceChart';
import type { ManualProps } from '../types';
import type { VarianteBenders } from './template';

const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/** Texto del corte: θ ≥ constante − (ahorro si abre cada depósito)·y. */
export function corteTexto(c: Corte, short: (id: string) => string): string {
  const partes = Object.entries(c.coefs)
    .filter(([, v]) => Math.abs(v) > 1e-6)
    .map(([d, v]) => `${v < 0 ? '−' : '+'} ${fmt(Math.abs(v))}·y(${short(d)})`);
  return `θ ≥ ${fmt(c.constante)} ${partes.join(' ')}`;
}

// El estado del algoritmo sobrevive a cambiar de fase dentro del nivel.
const memoria = new Map<string, EstadoBenders>();

/** Intento manual del nivel de Benders: el jugador hace de maestro. */
export function crearPanelBenders(v: VarianteBenders, P: ProblemaLocalizacion) {
  const short = (id: string) => v.depositos.find((d) => d.id === id)?.short ?? id;
  const label = (id: string) => v.depositos.find((d) => d.id === id)?.label ?? id;

  return function PanelBenders({ values, onChange }: ManualProps) {
    const [estado, setEstado] = useState<EstadoBenders | null>(memoria.get(v.id) ?? null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState(false);
    const vivo = useRef(true);

    useEffect(() => {
      vivo.current = true;
      if (!estado) iniciarBenders(P).then((e) => vivo.current && guardar(e));
      return () => {
        vivo.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const guardar = (e: EstadoBenders) => {
      memoria.set(v.id, e);
      setEstado(e);
    };
    const abiertos = new Set(v.depositos.filter((d) => (values[`y_${d.id}`] ?? 0) > 0.5).map((d) => d.id));
    const aperturas = (s: Set<string>) => Object.fromEntries(v.depositos.map((d) => [`y_${d.id}`, s.has(d.id) ? 1 : 0]));

    /** Una ronda con la apertura dada; devuelve el estado nuevo (o null si no alcanzó la capacidad). */
    const jugar = async (e: EstadoBenders, s: Set<string>, origen: Ronda['origen']) => {
      const r = await paso(P, e, s, origen);
      if (!vivo.current) return null;
      if (!r.factible) {
        setAviso(`Con esos depósitos no alcanza la capacidad: faltan ${fmt(r.faltante)} camiones. Eso es lo que detecta un corte de factibilidad.`);
        onChange(aperturas(s));
        return null;
      }
      setAviso(null);
      guardar(r.estado);
      onChange({ ...aperturas(s), ...r.flujos });
      return r.estado;
    };

    const accion = async (f: () => Promise<void>) => {
      setOcupado(true);
      try {
        await f();
      } finally {
        if (vivo.current) setOcupado(false);
      }
    };

    const listo = estado ? convergio(estado) : false;

    return (
      <div className="benders">
        <p className="lead small">
          Sos el <strong>maestro</strong>: elegí qué depósitos abrir y pedile al subproblema que resuelva el
          transporte. Cada ronda te devuelve el costo real y un <strong>corte</strong> que el maestro aprende.
        </p>

        <div className="project-grid">
          {v.depositos.map((d) => (
            <button
              key={d.id}
              className={`project ${abiertos.has(d.id) ? 'on' : ''}`}
              aria-pressed={abiertos.has(d.id)}
              disabled={ocupado}
              onClick={() => {
                const s = new Set(abiertos);
                if (s.has(d.id)) s.delete(d.id);
                else s.add(d.id);
                onChange(aperturas(s)); // hasta resolver, no hay envíos
              }}
            >
              <strong>{d.label}</strong>
              <span>
                fijo $k {d.costoFijo} · capacidad {d.capacidad}
              </span>
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="primary" disabled={!estado || ocupado} onClick={() => accion(async () => void (await jugar(estado!, abiertos, 'jugador')))}>
            Resolver el transporte (nueva ronda)
          </button>
          <button
            disabled={!estado || ocupado || listo}
            onClick={() =>
              accion(async () => {
                const s = await propuestaMaestro(P, estado!);
                await jugar(estado!, s, 'maestro');
              })
            }
          >
            Que decida el maestro
          </button>
          <button
            disabled={!estado || ocupado || listo}
            onClick={() =>
              accion(async () => {
                let e: EstadoBenders | null = estado!;
                for (let k = 0; e && !convergio(e) && k < 40 && vivo.current; k++) {
                  e = await jugar(e, await propuestaMaestro(P, e), 'maestro');
                  await new Promise((r) => setTimeout(r, 180));
                }
                // Al terminar, mostrar la mejor solución (no la última propuesta).
                const mejor = e?.rondas.find((r) => r.total === e!.mejor);
                if (mejor && vivo.current) {
                  const s = new Set(mejor.abiertos);
                  const sub = await resolverSubproblema(P, s);
                  if (sub.factible && vivo.current) onChange({ ...aperturas(s), ...sub.flujos });
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
                guardar(await iniciarBenders(P));
                setAviso(null);
                onChange({});
              })
            }
          >
            Reiniciar
          </button>
        </div>
        {aviso && <p className="error small">{aviso}</p>}

        {estado && estado.rondas.length > 0 && (
          <>
            <div className="bounds">
              <span>
                Cota inferior (maestro): <strong>{fmt(estado.cotaInferior)}</strong>
              </span>
              <span>
                Mejor solución: <strong>{fmt(estado.mejor)}</strong>
              </span>
              <span>
                Brecha: <strong>{fmt(Math.max(0, estado.mejor - estado.cotaInferior))}</strong>
              </span>
            </div>
            {listo && (
              <p className="note">
                ¡Las cotas se tocaron! Está <strong>demostrado</strong> que {fmt(estado.mejor)} es el costo mínimo, y
                sólo hizo falta probar {new Set(estado.rondas.map((r) => [...r.abiertos].sort().join())).size} de las{' '}
                {2 ** v.depositos.length} combinaciones posibles.
              </p>
            )}
            <ConvergenceChart
              yLabel="Costo ($k/sem)"
              series={[
                { label: 'propuesta de la ronda', values: estado.rondas.map((r) => r.total), className: 'propuesta' },
                { label: 'mejor solución (cota superior)', values: estado.rondas.map((r) => r.mejor), className: 'cota-superior' },
                { label: 'cota inferior del maestro', values: estado.rondas.map((r) => r.cotaInferior), className: 'cota-inferior' },
              ]}
            />
            <table className="data rounds">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Quién</th>
                  <th>Abiertos</th>
                  <th className="r">Total</th>
                  <th>Corte aprendido</th>
                </tr>
              </thead>
              <tbody>
                {estado.rondas.map((r, i) => (
                  <tr key={i} className={r.total === estado.mejor ? 'active' : ''}>
                    <td>{i + 1}</td>
                    <td>{r.origen === 'maestro' ? 'maestro' : 'vos'}</td>
                    <td title={r.abiertos.map(label).join(', ')}>{r.abiertos.map(short).join(', ')}</td>
                    <td className="r">
                      {fmt(r.costoFijo)} + {fmt(r.transporte)} = <strong>{fmt(r.total)}</strong>
                    </td>
                    <td className="cut">{corteTexto(r.corte, short)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    );
  };
}
