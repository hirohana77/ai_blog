import React, { useCallback, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { AnimatePresence, motion } from 'framer-motion';
import { PageRoute, PROJECTS, SITE_PROFILE } from './data/portfolio';
import { LiquidSvgDefs } from './components/LiquidSvgDefs';
import { AmbientLiquidCanvas, HeroSculptureShape } from './components/canvas/AmbientLiquidCanvas';
import { AsciifyBackgroundField } from './components/canvas/AsciifyBackgroundField';
import { LiquidNavigation } from './components/LiquidNavigation';
import { LiquidCursor } from './components/LiquidCursor';
import { PreloaderCurtain } from './components/PreloaderCurtain';
import { PageTransitionOverlay } from './components/PageTransitionOverlay';
import { CommandPalette } from './components/CommandPalette';
import { ScrollProgressBeam } from './components/ScrollProgressBeam';
import { FooterDisplacementBanner } from './components/canvas/FooterDisplacementBanner';
import { HomeView } from './views/HomeView';
import { WorksView } from './views/WorksView';
import { ProjectDetailView } from './views/ProjectDetailView';
import { LabView } from './views/LabView';
import { AboutView } from './views/AboutView';

gsap.registerPlugin(ScrollTrigger);

interface RouteState {
  route: PageRoute;
  slug: string;
}

function parseHash(): RouteState {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash || hash === '/') return { route: 'home', slug: '' };
  if (hash === 'works') return { route: 'works', slug: '' };
  if (hash.startsWith('works/')) {
    const slug = hash.slice('works/'.length);
    return { route: 'project', slug: slug || PROJECTS[0].slug };
  }
  if (hash === 'lab') return { route: 'lab', slug: '' };
  if (hash === 'about') return { route: 'about', slug: '' };
  return { route: 'home', slug: '' };
}

function toHash(route: PageRoute, slug = ''): string {
  if (route === 'home') return '#/';
  if (route === 'works') return '#/works';
  if (route === 'project') return `#/works/${slug || PROJECTS[0].slug}`;
  if (route === 'lab') return '#/lab';
  return '#/about';
}

export const App: React.FC = () => {
  const initial = parseHash();
  const [routeState, setRouteState] = useState<RouteState>(initial);
  const [pendingRoute, setPendingRoute] = useState<PageRoute>(initial.route);
  const [transitionTitle, setTransitionTitle] = useState<string | undefined>(undefined);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [ready, setReady] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [fps, setFps] = useState(60);
  const [heroShape, setHeroShape] = useState<HeroSculptureShape>('crystal');

  const scrollProgressRef = useRef(0);
  const scrollVelocityRef = useRef(0);
  const lenisRef = useRef<Lenis | null>(null);
  const transitionTimerRef = useRef<number | null>(null);

  // Initialize Lenis inertial smooth scroll synced with GSAP ScrollTrigger & WebGL uniforms
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      const onScrollNative = () => {
        const docH = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        scrollProgressRef.current = window.scrollY / docH;
      };
      window.addEventListener('scroll', onScrollNative, { passive: true });
      return () => window.removeEventListener('scroll', onScrollNative);
    }

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    lenis.on('scroll', (e: { progress: number; velocity: number }) => {
      scrollProgressRef.current = Number.isFinite(e.progress) ? e.progress : 0;
      scrollVelocityRef.current = Number.isFinite(e.velocity) ? e.velocity : 0;
      ScrollTrigger.update();
    });

    const onNativeScroll = () => {
      const docH = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      scrollProgressRef.current = window.scrollY / docH;
    };
    window.addEventListener('scroll', onNativeScroll, { passive: true });

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      window.removeEventListener('scroll', onNativeScroll);
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Global Cmd/Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navigate = useCallback(
    (targetRoute: PageRoute, slug = '', pushHash = true) => {
      if (targetRoute === routeState.route && slug === routeState.slug) {
        lenisRef.current?.scrollTo(0);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }

      const targetProject =
        targetRoute === 'project' ? PROJECTS.find((p) => p.slug === slug) : undefined;
      setPendingRoute(targetRoute);
      setTransitionTitle(targetProject?.title);
      setIsTransitioning(true);

      if (pushHash) {
        window.location.hash = toHash(targetRoute, slug);
      }

      transitionTimerRef.current = window.setTimeout(() => {
        setRouteState({ route: targetRoute, slug });
        if (lenisRef.current) {
          lenisRef.current.scrollTo(0, { immediate: true });
        } else {
          window.scrollTo(0, 0);
        }
        scrollProgressRef.current = 0;
        scrollVelocityRef.current = 0;
        ScrollTrigger.refresh();

        window.setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 240);
    },
    [routeState.route, routeState.slug]
  );

  // Sync browser back/forward hash changes
  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash();
      if (parsed.route !== routeState.route || parsed.slug !== routeState.slug) {
        navigate(parsed.route, parsed.slug, false);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [navigate, routeState.route, routeState.slug]);

  return (
    <div className="relative min-h-screen bg-[#05060a] text-[#f5f7ff]">
      <LiquidSvgDefs />

      {/* Persistent Global WebGL Liquid Glass Caustic + 3D Crystal Sculpture */}
      <AmbientLiquidCanvas
        route={routeState.route}
        heroShape={heroShape}
        scrollProgressRef={scrollProgressRef}
        scrollVelocityRef={scrollVelocityRef}
        onFpsSample={setFps}
      />

      {routeState.route !== 'home' && (
        <AsciifyBackgroundField
          className="fixed inset-0 z-0"
          scrollProgressRef={scrollProgressRef}
          scrollVelocityRef={scrollVelocityRef}
        />
      )}

      {/* Subtle Optical Texture Overlay */}
      <div
        aria-hidden="true"
        className="optical-grain pointer-events-none fixed inset-0 z-[1] opacity-40"
      />

      {/* Preloader Split Curtain */}
      <PreloaderCurtain onComplete={() => setReady(true)} />

      {/* Top Optical Scroll Progress Beam */}
      <ScrollProgressBeam scrollProgressRef={scrollProgressRef} />

      {/* Floating Liquid Glass Capsule Dock Navigation */}
      <LiquidNavigation
        route={routeState.route}
        fps={fps}
        onNavigate={(r) => navigate(r)}
        onOpenCommand={() => setCommandOpen(true)}
      />

      {/* Organic Liquid Page Transition Curtain */}
      <PageTransitionOverlay
        isTransitioning={isTransitioning}
        targetRoute={pendingRoute}
        customTitle={transitionTitle}
      />

      {/* Command Palette (⌘K) */}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        onNavigate={(r, s) => navigate(r, s ?? '')}
      />

      {/* Custom Desktop Optical Ring Cursor */}
      <LiquidCursor />

      {/* Main Page View Stage */}
      <main className="relative z-10 min-h-screen pb-16 md:pb-0">
        <AnimatePresence mode="sync">
          <motion.div
            key={`${routeState.route}-${routeState.slug}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, position: 'absolute', inset: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            {routeState.route === 'home' && (
              <HomeView
                ready={ready}
                heroShape={heroShape}
                onChangeHeroShape={setHeroShape}
                scrollVelocityRef={scrollVelocityRef}
                onNavigate={(r, s) => navigate(r, s ?? '')}
              />
            )}
            {routeState.route === 'works' && (
              <WorksView onNavigate={(r, s) => navigate(r, s ?? '')} />
            )}
            {routeState.route === 'project' && (
              <ProjectDetailView
                slug={routeState.slug || PROJECTS[0].slug}
                onNavigate={(r, s) => navigate(r, s ?? '')}
              />
            )}
            {routeState.route === 'lab' && (
              <LabView onNavigate={(r) => navigate(r)} />
            )}
            {routeState.route === 'about' && (
              <AboutView onNavigate={(r) => navigate(r)} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Deep Obsidian Footer Dock & Curtain-Revealed WebGL2 Displacement Wordmark */}
      <footer className="relative z-10 w-full bg-[#05060a]">
        {/* Deep Obsidian Multi-Column Dock */}
        <div className="relative w-full border-t border-white/[0.08] bg-gradient-to-b from-[#06070c] via-[#05060a] to-[#05060a]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent"
          />

          <div className="grid w-full grid-cols-1 gap-10 px-6 pt-14 pb-12 sm:px-10 md:grid-cols-12 lg:px-14">
            <div className="flex flex-col justify-between gap-6 md:col-span-5">
              <div>
                <div className="font-mono-tech text-[11px] tracking-[0.24em] text-slate-400">
                  04 // OPTICAL HORIZON
                </div>
                <div className="mt-3 flex items-center gap-2.5 font-mono-tech text-sm font-medium tracking-[0.2em] text-white">
                  <span className="h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_12px_rgba(147,197,253,0.75)]" />
                  <span>{SITE_PROFILE.brand}</span>
                </div>
                <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-400">
                  {SITE_PROFILE.ownerName} · {SITE_PROFILE.taglineZh}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {['Three.js', 'WebGL2 GLSL', 'Matter.js', 'GSAP + Lenis'].map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 font-mono-tech text-[10px] tracking-wider text-slate-400"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
              <div className="flex flex-col gap-2 text-xs">
                <span className="mb-1 font-mono-tech text-[10px] tracking-[0.22em] text-slate-500">
                  NAVIGATION
                </span>
                <button
                  type="button"
                  onClick={() => navigate('home')}
                  className="-mx-2.5 cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  概览 Index
                </button>
                <button
                  type="button"
                  onClick={() => navigate('works')}
                  className="-mx-2.5 cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  精选作品 Works
                </button>
                <button
                  type="button"
                  onClick={() => navigate('about')}
                  className="-mx-2.5 cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  关于与履历 About
                </button>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                <span className="mb-1 font-mono-tech text-[10px] tracking-[0.22em] text-slate-500">
                  CANVAS LAB
                </span>
                <button
                  type="button"
                  onClick={() => navigate('lab')}
                  className="-mx-2.5 cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  流体着色器 Fluid
                </button>
                <button
                  type="button"
                  onClick={() => navigate('lab')}
                  className="-mx-2.5 cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  3D 光学玻璃晶体
                </button>
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="-mx-2.5 cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-sky-300 transition hover:bg-sky-300/10 hover:text-sky-200"
                >
                  ⌘K 全局指令面板
                </button>
              </div>

              <div className="flex flex-col gap-2 text-xs">
                <span className="mb-1 font-mono-tech text-[10px] tracking-[0.22em] text-slate-500">
                  CONNECT
                </span>
                <a
                  href={`mailto:${SITE_PROFILE.email}`}
                  className="-mx-2.5 rounded-lg px-2.5 py-1.5 text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  {SITE_PROFILE.email}
                </a>
                <a
                  href={SITE_PROFILE.github}
                  target="_blank"
                  rel="noreferrer"
                  className="-mx-2.5 rounded-lg px-2.5 py-1.5 text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                >
                  GitHub ↗
                </a>
                <span className="-mx-2.5 px-2.5 py-1.5 text-slate-500">
                  {SITE_PROFILE.xHandle}
                </span>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] px-6 py-4 font-mono-tech text-[11px] tracking-wider text-slate-500 sm:px-10 lg:px-14">
            <span>
              © 2026 {SITE_PROFILE.brand} · {SITE_PROFILE.location}
            </span>
            <span className="hidden text-slate-400 sm:inline">
              SWEEP OR CLICK HORIZON TO DISPLACE GRID
            </span>
            <button
              type="button"
              onClick={() => {
                lenisRef.current?.scrollTo(0);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="liquid-glass-pill cursor-pointer inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[10px] tracking-widest text-slate-200 transition hover:border-white/30 hover:text-white"
            >
              <span>BACK TO TOP</span>
              <span aria-hidden="true">↑</span>
            </button>
          </div>
        </div>

        {/* Curtain-Revealed Monumental Full-Bleed WebGL2 Displacement Wordmark */}
        <FooterDisplacementBanner />

        {/* Mobile bottom floating tab bar clearance */}
        <div aria-hidden="true" className="h-20 w-full bg-[#05060a] md:hidden" />
      </footer>
    </div>
  );
};

export default App;
