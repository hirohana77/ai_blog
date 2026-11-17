import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Eye } from 'lucide-react';
import {
  createCanvasResizeObserver,
  createRectCache,
  expDamp,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';
import { MagneticButton } from '../MagneticButton';
import { PageRoute, ProjectItem } from '../../data/portfolio';

const PEEL_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;

uniform vec2 uRes;
uniform float uPeel;
uniform float uReveal;
uniform float uCurl;
uniform float uBow;
uniform float uFocal;
uniform float uBulge;
uniform vec2 uPointer;

out vec2 vUv;
out float vShade;
out vec2 vSide;

const float PI = 3.14159265;

void main() {
  vUv = aGrid;
  vec2 p = aGrid * uRes;
  float u = uRes.x - p.x;
  float v = p.y;
  float crossLen = uRes.y;

  float A = clamp(uPeel, 0.0, 1.0);
  float f = A * uReveal;
  float R = max(uCurl * (0.35 + 0.65 * A), 0.001);
  float c0 = f + R;

  float dvB = (uPointer.y - v) / max(crossLen * 0.32, 1.0);
  float prox = clamp(1.0 - uPointer.x / max(c0 + 180.0, 1.0), 0.0, 1.0);
  float c = c0 + uBulge * A * prox * prox * exp(-dvB * dvB);

  float x = u;
  float z = 0.0;
  float sh = 0.0;

  if (A > 0.001 && u < c) {
    float theta = (c - u) / R;
    if (theta <= PI) {
      x = c - R * sin(theta);
      z = R * (1.0 - cos(theta));
    } else {
      x = c + (theta - PI) * R;
      z = 2.0 * R;
    }
    sh = sin(clamp(theta, 0.0, PI));
  }

  z += uBow * A * sin(PI * v / max(crossLen, 1.0)) * clamp(z / max(R, 1.0), 0.0, 1.4);
  z = clamp(z, -uFocal * 0.2, uFocal * 0.45);
  vShade = sh * smoothstep(0.0, 0.08, A);
  vSide = vec2(u, v);

  vec2 q = vec2(uRes.x - x, v);
  vec2 ndc = (q / uRes) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  float w = (uFocal - z) / uFocal;
  gl_Position = vec4(ndc, -z / uFocal, w);
}`;

const PEEL_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in float vShade;
in vec2 vSide;
out vec4 outColor;

uniform sampler2D uCoverTex;
uniform float uCross;
uniform float uSpan;
uniform vec2 uPointer;

void main() {
  vec4 tex = texture(uCoverTex, clamp(vUv, 0.002, 0.998));
  float shade = 1.0 - 0.58 * pow(max(vShade, 0.0), 1.25);

  float du = max(vSide.x, 0.0);
  float line = exp(-du / 3.0) + exp(-du / 22.0) * 0.32;
  float dv = (vSide.y - uPointer.y) / max(uCross * 0.45, 1.0);
  float prox = clamp(1.0 - uPointer.x / max(uSpan, 1.0), 0.0, 1.0);
  float shine = 0.85 * line * exp(-dv * dv) * (0.35 + 0.65 * prox);

  vec3 shineCol = vec3(0.62, 0.88, 1.0);
  vec3 rgb = mix(tex.rgb * shade, shineCol, clamp(shine, 0.0, 0.85));
  outColor = vec4(rgb * tex.a, tex.a);
}`;

interface LiquidPeelCardProps {
  project: ProjectItem;
  onNavigate: (route: PageRoute, slug?: string) => void;
}

/**
 * Integrated Flagship Project Cover Peel:
 * Sweeping inward from the right edge physically curls back the project's visual
 * cover in 3D cylindrical curvature to reveal live engineering architecture notes
 * and performance telemetry underneath.
 */
export const LiquidPeelCard: React.FC<LiquidPeelCardProps> = ({ project, onNavigate }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pinnedOpen, setPinnedOpen] = useState(false);
  const pinnedRef = useRef(false);
  pinnedRef.current = pinnedOpen;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      depth: true,
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

    const vs = compile(gl.VERTEX_SHADER, PEEL_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, PEEL_FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    const uniforms: Record<string, WebGLUniformLocation> = {};
    const uCount = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < uCount; i++) {
      const info = gl.getActiveUniform(prog, i);
      if (info) {
        const loc = gl.getUniformLocation(prog, info.name);
        if (loc) uniforms[info.name] = loc;
      }
    }

    const SEG_X = 64;
    const SEG_Y = 16;
    const verts: number[] = [];
    const indices: number[] = [];

    for (let iy = 0; iy <= SEG_Y; iy++) {
      for (let ix = 0; ix <= SEG_X; ix++) {
        verts.push(ix / SEG_X, iy / SEG_Y);
      }
    }
    for (let iy = 0; iy < SEG_Y; iy++) {
      for (let ix = 0; ix < SEG_X; ix++) {
        const a = iy * (SEG_X + 1) + ix;
        const b = a + 1;
        const c = a + (SEG_X + 1);
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    const coverTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, coverTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const drawProjectCover = (w: number, h: number) => {
      const off = document.createElement('canvas');
      off.width = Math.max(w, 2);
      off.height = Math.max(h, 2);
      const c = off.getContext('2d');
      if (!c) return;

      const dprScale = w / Math.max(host.clientWidth, 1);
      c.scale(dprScale, dprScale);
      const cw = host.clientWidth || 600;
      const ch = host.clientHeight || 340;

      const bg = c.createLinearGradient(0, 0, cw, ch);
      bg.addColorStop(0, '#0a1020');
      bg.addColorStop(0.55, '#070b16');
      bg.addColorStop(1, '#11162e');
      c.fillStyle = bg;
      c.fillRect(0, 0, cw, ch);

      const g1 = c.createRadialGradient(cw * 0.62, ch * 0.48, 10, cw * 0.62, ch * 0.48, cw * 0.48);
      g1.addColorStop(0, `${project.accentFrom}44`);
      g1.addColorStop(0.55, `${project.accentTo}22`);
      g1.addColorStop(1, 'rgba(5, 6, 10, 0)');
      c.fillStyle = g1;
      c.fillRect(0, 0, cw, ch);

      // Organic optical prism contour emblem representing the project
      const cx = cw * 0.56;
      const cy = ch * 0.5;
      const baseR = Math.min(cw, ch) * 0.28;
      for (let layer = 0; layer < 4; layer++) {
        c.save();
        c.translate(cx, cy);
        c.rotate(layer * 0.48);
        c.beginPath();
        const steps = 80;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2;
          const rad = baseR * (0.72 + layer * 0.13) + Math.sin(a * 3 + layer) * 8;
          const x = Math.cos(a) * rad;
          const y = Math.sin(a) * rad * 0.85;
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
        c.closePath();
        c.fillStyle = 'rgba(186, 230, 253, 0.06)';
        c.fill();
        c.lineWidth = 1.25;
        c.strokeStyle = layer === 3 ? 'rgba(255,255,255,0.48)' : `${project.accentFrom}66`;
        c.stroke();
        c.restore();
      }

      // Authentic project cover badge
      c.fillStyle = '#bae6fd';
      c.font = '500 11px "JetBrains Mono", monospace';
      c.fillText(`${project.index} · ${project.category.toUpperCase()} · ${project.year}`, 26, 36);

      c.fillStyle = '#f8fafc';
      c.font = '600 22px "Plus Jakarta Sans", "Noto Sans SC", sans-serif';
      c.fillText(project.title, 26, ch - 46);

      c.fillStyle = '#94a3b8';
      c.font = '400 12px "JetBrains Mono", monospace';
      c.fillText('← 轻滑右侧封面掀开查看架构底稿', Math.max(26, cw - 245), ch - 24);

      c.fillStyle = 'rgba(125, 211, 252, 0.2)';
      c.fillRect(cw - 3, 0, 3, ch);

      gl.bindTexture(gl.TEXTURE_2D, coverTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    };

    const syncSize = () => {
      const dpr = getBoundedPixelRatio(host, gl);
      const w = Math.max(1, Math.round(host.clientWidth * dpr));
      const h = Math.max(1, Math.round(host.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      drawProjectCover(w, h);
    };
    syncSize();

    const resizeObs = createCanvasResizeObserver(syncSize);
    resizeObs.observe(host);

    const rectCache = createRectCache(host);
    let peelTarget = 0.06;
    let peel = 0.06;
    let pointerU = 30;
    let pointerV = host.clientHeight * 0.5;
    let isVisible = true;

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    io.observe(host);

    const onMove = (e: PointerEvent) => {
      const r = rectCache.current;
      const lx = e.clientX - r.left;
      const ly = e.clientY - r.top;
      pointerU = Math.max(0, r.width - lx);
      pointerV = ly;

      if (!pinnedRef.current) {
        const frac = Math.min(1, Math.max(0.06, (r.width - lx) / Math.max(r.width * 0.65, 1)));
        peelTarget = frac * 0.94;
      }
    };

    const onLeave = () => {
      if (!pinnedRef.current) {
        peelTarget = 0.06;
      }
    };

    host.addEventListener('pointermove', onMove, { passive: true });
    host.addEventListener('pointerleave', onLeave, { passive: true });

    let raf = 0;
    let lastNow = performance.now();

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (!isVisible) {
        lastNow = now;
        return;
      }

      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;

      const desired = pinnedRef.current ? 0.94 : peelTarget;
      peel = expDamp(peel, desired, 6.5, dt);

      const dpr = canvas.width / Math.max(host.clientWidth, 1);
      const cw = Math.max(host.clientWidth, 1);
      const ch = Math.max(host.clientHeight, 1);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, coverTex);
      gl.uniform1i(uniforms.uCoverTex, 0);
      gl.uniform2f(uniforms.uRes, cw * dpr, ch * dpr);
      gl.uniform1f(uniforms.uPeel, peel);
      gl.uniform1f(uniforms.uReveal, cw * 0.68 * dpr);
      gl.uniform1f(uniforms.uCurl, 130 * dpr);
      gl.uniform1f(uniforms.uBow, 38 * dpr);
      gl.uniform1f(uniforms.uFocal, 1600 * dpr);
      gl.uniform1f(uniforms.uBulge, 32 * dpr);
      gl.uniform2f(uniforms.uPointer, pointerU * dpr, pointerV * dpr);
      gl.uniform1f(uniforms.uCross, ch * dpr);
      gl.uniform1f(uniforms.uSpan, cw * dpr);

      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      rectCache.destroy();
      resizeObs.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      gl.deleteTexture(coverTex);
      gl.deleteBuffer(vbo);
      gl.deleteBuffer(ebo);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [project.accentFrom, project.accentTo, project.category, project.index, project.title, project.year]);

  return (
    <div
      ref={hostRef}
      data-cursor="PEEL"
      className="relative h-64 overflow-hidden rounded-2xl border border-white/10 bg-[#060a14] sm:h-80"
    >
      {/* Revealed Architectural Blueprint Underneath */}
      <div className="relative z-0 flex h-full flex-col justify-between bg-[radial-gradient(circle_at_70%_28%,rgba(56,189,248,0.16),transparent_60%),#060913] p-5 sm:p-6">
        <div>
          <div className="font-mono-tech text-[10px] tracking-[0.2em] text-sky-300">
            ARCHITECTURE NOTE // {project.client.toUpperCase()}
          </div>
          <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-slate-200">
            {project.architecture}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3.5">
          <div className="flex gap-4 font-mono-tech text-xs">
            {project.metrics.slice(0, 2).map((m) => (
              <div key={m.label}>
                <div className="text-[10px] text-slate-400">{m.label}</div>
                <div className="font-semibold text-white">{m.value}</div>
              </div>
            ))}
          </div>

          <MagneticButton
            variant="primary"
            cursorLabel="VIEW"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('project', project.slug);
            }}
            className="px-3.5 py-1.5 text-xs"
          >
            <span>进入解析</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </MagneticButton>
        </div>
      </div>

      {/* 3D Cylindrical Peel Project Cover */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />

      {/* Subtle corner toggle for touch / keyboard access */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPinnedOpen((v) => !v);
        }}
        className="liquid-glass-pill absolute left-3 top-3 z-20 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 font-mono-tech text-[10px] text-white transition hover:border-white/35"
      >
        <Eye className="h-3 w-3 text-sky-300" />
        <span>{pinnedOpen ? '合上封面' : '掀看架构'}</span>
      </button>
    </div>
  );
};
