import * as THREE from 'three';
import { feasiblePolygon } from '../../engine/geometry';
import { PALETTE, box, cylinder, type IsoLabel, type IsoSceneHandle } from '../../scene/IsoCanvas';
import type { SceneProps, SceneSpec } from '../types';
import type { VarianteSolver } from './template';

/** Vista "dentro del solver": la región factible como una placa y los puntos enteros como clavijas. */
export function crearEscenaReticulado(v: VarianteSolver): SceneSpec {
  const S = 1.15;
  const { xmax, ymax } = v;
  const at = (x: number, y: number, h = 0) => new THREE.Vector3((x - xmax / 2) * S, h, -(y - ymax / 2) * S);
  const ids = v.productos.map((p) => `x_${p.id}`);
  const dentro = (x: number, y: number) => v.recursos.every((r) => r.consumo[0] * x + r.consumo[1] * y <= r.capacidad + 1e-9);

  function create(scene: THREE.Scene): IsoSceneHandle<SceneProps> {
    const ground = box((xmax + 2) * S, 0.3, (ymax + 2) * S, PALETTE.ground);
    ground.position.set(0, -0.15, 0);
    scene.add(ground);

    // Grilla: una línea fina por cada valor entero.
    for (let i = 0; i <= xmax; i++) {
      const l = box(0.02, 0.01, ymax * S, PALETTE.muted);
      l.position.copy(at(i, ymax / 2, 0.005));
      scene.add(l);
    }
    for (let j = 0; j <= ymax; j++) {
      const l = box(xmax * S, 0.01, 0.02, PALETTE.muted);
      l.position.copy(at(xmax / 2, j, 0.005));
      scene.add(l);
    }

    // Región factible (la relajación): una placa.
    const poly = feasiblePolygon(
      v.recursos.map((r) => ({ id: r.id, name: r.label, coefs: { x: r.consumo[0], y: r.consumo[1] }, op: '<=' as const, rhs: r.capacidad })),
      'x',
      'y',
      xmax,
      ymax,
    );
    const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2((x - xmax / 2) * S, (y - ymax / 2) * S)));
    const slab = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.9, transparent: true, opacity: 0.35 }),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.receiveShadow = true;
    scene.add(slab);

    // Clavijas en los puntos enteros factibles.
    for (let x = 0; x <= xmax; x++)
      for (let y = 0; y <= ymax; y++) {
        const ok = dentro(x, y);
        const m = cylinder(ok ? 0.1 : 0.05, ok ? 0.34 : 0.06, ok ? PALETTE.white : PALETTE.muted, 12);
        m.position.copy(at(x, y, ok ? 0.17 + 0.12 : 0.03));
        scene.add(m);
      }

    const elegido = cylinder(0.2, 1.4, PALETTE.ink, 20);
    scene.add(elegido);
    const etiqueta: IsoLabel = { text: '', position: at(0, 0, 2) };

    return {
      labels: [
        { text: `${v.productos[0].plural} →`, position: at(xmax, -0.9, 0.1) },
        { text: `${v.productos[1].plural} →`, position: at(-0.9, ymax, 0.1) },
        etiqueta,
      ],
      update({ values, evaluation }) {
        const x = values[ids[0]] ?? 0;
        const y = values[ids[1]] ?? 0;
        const hay = x > 1e-9 || y > 1e-9;
        elegido.visible = hay;
        elegido.position.copy(at(x, y, 0.7 + 0.12));
        (elegido.material as THREE.MeshStandardMaterial).color.setHex(evaluation.feasible ? PALETTE.ink : PALETTE.bad);
        etiqueta.position.copy(at(x, y, 2));
        const f = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
        etiqueta.text = hay ? `(${f(x)}, ${f(y)}) · ${v.moneda} ${f(evaluation.objective)}` : '';
      },
    };
  }

  return { create, viewSize: 7.4 };
}
