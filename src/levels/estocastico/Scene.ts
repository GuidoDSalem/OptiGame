import * as THREE from 'three';
import { PALETTE, box, cylinder, disposeScene, pipe, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import type { VarianteEstocastica } from './template';

/** Mapa de la región: plantas candidatas, zonas de cosecha y el reparto esperado (ponderado por escenario). */
export function crearEscenaAcopio(v: VarianteEstocastica): SceneSpec {
  const all = [...v.plantas, ...v.zonas];
  const cx = (Math.min(...all.map((l) => l.x)) + Math.max(...all.map((l) => l.x))) / 2;
  const cy = (Math.min(...all.map((l) => l.y)) + Math.max(...all.map((l) => l.y))) / 2;
  const S = 2.1;
  const at = (x: number, y: number, h = 0) => new THREE.Vector3((x - cx) * S, h, -(y - cy) * S);
  const maxQ = Math.max(...v.zonas.flatMap((z) => z.cosecha));
  const esperado = (z: VarianteEstocastica['zonas'][number]) => v.escenarios.reduce((t, s, k) => t + s.prob * z.cosecha[k], 0);

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box(24, 0.4, 24, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);

    const plantas = v.plantas.map((d) => {
      const lot = box(1.9, 0.06, 1.9, PALETTE.salt);
      lot.position.copy(at(d.x, d.y, 0.03));
      const silos = [-0.4, 0.4].map((dx) => {
        const s = cylinder(0.36, 1.5, PALETTE.white, 20);
        s.position.copy(at(d.x, d.y, 0.75)).add(new THREE.Vector3(dx, 0, 0));
        scene.add(s);
        return s;
      });
      scene.add(lot);
      return { d, silos };
    });

    // Cada zona: un campo cuadrado cuyo alto es la cosecha esperada; al lado, los silos bolsa.
    const zonas = v.zonas.map((z) => {
      const h = 0.15 + (esperado(z) / maxQ) * 0.9;
      const campo = box(1.3, h, 1.3, PALETTE.green);
      campo.position.copy(at(z.x, z.y, h / 2));
      const bolsa = cylinder(0.22, 1.4, PALETTE.white, 14);
      bolsa.rotation.z = Math.PI / 2;
      bolsa.position.copy(at(z.x, z.y, 0.22)).add(new THREE.Vector3(0, 0, 1.1));
      scene.add(campo, bolsa);
      return { z, bolsa };
    });

    const flows = new THREE.Group();
    scene.add(flows);
    let pipes: ReturnType<typeof pipe>[] = [];

    return {
      labels: [
        ...v.plantas.map((d) => ({ text: d.short, position: at(d.x, d.y, 2.1) })),
        ...v.zonas.map((z) => ({ text: z.short, position: at(z.x, z.y, 1.5) })),
      ],
      update({ values }) {
        const tmp = new THREE.Scene();
        flows.children.slice().forEach((o) => tmp.add(o));
        disposeScene(tmp);
        pipes = [];

        plantas.forEach(({ d, silos }) => {
          const y = values[`y_${d.id}`] ?? 0;
          const abierta = y > 0.5;
          silos.forEach((s) => {
            s.visible = y > 1e-6;
            s.scale.y = abierta ? 1 : 0.4;
            s.position.y = abierta ? 0.75 : 0.3;
            (s.material as THREE.MeshStandardMaterial).color.setHex(y > 1e-6 && y < 1 - 1e-6 ? PALETTE.bad : PALETTE.white);
          });
        });

        zonas.forEach(({ z, bolsa }) => {
          const w = v.escenarios.reduce((t, s) => t + s.prob * (values[`w_${z.id}_${s.id}`] ?? 0), 0);
          bolsa.visible = w > 1e-6;
          bolsa.scale.y = 0.4 + Math.min(1.6, w / 10);
        });

        for (const d of v.plantas)
          for (const z of v.zonas) {
            const q = v.escenarios.reduce((t, s) => t + s.prob * (values[`x_${d.id}_${z.id}_${s.id}`] ?? 0), 0);
            if (q < 1e-6) continue;
            const cerrada = (values[`y_${d.id}`] ?? 0) < 0.5;
            const p = pipe(at(z.x, z.y, 0.3), at(d.x, d.y, 0.3), cerrada ? PALETTE.bad : PALETTE.ink);
            p.setFlow(q / maxQ);
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
