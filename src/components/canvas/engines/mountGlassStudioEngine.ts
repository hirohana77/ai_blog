import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCanvasResizeObserver, getBoundedPixelRatio } from '../../../lib/canvasOptics';

export type StudioShapeId = 'torusknot' | 'prism' | 'torus' | 'droplet';

export interface GlassStudioParams {
  shape: StudioShapeId;
  ior: number;
  dispersion: number;
  roughness: number;
}

const STUDIO_BG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STUDIO_BG_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;

  void main() {
    vec2 uv = vUv;
    float gx = smoothstep(0.955, 0.992, abs(sin(uv.x * 24.0)));
    float gy = smoothstep(0.955, 0.992, abs(sin(uv.y * 15.0)));
    float grid = max(gx, gy) * 0.34;

    float waveA = 0.5 + 0.5 * sin(uv.x * 4.5 + uTime * 0.45 + uv.y * 2.0);
    float waveB = 0.5 + 0.5 * cos(uv.y * 4.0 - uTime * 0.35 + uv.x * 2.4);

    vec3 dark = vec3(0.02, 0.03, 0.07);
    vec3 cyan = vec3(0.16, 0.56, 0.94);
    vec3 violet = vec3(0.62, 0.34, 0.96);
    vec3 amber = vec3(0.96, 0.72, 0.38);

    vec3 col = mix(dark, cyan * 0.42, waveA * 0.75);
    col = mix(col, violet * 0.46, waveB * 0.65);
    col += amber * exp(-length(uv - vec2(0.72, 0.34)) * 3.8) * 0.25;
    col += vec3(0.55, 0.82, 1.0) * grid;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function buildStudioRoom(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();

  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const boxGeo = new THREE.BoxGeometry();
  geos.push(boxGeo);

  const shellMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#13192b'),
    side: THREE.BackSide,
    roughness: 0.85,
  });
  mats.push(shellMat);

  const shell = new THREE.Mesh(boxGeo, shellMat);
  shell.position.set(0, 10, 0);
  shell.scale.set(30, 26, 30);
  room.add(shell);

  const panels: Array<{
    pos: [number, number, number];
    scale: [number, number, number];
    color: string;
    intensity: number;
  }> = [
    { pos: [-12, 10, 4], scale: [0.2, 5, 6], color: '#ffffff', intensity: 40 },
    { pos: [12, 11, -3], scale: [0.2, 5, 6], color: '#bae6fd', intensity: 32 },
    { pos: [0, 14, -2], scale: [10, 0.5, 10], color: '#f8fafc', intensity: 20 },
    { pos: [-7, 12, -12], scale: [4, 3, 0.2], color: '#38bdf8', intensity: 38 },
    { pos: [7, 7, -12], scale: [4, 3, 0.2], color: '#c084fc', intensity: 34 },
  ];

  for (const p of panels) {
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
    m.color.set(p.color).multiplyScalar(p.intensity);
    mats.push(m);
    const mesh = new THREE.Mesh(boxGeo, m);
    mesh.position.set(...p.pos);
    mesh.scale.set(...p.scale);
    room.add(mesh);
  }

  const ringGeo = new THREE.RingGeometry(0.55, 1.0, 64);
  const ringMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
  ringMat.color.set('#38bdf8').multiplyScalar(18);
  geos.push(ringGeo);
  mats.push(ringMat);

  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(2.5, 4.0, -3.5);
  ring.scale.set(8, 8, 8);
  ring.lookAt(0, 0, 0);
  room.add(ring);

  const env = pmrem.fromScene(room, 0.5, 0.1, 1000);
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  pmrem.dispose();
  return env;
}

function makeShapeGeometry(shape: StudioShapeId): THREE.BufferGeometry {
  if (shape === 'prism') return new THREE.OctahedronGeometry(1.52, 0);
  if (shape === 'torus') return new THREE.TorusGeometry(1.12, 0.44, 48, 120);
  if (shape === 'droplet') return new THREE.IcosahedronGeometry(1.42, 24);
  return new THREE.TorusKnotGeometry(0.96, 0.34, 180, 36);
}

/**
 * Mounts an interactive Three.js 3D Physical Glass Studio (GlassObject inspiration)
 * with OrbitControls, PMREM softbox reflections, and live IOR/Dispersion/Shape switching.
 */
export function mountGlassStudioEngine(
  container: HTMLElement,
  paramsRef: React.MutableRefObject<GlassStudioParams>
): () => void {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch {
    return () => {};
  }

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.transmissionResolutionScale = 0.5;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
  camera.position.set(0, 0.25, 5.2);

  const envTarget = buildStudioRoom(renderer);
  scene.environment = envTarget.texture;

  const BACK_Z = -7;
  const bgUniforms = { uTime: { value: 0 } };
  const bgGeo = new THREE.PlaneGeometry(1, 1);
  const bgMat = new THREE.ShaderMaterial({
    vertexShader: STUDIO_BG_VERT,
    fragmentShader: STUDIO_BG_FRAG,
    uniforms: bgUniforms,
    depthWrite: false,
  });
  const bgMesh = new THREE.Mesh(bgGeo, bgMat);
  bgMesh.position.set(0, 0, BACK_Z);
  camera.add(bgMesh);
  scene.add(camera);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e0f2fe'),
    metalness: 0,
    roughness: paramsRef.current.roughness,
    transmission: 1.0,
    ior: paramsRef.current.ior,
    thickness: 2.8,
    dispersion: paramsRef.current.dispersion,
    attenuationColor: new THREE.Color('#1e3a8a'),
    attenuationDistance: 3.4,
    iridescence: 0.75,
    iridescenceIOR: 1.33,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.35,
  });

  let activeShape = paramsRef.current.shape;
  let meshGeo = makeShapeGeometry(activeShape);
  const mesh = new THREE.Mesh(meshGeo, glassMat);
  scene.add(mesh);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 1.6;

  const syncSize = () => {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    const dpr = getBoundedPixelRatio(container, renderer.getContext());
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const dist = Math.abs(BACK_Z);
    const fh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    bgMesh.scale.set(fh * camera.aspect * 1.06, fh * 1.06, 1);
  };
  syncSize();

  const ro = createCanvasResizeObserver(syncSize);
  ro.observe(container);

  const clock = new THREE.Clock();
  let raf = 0;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const t = clock.getElapsedTime();
    bgUniforms.uTime.value = t;

    const p = paramsRef.current;
    if (p.shape !== activeShape) {
      activeShape = p.shape;
      const nextGeo = makeShapeGeometry(activeShape);
      mesh.geometry = nextGeo;
      meshGeo.dispose();
      meshGeo = nextGeo;
    }

    glassMat.ior = p.ior;
    glassMat.dispersion = p.dispersion;
    glassMat.roughness = p.roughness;

    mesh.position.y = Math.sin(t * 1.2) * 0.1;
    controls.update();
    renderer.render(scene, camera);
  };

  tick();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    meshGeo.dispose();
    glassMat.dispose();
    bgGeo.dispose();
    bgMat.dispose();
    envTarget.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };
}
