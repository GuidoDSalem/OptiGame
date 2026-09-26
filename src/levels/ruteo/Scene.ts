import * as THREE from 'three';
import { PALETTE, box, disposeScene, pipe, type IsoSceneHandle } from '../../scene/IsoCanvas';
import { analizar, arcId } from '../../engine/routing';
import type { SceneProps, SceneSpec } from '../types';

export interface LugarEscena {
  id: string;
  short: string;
  x: number;
  y: number;
}

/**
 * Ciudad en grilla: manzanas entre las esquinas, depósito y clientes en esquinas, y la ruta
 * dibujada por las calles (en "L", como se maneja en una grilla). Los circuitos que no pasan
 * por el depósito se pintan en rojo.
 */
export function crearEscenaCiudad(depot: LugarEscena, clientes: LugarEscena[]): SceneSpec {
  const all = [depot, ...clientes];
  const nodes = all.map((p) => p.id);
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));
  const S = 2.4;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const at = (x: number, y: number, h = 0) => new THREE.Vector3((x - cx) * S, h, (y - cy) * S);
  const byId = new Map(all.map((p) => [p.id, p]));

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const w = (maxX - minX + 2) * S;
    const d = (maxY - minY + 2) * S;
    const ground = box(w + 4, 0.4, d + 4, PALETTE.ground);
    ground.position.y = -0.2;
    scene.add(ground);

    // Manzanas: un edificio bajo en el centro de cada cuadra.
    for (let x = minX - 1; x <= maxX; x++)
      for (let y = minY - 1; y <= maxY; y++) {
        const hgt = 0.3 + ((x * 7 + y * 13) % 5) * 0.12;
        const b = box(S * 0.62, hgt, S * 0.62, PALETTE.muted);
        b.position.copy(at(x + 0.5, y + 0.5, hgt / 2));
        scene.add(b);
      }

    // Depósito y clientes en las esquinas.
    const dep = box(1.3, 1.1, 1.3, PALETTE.water);
    dep.position.copy(at(depot.x, depot.y, 0.55));
    scene.add(dep);
    const houses = new Map<string, THREE.MeshStandardMaterial>();
    clientes.forEach((c) => {
      const h = box(0.8, 0.8, 0.8, PALETTE.white);
      h.position.copy(at(c.x, c.y, 0.4));
      scene.add(h);
      houses.set(c.id, h.material as THREE.MeshStandardMaterial);
    });

    // La ruta se reconstruye en cada actualización.
    const routeGroup = new THREE.Group();
    scene.add(routeGroup);
    let pipes: ReturnType<typeof pipe>[] = [];
    const clearRoute = () => {
      const tmp = new THREE.Scene();
      routeGroup.children.slice().forEach((c) => tmp.add(c));
      disposeScene(tmp);
      pipes = [];
    };

    return {
      labels: all.map((p) => ({ text: p.short, position: at(p.x, p.y, p.id === depot.id ? 1.9 : 1.4) })),
      update({ values }) {
        clearRoute();
        const { circuitos } = analizar(nodes, values);
        const enCircuitoMalo = new Set(circuitos.filter((c) => !c.includes(depot.id)).flat());
        const visitados = new Set<string>();
        for (const i of nodes)
          for (const j of nodes) {
            if (i === j || (values[arcId(i, j)] ?? 0) < 0.5) continue;
            visitados.add(i);
            visitados.add(j);
            const a = byId.get(i)!;
            const b = byId.get(j)!;
            const color = enCircuitoMalo.has(i) ? PALETTE.bad : PALETTE.ink;
            // Por las calles: primero en x, después en y.
            const corner = at(b.x, a.y, 0.12);
            const segs: [THREE.Vector3, THREE.Vector3][] = [
              [at(a.x, a.y, 0.12), corner],
              [corner, at(b.x, b.y, 0.12)],
            ];
            for (const [p, q] of segs) {
              if (p.distanceTo(q) < 1e-6) continue;
              const pp = pipe(p, q, color);
              pp.setFlow(0.35);
              routeGroup.add(pp.group);
              pipes.push(pp);
            }
          }
        houses.forEach((m, id) =>
          m.color.setHex(enCircuitoMalo.has(id) ? PALETTE.bad : visitados.has(id) ? PALETTE.white : PALETTE.salt),
        );
      },
      tick(dt) {
        pipes.forEach((p) => p.tick(dt));
      },
    };
  }

  return { create, viewSize: 14.5 };
}
