import * as THREE from 'three';
import { evaluarServicios } from '../../engine/stockSeguridad';
import { PALETTE, box, type IsoLabel, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import { serviciosDeValores, toneladas, type VarianteStock } from './template';

const BOLSA = 0xc9a86a;
const MAX_PISOS = 8;

/** La cadena como una fila de galpones sobre un camino; frente a cada uno, la pila de su stock de seguridad. */
export function crearEscenaCadena(v: VarianteStock): SceneSpec {
  const C = v.cadena;
  const E = C.etapas;
  const paso = 3;
  const x0 = -((E.length - 1) * paso) / 2;
  // Escala: una bolsa de la pila representa esta cantidad de kg (la pila más alta posible entra en MAX_PISOS).
  const kgPorPiso = (C.z * C.sigma * Math.sqrt(C.entrada + E.reduce((s, e) => s + e.T, 0))) / MAX_PISOS;

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box(18, 0.4, 10, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);
    const camino = box(E.length * paso + 1, 0.05, 0.9, PALETTE.muted);
    camino.position.set(0, 0.03, 1.4);
    scene.add(camino);

    const pilas = E.map((e, k) => {
      const x = x0 + k * paso;
      const galpon = box(2, 1.1 + (k === 1 ? 0.5 : 0), 1.6, PALETTE.white);
      galpon.position.set(x, 0.55 + (k === 1 ? 0.25 : 0), -1.2);
      const techo = box(2.2, 0.12, 1.8, PALETTE.ink);
      techo.position.set(x, 1.16 + (k === 1 ? 0.5 : 0), -1.2);
      scene.add(galpon, techo);
      const pila = new THREE.Group();
      pila.position.set(x, 0, 0.3);
      scene.add(pila);
      const label: IsoLabel = { text: e.corto, position: new THREE.Vector3(x, 2.4, -1.2) };
      return { pila, label };
    });

    return {
      labels: pilas.map((p) => p.label),
      update({ values }) {
        const S = serviciosDeValores(C, values);
        const ev = S ? evaluarServicios(C, S) : null;
        pilas.forEach(({ pila, label }, k) => {
          pila.children.slice().forEach((o) => {
            pila.remove(o);
            (o as THREE.Mesh).geometry.dispose();
          });
          const stock = ev?.stock[k] ?? 0;
          const pisos = Math.min(MAX_PISOS, Math.round(stock / kgPorPiso));
          for (let p = 0; p < pisos; p++)
            for (let q = 0; q < 2; q++) {
              const b = box(0.7, 0.28, 0.5, ev?.imposibles.includes(k) ? PALETTE.bad : BOLSA);
              b.position.set(-0.38 + q * 0.76, 0.15 + p * 0.3, 0);
              pila.add(b);
            }
          label.text = stock > 0 ? `${E[k].corto} · ${toneladas(stock)}` : E[k].corto;
        });
      },
    };
  }

  return { create, viewSize: 9 };
}
