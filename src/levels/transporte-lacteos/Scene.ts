import * as THREE from 'three';
import { PALETTE, box, cylinder, pipe, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import { CENTROS, PLANTAS } from './data';

/**
 * Con la cámara isométrica, "derecha en pantalla" es (+x, −z) y "abajo" es (+x, +z).
 * Convertimos coordenadas de pantalla (across, down) a coordenadas del piso.
 */
const floor = (across: number, down: number) => new THREE.Vector3((across + down) / 2, 0, (down - across) / 2);

const plantPos = PLANTAS.map((_, i) => floor(-8, -6.5 + i * 6.5));
const centroPos = CENTROS.map((_, j) => floor(8, -9 + j * 6));
const MAX = Math.max(...PLANTAS.map((p) => p.oferta));

function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
  const ground = box(26, 0.4, 26, PALETTE.ground);
  ground.position.y = -0.2;
  scene.add(ground);

  // Plantas: nave + silo.
  const plantMats: THREE.MeshStandardMaterial[] = [];
  plantPos.forEach((p) => {
    const b = box(2, 1.3, 1.6, PALETTE.white);
    b.position.set(p.x, 0.65, p.z);
    const silo = cylinder(0.45, 2.2, PALETTE.white, 20);
    silo.position.set(p.x - 0.6, 1.1, p.z - 1.2);
    scene.add(b, silo);
    plantMats.push(b.material as THREE.MeshStandardMaterial);
  });

  // Centros: depósitos bajos y anchos.
  const centroMats: THREE.MeshStandardMaterial[] = [];
  centroPos.forEach((p) => {
    const b = box(2.4, 0.9, 1.8, PALETTE.white);
    b.position.set(p.x, 0.45, p.z);
    const roof = box(2.5, 0.12, 1.9, PALETTE.muted);
    roof.position.set(p.x, 0.96, p.z);
    scene.add(b, roof);
    centroMats.push(b.material as THREE.MeshStandardMaterial);
  });

  // Una ruta por par planta–centro.
  const y = 0.3;
  const routes = PLANTAS.flatMap((p, i) =>
    CENTROS.map((c, j) => {
      const from = plantPos[i].clone().setY(y).add(new THREE.Vector3(0.9, 0, 0.9));
      const to = centroPos[j].clone().setY(y).add(new THREE.Vector3(-1, 0, -1));
      const r = pipe(from, to, PALETTE.ink);
      scene.add(r.group);
      return { id: `x_${p.id}_${c.id}`, r };
    }),
  );

  return {
    labels: [
      ...PLANTAS.map((p, i) => ({ text: p.label, position: plantPos[i].clone().setY(2.8) })),
      ...CENTROS.map((c, j) => ({ text: c.label, position: centroPos[j].clone().setY(1.9) })),
    ],
    update({ values, evaluation }) {
      routes.forEach(({ id, r }) => r.setFlow((values[id] ?? 0) / MAX));
      const ok = (label: string) => evaluation.checks.find((c) => c.label === label)?.ok !== false;
      PLANTAS.forEach((p, i) => plantMats[i].color.setHex(ok(`Planta ${p.label}`) ? PALETTE.white : PALETTE.bad));
      CENTROS.forEach((c, j) => centroMats[j].color.setHex(ok(`Centro ${c.label}`) ? PALETTE.white : PALETTE.bad));
    },
    tick(dt) {
      routes.forEach(({ r }) => r.tick(dt));
    },
  };
}

export const transporteScene: SceneSpec = { create, viewSize: 11.5 };
