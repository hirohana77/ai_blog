import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PageRoute, ROUTE_MOODS } from '../../data/portfolio';
import {
  createCanvasResizeObserver,
  expDamp,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';

export type HeroSculptureShape = 'crystal' | 'torusknot' | 'prism';

interface AmbientLiquidCanvasProps {
  route: PageRoute;
  heroShape?: HeroSculptureShape;
  scrollProgressRef: React.MutableRefObject<number>;
  scrollVelocityRef: React.MutableRefObject<number>;
  onFpsSample?: (fps: number) => void;
}

const BACKDROP_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BACKDROP_FRAGMENT = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uScrollProgress;
  uniform float uScrollVelocity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  uniform float uRefraction;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.04 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    vec2 p = (vUv - 0.5) * aspect;
    vec2 ptr = (uPointer - 0.5) * aspect;

    float t = uTime * 0.14;
    float velWarp = clamp(abs(uScrollVelocity) * 0.04, 0.0, 0.35);

    vec2 q = vec2(
      fbm(p * 1.45 + vec2(0.0, t + uScrollProgress * 0.65)),
      fbm(p * 1.45 + vec2(5.2, -t * 0.85))
    );

    float distPtr = length(p - ptr);
    float pointerLens = exp(-distPtr * 3.1) * 0.45 * uRefraction;
    vec2 ptrDir = normalize(p - ptr + 0.0001);

    vec2 r = vec2(
      fbm(p * 1.85 + 2.4 * q + vec2(1.7, 9.2) + 0.18 * t - ptrDir * pointerLens),
      fbm(p * 1.85 + 2.4 * q + vec2(8.3, 2.8) - 0.15 * t + vec2(0.0, velWarp))
    );

    float f = fbm(p * 1.65 + r * (1.35 * uRefraction));

    float caustic = pow(clamp(1.0 - abs(sin((r.x + f) * 5.2 + t * 1.4)), 0.0, 1.0), 7.2);
    float caustic2 = pow(clamp(1.0 - abs(cos((r.y - f) * 4.4 - t)), 0.0, 1.0), 8.5);

    vec3 baseObsidian = vec3(0.014, 0.017, 0.028);
    vec3 col = mix(baseObsidian, uColorA * 0.27, smoothstep(0.16, 0.85, f));
    col = mix(col, uColorB * 0.24, smoothstep(0.32, 0.92, length(q)));
    col += uColorC * caustic * 0.27;
    col += mix(uColorA, vec3(0.95, 0.97, 1.0), 0.45) * caustic2 * 0.17;

    col += mix(uColorC, uColorB, 0.5) * exp(-distPtr * 3.6) * 0.23;

    float vignette = smoothstep(1.38, 0.2, length(p));
    col *= mix(0.42, 1.0, vignette);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function bakeStudioEnvironment(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomScene = new THREE.Scene();

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const boxGeo = new THREE.BoxGeometry();
  geometries.push(boxGeo);

  const shellMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#141928'),
    side: THREE.BackSide,
    roughness: 0.85,
  });
  materials.push(shellMat);

  const shell = new THREE.Mesh(boxGeo, shellMat);
  shell.position.set(0, 10, 0);
  shell.scale.set(32, 28, 32);
  roomScene.add(shell);

  // Studio softbox light panels + accent cyan/violet ring light (from GlassObject architecture)
  const softboxPanels: Array<{
    pos: [number, number, number];
    scale: [number, number, number];
    color: string;
    intensity: number;
  }> = [
    { pos: [-13, 10, 4], scale: [0.2, 4.5, 6], color: '#ffffff', intensity: 36 },
    { pos: [13, 11, -3], scale: [0.2, 5.5, 6], color: '#bae6fd', intensity: 28 },
    { pos: [0, 15, -2], scale: [12, 0.5, 10], color: '#f8fafc', intensity: 18 },
    { pos: [-8, 13, -13], scale: [4, 3, 0.2], color: '#38bdf8', intensity: 38 },
    { pos: [8, 7, -13], scale: [4, 3, 0.2], color: '#a855f7', intensity: 34 },
  ];

  for (const panel of softboxPanels) {
    const mat = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    mat.color.set(panel.color).multiplyScalar(panel.intensity);
    materials.push(mat);

    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(...panel.pos);
    mesh.scale.set(...panel.scale);
    roomScene.add(mesh);
  }

  const ringGeo = new THREE.RingGeometry(0.55, 1.0, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  ringMat.color.set('#38bdf8').multiplyScalar(16);
  geometries.push(ringGeo);
  materials.push(ringMat);

  const ringLight = new THREE.Mesh(ringGeo, ringMat);
  ringLight.position.set(2.5, 4.0, -3.5);
  ringLight.scale.set(9, 9, 9);
  ringLight.lookAt(0, 0, 0);
  roomScene.add(ringLight);

  const envTarget = pmrem.fromScene(roomScene, 0.55, 0.1, 1000);

  for (const g of geometries) g.dispose();
  for (const m of materials) m.dispose();
  pmrem.dispose();

  return envTarget;
}

export const AmbientLiquidCanvas: React.FC<AmbientLiquidCanvasProps> = ({
  route,
  heroShape = 'crystal',
  scrollProgressRef,
  scrollVelocityRef,
  onFpsSample,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const routeRef = useRef<PageRoute>(route);
  const heroShapeRef = useRef<HeroSculptureShape>(heroShape);
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    heroShapeRef.current = heroShape;
  }, [heroShape]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.transmissionResolutionScale = 0.5;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const glCtx = renderer.getContext();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 6.4);

    // Bake studio lightbox environment map for realistic glass speculars & reflections
    const envTarget = bakeStudioEnvironment(renderer);
    scene.environment = envTarget.texture;

    const initialMood = ROUTE_MOODS[routeRef.current];
    const BACKDROP_Z = -8;
    const backdropDist = camera.position.z - BACKDROP_Z;

    const bgUniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uScrollProgress: { value: 0 },
      uScrollVelocity: { value: 0 },
      uColorA: { value: new THREE.Vector3(...initialMood.colorA) },
      uColorB: { value: new THREE.Vector3(...initialMood.colorB) },
      uColorC: { value: new THREE.Vector3(...initialMood.colorC) },
      uRefraction: { value: initialMood.refractionStrength },
    };

    const bgGeo = new THREE.PlaneGeometry(1, 1);
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BACKDROP_VERTEX,
      fragmentShader: BACKDROP_FRAGMENT,
      uniforms: bgUniforms,
      depthWrite: false,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 0, BACKDROP_Z);
    bgMesh.renderOrder = -10;
    scene.add(bgMesh);

    // Physically transmissive + dispersive Liquid Crystal sculpture
    const crystalUniforms = {
      uWaveTime: { value: 0 },
      uHoverEnergy: { value: 0 },
      uWaveRefract: { value: 1.0 },
    };

    const makeSculptureGeo = (shape: HeroSculptureShape): THREE.BufferGeometry => {
      if (shape === 'torusknot') return new THREE.TorusKnotGeometry(0.95, 0.34, 150, 32);
      if (shape === 'prism') return new THREE.OctahedronGeometry(1.52, 0);
      return new THREE.IcosahedronGeometry(1.48, 34);
    };

    let activeGeoShape: HeroSculptureShape = heroShapeRef.current;
    let sculptureGeo = makeSculptureGeo(activeGeoShape);
    const sculptureMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dbeafe'),
      metalness: 0,
      roughness: 0.03,
      transmission: 1.0,
      ior: 1.56,
      thickness: 2.2,
      dispersion: 2.6,
      attenuationColor: new THREE.Color('#1d4ed8'),
      attenuationDistance: 2.8,
      iridescence: 0.9,
      iridescenceIOR: 1.32,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      specularIntensity: 1.0,
      envMapIntensity: 1.25,
    });

    sculptureMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWaveTime = crystalUniforms.uWaveTime;
      shader.uniforms.uHoverEnergy = crystalUniforms.uHoverEnergy;
      shader.uniforms.uWaveRefract = crystalUniforms.uWaveRefract;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uWaveTime;
          uniform float uHoverEnergy;
          uniform float uWaveRefract;

          float liquidWaveField(vec3 p, float t) {
            float w1 = sin(p.x * 2.25 + t * 1.1) * cos(p.y * 2.05 - t * 0.92) * sin(p.z * 2.15 + t * 0.78);
            float w2 = sin(p.x * 3.9 - t * 1.55 + p.z * 3.1) * 0.30;
            float w3 = cos(p.y * 3.5 + p.x * 2.6 + t * 1.2) * 0.22;
            return (w1 * 0.65 + w2 + w3) * (0.13 + uHoverEnergy * 0.07) * uWaveRefract;
          }

          vec3 liquidDisplace(vec3 basePos, vec3 nrm, float t) {
            return basePos + nrm * liquidWaveField(basePos, t);
          }
          `
        )
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
          #include <beginnormal_vertex>
          vec3 _nrmDir = normalize(position);
          vec3 _deformedP = liquidDisplace(position, _nrmDir, uWaveTime);
          vec3 _upAxis = abs(_nrmDir.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
          vec3 _tanAxis = normalize(cross(_upAxis, _nrmDir));
          vec3 _bitanAxis = normalize(cross(_nrmDir, _tanAxis));
          float _eps = 0.025;
          vec3 _pT = liquidDisplace(position + _tanAxis * _eps, normalize(position + _tanAxis * _eps), uWaveTime);
          vec3 _pB = liquidDisplace(position + _bitanAxis * _eps, normalize(position + _bitanAxis * _eps), uWaveTime);
          vec3 _calcNormal = normalize(cross(_pT - _deformedP, _pB - _deformedP));
          if (dot(_calcNormal, _nrmDir) < 0.0) _calcNormal = -_calcNormal;
          objectNormal = _calcNormal;
          `
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          transformed = _deformedP;
          `
        );
    };

    const sculptureMesh = new THREE.Mesh(sculptureGeo, sculptureMat);
    scene.add(sculptureMesh);

    // Subtle orbital glass ring
    const ringGeo = new THREE.TorusGeometry(2.15, 0.011, 16, 120);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#93c5fd'),
      transparent: true,
      opacity: 0.2,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI * 0.36;
    ringMesh.rotation.y = Math.PI * 0.18;
    sculptureMesh.add(ringMesh);

    const syncViewport = () => {
      const w = Math.max(container.clientWidth || window.innerWidth, 1);
      const h = Math.max(container.clientHeight || window.innerHeight, 1);
      const dpr = getBoundedPixelRatio(container, glCtx);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      bgUniforms.uResolution.value.set(w * dpr, h * dpr);

      const frustumH = 2 * backdropDist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const frustumW = frustumH * camera.aspect;
      bgMesh.scale.set(frustumW * 1.04, frustumH * 1.04, 1);
    };

    syncViewport();

    const resizeObserver = createCanvasResizeObserver(syncViewport);
    resizeObserver.observe(container);

    const pointerTarget = new THREE.Vector2(0.5, 0.5);
    const pointerSmooth = new THREE.Vector2(0.5, 0.5);
    let hoverEnergyTarget = 0;

    const handlePointerMove = (e: PointerEvent) => {
      pointerTarget.set(
        e.clientX / Math.max(window.innerWidth, 1),
        1.0 - e.clientY / Math.max(window.innerHeight, 1)
      );
      hoverEnergyTarget = 1.0;
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const clock = new THREE.Clock();
    let rafId = 0;
    let lastNow = performance.now();
    let frameCount = 0;
    let lastFpsTick = performance.now();

    const targetColorA = new THREE.Vector3();
    const targetColorB = new THREE.Vector3();
    const targetColorC = new THREE.Vector3();

    const renderLoop = (now: number) => {
      rafId = requestAnimationFrame(renderLoop);
      const dt = Math.min((now - lastNow) / 1000, 1 / 24);
      lastNow = now;

      const elapsed = prefersReducedMotion ? 0.5 : clock.getElapsedTime();
      const mood = ROUTE_MOODS[routeRef.current];
      const scrollP = scrollProgressRef.current;
      const scrollV = scrollVelocityRef.current;

      if (heroShapeRef.current !== activeGeoShape) {
        activeGeoShape = heroShapeRef.current;
        const nextGeo = makeSculptureGeo(activeGeoShape);
        sculptureMesh.geometry = nextGeo;
        sculptureGeo.dispose();
        sculptureGeo = nextGeo;
      }

      const kPointer = 1 - Math.exp(-dt * 7.5);
      pointerSmooth.lerp(pointerTarget, kPointer);
      hoverEnergyTarget *= Math.exp(-dt * 3.0);

      const kMood = 1 - Math.exp(-dt * 3.2);
      targetColorA.set(...mood.colorA);
      targetColorB.set(...mood.colorB);
      targetColorC.set(...mood.colorC);

      bgUniforms.uColorA.value.lerp(targetColorA, kMood);
      bgUniforms.uColorB.value.lerp(targetColorB, kMood);
      bgUniforms.uColorC.value.lerp(targetColorC, kMood);
      bgUniforms.uRefraction.value = expDamp(
        bgUniforms.uRefraction.value,
        mood.refractionStrength,
        4.0,
        dt
      );
      bgUniforms.uTime.value = elapsed;
      bgUniforms.uPointer.value.copy(pointerSmooth);
      bgUniforms.uScrollProgress.value = expDamp(
        bgUniforms.uScrollProgress.value,
        scrollP,
        8.0,
        dt
      );
      bgUniforms.uScrollVelocity.value = expDamp(
        bgUniforms.uScrollVelocity.value,
        scrollV,
        10.0,
        dt
      );

      crystalUniforms.uWaveTime.value = elapsed * 0.85 + bgUniforms.uScrollProgress.value * 2.2;
      crystalUniforms.uHoverEnergy.value = expDamp(
        crystalUniforms.uHoverEnergy.value,
        hoverEnergyTarget,
        8.0,
        dt
      );
      crystalUniforms.uWaveRefract.value = bgUniforms.uRefraction.value;

      const isDesktop = window.innerWidth >= 1024;
      const isHome = routeRef.current === 'home';

      // Restrict luminous 3D Crystal + caustic canvas strictly to the Home Hero Banner.
      // Once covered by the rising Deep Obsidian curtain or on sub-routes, fade out and pause WebGL draw.
      const heroSpan = Math.max(window.innerHeight * 0.98, 540);
      const heroCover = isHome ? Math.min(1.2, Math.max(0, (window.scrollY || 0) / heroSpan)) : 1.2;
      const heroOpacity = isHome ? Math.max(0, 1 - Math.max(0, heroCover - 0.18) / 0.88) : 0;
      container.style.opacity = heroOpacity.toFixed(3);

      if (!isHome || heroOpacity <= 0.01) {
        if (now - lastFpsTick >= 750) {
          onFpsSample?.(60);
          frameCount = 0;
          lastFpsTick = now;
        }
        return;
      }

      const targetX = isDesktop ? 1.55 - heroCover * 0.45 : 0.92;
      const targetY = isDesktop ? 0.06 + heroCover * 0.28 : 0.42 + heroCover * 0.18;
      const scrollFade = Math.max(0.0, 1.0 - heroCover * 0.35);
      const baseScale = isDesktop ? 1.02 : 0.64;
      const targetScale = Math.max(0.001, baseScale * scrollFade);

      sculptureMesh.position.x = expDamp(sculptureMesh.position.x, targetX, 5.5, dt);
      sculptureMesh.position.y = expDamp(sculptureMesh.position.y, targetY, 5.5, dt);
      const nextScale = expDamp(sculptureMesh.scale.x, targetScale, 6.0, dt);
      sculptureMesh.scale.setScalar(nextScale);
      sculptureMesh.visible = scrollFade > 0.02 && nextScale > 0.025;
      ringMat.opacity = Math.min(0.22, scrollFade * 0.22);

      const rotTargetX = (pointerSmooth.y - 0.5) * 0.85 + elapsed * 0.14;
      const rotTargetY = (pointerSmooth.x - 0.5) * 1.15 + elapsed * 0.22;
      sculptureMesh.rotation.x = expDamp(sculptureMesh.rotation.x, rotTargetX, 5.0, dt);
      sculptureMesh.rotation.y = expDamp(sculptureMesh.rotation.y, rotTargetY, 5.0, dt);
      ringMesh.rotation.z = elapsed * 0.18;

      renderer.render(scene, camera);

      frameCount += 1;
      if (now - lastFpsTick >= 750) {
        const fps = Math.round((frameCount * 1000) / (now - lastFpsTick));
        onFpsSample?.(fps);
        frameCount = 0;
        lastFpsTick = now;
      }
    };

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', handlePointerMove);
      bgGeo.dispose();
      bgMat.dispose();
      sculptureGeo.dispose();
      sculptureMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onFpsSample, scrollProgressRef, scrollVelocityRef]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {webglFailed && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 72% 35%, rgba(56, 189, 248, 0.22), transparent 45%), radial-gradient(circle at 26% 70%, rgba(168, 85, 247, 0.2), transparent 50%), #05060a',
          }}
        />
      )}
    </div>
  );
};
