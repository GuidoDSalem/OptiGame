import * as THREE from 'three';
import type { SceneProps, SceneSpec } from '../levels/types';
import { disposeScene, fitCamera, isoCamera, prepareScene } from './IsoCanvas';

let renderer: THREE.WebGLRenderer | null = null;
let queue: Promise<unknown> = Promise.resolve();

/**
 * Dibuja una escena una sola vez y devuelve una imagen (data URL). Usa un único renderer
 * compartido para no abrir un contexto WebGL por miniatura.
 */
export function renderThumbnail(spec: SceneSpec, params: SceneProps, width = 320, height = 220): Promise<string> {
  const job = queue.then(() => {
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.shadowMap.enabled = true;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    const scene = new THREE.Scene();
    prepareScene(scene);
    const camera = isoCamera();
    fitCamera(camera, spec.viewSize ?? 9, width / height);
    const handle = spec.create(scene);
    handle.update(params);
    handle.tick?.(0.35); // ubica las partículas animadas
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/png');
    disposeScene(scene);
    return url;
  });
  queue = job.catch(() => undefined);
  return job;
}
