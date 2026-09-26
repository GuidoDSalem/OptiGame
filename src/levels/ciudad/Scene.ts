import * as THREE from 'three';
import { PALETTE, box, cylinder, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';

export type Forma =
  | 'fabrica'
  | 'hospital'
  | 'escuela'
  | 'viviendas'
  | 'parque'
  | 'solar'
  | 'ruta'
  | 'tren'
  | 'logistica';

function cone(r: number, h: number, color: number) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.castShadow = true;
  return m;
}

/** Arma el edificio de cada forma dentro de un lote de ~3.6 × 3.6 centrado en el origen. */
function edificio(forma: Forma): THREE.Group {
  const g = new THREE.Group();
  const add = (m: THREE.Object3D, x: number, y: number, z: number) => {
    m.position.set(x, y, z);
    g.add(m);
  };
  switch (forma) {
    case 'fabrica':
      add(box(2.6, 1.2, 1.8, PALETTE.white), 0, 0.6, 0.3);
      add(cylinder(0.22, 2.4, PALETTE.muted, 12), -0.8, 1.2, -0.9);
      add(cylinder(0.22, 2.0, PALETTE.muted, 12), 0.2, 1.0, -0.9);
      [0, 1, 2].forEach((k) => add(new THREE.Mesh(new THREE.SphereGeometry(0.35 + k * 0.1, 12, 8), new THREE.MeshStandardMaterial({ color: PALETTE.salt })), -0.8 + k * 0.3, 2.7 + k * 0.45, -0.9 - k * 0.2));
      break;
    case 'hospital':
      add(box(2.4, 1.6, 2.2, PALETTE.white), 0, 0.8, 0);
      add(box(0.9, 0.25, 0.08, PALETTE.bad), 0, 1.2, 1.12);
      add(box(0.25, 0.9, 0.08, PALETTE.bad), 0, 1.2, 1.12);
      break;
    case 'escuela':
      add(box(2.8, 0.9, 1.4, PALETTE.white), 0, 0.45, 0.4);
      add(box(0.7, 1.8, 0.7, PALETTE.white), -0.9, 0.9, -0.6);
      break;
    case 'viviendas':
      [-0.9, 0, 0.9].forEach((x, k) => add(box(0.75, 0.8 + k * 0.35, 0.75, PALETTE.white), x, (0.8 + k * 0.35) / 2, (k - 1) * 0.6));
      break;
    case 'parque':
      add(box(3.2, 0.06, 3.2, PALETTE.green), 0, 0.03, 0);
      [[-0.9, -0.8], [0.8, -0.5], [-0.3, 0.8], [1, 0.9]].forEach(([x, z]) => add(cone(0.4, 1.2, PALETTE.green), x, 0.66, z));
      break;
    case 'solar':
      [-1, 0, 1].forEach((z) => {
        const p = box(2.8, 0.06, 0.7, PALETTE.water);
        p.rotation.x = -0.45;
        add(p, 0, 0.45, z);
      });
      break;
    case 'ruta':
      add(box(3.6, 0.05, 1.2, PALETTE.ink), 0, 0.03, 0);
      [-1.2, 0, 1.2].forEach((x) => add(box(0.5, 0.06, 0.08, PALETTE.white), x, 0.05, 0));
      break;
    case 'tren':
      add(box(3.6, 0.05, 0.9, PALETTE.muted), 0, 0.03, 0);
      add(box(1.8, 0.7, 0.7, PALETTE.white), 0.3, 0.4, 0);
      add(box(0.6, 0.9, 0.7, PALETTE.water), -0.9, 0.45, 0);
      break;
    case 'logistica':
      add(box(3, 1, 2, PALETTE.white), 0, 0.5, -0.3);
      [-0.8, 0.4].forEach((x) => add(box(0.9, 0.5, 0.45, PALETTE.muted), x, 0.25, 1.2));
      break;
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

/** Terreno con un lote por proyecto; el edificio aparece si el proyecto se hace. */
export function crearEscenaLotes(lotes: { id: string; short: string; forma: Forma }[]): SceneSpec {
  const cols = 3;
  const S = 4.6;
  const rows = Math.ceil(lotes.length / cols);
  const pos = (i: number) => new THREE.Vector3(((i % cols) - (cols - 1) / 2) * S, 0, (Math.floor(i / cols) - (rows - 1) / 2) * S);

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box(cols * S + 2, 0.4, rows * S + 2, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);

    const items = lotes.map((l, i) => {
      const p = pos(i);
      const lot = box(S - 0.8, 0.06, S - 0.8, PALETTE.salt);
      lot.position.set(p.x, 0.03, p.z);
      const b = edificio(l.forma);
      b.position.copy(p);
      scene.add(lot, b);
      return { l, lot, b };
    });

    return {
      labels: lotes.map((l, i) => ({ text: l.short, position: pos(i).setY(0.3).add(new THREE.Vector3(0, 0, S / 2 - 0.4)) })),
      update({ values }) {
        items.forEach(({ l, lot, b }) => {
          const y = values[`y_${l.id}`] ?? 0;
          b.visible = y > 0.5;
          const frac = y > 1e-6 && y < 1 - 1e-6;
          (lot.material as THREE.MeshStandardMaterial).color.setHex(frac ? PALETTE.bad : y > 0.5 ? PALETTE.muted : PALETTE.salt);
        });
      },
    };
  }

  return { create, viewSize: 10 };
}
