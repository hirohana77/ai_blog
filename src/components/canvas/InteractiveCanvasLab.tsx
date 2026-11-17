import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import Matter from 'matter-js';
import {
  Sparkles,
  Waves,
  Atom,
  Plus,
  Zap,
  RotateCcw,
  Orbit,
  SlidersHorizontal,
  Gem,
  Grid2x2,
} from 'lucide-react';
import { MagneticButton } from '../MagneticButton';
import {
  createCanvasResizeObserver,
  createRectCache,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';
import {
  mountGlassStudioEngine,
  StudioShapeId,
  GlassStudioParams,
} from './engines/mountGlassStudioEngine';
import { mountShatterEngine, ShatterParams } from './engines/mountShatterEngine';

export type LabEngineId =
  | 'shader-fluid'
  | 'glass-studio'
  | 'shatter-optics'
  | 'curl-particles'
  | 'matter-physics';
type ParticleShape = 'sphere' | 'torus' | 'helix';

interface InteractiveCanvasLabProps {
  initialEngine?: LabEngineId;
  compact?: boolean;
  onOpenFullLab?: () => void;
}

// ============================================================================
// ENGINE 01: WEBGL2 NAVIER-STOKES EULERIAN FBO FLUID SOLVER + OPTICAL DISPLAY
// ============================================================================
const NS_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 texelSize;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const NS_SPLAT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uColor;
uniform vec2 uPoint;
uniform float uRadius;
void main() {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture(uTarget, vUv).xyz;
  outColor = vec4(base + splat, 1.0);
}`;

const NS_ADVECT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * texelSize;
  outColor = uDissipation * texture(uSource, coord);
  outColor.a = 1.0;
}`;

const NS_DIVERGENCE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  outColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const NS_CURL = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  outColor = vec4(R - L - T + B, 0.0, 0.0, 1.0);
}`;

const NS_VORTICITY = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main() {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L)) * 0.5;
  force /= length(force) + 1.0;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy;
  outColor = vec4(velocity + force * uDt, 0.0, 1.0);
}`;

const NS_PRESSURE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  outColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const NS_GRADIENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 outColor;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B);
  outColor = vec4(velocity, 0.0, 1.0);
}`;

const NS_DISPLAY = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uDye;
uniform sampler2D uVelocity;
uniform float uTime;
uniform float uDistortion;
uniform float uDispersion;

vec3 opticalGrid(vec2 uv, float t) {
  float gx = smoothstep(0.955, 0.992, abs(sin(uv.x * 22.0)));
  float gy = smoothstep(0.955, 0.992, abs(sin(uv.y * 14.0)));
  float grid = max(gx, gy) * 0.26;
  vec3 c1 = vec3(0.02, 0.032, 0.072);
  vec3 c2 = vec3(0.08, 0.22, 0.52);
  vec3 c3 = vec3(0.28, 0.14, 0.54);
  float w = 0.5 + 0.5 * sin(uv.x * 3.5 + t * 0.4 + uv.y * 2.2);
  vec3 base = mix(c1, mix(c2, c3, 0.5 + 0.5 * cos(uv.y * 3.0 - t * 0.3)), w * 0.65);
  return base + vec3(0.42, 0.68, 0.96) * grid;
}

void main() {
  vec2 vel = texture(uVelocity, vUv).xy;
  vec3 dye = texture(uDye, vUv).rgb;
  vec2 push = vel * 0.0045 * uDistortion;
  float ca = 0.28 * uDispersion;

  float r = opticalGrid(vUv - push * (1.0 + ca), uTime).r;
  float g = opticalGrid(vUv - push, uTime).g;
  float b = opticalGrid(vUv - push * (1.0 - ca), uTime).b;
  vec3 bg = vec3(r, g, b);

  float mag = clamp(length(dye), 0.0, 2.5);
  vec3 caustic = dye * 0.45 + vec3(0.45, 0.85, 1.0) * smoothstep(0.08, 0.9, mag) * 0.28;
  vec3 col = bg + caustic;
  col *= mix(0.68, 1.0, smoothstep(0.95, 0.18, length(vUv - 0.5)));
  outColor = vec4(col, 1.0);
}`;

// Fallback analytical shader if float FBOs are unsupported
const FALLBACK_FLUID_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FALLBACK_FLUID_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uDistortion;
  uniform float uDispersion;
  uniform vec4 uRipples[8];

  void main() {
    vec2 aspect = vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    vec2 p = (vUv - 0.5) * aspect;
    vec2 ptr = (uPointer - 0.5) * aspect;
    float h = exp(-length(p - ptr) * 4.2) * 0.28 * uDistortion;
    for (int i = 0; i < 8; i++) {
      vec4 rip = uRipples[i];
      if (rip.w > 0.01) {
        float age = max(uTime - rip.z, 0.0);
        float dist = length(p - (rip.xy - 0.5) * aspect);
        float ring = exp(-pow((dist - age * 0.55) * 14.0, 2.0));
        h += sin((dist - age * 0.55) * 30.0) * ring * exp(-age * 1.4) * rip.w * 0.18;
      }
    }
    vec2 uvR = vUv + vec2(h * (0.09 + 0.025 * uDispersion));
    vec2 uvG = vUv + vec2(h * 0.09);
    vec2 uvB = vUv + vec2(h * (0.09 - 0.025 * uDispersion));
    float gx = smoothstep(0.955, 0.99, abs(sin(uvG.x * 22.0)));
    float gy = smoothstep(0.955, 0.99, abs(sin(uvG.y * 14.0)));
    vec3 col = vec3(0.03, 0.06, 0.14) + vec3(0.35, 0.65, 0.95) * max(gx, gy) * 0.28;
    col += vec3(uvR.x * 0.08, uvG.y * 0.12, uvB.x * 0.18) + vec3(0.4, 0.8, 1.0) * abs(h) * 0.7;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ============================================================================
// ENGINE 02: THREE.JS GPGPU CURL TOPOLOGY PARTICLES
// ============================================================================
const PARTICLE_VERTEX = /* glsl */ `
  attribute vec3 aSpherePos;
  attribute vec3 aTorusPos;
  attribute vec3 aHelixPos;
  attribute float aSeed;

  uniform float uTime;
  uniform float uMorphSphere;
  uniform float uMorphTorus;
  uniform float uMorphHelix;
  uniform float uTurbulence;
  uniform float uPointSize;
  uniform vec2 uPointer;

  varying float vSeed;
  varying float vEnergy;

  void main() {
    vSeed = aSeed;
    vec3 basePos =
      aSpherePos * uMorphSphere +
      aTorusPos * uMorphTorus +
      aHelixPos * uMorphHelix;

    float t = uTime * 0.65;
    vec3 curl = vec3(
      sin(basePos.y * 2.1 + t + aSeed * 6.28),
      cos(basePos.z * 2.3 - t * 1.1 + aSeed * 4.1),
      sin(basePos.x * 2.2 + t * 0.9 - aSeed * 5.2)
    ) * 0.24 * uTurbulence;

    vec3 pos = basePos + curl;

    vec2 ptrWorld = (uPointer - 0.5) * vec2(5.2, 3.6);
    float d = length(pos.xy - ptrWorld);
    float repel = exp(-d * 1.45) * 0.95;
    vec2 dir = normalize(pos.xy - ptrWorld + 0.0001);
    pos.xy += dir * repel;
    pos.z += repel * 0.55;

    vEnergy = repel + length(curl) * 1.4;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = clamp((uPointSize * (1.0 + repel * 0.8)) / max(-mvPos.z, 1.0), 1.5, 16.0);
  }
`;

const PARTICLE_FRAGMENT = /* glsl */ `
  precision highp float;
  varying float vSeed;
  varying float vEnergy;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;

    float alpha = smoothstep(0.5, 0.04, r);
    vec3 cool = vec3(0.42, 0.82, 1.0);
    vec3 violet = vec3(0.76, 0.52, 0.98);
    vec3 warm = vec3(0.99, 0.85, 0.55);

    vec3 col = mix(cool, violet, fract(vSeed * 3.7));
    col = mix(col, warm, clamp(vEnergy * 0.75, 0.0, 0.85));

    gl_FragColor = vec4(col, alpha * 0.86);
  }
`;

export const InteractiveCanvasLab: React.FC<InteractiveCanvasLabProps> = ({
  initialEngine = 'shader-fluid',
  compact = false,
  onOpenFullLab,
}) => {
  const [activeEngine, setActiveEngine] = useState<LabEngineId>(initialEngine);

  // Navier-Stokes Fluid controls
  const [distortion, setDistortion] = useState(1.25);
  const [dispersion, setDispersion] = useState(1.2);
  const [vorticity, setVorticity] = useState(2.2);

  // Curl Particles controls
  const [particleShape, setParticleShape] = useState<ParticleShape>('sphere');
  const [turbulence, setTurbulence] = useState(1.0);
  const [pointSize, setPointSize] = useState(18);

  // Glass Studio 3D controls
  const [studioShape, setStudioShape] = useState<StudioShapeId>('torusknot');
  const [studioIor, setStudioIor] = useState(1.65);
  const [studioDispersion, setStudioDispersion] = useState(2.4);
  const [studioRoughness, setStudioRoughness] = useState(0.05);

  // Shatter Voronoi controls
  const [shatterIrregular, setShatterIrregular] = useState(0.85);
  const [shatterTilt, setShatterTilt] = useState(1.9);
  const [shatterLift, setShatterLift] = useState(32);

  // Matter Physics controls
  const [zeroGravity, setZeroGravity] = useState(false);
  const [bodyCount, setBodyCount] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);

  const fluidParamsRef = useRef({ distortion, dispersion, vorticity });
  fluidParamsRef.current = { distortion, dispersion, vorticity };

  const particleParamsRef = useRef({ particleShape, turbulence, pointSize });
  particleParamsRef.current = { particleShape, turbulence, pointSize };

  const studioParamsRef = useRef<GlassStudioParams>({
    shape: studioShape,
    ior: studioIor,
    dispersion: studioDispersion,
    roughness: studioRoughness,
  });
  studioParamsRef.current = {
    shape: studioShape,
    ior: studioIor,
    dispersion: studioDispersion,
    roughness: studioRoughness,
  };

  const shatterParamsRef = useRef<ShatterParams>({
    shards: shatterIrregular,
    tilt: shatterTilt,
    lift: shatterLift,
  });
  shatterParamsRef.current = {
    shards: shatterIrregular,
    tilt: shatterTilt,
    lift: shatterLift,
  };

  const physicsApiRef = useRef<{
    spawnBody: () => void;
    shockwave: () => void;
    reset: () => void;
    setZeroG: (zg: boolean) => void;
  } | null>(null);

  useEffect(() => {
    physicsApiRef.current?.setZeroG(zeroGravity);
  }, [zeroGravity]);

  useEffect(() => {
    const container = stageRef.current;
    if (!container) return;

    if (activeEngine === 'glass-studio') {
      return mountGlassStudioEngine(container, studioParamsRef);
    }

    if (activeEngine === 'shatter-optics') {
      return mountShatterEngine(container, shatterParamsRef);
    }

    if (activeEngine === 'shader-fluid') {
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      container.appendChild(canvas);

      const gl = canvas.getContext('webgl2', {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
      });

      const supportsFloat =
        gl &&
        Boolean(
          gl.getExtension('EXT_color_buffer_float') ||
            gl.getExtension('EXT_color_buffer_half_float')
        );

      if (gl && supportsFloat) {
        const rectCache = createRectCache(canvas);
        const shaders: WebGLShader[] = [];
        const programs: WebGLProgram[] = [];

        const compile = (type: number, src: string) => {
          const s = gl.createShader(type)!;
          gl.shaderSource(s, src);
          gl.compileShader(s);
          shaders.push(s);
          return s;
        };

        const vShader = compile(gl.VERTEX_SHADER, NS_VERT);
        const makeProg = (frag: string) => {
          const p = gl.createProgram()!;
          gl.attachShader(p, vShader);
          gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
          gl.linkProgram(p);
          programs.push(p);
          const uniforms: Record<string, WebGLUniformLocation> = {};
          const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
          for (let i = 0; i < count; i++) {
            const info = gl.getActiveUniform(p, i);
            if (info) {
              const loc = gl.getUniformLocation(p, info.name);
              if (loc) uniforms[info.name] = loc;
            }
          }
          return { program: p, uniforms };
        };

        const splatProg = makeProg(NS_SPLAT);
        const advectProg = makeProg(NS_ADVECT);
        const divProg = makeProg(NS_DIVERGENCE);
        const curlProg = makeProg(NS_CURL);
        const vortProg = makeProg(NS_VORTICITY);
        const pressProg = makeProg(NS_PRESSURE);
        const gradProg = makeProg(NS_GRADIENT);
        const dispProg = makeProg(NS_DISPLAY);

        const quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quad);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          gl.STATIC_DRAW
        );
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        interface FboTarget {
          fbo: WebGLFramebuffer;
          tex: WebGLTexture;
          w: number;
          h: number;
        }
        interface DoubleFbo {
          read: FboTarget;
          write: FboTarget;
          swap: () => void;
        }

        const createTarget = (w: number, h: number, linear: boolean): FboTarget => {
          const tex = gl.createTexture()!;
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);

          const fbo = gl.createFramebuffer()!;
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
          gl.viewport(0, 0, w, h);
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          return { fbo, tex, w, h };
        };

        const createDouble = (w: number, h: number, linear: boolean): DoubleFbo => {
          let a = createTarget(w, h, linear);
          let b = createTarget(w, h, linear);
          return {
            get read() {
              return a;
            },
            get write() {
              return b;
            },
            swap() {
              const t = a;
              a = b;
              b = t;
            },
          };
        };

        const SIM_RES = 128;
        const DYE_RES = 384;
        const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
        const simW = aspect >= 1 ? Math.round(SIM_RES * aspect) : SIM_RES;
        const simH = aspect >= 1 ? SIM_RES : Math.round(SIM_RES / aspect);
        const dyeW = aspect >= 1 ? Math.round(DYE_RES * aspect) : DYE_RES;
        const dyeH = aspect >= 1 ? DYE_RES : Math.round(DYE_RES / aspect);

        const velocity = createDouble(simW, simH, true);
        const dye = createDouble(dyeW, dyeH, true);
        const divergence = createTarget(simW, simH, false);
        const curl = createTarget(simW, simH, false);
        const pressure = createDouble(simW, simH, false);

        const blit = (target: FboTarget | null) => {
          if (target) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
            gl.viewport(0, 0, target.w, target.h);
          } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, canvas.width, canvas.height);
          }
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        };

        const syncSize = () => {
          const dpr = getBoundedPixelRatio(canvas, gl);
          const w = Math.max(1, Math.round(container.clientWidth * dpr));
          const h = Math.max(1, Math.round(container.clientHeight * dpr));
          if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
          }
        };
        syncSize();

        const resizeObs = createCanvasResizeObserver(syncSize);
        resizeObs.observe(container);

        const splatQueue: Array<{
          x: number;
          y: number;
          dx: number;
          dy: number;
          color: [number, number, number];
        }> = [];

        let prevPx = 0.5;
        let prevPy = 0.5;
        let hasPrev = false;

        const queueSplat = (x: number, y: number, dx: number, dy: number, boost = 1) => {
          if (splatQueue.length > 16) splatQueue.shift();
          const hueShift = performance.now() * 0.0014;
          const clampedDx = Math.max(-14, Math.min(14, dx * boost));
          const clampedDy = Math.max(-14, Math.min(14, dy * boost));
          splatQueue.push({
            x,
            y,
            dx: clampedDx,
            dy: clampedDy,
            color: [
              0.1 + 0.08 * Math.sin(hueShift),
              0.28 + 0.12 * Math.sin(hueShift + 2.1),
              0.52 + 0.14 * Math.sin(hueShift + 4.2),
            ],
          });
        };

        // Initial decorative laminar swirl on mount
        queueSplat(0.36, 0.52, 16, 9, 1.0);
        queueSplat(0.64, 0.48, -16, -9, 1.0);

        const onPointerMove = (e: PointerEvent) => {
          const r = rectCache.current;
          const nx = (e.clientX - r.left) / Math.max(r.width, 1);
          const ny = 1.0 - (e.clientY - r.top) / Math.max(r.height, 1);
          if (!hasPrev) {
            prevPx = nx;
            prevPy = ny;
            hasPrev = true;
            return;
          }
          const dx = (nx - prevPx) * 520;
          const dy = (ny - prevPy) * 520;
          prevPx = nx;
          prevPy = ny;
          if (Math.hypot(dx, dy) > 0.35) queueSplat(nx, ny, dx, dy, 1.0);
        };

        const onPointerDown = (e: PointerEvent) => {
          const r = rectCache.current;
          const nx = (e.clientX - r.left) / Math.max(r.width, 1);
          const ny = 1.0 - (e.clientY - r.top) / Math.max(r.height, 1);
          for (let a = 0; a < 4; a++) {
            const ang = (a / 4) * Math.PI * 2 + 0.4;
            queueSplat(nx, ny, Math.cos(ang) * 18, Math.sin(ang) * 18, 1.15);
          }
        };

        canvas.addEventListener('pointermove', onPointerMove, { passive: true });
        canvas.addEventListener('pointerdown', onPointerDown, { passive: true });

        let raf = 0;
        let last = performance.now();
        let elapsed = 0;

        const tick = (now: number) => {
          raf = requestAnimationFrame(tick);
          const frameDt = Math.min((now - last) / 1000, 1 / 30);
          last = now;
          elapsed += frameDt;
          const simDt = 1 / 60;

          const { distortion: distAmt, dispersion: dispAmt, vorticity: curlAmt } =
            fluidParamsRef.current;
          const simTexelX = 1 / simW;
          const simTexelY = 1 / simH;

          // 1. Splat queued forces + dye with smooth Gaussian radius
          gl.useProgram(splatProg.program);
          gl.uniform1f(splatProg.uniforms.uAspect, simW / simH);
          gl.uniform1f(splatProg.uniforms.uRadius, 0.012);

          while (splatQueue.length > 0) {
            const s = splatQueue.shift()!;
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
            gl.uniform1i(splatProg.uniforms.uTarget, 0);
            gl.uniform2f(splatProg.uniforms.uPoint, s.x, s.y);
            gl.uniform3f(splatProg.uniforms.uColor, s.dx, s.dy, 0);
            blit(velocity.write);
            velocity.swap();

            gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
            gl.uniform3f(splatProg.uniforms.uColor, s.color[0], s.color[1], s.color[2]);
            blit(dye.write);
            dye.swap();
          }

          // 2. Curl
          gl.useProgram(curlProg.program);
          gl.uniform2f(curlProg.uniforms.texelSize, simTexelX, simTexelY);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
          gl.uniform1i(curlProg.uniforms.uVelocity, 0);
          blit(curl);

          // 3. Vorticity Confinement
          gl.useProgram(vortProg.program);
          gl.uniform2f(vortProg.uniforms.texelSize, simTexelX, simTexelY);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
          gl.uniform1i(vortProg.uniforms.uVelocity, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, curl.tex);
          gl.uniform1i(vortProg.uniforms.uCurl, 1);
          gl.uniform1f(vortProg.uniforms.uCurlStrength, curlAmt * 3.8);
          gl.uniform1f(vortProg.uniforms.uDt, simDt);
          blit(velocity.write);
          velocity.swap();

          // 4. Divergence
          gl.useProgram(divProg.program);
          gl.uniform2f(divProg.uniforms.texelSize, simTexelX, simTexelY);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
          gl.uniform1i(divProg.uniforms.uVelocity, 0);
          blit(divergence);

          // 5. Jacobi Pressure Solve
          gl.useProgram(pressProg.program);
          gl.uniform2f(pressProg.uniforms.texelSize, simTexelX, simTexelY);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, divergence.tex);
          gl.uniform1i(pressProg.uniforms.uDivergence, 1);
          for (let i = 0; i < 8; i++) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
            gl.uniform1i(pressProg.uniforms.uPressure, 0);
            blit(pressure.write);
            pressure.swap();
          }

          // 6. Gradient Subtract
          gl.useProgram(gradProg.program);
          gl.uniform2f(gradProg.uniforms.texelSize, simTexelX, simTexelY);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, pressure.read.tex);
          gl.uniform1i(gradProg.uniforms.uPressure, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
          gl.uniform1i(gradProg.uniforms.uVelocity, 1);
          blit(velocity.write);
          velocity.swap();

          // 7. Advect Velocity & Dye
          gl.useProgram(advectProg.program);
          gl.uniform2f(advectProg.uniforms.texelSize, simTexelX, simTexelY);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
          gl.uniform1i(advectProg.uniforms.uVelocity, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
          gl.uniform1i(advectProg.uniforms.uSource, 1);
          gl.uniform1f(advectProg.uniforms.uDt, simDt);
          gl.uniform1f(advectProg.uniforms.uDissipation, 0.986);
          blit(velocity.write);
          velocity.swap();

          gl.uniform2f(advectProg.uniforms.texelSize, 1 / dyeW, 1 / dyeH);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
          gl.uniform1f(advectProg.uniforms.uDissipation, 0.975);
          blit(dye.write);
          dye.swap();

          // 8. Optical Dispersion Display Pass
          gl.useProgram(dispProg.program);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, dye.read.tex);
          gl.uniform1i(dispProg.uniforms.uDye, 0);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, velocity.read.tex);
          gl.uniform1i(dispProg.uniforms.uVelocity, 1);
          gl.uniform1f(dispProg.uniforms.uTime, elapsed);
          gl.uniform1f(dispProg.uniforms.uDistortion, distAmt * 3.5);
          gl.uniform1f(dispProg.uniforms.uDispersion, dispAmt);
          blit(null);
        };

        raf = requestAnimationFrame(tick);

        return () => {
          cancelAnimationFrame(raf);
          rectCache.destroy();
          resizeObs.disconnect();
          canvas.removeEventListener('pointermove', onPointerMove);
          canvas.removeEventListener('pointerdown', onPointerDown);
          [
            velocity.read,
            velocity.write,
            dye.read,
            dye.write,
            pressure.read,
            pressure.write,
            divergence,
            curl,
          ].forEach((t) => {
            gl.deleteFramebuffer(t.fbo);
            gl.deleteTexture(t.tex);
          });
          if (quad) gl.deleteBuffer(quad);
          programs.forEach((p) => gl.deleteProgram(p));
          shaders.forEach((s) => gl.deleteShader(s));
          if (canvas.parentNode === container) container.removeChild(canvas);
        };
      }

      // Clean Three.js fallback if float FBO extension isn't supported
      if (canvas.parentNode === container) container.removeChild(canvas);
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      } catch {
        return;
      }

      const dpr = getBoundedPixelRatio(container, renderer.getContext());
      const rect = container.getBoundingClientRect();
      renderer.setPixelRatio(dpr);
      renderer.setSize(rect.width, rect.height);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const rippleBuffer = Array.from({ length: 8 }, () => new THREE.Vector4(0.5, 0.5, -10, 0));
      let rippleIdx = 0;

      const uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(rect.width * dpr, rect.height * dpr) },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uDistortion: { value: fluidParamsRef.current.distortion },
        uDispersion: { value: fluidParamsRef.current.dispersion },
        uRipples: { value: rippleBuffer },
      };

      const geo = new THREE.PlaneGeometry(2, 2);
      const mat = new THREE.ShaderMaterial({
        vertexShader: FALLBACK_FLUID_VERT,
        fragmentShader: FALLBACK_FLUID_FRAG,
        uniforms,
      });
      scene.add(new THREE.Mesh(geo, mat));

      const clock = new THREE.Clock();
      const rectCache = createRectCache(renderer.domElement);

      const onDown = (e: PointerEvent) => {
        const b = rectCache.current;
        const u = (e.clientX - b.left) / Math.max(b.width, 1);
        const v = 1.0 - (e.clientY - b.top) / Math.max(b.height, 1);
        uniforms.uPointer.value.set(u, v);
        rippleBuffer[rippleIdx].set(u, v, clock.getElapsedTime(), 1.3);
        rippleIdx = (rippleIdx + 1) % 8;
      };
      renderer.domElement.addEventListener('pointerdown', onDown);

      const resizeObs = createCanvasResizeObserver(() => {
        const b = container.getBoundingClientRect();
        const newDpr = getBoundedPixelRatio(container, renderer.getContext());
        renderer.setPixelRatio(newDpr);
        renderer.setSize(b.width, b.height);
        uniforms.uResolution.value.set(b.width * newDpr, b.height * newDpr);
      });
      resizeObs.observe(container);

      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        uniforms.uTime.value = clock.getElapsedTime();
        uniforms.uDistortion.value = fluidParamsRef.current.distortion;
        uniforms.uDispersion.value = fluidParamsRef.current.dispersion;
        renderer.render(scene, camera);
      };
      tick();

      return () => {
        cancelAnimationFrame(raf);
        rectCache.destroy();
        resizeObs.disconnect();
        renderer.domElement.removeEventListener('pointerdown', onDown);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      };
    }

    if (activeEngine === 'curl-particles') {
      let renderer: THREE.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      } catch {
        return;
      }

      const dpr = getBoundedPixelRatio(container, renderer.getContext());
      const rect = container.getBoundingClientRect();
      renderer.setPixelRatio(dpr);
      renderer.setSize(rect.width, rect.height);
      renderer.setClearColor('#05070e', 1);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, rect.width / Math.max(rect.height, 1), 0.1, 100);
      camera.position.z = 5.4;

      const COUNT = compact ? 3000 : 5200;
      const positions = new Float32Array(COUNT * 3);
      const spherePos = new Float32Array(COUNT * 3);
      const torusPos = new Float32Array(COUNT * 3);
      const helixPos = new Float32Array(COUNT * 3);
      const seeds = new Float32Array(COUNT);

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        const u = ((i * 0.61803398875) % 1) * Math.PI * 2;
        const v = Math.acos(1 - 2 * ((i + 0.5) / COUNT));
        const rSphere = 1.65 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.18;

        spherePos[i3] = rSphere * Math.sin(v) * Math.cos(u);
        spherePos[i3 + 1] = rSphere * Math.sin(v) * Math.sin(u);
        spherePos[i3 + 2] = rSphere * Math.cos(v);

        const tA = (i / COUNT) * Math.PI * 2 * 3;
        const tB = (((i * 7) % COUNT) / COUNT) * Math.PI * 2;
        const major = 1.55;
        const minor = 0.52;
        torusPos[i3] = (major + minor * Math.cos(tB)) * Math.cos(tA);
        torusPos[i3 + 1] = (major + minor * Math.cos(tB)) * Math.sin(tA);
        torusPos[i3 + 2] = minor * Math.sin(tB) + Math.sin(tA * 2) * 0.25;

        const hT = (i / COUNT) * Math.PI * 8 - Math.PI * 4;
        const strand = i % 2 === 0 ? 0 : Math.PI;
        const hR = 1.15 + Math.sin(hT * 0.5) * 0.32;
        helixPos[i3] = Math.cos(hT + strand) * hR;
        helixPos[i3 + 1] = (i / COUNT - 0.5) * 3.4;
        helixPos[i3 + 2] = Math.sin(hT + strand) * hR;

        positions[i3] = spherePos[i3];
        positions[i3 + 1] = spherePos[i3 + 1];
        positions[i3 + 2] = spherePos[i3 + 2];
        seeds[i] = ((i * 9301 + 49297) % 233280) / 233280;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aSpherePos', new THREE.BufferAttribute(spherePos, 3));
      geo.setAttribute('aTorusPos', new THREE.BufferAttribute(torusPos, 3));
      geo.setAttribute('aHelixPos', new THREE.BufferAttribute(helixPos, 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

      const uniforms = {
        uTime: { value: 0 },
        uMorphSphere: { value: 1 },
        uMorphTorus: { value: 0 },
        uMorphHelix: { value: 0 },
        uTurbulence: { value: particleParamsRef.current.turbulence },
        uPointSize: { value: particleParamsRef.current.pointSize },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      };

      const mat = new THREE.ShaderMaterial({
        vertexShader: PARTICLE_VERTEX,
        fragmentShader: PARTICLE_FRAGMENT,
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });

      const points = new THREE.Points(geo, mat);
      scene.add(points);

      let dragging = false;
      let prevX = 0;
      let prevY = 0;
      let rotX = 0.2;
      let rotY = 0.0;

      const dom = renderer.domElement;
      const rectCache = createRectCache(dom);

      const onPointerDown = (e: PointerEvent) => {
        dragging = true;
        prevX = e.clientX;
        prevY = e.clientY;
      };
      const onPointerUp = () => {
        dragging = false;
      };
      const onPointerMove = (e: PointerEvent) => {
        const b = rectCache.current;
        uniforms.uPointer.value.set(
          (e.clientX - b.left) / Math.max(b.width, 1),
          1.0 - (e.clientY - b.top) / Math.max(b.height, 1)
        );
        if (dragging) {
          rotY += (e.clientX - prevX) * 0.008;
          rotX += (e.clientY - prevY) * 0.008;
          prevX = e.clientX;
          prevY = e.clientY;
        }
      };

      dom.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointerup', onPointerUp);
      dom.addEventListener('pointermove', onPointerMove);

      const ro = createCanvasResizeObserver(() => {
        const b = container.getBoundingClientRect();
        renderer.setPixelRatio(getBoundedPixelRatio(container, renderer.getContext()));
        renderer.setSize(b.width, b.height);
        camera.aspect = b.width / Math.max(b.height, 1);
        camera.updateProjectionMatrix();
      });
      ro.observe(container);

      const clock = new THREE.Clock();
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const t = clock.getElapsedTime();
        uniforms.uTime.value = t;
        uniforms.uTurbulence.value = particleParamsRef.current.turbulence;
        uniforms.uPointSize.value = particleParamsRef.current.pointSize;

        const targetS = particleParamsRef.current.particleShape === 'sphere' ? 1 : 0;
        const targetT = particleParamsRef.current.particleShape === 'torus' ? 1 : 0;
        const targetH = particleParamsRef.current.particleShape === 'helix' ? 1 : 0;

        uniforms.uMorphSphere.value += (targetS - uniforms.uMorphSphere.value) * 0.06;
        uniforms.uMorphTorus.value += (targetT - uniforms.uMorphTorus.value) * 0.06;
        uniforms.uMorphHelix.value += (targetH - uniforms.uMorphHelix.value) * 0.06;

        if (!dragging) rotY += 0.0035;
        points.rotation.x += (rotX - points.rotation.x) * 0.08;
        points.rotation.y += (rotY - points.rotation.y) * 0.08;

        renderer.render(scene, camera);
      };
      tick();

      return () => {
        cancelAnimationFrame(raf);
        rectCache.destroy();
        ro.disconnect();
        dom.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', onPointerUp);
        dom.removeEventListener('pointermove', onPointerMove);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        if (dom.parentNode === container) container.removeChild(dom);
      };
    }

    // Engine 3: Matter.js Liquid Glass Physics Sandbox
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = container.clientWidth || 640;
    let height = container.clientHeight || 420;
    let dpr = getBoundedPixelRatio(container);

    const resizeCanvas = () => {
      const b = container.getBoundingClientRect();
      width = Math.max(b.width, 100);
      height = Math.max(b.height, 100);
      dpr = getBoundedPixelRatio(container);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: zeroGravity ? 0 : 0.85, scale: 0.001 },
    });

    const wallThickness = 80;
    let walls = [
      Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + 200, wallThickness, {
        isStatic: true,
        restitution: 0.85,
      }),
      Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width + 200, wallThickness, {
        isStatic: true,
        restitution: 0.85,
      }),
      Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + 200, {
        isStatic: true,
        restitution: 0.85,
      }),
      Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + 200, {
        isStatic: true,
        restitution: 0.85,
      }),
    ];
    Matter.Composite.add(engine.world, walls);

    interface GlassMeta {
      kind: 'sphere' | 'capsule';
      radius: number;
      w?: number;
      h?: number;
      tintA: string;
      tintB: string;
      label?: string;
    }

    const palette: Array<[string, string]> = [
      ['#7dd3fc', '#818cf8'],
      ['#a5f3fc', '#c084fc'],
      ['#e0f2fe', '#f472b6'],
      ['#bae6fd', '#fde68a'],
    ];

    const labels = ['GLSL', 'MATTER', 'OPTICS', 'WEBGL2', 'LENIS', 'GSAP', 'CAUSTIC', 'PRISM'];

    const createGlassBody = (x: number, y: number, idx: number): Matter.Body => {
      const [tintA, tintB] = palette[idx % palette.length];
      const isCapsule = idx % 3 === 1;
      if (isCapsule) {
        const w = 92 + (idx % 3) * 18;
        const h = 40;
        const body = Matter.Bodies.rectangle(x, y, w, h, {
          chamfer: { radius: h / 2 - 1 },
          restitution: 0.82,
          friction: 0.02,
          frictionAir: 0.008,
        });
        (body as unknown as { glassMeta: GlassMeta }).glassMeta = {
          kind: 'capsule',
          radius: h / 2,
          w,
          h,
          tintA,
          tintB,
          label: labels[idx % labels.length],
        };
        return body;
      }
      const radius = 22 + (idx % 4) * 9;
      const body = Matter.Bodies.circle(x, y, radius, {
        restitution: 0.88,
        friction: 0.015,
        frictionAir: 0.007,
      });
      (body as unknown as { glassMeta: GlassMeta }).glassMeta = {
        kind: 'sphere',
        radius,
        tintA,
        tintB,
      };
      return body;
    };

    const seedCount = compact ? 14 : 22;
    let bodySerial = 0;
    const initialBodies = Array.from({ length: seedCount }, (_, i) => {
      bodySerial += 1;
      return createGlassBody(
        width * 0.16 + ((i * 79) % Math.max(width * 0.68, 80)),
        height * 0.15 + ((i * 53) % Math.max(height * 0.45, 60)),
        bodySerial
      );
    });
    Matter.Composite.add(engine.world, initialBodies);
    setBodyCount(initialBodies.length);

    const mouse = Matter.Mouse.create(canvas);
    mouse.pixelRatio = dpr;
    const mouseWheelHandler = (mouse as unknown as { mousewheel?: EventListener }).mousewheel;
    if (mouseWheelHandler) {
      canvas.removeEventListener('wheel', mouseWheelHandler);
    }

    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.18,
        render: { visible: false },
      },
    });
    Matter.Composite.add(engine.world, mouseConstraint);

    const applyShockwave = (cx: number, cy: number) => {
      const bodies = Matter.Composite.allBodies(engine.world);
      for (const b of bodies) {
        if (b.isStatic) continue;
        const dx = b.position.x - cx;
        const dy = b.position.y - cy;
        const dist = Math.max(Math.hypot(dx, dy), 24);
        if (dist < 280) {
          const forceMag = (1 - dist / 280) * 0.085 * b.mass;
          Matter.Body.applyForce(b, b.position, {
            x: (dx / dist) * forceMag,
            y: (dy / dist) * forceMag - 0.015 * b.mass,
          });
        }
      }
    };

    const rectCache = createRectCache(container);

    const onCanvasClick = (e: MouseEvent) => {
      if (mouseConstraint.body) return;
      const b = rectCache.current;
      applyShockwave(e.clientX - b.left, e.clientY - b.top);
    };
    canvas.addEventListener('click', onCanvasClick);

    const ro = createCanvasResizeObserver(() => {
      resizeCanvas();
      mouse.pixelRatio = dpr;
      Matter.Composite.remove(engine.world, walls);
      walls = [
        Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + 200, wallThickness, {
          isStatic: true,
          restitution: 0.85,
        }),
        Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width + 200, wallThickness, {
          isStatic: true,
          restitution: 0.85,
        }),
        Matter.Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + 200, {
          isStatic: true,
          restitution: 0.85,
        }),
        Matter.Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + 200, {
          isStatic: true,
          restitution: 0.85,
        }),
      ];
      Matter.Composite.add(engine.world, walls);
    });
    ro.observe(container);

    physicsApiRef.current = {
      spawnBody: () => {
        const dynamicCount = Matter.Composite.allBodies(engine.world).filter((b) => !b.isStatic).length;
        if (dynamicCount >= 48) return;
        bodySerial += 1;
        const nb = createGlassBody(width * (0.25 + Math.random() * 0.5), 42, bodySerial);
        Matter.Composite.add(engine.world, nb);
        setBodyCount(dynamicCount + 1);
      },
      shockwave: () => {
        applyShockwave(width * 0.5, height * 0.65);
      },
      reset: () => {
        const current = Matter.Composite.allBodies(engine.world).filter((b) => !b.isStatic);
        Matter.Composite.remove(engine.world, current);
        const fresh = Array.from({ length: seedCount }, (_, i) => {
          bodySerial += 1;
          return createGlassBody(
            width * 0.16 + ((i * 79) % Math.max(width * 0.68, 80)),
            height * 0.15 + ((i * 53) % Math.max(height * 0.45, 60)),
            bodySerial
          );
        });
        Matter.Composite.add(engine.world, fresh);
        setBodyCount(fresh.length);
      },
      setZeroG: (zg: boolean) => {
        engine.gravity.y = zg ? 0 : 0.85;
        if (zg) {
          const all = Matter.Composite.allBodies(engine.world);
          for (const b of all) {
            if (!b.isStatic) {
              Matter.Body.setVelocity(b, {
                x: (Math.random() - 0.5) * 4,
                y: (Math.random() - 0.5) * 4,
              });
            }
          }
        }
      },
    };

    let raf = 0;
    let lastTime = performance.now();

    const renderPhysics = (now: number) => {
      raf = requestAnimationFrame(renderPhysics);
      const delta = Math.min(now - lastTime, 33.3);
      lastTime = now;
      Matter.Engine.update(engine, delta);

      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#070b14');
      bgGrad.addColorStop(1, '#05060b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
      ctx.lineWidth = 1;
      const step = 44;
      for (let gx = step; gx < width; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = step; gy < height; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      const bodies = Matter.Composite.allBodies(engine.world);
      for (const b of bodies) {
        if (b.isStatic) continue;
        const meta = (b as unknown as { glassMeta?: GlassMeta }).glassMeta;
        if (!meta) continue;

        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);

        if (meta.kind === 'sphere') {
          const r = meta.radius;
          const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
          grad.addColorStop(0, 'rgba(255,255,255,0.68)');
          grad.addColorStop(0.32, `${meta.tintA}44`);
          grad.addColorStop(0.82, `${meta.tintB}26`);
          grad.addColorStop(1, 'rgba(255,255,255,0.12)');

          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.lineWidth = 1.25;
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(0, 0, r * 0.72, Math.PI * 1.12, Math.PI * 1.62);
          ctx.strokeStyle = 'rgba(255,255,255,0.82)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          const w = meta.w ?? 96;
          const h = meta.h ?? 40;
          const r = h / 2;

          ctx.beginPath();
          ctx.roundRect(-w / 2, -h / 2, w, h, r);
          const capGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
          capGrad.addColorStop(0, `${meta.tintA}36`);
          capGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
          capGrad.addColorStop(1, `${meta.tintB}28`);
          ctx.fillStyle = capGrad;
          ctx.fill();

          ctx.lineWidth = 1.2;
          ctx.strokeStyle = 'rgba(255,255,255,0.4)';
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(-w / 2 + r, -h / 2 + 2.5);
          ctx.lineTo(w / 2 - r, -h / 2 + 2.5);
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1.4;
          ctx.stroke();

          if (meta.label) {
            ctx.fillStyle = 'rgba(245, 247, 255, 0.88)';
            ctx.font = '500 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(meta.label, 0, 0.5);
          }
        }
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(renderPhysics);

    return () => {
      cancelAnimationFrame(raf);
      rectCache.destroy();
      ro.disconnect();
      canvas.removeEventListener('click', onCanvasClick);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
      physicsApiRef.current = null;
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [activeEngine, compact]);

  const engines: Array<{
    id: LabEngineId;
    name: string;
    tech: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'shader-fluid',
      name: '流体折射',
      tech: 'FBO',
      icon: <Waves className="h-3.5 w-3.5" />,
    },
    {
      id: 'glass-studio',
      name: '3D 玻璃物体',
      tech: 'PMREM',
      icon: <Gem className="h-3.5 w-3.5" />,
    },
    {
      id: 'shatter-optics',
      name: '破碎棱镜',
      tech: 'Voronoi',
      icon: <Grid2x2 className="h-3.5 w-3.5" />,
    },
    {
      id: 'curl-particles',
      name: '旋度粒子',
      tech: 'GPGPU',
      icon: <Atom className="h-3.5 w-3.5" />,
    },
    {
      id: 'matter-physics',
      name: '物理沙盒',
      tech: 'Matter.js',
      icon: <Sparkles className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <div className="liquid-glass relative overflow-hidden rounded-[2rem] p-2 sm:p-3">
      {/* Top Engine Switcher & Telemetry Strip */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-2 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {engines.map((eng) => {
            const active = activeEngine === eng.id;
            return (
              <button
                key={eng.id}
                type="button"
                onClick={() => setActiveEngine(eng.id)}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'liquid-droplet text-white'
                    : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:text-white'
                }`}
              >
                {eng.icon}
                <span>{eng.name}</span>
                <span className="font-mono-tech hidden text-[10px] text-sky-200/75 sm:inline">
                  {eng.tech}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono-tech hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-300 md:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            {activeEngine === 'shader-fluid' && 'NAVIER-STOKES FBO // SWIPE'}
            {activeEngine === 'glass-studio' && 'GLASS OBJECT // ORBIT DRAG'}
            {activeEngine === 'shatter-optics' && 'VORONOI SHATTER // HOVER LENS'}
            {activeEngine === 'curl-particles' && `PARTICLES // ${compact ? '3,000' : '5,200'} DRAG`}
            {activeEngine === 'matter-physics' && `RIGID BODIES // ${bodyCount} DRAGGABLE`}
          </span>
          {compact && onOpenFullLab && (
            <MagneticButton variant="glass" onClick={onOpenFullLab} className="px-3.5 py-1.5 text-xs">
              进入完整实验室
            </MagneticButton>
          )}
        </div>
      </div>

      {/* Main Canvas Stage */}
      <div
        className={`relative w-full overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#05070e] ${
          compact ? 'h-[360px] sm:h-[420px]' : 'h-[480px] sm:h-[560px] lg:h-[600px]'
        }`}
      >
        <div
          ref={stageRef}
          data-cursor={
            activeEngine === 'matter-physics' || activeEngine === 'glass-studio' ? 'DRAG' : 'PLAY'
          }
          className="h-full w-full cursor-crosshair"
        />

        {/* Floating Liquid Glass Control HUD */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex flex-wrap items-end justify-between gap-3 sm:inset-x-5 sm:bottom-5">
          <div className="liquid-glass-pill pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl px-4 py-2.5 text-xs">
            <span className="inline-flex items-center gap-1.5 font-mono-tech text-[11px] text-sky-200/90">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              HUD
            </span>

            {activeEngine === 'glass-studio' && (
              <div className="flex flex-wrap items-center gap-2.5">
                {(['torusknot', 'prism', 'torus', 'droplet'] as StudioShapeId[]).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => setStudioShape(shape)}
                    className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${
                      studioShape === shape
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
                <label className="ml-1 flex items-center gap-2 text-slate-200">
                  <span className="text-[11px] text-slate-300">IOR</span>
                  <input
                    type="range"
                    min="1.1"
                    max="2.3"
                    step="0.05"
                    value={studioIor}
                    onChange={(e) => setStudioIor(parseFloat(e.target.value))}
                    className="h-1 w-16 accent-sky-300"
                  />
                </label>
                <label className="hidden items-center gap-2 text-slate-200 sm:flex">
                  <span className="text-[11px] text-slate-300">色散</span>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="0.1"
                    value={studioDispersion}
                    onChange={(e) => setStudioDispersion(parseFloat(e.target.value))}
                    className="h-1 w-16 accent-violet-300"
                  />
                </label>
                <label className="hidden items-center gap-2 text-slate-200 md:flex">
                  <span className="text-[11px] text-slate-300">磨砂</span>
                  <input
                    type="range"
                    min="0"
                    max="0.35"
                    step="0.01"
                    value={studioRoughness}
                    onChange={(e) => setStudioRoughness(parseFloat(e.target.value))}
                    className="h-1 w-14 accent-cyan-300"
                  />
                </label>
              </div>
            )}

            {activeEngine === 'shatter-optics' && (
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-slate-200">
                  <span className="text-[11px] text-slate-300">碎片度</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={shatterIrregular}
                    onChange={(e) => setShatterIrregular(parseFloat(e.target.value))}
                    className="h-1 w-16 accent-sky-300"
                  />
                </label>
                <label className="flex items-center gap-2 text-slate-200">
                  <span className="text-[11px] text-slate-300">3D 倾角</span>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={shatterTilt}
                    onChange={(e) => setShatterTilt(parseFloat(e.target.value))}
                    className="h-1 w-16 accent-violet-300"
                  />
                </label>
                <label className="hidden items-center gap-2 text-slate-200 sm:flex">
                  <span className="text-[11px] text-slate-300">悬浮高度</span>
                  <input
                    type="range"
                    min="8"
                    max="56"
                    step="2"
                    value={shatterLift}
                    onChange={(e) => setShatterLift(parseFloat(e.target.value))}
                    className="h-1 w-16 accent-cyan-300"
                  />
                </label>
              </div>
            )}

            {activeEngine === 'shader-fluid' && (
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-slate-200">
                  <span className="text-[11px] text-slate-300">折射畸变</span>
                  <input
                    type="range"
                    min="0.3"
                    max="2.5"
                    step="0.05"
                    value={distortion}
                    onChange={(e) => setDistortion(parseFloat(e.target.value))}
                    className="h-1 w-20 accent-sky-300"
                  />
                </label>
                <label className="flex items-center gap-2 text-slate-200">
                  <span className="text-[11px] text-slate-300">色散</span>
                  <input
                    type="range"
                    min="0.0"
                    max="2.5"
                    step="0.05"
                    value={dispersion}
                    onChange={(e) => setDispersion(parseFloat(e.target.value))}
                    className="h-1 w-20 accent-violet-300"
                  />
                </label>
                <label className="hidden items-center gap-2 text-slate-200 sm:flex">
                  <span className="text-[11px] text-slate-300">旋度</span>
                  <input
                    type="range"
                    min="0.4"
                    max="4.0"
                    step="0.1"
                    value={vorticity}
                    onChange={(e) => setVorticity(parseFloat(e.target.value))}
                    className="h-1 w-20 accent-cyan-300"
                  />
                </label>
              </div>
            )}

            {activeEngine === 'curl-particles' && (
              <div className="flex flex-wrap items-center gap-2.5">
                {(['sphere', 'torus', 'helix'] as ParticleShape[]).map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => setParticleShape(shape)}
                    className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] uppercase tracking-wider transition ${
                      particleShape === shape
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
                <label className="ml-1 flex items-center gap-2 text-slate-200">
                  <span className="text-[11px] text-slate-300">湍流</span>
                  <input
                    type="range"
                    min="0.1"
                    max="2.2"
                    step="0.05"
                    value={turbulence}
                    onChange={(e) => setTurbulence(parseFloat(e.target.value))}
                    className="h-1 w-16 accent-sky-300"
                  />
                </label>
                <label className="hidden items-center gap-2 text-slate-200 sm:flex">
                  <span className="text-[11px] text-slate-300">粒子大小</span>
                  <input
                    type="range"
                    min="10"
                    max="34"
                    step="1"
                    value={pointSize}
                    onChange={(e) => setPointSize(parseFloat(e.target.value))}
                    className="h-1 w-16 accent-violet-300"
                  />
                </label>
              </div>
            )}

            {activeEngine === 'matter-physics' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => physicsApiRef.current?.spawnBody()}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[11px] text-white transition hover:bg-white/25"
                >
                  <Plus className="h-3 w-3" />
                  注入玻璃体
                </button>
                <button
                  type="button"
                  onClick={() => physicsApiRef.current?.shockwave()}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-sky-400/20 px-3 py-1 text-[11px] text-sky-100 transition hover:bg-sky-400/35"
                >
                  <Zap className="h-3 w-3" />
                  冲击波
                </button>
                <button
                  type="button"
                  onClick={() => setZeroGravity((v) => !v)}
                  className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1 text-[11px] transition ${
                    zeroGravity
                      ? 'bg-violet-400/35 text-white ring-1 ring-violet-300/50'
                      : 'bg-white/10 text-slate-200 hover:bg-white/20'
                  }`}
                >
                  <Orbit className="h-3 w-3" />
                  {zeroGravity ? '零重力 ON' : '零重力'}
                </button>
                <button
                  type="button"
                  onClick={() => physicsApiRef.current?.reset()}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-white/20"
                  aria-label="重置物理世界"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div className="liquid-glass-pill hidden rounded-full px-3 py-1.5 font-mono-tech text-[10px] text-slate-300 lg:block">
            {activeEngine === 'shader-fluid' && '滑动注入涡流 · 点击释放多向流体脉冲'}
            {activeEngine === 'glass-studio' && '拖拽 360° 旋转玻璃晶体 · 实时调节 IOR 与色散'}
            {activeEngine === 'shatter-optics' && '移动指针悬浮折光碎晶 · 实时投射立体阴影'}
            {activeEngine === 'curl-particles' && '拖拽旋转空间拓扑 · 悬停触发磁场排斥'}
            {activeEngine === 'matter-physics' && '拖拽抛掷玻璃胶囊 · 点击空白处触发冲击波'}
          </div>
        </div>
      </div>
    </div>
  );
};
