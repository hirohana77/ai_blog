import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  createCanvasResizeObserver,
  createRectCache,
  expDamp,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';

gsap.registerPlugin(ScrollTrigger);

interface ParticleNode {
  hx: number;
  hy: number;
  hz: number;
  sx: number;
  sy: number;
  sz: number;
  dx: number;
  dy: number;
  dz: number;
  seedA: number;
  seedB: number;
  size: number;
  isAccent: boolean;
}

interface AmbientMote {
  x: number;
  y: number;
  z: number;
  r: number;
  alpha: number;
  phase: number;
  speed: number;
  isAccent: boolean;
}

interface OrbitRingSpec {
  rx: number;
  ry: number;
  tiltZ: number;
  pitchBias: number;
  yawBias: number;
  colorBack: string;
  colorFront: string;
  lineWidth: number;
}

/**
 * Full-bleed naked-eye 3D scroll-driven particle typography manifesto:
 * - True 3D perspective projection P(x, y, z) -> screen coordinates & scale
 * - Interactive 3D parallax tilting + idle sculptural depth bias
 * - Multi-slice glass thickness extrusion & front/back 3D orbital light rings
 * - Extended scroll trajectory (top 95% -> top 30%) so users clearly watch
 *   volumetric 3D stardust condense into giant foreground typography.
 */
export const ParticleScrollManifesto: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetAssemblyRef = useRef(0);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      targetAssemblyRef.current = 1;
    }

    let width = 1;
    let height = 1;
    let dpr = 1;
    let particles: ParticleNode[] = [];
    let ambientMotes: AmbientMote[] = [];
    let hitGrid = new Uint8Array(0);
    let hitW = 1;
    let hitH = 1;

    const faceLayer = document.createElement('canvas');
    const extrudeLayer = document.createElement('canvas');

    const drawTypography = (
      targetCtx: CanvasRenderingContext2D,
      w: number,
      h: number,
      mode: 'face' | 'extrude'
    ) => {
      const isCompact = w < 640;
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';

      const refSize = 100;
      const canvasCtx = targetCtx as CanvasRenderingContext2D & { letterSpacing?: string };
      if ('letterSpacing' in canvasCtx) {
        canvasCtx.letterSpacing = '-0.03em';
      }

      if (isCompact) {
        targetCtx.font = `800 ${refSize}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
        const wSample = Math.max(targetCtx.measureText('Fluid Light.').width, 1);
        const mainSize = Math.min(h * 0.22, refSize * ((w * 0.86) / wSample));

        if (mode === 'face') {
          const grad = targetCtx.createLinearGradient(w * 0.12, h * 0.2, w * 0.88, h * 0.6);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.55, '#e0f2fe');
          grad.addColorStop(1, '#ede9fe');
          targetCtx.fillStyle = grad;
        } else {
          targetCtx.fillStyle = 'rgba(56, 189, 248, 0.34)';
        }

        targetCtx.font = `800 ${mainSize.toFixed(1)}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
        targetCtx.fillText('Design is', w * 0.5, h * 0.34);
        targetCtx.fillText('Fluid Light.', w * 0.5, h * 0.53);

        const subSize = Math.max(14, Math.min(18, w * 0.041));
        targetCtx.fillStyle = mode === 'face' ? '#bae6fd' : 'rgba(139, 92, 246, 0.28)';
        targetCtx.font = `400 ${subSize.toFixed(1)}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
        targetCtx.fillText('光学不是装饰，而是构建交互秩序的媒介语言', w * 0.5, h * 0.74);
        return;
      }

      targetCtx.font = `800 ${refSize}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
      const measuredW = Math.max(targetCtx.measureText('Design is Fluid Light.').width, 1);
      const mainSize = Math.min(h * 0.4, refSize * ((w * 0.84) / measuredW));

      if (mode === 'face') {
        const grad = targetCtx.createLinearGradient(w * 0.08, h * 0.25, w * 0.92, h * 0.58);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#e0f2fe');
        grad.addColorStop(0.82, '#ddd6fe');
        grad.addColorStop(1, '#fef3c7');
        targetCtx.fillStyle = grad;
      } else {
        targetCtx.fillStyle = 'rgba(56, 189, 248, 0.32)';
      }

      targetCtx.font = `800 ${mainSize.toFixed(1)}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
      targetCtx.fillText('Design is Fluid Light.', w * 0.5, h * 0.42);

      const subSize = Math.max(16, Math.min(26, w * 0.0165));
      targetCtx.fillStyle = mode === 'face' ? '#93c5fd' : 'rgba(139, 92, 246, 0.26)';
      targetCtx.font = `400 ${subSize.toFixed(1)}px "Plus Jakarta Sans", "Noto Sans SC", sans-serif`;
      targetCtx.fillText('光学不是装饰，而是构建交互秩序的媒介语言', w * 0.5, h * 0.7);
    };

    const buildParticles = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(rect.width, 300);
      height = Math.max(rect.height, 260);
      dpr = getBoundedPixelRatio(canvas);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      // Prepare crisp cached retina typography layers for perspective 3D warping
      faceLayer.width = canvas.width;
      faceLayer.height = canvas.height;
      const fCtx = faceLayer.getContext('2d');
      if (fCtx) {
        fCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        fCtx.clearRect(0, 0, width, height);
        drawTypography(fCtx, width, height, 'face');
      }

      extrudeLayer.width = canvas.width;
      extrudeLayer.height = canvas.height;
      const eCtx = extrudeLayer.getContext('2d');
      if (eCtx) {
        eCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        eCtx.clearRect(0, 0, width, height);
        drawTypography(eCtx, width, height, 'extrude');
      }

      // Sample 1x offscreen bitmap for high-density 3D particle nodes
      const sample = document.createElement('canvas');
      sample.width = Math.round(width);
      sample.height = Math.round(height);
      const sCtx = sample.getContext('2d');
      if (!sCtx) return;
      sCtx.clearRect(0, 0, sample.width, sample.height);
      drawTypography(sCtx, width, height, 'face');

      const img = sCtx.getImageData(0, 0, sample.width, sample.height).data;
      const step = width < 640 ? 4 : 5;
      const next: ParticleNode[] = [];

      for (let y = 0; y < sample.height; y += step) {
        for (let x = 0; x < sample.width; x += step) {
          const idx = (y * sample.width + x) * 4;
          const alpha = img[idx + 3];
          if (alpha > 80) {
            const h1 = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            const s1 = h1 - Math.floor(h1);
            const h2 = Math.sin(x * 39.346 + y * 11.135) * 24634.6345;
            const s2 = h2 - Math.floor(h2);

            const angle = s1 * Math.PI * 2;
            const spread = 110 + Math.pow(s2, 1.35) * 280;
            const sx = x + Math.cos(angle) * spread;
            const sy = y + Math.sin(angle) * spread * 0.55 + 55 * (s2 - 0.3);
            // Scatter particles in volumetric 3D depth (deep background -680 .. foreground +290)
            const sz = (s2 < 0.72 ? -1 : 1) * (120 + Math.pow(s1, 1.2) * (s2 < 0.72 ? 560 : 210));
            const hz = (s2 - 0.5) * 18;

            next.push({
              hx: x,
              hy: y,
              hz,
              sx,
              sy,
              sz,
              dx: 0,
              dy: 0,
              dz: 0,
              seedA: s1,
              seedB: s2,
              size: 1.55 + s1 * 1.35,
              isAccent: y > height * 0.59 || img[idx] < 225,
            });
          }
        }
      }
      particles = next;

      // Precompute a tight 2px-quantized glyph hit mask (~14px halo around actual letterforms)
      // so hovering empty dark corners never triggers particle dispersion.
      hitW = Math.max(1, Math.ceil(sample.width / 2));
      hitH = Math.max(1, Math.ceil(sample.height / 2));
      const rawHit = new Uint8Array(hitW * hitH);
      for (let gy = 0; gy < hitH; gy++) {
        const syPx = Math.min(sample.height - 1, gy * 2);
        for (let gx = 0; gx < hitW; gx++) {
          const sxPx = Math.min(sample.width - 1, gx * 2);
          if (img[(syPx * sample.width + sxPx) * 4 + 3] > 35) {
            rawHit[gy * hitW + gx] = 1;
          }
        }
      }
      const haloX = new Uint8Array(hitW * hitH);
      const radiusCells = 7; // 14px exact typography proximity halo
      for (let gy = 0; gy < hitH; gy++) {
        const rowOff = gy * hitW;
        for (let gx = 0; gx < hitW; gx++) {
          if (rawHit[rowOff + gx]) {
            const x0 = Math.max(0, gx - radiusCells);
            const x1 = Math.min(hitW - 1, gx + radiusCells);
            for (let kx = x0; kx <= x1; kx++) haloX[rowOff + kx] = 1;
          }
        }
      }
      const dilated = new Uint8Array(hitW * hitH);
      for (let gy = 0; gy < hitH; gy++) {
        const y0 = Math.max(0, gy - radiusCells);
        const y1 = Math.min(hitH - 1, gy + radiusCells);
        const outOff = gy * hitW;
        for (let ky = y0; ky <= y1; ky++) {
          const inOff = ky * hitW;
          for (let gx = 0; gx < hitW; gx++) {
            if (haloX[inOff + gx]) dilated[outOff + gx] = 1;
          }
        }
      }
      hitGrid = dilated;

      // Build persistent 3D background + foreground depth-cued motes for naked-eye parallax
      const motes: AmbientMote[] = [];
      const count = width < 640 ? 52 : 96;
      for (let i = 0; i < count; i++) {
        const a = Math.sin(i * 91.73 + 1.3) * 43758.5453;
        const r1 = a - Math.floor(a);
        const b = Math.sin(i * 27.19 + 4.7) * 24634.6345;
        const r2 = b - Math.floor(b);
        const c = Math.sin(i * 53.11 + 8.1) * 19531.213;
        const r3 = c - Math.floor(c);
        const isFg = i % 3 === 0;
        motes.push({
          x: r1 * width,
          y: r2 * height,
          z: isFg ? 90 + r3 * 210 : -(90 + r3 * 260),
          r: isFg ? 1.8 + r1 * 2.2 : 1.0 + r1 * 1.1,
          alpha: isFg ? 0.35 + r2 * 0.4 : 0.2 + r2 * 0.25,
          phase: r3 * Math.PI * 2,
          speed: 0.35 + r1 * 0.6,
          isAccent: i % 2 === 0,
        });
      }
      ambientMotes = motes;
    };

    buildParticles();

    const resizeObs = createCanvasResizeObserver(buildParticles);
    resizeObs.observe(canvas);

    let isVisible = true;
    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.02 }
    );
    io.observe(section);

    const rectCache = createRectCache(canvas);
    const pointer = { x: -9999, y: -9999, normX: 0, normY: 0, active: false };

    const onMove = (e: PointerEvent) => {
      const r = rectCache.current;
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.normX = Math.max(-1, Math.min(1, (pointer.x / Math.max(r.width, 1) - 0.5) * 2));
      pointer.normY = Math.max(-1, Math.min(1, (pointer.y / Math.max(r.height, 1) - 0.5) * 2));
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
      pointer.normX = 0;
      pointer.normY = 0;
    };

    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerleave', onLeave, { passive: true });

    let st: ScrollTrigger | null = null;
    if (!prefersReduced) {
      st = ScrollTrigger.create({
        trigger: section,
        start: 'top 96%',
        end: 'top 40%',
        scrub: true,
        onUpdate: (self) => {
          targetAssemblyRef.current = self.progress;
        },
      });
    }

    let smoothAssembly = prefersReduced ? 1 : 0;
    let smoothHoverScatter = 0;
    let smoothYaw = 0.14;
    let smoothPitch = -0.06;
    let lastNow = performance.now();
    let elapsed = 0;
    let raf = 0;

    const FOV = 740;
    const isPointerOnText = (
      px: number,
      py: number,
      cx: number,
      cy: number,
      cosY: number,
      sinY: number,
      cosP: number,
      sinP: number
    ): boolean => {
      if (!hitGrid.length) return false;
      const u = px - cx;
      const v = py - cy;
      const a11 = FOV * cosY - u * sinY * cosP;
      const a12 = u * sinP;
      const a21 = FOV * sinY * sinP - v * sinY * cosP;
      const a22 = FOV * cosP + v * sinP;
      const det = a11 * a22 - a12 * a21;
      if (Math.abs(det) < 1e-3) return false;
      const rx = (u * FOV * a22 - v * FOV * a12) / det;
      const ry = (a11 * v * FOV - a21 * u * FOV) / det;
      const gx = Math.round((cx + rx) / 2);
      const gy = Math.round((cy + ry) / 2);
      if (gx < 0 || gy < 0 || gx >= hitW || gy >= hitH) return false;
      return hitGrid[gy * hitW + gx] === 1;
    };
    const project3D = (
      x: number,
      y: number,
      z: number,
      cx: number,
      cy: number,
      cosY: number,
      sinY: number,
      cosP: number,
      sinP: number
    ) => {
      const rx = x - cx;
      const ry = y - cy;
      const x1 = rx * cosY + z * sinY;
      const z1 = -rx * sinY + z * cosY;
      const y2 = ry * cosP - z1 * sinP;
      const z2 = ry * sinP + z1 * cosP;
      const persp = FOV / Math.max(FOV - z2, 130);
      return {
        x: cx + x1 * persp,
        y: cy + y2 * persp,
        z: z2,
        persp,
      };
    };

    // Draw perspective-warped offscreen typography strip-by-strip so 3D rotation & taper match particles 1:1
    const drawWarpedLayer = (
      srcCanvas: HTMLCanvasElement,
      zPlane: number,
      alpha: number,
      cx: number,
      cy: number,
      cosY: number,
      sinY: number,
      cosP: number,
      sinP: number
    ) => {
      if (alpha <= 0.01) return;
      const slices = 32;
      const sliceCssW = width / slices;
      const srcSliceW = srcCanvas.width / slices;
      const srcH = srcCanvas.height;

      ctx.save();
      ctx.globalAlpha = alpha;
      for (let i = 0; i < slices; i++) {
        const xLeft = i * sliceCssW;
        const xMid = xLeft + sliceCssW * 0.5;
        const pTop = project3D(xMid, 0, zPlane, cx, cy, cosY, sinY, cosP, sinP);
        const pBot = project3D(xMid, height, zPlane, cx, cy, cosY, sinY, cosP, sinP);
        const pL = project3D(xLeft, cy, zPlane, cx, cy, cosY, sinY, cosP, sinP);
        const pR = project3D(xLeft + sliceCssW, cy, zPlane, cx, cy, cosY, sinY, cosP, sinP);
        const destW = Math.max(0.8, pR.x - pL.x + 0.65);
        const destH = Math.max(1, pBot.y - pTop.y);
        const sx = i * srcSliceW;
        const sw = Math.max(0.5, Math.min(srcSliceW + 0.5, srcCanvas.width - sx));

        ctx.drawImage(
          srcCanvas,
          sx,
          0,
          sw,
          srcH,
          pL.x,
          pTop.y,
          destW,
          destH
        );
      }
      ctx.restore();
    };

    const drawRingHalf = (
      ring: OrbitRingSpec,
      half: 'back' | 'front',
      cx: number,
      cy: number,
      cosY: number,
      sinY: number,
      cosP: number,
      sinP: number,
      scrollBoost: number
    ) => {
      const segs = 96;
      const cosT = Math.cos(ring.tiltZ);
      const sinT = Math.sin(ring.tiltZ);

      ctx.save();
      ctx.lineWidth = ring.lineWidth;
      ctx.strokeStyle = half === 'back' ? ring.colorBack : ring.colorFront;
      if (half === 'front') {
        ctx.shadowColor = ring.colorFront;
        ctx.shadowBlur = 14;
      }

      let drawing = false;
      ctx.beginPath();
      for (let s = 0; s <= segs; s++) {
        const th = (s / segs) * Math.PI * 2;
        const lx = Math.cos(th) * ring.rx;
        const lzRaw = Math.sin(th) * ring.rx;
        const lyRaw = Math.sin(th) * ring.ry * ring.pitchBias;

        const x3d = cx + lx * cosT - lyRaw * sinT;
        const y3d = cy + lx * sinT + lyRaw * cosT;
        const z3d = lzRaw * 0.72 * ring.yawBias;

        const pt = project3D(x3d, y3d, z3d, cx, cy, cosY, sinY, cosP, sinP);
        const isFront = pt.z >= 0;
        const want = half === 'front' ? isFront : !isFront;

        if (want) {
          if (!drawing) {
            ctx.moveTo(pt.x, pt.y);
            drawing = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        } else if (drawing) {
          drawing = false;
        }
      }
      ctx.globalAlpha = half === 'back' ? 0.55 + scrollBoost * 0.35 : 0.65 + scrollBoost * 0.35;
      ctx.stroke();
      ctx.restore();
    };

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      if (!isVisible) {
        lastNow = now;
        return;
      }

      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      elapsed += dt;

      const target = targetAssemblyRef.current;
      smoothAssembly = prefersReduced ? 1 : expDamp(smoothAssembly, target, 13.0, dt);

      // Interactive 3D parallax camera yaw & pitch + subtle living idle sweep
      const targetYaw = prefersReduced
        ? 0.08
        : (pointer.active ? pointer.normX * 0.24 : 0.13 + Math.sin(elapsed * 0.55) * 0.07);
      const targetPitch = prefersReduced
        ? -0.04
        : (pointer.active ? -pointer.normY * 0.14 : -0.06 + Math.cos(elapsed * 0.42) * 0.04);

      smoothYaw = expDamp(smoothYaw, targetYaw, 6.5, dt);
      smoothPitch = expDamp(smoothPitch, targetPitch, 6.5, dt);

      const cosY = Math.cos(smoothYaw);
      const sinY = Math.sin(smoothYaw);
      const cosP = Math.cos(smoothPitch);
      const sinP = Math.sin(smoothPitch);

      const cx = width * 0.5;
      const cy = height * 0.5;

      // Exact glyph hit-test: only hovering actual typography triggers particle dispersion & HD text dissolve
      const hoveringText =
        pointer.active &&
        smoothAssembly > 0.7 &&
        isPointerOnText(pointer.x, pointer.y, cx, cy, cosY, sinY, cosP, sinP);
      smoothHoverScatter = expDamp(smoothHoverScatter, hoveringText ? 1 : 0, hoveringText ? 11.0 : 5.5, dt);
      canvas.dataset.cursor = hoveringText ? 'SCATTER' : '3D';

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const rings: OrbitRingSpec[] = [
        {
          rx: Math.min(width * 0.45, height * 1.48),
          ry: height * 0.34,
          tiltZ: -0.09,
          pitchBias: 0.72,
          yawBias: 1.0,
          colorBack: 'rgba(125, 211, 252, 0.26)',
          colorFront: 'rgba(186, 230, 253, 0.68)',
          lineWidth: 1.4,
        },
        {
          rx: Math.min(width * 0.37, height * 1.18),
          ry: height * 0.27,
          tiltZ: 0.14,
          pitchBias: -0.62,
          yawBias: -0.88,
          colorBack: 'rgba(167, 139, 250, 0.22)',
          colorFront: 'rgba(221, 214, 254, 0.52)',
          lineWidth: 1.15,
        },
      ];

      // 1. Back 3D orbital halo arcs & background depth motes (behind typography)
      for (let i = 0; i < rings.length; i++) {
        drawRingHalf(rings[i], 'back', cx, cy, cosY, sinY, cosP, sinP, smoothAssembly);
      }

      const backWhite: number[] = [];
      const backAccent: number[] = [];
      const fgWhite: number[] = [];
      const fgAccent: number[] = [];

      for (let i = 0; i < ambientMotes.length; i++) {
        const m = ambientMotes[i];
        const mx = m.x + Math.sin(elapsed * m.speed + m.phase) * 18;
        const my = m.y + Math.cos(elapsed * m.speed * 0.85 + m.phase) * 14;
        const pt = project3D(mx, my, m.z, cx, cy, cosY, sinY, cosP, sinP);
        const rad = m.r * pt.persp;
        if (pt.z < 0) {
          if (m.isAccent) backAccent.push(pt.x, pt.y, rad);
          else backWhite.push(pt.x, pt.y, rad);
        } else {
          if (m.isAccent) fgAccent.push(pt.x, pt.y, rad);
          else fgWhite.push(pt.x, pt.y, rad);
        }
      }

      const drawMoteList = (coords: number[], color: string, alpha: number) => {
        if (!coords.length) return;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (let i = 0; i < coords.length; i += 3) {
          ctx.moveTo(coords[i] + coords[i + 2], coords[i + 1]);
          ctx.arc(coords[i], coords[i + 1], coords[i + 2], 0, Math.PI * 2);
        }
        ctx.fill();
      };

      drawMoteList(backWhite, '#f8fafc', 0.28);
      drawMoteList(backAccent, '#7dd3fc', 0.32);

      // 2. Extruded 3D thickness slices behind main typography; dissolve cleanly when hovered text particleizes
      const hdLockIn = smoothAssembly > 0.78 ? Math.min(1, (smoothAssembly - 0.78) / 0.17) : 0;
      const hdVisibility = hdLockIn * Math.max(0, 1 - smoothHoverScatter);
      if (hdVisibility > 0.01) {
        drawWarpedLayer(extrudeLayer, -52, hdVisibility * 0.28, cx, cy, cosY, sinY, cosP, sinP);
        drawWarpedLayer(extrudeLayer, -34, hdVisibility * 0.48, cx, cy, cosY, sinY, cosP, sinP);
        drawWarpedLayer(extrudeLayer, -16, hdVisibility * 0.78, cx, cy, cosY, sinY, cosP, sinP);
      }

      // 3. True 3D Volumetric Particle Assembly (cleanly fades out into HD vector at rest; ignites back on text hover)
      const swirlAmp = 88;
      const driftAmp = (1 - smoothAssembly) * 20 + smoothHoverScatter * 2.2;
      const restParticleFade = Math.max(0, 1 - hdLockIn);
      const particleAlpha = Math.max(
        (0.45 + smoothAssembly * 0.55) * restParticleFade,
        smoothHoverScatter
      );
      const skipParticlesAtRest = particleAlpha < 0.015 && smoothHoverScatter < 0.015;

      const whiteRects: number[] = [];
      const accentRects: number[] = [];

      if (!skipParticlesAtRest) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          const stagger = p.seedA * 0.45;
          const localT = Math.max(0, Math.min(1, (smoothAssembly - stagger) / (1 - stagger)));
          const eased = 1 - Math.pow(1 - localT, 3);

          const dirX = p.hx - p.sx;
          const dirY = p.hy - p.sy;
          const dirZ = p.hz - p.sz;
          const len = Math.hypot(dirX, dirY) || 1;
          const perpX = -dirY / len;
          const perpY = dirX / len;

          const swirl = (p.seedB - 0.5) * 2 * swirlAmp * Math.sin(eased * Math.PI);
          const driftX = Math.sin(elapsed * (1.2 + p.seedA * 1.8) + p.seedB * 20) * driftAmp;
          const driftY = Math.cos(elapsed * (1.0 + p.seedB * 1.8) + p.seedA * 20) * driftAmp;

          const x3d = p.sx + dirX * eased + perpX * swirl + driftX;
          const y3d = p.sy + dirY * eased + perpY * swirl + driftY;
          const z3d = p.sz + dirZ * eased + p.dz;

          const pt = project3D(x3d, y3d, z3d, cx, cy, cosY, sinY, cosP, sinP);

          if (hoveringText) {
            const pdx = pt.x - pointer.x;
            const pdy = pt.y - pointer.y;
            const pdist = Math.hypot(pdx, pdy);
            if (pdist < 145 && pdist > 0.1) {
              const force = Math.pow(1 - pdist / 145, 1.35) * 46;
              p.dx += (pdx / pdist) * force * dt * 16;
              p.dy += (pdy / pdist) * force * dt * 16;
              p.dz += (p.seedB - 0.35) * force * 3.4 * dt * 14;
            }
          }

          p.dx = expDamp(p.dx, 0, 7.5, dt);
          p.dy = expDamp(p.dy, 0, 7.5, dt);
          p.dz = expDamp(p.dz, 0, 7.5, dt);

          const fx = pt.x + p.dx;
          const fy = pt.y + p.dy;
          const size = p.size * pt.persp * (0.82 + eased * 0.28);

          if (p.isAccent) {
            accentRects.push(fx - size * 0.5, fy - size * 0.5, size);
          } else {
            whiteRects.push(fx - size * 0.5, fy - size * 0.5, size);
          }
        }
      }

      if (particleAlpha > 0.015) {
        ctx.globalAlpha = particleAlpha;
        if (whiteRects.length > 0) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          for (let i = 0; i < whiteRects.length; i += 3) {
            ctx.rect(whiteRects[i], whiteRects[i + 1], whiteRects[i + 2], whiteRects[i + 2]);
          }
          ctx.fill();
        }
        if (accentRects.length > 0) {
          ctx.fillStyle = '#bae6fd';
          ctx.beginPath();
          for (let i = 0; i < accentRects.length; i += 3) {
            ctx.rect(accentRects[i], accentRects[i + 1], accentRects[i + 2], accentRects[i + 2]);
          }
          ctx.fill();
        }
      }

      // 4. Perspective-warped HD front typography face — crisply visible at rest, smoothly dissolves when hovered
      if (hdVisibility > 0.01) {
        drawWarpedLayer(
          faceLayer,
          0,
          hdVisibility,
          cx,
          cy,
          cosY,
          sinY,
          cosP,
          sinP
        );
      }

      // 5. Foreground orbital light rings & out-of-focus bokeh motes passing IN FRONT of letters
      for (let i = 0; i < rings.length; i++) {
        drawRingHalf(rings[i], 'front', cx, cy, cosY, sinY, cosP, sinP, smoothAssembly);
      }
      drawMoteList(fgWhite, '#ffffff', 0.55);
      drawMoteList(fgAccent, '#7dd3fc', 0.65);

      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      st?.kill();
      io.disconnect();
      rectCache.destroy();
      resizeObs.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative w-full border-b border-white/[0.08] bg-transparent py-3 sm:py-4"
      aria-label="设计哲学粒子凝聚宣言"
    >
      <div className="relative h-[340px] w-full sm:h-[420px] lg:h-[460px]">
        <canvas
          ref={canvasRef}
          data-cursor="3D"
          className="block h-full w-full cursor-crosshair"
        />
      </div>
    </section>
  );
};
