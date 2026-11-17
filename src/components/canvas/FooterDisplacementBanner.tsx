import React, { useEffect, useRef, useState } from 'react';
import {
  createCanvasResizeObserver,
  createRectCache,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';
import { SITE_PROFILE } from '../../data/portfolio';

const DISP_VERT = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const DISP_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uContent;
uniform sampler2D uField;
uniform vec2 uResolution;
uniform float uShift;
uniform float uAberration;
uniform float uGrain;
uniform float uGrainPx;
uniform float uGrainTick;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void main() {
  vec2 cuv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 offset = texture(uField, cuv).rg;
  vec2 push = offset * 0.022 * uShift;
  float ab = uAberration * 0.11;
  vec2 lo = vec2(0.001);
  vec2 hi = vec2(0.999);

  vec4 cr = texture(uContent, clamp(cuv - push * (1.0 + ab), lo, hi));
  vec4 cg = texture(uContent, clamp(cuv - push, lo, hi));
  vec4 cb = texture(uContent, clamp(cuv - push * (1.0 - ab), lo, hi));

  float alpha = (cr.a + cg.a + cb.a) / 3.0;
  vec3 col = vec3(cr.r * cr.a, cg.g * cg.a, cb.b * cb.a);
  col = min(col, vec3(alpha));

  float pushPx = length(push * uResolution);
  float gate = smoothstep(1.2, 16.0, pushPx);
  vec2 cell = floor(gl_FragCoord.xy / max(uGrainPx, 1.0));
  float gn = hash(cell + vec2(uGrainTick * 0.37, uGrainTick * 0.113));
  col += (gn - 0.5) * 0.32 * uGrain * gate * alpha;
  col = clamp(col, vec3(0.0), vec3(alpha));

  outColor = vec4(col, alpha);
}`;

/**
 * Giant architectural footer brand wordmark with WebGL2 grid Displacement,
 * RGB chromatic dispersion, film grain, and automatic idle-sleep (inspired by
 * Antigravity / Trae interactive footer finales & canvas-ui Displacement).
 */
export const FooterDisplacementBanner: React.FC = () => {
  const slotRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallbackMode, setFallbackMode] = useState(false);

  useEffect(() => {
    const slot = slotRef.current;
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!slot || !host || !canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: true,
    });
    if (!gl || gl.isContextLost()) {
      setFallbackMode(true);
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, DISP_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, DISP_FRAG);
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

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const contentTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, contentTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fieldTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionQuery.matches;

    let cols = 58;
    let rows = 14;
    let rowScale = 1;
    let outW = 1;
    let outH = 1;
    let dpr = 1;
    let field = new Float32Array(cols * rows * 2);
    let fieldDirty = true;
    let scrambled = false;

    const paintWordmark = (texW: number, texH: number, cssW: number, cssH: number) => {
      const off = document.createElement('canvas');
      off.width = Math.max(texW, 2);
      off.height = Math.max(texH, 2);
      const ctx = off.getContext('2d');
      if (!ctx) return;

      ctx.scale(texW / Math.max(cssW, 1), texH / Math.max(cssH, 1));
      ctx.clearRect(0, 0, cssW, cssH);

      // Subtle architectural micro-rulers along top horizon edge across full bleed width
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
      ctx.lineWidth = 1;
      for (let x = 16; x < cssW - 16; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 8);
        ctx.lineTo(x, x % 192 === 16 ? 18 : 13);
        ctx.stroke();
      }

      // Measure & fit monumental ExtraBold display wordmark edge-to-edge (97% width, ~78% vertical stature)
      const refSize = 100;
      const canvasCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
      if ('letterSpacing' in canvasCtx) {
        canvasCtx.letterSpacing = '-0.04em';
      }
      ctx.font = `800 ${refSize}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
      const measuredW = Math.max(ctx.measureText(SITE_PROFILE.brand).width, 1);
      const fitFontSize = Math.min((cssH * 0.86) / 0.72, refSize * ((cssW * 0.97) / measuredW));

      ctx.font = `800 ${fitFontSize.toFixed(1)}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const actualW = Math.max(ctx.measureText(SITE_PROFILE.brand).width, 1);
      const horizStretch = (cssW * 0.97) / actualW;
      const naturalCapH = Math.max(fitFontSize * 0.72, 1);
      const vertScale = Math.min(1.34, Math.max(1.0, (cssH * 0.78) / naturalCapH));

      ctx.save();
      ctx.translate(cssW * 0.5, cssH * 0.53);
      ctx.scale(horizStretch, vertScale);

      const grad = ctx.createLinearGradient(-actualW * 0.5, -fitFontSize * 0.4, actualW * 0.5, fitFontSize * 0.4);
      grad.addColorStop(0, 'rgba(248, 250, 252, 0.96)');
      grad.addColorStop(0.42, 'rgba(186, 230, 253, 0.93)');
      grad.addColorStop(0.76, 'rgba(221, 214, 254, 0.9)');
      grad.addColorStop(1, 'rgba(253, 230, 138, 0.88)');

      ctx.fillStyle = grad;
      ctx.fillText(SITE_PROFILE.brand, 0, 0);
      ctx.restore();

      gl.bindTexture(gl.TEXTURE_2D, contentTex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 0);
    };

    const syncGrid = () => {
      cols = outW < 640 ? 34 : 58;
      rows = Math.max(8, Math.min(28, Math.round((cols * outH) / Math.max(outW, 1))));
      rowScale = (outH * cols) / (Math.max(outW, 1) * rows);
      field = new Float32Array(cols * rows * 2);

      if (!scrambled && !reducedMotion) {
        const amp = 22;
        for (let i = 0; i < field.length; i++) {
          field[i] = (Math.random() * 2 - 1) * amp;
        }
      }
      scrambled = true;

      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, cols, rows, 0, gl.RG, gl.FLOAT, field);
      fieldDirty = false;
    };

    const syncSize = () => {
      dpr = getBoundedPixelRatio(host, gl);
      outW = Math.max(1, host.clientWidth);
      outH = Math.max(1, host.clientHeight);
      const texW = Math.max(1, Math.round(outW * dpr));
      const texH = Math.max(1, Math.round(outH * dpr));
      if (canvas.width !== texW || canvas.height !== texH) {
        canvas.width = texW;
        canvas.height = texH;
      }
      paintWordmark(texW, texH, outW, outH);
      syncGrid();
    };
    syncSize();

    const mouse = {
      x: 0.5,
      y: 0.5,
      prevX: 0.5,
      prevY: 0.5,
      vX: 0,
      vY: 0,
      speed: 0,
      gate: 0,
      lastT: 0,
    };
    let tracking = false;
    let time = 0;
    let raf = 0;
    let lastNow = performance.now();
    let running = false;
    let visible = true;
    let destroyed = false;

    const stepSimulation = (delta: number): boolean => {
      const decay = Math.pow(0.9, delta * 60);
      let maxAbs = 0;
      for (let i = 0; i < field.length; i++) {
        const val = field[i] * decay;
        field[i] = val;
        const a = Math.abs(val);
        if (a > maxAbs) maxAbs = a;
      }

      const injecting = tracking && (mouse.vX !== 0 || mouse.vY !== 0);
      if (injecting) {
        const gx = mouse.x * cols;
        const gy = mouse.y * rows;
        const maxDist = cols * 0.14;
        const maxSq = maxDist * maxDist;
        const gain = 26 * mouse.gate;

        for (let j = 0; j < rows; j++) {
          const dy = (gy - j) * rowScale;
          for (let i = 0; i < cols; i++) {
            const dx = gx - i;
            const d2 = dx * dx + dy * dy;
            if (d2 < maxSq) {
              const power = Math.min(maxDist / Math.max(Math.sqrt(d2), 0.3), 7);
              const idx = 2 * (i + cols * j);
              field[idx] += gain * mouse.vX * power;
              field[idx + 1] += gain * mouse.vY * power;
            }
          }
        }
      }

      const vDecay = Math.pow(0.88, delta * 60);
      mouse.vX *= vDecay;
      mouse.vY *= vDecay;
      if (Math.abs(mouse.vX) < 0.0001) mouse.vX = 0;
      if (Math.abs(mouse.vY) < 0.0001) mouse.vY = 0;
      fieldDirty = true;

      const alive = injecting || mouse.vX !== 0 || mouse.vY !== 0 || maxAbs > 0.04;
      if (!alive && maxAbs > 0) field.fill(0);
      return alive;
    };

    const render = () => {
      if (fieldDirty) {
        fieldDirty = false;
        gl.bindTexture(gl.TEXTURE_2D, fieldTex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RG, gl.FLOAT, field);
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(prog);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, contentTex);
      gl.uniform1i(uniforms.uContent, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fieldTex);
      gl.uniform1i(uniforms.uField, 1);
      gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.uShift, 1.35);
      gl.uniform1f(uniforms.uAberration, 1.85);
      gl.uniform1f(uniforms.uGrain, 0.28);
      gl.uniform1f(uniforms.uGrainPx, Math.max(1, dpr * 1.5));
      gl.uniform1f(uniforms.uGrainTick, Math.floor(time * 20));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const frame = (now: number) => {
      if (destroyed) return;
      if (!visible) {
        running = false;
        return;
      }
      const delta = Math.min((now - lastNow) / 1000, 1 / 30);
      lastNow = now;
      time += delta;

      let alive = false;
      if (!reducedMotion) alive = stepSimulation(delta);
      render();

      if (!alive) {
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const wake = () => {
      if (destroyed || running || !visible) return;
      running = true;
      lastNow = performance.now();
      raf = requestAnimationFrame(frame);
    };

    wake();

    const rectCache = createRectCache(host);

    const syncCurtain = () => {
      if (reducedMotion) {
        host.style.transform = 'translate3d(0, 0, 0)';
        rectCache.refresh();
        return;
      }
      const rect = slot.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const h = rect.height;
      const revealed = Math.min(h, Math.max(0, vh - rect.top));
      const hiddenTop = Math.max(0, h - revealed);
      host.style.transform = `translate3d(0, -${hiddenTop.toFixed(2)}px, 0)`;
      rectCache.refresh();
    };
    syncCurtain();

    const onPointerMove = (e: PointerEvent) => {
      if (reducedMotion) return;
      const box = rectCache.current;
      if (box.width < 1 || box.height < 1) return;
      const x = (e.clientX - box.left) / box.width;
      const y = (e.clientY - box.top) / box.height;
      const now = performance.now();

      if (!tracking) {
        tracking = true;
        mouse.prevX = x;
        mouse.prevY = y;
        mouse.speed = 0;
        mouse.gate = 0;
        mouse.lastT = now;
      }

      mouse.vX = x - mouse.prevX;
      mouse.vY = y - mouse.prevY;
      const dt = Math.max((now - mouse.lastT) / 1000, 0.001);
      mouse.lastT = now;

      const distPx = Math.hypot(mouse.vX * box.width, mouse.vY * box.height);
      const instSpeed = distPx / dt;
      mouse.speed += (instSpeed - mouse.speed) * Math.min(dt * 25, 1);

      // Gentle threshold so normal mouse sweeps feel fluid and responsive
      const threshold = 90;
      const ramp = (mouse.speed - threshold) / (threshold * 2);
      const s = Math.min(Math.max(ramp, 0.25), 1);
      mouse.gate = s * s * (3 - 2 * s);

      mouse.prevX = x;
      mouse.prevY = y;
      mouse.x = x;
      mouse.y = y;
      wake();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (reducedMotion) return;
      const box = rectCache.current;
      const cx = ((e.clientX - box.left) / Math.max(box.width, 1)) * cols;
      const cy = ((e.clientY - box.top) / Math.max(box.height, 1)) * rows;
      const radius = cols * 0.22;

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const dx = i - cx;
          const dy = (j - cy) * rowScale;
          const d = Math.hypot(dx, dy);
          if (d < radius && d > 0.01) {
            const force = (1 - d / radius) * 18;
            const idx = 2 * (i + cols * j);
            field[idx] += (dx / d) * force;
            field[idx + 1] += (dy / d) * force;
          }
        }
      }
      fieldDirty = true;
      wake();
    };

    const onPointerLeave = () => {
      tracking = false;
      mouse.vX = 0;
      mouse.vY = 0;
      mouse.speed = 0;
      mouse.gate = 0;
    };

    const onPointerEnter = () => {
      syncCurtain();
    };

    host.addEventListener('pointerenter', onPointerEnter, { passive: true });
    host.addEventListener('pointermove', onPointerMove, { passive: true });
    host.addEventListener('pointerdown', onPointerDown, { passive: true });
    host.addEventListener('pointerleave', onPointerLeave, { passive: true });
    window.addEventListener('scroll', syncCurtain, { passive: true });
    window.addEventListener('resize', syncCurtain, { passive: true });

    let fontsCancelled = false;
    document.fonts?.ready.then(() => {
      if (destroyed || fontsCancelled) return;
      syncSize();
      syncCurtain();
      wake();
    });

    const ro = createCanvasResizeObserver(() => {
      syncSize();
      syncCurtain();
      wake();
    });
    ro.observe(slot);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) {
        syncCurtain();
        render();
        wake();
      }
    });
    io.observe(slot);

    const onMotionChange = () => {
      reducedMotion = motionQuery.matches;
      if (reducedMotion) {
        field.fill(0);
        fieldDirty = true;
      }
      syncCurtain();
      wake();
    };
    motionQuery.addEventListener('change', onMotionChange);

    return () => {
      destroyed = true;
      fontsCancelled = true;
      cancelAnimationFrame(raf);
      rectCache.destroy();
      ro.disconnect();
      io.disconnect();
      motionQuery.removeEventListener('change', onMotionChange);
      window.removeEventListener('scroll', syncCurtain);
      window.removeEventListener('resize', syncCurtain);
      host.removeEventListener('pointerenter', onPointerEnter);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointerleave', onPointerLeave);
      gl.deleteTexture(contentTex);
      gl.deleteTexture(fieldTex);
      if (quad) gl.deleteBuffer(quad);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div
      ref={slotRef}
      className="relative h-[24vw] min-h-[168px] max-h-[380px] w-full overflow-hidden border-t border-white/[0.06] bg-[#05060a]"
    >
      {/* Hairline basalt edge highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-white/[0.1] to-transparent"
      />
      <div
        ref={hostRef}
        data-cursor="WARP"
        className="relative h-full w-full cursor-crosshair select-none will-change-transform bg-[radial-gradient(ellipse_75%_80%_at_50%_100%,rgba(148,163,184,0.035),transparent_72%)]"
      >
        {fallbackMode ? (
          <div className="text-liquid-pearl flex h-full w-full items-center justify-center px-2 text-[17vw] font-extrabold leading-none tracking-[-0.04em]">
            {SITE_PROFILE.brand}
          </div>
        ) : (
          <canvas ref={canvasRef} className="block h-full w-full" />
        )}
      </div>
    </div>
  );
};
