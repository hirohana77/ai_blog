import React, { useEffect, useId, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  createCanvasResizeObserver,
  createRectCache,
  expDamp,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';

gsap.registerPlugin(ScrollTrigger);

export interface ArchivePortalTransitionProps {
  /** Shared Lenis / scroll velocity ref for dynamic radial ray stretching and prism dispersion */
  scrollVelocityRef?: React.MutableRefObject<number>;
  /** Optional progress callback [0..1] across the portal scroll band */
  onProgress?: (progress: number) => void;
  /** Optional utility classes appended to the outer full-bleed section */
  className?: string;
}

interface DepthRay {
  angle: number;
  depth01: number;
  speed: number;
  weight: number;
  spectrum: 0 | 1 | 2 | 3;
}

const RAY_COLORS = ['#f5f7ff', '#7dd3fc', '#c084fc', '#a5f3fc'] as const;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createDepthRays(count: number): DepthRay[] {
  const rand = mulberry32(0x51a9c3);
  const rays: DepthRay[] = [];
  for (let i = 0; i < count; i++) {
    const spectrumRoll = rand();
    const spectrum: 0 | 1 | 2 | 3 =
      spectrumRoll < 0.44 ? 0 : spectrumRoll < 0.72 ? 1 : spectrumRoll < 0.88 ? 2 : 3;
    rays.push({
      angle: rand() * Math.PI * 2,
      depth01: rand(),
      speed: 0.4 + rand() * 0.9,
      weight: 0.65 + rand() * 1.25,
      spectrum,
    });
  }
  return rays;
}

/**
 * Full-bleed scroll-driven optical portal bridging ScrollStoryStage and 01 // SELECTED ARCHIVE.
 * Combines 3D anodized brushed-titanium curved shutter wings with a HiDPI Canvas2D multi-ring
 * optical reticle, 8-blade shingled mechanical iris diaphragm, chromatic prism sweeps, and
 * radial starlight depth rays driven by GSAP ScrollTrigger.
 */
export const ArchivePortalTransition: React.FC<ArchivePortalTransitionProps> = ({
  scrollVelocityRef,
  onProgress,
  className = '',
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const leftWingRef = useRef<HTMLDivElement>(null);
  const rightWingRef = useRef<HTMLDivElement>(null);
  const gatewayRef = useRef<HTMLDivElement>(null);
  const horizonCueRef = useRef<HTMLDivElement>(null);
  const telemetryPctRef = useRef<HTMLSpanElement>(null);
  const telemetryStateRef = useRef<HTMLSpanElement>(null);
  const onProgressRef = useRef<ArchivePortalTransitionProps['onProgress']>(onProgress);
  onProgressRef.current = onProgress;
  const uid = useId().replace(/:/g, '');
  const leftBodyGradId = `portal-wing-left-body-${uid}`;
  const leftEdgeGradId = `portal-wing-left-edge-${uid}`;
  const rightBodyGradId = `portal-wing-right-body-${uid}`;
  const rightEdgeGradId = `portal-wing-right-edge-${uid}`;

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !canvas) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const rays = createDepthRays(132);

    let width = Math.max(stage.clientWidth, 1);
    let height = Math.max(stage.clientHeight, 1);
    let dpr = getBoundedPixelRatio(stage, null);
    let destroyed = false;

    let targetProgress = prefersReduced ? 0.56 : 0;
    let smoothProgress = targetProgress;
    let smoothVel = 0;
    let ptrX = 0;
    let ptrY = 0;
    let targetPtrX = 0;
    let targetPtrY = 0;
    let isVisible = true;
    let raf = 0;
    let elapsed = 0;
    let lastNow = performance.now();

    const drawOpticalPortal = (
      progress: number,
      velocityNorm: number,
      time: number,
      px: number,
      py: number
    ) => {
      const p = clamp01(progress);
      const open = smoothstep(0.03, 0.94, p);
      const irisOpen = Math.pow(open, 0.78);
      const prismPeak = Math.sin(Math.pow(p, 0.85) * Math.PI);
      const velBoost = Math.min(1, Math.abs(velocityNorm) * 0.72);

      const cx = width * 0.5 + px * 16;
      const cy = height * 0.5 + py * 10;
      const minDim = Math.min(width, height);
      const maxRadius = Math.hypot(width * 0.5, height * 0.5);

      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx2d.clearRect(0, 0, width, height);

      // 1. Deep portal horizon cavity & subtle perspective latitude ribs
      const outerRingR = minDim * lerp(0.30, 0.45, open);
      const innerApertureR = lerp(14, outerRingR * 0.84, irisOpen);

      const haloRadius = Math.max(outerRingR * 1.9, width * 0.34);
      const halo = ctx2d.createRadialGradient(cx, cy, innerApertureR * 0.25, cx, cy, haloRadius);
      halo.addColorStop(0, `rgba(125, 211, 252, ${(0.08 + prismPeak * 0.08).toFixed(3)})`);
      halo.addColorStop(0.32, `rgba(56, 189, 248, ${(0.05 + prismPeak * 0.06).toFixed(3)})`);
      halo.addColorStop(0.62, `rgba(192, 132, 252, ${(0.035 + prismPeak * 0.045).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(5, 6, 10, 0)');
      ctx2d.fillStyle = halo;
      ctx2d.fillRect(0, 0, width, height);

      // Receding horizon projection arcs beneath optical meridian
      const horizonAlpha = smoothstep(0.18, 0.88, p) * 0.24;
      if (horizonAlpha > 0.01) {
        ctx2d.save();
        ctx2d.strokeStyle = `rgba(148, 163, 184, ${horizonAlpha.toFixed(3)})`;
        ctx2d.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const rx = width * (0.22 + i * 0.14 + open * 0.06);
          const ry = height * (0.055 + i * 0.038);
          const yOff = cy + height * (0.17 + i * 0.085);
          ctx2d.beginPath();
          ctx2d.ellipse(cx, yOff, rx, ry, 0, Math.PI * 1.06, Math.PI * 1.94);
          ctx2d.stroke();
        }
        ctx2d.restore();
      }

      // 2. Radial starlight & optical depth rays surging outward from portal axis
      const rayPresence = 0.25 + open * 0.75;
      ctx2d.save();
      ctx2d.lineCap = 'round';
      for (let i = 0; i < rays.length; i++) {
        const ray = rays[i];
        const travel = (ray.depth01 + open * 0.92 + time * 0.028 * ray.speed) % 1;
        const radialEase = Math.pow(travel, 1.55);
        const rHead = lerp(innerApertureR * 0.52, maxRadius * 1.08, radialEase);
        const streakLen = (3 + radialEase * 24) * (0.45 + prismPeak * 0.85 + velBoost * 1.15);
        const rTail = Math.max(innerApertureR * 0.35, rHead - streakLen);

        const cosA = Math.cos(ray.angle);
        const sinA = Math.sin(ray.angle);
        const x1 = cx + cosA * rTail;
        const y1 = cy + sinA * rTail;
        const x2 = cx + cosA * rHead;
        const y2 = cy + sinA * rHead;

        const edgeFade = Math.sin(travel * Math.PI);
        const alpha = clamp01(edgeFade * rayPresence * (0.28 + radialEase * 0.58));
        if (alpha <= 0.015) continue;

        ctx2d.globalAlpha = alpha;
        ctx2d.strokeStyle = RAY_COLORS[ray.spectrum];
        ctx2d.lineWidth = ray.weight * (0.65 + radialEase * 0.75);
        ctx2d.beginPath();
        ctx2d.moveTo(x1, y1);
        ctx2d.lineTo(x2, y2);
        ctx2d.stroke();
      }
      ctx2d.restore();

      // 3. Full-width scanning optical meridian datum line + graduated caliper ticks
      const meridianGrad = ctx2d.createLinearGradient(0, cy, width, cy);
      meridianGrad.addColorStop(0, 'rgba(148, 163, 184, 0)');
      meridianGrad.addColorStop(0.18, 'rgba(148, 163, 184, 0.16)');
      meridianGrad.addColorStop(0.5, `rgba(226, 232, 240, ${(0.28 + prismPeak * 0.32).toFixed(3)})`);
      meridianGrad.addColorStop(0.82, 'rgba(148, 163, 184, 0.16)');
      meridianGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');

      ctx2d.save();
      ctx2d.strokeStyle = meridianGrad;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.moveTo(0, cy);
      ctx2d.lineTo(width, cy);
      ctx2d.stroke();

      const tickStep = width < 640 ? 28 : 36;
      const halfTicks = Math.floor((width * 0.46) / tickStep);
      ctx2d.strokeStyle = `rgba(226, 232, 240, ${(0.12 + prismPeak * 0.16).toFixed(3)})`;
      ctx2d.beginPath();
      for (let t = -halfTicks; t <= halfTicks; t++) {
        if (t === 0) continue;
        const tx = cx + t * tickStep;
        if (Math.abs(tx - cx) < innerApertureR * 0.85) continue;
        const major = t % 4 === 0;
        const tickHalfH = major ? 5 : 2.5;
        ctx2d.moveTo(tx, cy - tickHalfH);
        ctx2d.lineTo(tx, cy + tickHalfH);
      }
      ctx2d.stroke();
      ctx2d.restore();

      // 4. Razor-sharp chromatic prism light sweeps across the opening aperture
      const sweepIntensity = 0.24 + prismPeak * 0.76 + velBoost * 0.28;
      const dispersion = (1.6 + prismPeak * 4.8 + velBoost * 3.5) * (1 - open * 0.28);
      const sweepSpan = width * (0.28 + open * 0.48);

      ctx2d.save();
      ctx2d.globalCompositeOperation = 'lighter';

      // Angled subtle caustic refraction beams
      const coneAlpha = 0.085 * prismPeak + 0.025;
      const beamTilt = 0.135;
      for (const dir of [-1, 1] as const) {
        const beamGrad = ctx2d.createLinearGradient(
          cx,
          cy,
          cx + dir * sweepSpan * 0.9,
          cy - dir * sweepSpan * beamTilt
        );
        beamGrad.addColorStop(0, `rgba(125, 211, 252, ${coneAlpha.toFixed(3)})`);
        beamGrad.addColorStop(0.45, `rgba(192, 132, 252, ${(coneAlpha * 0.65).toFixed(3)})`);
        beamGrad.addColorStop(1, 'rgba(5, 6, 10, 0)');
        ctx2d.fillStyle = beamGrad;
        ctx2d.beginPath();
        ctx2d.moveTo(cx, cy - 2);
        ctx2d.lineTo(cx + dir * sweepSpan * 0.92, cy - dir * sweepSpan * (beamTilt + 0.06));
        ctx2d.lineTo(cx + dir * sweepSpan * 0.92, cy - dir * sweepSpan * (beamTilt - 0.04));
        ctx2d.closePath();
        ctx2d.fill();
      }

      // Tri-channel RGB chromatic dispersion light blades
      const drawPrismRay = (yOffset: number, color: string, alpha: number, lineW: number) => {
        const rayGrad = ctx2d.createLinearGradient(cx - sweepSpan, cy, cx + sweepSpan, cy);
        rayGrad.addColorStop(0, 'rgba(5, 6, 10, 0)');
        rayGrad.addColorStop(0.24, color);
        rayGrad.addColorStop(0.5, color);
        rayGrad.addColorStop(0.76, color);
        rayGrad.addColorStop(1, 'rgba(5, 6, 10, 0)');
        ctx2d.globalAlpha = clamp01(alpha);
        ctx2d.strokeStyle = rayGrad;
        ctx2d.lineWidth = lineW;
        ctx2d.beginPath();
        ctx2d.moveTo(cx - sweepSpan, cy + yOffset * 0.45);
        ctx2d.lineTo(cx, cy + yOffset);
        ctx2d.lineTo(cx + sweepSpan, cy + yOffset * 0.45);
        ctx2d.stroke();
      };

      drawPrismRay(-dispersion, '#7dd3fc', 0.42 * sweepIntensity, 1.4);
      drawPrismRay(0, '#f5f7ff', 0.56 * sweepIntensity, 1.15);
      drawPrismRay(dispersion, '#c084fc', 0.36 * sweepIntensity, 1.4);
      drawPrismRay(dispersion * 1.65, '#f472b6', 0.16 * sweepIntensity, 1.0);
      ctx2d.restore();

      // 5. Multi-ring precision optical reticle & 8-blade shingled mechanical iris
      ctx2d.save();

      // Outer calibrated perimeter scale ticks
      const scaleR = outerRingR * 1.11;
      const tickCount = 72;
      const ringSpin = p * 0.55 + time * 0.03;
      ctx2d.strokeStyle = `rgba(148, 163, 184, ${(0.22 + prismPeak * 0.24).toFixed(3)})`;
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      for (let i = 0; i < tickCount; i++) {
        const a = (i / tickCount) * Math.PI * 2 + ringSpin;
        const isMajor = i % 6 === 0;
        const r0 = scaleR;
        const r1 = scaleR + (isMajor ? 9 : 4);
        ctx2d.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx2d.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      }
      ctx2d.stroke();

      // Counter-rotating vernier prism arcs
      const vernierR = outerRingR * 1.03;
      const vernierSpin = -p * 1.1 + time * 0.07;
      for (let i = 0; i < 3; i++) {
        const aStart = vernierSpin + i * ((Math.PI * 2) / 3);
        const aEnd = aStart + 0.92;
        ctx2d.strokeStyle =
          i === 0
            ? 'rgba(125, 211, 252, 0.55)'
            : i === 1
              ? 'rgba(192, 132, 252, 0.45)'
              : 'rgba(226, 232, 240, 0.4)';
        ctx2d.lineWidth = 1.5;
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, vernierR, aStart, aEnd);
        ctx2d.stroke();
      }

      // Clipped 8-blade shingled anodized obsidian-titanium iris diaphragm
      const housingR = outerRingR * 0.96;
      ctx2d.save();
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, housingR, 0, Math.PI * 2);
      ctx2d.clip();

      const bladeCount = 8;
      const step = (Math.PI * 2) / bladeCount;
      const twist = lerp(1.06, 0.21, irisOpen);
      const bladeSpin = p * 0.35;

      for (let i = 0; i < bladeCount; i++) {
        const base = i * step + bladeSpin;
        const a0 = base - step * 0.16;
        const a1 = base + step * 1.18;
        const a2 = base + step + twist;
        const a3 = base + twist;

        const rOut = housingR * 1.06;
        const ax = cx + Math.cos(a0) * rOut;
        const ay = cy + Math.sin(a0) * rOut;
        const bx = cx + Math.cos(a1) * rOut;
        const by = cy + Math.sin(a1) * rOut;
        const cpx = cx + Math.cos(a2) * (innerApertureR * 1.02);
        const cpy = cy + Math.sin(a2) * (innerApertureR * 1.02);
        const dx = cx + Math.cos(a3) * innerApertureR;
        const dy = cy + Math.sin(a3) * innerApertureR;

        const bladeGrad = ctx2d.createLinearGradient(ax, ay, dx, dy);
        bladeGrad.addColorStop(0, '#07090f');
        bladeGrad.addColorStop(0.55, '#0c1019');
        bladeGrad.addColorStop(1, '#141a28');

        ctx2d.fillStyle = bladeGrad;
        ctx2d.beginPath();
        ctx2d.moveTo(ax, ay);
        ctx2d.lineTo(bx, by);
        ctx2d.lineTo(cpx, cpy);
        ctx2d.lineTo(dx, dy);
        ctx2d.closePath();
        ctx2d.fill();

        // Brushed titanium crease along leading edge
        ctx2d.strokeStyle = `rgba(226, 232, 240, ${(0.24 + prismPeak * 0.24).toFixed(3)})`;
        ctx2d.lineWidth = 1;
        ctx2d.beginPath();
        ctx2d.moveTo(ax, ay);
        ctx2d.lineTo(dx, dy);
        ctx2d.lineTo(cpx, cpy);
        ctx2d.stroke();

        // Subtle chromatic edge glint along aperture chord
        ctx2d.strokeStyle =
          i % 2 === 0
            ? `rgba(125, 211, 252, ${(0.22 + prismPeak * 0.36).toFixed(3)})`
            : `rgba(192, 132, 252, ${(0.18 + prismPeak * 0.28).toFixed(3)})`;
        ctx2d.lineWidth = 1.25;
        ctx2d.beginPath();
        ctx2d.moveTo(dx, dy);
        ctx2d.lineTo(cpx, cpy);
        ctx2d.stroke();
      }
      ctx2d.restore();

      // Outer titanium mechanical housing ring bezel
      ctx2d.strokeStyle = 'rgba(226, 232, 240, 0.28)';
      ctx2d.lineWidth = 1.25;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, housingR, 0, Math.PI * 2);
      ctx2d.stroke();

      // Inner aperture rim + cardinal crosshair notches
      ctx2d.strokeStyle = `rgba(186, 230, 253, ${(0.24 + prismPeak * 0.42).toFixed(3)})`;
      ctx2d.lineWidth = 1;
      ctx2d.setLineDash([4, 6]);
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, Math.max(8, innerApertureR * 0.93), 0, Math.PI * 2);
      ctx2d.stroke();
      ctx2d.setLineDash([]);

      // Soft dark pupil vignette inside aperture so gateway typography stays AAA legible
      const pupilGrad = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, Math.max(24, innerApertureR * 0.9));
      pupilGrad.addColorStop(0, 'rgba(5, 6, 10, 0.88)');
      pupilGrad.addColorStop(0.68, 'rgba(5, 6, 10, 0.56)');
      pupilGrad.addColorStop(1, 'rgba(5, 6, 10, 0)');
      ctx2d.fillStyle = pupilGrad;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, Math.max(24, innerApertureR * 0.9), 0, Math.PI * 2);
      ctx2d.fill();

      ctx2d.restore();
    };

    const applyVisualState = (
      progress: number,
      velocityNorm: number,
      time: number,
      px: number,
      py: number
    ) => {
      const p = clamp01(progress);
      const open = smoothstep(0.03, 0.94, p);
      const horizonReveal = smoothstep(0.24, 0.68, p);
      const bottomCueReveal = smoothstep(0.42, 0.92, p);

      section.dataset.portalProgress = p.toFixed(3);

      // Curved anodized titanium shutter wings part symmetrically across 100vw
      const wingShift = lerp(-1.5, 105, open);
      const wingRotY = lerp(1.5, 28, open);
      const wingScale = lerp(1, 0.92, open);

      if (leftWingRef.current) {
        leftWingRef.current.style.transform = `translate3d(${-wingShift.toFixed(2)}%, 0, 0) rotateY(${wingRotY.toFixed(2)}deg) scale(${wingScale.toFixed(4)})`;
      }
      if (rightWingRef.current) {
        rightWingRef.current.style.transform = `translate3d(${wingShift.toFixed(2)}%, 0, 0) rotateY(${(-wingRotY).toFixed(2)}deg) scale(${wingScale.toFixed(4)})`;
      }

      if (gatewayRef.current) {
        const shiftX = px * 8;
        const shiftY = py * 5 + (1 - horizonReveal) * 14;
        const scale = lerp(0.88, 1, horizonReveal);
        gatewayRef.current.style.opacity = horizonReveal.toFixed(3);
        gatewayRef.current.style.transform = `translate3d(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
      }

      if (horizonCueRef.current) {
        horizonCueRef.current.style.opacity = (0.35 + bottomCueReveal * 0.65).toFixed(3);
      }

      if (telemetryPctRef.current) {
        const pct = Math.round(open * 100)
          .toString()
          .padStart(3, '0');
        telemetryPctRef.current.textContent = `IRIS Ø ${pct}%`;
      }

      if (telemetryStateRef.current) {
        const stateLabel =
          open > 0.88 ? 'HORIZON OPEN' : open > 0.2 ? 'PRISM ACTIVE' : 'SEAL LOCKED';
        telemetryStateRef.current.textContent = ` · ${stateLabel}`;
      }

      drawOpticalPortal(p, velocityNorm, time, px, py);
    };

    const syncCanvasSize = () => {
      width = Math.max(stage.clientWidth, 1);
      height = Math.max(stage.clientHeight, 1);
      dpr = getBoundedPixelRatio(stage, null);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      if (prefersReduced || !raf) {
        applyVisualState(smoothProgress, smoothVel, elapsed, ptrX, ptrY);
      }
    };

    const ro = createCanvasResizeObserver(syncCanvasSize);
    ro.observe(stage);
    syncCanvasSize();

    if (prefersReduced) {
      applyVisualState(0.56, 0, 0, 0, 0);
      return () => {
        destroyed = true;
        ro.disconnect();
      };
    }

    const rectCache = createRectCache(stage);

    const onPointerMove = (e: PointerEvent) => {
      const r = rectCache.current;
      if (r.width < 1 || r.height < 1) return;
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      targetPtrX = Math.max(-1, Math.min(1, nx));
      targetPtrY = Math.max(-1, Math.min(1, ny));
    };

    const onPointerLeave = () => {
      targetPtrX = 0;
      targetPtrY = 0;
    };

    stage.addEventListener('pointermove', onPointerMove, { passive: true });
    stage.addEventListener('pointerleave', onPointerLeave, { passive: true });

    const ctx = gsap.context(() => {
      const st = ScrollTrigger.create({
        trigger: section,
        start: 'top 92%',
        end: 'bottom 14%',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          targetProgress = self.progress;
          onProgressRef.current?.(self.progress);
        },
        onRefresh: (self) => {
          targetProgress = self.progress;
          onProgressRef.current?.(self.progress);
        },
      });
      targetProgress = st.progress;
      smoothProgress = st.progress;
    }, sectionRef);

    const tick = (now: number) => {
      if (destroyed || !isVisible) {
        raf = 0;
        return;
      }

      const dt = Math.min((now - lastNow) / 1000, 0.05);
      lastNow = now;
      elapsed += dt;

      smoothProgress = expDamp(smoothProgress, targetProgress, 12.0, dt);
      const rawVel = scrollVelocityRef?.current ?? 0;
      const targetVel = Math.max(-1, Math.min(1, rawVel / 28));
      smoothVel = expDamp(smoothVel, targetVel, 8.5, dt);
      ptrX = expDamp(ptrX, targetPtrX, 7.5, dt);
      ptrY = expDamp(ptrY, targetPtrY, 7.5, dt);

      applyVisualState(smoothProgress, smoothVel, elapsed, ptrX, ptrY);

      raf = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (destroyed || raf || !isVisible) return;
      lastNow = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisible = entry?.isIntersecting ?? true;
        if (isVisible) {
          startLoop();
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0.01, rootMargin: '120px 0px' }
    );
    io.observe(section);

    applyVisualState(smoothProgress, 0, 0, 0, 0);
    startLoop();

    return () => {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      rectCache.destroy();
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerleave', onPointerLeave);
      ctx.revert();
    };
  }, [scrollVelocityRef]);

  return (
    <section
      ref={sectionRef}
      aria-label="精选作品维度转场舞台"
      data-cursor="PORTAL"
      className={`relative w-full overflow-hidden border-b border-white/[0.08] bg-transparent ${className}`}
    >
      <div
        ref={stageRef}
        className="relative flex h-[380px] w-full items-center justify-center overflow-hidden bg-transparent sm:h-[440px] lg:h-[500px]"
        style={{ perspective: '1400px', perspectiveOrigin: '50% 50%' }}
      >
        {/* Top & Bottom Obsidian Edge Continuity Veil */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(180deg,rgba(5,6,10,0.48)_0%,transparent_20%,transparent_80%,rgba(5,6,10,0.52)_100%)]"
        />

        {/* Layer A: HiDPI Canvas2D Multi-Ring Optical Reticle, Mechanical Iris & Prism Sweeps */}
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 block h-full w-full"
        />

        {/* Layer C (Inner Pupil): Incoming Selected Archive Horizon Callout */}
        <div
          ref={gatewayRef}
          className="pointer-events-none relative z-[15] flex max-w-[240px] flex-col items-center px-4 text-center will-change-transform sm:max-w-md"
          style={{ opacity: 0 }}
        >
          <div className="font-mono-tech text-[10px] tracking-[0.26em] text-sky-300/90 sm:text-[11px]">
            APERTURE // 00 → 01
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-2xl lg:text-3xl">
            Entering{' '}
            <span className="font-serif-display text-liquid-pearl font-normal italic">
              Selected Archive
            </span>
          </div>
          <div className="mt-1.5 font-mono-tech text-[10px] tracking-[0.2em] text-slate-400">
            精选交互作品 · OPTICAL SYSTEMS
          </div>
        </div>

        {/* Layer B1: Left Curved Anodized Obsidian-Titanium Shutter Wing */}
        <div
          ref={leftWingRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[52%] origin-left will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="block h-full w-full drop-shadow-[14px_0_32px_rgba(0,0,0,0.9)]"
          >
            <defs>
              <linearGradient id={leftBodyGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#05060a" />
                <stop offset="56%" stopColor="#090c14" />
                <stop offset="88%" stopColor="#111623" />
                <stop offset="100%" stopColor="#161c2c" />
              </linearGradient>
              <linearGradient id={leftEdgeGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(148,163,184,0.12)" />
                <stop offset="28%" stopColor="rgba(226,232,240,0.48)" />
                <stop offset="50%" stopColor="rgba(125,211,252,0.78)" />
                <stop offset="72%" stopColor="rgba(192,132,252,0.44)" />
                <stop offset="100%" stopColor="rgba(148,163,184,0.12)" />
              </linearGradient>
            </defs>
            <path
              d="M0,0 L98,0 C88,20 82,36 82,50 C82,64 88,80 98,100 L0,100 Z"
              fill={`url(#${leftBodyGradId})`}
            />
            <path
              d="M93.5,0 C83.5,20 77.5,36 77.5,50 C77.5,64 83.5,80 93.5,100"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M98,0 C88,20 82,36 82,50 C82,64 88,80 98,100"
              fill="none"
              stroke={`url(#${leftEdgeGradId})`}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {/* Layer B2: Right Curved Anodized Obsidian-Titanium Shutter Wing */}
        <div
          ref={rightWingRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[52%] origin-right will-change-transform"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="block h-full w-full drop-shadow-[-14px_0_32px_rgba(0,0,0,0.9)]"
          >
            <defs>
              <linearGradient id={rightBodyGradId} x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#05060a" />
                <stop offset="56%" stopColor="#090c14" />
                <stop offset="88%" stopColor="#111623" />
                <stop offset="100%" stopColor="#161c2c" />
              </linearGradient>
              <linearGradient id={rightEdgeGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(148,163,184,0.12)" />
                <stop offset="28%" stopColor="rgba(226,232,240,0.48)" />
                <stop offset="50%" stopColor="rgba(192,132,252,0.72)" />
                <stop offset="72%" stopColor="rgba(125,211,252,0.48)" />
                <stop offset="100%" stopColor="rgba(148,163,184,0.12)" />
              </linearGradient>
            </defs>
            <path
              d="M100,0 L2,0 C12,20 18,36 18,50 C18,64 12,80 2,100 L100,100 Z"
              fill={`url(#${rightBodyGradId})`}
            />
            <path
              d="M6.5,0 C16.5,20 22.5,36 22.5,50 C22.5,64 16.5,80 6.5,100"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M2,0 C12,20 18,36 18,50 C18,64 12,80 2,100"
              fill="none"
              stroke={`url(#${rightEdgeGradId})`}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        {/* Top Full-Bleed Architectural Calibration Header */}
        <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex items-center justify-between gap-3 px-5 font-mono-tech text-[10px] tracking-[0.2em] text-slate-400 sm:top-5 sm:px-8 sm:tracking-[0.22em] lg:px-14">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_8px_#7dd3fc]" />
            <span>OPTICAL PORTAL</span>
            <span className="hidden sm:inline">// TRANSITION</span>
          </div>
          <span className="whitespace-nowrap rounded-full border border-white/[0.08] bg-[#07090f]/80 px-3 py-1 text-[10px] tracking-[0.16em] text-slate-300 backdrop-blur-sm sm:tracking-[0.18em]">
            <span ref={telemetryPctRef}>IRIS Ø 000%</span>
            <span ref={telemetryStateRef} className="hidden sm:inline">
              {' '}
              · SEAL LOCKED
            </span>
          </span>
        </div>

        {/* Bottom Horizon Continuation Axis */}
        <div
          ref={horizonCueRef}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 font-mono-tech text-[10px] tracking-[0.24em] text-slate-400 transition-opacity duration-200 sm:bottom-5"
        >
          <span className="h-px w-6 bg-gradient-to-r from-transparent to-sky-300/60" />
          <span className="text-slate-300">01 // SELECTED ARCHIVE ↓</span>
          <span className="h-px w-6 bg-gradient-to-l from-transparent to-purple-300/60" />
        </div>
      </div>
    </section>
  );
};
