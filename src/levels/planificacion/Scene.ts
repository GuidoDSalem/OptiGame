import * as THREE from 'three';
import { PALETTE, box, cylinder, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import type { Periodo } from './template';

/** Coordenadas de pantalla (across = derecha, down = abajo) → piso isométrico. */
const floor = (across: number, down: number) => new THREE.Vector3((across + down) / 2, 0, (down - across) / 2);

const ROW_SEND = -5;
const ROW_STOCK = 0;
const ROW_DEMAND = 5;

export type EstiloLineaDeTiempo = 'minera' | 'hidro';

function cone(r: number, h: number, color: number) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.castShadow = true;
  return m;
}

const mat = (m: THREE.Mesh) => m.material as THREE.MeshStandardMaterial;

/** Una barra fina entre dos puntos del piso (vía, tubería, muelle, línea eléctrica). */
function strip(a: THREE.Vector3, b: THREE.Vector3, width: number, height: number, color: number) {
  const m = box(a.distanceTo(b), height, width, color);
  m.position.copy(a.clone().add(b).multiplyScalar(0.5)).setY(height / 2);
  m.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
  return m;
}

/** Íconos de una columna: la base se colorea (ok/mal) y el "relleno" se escala con la cantidad. */
interface Columna {
  sendBase: THREE.Mesh[];
  sendFill: THREE.Mesh;
  sendFillY: number;
  stockFill: THREE.Mesh;
  stockColor: number;
  demand: THREE.Mesh[];
}

/** Decorado fijo y un constructor de íconos por columna, según el estilo. */
function estilo(e: EstiloLineaDeTiempo) {
  if (e === 'hidro') {
    return {
      decorado(scene: THREE.Scene) {
        // Río que alimenta el sistema, tubería de bombeo y línea eléctrica.
        const r1 = floor(-15.5, ROW_SEND - 3);
        const r2 = floor(-15.5, ROW_DEMAND + 3);
        scene.add(strip(r1, r2, 2.2, 0.08, PALETTE.water));
        scene.add(strip(floor(-14, ROW_SEND), floor(12, ROW_SEND), 0.35, 0.3, PALETTE.muted));
        scene.add(strip(floor(-12, ROW_DEMAND - 1.6), floor(12, ROW_DEMAND - 1.6), 0.08, 0.08, PALETTE.ink));
      },
      columna(scene: THREE.Scene, across: number, p: Periodo, maxD: number): Columna {
        const sp = floor(across, ROW_SEND);
        const pump = box(1.2, 0.8, 1.2, PALETTE.white);
        pump.position.set(sp.x, 0.4, sp.z);
        pump.rotation.y = Math.PI / 4;
        const jet = cylinder(0.35, 1, PALETTE.water, 16);
        jet.position.set(sp.x, 0.8, sp.z);
        scene.add(pump, jet);

        const tp = floor(across, ROW_STOCK);
        const rim = cylinder(1.4, 0.12, PALETTE.white, 28);
        rim.position.set(tp.x, 0.06, tp.z);
        const water = cylinder(1.2, 1, PALETTE.water, 28);
        water.position.set(tp.x, 0, tp.z);
        scene.add(rim, water);

        const dp = floor(across, ROW_DEMAND);
        const h = 1.2 + (p.demanda / maxD) * 2.2;
        const tower = box(0.25, h, 0.25, PALETTE.white);
        tower.position.set(dp.x, h / 2, dp.z);
        const arm = box(1.6, 0.12, 0.12, PALETTE.white);
        arm.position.set(dp.x, h - 0.3, dp.z);
        arm.rotation.y = Math.PI / 4;
        scene.add(tower, arm);
        tower.visible = arm.visible = p.demanda > 0;

        return { sendBase: [pump], sendFill: jet, sendFillY: 0.8, stockFill: water, stockColor: PALETTE.water, demand: [tower, arm] };
      },
    };
  }

  return {
    decorado(scene: THREE.Scene) {
      // Mina en terrazas, vía y muelle.
      [3, 2.2, 1.4].forEach((w, k) => {
        const o = floor(-14.5, ROW_SEND);
        const b = box(w, 0.45, w, PALETTE.salt);
        b.position.set(o.x, 0.22 + k * 0.45, o.z);
        b.rotation.y = Math.PI / 4;
        scene.add(b);
      });
      scene.add(strip(floor(-13, ROW_SEND), floor(12, ROW_SEND), 0.5, 0.06, PALETTE.muted));
      scene.add(strip(floor(-12, ROW_DEMAND - 1.6), floor(12, ROW_DEMAND - 1.6), 0.6, 0.2, PALETTE.white));
    },
    columna(scene: THREE.Scene, across: number, p: Periodo, maxD: number): Columna {
      const wp = floor(across, ROW_SEND);
      const wagon = box(1.8, 0.5, 1, PALETTE.white);
      wagon.position.set(wp.x, 0.4, wp.z);
      wagon.rotation.y = Math.PI / 4;
      const load = cone(0.75, 1, PALETTE.salt);
      load.position.set(wp.x, 0.65, wp.z);
      scene.add(wagon, load);

      const sp = floor(across, ROW_STOCK);
      const pile = cone(1.3, 1, PALETTE.salt);
      pile.position.set(sp.x, 0, sp.z);
      scene.add(pile);

      const hp = floor(across, ROW_DEMAND);
      const hull = box(2.6, 0.7, 1.1, PALETTE.white);
      hull.position.set(hp.x, 0.35, hp.z);
      hull.rotation.y = Math.PI / 4;
      hull.scale.set(0.6 + (p.demanda / maxD) * 0.6, 1, 1);
      const cabin = box(0.6, 0.6, 0.7, PALETTE.white);
      const cp = floor(across + 0.8, ROW_DEMAND);
      cabin.position.set(cp.x, 1, cp.z);
      cabin.rotation.y = Math.PI / 4;
      scene.add(hull, cabin);
      hull.visible = cabin.visible = p.demanda > 0;

      return { sendBase: [wagon], sendFill: load, sendFillY: 0.65, stockFill: pile, stockColor: PALETTE.salt, demand: [hull] };
    },
  };
}

/**
 * Línea de tiempo: una columna por período. Arriba el envío, al medio el stock y abajo la
 * demanda. Rojo = algo no cierra en ese período.
 */
export function crearEscenaLineaDeTiempo(opts: {
  periodos: Periodo[];
  capStock: number;
  estilo?: EstiloLineaDeTiempo;
  labels: { envio: string; stock: string; demanda: string; origen: string };
}): SceneSpec {
  const { periodos: P, capStock, labels } = opts;
  const e = estilo(opts.estilo ?? 'minera');
  const col = (i: number) => -10 + i * (20 / Math.max(1, P.length - 1));
  const maxX = Math.max(...P.map((p) => p.capacidad));
  const maxD = Math.max(...P.map((p) => p.demanda));

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box(34, 0.4, 34, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);
    e.decorado(scene);
    const cols = P.map((p, i) => ({ p, ...e.columna(scene, col(i), p, maxD) }));

    return {
      labels: [
        ...P.map((p, i) => ({ text: p.short, position: floor(col(i), ROW_SEND - 3).setY(0.2) })),
        { text: labels.origen, position: floor(-14.5, ROW_SEND).setY(2) },
        { text: labels.envio, position: floor(-13.5, ROW_SEND + 1.8).setY(0.2) },
        { text: labels.stock, position: floor(-13.5, ROW_STOCK).setY(0.2) },
        { text: labels.demanda, position: floor(-13.5, ROW_DEMAND).setY(0.2) },
      ],
      update({ values }) {
        let s = 0;
        cols.forEach((c) => {
          const x = values[`x_${c.p.id}`] ?? 0;
          const z = values[`z_${c.p.id}`] ?? 0;
          s = s + x - c.p.demanda;

          const on = x > 1e-6;
          c.sendBase.forEach((m) => (m.visible = on));
          c.sendFill.visible = on;
          c.sendFill.scale.y = Math.max(0.05, (x / maxX) * 2.2);
          c.sendFill.position.y = c.sendFillY + c.sendFill.scale.y / 2;
          const ok = (!on || Math.abs(z - 1) < 1e-6) && x <= c.p.capacidad + 1e-6;
          c.sendBase.forEach((m) => mat(m).color.setHex(ok ? PALETTE.white : PALETTE.bad));

          const stock = Math.max(0, s);
          c.stockFill.visible = stock > 1e-6;
          c.stockFill.scale.y = Math.max(0.05, (stock / capStock) * 2.5);
          c.stockFill.position.y = c.stockFill.scale.y / 2;
          mat(c.stockFill).color.setHex(stock > capStock + 1e-6 ? PALETTE.bad : c.stockColor);

          c.demand.forEach((m) => mat(m).color.setHex(s < -1e-6 ? PALETTE.bad : PALETTE.white));
        });
      },
    };
  }

  return { create, viewSize: 13 };
}
