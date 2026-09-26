import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export interface IsoLabel {
  text: string;
  position: THREE.Vector3;
}

export interface IsoSceneHandle<P> {
  update(params: P): void;
  /** Se llama en cada frame con el tiempo transcurrido en segundos. */
  tick?(dt: number): void;
  labels?: IsoLabel[];
}

interface Props<P> {
  /** Construye la escena una sola vez. */
  create(scene: THREE.Scene): IsoSceneHandle<P>;
  params: P;
  /** Mitad del ancho visible en unidades del mundo (zoom). */
  viewSize?: number;
  height?: number;
}

export const PALETTE = {
  bg: 0xf4f4f1,
  ground: 0xe9e9e4,
  white: 0xffffff,
  ink: 0x2b2b2b,
  water: 0x3d8bfd,
  waterDeep: 0x2a6fd6,
  salt: 0xb9b3a2,
  bad: 0xe5534b,
  muted: 0xc9c9c2,
};

/**
 * Lienzo Three.js con cámara ortográfica isométrica, luces suaves y etiquetas HTML.
 * Cada nivel sólo describe sus objetos en `create`.
 */
export function IsoCanvas<P>({ create, params, viewSize = 9, height = 320 }: Props<P>) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<IsoSceneHandle<P> | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = isoCamera();
    prepareScene(scene);

    const handle = create(scene);
    handleRef.current = handle;
    handle.update(paramsRef.current);

    const labelEls = (handle.labels ?? []).map((l) => {
      const el = document.createElement('div');
      el.className = 'iso-label';
      el.textContent = l.text;
      host.appendChild(el);
      return el;
    });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h);
      fitCamera(camera, viewSize, w / h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const v = new THREE.Vector3();
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      handle.tick?.(dt);
      renderer.render(scene, camera);
      (handle.labels ?? []).forEach((l, i) => {
        v.copy(l.position).project(camera);
        labelEls[i].style.transform = `translate(-50%, -50%) translate(${((v.x + 1) / 2) * host.clientWidth}px, ${((1 - v.y) / 2) * host.clientHeight}px)`;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      labelEls.forEach((el) => el.remove());
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
    // `create` se ejecuta una sola vez por montaje a propósito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSize]);

  useEffect(() => {
    handleRef.current?.update(params);
  }, [params]);

  return <div ref={hostRef} className="iso-canvas" style={{ height }} />;
}

/** Fondo y luces comunes a todas las escenas. */
export function prepareScene(scene: THREE.Scene) {
  scene.background = new THREE.Color(PALETTE.bg);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d8d0, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(8, 14, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15 });
  scene.add(sun);
}

export function isoCamera(): THREE.OrthographicCamera {
  const camera = new THREE.OrthographicCamera();
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function fitCamera(camera: THREE.OrthographicCamera, viewSize: number, aspect: number) {
  camera.left = -viewSize;
  camera.right = viewSize;
  camera.top = viewSize / aspect;
  camera.bottom = -viewSize / aspect;
  camera.near = -100;
  camera.far = 100;
  camera.updateProjectionMatrix();
}

/** Libera geometrías y materiales de una escena. */
export function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

/** Utilidades para armar escenas minimalistas. */
export function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cylinder(r: number, h: number, color: number, segments = 32): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, segments),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Caño recto entre dos puntos del plano (y fija) con partículas que fluyen.
 * `setFlow(f)` con f en [0,1] ajusta grosor y velocidad.
 */
export function pipe(from: THREE.Vector3, to: THREE.Vector3, color: number) {
  const group = new THREE.Group();
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  const tube = cylinder(0.12, len, PALETTE.muted, 12);
  tube.position.copy(from).addScaledVector(dir, 0.5);
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  group.add(tube);

  const N = 8;
  const dots = Array.from({ length: N }, () => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color }));
    group.add(d);
    return d;
  });

  let flow = 0;
  let phase = 0;
  return {
    group,
    setFlow(f: number) {
      flow = Math.max(0, Math.min(1, f));
      const s = 0.4 + flow * 1.6;
      tube.scale.set(s, 1, s);
      dots.forEach((d) => {
        d.visible = flow > 0.001;
        d.scale.setScalar(0.5 + flow);
      });
    },
    setColor(c: number) {
      dots.forEach((d) => (d.material as THREE.MeshStandardMaterial).color.setHex(c));
    },
    tick(dt: number) {
      phase = (phase + dt * (0.15 + flow * 0.5)) % 1;
      dots.forEach((d, i) => {
        const t = (phase + i / N) % 1;
        d.position.copy(from).addScaledVector(dir, t);
      });
    },
  };
}
