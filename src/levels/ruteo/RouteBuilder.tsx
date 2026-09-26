import { useState } from 'react';
import { arcId, arcsFromRoute, dosOpt, routeLength, vecinoMasCercano, type Dist } from '../../engine/routing';
import type { ManualProps } from '../types';

export interface LugarUI {
  id: string;
  label: string;
}

/** Reconstruye el recorrido siguiendo los arcos desde el depósito. */
function followRoute(depot: string, nodes: string[], values: Record<string, number>): string[] {
  const route = [depot];
  for (;;) {
    const cur = route[route.length - 1];
    const next = nodes.find((n) => n !== cur && (values[arcId(cur, n)] ?? 0) > 0.5);
    if (!next || next === depot || route.includes(next)) return route;
    route.push(next);
  }
}

/** Crea el componente del intento manual para un conjunto de lugares. */
export function crearArmadorDeRutas(opts: { depot: LugarUI; clientes: LugarUI[]; dist: Dist; unidad: string }) {
  const { depot, clientes, dist, unidad } = opts;
  const nodes = [depot.id, ...clientes.map((c) => c.id)];
  const label = (id: string) => (id === depot.id ? depot.label : clientes.find((c) => c.id === id)!.label);

  return function ArmadorDeRutas({ values, onChange }: ManualProps) {
    const [nota, setNota] = useState<string | null>(null);
    const route = followRoute(depot.id, nodes, values);
    const complete = route.length === nodes.length;
    const set = (r: string[], msg: string | null = null) => {
      onChange(arcsFromRoute(r, r.length === nodes.length));
      setNota(msg);
    };

    return (
      <div className="route-builder">
        <p className="route-line">
          {route.map((id, k) => (
            <span key={id}>
              {k > 0 && ' → '}
              <strong>{label(id)}</strong>
            </span>
          ))}
          {complete && (
            <>
              {' → '}
              <strong>{depot.label}</strong>
            </>
          )}
        </p>
        <p className="muted small">Tocá los lugares en el orden en que la camioneta los visita. Al completar, vuelve sola al depósito.</p>
        <div className="chips">
          {clientes.map((c) => (
            <button key={c.id} disabled={route.includes(c.id)} onClick={() => set([...route, c.id])}>
              {c.label}
            </button>
          ))}
        </div>
        <div className="actions">
          <button disabled={route.length <= 1} onClick={() => set(route.slice(0, -1))}>
            Deshacer
          </button>
          <button disabled={route.length <= 1} onClick={() => set([depot.id])}>
            Reiniciar
          </button>
          <button
            onClick={() => {
              const r = vecinoMasCercano(nodes, depot.id, dist);
              set(r, `Vecino más cercano: ${routeLength(r, dist)} ${unidad}. Siempre va al lugar más cercano que falta visitar.`);
            }}
          >
            Heurística: vecino más cercano
          </button>
          <button
            disabled={!complete}
            onClick={() => {
              const antes = routeLength(route, dist);
              const r = dosOpt(route, dist);
              const despues = routeLength(r, dist);
              set(
                r,
                despues < antes
                  ? `2-opt: de ${antes} a ${despues} ${unidad}, invirtiendo tramos que se "cruzaban".`
                  : `2-opt no encontró mejoras: la ruta es un óptimo local (${antes} ${unidad}).`,
              );
            }}
          >
            Mejorar con 2-opt
          </button>
        </div>
        {nota && <p className="note">{nota}</p>}
      </div>
    );
  };
}
