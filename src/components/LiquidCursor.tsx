import React, { useEffect, useRef, useState } from 'react';
import {
  createCanvasResizeObserver,
  expDamp,
  getBoundedPixelRatio,
} from '../lib/canvasOptics';

const MAX_TRAIL = 12;

const BUBBLE_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const BUBBLE_FRAG = /* glsl */ `#version 300 es
precision highp float;
out vec4 outColor;

uniform vec2 uResolution;
uniform float uTime;
uniform int uCount;
uniform vec2 uTrail[${MAX_TRAIL}];
uniform float uBaseRadius;
uniform float uBlend;
uniform float uAlpha;

const float EPS = 1e-4;
const int ITR = 14;

float rnd3D(vec3 p) {
  return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453123);
}

float noise3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);

  float a000 = rnd3D(i);
  float a100 = rnd3D(i + vec3(1.0, 0.0, 0.0));
  float a010 = rnd3D(i + vec3(0.0, 1.0, 0.0));
  float a110 = rnd3D(i + vec3(1.0, 1.0, 0.0));
  float a001 = rnd3D(i + vec3(0.0, 0.0, 1.0));
  float a101 = rnd3D(i + vec3(1.0, 0.0, 1.0));
  float a011 = rnd3D(i + vec3(0.0, 1.0, 1.0));
  float a111 = rnd3D(i + vec3(1.0, 1.0, 1.0));

  float x00 = mix(a000, a100, u.x);
  float x10 = mix(a010, a110, u.x);
  float x01 = mix(a001, a101, u.x);
  float x11 = mix(a011, a111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}

float smoothMin(float d1, float d2, float k) {
  float h = exp(-k * d1) + exp(-k * d2);
  return -log(max(h, 1e-12)) / k;
}

float mapField(vec3 p) {
  float radius = uBaseRadius * float(uCount);
  float d = 1e5;
  for (int i = 0; i < ${MAX_TRAIL}; i++) {
    if (i >= uCount) break;
    float sphere = length(p - vec3(uTrail[i], 0.0)) - (radius - uBaseRadius * float(i));
    d = smoothMin(d, sphere, uBlend);
  }
  // Compensate smoothMin N-sphere overlap inflation so resting droplet stays crisp
  return d + log(float(uCount)) / (uBlend * 1.18);
}

vec3 calcNormal(vec3 p) {
  return normalize(vec3(
    mapField(p + vec3(EPS, 0.0, 0.0)) - mapField(p - vec3(EPS, 0.0, 0.0)),
    mapField(p + vec3(0.0, EPS, 0.0)) - mapField(p - vec3(0.0, EPS, 0.0)),
    mapField(p + vec3(0.0, 0.0, EPS)) - mapField(p - vec3(0.0, 0.0, -EPS))
  ));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float minRes = min(uResolution.x, uResolution.y);
  vec2 p = (frag * 2.0 - uResolution) / minRes;

  vec3 ray = vec3(p, 1.0);
  vec3 rayDir = vec3(0.0, 0.0, -1.0);
  float dist = 0.0;

  for (int i = 0; i < ITR; i++) {
    dist = mapField(ray);
    ray += rayDir * dist;
    if (dist < EPS || dist > 6.0) break;
  }

  float cov = 1.0 - smoothstep(0.0, 3.0 / minRes, dist);
  if (cov <= 0.002) {
    outColor = vec4(0.0);
    return;
  }

  vec3 n = calcNormal(ray);
  vec3 refl = reflect(rayDir, n);
  float nPos = noise3D(refl * 2.2 + uTime);
  float nNeg = noise3D(refl * 2.2 - uTime);

  vec3 colorA = vec3(0.45, 0.82, 1.0) * nPos;
  vec3 colorB = vec3(0.78, 0.54, 0.98) * nNeg;
  vec3 glints = pow(max((colorA + colorB) * 1.15, 0.0), vec3(4.5));

  vec3 L = normalize(vec3(-0.5, 0.75, 0.65));
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 48.0);
  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 1.65);

  float fade = cov * uAlpha;
  vec3 light = glints * 0.45 + vec3(spec * 0.42) + vec3(0.72, 0.9, 1.0) * (0.42 * rim + 0.02);
  float outA = fade * clamp(0.05 + 0.34 * rim + spec * 0.16, 0.0, 0.46);
  outColor = vec4(light * fade, outA);
}`;

/**
 * Custom desktop optical cursor combining:
 * 1) Scissor-tested WebGL2 Raymarched SDF Metaball Glass Trail with idle-sleep loop
 * 2) Frosted Liquid Glass pill badge when hovering [data-cursor] interactive surfaces
 */
export const LiquidCursor: React.FC = () => {
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<string>('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;

    setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = glCanvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: true,
    });

    const trailX = new Float32Array(MAX_TRAIL);
    const trailY = new Float32Array(MAX_TRAIL);
    const trailData = new Float32Array(MAX_TRAIL * 2);

    let targetX = window.innerWidth * 0.5;
    let targetY = window.innerHeight * 0.5;
    trailX.fill(targetX);
    trailY.fill(targetY);

    let pillX = targetX;
    let pillY = targetY;
    let presence = 0;
    let presenceTarget = 0;
    let lastLabel = '';
    let hasPointer = false;
    let time = 0;
    let raf = 0;
    let running = false;
    let destroyed = false;
    let lastTime = performance.now();

    let program: WebGLProgram | null = null;
    let vShader: WebGLShader | null = null;
    let fShader: WebGLShader | null = null;
    let quadBuf: WebGLBuffer | null = null;
    const uniforms: Record<string, WebGLUniformLocation> = {};

    const syncSize = () => {
      const w = Math.max(window.innerWidth, 1);
      const h = Math.max(window.innerHeight, 1);
      const dpr = getBoundedPixelRatio(canvas, gl);
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };

    if (gl && !gl.isContextLost()) {
      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          gl.deleteShader(s);
          return null;
        }
        return s;
      };

      vShader = compile(gl.VERTEX_SHADER, BUBBLE_VERT);
      fShader = compile(gl.FRAGMENT_SHADER, BUBBLE_FRAG);
      if (vShader && fShader) {
        program = gl.createProgram()!;
        gl.attachShader(program, vShader);
        gl.attachShader(program, fShader);
        gl.linkProgram(program);
        if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
          const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
          for (let i = 0; i < count; i++) {
            const info = gl.getActiveUniform(program, i);
            if (info) {
              const loc = gl.getUniformLocation(program, info.name);
              if (loc) uniforms[info.name] = loc;
            }
          }
          quadBuf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
          gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
            gl.STATIC_DRAW
          );
          gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        } else {
          gl.deleteProgram(program);
          program = null;
        }
      }
      syncSize();
    }

    const resizeObserver = createCanvasResizeObserver(() => {
      if (gl) syncSize();
    });
    resizeObserver.observe(canvas);

    const renderFrame = (now: number) => {
      if (destroyed) return;
      const dt = Math.min((now - lastTime) / 1000, 1 / 24);
      lastTime = now;
      time += dt * 1.6;

      // Exponential smoothing for pill + 12-node metaball trail
      pillX = expDamp(pillX, targetX, 16, dt);
      pillY = expDamp(pillY, targetY, 16, dt);
      presence = expDamp(presence, presenceTarget, 10, dt);

      trailX[0] = expDamp(trailX[0], targetX, 20, dt);
      trailY[0] = expDamp(trailY[0], targetY, 20, dt);
      for (let i = 1; i < MAX_TRAIL; i++) {
        trailX[i] = expDamp(trailX[i], trailX[i - 1], 24, dt);
        trailY[i] = expDamp(trailY[i], trailY[i - 1], 24, dt);
      }

      if (pillRef.current) {
        pillRef.current.style.transform = `translate3d(${pillX.toFixed(1)}px, ${pillY.toFixed(1)}px, 0) translate(-50%, -50%)`;
        pillRef.current.style.opacity = presence > 0.02 ? String(Math.min(presence * 1.4, 1)) : '0';
      }

      if (gl && program) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.disable(gl.SCISSOR_TEST);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (presence > 0.01) {
          const dpr = canvas.width / Math.max(window.innerWidth, 1);
          const minRes = Math.min(canvas.width, canvas.height);
          const headRadius = 11 * dpr * presence;
          const baseRadius = (headRadius * 2) / (minRes * MAX_TRAIL);
          const blend = 44.0;

          let minX = Infinity;
          let maxX = -Infinity;
          let minY = Infinity;
          let maxY = -Infinity;

          for (let i = 0; i < MAX_TRAIL; i++) {
            const dx = trailX[i] * dpr;
            const dy = canvas.height - trailY[i] * dpr;
            trailData[i * 2] = (dx * 2 - canvas.width) / minRes;
            trailData[i * 2 + 1] = (dy * 2 - canvas.height) / minRes;
            minX = Math.min(minX, dx);
            maxX = Math.max(maxX, dx);
            minY = Math.min(minY, dy);
            maxY = Math.max(maxY, dy);
          }

          // Generous scissor bounding box covering smoothMin halo so edges are never clipped
          const pad = headRadius + ((Math.log(MAX_TRAIL + 1) / blend) * minRes) + 48 * dpr;
          const sx = Math.max(0, Math.floor(minX - pad));
          const sy = Math.max(0, Math.floor(minY - pad));
          const sw = Math.min(canvas.width - sx, Math.ceil(maxX - minX + pad * 2));
          const sh = Math.min(canvas.height - sy, Math.ceil(maxY - minY + pad * 2));

          if (sw > 0 && sh > 0) {
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(sx, sy, sw, sh);
            gl.useProgram(program);
            gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
            gl.uniform1f(uniforms.uTime, time);
            gl.uniform1i(uniforms.uCount, MAX_TRAIL);
            gl.uniform2fv(uniforms['uTrail[0]'], trailData);
            gl.uniform1f(uniforms.uBaseRadius, baseRadius);
            gl.uniform1f(uniforms.uBlend, blend);
            gl.uniform1f(uniforms.uAlpha, presence);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            gl.disable(gl.SCISSOR_TEST);
          }
        }
      }

      // Auto-sleep once pointer settles & trail catches up (0% idle CPU/GPU cost)
      const tailDist = Math.hypot(
        trailX[MAX_TRAIL - 1] - targetX,
        trailY[MAX_TRAIL - 1] - targetY
      );
      const settled =
        tailDist < 0.35 &&
        Math.abs(presenceTarget - presence) < 0.008 &&
        Math.abs(pillX - targetX) < 0.2 &&
        Math.abs(pillY - targetY) < 0.2;

      if (settled && (!hasPointer || presenceTarget === 0)) {
        running = false;
        return;
      }
      if (settled && tailDist < 0.25 && lastLabel === '') {
        // Keep minimal idle sleep when cursor is completely still
        running = false;
        return;
      }

      raf = requestAnimationFrame(renderFrame);
    };

    const wake = () => {
      if (destroyed || running) return;
      running = true;
      lastTime = performance.now();
      raf = requestAnimationFrame(renderFrame);
    };

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!hasPointer) {
        hasPointer = true;
        pillX = targetX;
        pillY = targetY;
        trailX.fill(targetX);
        trailY.fill(targetY);
      }
      const el = (e.target as HTMLElement | null)?.closest?.('[data-cursor]') as HTMLElement | null;
      const nextLabel = el?.dataset.cursor ?? '';
      if (nextLabel !== lastLabel) {
        lastLabel = nextLabel;
        setLabel(nextLabel);
      }
      presenceTarget = nextLabel ? 0.35 : 1.0;
      wake();
    };

    const onLeave = () => {
      hasPointer = false;
      presenceTarget = 0;
      if (lastLabel !== '') {
        lastLabel = '';
        setLabel('');
      }
      wake();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    return () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      if (gl) {
        if (quadBuf) gl.deleteBuffer(quadBuf);
        if (program) gl.deleteProgram(program);
        if (vShader) gl.deleteShader(vShader);
        if (fShader) gl.deleteShader(fShader);
      }
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <canvas
        ref={glCanvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[88] h-full w-full"
      />
      <div
        ref={pillRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[90] opacity-0 transition-opacity duration-200"
      >
        {label ? (
          <div className="liquid-glass-pill flex h-8 items-center justify-center rounded-full px-3.5 text-[10px] font-medium tracking-[0.18em] text-white shadow-[0_8px_24px_rgba(125,211,252,0.22)]">
            <span className="font-mono-tech uppercase">{label}</span>
          </div>
        ) : (
          <div className="h-5 w-5 rounded-full border border-white/35 bg-white/[0.03]" />
        )}
      </div>
    </>
  );
};
