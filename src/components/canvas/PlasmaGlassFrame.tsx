import React, { useEffect, useRef } from 'react';
import {
  createCanvasResizeObserver,
  expDamp,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';

const PLASMA_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const PLASMA_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform vec2 uRectHalf;
uniform float uCorner;
uniform float uTime;
uniform float uBoost;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = rot * p * 2.02 + vec2(7.3, 13.1);
    a *= 0.5;
  }
  return v;
}

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec2 px = (vUv - 0.5) * uResolution;
  float sd = sdRoundRect(px, uRectHalf, uCorner);

  // Domain turbulence along rounded border
  float t = uTime * (0.75 + uBoost * 0.5);
  vec2 flowUv = px * 0.015 + vec2(0.0, -t * 0.85);
  float turb = (fbm(flowUv) - 0.5) * (14.0 + uBoost * 10.0);

  // Cryo-plasma rim glow hugging the rounded glass edge
  float dEdge = abs(sd + turb * 0.45);
  float plasmaRim = exp(-dEdge / (10.0 + uBoost * 6.0));
  float innerCore = exp(-dEdge / 2.2);

  // Rising soft circular stardust micro-sparks near top & lateral rim
  vec2 sparkUv = vec2(px.x * 0.065, px.y * 0.065 - t * 2.2);
  vec2 sparkCell = floor(sparkUv);
  vec2 sparkLocal = fract(sparkUv) - 0.5;
  float sRand = hash(sparkCell);
  float dotMask = smoothstep(0.26, 0.03, length(sparkLocal));
  float spark = dotMask * step(0.945 - uBoost * 0.03, sRand) * exp(-abs(sd) / 26.0);

  vec3 cryoBlue = vec3(0.28, 0.72, 1.0);
  vec3 prismViolet = vec3(0.68, 0.42, 0.98);
  vec3 hotCore = vec3(0.92, 0.97, 1.0);

  float colorMix = 0.5 + 0.5 * sin(px.x * 0.012 + t * 0.9);
  vec3 auraCol = mix(cryoBlue, prismViolet, colorMix);

  vec3 rgb = auraCol * plasmaRim * (0.65 + uBoost * 0.55)
    + hotCore * innerCore * (0.35 + uBoost * 0.35)
    + hotCore * spark * 0.9;

  float alpha = clamp(plasmaRim * 0.72 + innerCore * 0.4 + spark * 0.8, 0.0, 0.95);
  outColor = vec4(rgb * alpha, alpha);
}`;

interface PlasmaGlassFrameProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Harmonized Cryo-Plasma Glass Aura inspired by FlameWrap:
 * Wraps a rounded liquid glass card with dynamic FBM cryo-cyan/violet plasma
 * and rising micro-sparks that intensify smoothly on hover.
 */
export const PlasmaGlassFrame: React.FC<PlasmaGlassFrameProps> = ({
  children,
  className = '',
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boostTargetRef = useRef(0.15);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      depth: false,
      antialias: true,
      premultipliedAlpha: true,
    });
    if (!gl || gl.isContextLost()) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, PLASMA_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, PLASMA_FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    const uniforms: Record<string, WebGLUniformLocation> = {};
    const count = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) {
        const loc = gl.getUniformLocation(prog, info.name);
        if (loc) uniforms[info.name] = loc;
      }
    }

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const syncSize = () => {
      const dpr = getBoundedPixelRatio(wrap, gl);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    syncSize();

    const resizeObs = createCanvasResizeObserver(syncSize);
    resizeObs.observe(wrap);

    let isVisible = true;
    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    io.observe(wrap);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let boost = 0.15;
    let elapsed = 0;
    let lastNow = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!isVisible) {
        lastNow = now;
        return;
      }

      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      if (!prefersReduced) elapsed += dt;

      boost = expDamp(boost, boostTargetRef.current, 6.0, dt);
      const dpr = canvas.width / Math.max(canvas.clientWidth, 1);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(prog);
      gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
      gl.uniform2f(
        uniforms.uRectHalf,
        Math.max(1, wrap.clientWidth * 0.5 * dpr),
        Math.max(1, wrap.clientHeight * 0.5 * dpr)
      );
      gl.uniform1f(uniforms.uCorner, 32 * dpr);
      gl.uniform1f(uniforms.uTime, elapsed);
      gl.uniform1f(uniforms.uBoost, boost);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      resizeObs.disconnect();
      gl.deleteBuffer(quad);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      onPointerEnter={() => {
        boostTargetRef.current = 1.0;
      }}
      onPointerLeave={() => {
        boostTargetRef.current = 0.15;
      }}
      className={`relative ${className}`}
    >
      {/* Cryo-Plasma Aura Canvas overflowing softly outside card perimeter */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute -inset-4 z-0 h-[calc(100%+2rem)] w-[calc(100%+2rem)]"
      />
      <div className="liquid-glass relative z-10 h-full w-full overflow-hidden rounded-[2rem]">
        {children}
      </div>
    </div>
  );
};
