import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowUpRight, Check, Copy, FlaskConical, Layers, Sparkles } from 'lucide-react';
import {
  OPEN_SOURCE_STACK,
  OpenSourceTechItem,
  PageRoute,
  PROJECTS,
  SITE_PROFILE,
} from '../data/portfolio';
import { LiquidGlassCard } from '../components/LiquidGlassCard';
import { MagneticButton } from '../components/MagneticButton';
import { ProjectPreviewCanvas } from '../components/canvas/ProjectPreviewCanvas';
import { ParticleScrollManifesto } from '../components/canvas/ParticleScrollManifesto';
import { LiquidPeelCard } from '../components/canvas/LiquidPeelCard';
import { PlasmaGlassFrame } from '../components/canvas/PlasmaGlassFrame';
import { FlameWrap } from '../components/canvas/FlameWrap';
import { CapabilitiesPhysicsBasin } from '../components/canvas/CapabilitiesPhysicsBasin';
import { HeroSculptureShape } from '../components/canvas/AmbientLiquidCanvas';
import { VelocityMarquee } from '../components/VelocityMarquee';
import { ScrollStoryStage } from '../components/ScrollStoryStage';
import { ArchivePortalTransition } from '../components/canvas/ArchivePortalTransition';
import { AsciifyBackgroundField } from '../components/canvas/AsciifyBackgroundField';

gsap.registerPlugin(ScrollTrigger);

interface HomeViewProps {
  ready: boolean;
  heroShape: HeroSculptureShape;
  onChangeHeroShape: (shape: HeroSculptureShape) => void;
  scrollVelocityRef: React.MutableRefObject<number>;
  onNavigate: (route: PageRoute, slug?: string) => void;
}

const HERO_SHAPES: Array<{ id: HeroSculptureShape; label: string }> = [
  { id: 'crystal', label: 'Liquid' },
  { id: 'torusknot', label: 'Torus' },
  { id: 'prism', label: 'Prism' },
];

export const HomeView: React.FC<HomeViewProps> = ({
  ready,
  heroShape,
  onChangeHeroShape,
  scrollVelocityRef,
  onNavigate,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroStageRef = useRef<HTMLElement>(null);
  const heroInnerRef = useRef<HTMLDivElement>(null);
  const postHeroRef = useRef<HTMLDivElement>(null);
  const curtainMaskRef = useRef<HTMLDivElement>(null);
  const archiveSectionRef = useRef<HTMLElement>(null);
  const archiveHeaderRef = useRef<HTMLDivElement>(null);
  const archiveFlagshipRef = useRef<HTMLDivElement>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [selectedTech, setSelectedTech] = useState<OpenSourceTechItem>(OPEN_SOURCE_STACK[0]);

  useEffect(() => {
    if (!ready || !rootRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    let syncSlopeClip: (() => void) | undefined;
    const ctx = gsap.context(() => {
      gsap.from('.hero-stagger', {
        y: 34,
        opacity: 0,
        duration: 0.95,
        stagger: 0.09,
        ease: 'power3.out',
        clearProps: 'transform',
      });

      // Masked & overlapping transition: Hero recedes softly while Deep Obsidian curtain
      // rises cleanly along the tilted -1.6deg border of the upper horizon ribbon.
      const postHero = postHeroRef.current;
      const curtainMask = curtainMaskRef.current;
      const heroStage = heroStageRef.current;
      const heroInner = heroInnerRef.current;

      if (postHero && curtainMask && heroStage && heroInner) {
        const slopeTan = Math.tan((1.6 * Math.PI) / 180);
        syncSlopeClip = () => {
          const w = curtainMask.clientWidth || window.innerWidth;
          const halfRise = (w * 0.5) * slopeTan;
          const yLeft = Math.max(0, 44 + halfRise - 1);
          const yRight = Math.max(0, 44 - halfRise - 1);
          curtainMask.style.clipPath = `polygon(0px ${yLeft.toFixed(1)}px, 100% ${yRight.toFixed(1)}px, 100% 100%, 0px 100%)`;
        };
        syncSlopeClip();
        window.addEventListener('resize', syncSlopeClip, { passive: true });

        const updateOverlapMask = (p: number) => {
          const clamped = Math.max(0, Math.min(1, p));
          const ease = clamped * clamped * (3 - 2 * clamped);
          const scale = 1 - ease * 0.065;
          const shiftY = -ease * 38;
          const opacity = Math.max(0, 1 - ease * 1.12);
          heroInner.style.transform = `translate3d(0, ${shiftY.toFixed(1)}px, 0) scale(${scale.toFixed(4)})`;
          heroInner.style.opacity = opacity.toFixed(3);
          heroStage.style.pointerEvents = clamped >= 0.82 ? 'none' : 'auto';
        };

        updateOverlapMask(0);

        ScrollTrigger.create({
          trigger: postHero,
          start: 'top 95%',
          end: 'top 22%',
          scrub: true,
          onUpdate: (self) => updateOverlapMask(self.progress),
        });
      }

      const addSpringPop = (
        tl: gsap.core.Timeline,
        targets: gsap.TweenTarget,
        opts: {
          at?: number;
          y?: number;
          scale?: number;
          rotateX?: number;
          perspective?: number;
          duration?: number;
          opacityDuration?: number;
          stagger?: number;
          ease?: string;
        } = {}
      ) => {
        const {
          at = 0,
          y = 38,
          scale = 0.86,
          rotateX = 10,
          perspective = 1100,
          duration = 0.56,
          opacityDuration = 0.24,
          stagger = 0.065,
          ease = 'back.out(1.55)',
        } = opts;

        tl.fromTo(
          targets,
          {
            y,
            scale,
            rotateX,
            transformPerspective: perspective,
            transformOrigin: '50% 60%',
          },
          {
            y: 0,
            scale: 1,
            rotateX: 0,
            duration,
            stagger,
            ease,
            clearProps: 'transform',
          },
          at
        ).fromTo(
          targets,
          { opacity: 0 },
          {
            opacity: 1,
            duration: opacityDuration,
            stagger,
            ease: 'power2.out',
            clearProps: 'opacity',
          },
          at
        );
      };

      const createScrollSpringTimeline = (
        triggerEl: HTMLElement,
        start = 'top 88%',
        onComplete?: () => void
      ) => {
        let settled = false;
        const tl = gsap.timeline({
          onComplete: () => {
            settled = true;
            onComplete?.();
          },
          scrollTrigger: {
            trigger: triggerEl,
            start,
            once: true,
            onRefresh: (self) => {
              if (!settled && self.progress > 0 && tl.progress() === 0) {
                const rect = triggerEl.getBoundingClientRect();
                if (rect.bottom > 0 && rect.top <= window.innerHeight * 0.95) {
                  tl.play();
                } else {
                  settled = true;
                  tl.progress(1);
                }
              }
            },
          },
        });
        return tl;
      };

      // Staggered spring pop-out choreography for 01 // SELECTED ARCHIVE
      if (archiveHeaderRef.current) {
        const headerItems = archiveHeaderRef.current.querySelectorAll<HTMLElement>('.archive-header-pop');
        if (headerItems.length > 0) {
          const tlHeader = createScrollSpringTimeline(archiveHeaderRef.current, 'top 88%');
          addSpringPop(tlHeader, headerItems, {
            y: 36,
            scale: 0.86,
            rotateX: 11,
            duration: 0.56,
            opacityDuration: 0.24,
            stagger: 0.08,
            ease: 'back.out(1.6)',
          });
        }
      }

      if (archiveFlagshipRef.current) {
        const frameEl = archiveFlagshipRef.current.querySelector<HTMLElement>('.archive-flagship-frame');
        const popItems = archiveFlagshipRef.current.querySelectorAll<HTMLElement>('.archive-flagship-pop');
        const chipItems = archiveFlagshipRef.current.querySelectorAll<HTMLElement>('.archive-flagship-chip');

        const tlFlagship = createScrollSpringTimeline(archiveFlagshipRef.current, 'top 88%', () => {
          // Keep cached bounding rects aligned after 3D spring settle
          window.dispatchEvent(new Event('scroll'));
        });

        if (frameEl) {
          addSpringPop(tlFlagship, frameEl, {
            at: 0,
            y: 44,
            scale: 0.88,
            rotateX: 7,
            perspective: 1200,
            duration: 0.62,
            opacityDuration: 0.28,
            stagger: 0,
            ease: 'back.out(1.42)',
          });
        }

        if (popItems.length > 0) {
          addSpringPop(tlFlagship, popItems, {
            at: 0.1,
            y: 34,
            scale: 0.86,
            rotateX: 9,
            duration: 0.52,
            opacityDuration: 0.24,
            stagger: 0.065,
            ease: 'back.out(1.58)',
          });
        }

        if (chipItems.length > 0) {
          addSpringPop(tlFlagship, chipItems, {
            at: 0.34,
            y: 18,
            scale: 0.78,
            rotateX: 12,
            duration: 0.42,
            opacityDuration: 0.2,
            stagger: 0.045,
            ease: 'back.out(1.85)',
          });
        }
      }

      if (archiveSectionRef.current) {
        const isTwoCol = window.matchMedia('(min-width: 768px)').matches;
        const gridCards = archiveSectionRef.current.querySelectorAll<HTMLElement>('.archive-grid-card');

        gridCards.forEach((card, idx) => {
          const bodyEl = card.querySelector<HTMLElement>('.archive-card-body');
          const popItems = card.querySelectorAll<HTMLElement>('.archive-card-pop');
          const chipItems = card.querySelectorAll<HTMLElement>('.archive-card-chip');
          const baseDelay = isTwoCol ? (idx % 2) * 0.1 : 0;

          const tlCard = createScrollSpringTimeline(card, 'top 92%');

          if (bodyEl) {
            addSpringPop(tlCard, bodyEl, {
              at: baseDelay,
              y: 42,
              scale: 0.88,
              rotateX: 7,
              perspective: 1200,
              duration: 0.56,
              opacityDuration: 0.24,
              stagger: 0,
              ease: 'back.out(1.48)',
            });
          }

          if (popItems.length > 0) {
            addSpringPop(tlCard, popItems, {
              at: baseDelay + 0.08,
              y: 26,
              scale: 0.88,
              rotateX: 8,
              duration: 0.48,
              opacityDuration: 0.22,
              stagger: 0.055,
              ease: 'back.out(1.6)',
            });
          }

          if (chipItems.length > 0) {
            addSpringPop(tlCard, chipItems, {
              at: baseDelay + 0.22,
              y: 16,
              scale: 0.78,
              rotateX: 12,
              duration: 0.4,
              opacityDuration: 0.18,
              stagger: 0.04,
              ease: 'back.out(1.85)',
            });
          }
        });
      }

      gsap.utils.toArray<HTMLElement>('.reveal-section').forEach((el) => {
        gsap.from(el, {
          y: 36,
          opacity: 0,
          duration: 0.85,
          ease: 'power3.out',
          clearProps: 'transform',
          scrollTrigger: {
            trigger: el,
            start: 'top 86%',
            once: true,
          },
        });
      });

      ScrollTrigger.sort();
      ScrollTrigger.refresh();
    }, rootRef);

    return () => {
      if (syncSlopeClip) window.removeEventListener('resize', syncSlopeClip);
      ctx.revert();
    };
  }, [ready]);

  const handleCopyEmail = () => {
    navigator.clipboard?.writeText(SITE_PROFILE.email).catch(() => {});
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const featuredProjects = PROJECTS;

  return (
    <div ref={rootRef} className="relative w-full">
      {/* =====================================================================
          HERO STAGE (SCOPED TO 3D LIQUID CRYSTAL + CAUSTIC BACKGROUND)
         ===================================================================== */}
      <section
        ref={heroStageRef}
        className="relative z-10 flex min-h-[100svh] w-full items-center px-5 pb-24 pt-28 sm:px-8 lg:sticky lg:top-0 lg:px-14"
      >
        <div
          ref={heroInnerRef}
          className="grid w-full grid-cols-1 items-center gap-10 will-change-transform lg:grid-cols-12"
        >
        <div className="lg:col-span-7">
          <div className="hero-stagger mb-6 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            <span className="font-mono-tech text-[11px] tracking-[0.16em] text-slate-200">
              {SITE_PROFILE.availability}
            </span>
          </div>

          <h1 className="hero-stagger text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-[4.25rem]">
            Refracting{' '}
            <span className="font-serif-display text-liquid-pearl font-normal italic tracking-normal">
              Liquid Optics
            </span>
            <br />
            into{' '}
            <span className="font-serif-display font-normal italic text-sky-200">
              Kinetic
            </span>{' '}
            Web Craft.
          </h1>

          <p className="hero-stagger mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            你好，我是 <span className="font-medium text-white">{SITE_PROFILE.ownerName}</span> ——{' '}
            {SITE_PROFILE.taglineZh}。{SITE_PROFILE.bio}
          </p>

          <div className="hero-stagger mt-8 flex flex-wrap items-center gap-3.5">
            <MagneticButton
              variant="primary"
              cursorLabel="WORKS"
              onClick={() => onNavigate('works')}
              className="px-6 py-3"
            >
              <Layers className="h-4 w-4" />
              <span>探索精选作品</span>
              <ArrowUpRight className="h-4 w-4" />
            </MagneticButton>

            <MagneticButton
              variant="glass"
              cursorLabel="LAB"
              onClick={() => onNavigate('lab')}
              className="px-6 py-3"
            >
              <FlaskConical className="h-4 w-4 text-sky-300" />
              <span>进入 Canvas 交互实验室</span>
            </MagneticButton>
          </div>

          <div className="hero-stagger mt-12 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
            {[
              { label: 'OPTICAL SHADER', value: 'Three.js + GLSL' },
              { label: 'RIGID PHYSICS', value: 'Matter.js 2D' },
              { label: 'CHOREOGRAPHY', value: 'GSAP + Lenis' },
            ].map((item) => (
              <div key={item.label} className="liquid-glass rounded-2xl px-3.5 py-3 sm:px-4">
                <div className="font-mono-tech text-[10px] tracking-widest text-slate-400">
                  {item.label}
                </div>
                <div className="mt-1 text-xs font-medium text-white sm:text-sm">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Optical Stage Info Card with live Hero 3D Sculpture Form Switcher */}
        <div className="hero-stagger flex flex-col items-start justify-end lg:col-span-5 lg:items-end lg:self-end lg:pb-8">
          <LiquidGlassCard className="w-full max-w-sm p-5" tilt maxTilt={3.5}>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="font-mono-tech text-[11px] tracking-[0.2em] text-sky-200">
                OPTICAL FIELD // LIVE
              </span>
              <Sparkles className="h-4 w-4 text-sky-300" />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              悬浮的三维晶体采用物理透射色散与摄影棚 PMREM 灯光环境实时折射流场，可随时切换折射形态：
            </p>
            <div className="mt-3.5 flex items-center gap-1.5">
              {HERO_SHAPES.map((s) => {
                const active = heroShape === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChangeHeroShape(s.id)}
                    className={`cursor-pointer rounded-full px-3 py-1 font-mono-tech text-[10px] tracking-wider transition ${
                      active
                        ? 'liquid-droplet text-white'
                        : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between font-mono-tech text-[10px] text-slate-400">
              <span>{SITE_PROFILE.location}</span>
              <span className="text-sky-300">SCROLL ↓</span>
            </div>
          </LiquidGlassCard>
          </div>
        </div>
      </section>

      {/* =====================================================================
          MASKED + OVERLAPPING DEEP OBSIDIAN CURTAIN (TILTED HORIZON UPPER BORDER)
         ===================================================================== */}
      <div ref={postHeroRef} className="relative z-20 -mt-20 w-full">
        {/* Top border matches the tilted -1.6deg horizon ribbon so Hero slices away diagonally */}
        <div
          ref={curtainMaskRef}
          className="relative w-full bg-[#05060a] will-change-[clip-path]"
        >
          <VelocityMarquee scrollVelocityRef={scrollVelocityRef} />
        </div>

        {/* Full-Bleed Deep Obsidian Content Stage + Persistent Post-Hero WebGL2 Asciify Field */}
        <div className="relative w-full bg-[#05060a]">
          <div
            aria-hidden="true"
            className="pointer-events-none sticky top-0 z-0 -mb-[100svh] h-[100svh] w-full overflow-hidden"
          >
            <AsciifyBackgroundField
              className="h-full w-full"
              scrollVelocityRef={scrollVelocityRef}
            />
          </div>

          <div className="relative z-10 w-full">
            <div
              aria-hidden="true"
              className="pointer-events-none relative z-20 -mb-20 h-20 w-full bg-gradient-to-b from-[#05060a] to-transparent"
            />
            <ParticleScrollManifesto />

            {/* Scroll-Wheel-Driven Pinned Side-Folded Photo Cards Stage */}
            <ScrollStoryStage onNavigate={onNavigate} scrollVelocityRef={scrollVelocityRef} />

            {/* Full-Bleed Scroll-Driven Optical Portal Transition */}
            <ArchivePortalTransition scrollVelocityRef={scrollVelocityRef} />

            {/* =====================================================================
                SELECTED WORKS FULL-BLEED ARCHITECTURAL ARCHIVE
               ===================================================================== */}
            <section ref={archiveSectionRef} className="w-full">
            <div
              ref={archiveHeaderRef}
              className="flex w-full flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] px-5 pt-20 pb-10 sm:px-8 lg:px-14"
            >
              <div>
                <div className="archive-header-pop font-mono-tech text-xs tracking-[0.24em] text-sky-300">
                  01 // SELECTED ARCHIVE
                </div>
                <h2 className="archive-header-pop mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  精选交互作品
                  <span className="font-serif-display ml-3 font-normal italic text-slate-300">
                    & Optical Systems
                  </span>
                </h2>
              </div>

              <div className="archive-header-pop">
                <MagneticButton variant="glass" cursorLabel="ALL" onClick={() => onNavigate('works')}>
                  <span>查看全部 {PROJECTS.length} 个案例</span>
                  <ArrowUpRight className="h-4 w-4" />
                </MagneticButton>
              </div>
            </div>

            {/* Flagship #1 Full-Bleed Showcase */}
            {featuredProjects[0] && (() => {
              const project = featuredProjects[0];
              return (
                <div
                  ref={archiveFlagshipRef}
                  className="w-full border-b border-white/[0.08] px-5 py-10 sm:px-8 lg:px-14 lg:py-12"
                >
                  <div className="archive-flagship-frame">
                    <PlasmaGlassFrame>
                      <div
                        onClick={() => onNavigate('project', project.slug)}
                        className="group grid cursor-pointer gap-6 p-4 sm:p-6 lg:grid-cols-12 lg:items-center"
                      >
                        <div
                          className="archive-flagship-pop lg:col-span-7"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <LiquidPeelCard project={project} onNavigate={onNavigate} />
                        </div>

                        <div className="lg:col-span-5 lg:px-4">
                          <div className="archive-flagship-pop flex items-center justify-between font-mono-tech text-[11px] text-slate-400">
                            <span>{project.client}</span>
                            <span>{project.year}</span>
                          </div>

                          <h3 className="archive-flagship-pop mt-2.5 text-2xl font-semibold tracking-tight text-white transition-colors group-hover:text-sky-200 sm:text-3xl">
                            {project.title}
                          </h3>
                          <p className="archive-flagship-pop mt-2 text-sm font-medium text-sky-200/85">
                            {project.subtitle}
                          </p>
                          <p className="archive-flagship-pop mt-3 text-sm leading-relaxed text-slate-300">
                            {project.summary}
                          </p>

                          <div className="mt-5 flex flex-wrap gap-2">
                            {project.tags.map((tag) => (
                              <span
                                key={tag}
                                className="archive-flagship-chip rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono-tech text-[10px] text-slate-300"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          <div className="archive-flagship-pop mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                            <div className="flex gap-5">
                              {project.metrics.slice(0, 2).map((m) => (
                                <div key={m.label}>
                                  <div className="font-mono-tech text-[10px] text-slate-400">
                                    {m.label}
                                  </div>
                                  <div className="text-sm font-semibold text-white">{m.value}</div>
                                </div>
                              ))}
                            </div>
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:text-slate-950">
                              <ArrowUpRight className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </PlasmaGlassFrame>
                  </div>
                </div>
              );
            })()}

            {/* Projects #2-#5 Full-Bleed Architectural Hairline Grid */}
            <div className="grid w-full grid-cols-1 border-b border-white/[0.08] md:grid-cols-2 md:divide-x divide-white/[0.08]">
              {featuredProjects.slice(1).map((project) => (
                <div
                  key={project.slug}
                  data-cursor="VIEW"
                  onClick={() => onNavigate('project', project.slug)}
                  className="archive-grid-card group cursor-pointer border-b border-white/[0.08] bg-[#05060a]/58 backdrop-blur-[1px] p-6 transition-colors duration-300 hover:bg-[#080b13]/78 sm:p-10 md:[&:nth-last-child(-n+2)]:border-b-0 lg:p-14"
                >
                  <div className="archive-card-body">
                    <div className="archive-card-pop relative h-64 overflow-hidden rounded-2xl border border-white/10 sm:h-72">
                      <ProjectPreviewCanvas
                        mode={project.previewMode}
                        accentFrom={project.accentFrom}
                        accentTo={project.accentTo}
                        className="transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                      <div className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2">
                        <span className="archive-card-chip liquid-glass-pill rounded-full px-3 py-1 font-mono-tech text-[10px] tracking-widest text-white">
                          {project.index} · {project.category}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="archive-card-pop flex items-center justify-between font-mono-tech text-[11px] text-slate-400">
                        <span>{project.client}</span>
                        <span>{project.year}</span>
                      </div>

                      <h3 className="archive-card-pop mt-2.5 text-2xl font-semibold tracking-tight text-white transition-colors group-hover:text-sky-200">
                        {project.title}
                      </h3>
                      <p className="archive-card-pop mt-1.5 text-sm font-medium text-sky-200/85">
                        {project.subtitle}
                      </p>
                      <p className="archive-card-pop mt-3 text-sm leading-relaxed text-slate-300">
                        {project.summary}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {project.tags.map((tag) => (
                          <span
                            key={tag}
                            className="archive-card-chip rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono-tech text-[10px] text-slate-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="archive-card-pop mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                        <div className="flex gap-6">
                          {project.metrics.slice(0, 2).map((m) => (
                            <div key={m.label}>
                              <div className="font-mono-tech text-[10px] text-slate-400">
                                {m.label}
                              </div>
                              <div className="text-sm font-semibold text-white">{m.value}</div>
                            </div>
                          ))}
                        </div>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:bg-white group-hover:text-slate-950">
                          <ArrowUpRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* =====================================================================
              INTERACTIVE CAPABILITIES & STACK (FULL-BLEED SPLIT BASIN)
             ===================================================================== */}
          <section className="reveal-section w-full border-b border-white/[0.08]">
            <div className="flex w-full flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] px-5 pt-20 pb-8 sm:px-8 lg:px-14">
              <div>
                <div className="font-mono-tech text-xs tracking-[0.24em] text-sky-300">
                  02 // ENGINEERING & TOOLKIT
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  技术能力与开源底座
                </h2>
              </div>

              <MagneticButton variant="glass" cursorLabel="LAB" onClick={() => onNavigate('lab')}>
                <FlaskConical className="h-4 w-4 text-sky-300" />
                <span>体验全部 5 大 Canvas 引擎</span>
              </MagneticButton>
            </div>

            <div className="grid w-full grid-cols-1 lg:grid-cols-12 lg:items-center lg:divide-x lg:divide-white/[0.08]">
              <div className="flex flex-col justify-between px-5 py-10 sm:px-8 lg:col-span-5 lg:px-14 lg:py-14">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tech text-[11px] tracking-widest text-sky-300">
                      {selectedTech.category}
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 font-mono-tech text-[10px] text-slate-200">
                      {selectedTech.version}
                    </span>
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-white">{selectedTech.name}</h3>
                  <p className="mt-2.5 text-sm font-medium text-sky-100/90">
                    {selectedTech.role}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">
                    {selectedTech.description}
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-1.5 border-t border-white/10 pt-5">
                  {OPEN_SOURCE_STACK.map((item) => {
                    const active = item.id === selectedTech.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedTech(item)}
                        className={`cursor-pointer rounded-full px-3 py-1 font-mono-tech text-[11px] transition ${
                          active
                            ? 'liquid-droplet text-white'
                            : 'border border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:text-white'
                        }`}
                      >
                        {item.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 font-mono-tech text-[10px] text-slate-400">
                  点击或拖拽右侧物理容器中的液态玻璃胶囊即可切换查看技术职责
                </p>
              </div>

              <div className="bg-[#06080f]/45 p-5 sm:p-8 lg:col-span-7 lg:p-12">
                <CapabilitiesPhysicsBasin
                  selectedId={selectedTech.id}
                  onSelectTech={setSelectedTech}
                />
              </div>
            </div>
          </section>

          {/* =====================================================================
              EDITORIAL CONTACT FINALE (FULL-BLEED CRYO-PLASMA INVITATION)
             ===================================================================== */}
          <section className="reveal-section w-full px-5 pt-24 pb-16 sm:px-8 sm:pt-28 lg:px-14 lg:pt-32 lg:pb-20">
            <FlameWrap radius={32}>
              <div className="liquid-glass relative z-10 h-full w-full overflow-hidden rounded-[2rem]">
                <div className="p-8 sm:p-12 lg:p-14">
                  <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
                    <div className="max-w-3xl">
                      <div className="font-mono-tech text-xs tracking-[0.24em] text-sky-300">
                        03 // LET&apos;S COLLABORATE
                      </div>
                      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                        正在寻找兼具{' '}
                        <span className="font-serif-display text-liquid-pearl font-normal italic">
                          审美高度
                        </span>{' '}
                        与{' '}
                        <span className="font-serif-display font-normal italic text-sky-200">
                          工程确定性
                        </span>{' '}
                        的创意前端？
                      </h2>
                      <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
                        开放接受旗舰品牌官网、WebGL 交互产品、设计系统架构及独立创意开发合作。
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <MagneticButton
                        variant="primary"
                        cursorLabel="COPY"
                        onClick={handleCopyEmail}
                        className="px-6 py-3.5"
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-700" />
                            <span>已复制 {SITE_PROFILE.email}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            <span>{SITE_PROFILE.email}</span>
                          </>
                        )}
                      </MagneticButton>

                      <MagneticButton
                        variant="glass"
                        cursorLabel="ABOUT"
                        onClick={() => onNavigate('about')}
                        className="px-6 py-3.5"
                      >
                        <span>关于与履历</span>
                        <ArrowUpRight className="h-4 w-4" />
                      </MagneticButton>
                    </div>
                  </div>
                </div>
              </div>
            </FlameWrap>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
