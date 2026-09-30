import { useEffect, useState } from 'react';
import { evaluarServicios, serviciosDeTramos, type Tramo } from '../../engine/stockSeguridad';
import type { ManualProps } from '../types';
import { claveServicio, toneladas, usd, type VarianteStock } from './template';

/**
 * Intento manual del nivel de stock de seguridad: el jugador elige cuántos días promete cada
 * etapa. Todavía no sabe que en el óptimo cada una promete 0 o pasa de largo: lo descubre
 * mirando la curva de costo de cada etapa.
 */
export function crearPanelStock(v: VarianteStock) {
  const C = v.cadena;
  const E = C.etapas;
  const N = E.length;
  const aValores = (S: number[]) => Object.fromEntries(E.map((e, k) => [claveServicio(e.id), S[k]]));
  const presets: { nombre: string; tramos: Tramo[] }[] = [
    { nombre: `Todo en ${E[N - 1].corto}`, tramos: [[0, N - 1]] },
    { nombre: 'Un poco en cada etapa', tramos: E.map((_, k) => [k, k] as Tramo) },
  ];

  return function PanelStock({ values, onChange }: ManualProps) {
    const tiene = E.every((e) => claveServicio(e.id) in values);
    const S = tiene ? E.map((e) => values[claveServicio(e.id)]) : serviciosDeTramos(C, presets[0].tramos);
    const [sel, setSel] = useState(1);

    useEffect(() => {
      if (!tiene) onChange({ ...values, ...aValores(S) });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ev = evaluarServicios(C, S);
    const cambiar = (k: number, x: number) => {
      const nuevo = [...S];
      nuevo[k] = x;
      // Lo que viene después no puede prometer más de lo que tarda en total: se recorta.
      for (let j = k + 1; j < N; j++) nuevo[j] = Math.min(nuevo[j], nuevo[j - 1] + E[j].T);
      onChange({ ...values, ...aValores(nuevo) });
    };

    // Costo total si sólo cambia lo que promete la etapa elegida (el resto queda igual).
    const maxSel = ev.SI[sel] + E[sel].T;
    const curva = Array.from({ length: maxSel + 1 }, (_, x) => {
      const prueba = [...S];
      prueba[sel] = x;
      return evaluarServicios(C, prueba).total;
    });

    return (
      <div className="panel-stock">
        <div className="presets">
          {presets.map((p) => (
            <button key={p.nombre} onClick={() => onChange({ ...values, ...aValores(serviciosDeTramos(C, p.tramos)) })}>
              {p.nombre}
            </button>
          ))}
        </div>
        <div className="tabla-scroll">
          <table className="data etapas">
            <thead>
              <tr>
                <th>Etapa</th>
                <th className="r">Recibe</th>
                <th className="r">Tarda</th>
                <th>Promete</th>
                <th className="r" title="Días que tiene que cubrir con stock">Cubre</th>
                <th className="r">US$ por año</th>
              </tr>
            </thead>
            <tbody>
              {E.map((e, k) => {
                const max = ev.SI[k] + e.T;
                return (
                  <tr key={e.id} className={`${sel === k ? 'active' : ''} ${ev.imposibles.includes(k) ? 'mal' : ''}`} onClick={() => setSel(k)}>
                    <td>{e.corto}</td>
                    <td className="r">{ev.SI[k]} d</td>
                    <td className="r">{e.T} d</td>
                    <td>
                      <span className="slider-dias">
                        <input
                          type="range"
                          min={0}
                          max={Math.max(max, S[k])}
                          step={1}
                          value={S[k]}
                          onChange={(x) => cambiar(k, Number(x.target.value))}
                          onFocus={() => setSel(k)}
                          aria-label={`Días que promete ${e.nombre}`}
                        />
                        <b>{S[k]}</b>
                      </span>
                    </td>
                    <td className="r" title={ev.stock[k] > 0 ? `${toneladas(ev.stock[k])} de stock` : 'sin stock'}>
                      {Math.max(0, ev.NRT[k])} d
                    </td>
                    <td className="r">{ev.costo[k] > 0 ? usd(ev.costo[k]).replace('US$ ', '') : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={5}>Total ({toneladas(ev.stock.reduce((a, b) => a + b, 0))} de stock)</th>
                <th className="r">{usd(ev.costo.reduce((a, b) => a + Math.round(b), 0)).replace('US$ ', '')}</th>
              </tr>
            </tfoot>
          </table>
        </div>
        <CurvaEtapa nombre={E[sel].corto} curva={curva} actual={S[sel]} />
        <p className="muted small">
          Tocá una fila: el gráfico muestra cuánto costaría todo si sólo cambiara lo que promete esa etapa. Fijate dónde
          quedan los mínimos.
        </p>
      </div>
    );
  };
}

function CurvaEtapa({ nombre, curva, actual }: { nombre: string; curva: number[]; actual: number }) {
  const W = 440;
  const H = 120;
  const L = 84;
  const B = 26;
  const T = 12;
  const lo = Math.min(...curva);
  const hi = Math.max(...curva);
  const x = (d: number) => L + ((W - L - 12) * d) / Math.max(1, curva.length - 1);
  const y = (c: number) => H - B - ((H - B - T) * (c - lo)) / Math.max(1, hi - lo);
  const d = curva.map((c, k) => `${k ? 'L' : 'M'}${x(k)},${y(c)}`).join(' ');
  const ticks = curva.length > 12 ? [0, Math.round((curva.length - 1) / 2), curva.length - 1] : curva.map((_, k) => k);
  return (
    <svg className="grafico curva-etapa" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Costo total según lo que promete ${nombre}`}>
      <text className="tick" x={L} y={9}>
        costo total por año si {nombre} promete…
      </text>
      <text className="tick" x={L - 6} y={y(hi) + 4} textAnchor="end">
        {usd(hi)}
      </text>
      <text className="tick" x={L - 6} y={y(lo) + 4} textAnchor="end">
        {usd(lo)}
      </text>
      {ticks.map((k) => (
        <text key={k} className="tick" x={x(k)} y={H - 8} textAnchor="middle">
          {k} d
        </text>
      ))}
      <path className="linea-plan" d={d} />
      {curva.map((c, k) => (
        <circle key={k} className={k === actual ? 'punto-actual' : 'punto-curva'} cx={x(k)} cy={y(c)} r={k === actual ? 5 : 2.5}>
          <title>
            Promete {k} días: {usd(c)} por año
          </title>
        </circle>
      ))}
    </svg>
  );
}
