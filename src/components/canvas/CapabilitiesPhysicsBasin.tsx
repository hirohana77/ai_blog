import React, { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import {
  createCanvasResizeObserver,
  createRectCache,
  getBoundedPixelRatio,
} from '../../lib/canvasOptics';
import { OPEN_SOURCE_STACK, OpenSourceTechItem } from '../../data/portfolio';

interface CapabilitiesPhysicsBasinProps {
  selectedId: string;
  onSelectTech: (item: OpenSourceTechItem) => void;
}

/**
 * Interactive Matter.js Liquid Glass Physics Basin fused directly into the
 * Capabilities & Open-Source Stack section: visitors can toss, bounce, or click
 * real translucent skill capsules to inspect how each library powers the site.
 */
export const CapabilitiesPhysicsBasin: React.FC<CapabilitiesPhysicsBasinProps> = ({
  selectedId,
  onSelectTech,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const onSelectRef = useRef(onSelectTech);
  onSelectRef.current = onSelectTech;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    host.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = Math.max(host.clientWidth, 280);
    let height = Math.max(host.clientHeight, 260);
    let dpr = getBoundedPixelRatio(host);

    const syncSize = () => {
      const r = host.getBoundingClientRect();
      width = Math.max(r.width, 280);
      height = Math.max(r.height, 260);
      dpr = getBoundedPixelRatio(host);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncSize();

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.55, scale: 0.001 },
    });

    const wallThick = 80;
    const makeWalls = () => [
      Matter.Bodies.rectangle(width / 2, height + wallThick / 2, width + 200, wallThick, {
        isStatic: true,
        restitution: 0.86,
      }),
      Matter.Bodies.rectangle(width / 2, -wallThick / 2, width + 200, wallThick, {
        isStatic: true,
        restitution: 0.86,
      }),
      Matter.Bodies.rectangle(-wallThick / 2, height / 2, wallThick, height + 200, {
        isStatic: true,
        restitution: 0.86,
      }),
      Matter.Bodies.rectangle(width + wallThick / 2, height / 2, wallThick, height + 200, {
        isStatic: true,
        restitution: 0.86,
      }),
    ];
    let walls = makeWalls();
    Matter.Composite.add(engine.world, walls);

    interface CapsuleMeta {
      tech: OpenSourceTechItem;
      w: number;
      h: number;
      tintA: string;
      tintB: string;
    }

    const tints: Array<[string, string]> = [
      ['#7dd3fc', '#6366f1'],
      ['#67e8f9', '#a855f7'],
      ['#93c5fd', '#f472b6'],
      ['#a5f3fc', '#fde68a'],
      ['#c4b5fd', '#38bdf8'],
      ['#7dd3fc', '#c084fc'],
    ];

    const capsules = OPEN_SOURCE_STACK.map((tech, idx) => {
      const label = tech.name.split(' ')[0];
      const w = Math.max(112, label.length * 10 + 48);
      const h = 44;
      const body = Matter.Bodies.rectangle(
        width * (0.2 + ((idx * 0.23) % 0.65)),
        52 + (idx % 3) * 56,
        w,
        h,
        {
          chamfer: { radius: h / 2 - 1 },
          restitution: 0.85,
          friction: 0.02,
          frictionAir: 0.01,
        }
      );
      const [tintA, tintB] = tints[idx % tints.length];
      (body as unknown as { capMeta: CapsuleMeta }).capMeta = { tech, w, h, tintA, tintB };
      return body;
    });

    const orbs = Array.from({ length: 5 }, (_, i) =>
      Matter.Bodies.circle(width * (0.18 + i * 0.16), 36 + i * 18, 16 + (i % 3) * 5, {
        restitution: 0.9,
        friction: 0.01,
        frictionAir: 0.008,
      })
    );

    Matter.Composite.add(engine.world, [...capsules, ...orbs]);

    const mouse = Matter.Mouse.create(canvas);
    mouse.pixelRatio = dpr;
    const wheelHandler = (mouse as unknown as { mousewheel?: EventListener }).mousewheel;
    if (wheelHandler) canvas.removeEventListener('wheel', wheelHandler);

    const mc = Matter.MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    Matter.Composite.add(engine.world, mc);

    const rectCache = createRectCache(canvas);
    let downX = 0;
    let downY = 0;

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const r = rectCache.current;
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;

      // Select capsule on click or trigger gentle local impulse
      const hit = Matter.Query.point(capsules, { x: px, y: py })[0];
      if (hit) {
        const meta = (hit as unknown as { capMeta?: CapsuleMeta }).capMeta;
        if (meta) onSelectRef.current(meta.tech);
      } else {
        for (const b of [...capsules, ...orbs]) {
          const dx = b.position.x - px;
          const dy = b.position.y - py;
          const dist = Math.max(Math.hypot(dx, dy), 20);
          if (dist < 180) {
            const mag = (1 - dist / 180) * 0.045 * b.mass;
            Matter.Body.applyForce(b, b.position, {
              x: (dx / dist) * mag,
              y: (dy / dist) * mag - 0.012 * b.mass,
            });
          }
        }
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown, { passive: true });
    canvas.addEventListener('pointerup', onPointerUp, { passive: true });

    const ro = createCanvasResizeObserver(() => {
      syncSize();
      mouse.pixelRatio = dpr;
      Matter.Composite.remove(engine.world, walls);
      walls = makeWalls();
      Matter.Composite.add(engine.world, walls);
    });
    ro.observe(host);

    let isVisible = true;
    const io = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.02 }
    );
    io.observe(host);

    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!isVisible) {
        lastTime = now;
        return;
      }

      const delta = Math.min(now - lastTime, 33.3);
      lastTime = now;
      Matter.Engine.update(engine, delta);

      ctx.clearRect(0, 0, width, height);

      // Subtle optical basin lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
      ctx.lineWidth = 1;
      for (let gx = 40; gx < width; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 40; gy < height; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Draw accent glass spheres
      for (const orb of orbs) {
        const rad = orb.circleRadius ?? 18;
        ctx.save();
        ctx.translate(orb.position.x, orb.position.y);
        const grad = ctx.createRadialGradient(-rad * 0.35, -rad * 0.35, 2, 0, 0, rad);
        grad.addColorStop(0, 'rgba(255,255,255,0.6)');
        grad.addColorStop(0.5, 'rgba(125,211,252,0.22)');
        grad.addColorStop(1, 'rgba(192,132,252,0.08)');
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.stroke();
        ctx.restore();
      }

      // Draw interactive tech-stack capsules
      for (const b of capsules) {
        const meta = (b as unknown as { capMeta?: CapsuleMeta }).capMeta;
        if (!meta) continue;
        const active = meta.tech.id === selectedRef.current;

        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        ctx.rotate(b.angle);

        ctx.beginPath();
        ctx.roundRect(-meta.w / 2, -meta.h / 2, meta.w, meta.h, meta.h / 2);
        const grad = ctx.createLinearGradient(-meta.w / 2, -meta.h / 2, meta.w / 2, meta.h / 2);
        if (active) {
          grad.addColorStop(0, 'rgba(125, 211, 252, 0.38)');
          grad.addColorStop(1, 'rgba(192, 132, 252, 0.28)');
        } else {
          grad.addColorStop(0, `${meta.tintA}26`);
          grad.addColorStop(1, `${meta.tintB}1a`);
        }
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.lineWidth = active ? 1.6 : 1.1;
        ctx.strokeStyle = active ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.32)';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-meta.w / 2 + meta.h / 2, -meta.h / 2 + 2.5);
        ctx.lineTo(meta.w / 2 - meta.h / 2, -meta.h / 2 + 2.5);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = active ? '#ffffff' : 'rgba(241, 245, 249, 0.92)';
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.tech.name.split(' ')[0].toUpperCase(), 0, 0.5);
        ctx.restore();
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      rectCache.destroy();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      Matter.Composite.clear(engine.world, false);
      Matter.Engine.clear(engine);
      if (canvas.parentNode === host) host.removeChild(canvas);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-cursor="DRAG"
      className="relative h-[320px] w-full overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#060913]/90 sm:h-[360px]"
    />
  );
};
