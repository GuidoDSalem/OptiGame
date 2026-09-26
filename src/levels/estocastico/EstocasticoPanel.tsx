import { useEffect, useRef, useState } from 'react';
import type { Corte } from '../../engine/benders';
import {
  convergio,
  demandaPromedio,
  iniciar,
  paso,
  peorEscenario,
  planDeterministico,
  propuestaMaestro,
  valoresDe,
  evaluar,
  type EstadoEstocastico,
  type Evaluacion,
  type ProblemaEstocastico,
  type Ronda,
} from '../../engine/estocastico';
import { ConvergenceChart } from '../../ui/components/ConvergenceChart';
import type { ManualProps } from '../types';
import type { VarianteEstocastica } from './template';

export const fmt = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/** Las primeras rondas (sin plantas) cuestan muchísimo y aplastan el gráfico: se dejan afuera. */
export const recortar = (n: number, ref: number) => (n > 1.5 * ref ? null : n);

const ORIGEN: Record<Ronda['origen'], string> = { jugador: 'vos', maestro: 'maestro', promedio: 'año promedio', peor: 'peor año' };

/** Texto del corte de un escenario: θ_s ≥ constante − (ahorro de cada planta)·y. */
function corteTexto(c: Corte, s: string, short: (id: string) => string): string {
  const partes = Object.entries(c.coefs)
    .filter(([, v]) => Math.abs(v) > 1e-6)
    .map(([d, v]) => `${v < 0 ? '−' : '+'} ${fmt(Math.abs(v))}·y(${short(d)})`);
  return `θ(${s}) ≥ ${fmt(c.constante)} ${partes.join(' ')}`;
}

/** Tabla de costos por escenario de una apertura. */
export function TablaEscenarios({ v, ev }: { v: VarianteEstocastica; ev: Evaluacion }) {
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Escenario</th>
          <th className="r">p</th>
          <th className="r">Flete</th>
          <th className="r">Silo bolsa ({v.unidad})</th>
          <th className="r">Costo</th>
        </tr>
      </thead>
      <tbody>
        {ev.escenarios.map((r, k) => (
          <tr key={r.escenario}>
            <td>{v.escenarios[k].label}</td>
            <td className="r">{fmt(v.escenarios[k].prob)}</td>
            <td className="r">{fmt(r.transporte)}</td>
            <td className={`r ${r.faltante > 1e-6 ? 'bad' : ''}`}>{fmt(r.faltante)}</td>
            <td className="r">{fmt(r.costo)}</td>
          </tr>
        ))}
        <tr>
          <td colSpan={4}>
            Fijo {fmt(ev.fijo)} + esperado {fmt(ev.esperado)}
          </td>
          <td className="r">
            <strong>{fmt(ev.total)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const memoria = new Map<string, { e: EstadoEstocastico; ultima: Evaluacion | null }>();

/** Intento manual del Benders estocástico: el jugador hace de maestro, los escenarios responden. */
export function crearPanelEstocastico(v: VarianteEstocastica, P: ProblemaEstocastico) {
  const short = (id: string) => v.plantas.find((d) => d.id === id)?.short ?? id;
  const label = (id: string) => v.plantas.find((d) => d.id === id)?.label ?? id;

  return function PanelEstocastico({ values, onChange }: ManualProps) {
    const [m, setM] = useState(() => memoria.get(v.id) ?? { e: iniciar('multi'), ultima: null as Evaluacion | null });
    const [ocupado, setOcupado] = useState(false);
    const vivo = useRef(true);
    useEffect(() => {
      vivo.current = true;
      return () => {
        vivo.current = false;
      };
    }, []);

    const guardar = (n: typeof m) => {
      memoria.set(v.id, n);
      setM(n);
    };
    const abiertas = new Set(v.plantas.filter((d) => (values[`y_${d.id}`] ?? 0) > 0.5).map((d) => d.id));
    const aperturas = (s: Set<string>) => Object.fromEntries(v.plantas.map((d) => [`y_${d.id}`, s.has(d.id) ? 1 : 0]));

    const jugar = async (e: EstadoEstocastico, s: Set<string>, origen: Ronda['origen']) => {
      const r = await paso(P, e, s, origen);
      if (!vivo.current) return null;
      guardar({ e: r.estado, ultima: r.evaluacion });
      onChange(valoresDe(P, r.evaluacion));
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

    const e = m.e;
    const listo = convergio(e);
    const ultimaRonda = e.rondas[e.rondas.length - 1];

    return (
      <div className="benders">
        <p className="lead small">
          Elegí qué plantas alquilar <strong>sin saber cómo viene el año</strong>. Cada ronda prueba tu elección en los{' '}
          {v.escenarios.length} escenarios: cada uno resuelve su reparto y le devuelve al maestro <strong>su propio corte</strong>.
        </p>

        <div className="project-grid">
          {v.plantas.map((d) => (
            <button
              key={d.id}
              className={`project ${abiertas.has(d.id) ? 'on' : ''}`}
              aria-pressed={abiertas.has(d.id)}
              disabled={ocupado}
              onClick={() => {
                const s = new Set(abiertas);
                if (s.has(d.id)) s.delete(d.id);
                else s.add(d.id);
                onChange(aperturas(s));
              }}
            >
              <strong>{d.label}</strong>
              <span>
                fijo {v.moneda} {d.costoFijo} · {d.capacidad} {v.unidad}
              </span>
            </button>
          ))}
        </div>

        <div className="actions">
          <button className="primary" disabled={ocupado} onClick={() => accion(async () => void (await jugar(e, abiertas, 'jugador')))}>
            Probar en los {v.escenarios.length} escenarios (nueva ronda)
          </button>
          <button disabled={ocupado || listo} onClick={() => accion(async () => void (await jugar(e, await propuestaMaestro(P, e), 'maestro')))}>
            Que decida el maestro
          </button>
          <button
            disabled={ocupado || listo}
            onClick={() =>
              accion(async () => {
                let est: EstadoEstocastico | null = e;
                for (let k = 0; est && !convergio(est) && k < 40 && vivo.current; k++) {
                  est = await jugar(est, await propuestaMaestro(P, est), 'maestro');
                  await new Promise((r) => setTimeout(r, 200));
                }
                // Al terminar, mostrar la mejor apertura (no la última propuesta).
                const mejor = est?.rondas.find((r) => r.total === est!.mejor);
                if (mejor && vivo.current) {
                  const ev = await evaluar(P, new Set(mejor.abiertos));
                  if (vivo.current) {
                    guardar({ e: est!, ultima: ev });
                    onChange(valoresDe(P, ev));
                  }
                }
              })
            }
          >
            Piloto automático
          </button>
          <button disabled={ocupado} onClick={() => guardar({ e: iniciar('multi'), ultima: null })}>
            Reiniciar
          </button>
        </div>
        <div className="actions">
          <button
            disabled={ocupado}
            onClick={() => accion(async () => void (await jugar(e, await planDeterministico(P, demandaPromedio(P)), 'promedio')))}
            title="Resuelve el modelo con la cosecha promedio y prueba esa decisión en los escenarios reales"
          >
            Plan para el año promedio
          </button>
          <button
            disabled={ocupado}
            onClick={() => accion(async () => void (await jugar(e, await planDeterministico(P, peorEscenario(P).demanda), 'peor')))}
            title="Resuelve el modelo con la cosecha del año más lluvioso"
          >
            Plan para el peor año
          </button>
        </div>

        {m.ultima && (
          <>
            <h4>
              Última prueba: {m.ultima.abiertos.length ? m.ultima.abiertos.map(short).join(', ') : 'ninguna planta'}
            </h4>
            <TablaEscenarios v={v} ev={m.ultima} />
          </>
        )}

        {e.rondas.length > 0 && (
          <>
            <div className="bounds">
              <span>
                Cota inferior (maestro): <strong>{fmt(e.cotaInferior)}</strong>
              </span>
              <span>
                Mejor plan: <strong>{fmt(e.mejor)}</strong>
              </span>
              <span>
                Brecha: <strong>{fmt(Math.max(0, e.mejor - e.cotaInferior))}</strong>
              </span>
            </div>
            {listo && (
              <p className="note">
                ¡Las cotas se tocaron! El plan de <strong>{v.moneda} {fmt(e.mejor)}</strong> es el de menor costo esperado,
                y cada ronda sumó {v.escenarios.length} cortes, uno por escenario.
              </p>
            )}
            <ConvergenceChart
              yLabel={`Costo esperado (${v.moneda})`}
              series={[
                { label: 'plan de la ronda', values: e.rondas.map((r) => recortar(r.total, e.mejor)), className: 'propuesta' },
                { label: 'mejor plan (cota superior)', values: e.rondas.map((r) => recortar(r.mejor, e.mejor)), className: 'cota-superior' },
                { label: 'cota inferior del maestro', values: e.rondas.map((r) => r.cotaInferior), className: 'cota-inferior' },
              ]}
            />
            <table className="data rounds">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Quién</th>
                  <th>Plantas</th>
                  {v.escenarios.map((s) => (
                    <th key={s.id} className="r">
                      {s.short}
                    </th>
                  ))}
                  <th className="r">Total</th>
                </tr>
              </thead>
              <tbody>
                {e.rondas.map((r, i) => (
                  <tr key={i} className={r.total === e.mejor ? 'active' : ''}>
                    <td>{i + 1}</td>
                    <td>{ORIGEN[r.origen]}</td>
                    <td title={r.abiertos.map(label).join(', ')}>{r.abiertos.map(short).join(', ') || '—'}</td>
                    {r.escenarios.map((s) => (
                      <td key={s.escenario} className="r">
                        {fmt(s.costo)}
                      </td>
                    ))}
                    <td className="r">
                      <strong>{fmt(r.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ultimaRonda && (
              <details className="small">
                <summary>Cortes de la última ronda</summary>
                <ul className="cortes-lista">
                  {ultimaRonda.escenarios.map((s, k) => (
                    <li key={s.escenario} className="mono">
                      {corteTexto(s.corte, v.escenarios[k].short, short)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    );
  };
}
