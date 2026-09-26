import * as THREE from 'three';
import { PALETTE, box, cylinder, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import { CANALES, DATA as D } from './data';

/** Alcance máximo teórico (todo al canal de mayor alcance), para escalar la multitud. */
const MAX_ALCANCE = D.presupuesto * Math.max(...CANALES.map((c) => c.alcance));

function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
  const ground = box(22, 0.4, 16, PALETTE.ground);
  ground.position.y = -0.2;
  scene.add(ground);

  // Un ícono simple por canal, en fila, con una columna de inversión delante.
  const icons: THREE.Object3D[] = [];
  const tv = box(1.6, 1.1, 0.25, PALETTE.white);
  tv.position.y = 1.1;
  const tvFoot = box(0.3, 0.55, 0.3, PALETTE.white);
  tvFoot.position.y = 0.28;
  icons.push(new THREE.Group().add(tv, tvFoot));

  const mast = cylinder(0.08, 3, PALETTE.white, 8);
  mast.position.y = 1.5;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.18), new THREE.MeshStandardMaterial({ color: PALETTE.bad }));
  tip.position.y = 3.05;
  icons.push(new THREE.Group().add(mast, tip));

  const phone = box(0.8, 1.5, 0.15, PALETTE.white);
  phone.position.y = 0.75;
  const screen = box(0.62, 1.2, 0.02, PALETTE.water);
  screen.position.set(0, 0.75, 0.085);
  icons.push(new THREE.Group().add(phone, screen));

  const board = box(2, 1, 0.12, PALETTE.white);
  board.position.y = 1.9;
  const postA = box(0.1, 1.4, 0.1, PALETTE.muted);
  postA.position.set(-0.6, 0.7, 0);
  const postB = postA.clone();
  postB.position.x = 0.6;
  icons.push(new THREE.Group().add(board, postA, postB));

  // Con la cámara isométrica, "a la derecha en pantalla" es (+x, −z) y "abajo" es (+x, +z).
  // Ubicamos los canales en una fila horizontal (x + z constante) en la mitad izquierda.
  const slot = (i: number) => {
    const across = -11 + i * 3.4; // x − z
    const down = -3; // x + z
    return new THREE.Vector3((across + down) / 2, 0, (down - across) / 2);
  };
  const cols: THREE.Mesh[] = [];
  icons.forEach((g, i) => {
    const p = slot(i);
    g.position.copy(p);
    g.rotation.y = Math.PI / 4;
    g.traverse((o) => (o.castShadow = true));
    scene.add(g);
    const col = box(1, 1, 1, PALETTE.water);
    col.position.set(p.x + 1.6, 0, p.z + 1.6);
    scene.add(col);
    cols.push(col);
  });

  // Multitud: cada figura es una fracción del alcance máximo.
  const people: THREE.Mesh[] = [];
  const COLS = 10;
  const ROWS = 8;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = cylinder(0.22, 0.7, PALETTE.muted, 12);
      p.position.set(0.4 + c * 0.8, 0.35, -6 + r * 0.8);
      scene.add(p);
      people.push(p);
    }
  }

  return {
    labels: [
      ...CANALES.map((c, i) => ({ text: c.label, position: slot(i).setY(i % 2 ? 4.6 : 3.6) })),
      { text: 'Audiencia', position: new THREE.Vector3(4, 1.6, -6.6) },
    ],
    update({ values, evaluation }) {
      cols.forEach((col, i) => {
        const h = Math.max(0.02, ((values[CANALES[i].id] ?? 0) / 60) * 5);
        col.scale.y = h;
        col.position.y = h / 2;
        (col.material as THREE.MeshStandardMaterial).color.setHex(evaluation.feasible ? PALETTE.water : PALETTE.bad);
      });
      const lit = Math.round((evaluation.objective / MAX_ALCANCE) * people.length);
      people.forEach((p, i) => {
        (p.material as THREE.MeshStandardMaterial).color.setHex(i < lit ? PALETTE.ink : PALETTE.muted);
      });
    },
  };
}

export const marketingScene: SceneSpec = { create, viewSize: 10.5 };
