import React, { useEffect, useRef } from 'react';

interface VelocityMarqueeProps {
  scrollVelocityRef: React.MutableRefObject<number>;
}

interface RibbonConfig {
  id: string;
  items: string[];
  baseSpeed: number;
  direction: 1 | -1;
  tiltDeg: number;
  topCss: string;
  topOrigin?: boolean;
  zIndex: number;
  bandClass: string;
  textClass: string;
  dotClass: string;
  perspectiveMult: number;
}

const RIBBONS: RibbonConfig[] = [
  {
    id: 'horizon-far',
    items: [
      'PMREM STUDIO ENVIRONMENT',
      'PHYSICAL TRANSMISSION IOR 1.56',
      'CHROMATIC DISPERSION 2.6',
      'FBM CAUSTIC SHADERS',
      'SUB-PIXEL RETINA PIPELINE',
    ],
    baseSpeed: 28,
    direction: 1,
    tiltDeg: -1.6,
    topCss: '44px',
    topOrigin: true,
    zIndex: 10,
    bandClass:
      'border-t border-sky-200/45 border-b border-white/[0.07] bg-[#070a13] py-2.5',
    textClass: 'font-mono-tech text-[10px] tracking-[0.26em] text-slate-300/90',
    dotClass: 'h-1 w-1 rounded-full bg-sky-300/60',
    perspectiveMult: 0.45,
  },
  {
    id: 'horizon-mid',
    items: [
      'THREE.JS · GLASS OBJECT',
      'NAVIER-STOKES FBO',
      '3D CYLINDRICAL PEEL',
      'PARTICLE SCROLL',
      'VORONOI SHATTER',
      'MATTER.JS PHYSICS',
    ],
    baseSpeed: 46,
    direction: -1,
    tiltDeg: 0.95,
    topCss: '36%',
    zIndex: 20,
    bandClass:
      'border-y border-white/[0.12] bg-[#090d18]/95 py-2.5 shadow-[0_10px_28px_rgba(0,0,0,0.55)]',
    textClass: 'font-mono-tech text-[11px] sm:text-xs tracking-[0.22em] text-slate-100',
    dotClass:
      'h-1.5 w-1.5 rounded-full bg-sky-300/75 shadow-[0_0_8px_rgba(125,211,252,0.75)]',
    perspectiveMult: 0.75,
  },
  {
    id: 'horizon-near',
    items: [
      'GSAP SCROLLTRIGGER',
      'LENIS INERTIA',
      'CRYO-PLASMA WRAP',
      'RG32F DISPLACEMENT GRID',
      'DOUBLE-LAYER LIQUID GLASS',
    ],
    baseSpeed: 58,
    direction: 1,
    tiltDeg: -1.85,
    topCss: '58%',
    zIndex: 25,
    bandClass:
      'border-y border-white/[0.09] bg-[#070a13]/92 py-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.65)]',
    textClass: 'font-mono-tech text-[11px] sm:text-xs tracking-[0.2em] text-sky-100/85',
    dotClass: 'h-1.5 w-1.5 rounded-full bg-violet-300/70',
    perspectiveMult: 0.95,
  },
  {
    id: 'diagonal-cross',
    items: [
      'REFRACTIVE LIQUID OPTICS',
      '120FPS ENGINEERING DETERMINISM',
      'LIN.OPTICS // STUDIO ARCHIVE',
      'SPATIAL WEBGL ARCHITECTURE',
    ],
    baseSpeed: 70,
    direction: -1,
    tiltDeg: 3.1,
    topCss: '65%',
    zIndex: 40,
    bandClass:
      'border-y border-sky-200/30 bg-[linear-gradient(90deg,rgba(10,16,32,0.96)_0%,rgba(16,25,48,0.96)_50%,rgba(10,16,32,0.96)_100%)] py-3 shadow-[0_18px_48px_rgba(0,0,0,0.88),0_0_24px_rgba(56,189,248,0.12)] backdrop-blur-md',
    textClass:
      'font-mono-tech text-[11px] sm:text-xs font-medium tracking-[0.24em] text-white',
    dotClass:
      'h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.85)]',
    perspectiveMult: 1.15,
  },
];

export const VelocityMarquee: React.FC<VelocityMarqueeProps> = ({ scrollVelocityRef }) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const offsets = RIBBONS.map((_, idx) => idx * 90);
    let smoothBend = 0;
    let raf = 0;
    let last = performance.now();
    let visible = true;

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.01 }
    );
    io.observe(stage);

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!visible) {
        last = now;
        return;
      }

      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const vel = scrollVelocityRef.current;
      const boost = Math.min(Math.abs(vel) * 14, 240);
      const scrollDirBias = vel < -0.5 ? -1 : 1;
      const skew = Math.max(-4.5, Math.min(4.5, vel * 0.35));
      const targetBend = Math.max(-9, Math.min(9, vel * 0.65));
      smoothBend += (targetBend - smoothBend) * (1 - Math.exp(-dt * 9));

      RIBBONS.forEach((ribbon, idx) => {
        const track = trackRefs.current[idx];
        if (!track) return;

        const dir = ribbon.direction * scrollDirBias;
        offsets[idx] += (ribbon.baseSpeed + boost) * dt * dir;

        const halfWidth = track.scrollWidth / 2 || 1;
        offsets[idx] = ((offsets[idx] % halfWidth) + halfWidth) % halfWidth;

        const bend = smoothBend * ribbon.perspectiveMult;
        track.style.transform = `perspective(900px) rotateX(${bend.toFixed(2)}deg) translate3d(-${offsets[idx].toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
      });
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [scrollVelocityRef]);

  return (
    <div
      ref={stageRef}
      className="relative h-[245px] w-full overflow-hidden border-b border-white/[0.08] bg-[#05060a] sm:h-[285px]"
    >
      {/* Subtle depth vignette inside spatial ribbon corridor */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_50%,rgba(56,189,248,0.05),transparent_72%)]"
      />

      {RIBBONS.map((ribbon, idx) => {
        const row = (
          <div className="flex shrink-0 items-center gap-6 pr-6">
            {ribbon.items.map((item, itemIdx) => (
              <React.Fragment key={item + itemIdx}>
                <span className={`${ribbon.textClass} whitespace-nowrap`}>{item}</span>
                <span className={`shrink-0 ${ribbon.dotClass}`} />
              </React.Fragment>
            ))}
          </div>
        );

        return (
          <div
            key={ribbon.id}
            style={{
              top: ribbon.topCss,
              transformOrigin: ribbon.topOrigin ? '50% 0%' : '50% 50%',
              zIndex: ribbon.zIndex,
              transform: `rotate(${ribbon.tiltDeg}deg)`,
            }}
            className={`absolute -left-[8%] w-[116%] overflow-hidden ${ribbon.bandClass}`}
          >
            <div
              ref={(el) => {
                trackRefs.current[idx] = el;
              }}
              className="flex w-max will-change-transform"
            >
              {row}
              {row}
            </div>
          </div>
        );
      })}
    </div>
  );
};
