import { useState } from 'react';
import {
  abiertos,
  agregarCorte,
  corteDesdeFila,
  cotaSuperior,
  eleccionAutomatica,
  esEntero,
  filaMasFraccionaria,
  iniciarArbol,
  iniciarCortes,
  lpEntero,
  nombreVar,
  ramificar,
  tableau,
  termino,
  type Arbol,
  type EstadoCortes,
  type Fila,
  type Problema2D,
  type Vec,
} from '../../engine/ramificacion';
import type { ManualProps } from '../types';
import { ArbolView } from './ArbolView';
import { Poliedro } from './Poliedro';
import { idVar, type VarianteSolver } from './template';

export const fmt = (n: number, d = 2) => n.toLocaleString('es-AR', { maximumFractionDigits: d });

/** "3x + 4y ≤ 25" */
export function filaTexto(f: Fila): string {
  const t = (c: number, v: string, primero: boolean) =>
    c === 0 ? '' : `${c < 0 ? (primero ? '−' : ' − ') : primero ? '' : ' + '}${Math.abs(c) === 1 ? '' : fmt(Math.abs(c))}${v}`;
  const izq = t(f.a[0], 'x', true) + t(f.a[1], 'y', f.a[0] === 0);
  return `${izq || '0'} ≤ ${fmt(f.b)}`;
}

/** "x − 0,3·s(horas) + 0,4·s(madera)" */
const combinacion = (basica: string, coefs: Vec, holguras: [string, string], explicito = false) =>
  basica +
  coefs
    .map((c, l) =>
      Math.abs(c) < 1e-9 && !explicito
        ? ''
        : `${c < 0 ? ' − ' : ' + '}${Math.abs(c) === 1 && !explicito ? '' : `${fmt(Math.abs(c), 3)}·`}s(${holguras[l]})`,
    )
    .join('');

interface Memoria {
  modo: 'arbol' | 'cortes';
  arbol: Arbol;
  sel: number | null;
  cortes: EstadoCortes;
  ultimo: string | null;
}
const memoria = new Map<string, Memoria>();

/** Intento manual de "Dentro del solver": el jugador ramifica o corta. */
export function crearPanelSolver(v: VarianteSolver, P: Problema2D) {
  const [p0, p1] = v.productos;
  const inicial = (): Memoria => ({ modo: 'arbol', arbol: iniciarArbol(P), sel: 0, cortes: iniciarCortes(P), ultimo: null });
  const aValores = (p: Vec) => ({ [idVar(p0)]: p[0], [idVar(p1)]: p[1] });

  return function PanelSolver({ values, onChange }: ManualProps) {
    const [m, setM] = useState<Memoria>(() => memoria.get(v.id) ?? inicial());
    const [ocupado, setOcupado] = useState(false);
    const guardar = (n: Memoria) => {
      memoria.set(v.id, n);
      setM(n);
    };
    const elegido: Vec = [values[idVar(p0)] ?? 0, values[idVar(p1)] ?? 0];
    const ejes = { P, xmax: v.xmax, ymax: v.ymax, xLabel: `x: ${p0.plural}`, yLabel: `y: ${p1.plural}` };

    const tabs = (
      <div className="solver-tabs">
        <button className={m.modo === 'arbol' ? 'on' : ''} onClick={() => guardar({ ...m, modo: 'arbol' })}>
          Branch and bound
        </button>
        <button className={m.modo === 'cortes' ? 'on' : ''} onClick={() => guardar({ ...m, modo: 'cortes' })}>
          Planos de corte
        </button>
      </div>
    );

    if (m.modo === 'arbol') {
      const a = m.arbol;
      const nodo = m.sel !== null ? a.nodos[m.sel] : null;
      const actualizar = (arbol: Arbol) => {
        const sig = abiertos(arbol);
        const sel = sig.length ? (sig.find((n) => n.id === m.sel) ?? sig[0]).id : null;
        guardar({ ...m, arbol, sel });
        if (arbol.incumbente && arbol.incumbente.z !== a.incumbente?.z) onChange(aValores(arbol.incumbente.x));
      };
      const paso = (arbol: Arbol) => {
        const e = eleccionAutomatica(arbol);
        return e ? ramificar(P, arbol, e.id, e.k) : null;
      };
      const hojasAbiertas = abiertos(a).map((n) => n.cotas);
      const sup = cotaSuperior(a);
      return (
        <div className="solver-panel">
          {tabs}
          <p className="lead small">
            Sos el solver. Tocá un nodo <strong>abierto</strong> del árbol y elegí por qué variable partirlo. Las
            ramas que no tienen solución, que dan enteros o que no pueden mejorar a la mejor entera, se cierran solas.
            También podés tocar cualquier punto del gráfico para probarlo a mano.
          </p>
          <Poliedro
            {...ejes}
            cotas={nodo?.cotas}
            otras={hojasAbiertas.filter((_, i) => abiertos(a)[i].id !== m.sel)}
            lp={nodo?.lp.factible ? nodo.lp.x : null}
            incumbente={a.incumbente?.x}
            elegido={elegido}
            onPick={(p) => onChange(aValores(p))}
          />
          <div className="bounds benders-like">
            <span>
              Mejor entera: <strong>{a.incumbente ? `${v.moneda} ${a.incumbente.z}` : '—'}</strong>
              {a.incumbente && ` en (${a.incumbente.x.join(', ')})`}
            </span>
            <span>
              Cota superior: <strong>{Number.isFinite(sup) ? fmt(sup) : '—'}</strong>
            </span>
            <span>
              Brecha: <strong>{a.incumbente ? fmt(Math.max(0, sup - a.incumbente.z)) : '∞'}</strong>
            </span>
          </div>

          {nodo && nodo.estado === 'abierto' && (
            <div className="actions">
              {([0, 1] as const).map((k) => (
                <button
                  key={k}
                  className={k === 0 ? 'primary' : ''}
                  disabled={ocupado || esEntero(nodo.lp.x[k])}
                  onClick={() => actualizar(ramificar(P, a, nodo.id, k)!)}
                >
                  Partir por {nombreVar(k)} = {fmt(nodo.lp.x[k])}: {nombreVar(k)} ≤ {Math.floor(nodo.lp.x[k])} | {nombreVar(k)} ≥{' '}
                  {Math.floor(nodo.lp.x[k]) + 1}
                </button>
              ))}
            </div>
          )}
          <div className="actions">
            <button disabled={ocupado || termino(a)} onClick={() => actualizar(paso(a)!)}>
              Que decida el solver
            </button>
            <button
              disabled={ocupado || termino(a)}
              onClick={async () => {
                setOcupado(true);
                let arbol = a;
                while (!termino(arbol)) {
                  arbol = paso(arbol)!;
                  actualizar(arbol);
                  await new Promise((r) => setTimeout(r, 450));
                }
                setOcupado(false);
              }}
            >
              Piloto automático
            </button>
            <button disabled={ocupado} onClick={() => guardar({ ...m, arbol: iniciarArbol(P), sel: 0 })}>
              Reiniciar
            </button>
          </div>
          {termino(a) && a.incumbente && (
            <p className="note">
              ¡No quedan ramas abiertas! Está demostrado que <strong>({a.incumbente.x.join(', ')})</strong> con{' '}
              {v.moneda} {a.incumbente.z} es el óptimo. Hicieron falta {a.nodos.length} relajaciones.
            </p>
          )}
          <ArbolView arbol={a} seleccionado={m.sel} onSelect={(id) => guardar({ ...m, sel: id })} />
        </div>
      );
    }

    // ---------- Planos de corte ----------
    const e = m.cortes;
    const filasActuales = [...P.filas, ...e.cortes];
    const T = e.lp.factible ? tableau(e.lp, filasActuales) : null;
    const listo = lpEntero(e.lp);
    const cortar = (e2: EstadoCortes | null, basica: string) => {
      if (!e2) return;
      guardar({ ...m, cortes: e2, ultimo: basica });
      if (lpEntero(e2.lp)) onChange(aValores(e2.lp.x));
    };
    const ultimoPaso = e.pasos[e.pasos.length - 1];
    const previo = e.pasos.length > 1 ? e.pasos[e.pasos.length - 2].lp : e.inicial;
    const derivacion =
      ultimoPaso && m.ultimo ? corteDesdeFila(P, e.cortes.slice(0, -1), previo, m.ultimo) : null;

    return (
      <div className="solver-panel">
        {tabs}
        <p className="lead small">
          Ahora sin árbol: mirá las filas del <strong>tableau óptimo</strong> y elegí una con valor fraccionario. De
          ahí sale un corte que deja afuera al óptimo del LP sin perder ningún punto entero.
        </p>
        <Poliedro {...ejes} cortes={e.cortes} lp={e.lp.x} elegido={elegido} onPick={(p) => onChange(aValores(p))} />
        <div className="bounds">
          <span>
            Relajación: <strong>{fmt(e.lp.z)}</strong> en ({fmt(e.lp.x[0])} ; {fmt(e.lp.x[1])})
          </span>
          <span>Cortes: {e.cortes.length}</span>
        </div>

        {T && !listo && (
          <table className="data tableau">
            <thead>
              <tr>
                <th>Fila del tableau</th>
                <th className="r">Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {T.filas.map((f) => (
                <tr key={f.basica}>
                  <td className="mono">{combinacion(f.basica, f.coefs, T.holguras)}</td>
                  <td className="r">{fmt(f.valor, 3)}</td>
                  <td className="r">
                    <button disabled={esEntero(f.valor)} onClick={() => cortar(agregarCorte(P, e, f.basica), f.basica)}>
                      {esEntero(f.valor) ? 'entera' : 'Cortar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {derivacion && (
          <div className="derivacion">
            <p className="small muted">Último corte, desde la fila de {m.ultimo}:</p>
            <ol className="small mono">
              <li>{combinacion(derivacion.fila.basica, derivacion.fila.coefs, derivacion.holguras)} = {fmt(derivacion.fila.valor, 3)}</li>
              <li>
                redondeando para abajo:{' '}
                {combinacion(derivacion.fila.basica, derivacion.fila.coefs.map((c) => Math.floor(c + 1e-9)) as Vec, derivacion.holguras, true)} ≤{' '}
                {Math.floor(derivacion.fila.valor + 1e-9)}
              </li>
              <li>
                reemplazando cada holgura (s = disponible − uso): <strong>{filaTexto(derivacion.corte)}</strong>
              </li>
            </ol>
          </div>
        )}

        <div className="actions">
          <button
            disabled={ocupado || listo}
            onClick={async () => {
              setOcupado(true);
              let est = e;
              while (!lpEntero(est.lp)) {
                const f = filaMasFraccionaria(P, est.cortes, est.lp);
                const s = f ? agregarCorte(P, est, f) : null;
                if (!s || !f) break;
                est = s;
                cortar(est, f);
                await new Promise((r) => setTimeout(r, 600));
              }
              setOcupado(false);
            }}
          >
            Piloto automático
          </button>
          <button disabled={ocupado} onClick={() => guardar({ ...m, cortes: iniciarCortes(P), ultimo: null })}>
            Reiniciar
          </button>
        </div>
        {listo && (
          <p className="note">
            ¡El LP ya cae en un punto entero! Con {e.cortes.length} corte{e.cortes.length === 1 ? '' : 's'} el óptimo
            de la relajación es <strong>({e.lp.x.join(', ')})</strong>, {v.moneda} {fmt(e.lp.z)}: es el óptimo entero,
            sin ningún árbol.
          </p>
        )}
        {e.cortes.length > 0 && (
          <ul className="small cortes-lista">
            {e.pasos.map((p, i) => (
              <li key={i}>
                <span className="mono">{filaTexto(p.corte)}</span> <span className="muted">(desde la fila de {p.desde})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
}
