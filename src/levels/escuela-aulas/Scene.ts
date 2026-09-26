import * as THREE from 'three';
import { PALETTE, box, type IsoLabel, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import { AULAS, CURSOS } from './data';

/** Coordenadas de pantalla (across = derecha, down = abajo) → piso isométrico. */
const floor = (across: number, down: number) => new THREE.Vector3((across + down) / 2, 0, (down - across) / 2);

const ROOM_ACROSS = [-8, 0, 8];
const ROOM_DOWN = -1.5;
const PATIO_DOWN = 5;

function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
  const ground = box(28, 0.4, 28, PALETTE.ground);
  ground.position.y = -0.2;
  scene.add(ground);

  // Aulas: piso (ancho según asientos) + pared del fondo.
  const roomMats = AULAS.map((a, i) => {
    const center = floor(ROOM_ACROSS[i], ROOM_DOWN);
    const w = 3 + (a.asientos / 40) * 3.5;
    const slab = box(w, 0.15, 3.6, PALETTE.white);
    slab.position.set(center.x, 0.08, center.z);
    slab.rotation.y = Math.PI / 4;
    const wall = box(w, 1.1, 0.12, PALETTE.white);
    const back = floor(ROOM_ACROSS[i], ROOM_DOWN - 1.8 * Math.SQRT2);
    wall.position.set(back.x, 0.55, back.z);
    wall.rotation.y = Math.PI / 4;
    scene.add(slab, wall);
    return slab.material as THREE.MeshStandardMaterial;
  });

  // Patio donde esperan los cursos sin aula (o partidos).
  const patio = box(20, 0.05, 3, PALETTE.muted);
  const pc = floor(0, PATIO_DOWN);
  patio.position.set(pc.x, 0.03, pc.z);
  patio.rotation.y = Math.PI / 4;
  scene.add(patio);

  // Cursos: ancho ∝ alumnos, alto ∝ horas.
  const courses = CURSOS.map((c) => {
    const side = 0.5 + (c.alumnos / 32) * 0.9;
    const h = 0.4 + (c.horas / 12) * 1.4;
    const m = box(side, h, side, PALETTE.ink);
    m.rotation.y = Math.PI / 4;
    scene.add(m);
    const label: IsoLabel = { text: c.label, position: new THREE.Vector3() };
    return { c, m, h, label };
  });

  return {
    labels: [
      ...AULAS.map((a, i) => ({ text: a.label, position: floor(ROOM_ACROSS[i], ROOM_DOWN + 2.4).setY(0.2) })),
      { text: 'Patio', position: floor(-9, PATIO_DOWN).setY(0.6) },
      ...courses.map((x) => x.label),
    ],
    update({ values, evaluation }) {
      const slots = AULAS.map(() => 0);
      let patioSlot = 0;
      courses.forEach(({ c, m, h, label }) => {
        const shares = AULAS.map((a) => values[`y_${c.id}_${a.id}`] ?? 0);
        const room = shares.findIndex((s) => Math.abs(s - 1) < 1e-6);
        const whole = room >= 0 && shares.filter((s) => s > 1e-6).length === 1;
        let p: THREE.Vector3;
        if (whole) {
          const k = slots[room]++;
          p = floor(ROOM_ACROSS[room] - 2 + k * 2, ROOM_DOWN + 0.3);
        } else {
          p = floor(-7.5 + patioSlot++ * 3, PATIO_DOWN);
        }
        m.position.set(p.x, h / 2 + 0.15, p.z);
        (m.material as THREE.MeshStandardMaterial).color.setHex(whole ? PALETTE.ink : PALETTE.bad);
        label.position.copy(p).setY(h + 0.7);
      });
      AULAS.forEach((a, i) => {
        const ok = evaluation.checks
          .filter((ch) => ch.label.endsWith(a.label) && !ch.label.startsWith('Curso'))
          .every((ch) => ch.ok);
        roomMats[i].color.setHex(ok ? PALETTE.white : PALETTE.bad);
      });
    },
  };
}

export const escuelaScene: SceneSpec = { create, viewSize: 11.5 };
