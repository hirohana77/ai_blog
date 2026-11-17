import { useEffect, useRef } from 'react';
import {
  createCanvasResizeObserver,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';

export type AsciifyCharset = 'ascii' | 'blocks' | 'binary';

interface AsciifyBackgroundFieldProps {
  className?: string;
  charset?: AsciifyCharset;
  /** Overall intensity of the ambient Asciify texture (0..1) */
  ambientStrength?: number;
  /** Glyph scale multiplier matching AsciifyVanilla (5x5 bitmask cells) */
  scale?: number;
  /** Inter-glyph gutter spacing in cell units */
  spacing?: number;
  /** Soft phosphor cell halo */
  glow?: number;
  /** Subtle chromatic RGB fringe across topographic waves */
  aberration?: number;
  /** External normalized scroll progress (0..1) for subtle phase drift */
  scrollProgressRef?: React.MutableRefObject<number>;
  /** External scroll velocity for kinetic shimmer */
  scrollVelocityRef?: React.MutableRefObject<number>;
}

const CHARSETS: Record<AsciifyCharset, number[]> = {
  ascii: [
    0, 128, 131200, 14336, 459200, 469440, 4357252, 18157905, 11512810,
    15724526,
  ],
  blocks: [0, 328000, 22041621, 22369621, 11512810, 33554431],
  binary: [0, 4591758, 15324974],
};

const VERT_SRC = `#version 300 es
precision highp float;
const vec2 POS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);
void main() {
  gl_Position = vec4(POS[gl_VertexID], 0.0, 1.0);
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uScroll;
uniform float uVelocity;
uniform float uScale;
uniform float uSpacing;
uniform float uGlow;
uniform float uAberration;
uniform float uAmbient;
uniform int uGlyphCount;
uniform uint uGlyphs[10];

out vec4 fragColor;

uint getGlyph(int idx) {
  if (idx <= 0) return uGlyphs[0];
  if (idx == 1) return uGlyphs[1];
  if (idx == 2) return uGlyphs[2];
  if (idx == 3) return uGlyphs[3];
  if (idx == 4) return uGlyphs[4];
  if (idx == 5) return uGlyphs[5];
  if (idx == 6) return uGlyphs[6];
  if (idx == 7) return uGlyphs[7];
  if (idx == 8) return uGlyphs[8];
  return uGlyphs[9];
}

float glyphBit(int index, ivec2 p) {
  if (p.x < 0 || p.x > 4 || p.y < 0 || p.y > 4) return 0.0;
  uint bits = getGlyph(index);
  return float((bits >> uint((4 - p.x) + 5 * p.y)) & 1u);
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

// Restrained architectural topographic contour & interference flow on obsidian ground
vec3 sampleField(vec2 uv, float t, float scrollPhase, float velBoost) {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  p.y -= scrollPhase * 0.45;

  // Align contour grain subtly to the -1.6deg editorial horizon axis
  float tilt = -0.0279;
  mat2 rot = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt));
  vec2 tp = rot * p;

  float drift = t * 0.16;
  float w1 = sin(tp.x * 4.1 + drift + sin(tp.y * 2.5 - drift * 0.65) * 1.1);
  float w2 = cos(tp.y * 4.8 - drift * 0.75 + cos(tp.x * 2.8 + tp.y * 1.6) * 0.95);
  float ridge = abs(sin((tp.x * 0.72 + tp.y * 0.48) * 5.8 - t * 0.2 + w1 * 0.6));
  float contour = pow(clamp(1.0 - ridge, 0.0, 1.0), 2.3);

  // Broad atmospheric depth swells across horizontal expanse (no central hotspot)
  float swellA = 0.5 + 0.5 * sin(tp.x * 2.2 - tp.y * 1.4 + t * 0.14);
  float swellB = 0.5 + 0.5 * cos(tp.x * 1.6 + tp.y * 2.1 - t * 0.11);

  float energy = clamp(
    0.16 +
    0.26 * (0.5 + 0.5 * w1) * (0.5 + 0.5 * w2) +
    0.34 * contour +
    0.18 * swellA * swellB +
    velBoost * 0.12 * contour,
    0.0,
    1.0
  );

  // Subtle architectural latitude rules
  float fineRule = smoothstep(0.93, 0.995, sin(tp.y * 22.0 + t * 0.32));
  energy = clamp(energy + fineRule * 0.1, 0.0, 1.0);

  vec3 deepIndigo = vec3(0.09, 0.14, 0.30);
  vec3 twilightCobalt = vec3(0.20, 0.34, 0.66);
  vec3 slateIce = vec3(0.36, 0.52, 0.84);

  vec3 col = mix(deepIndigo, twilightCobalt, smoothstep(0.18, 0.68, energy));
  col = mix(col, slateIce, smoothstep(0.62, 0.96, energy));

  return col * (0.42 + 0.72 * energy);
}

vec3 sampleFringe(vec2 uv, float pxAmt, float t, float scrollPhase, float velBoost) {
  if (pxAmt <= 0.001) {
    return sampleField(uv, t, scrollPhase, velBoost);
  }
  vec2 d = uv - 0.5;
  vec2 offset = (length(d) > 1e-4 ? normalize(d) : vec2(1.0, 0.0)) * (pxAmt / max(uRes, vec2(1.0)));
  float r = sampleField(uv + offset, t, scrollPhase, velBoost).r;
  float g = sampleField(uv, t, scrollPhase, velBoost).g;
  float b = sampleField(uv - offset, t, scrollPhase, velBoost).b;
  return vec3(r, g, b);
}

void main() {
  vec2 uv = gl_FragCoord.xy / max(uRes, vec2(1.0));

  float cellPx = (5.0 + uSpacing) * uScale * max(uDpr, 1.0);
  vec2 cellIdx = floor(gl_FragCoord.xy / cellPx);
  vec2 cellCenterPx = (cellIdx + 0.5) * cellPx;
  vec2 cellCenterUv = cellCenterPx / max(uRes, vec2(1.0));
  vec2 cellUV = fract(gl_FragCoord.xy / cellPx);

  float velBoost = clamp(abs(uVelocity) * 0.0008, 0.0, 1.0);
  float fringePx = uAberration * 2.2 * max(uDpr, 1.0);
  vec3 cellColor = sampleFringe(cellCenterUv, fringePx, uTime, uScroll, velBoost);

  float lum = clamp(luma(cellColor) * 1.45, 0.0, 1.0);
  int maxIdx = uGlyphCount - 1;
  int glyphIdx = clamp(int(floor(lum * float(maxIdx) + 0.5)), 0, maxIdx);

  float span = 5.0 + uSpacing;
  ivec2 pixel = ivec2(floor(cellUV * span));
  float bit = glyphBit(glyphIdx, pixel);

  // Crisp uniform dot-matrix ASCII glyphs + gentle phosphor glow (no cursor hotspot)
  float halo = max(0.0, 1.0 - length(cellUV - 0.5) * 2.0) * 0.18 * uGlow;
  vec3 asciiCell = cellColor * (bit + halo * lum);

  // Subtle corner vignette so peripheral boundaries settle organically into #05060a
  vec2 edge = (uv - 0.5) * 2.0;
  float vig = 1.0 - smoothstep(0.68, 1.48, length(edge)) * 0.32;

  vec3 baseObsidian = vec3(0.0196, 0.0235, 0.0392); // #05060a
  vec3 finalRgb = baseObsidian + asciiCell * (uAmbient * 0.58) * vig;

  fragColor = vec4(finalRgb, 1.0);
}
`;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function AsciifyBackgroundField({
  className = '',
  charset = 'ascii',
  ambientStrength = 0.72,
  scale = 2.05,
  spacing = 1.15,
  glow = 0.55,
  aberration = 0.45,
  scrollProgressRef,
  scrollVelocityRef,
}: AsciifyBackgroundFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const vao = gl.createVertexArray();
    const u = {
      res: gl.getUniformLocation(program, 'uRes'),
      dpr: gl.getUniformLocation(program, 'uDpr'),
      time: gl.getUniformLocation(program, 'uTime'),
      scroll: gl.getUniformLocation(program, 'uScroll'),
      velocity: gl.getUniformLocation(program, 'uVelocity'),
      scale: gl.getUniformLocation(program, 'uScale'),
      spacing: gl.getUniformLocation(program, 'uSpacing'),
      glow: gl.getUniformLocation(program, 'uGlow'),
      aberration: gl.getUniformLocation(program, 'uAberration'),
      ambient: gl.getUniformLocation(program, 'uAmbient'),
      glyphCount: gl.getUniformLocation(program, 'uGlyphCount'),
      glyphs: gl.getUniformLocation(program, 'uGlyphs[0]'),
    };

    const rawGlyphs = CHARSETS[charset] ?? CHARSETS.ascii;
    const paddedGlyphs = new Uint32Array(10);
    for (let i = 0; i < Math.min(rawGlyphs.length, 10); i++) {
      paddedGlyphs[i] = rawGlyphs[i];
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let isVisible = true;
    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 1.4;

    const updateSize = () => {
      const rect = host.getBoundingClientRect();
      dpr = getBoundedPixelRatio(host, gl);
      width = Math.max(1, Math.round(rect.width * dpr));
      height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    updateSize();
    const resizeObs = createCanvasResizeObserver(updateSize);
    resizeObs.observe(host);

    const drawFrame = () => {
      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(u.res, width, height);
      gl.uniform1f(u.dpr, dpr);
      gl.uniform1f(u.time, elapsed);
      gl.uniform1f(u.scroll, scrollProgressRef?.current ?? window.scrollY / 2400);
      gl.uniform1f(u.velocity, scrollVelocityRef?.current ?? 0);
      gl.uniform1f(u.scale, scale);
      gl.uniform1f(u.spacing, spacing);
      gl.uniform1f(u.glow, glow);
      gl.uniform1f(u.aberration, aberration);
      gl.uniform1f(u.ambient, ambientStrength);
      gl.uniform1i(u.glyphCount, rawGlyphs.length);
      if (u.glyphs) {
        gl.uniform1uiv(u.glyphs, paddedGlyphs);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    };

    const tick = (now: number) => {
      rafId = 0;
      if (!isVisible || document.hidden) return;
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!reduceMotion) {
        elapsed += dt;
      }

      drawFrame();
      if (!reduceMotion) {
        rafId = requestAnimationFrame(tick);
      }
    };

    const interObs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isVisible = entry.isIntersecting;
        if (isVisible && !document.hidden) {
          lastTime = performance.now();
          if (reduceMotion) {
            drawFrame();
          } else if (!rafId) {
            rafId = requestAnimationFrame(tick);
          }
        } else if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { threshold: 0.01 }
    );
    interObs.observe(host);

    const onVisibilityChange = () => {
      if (!document.hidden && isVisible && !reduceMotion && !rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    drawFrame();
    if (!reduceMotion) {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      interObs.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (vao) gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    };
  }, [
    aberration,
    ambientStrength,
    charset,
    glow,
    scale,
    scrollProgressRef,
    scrollVelocityRef,
    spacing,
  ]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className={`pointer-events-none select-none overflow-hidden bg-[#05060a] ${className}`}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}
