import * as THREE from 'three';
import { patronDeVariable, producido, sobrante, type Patron } from '../../engine/columnas';
import { PALETTE, box, cylinder, disposeScene, type IsoLabel, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import { COLORES_PIEZA } from './PatronBar';
import type { VarianteColumnas } from './template';

const FILAS = 6;

/** La cortadora: una bobina acostada por patrón usado (cortada en piezas) y las pilas de cada pedido. */
export function crearEscenaBobinas(v: VarianteColumnas): SceneSpec {
  const P = { ancho: v.ancho, pedidos: v.pedidos };
  const L = 7; // largo en pantalla de una bobina madre
  const esc = L / v.ancho;
  const R = 0.42;
  const x0 = -5.2;
  const fila = (i: number) => -3.4 + i * 1.25;

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box(16, 0.4, 13, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);

    const rolls = new THREE.Group();
    scene.add(rolls);

    const etiquetasFila: IsoLabel[] = Array.from({ length: FILAS }, (_, i) => ({
      text: '',
      position: new THREE.Vector3(x0 - 0.6, 0.5, fila(i)),
    }));

    // Pilas de piezas terminadas, una por pedido.
    const pilas = v.pedidos.map((q, i) => {
      const z = fila(0) + i * 1.5;
      const base = cylinder(0.55, 0.08, PALETTE.muted, 24);
      base.position.set(4.6, 0.04, z);
      const m = cylinder(0.5, 1, COLORES_PIEZA[i % COLORES_PIEZA.length], 24);
      m.position.set(4.6, 0.5, z);
      scene.add(base, m);
      return { q, m, label: { text: '', position: new THREE.Vector3(4.6, 2.3, z) } as IsoLabel };
    });

    const piezaMesh = (ancho: number, color: number) => {
      const m = cylinder(R, ancho * esc - 0.04, color, 20);
      m.rotation.z = Math.PI / 2;
      return m;
    };

    return {
      labels: [...etiquetasFila, ...pilas.map((p) => p.label)],
      update({ values }) {
        const tmp = new THREE.Scene();
        rolls.children.slice().forEach((o) => tmp.add(o));
        disposeScene(tmp);

        const usados = Object.entries(values)
          .map(([k, n]) => ({ p: patronDeVariable(P, k), n }))
          .filter((u): u is { p: Patron; n: number } => !!u.p && u.n > 1e-6)
          .sort((a, b) => b.n - a.n);

        const filas = usados.length ? usados.slice(0, FILAS) : [null];
        filas.forEach((u, i) => {
          const z = fila(i);
          let x = x0;
          if (!u) {
            const m = piezaMesh(v.ancho, PALETTE.white);
            m.position.set(x0 + L / 2, R, z);
            rolls.add(m);
            return;
          }
          v.pedidos.forEach((q, k) => {
            for (let j = 0; j < (u.p[q.id] ?? 0); j++) {
              const m = piezaMesh(q.ancho, COLORES_PIEZA[k % COLORES_PIEZA.length]);
              m.position.set(x + (q.ancho * esc) / 2, R, z);
              rolls.add(m);
              x += q.ancho * esc;
            }
          });
          const resto = sobrante(P, u.p);
          if (resto > 0) {
            const m = piezaMesh(resto, PALETTE.bad);
            m.scale.set(0.55, 1, 0.55);
            m.position.set(x + (resto * esc) / 2, R * 0.55, z);
            rolls.add(m);
          }
        });

        etiquetasFila.forEach((l, i) => {
          const u = usados[i];
          l.text = !u ? '' : i === FILAS - 1 && usados.length > FILAS ? `+${usados.length - FILAS + 1} patrones` : `${Math.round(u.n * 100) / 100} ×`;
        });
        if (!usados.length) etiquetasFila[0].text = `bobina madre ${v.ancho} cm`;

        const hecho = producido(P, values);
        pilas.forEach(({ q, m, label }) => {
          const f = Math.min(1.4, hecho[q.id] / q.cantidad);
          const h = Math.max(0.02, 1.6 * f);
          m.scale.y = h;
          m.position.y = h / 2 + 0.08;
          (m.material as THREE.MeshStandardMaterial).opacity = hecho[q.id] >= q.cantidad - 1e-6 ? 1 : 0.45;
          (m.material as THREE.MeshStandardMaterial).transparent = hecho[q.id] < q.cantidad - 1e-6;
          label.text = `${q.ancho} cm · ${Math.round(hecho[q.id] * 10) / 10}/${q.cantidad}`;
        });
      },
    };
  }

  return { create, viewSize: 8.5 };
}
