import * as THREE from 'three';
import { PALETTE, box, cylinder, disposeScene, pipe, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import type { VarianteBenders } from './template';

/** Mapa de la región: depósitos candidatos, clientes y los envíos entre ellos. */
export function crearEscenaDepositos(v: VarianteBenders): SceneSpec {
  const all = [...v.depositos, ...v.clientes];
  const cx = (Math.min(...all.map((l) => l.x)) + Math.max(...all.map((l) => l.x))) / 2;
  const cy = (Math.min(...all.map((l) => l.y)) + Math.max(...all.map((l) => l.y))) / 2;
  const S = 2.1;
  // El norte del mapa (y creciente) queda "arriba" en la vista isométrica.
  const at = (x: number, y: number, h = 0) => new THREE.Vector3((x - cx) * S, h, -(y - cy) * S);
  const maxDem = Math.max(...v.clientes.map((c) => c.demanda));

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box(24, 0.4, 24, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);

    const deps = v.depositos.map((d) => {
      const lot = box(1.9, 0.06, 1.9, PALETTE.salt);
      lot.position.copy(at(d.x, d.y, 0.03));
      const b = box(1.5, 1.1, 1.5, PALETTE.white);
      b.position.copy(at(d.x, d.y, 0.55));
      const roof = box(1.6, 0.12, 1.6, PALETTE.water);
      roof.position.copy(at(d.x, d.y, 1.16));
      scene.add(lot, b, roof);
      return { d, b, roof };
    });

    const clients = v.clientes.map((c) => {
      const h = 0.4 + (c.demanda / maxDem) * 0.9;
      const m = cylinder(0.45, h, PALETTE.white, 16);
      m.position.copy(at(c.x, c.y, h / 2));
      scene.add(m);
      return { c, m };
    });

    const flows = new THREE.Group();
    scene.add(flows);
    let pipes: ReturnType<typeof pipe>[] = [];

    return {
      labels: [
        ...v.depositos.map((d) => ({ text: d.short, position: at(d.x, d.y, 1.8) })),
        ...v.clientes.map((c) => ({ text: c.short, position: at(c.x, c.y, 1.6) })),
      ],
      update({ values }) {
        const tmp = new THREE.Scene();
        flows.children.slice().forEach((o) => tmp.add(o));
        disposeScene(tmp);
        pipes = [];

        deps.forEach(({ d, b, roof }) => {
          const y = values[`y_${d.id}`] ?? 0;
          const open = y > 0.5;
          b.visible = roof.visible = y > 1e-6;
          (b.material as THREE.MeshStandardMaterial).color.setHex(y > 1e-6 && y < 1 - 1e-6 ? PALETTE.bad : PALETTE.white);
          b.scale.y = open ? 1 : 0.5;
          b.position.y = open ? 0.55 : 0.28;
          roof.position.y = open ? 1.16 : 0.6;
        });

        clients.forEach(({ c, m }) => {
          const got = v.depositos.reduce((s, d) => s + (values[`x_${d.id}_${c.id}`] ?? 0), 0);
          (m.material as THREE.MeshStandardMaterial).color.setHex(got >= c.demanda - 1e-6 ? PALETTE.white : PALETTE.muted);
        });

        for (const d of v.depositos)
          for (const c of v.clientes) {
            const q = values[`x_${d.id}_${c.id}`] ?? 0;
            if (q < 1e-6) continue;
            const cerrado = (values[`y_${d.id}`] ?? 0) < 0.5;
            const p = pipe(at(d.x, d.y, 0.3), at(c.x, c.y, 0.3), cerrado ? PALETTE.bad : PALETTE.ink);
            p.setFlow(q / maxDem);
            flows.add(p.group);
            pipes.push(p);
          }
      },
      tick(dt) {
        pipes.forEach((p) => p.tick(dt));
      },
    };
  }

  return { create, viewSize: 11 };
}
