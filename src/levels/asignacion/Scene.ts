import * as THREE from 'three';
import { PALETTE, box, cylinder, type IsoLabel, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import type { Contenedor, Item } from './template';

/** Cómo se dibuja cada contenedor. */
export type EstiloContenedor = 'aula' | 'quirofano';

/** Coordenadas de pantalla (across = derecha, down = abajo) → piso isométrico. */
const floor = (across: number, down: number) => new THREE.Vector3((across + down) / 2, 0, (down - across) / 2);

const BIN_DOWN = -1.5;
const WAIT_DOWN = 6.5;
const near1 = (x: number) => Math.abs(x - 1) < 1e-6;

/** Decoración de cada estilo, alrededor del centro del contenedor. */
function decorar(estilo: EstiloContenedor, across: number, w: number): THREE.Object3D[] {
  const back = floor(across, BIN_DOWN - 1.8 * Math.SQRT2);
  if (estilo === 'aula') {
    const wall = box(w, 1.1, 0.12, PALETTE.white);
    wall.position.set(back.x, 0.55, back.z);
    wall.rotation.y = Math.PI / 4;
    return [wall];
  }
  // Quirófano: pared baja de vidrio + lámpara cenital.
  const wall = box(w, 0.5, 0.08, PALETTE.muted);
  wall.position.set(back.x, 0.25, back.z);
  wall.rotation.y = Math.PI / 4;
  const c = floor(across + w / 2 - 0.6, BIN_DOWN - 1.2);
  const pole = cylinder(0.05, 2.4, PALETTE.muted, 8);
  pole.position.set(c.x, 1.2, c.z);
  const lamp = cylinder(0.45, 0.12, PALETTE.white, 20);
  lamp.position.set(c.x, 2.4, c.z);
  return [wall, pole, lamp];
}

export function crearEscenaAsignacion(opts: {
  items: Item[];
  bins: Contenedor[];
  estilo: EstiloContenedor;
  espera: string;
}): SceneSpec {
  const { items, bins, estilo, espera } = opts;
  const across = bins.map((_, i) => (i - (bins.length - 1) / 2) * 8);
  const maxBin = Math.max(...bins.map((b) => b.size));
  const maxItem = Math.max(...items.map((it) => it.size));
  const maxHours = Math.max(...items.map((it) => it.hours));

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box(28, 0.4, 28, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);

    // Contenedores: piso (ancho según capacidad) + decoración del estilo.
    const binMats = bins.map((b, i) => {
      const center = floor(across[i], BIN_DOWN);
      const w = 3 + (b.size / maxBin) * 3.5;
      const slab = box(w, 0.15, 3.6, PALETTE.white);
      slab.position.set(center.x, 0.08, center.z);
      slab.rotation.y = Math.PI / 4;
      scene.add(slab, ...decorar(estilo, across[i], w));
      return slab.material as THREE.MeshStandardMaterial;
    });

    // Zona de espera para ítems sin asignar (o partidos).
    const wait = box(20, 0.05, 3, PALETTE.muted);
    const wc = floor(0, WAIT_DOWN);
    wait.position.set(wc.x, 0.03, wc.z);
    wait.rotation.y = Math.PI / 4;
    scene.add(wait);

    // Ítems: ancho ∝ tamaño, alto ∝ horas.
    const blocks = items.map((it) => {
      const side = 0.5 + (it.size / maxItem) * 0.9;
      const h = 0.4 + (it.hours / maxHours) * 1.4;
      const m = box(side, h, side, PALETTE.ink);
      m.rotation.y = Math.PI / 4;
      scene.add(m);
      const label: IsoLabel = { text: it.label, position: new THREE.Vector3() };
      return { it, m, h, label };
    });

    return {
      labels: [
        ...bins.map((b, i) => ({ text: b.label, position: floor(across[i], BIN_DOWN + 2.4).setY(0.2) })),
        { text: espera, position: floor(-9, WAIT_DOWN).setY(0.6) },
        ...blocks.map((x) => x.label),
      ],
      update({ values }) {
        const y = (it: string, b: string) => values[`y_${it}_${b}`] ?? 0;
        const slots = bins.map(() => 0);
        let waitSlot = 0;
        blocks.forEach(({ it, m, h, label }) => {
          const shares = bins.map((b) => y(it.id, b.id));
          const idx = shares.findIndex(near1);
          const whole = idx >= 0 && shares.filter((s) => s > 1e-6).length === 1;
          const p = whole
            ? floor(across[idx] - 2 + slots[idx]++ * 2, BIN_DOWN + 0.3)
            : floor(-7.5 + waitSlot++ * 3, WAIT_DOWN);
          m.position.set(p.x, h / 2 + 0.15, p.z);
          (m.material as THREE.MeshStandardMaterial).color.setHex(whole ? PALETTE.ink : PALETTE.bad);
          label.position.copy(p).setY(h + 0.7);
        });
        // Un contenedor se marca en rojo si se pasa de horas o recibe un ítem que no entra.
        bins.forEach((b, i) => {
          const hours = items.reduce((s, it) => s + it.hours * y(it.id, b.id), 0);
          const tooBig = items.some((it) => near1(y(it.id, b.id)) && it.size > b.size);
          binMats[i].color.setHex(hours <= b.hours + 1e-4 && !tooBig ? PALETTE.white : PALETTE.bad);
        });
      },
    };
  }

  return { create, viewSize: 11.5 };
}
