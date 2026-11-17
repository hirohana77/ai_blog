import React, { useEffect, useRef } from 'react';
import { PreviewVisualMode } from '../../data/portfolio';

interface ProjectPreviewCanvasProps {
  mode: PreviewVisualMode;
  accentFrom: string;
  accentTo: string;
  className?: string;
}

/**
 * Procedural HiDPI 2D Canvas artwork per project card & case study hero.
 * Uses IntersectionObserver to pause rendering automatically when offscreen.
 */
export const ProjectPreviewCanvas: React.FC<ProjectPreviewCanvasProps> = ({
  mode,
  accentFrom,
  accentTo,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let isVisible = true;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.05 }
    );
    io.observe(canvas);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();

    // Seed particles for curl-constellation and physics-capsules
    const particles = Array.from({ length: 68 }, (_, i) => ({
      angle: (i / 68) * Math.PI * 2,
      radius: 0.16 + ((i * 37) % 100) / 300,
      speed: 0.25 + ((i * 19) % 100) / 220,
      size: 1.3 + (i % 4) * 0.8,
    }));

    const orbs = Array.from({ length: 9 }, (_, i) => ({
      bx: 0.18 + ((i * 29) % 64) / 100,
      by: 0.24 + ((i * 43) % 52) / 100,
      r: 18 + (i % 4) * 11,
      phase: i * 1.15,
    }));

    const draw = (now: number) => {
      rafId = requestAnimationFrame(draw);
      if (!isVisible) return;

      const t = prefersReduced ? 1.2 : (now - start) * 0.001;
      const px = pointerRef.current.x * width;
      const py = pointerRef.current.y * height;

      ctx.clearRect(0, 0, width, height);

      // Base deep optical backdrop gradient
      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#090d18');
      bg.addColorStop(1, '#05070d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Ambient color glow reacting to pointer
      const glow = ctx.createRadialGradient(
        pointerRef.current.active ? px : width * 0.62,
        pointerRef.current.active ? py : height * 0.42,
        10,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.72
      );
      glow.addColorStop(0, `${accentFrom}38`);
      glow.addColorStop(0.5, `${accentTo}20`);
      glow.addColorStop(1, 'rgba(5,6,10,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      if (mode === 'refraction-prism') {
        const cx = width * 0.5 + (pointerRef.current.x - 0.5) * 32;
        const cy = height * 0.5 + (pointerRef.current.y - 0.5) * 24;
        const baseR = Math.min(width, height) * 0.28;

        for (let layer = 0; layer < 4; layer++) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(t * (0.18 + layer * 0.06) + layer * 0.55);

          ctx.beginPath();
          const steps = 90;
          for (let i = 0; i <= steps; i++) {
            const a = (i / steps) * Math.PI * 2;
            const wobble =
              Math.sin(a * 3 + t * 1.4 + layer) * 8 +
              Math.cos(a * 5 - t * 1.1) * 5;
            const rad = baseR * (0.72 + layer * 0.14) + wobble;
            const x = Math.cos(a) * rad;
            const y = Math.sin(a) * rad * 0.84;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();

          const grad = ctx.createLinearGradient(-baseR, -baseR, baseR, baseR);
          grad.addColorStop(0, `${accentFrom}33`);
          grad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
          grad.addColorStop(1, `${accentTo}2e`);
          ctx.fillStyle = grad;
          ctx.fill();

          ctx.lineWidth = 1.25;
          ctx.strokeStyle = layer === 3 ? 'rgba(255,255,255,0.55)' : `${accentFrom}66`;
          ctx.stroke();
          ctx.restore();
        }
      } else if (mode === 'curl-constellation') {
        const cx = width * 0.5;
        const cy = height * 0.5;
        const scale = Math.min(width, height);

        const coords: Array<{ x: number; y: number; s: number }> = [];
        for (const p of particles) {
          const a = p.angle + t * p.speed;
          const r = scale * p.radius * (1 + 0.16 * Math.sin(t * 1.3 + p.angle * 3));
          const x = cx + Math.cos(a) * r + (pointerRef.current.x - 0.5) * 35 * p.radius;
          const y = cy + Math.sin(a * 1.25 + 0.4) * r * 0.72 + (pointerRef.current.y - 0.5) * 28;
          coords.push({ x, y, s: p.size });
        }

        // Subtle constellation edges
        ctx.lineWidth = 0.7;
        for (let i = 0; i < coords.length; i++) {
          for (let j = i + 1; j < coords.length; j++) {
            const dx = coords[i].x - coords[j].x;
            const dy = coords[i].y - coords[j].y;
            const dist = Math.hypot(dx, dy);
            if (dist < scale * 0.16) {
              ctx.strokeStyle = `rgba(186, 230, 253, ${(1 - dist / (scale * 0.16)) * 0.25})`;
              ctx.beginPath();
              ctx.moveTo(coords[i].x, coords[i].y);
              ctx.lineTo(coords[j].x, coords[j].y);
              ctx.stroke();
            }
          }
        }

        for (let i = 0; i < coords.length; i++) {
          const c = coords[i];
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.s, 0, Math.PI * 2);
          ctx.fillStyle = i % 2 === 0 ? accentFrom : accentTo;
          ctx.fill();
        }
      } else if (mode === 'physics-capsules') {
        for (let i = 0; i < orbs.length; i++) {
          const o = orbs[i];
          const x =
            o.bx * width +
            Math.sin(t * 0.8 + o.phase) * 24 +
            (pointerRef.current.x - 0.5) * (16 + i * 2);
          const y =
            o.by * height +
            Math.cos(t * 0.95 + o.phase) * 18 +
            (pointerRef.current.y - 0.5) * (14 + i * 2);

          const sphereGrad = ctx.createRadialGradient(
            x - o.r * 0.35,
            y - o.r * 0.35,
            o.r * 0.12,
            x,
            y,
            o.r
          );
          sphereGrad.addColorStop(0, 'rgba(255,255,255,0.65)');
          sphereGrad.addColorStop(0.35, `${accentFrom}42`);
          sphereGrad.addColorStop(0.85, `${accentTo}26`);
          sphereGrad.addColorStop(1, 'rgba(255,255,255,0.12)');

          ctx.beginPath();
          ctx.arc(x, y, o.r, 0, Math.PI * 2);
          ctx.fillStyle = sphereGrad;
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = 'rgba(255,255,255,0.42)';
          ctx.stroke();

          // Specular caustic crescent
          ctx.beginPath();
          ctx.arc(x, y, o.r * 0.74, Math.PI * 1.1, Math.PI * 1.65);
          ctx.strokeStyle = 'rgba(255,255,255,0.75)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      } else if (mode === 'chromatic-waves') {
        const lines = 11;
        for (let l = 0; l < lines; l++) {
          ctx.beginPath();
          const baseY = (height / (lines + 1)) * (l + 1);
          for (let x = 0; x <= width; x += 8) {
            const normX = x / width;
            const mousePull =
              Math.exp(-Math.pow((normX - pointerRef.current.x) * 3.2, 2)) *
              (pointerRef.current.y - 0.5) *
              36;
            const y =
              baseY +
              Math.sin(normX * 6 + t * 1.2 + l * 0.45) * 16 +
              Math.cos(normX * 11 - t * 0.8) * 6 +
              mousePull;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          const lg = ctx.createLinearGradient(0, 0, width, 0);
          lg.addColorStop(0, `${accentFrom}15`);
          lg.addColorStop(0.5, l % 2 === 0 ? `${accentFrom}88` : `${accentTo}88`);
          lg.addColorStop(1, `${accentTo}15`);
          ctx.strokeStyle = lg;
          ctx.lineWidth = l === 5 ? 2 : 1;
          ctx.stroke();
        }
      } else {
        // spatial-grid with subtle lifted glass facet tiles near pointer (Shatter echo)
        const cols = 12;
        const rows = 8;
        const cellW = width / cols;
        const cellH = height / rows;

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cx = (c + 0.5) * cellW;
            const cy = (r + 0.5) * cellH;
            const dx = cx - px;
            const dy = cy - py;
            const dist = Math.hypot(dx, dy);
            const act = pointerRef.current.active
              ? Math.exp(-dist * 0.011)
              : Math.exp(-Math.hypot(cx - width * 0.5, cy - height * 0.5) * 0.008) * 0.45;

            const wave = Math.sin(c * 0.7 + r * 0.5 + t * 1.5) * 3 * act;
            const scale = 1 + act * 0.08;
            const w = cellW * 0.88 * scale;
            const h = cellH * 0.86 * scale;

            ctx.save();
            ctx.translate(cx + (dx / (dist + 1)) * act * 8, cy + (dy / (dist + 1)) * act * 8 - act * 6 + wave);
            ctx.rotate(Math.sin(c + r + t) * 0.08 * act);
            ctx.beginPath();
            ctx.roundRect(-w * 0.5, -h * 0.5, w, h, 4);
            ctx.fillStyle = act > 0.25 ? `${accentFrom}22` : 'rgba(255,255,255,0.02)';
            ctx.fill();
            ctx.lineWidth = 0.8 + act * 0.9;
            ctx.strokeStyle = act > 0.35 ? `${accentTo}99` : `${accentFrom}38`;
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      io.disconnect();
    };
  }, [accentFrom, accentTo, mode]);

  return (
    <canvas
      ref={canvasRef}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          x: (e.clientX - rect.left) / Math.max(rect.width, 1),
          y: (e.clientY - rect.top) / Math.max(rect.height, 1),
          active: true,
        };
      }}
      onPointerLeave={() => {
        pointerRef.current.active = false;
      }}
      className={`block h-full w-full ${className}`}
    />
  );
};
