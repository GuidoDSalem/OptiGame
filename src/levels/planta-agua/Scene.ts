import * as THREE from 'three';
import { PALETTE, box, cylinder, pipe, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import { DATA as D } from './data';

type Params = SceneProps;

function create(scene: THREE.Scene): IsoSceneHandle<Params> {
  const ground = box(22, 0.4, 16, PALETTE.ground);
  ground.position.y = -0.2;
  scene.add(ground);

  // Río: franja de agua sobre el borde izquierdo.
  const river = box(3, 0.1, 16, PALETTE.water);
  river.position.set(-9.5, 0.05, 0);
  scene.add(river);

  // Pozo.
  const well = cylinder(0.9, 1.2, PALETTE.white);
  well.position.set(-5, 0.6, 5);
  scene.add(well);
  const wellCap = cylinder(0.65, 0.05, PALETTE.salt);
  wellCap.position.set(-5, 1.22, 5);
  scene.add(wellCap);

  // Planta: edificio + dos tanques.
  const plant = box(3.5, 1.8, 3, PALETTE.white);
  plant.position.set(0, 0.9, 0);
  scene.add(plant);
  const tankA = cylinder(0.8, 1.4, PALETTE.white);
  tankA.position.set(-0.8, 0.7, -2.6);
  scene.add(tankA);
  const tankB = cylinder(0.8, 1.4, PALETTE.white);
  tankB.position.set(1, 0.7, -2.6);
  scene.add(tankB);
  const plantMat = plant.material as THREE.MeshStandardMaterial;

  // Ciudad: grilla de edificios de alturas fijas.
  const buildings: THREE.Mesh[] = [];
  const heights = [1.4, 2.4, 1, 3, 1.8, 1.2, 2, 2.8, 1.5];
  heights.forEach((h, i) => {
    const b = box(1.1, h, 1.1, PALETTE.white);
    b.position.set(5.5 + (i % 3) * 1.6, h / 2, -1.6 + Math.floor(i / 3) * 1.6);
    scene.add(b);
    buildings.push(b);
  });

  const y = 0.5;
  const pRio = pipe(new THREE.Vector3(-8, y, 0), new THREE.Vector3(-1.75, y, 0), PALETTE.water);
  const pPozo = pipe(new THREE.Vector3(-5, y, 4.1), new THREE.Vector3(-1.2, y, 1.5), PALETTE.salt);
  const pCity = pipe(new THREE.Vector3(1.75, y, 0), new THREE.Vector3(4.8, y, 0), PALETTE.water);
  [pRio, pPozo, pCity].forEach((p) => scene.add(p.group));

  const maxFlow = Math.max(D.capRio, D.capPozo, D.demanda);

  return {
    labels: [
      { text: 'Río', position: new THREE.Vector3(-9.5, 0.4, -6) },
      { text: 'Pozo', position: new THREE.Vector3(-5, 2, 5) },
      { text: 'Planta', position: new THREE.Vector3(0, 2.6, 0) },
      { text: 'Ciudad', position: new THREE.Vector3(7.1, 3.6, 0) },
    ],
    update({ values, evaluation }) {
      const r = values.rio ?? 0;
      const p = values.pozo ?? 0;
      pRio.setFlow(r / maxFlow);
      pPozo.setFlow(p / maxFlow);
      pCity.setFlow((r + p) / maxFlow);

      const salty = evaluation.checks.find((c) => c.label === 'Salinidad')?.ok === false;
      pCity.setColor(salty ? PALETTE.salt : PALETTE.water);
      plantMat.color.setHex(evaluation.feasible ? PALETTE.white : PALETTE.bad);

      // Se iluminan tantos edificios como la fracción de demanda cubierta.
      const served = Math.min(1, (r + p) / D.demanda);
      const lit = Math.floor(served * buildings.length + 1e-9);
      buildings.forEach((b, i) => {
        (b.material as THREE.MeshStandardMaterial).color.setHex(i < lit ? PALETTE.white : PALETTE.muted);
      });
    },
    tick(dt) {
      pRio.tick(dt);
      pPozo.tick(dt);
      pCity.tick(dt);
    },
  };
}

export const plantaScene: SceneSpec = { create };
