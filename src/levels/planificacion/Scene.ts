import * as THREE from 'three';
import { PALETTE, box, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import type { Periodo } from './template';

/** Coordenadas de pantalla (across = derecha, down = abajo) → piso isométrico. */
const floor = (across: number, down: number) => new THREE.Vector3((across + down) / 2, 0, (down - across) / 2);

const ROW_TRAIN = -5;
const ROW_STOCK = 0;
const ROW_SHIP = 5;

function cone(r: number, h: number, color: number) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.castShadow = true;
  return m;
}

/**
 * Línea de tiempo: una columna por período. Arriba el envío (vagón con carga), al medio el
 * stock (pila) y abajo la demanda (barco). Rojo = algo no cierra en ese período.
 */
export function crearEscenaLineaDeTiempo(opts: {
  periodos: Periodo[];
  capStock: number;
  labels: { envio: string; stock: string; demanda: string; origen: string };
}): SceneSpec {
  const { periodos: P, capStock, labels } = opts;
  const col = (i: number) => -10 + i * (20 / Math.max(1, P.length - 1));
  const maxX = Math.max(...P.map((p) => p.capacidad));
  const maxD = Math.max(...P.map((p) => p.demanda));

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box(34, 0.4, 34, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);

    // Origen (mina): terrazas escalonadas al comienzo de la vía.
    [3, 2.2, 1.4].forEach((w, k) => {
      const o = floor(-14.5, ROW_TRAIN);
      const b = box(w, 0.45, w, PALETTE.salt);
      b.position.set(o.x, 0.22 + k * 0.45, o.z);
      b.rotation.y = Math.PI / 4;
      scene.add(b);
    });

    // Vía a lo largo de todas las semanas.
    const a = floor(-13, ROW_TRAIN);
    const b = floor(12, ROW_TRAIN);
    const rail = box(a.distanceTo(b), 0.06, 0.5, PALETTE.muted);
    rail.position.copy(a.clone().add(b).multiplyScalar(0.5)).setY(0.03);
    rail.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
    scene.add(rail);

    // Muelle a lo largo de la fila de barcos.
    const c1 = floor(-12, ROW_SHIP - 1.6);
    const c2 = floor(12, ROW_SHIP - 1.6);
    const dock = box(c1.distanceTo(c2), 0.2, 0.6, PALETTE.white);
    dock.position.copy(c1.clone().add(c2).multiplyScalar(0.5)).setY(0.1);
    dock.rotation.y = Math.atan2(-(c2.z - c1.z), c2.x - c1.x);
    scene.add(dock);

    const cols = P.map((p, i) => {
      const wp = floor(col(i), ROW_TRAIN);
      const wagon = box(1.8, 0.5, 1, PALETTE.white);
      wagon.position.set(wp.x, 0.4, wp.z);
      wagon.rotation.y = Math.PI / 4;
      const load = cone(0.75, 1, PALETTE.salt);
      load.position.set(wp.x, 0.65, wp.z);
      scene.add(wagon, load);

      const sp = floor(col(i), ROW_STOCK);
      const pile = cone(1.3, 1, PALETTE.salt);
      pile.position.set(sp.x, 0, sp.z);
      scene.add(pile);

      const hp = floor(col(i), ROW_SHIP);
      const hull = box(2.6, 0.7, 1.1, PALETTE.white);
      hull.position.set(hp.x, 0.35, hp.z);
      hull.rotation.y = Math.PI / 4;
      const cabin = box(0.6, 0.6, 0.7, PALETTE.white);
      const cp = floor(col(i) + 0.8, ROW_SHIP);
      cabin.position.set(cp.x, 1, cp.z);
      cabin.rotation.y = Math.PI / 4;
      scene.add(hull, cabin);
      const shipScale = 0.6 + (p.demanda / maxD) * 0.6;
      hull.scale.set(shipScale, 1, 1);
      hull.visible = cabin.visible = p.demanda > 0;

      return { p, wagon, load, pile, hull, cabin };
    });

    return {
      labels: [
        ...P.map((p, i) => ({ text: p.short, position: floor(col(i), ROW_TRAIN - 3).setY(0.2) })),
        { text: labels.origen, position: floor(-14.5, ROW_TRAIN).setY(2) },
        { text: labels.envio, position: floor(-13.5, ROW_TRAIN + 1.8).setY(0.2) },
        { text: labels.stock, position: floor(-13.5, ROW_STOCK).setY(0.2) },
        { text: labels.demanda, position: floor(-13.5, ROW_SHIP).setY(0.2) },
      ],
      update({ values }) {
        let s = 0;
        cols.forEach(({ p, wagon, load, pile, hull }) => {
          const x = values[`x_${p.id}`] ?? 0;
          const z = values[`z_${p.id}`] ?? 0;
          s = s + x - p.demanda;
          const on = x > 1e-6;
          wagon.visible = load.visible = on;
          load.scale.y = Math.max(0.05, (x / maxX) * 2.2);
          load.position.y = 0.65 + load.scale.y / 2;
          const wagonOk = !on || Math.abs(z - 1) < 1e-6;
          const overCap = x > p.capacidad + 1e-6;
          (wagon.material as THREE.MeshStandardMaterial).color.setHex(wagonOk && !overCap ? PALETTE.white : PALETTE.bad);

          const stock = Math.max(0, s);
          pile.visible = stock > 1e-6;
          pile.scale.y = Math.max(0.05, (stock / capStock) * 2.5);
          pile.position.y = pile.scale.y / 2;
          (pile.material as THREE.MeshStandardMaterial).color.setHex(stock > capStock + 1e-6 ? PALETTE.bad : PALETTE.salt);

          (hull.material as THREE.MeshStandardMaterial).color.setHex(s < -1e-6 ? PALETTE.bad : PALETTE.white);
        });
      },
    };
  }

  return { create, viewSize: 13 };
}
