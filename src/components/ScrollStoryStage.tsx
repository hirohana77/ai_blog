import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight } from 'lucide-react';
import { PageRoute, PreviewVisualMode } from '../data/portfolio';
import { ProjectPreviewCanvas } from './canvas/ProjectPreviewCanvas';

gsap.registerPlugin(ScrollTrigger);

interface ScrollStoryStageProps {
  onNavigate: (route: PageRoute, slug?: string) => void;
  scrollVelocityRef: React.MutableRefObject<number>;
}

interface StoryChapter {
  index: string;
  tag: string;
  title: string;
  summary: string;
  slug: string;
  client: string;
  metric: string;
  previewMode: PreviewVisualMode;
  accentFrom: string;
  accentTo: string;
}

const CHAPTERS: StoryChapter[] = [
  {
    index: '01',
    tag: 'OPTICAL PRISM',
    title: 'Aether OS Optical System',
    summary: '双层光学隔离折射架构与零模糊液态透镜系统。',
    slug: 'aether-os-liquid-glass',
    client: 'Aether Spatial Labs',
    metric: '120 fps',
    previewMode: 'refraction-prism',
    accentFrom: '#7dd3fc',
    accentTo: '#c084fc',
  },
  {
    index: '02',
    tag: 'CURL TOPOLOGY',
    title: 'Solaris Curl Symphony',
    summary: '65K GPU 旋度噪声星云与实时音频色散场映射。',
    slug: 'solaris-curl-symphony',
    client: 'Solaris Audio Research',
    metric: '65,536 pts',
    previewMode: 'curl-constellation',
    accentFrom: '#38bdf8',
    accentTo: '#f472b6',
  },
  {
    index: '03',
    tag: 'RIGID PHYSICS',
    title: 'Kinetix Glass Sandbox',
    summary: 'Matter.js 刚体碰撞动力学融合 HiDPI 光学焦散绘制。',
    slug: 'kinetix-physics-playground',
    client: 'Kinetix Interactive',
    metric: 'Sub-step 2x',
    previewMode: 'physics-capsules',
    accentFrom: '#a5f3fc',
    accentTo: '#fde68a',
  },
  {
    index: '04',
    tag: 'SPATIAL GRID',
    title: 'Prism Spatial Telemetry',
    summary: '拓扑向量场扭曲网格与高密度实时遥测交互界面。',
    slug: 'prism-spatial-grid',
    client: 'Prism Cloud Studio',
    metric: '18.4K verts',
    previewMode: 'spatial-grid',
    accentFrom: '#67e8f9',
    accentTo: '#818cf8',
  },
];

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Evaluates piecewise kinematics for a photo-print plate given signed stack offset `d = i - continuousIdx`:
 * - `d > 0` (upcoming plates): tightly folded into a shingled stack on the RIGHT side (`rotateY: -42deg .. -54deg`).
 * - `d ≈ 0` (active focus): stretches forward & across toward the reading plane while maintaining an angled fold (`rotateY: +15.5deg`, NEVER flat 0deg).
 * - `d < 0` (completed plates): stretches further and folds cleanly into the opposite LEFT depth layer (`rotateY: +38deg .. +50deg`).
 */
function evalFoldedPlatePose(d: number, stageWidth: number, vel: number, pointerX: number, pointerY: number) {
  const isCompact = stageWidth < 768;
  const xSpan = isCompact ? Math.max(stageWidth * 0.34, 118) : clamp(stageWidth * 0.25, 250, 390);
  const activeBiasX = isCompact ? -12 : -clamp(stageWidth * 0.085, 72, 132);

  let translateX = activeBiasX;
  let translateZ = 76;
  let rotateY = 15.5; // Intentionally folded angle at focus — never laid flat at 0deg
  let rotateX = 1.8;
  let rotateZ = -0.9;
  let scale = 1.0;
  let scaleX = 1.03;

  if (d >= 0) {
    // Unfolding from the RIGHT folded stack -> stretched focus plane
    const tFirst = smoothstep(0, 1, clamp(d, 0, 1));
    const tDeep = clamp(d - 1, 0, 2.5);

    // Elastic stretch peak during the unfold transition (d in 0.25..0.75)
    const unfoldStretch = Math.sin(Math.min(d, 1) * Math.PI) * 0.055;

    const rightStackBaseX = isCompact ? xSpan * 0.92 : xSpan * 0.98;
    const rightStepX = isCompact ? 30 : 58;

    translateX = lerp(activeBiasX, rightStackBaseX, tFirst) + tDeep * rightStepX;
    translateZ = lerp(76, -118, tFirst) - tDeep * 92;
    rotateY = lerp(15.5, -46, tFirst) - Math.min(tDeep, 2) * 4.2;
    rotateX = lerp(1.8, 4.2, tFirst) + Math.min(tDeep, 2) * 0.8;
    rotateZ = lerp(-0.9, 2.6, tFirst) + Math.min(tDeep, 2) * 0.6;
    scale = lerp(1.0, isCompact ? 0.84 : 0.88, tFirst) * Math.max(0.74, 1 - tDeep * 0.07);
    scaleX = lerp(1.03 + unfoldStretch, 0.78, tFirst) - Math.min(tDeep, 2) * 0.03;
  } else {
    // Stretching across from focus -> folding into the OPPOSITE LEFT depth layer
    const absD = -d;
    const tFirst = smoothstep(0, 1, clamp(absD, 0, 1));
    const tDeep = clamp(absD - 1, 0, 2.5);

    const stretchPull = Math.sin(Math.min(absD, 1) * Math.PI) * 0.06;
    const leftLayerBaseX = activeBiasX - (isCompact ? xSpan * 1.02 : xSpan * 0.96);
    const leftStepX = isCompact ? 34 : 66;

    translateX = lerp(activeBiasX, leftLayerBaseX, tFirst) - tDeep * leftStepX;
    translateZ = lerp(76, -138, tFirst) - tDeep * 96;
    rotateY = lerp(15.5, 41, tFirst) + Math.min(tDeep, 2) * 4.8;
    rotateX = lerp(1.8, -2.2, tFirst) - Math.min(tDeep, 2) * 0.7;
    rotateZ = lerp(-0.9, -3.1, tFirst) - Math.min(tDeep, 2) * 0.5;
    scale = lerp(1.0, isCompact ? 0.82 : 0.85, tFirst) * Math.max(0.72, 1 - tDeep * 0.07);
    scaleX = lerp(1.03 + stretchPull, 0.76, tFirst) - Math.min(tDeep, 2) * 0.03;
  }

  // Subtle kinetic response to scroll velocity and pointer tilt
  const velStretch = clamp(Math.abs(vel) * 0.00018, 0, 0.055);
  const velSwing = clamp(vel * 0.0045, -4.5, 4.5);
  const focusWeight = clamp(1 - Math.abs(d) * 0.65, 0.15, 1);

  rotateY += pointerX * 5.2 * focusWeight + velSwing;
  rotateX += -pointerY * 3.8 * focusWeight;
  scaleX += velStretch * focusWeight;

  // Monotonic depth ordering: active focused plate is always foremost, folded decks recede cleanly
  const zIndex = Math.round(100 - Math.abs(d) * 18);
  // 100% opaque cardstock for every visible plate in the exhibition; only gracefully fade far outliers
  const opacity = Math.abs(d) > 2.65 ? clamp(1 - (Math.abs(d) - 2.65) * 2.5, 0, 1) : 1;

  return {
    translateX,
    translateY: Math.abs(d) * (isCompact ? 4 : 6) - (1 - clamp(Math.abs(d), 0, 1)) * 4,
    translateZ,
    rotateX,
    rotateY,
    rotateZ,
    scale,
    scaleX,
    zIndex,
    opacity,
  };
}

export const ScrollStoryStage: React.FC<ScrollStoryStageProps> = ({
  onNavigate,
  scrollVelocityRef,
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef<number>(0);

  const [activeIndex, setActiveIndex] = useState(0);
  const stageWidthRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  const progressRef = useRef(0);
  const smoothProgressRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const triggerRef = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      stageWidthRef.current = el.clientWidth || window.innerWidth;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: 'top 76px',
      end: '+=240%',
      pin: true,
      scrub: 0.65,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        progressRef.current = self.progress;
      },
    });
    triggerRef.current = trigger;
    ScrollTrigger.refresh();

    let rafId = 0;
    const renderLoop = () => {
      const targetP = progressRef.current;
      smoothProgressRef.current += (targetP - smoothProgressRef.current) * 0.14;
      const p = smoothProgressRef.current;

      pointerRef.current.x += (pointerRef.current.tx - pointerRef.current.x) * 0.1;
      pointerRef.current.y += (pointerRef.current.ty - pointerRef.current.y) * 0.1;

      const totalSteps = CHAPTERS.length - 1;
      const continuousIdx = p * totalSteps;
      const nearest = Math.round(continuousIdx);
      if (nearest !== activeStepRef.current) {
        activeStepRef.current = nearest;
        setActiveIndex(nearest);
      }

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${Math.max(0.05, p)})`;
      }

      const vel = scrollVelocityRef.current || 0;
      const measuredW = stageRef.current?.clientWidth || stageWidthRef.current;

      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const d = i - continuousIdx;
        const pose = evalFoldedPlatePose(
          d,
          measuredW,
          vel,
          pointerRef.current.x,
          pointerRef.current.y
        );

        card.style.transform = `translate3d(${pose.translateX.toFixed(1)}px, ${pose.translateY.toFixed(
          1
        )}px, ${pose.translateZ.toFixed(1)}px) rotateX(${pose.rotateX.toFixed(
          2
        )}deg) rotateY(${pose.rotateY.toFixed(2)}deg) rotateZ(${pose.rotateZ.toFixed(
          2
        )}deg) scale(${pose.scale.toFixed(4)}) scaleX(${(pose.scaleX / pose.scale).toFixed(4)})`;
        card.style.zIndex = String(pose.zIndex);
        card.style.opacity = pose.opacity.toFixed(3);
        card.style.pointerEvents = pose.opacity > 0.35 ? 'auto' : 'none';
      });

      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(rafId);
      trigger.kill();
      triggerRef.current = null;
    };
  }, [scrollVelocityRef]);

  const handleStageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current.tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerRef.current.ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  };

  const handleStageMouseLeave = () => {
    pointerRef.current.tx = 0;
    pointerRef.current.ty = 0;
  };

  const jumpToChapter = (idx: number) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const targetProgress = idx / (CHAPTERS.length - 1);
    const targetY = trigger.start + (trigger.end - trigger.start) * targetProgress;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  const activeChapter = CHAPTERS[activeIndex] ?? CHAPTERS[0];

  return (
    <section
      ref={sectionRef}
      aria-label="滚轮驱动交互叙事舞台"
      className="relative w-full overflow-hidden border-y border-white/[0.08] bg-transparent py-7 sm:py-10"
    >
      {/* Subtle dark edge vignette that keeps Asciify visible behind the deck while framing focal plates */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_45%_54%,rgba(5,6,10,0.08)_0%,rgba(5,6,10,0.46)_72%,rgba(5,6,10,0.68)_100%)]"
      />

      <div className="relative z-10 w-full px-5 sm:px-10 lg:px-16">
        {/* Minimal Editorial Top Rail */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4 sm:mb-7">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-[#7c89a6]">
              PLATES // FOLDED EXHIBITION
            </span>
            <span className="hidden h-3 w-px bg-white/[0.12] sm:block" />
            <span className="font-mono text-xs text-[#e8eeff]">
              {activeChapter.index} / 0{CHAPTERS.length} ·{' '}
              <span className="text-[#9aa7c4]">{activeChapter.tag}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border border-white/[0.1] bg-[#0a0d16]/90 p-1">
              {CHAPTERS.map((chap, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={chap.index}
                    type="button"
                    onClick={() => jumpToChapter(idx)}
                    className={`rounded-full px-3 py-1 font-mono text-[11px] transition-all duration-300 ${
                      isActive
                        ? 'bg-[#e6ecfa] font-semibold text-[#080a10] shadow-sm'
                        : 'text-[#8c98b5] hover:text-white'
                    }`}
                  >
                    {chap.index}
                  </button>
                );
              })}
            </div>

            <div className="hidden h-1 w-24 overflow-hidden rounded-full bg-white/[0.08] sm:block">
              <div
                ref={progressBarRef}
                className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#93c5fd] to-[#e0e7ff]"
                style={{ transform: 'scaleX(0.05)' }}
              />
            </div>
          </div>
        </div>

        {/* 3D Side-Folded Photo Deck -> Opposite-Layer Stretch Stage */}
        <div
          ref={stageRef}
          onMouseMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          className="relative flex h-[435px] w-full items-center justify-center sm:h-[490px] lg:h-[525px]"
          style={{ perspective: '1750px', perspectiveOrigin: '48% 48%' }}
        >
          {/* Ambient warm/cool darkroom architectural hairline underneath the folded deck */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[330px] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-55 blur-3xl transition-colors duration-700"
            style={{
              background: `radial-gradient(circle, ${activeChapter.accentFrom}18 0%, transparent 66%)`,
            }}
          />

          <div
            className="relative flex h-full w-full items-center justify-center"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {CHAPTERS.map((chapter, idx) => {
              const isFocus = idx === activeIndex;
              return (
                <div
                  key={chapter.slug}
                  ref={(el) => {
                    cardRefs.current[idx] = el;
                  }}
                  onClick={() => {
                    if (isFocus) {
                      onNavigate('project', chapter.slug);
                    } else {
                      jumpToChapter(idx);
                    }
                  }}
                  data-cursor={isFocus ? 'OPEN' : 'UNFOLD'}
                  className="group absolute w-[min(calc(100vw-52px),336px)] cursor-pointer select-none will-change-transform sm:w-[clamp(420px,42vw,520px)]"
                  style={{
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  {/* Soft-Rounded Opaque Satin-Matte Photo-Print Card */}
                  <div
                    className="relative overflow-hidden rounded-[2rem] border border-white/[0.14] bg-[linear-gradient(156deg,#1a2030_0%,#0f131f_44%,#090b12_100%)] p-3.5 sm:p-4"
                    style={{
                      boxShadow: isFocus
                        ? 'inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(0,0,0,0.7), 0 38px 86px -18px rgba(0,0,0,0.92), -14px 18px 40px rgba(0,0,0,0.65)'
                        : 'inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.72), 0 28px 64px -16px rgba(0,0,0,0.9)',
                    }}
                  >
                    {/* Subtle hinge-crease lighting along inner cardstock edge */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-white/[0.06] to-transparent"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-white/30 via-white/10 to-transparent"
                    />

                    {/* Recessed Photographic Window */}
                    <div className="relative h-[225px] w-full overflow-hidden rounded-[1.45rem] border border-white/[0.1] bg-[#06080f] shadow-[inset_0_2px_12px_rgba(0,0,0,0.85)] sm:h-[268px]">
                      <ProjectPreviewCanvas
                        mode={chapter.previewMode}
                        accentFrom={chapter.accentFrom}
                        accentTo={chapter.accentTo}
                        className="h-full w-full transition-transform duration-700 group-hover:scale-[1.03]"
                      />

                      {/* Soft darkroom vignette */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#080b12]/78 via-transparent to-[#080b12]/28"
                      />

                      {/* Tactile photo plate index stamp */}
                      <div className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2 rounded-full border border-white/15 bg-[#090c14]/90 px-3 py-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: chapter.accentFrom }}
                        />
                        <span className="font-mono text-[10px] tracking-[0.2em] text-[#eef2ff]">
                          PLATE {chapter.index}
                        </span>
                      </div>

                      <span className="pointer-events-none absolute bottom-3 right-3.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/65">
                        {chapter.metric}
                      </span>
                    </div>

                    {/* Lower Satin Photo-Print Mount Margin */}
                    <div className="mt-3.5 rounded-[1.25rem] border border-white/[0.07] bg-[#0b0e17] px-4 py-3.5 sm:px-5 sm:py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#7c88a6]">
                            {chapter.client} · {chapter.tag}
                          </div>
                          <div className="mt-1 truncate text-lg font-semibold tracking-tight text-[#f5f7ff] sm:text-xl">
                            {chapter.title}
                          </div>
                        </div>

                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.12] bg-[#151b2b] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#e6ecff] transition-colors duration-300 group-hover:border-white/30 group-hover:bg-[#e6ecff] group-hover:text-[#080a10]">
                          View
                          <ArrowUpRight className="h-3 w-3" />
                        </span>
                      </div>

                      <p className="mt-2 truncate text-xs leading-relaxed text-[#9ca9c6] sm:text-[13px]">
                        {chapter.summary}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Architectural Fold Hint */}
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[#6d7996]">
          <span>← OPPOSITE DEPTH LAYER (FOLDED)</span>
          <span className="hidden sm:inline">SCROLL TO UNFOLD &amp; STRETCH PLATES →</span>
        </div>
      </div>
    </section>
  );
};
