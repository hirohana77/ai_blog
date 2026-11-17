import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check, Copy, MapPin, Sparkles } from 'lucide-react';
import {
  OPEN_SOURCE_STACK,
  PageRoute,
  SITE_PROFILE,
  TIMELINE,
} from '../data/portfolio';
import { LiquidGlassCard } from '../components/LiquidGlassCard';
import { MagneticButton } from '../components/MagneticButton';

interface AboutViewProps {
  onNavigate: (route: PageRoute) => void;
}

const PHILOSOPHY_TABS = [
  {
    id: 'optics',
    label: '光学质感系统',
    title: '让玻璃真正拥有物理光线响应',
    body: '避免千篇一律的纯白半透明方块。每一块液态玻璃容器都引入方向性菲涅尔高光描边、指针位置动态焦散反光与微弱景深对比度控制，确保高雅视觉与极高文本可读性兼得。',
  },
  {
    id: 'motion',
    label: '多引擎动效协同',
    title: '页面转场与 WebGL 情绪同频共振',
    body: 'Lenis 惯性滚动速度直接输入 GLSL 着色器，GSAP ScrollTrigger 编排首屏与长页面视差节奏，Framer Motion 负责水滴态共享元素布局与液态帘幕页面切换。',
  },
  {
    id: 'perf',
    label: '工程性能确定性',
    title: '美观绝不以牺牲流畅帧率为代价',
    body: '严格限制设备像素比上限至 2x，离屏 Canvas 自动通过 IntersectionObserver 休眠，全站响应 prefers-reduced-motion 降级协议，确保跨端设备保持轻盈响应。',
  },
];

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState(PHILOSOPHY_TABS[0].id);
  const [copied, setCopied] = useState(false);

  const currentTab = PHILOSOPHY_TABS.find((t) => t.id === activeTab) ?? PHILOSOPHY_TABS[0];

  const handleCopy = () => {
    navigator.clipboard?.writeText(SITE_PROFILE.email).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative z-10 w-full bg-[#05060a]/30">
      {/* Full-Bleed Architectural Split Intro Header */}
      <div className="grid w-full grid-cols-1 border-b border-white/[0.08] pt-20 lg:grid-cols-12 lg:divide-x divide-white/[0.08]">
        <div className="px-5 py-12 sm:px-8 lg:col-span-8 lg:px-14 lg:py-16">
          <div className="font-mono-tech text-xs tracking-[0.24em] text-sky-300">
            04 // PROFILE & CRAFT
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
            {SITE_PROFILE.ownerName}
            <span className="font-serif-display ml-3 block font-normal italic text-sky-200 sm:inline">
              Design Technologist
            </span>
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {SITE_PROFILE.bio}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 font-mono-tech text-xs text-slate-300">
            <span className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5">
              <MapPin className="h-3.5 w-3.5 text-sky-300" />
              {SITE_PROFILE.location}
            </span>
            <span className="liquid-glass-pill inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-emerald-200">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
              {SITE_PROFILE.availability}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center bg-[#06080f]/60 p-6 sm:p-10 lg:col-span-4 lg:p-12">
          <LiquidGlassCard className="p-6" tilt maxTilt={3.5}>
            <div className="font-mono-tech text-[11px] tracking-widest text-sky-300">
              DIRECT CONTACT
            </div>
            <div className="mt-2 text-lg font-semibold text-white">{SITE_PROFILE.email}</div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              欢迎联系讨论旗舰产品官网、交互视觉系统研发或创意前端顾问合作。
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <MagneticButton variant="primary" cursorLabel="COPY" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                    <span>已复制邮箱</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>复制邮箱</span>
                  </>
                )}
              </MagneticButton>
              <MagneticButton variant="glass" onClick={() => onNavigate('lab')}>
                <span>体验 Lab</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </MagneticButton>
            </div>
          </LiquidGlassCard>
        </div>
      </div>

      {/* Full-Bleed Interactive Philosophy Section */}
      <div className="w-full border-b border-white/[0.08] px-5 py-12 sm:px-8 lg:px-14 lg:py-16">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
          <div className="font-mono-tech text-xs tracking-[0.22em] text-sky-300">
            DESIGN & ENGINEERING PHILOSOPHY
          </div>
          <div className="liquid-glass-pill inline-flex flex-wrap gap-1 rounded-full p-1">
            {PHILOSOPHY_TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    active ? 'text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="about-philosophy-pill"
                      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                      className="liquid-droplet absolute inset-0 rounded-full"
                    />
                  )}
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <motion.div
          key={currentTab.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="pt-8"
        >
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">{currentTab.title}</h2>
          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {currentTab.body}
          </p>
        </motion.div>
      </div>

      {/* Full-Bleed Experience Timeline */}
      <div className="w-full border-b border-white/[0.08]">
        <div className="border-b border-white/[0.08] px-5 py-6 font-mono-tech text-xs tracking-[0.24em] text-sky-300 sm:px-8 lg:px-14">
          CAREER TRAJECTORY
        </div>
        <div className="divide-y divide-white/[0.08]">
          {TIMELINE.map((entry) => (
            <div
              key={entry.period}
              className="grid w-full grid-cols-1 gap-6 px-5 py-8 transition-colors hover:bg-[#080b12] sm:px-8 md:grid-cols-12 lg:px-14 lg:py-10"
            >
              <div className="md:col-span-4">
                <div className="font-mono-tech text-xs text-sky-300">{entry.period}</div>
                <h3 className="mt-1.5 text-xl font-semibold text-white">{entry.role}</h3>
                <div className="mt-1 text-sm text-slate-300">
                  {entry.company} · {entry.location}
                </div>
              </div>
              <div className="md:col-span-8">
                <p className="max-w-4xl text-sm leading-relaxed text-slate-300">{entry.summary}</p>
                <ul className="mt-4 grid grid-cols-1 gap-2 text-xs text-slate-200 sm:grid-cols-2">
                  {entry.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-300" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full-Bleed Edge-to-Edge Stack Grid */}
      <div className="w-full">
        <div className="border-b border-white/[0.08] px-5 py-6 font-mono-tech text-xs tracking-[0.24em] text-sky-300 sm:px-8 lg:px-14">
          OPEN SOURCE TOOLKIT
        </div>
        <div className="grid w-full grid-cols-1 border-b border-white/[0.08] sm:grid-cols-2 lg:grid-cols-3 sm:divide-x divide-white/[0.08]">
          {OPEN_SOURCE_STACK.map((s) => (
            <div
              key={s.id}
              className="border-b border-white/[0.08] bg-[#05060a]/55 p-6 transition-colors hover:bg-[#080b12]/75 sm:p-8 lg:[&:nth-last-child(-n+3)]:border-b-0 lg:p-10"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{s.name}</span>
                <span className="font-mono-tech text-[10px] text-sky-300">{s.version}</span>
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-300">{s.role}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
