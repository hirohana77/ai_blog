import React from 'react';
import { motion } from 'framer-motion';
import { Command, Sparkles, Compass, Layers, FlaskConical, User } from 'lucide-react';
import { PageRoute, SITE_PROFILE } from '../data/portfolio';

interface LiquidNavigationProps {
  route: PageRoute;
  fps: number;
  onNavigate: (route: PageRoute) => void;
  onOpenCommand: () => void;
}

const NAV_ITEMS: Array<{
  id: Exclude<PageRoute, 'project'>;
  label: string;
  sub: string;
  icon: React.ReactNode;
}> = [
  { id: 'home', label: '概览', sub: 'Index', icon: <Compass className="h-3.5 w-3.5" /> },
  { id: 'works', label: '作品集', sub: 'Works', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'lab', label: 'Canvas 实验室', sub: 'Lab', icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { id: 'about', label: '关于', sub: 'About', icon: <User className="h-3.5 w-3.5" /> },
];

export const LiquidNavigation: React.FC<LiquidNavigationProps> = ({
  route,
  fps,
  onNavigate,
  onOpenCommand,
}) => {
  const activeTab: Exclude<PageRoute, 'project'> = route === 'project' ? 'works' : route;

  return (
    <>
      {/* Desktop & Top Floating Header (full-bleed aligned with architectural grid) */}
      <header className="pointer-events-none fixed inset-x-0 top-4 z-50 px-5 sm:px-8 lg:px-14">
        <div className="flex w-full items-center justify-between gap-3">
          {/* Brand Capsule */}
          <button
            type="button"
            data-cursor="HOME"
            onClick={() => onNavigate('home')}
            className="liquid-glass-pill pointer-events-auto flex cursor-pointer items-center gap-2.5 rounded-full px-4 py-2 text-left transition hover:border-white/30"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-300 opacity-65" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_10px_#7dd3fc]" />
            </span>
            <span className="font-mono-tech text-xs font-medium tracking-[0.2em] text-white">
              {SITE_PROFILE.brand}
            </span>
          </button>

          {/* Center Liquid Glass Morphing Capsule Nav */}
          <nav
            aria-label="主导航"
            className="liquid-glass-pill pointer-events-auto hidden items-center gap-1 rounded-full p-1.5 md:flex"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`relative cursor-pointer rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    isActive ? 'text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-droplet"
                      transition={{ type: 'spring', stiffness: 360, damping: 28, mass: 0.7 }}
                      className="liquid-droplet absolute inset-0 rounded-full"
                    />
                  )}
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right Telemetry + Command Trigger */}
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="liquid-glass-pill hidden items-center gap-2 rounded-full px-3.5 py-2 font-mono-tech text-[11px] text-slate-300 xl:flex">
              <Sparkles className="h-3 w-3 text-sky-300" />
              <span>{fps >= 20 ? `${fps} FPS` : 'GLSL ACTIVE'}</span>
            </div>

            <button
              type="button"
              data-cursor="MENU"
              onClick={onOpenCommand}
              className="liquid-glass-pill inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-xs text-slate-200 transition hover:border-white/30 hover:text-white"
              aria-label="打开命令面板"
            >
              <Command className="h-3.5 w-3.5 text-sky-200" />
              <span className="hidden sm:inline">索引</span>
              <kbd className="font-mono-tech rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Floating Liquid Dock */}
      <nav
        aria-label="移动端主导航"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center md:hidden"
      >
        <div className="liquid-glass-pill pointer-events-auto flex w-full max-w-md items-center justify-around rounded-full !bg-[#070a14]/92 p-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-full py-2 text-[11px] transition-colors ${
                  isActive ? 'text-white' : 'text-slate-300'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-droplet-mobile"
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    className="liquid-droplet absolute inset-0 rounded-full"
                  />
                )}
                <span className="relative z-10">{item.icon}</span>
                <span className="relative z-10">{item.sub}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
