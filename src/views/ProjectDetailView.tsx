import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, FlaskConical } from 'lucide-react';
import { PageRoute, PROJECTS } from '../data/portfolio';
import { MagneticButton } from '../components/MagneticButton';
import { ProjectPreviewCanvas } from '../components/canvas/ProjectPreviewCanvas';

interface ProjectDetailViewProps {
  slug: string;
  onNavigate: (route: PageRoute, slug?: string) => void;
}

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ slug, onNavigate }) => {
  const index = Math.max(
    PROJECTS.findIndex((p) => p.slug === slug),
    0
  );
  const project = PROJECTS[index];
  const nextProject = PROJECTS[(index + 1) % PROJECTS.length];

  return (
    <div className="relative z-10 w-full bg-[#05060a]/30">
      {/* Full-Bleed Top Back Navigation */}
      <div className="flex w-full flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] px-5 pb-6 pt-28 sm:px-8 lg:px-14">
        <MagneticButton
          variant="glass"
          cursorLabel="BACK"
          onClick={() => onNavigate('works')}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>返回作品列表</span>
        </MagneticButton>

        <div className="flex items-center gap-2">
          <MagneticButton
            variant="ghost"
            cursorLabel="LAB"
            onClick={() => onNavigate('lab')}
          >
            <FlaskConical className="h-4 w-4 text-sky-300" />
            <span>打开交互实验室</span>
          </MagneticButton>
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="liquid-glass-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-white transition hover:border-white/30"
          >
            <span>源码架构</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Full-Bleed Editorial Hero Header */}
      <div className="w-full px-5 py-10 sm:px-8 lg:px-14">
        <div className="font-mono-tech text-xs tracking-[0.24em] text-sky-300">
          CASE STUDY {project.index} // {project.category.toUpperCase()}
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          {project.title}
        </h1>
        <p className="mt-3 text-lg text-sky-100/90 sm:text-xl">{project.subtitle}</p>
      </div>

      {/* Edge-to-Edge Interactive Hero Canvas Viewport */}
      <div className="w-full border-y border-white/[0.08] bg-[#070910]">
        <div className="relative h-80 w-full overflow-hidden sm:h-[480px]">
          <ProjectPreviewCanvas
            mode={project.previewMode}
            accentFrom={project.accentFrom}
            accentTo={project.accentTo}
          />
          <div className="pointer-events-none absolute bottom-5 right-5 sm:right-8 lg:right-14">
            <span className="liquid-glass-pill rounded-full px-3.5 py-1.5 font-mono-tech text-[10px] tracking-widest text-slate-200">
              LIVE PROCEDURAL CANVAS · MOVE POINTER
            </span>
          </div>
        </div>
      </div>

      {/* Full-Bleed Metadata + Key Metrics */}
      <div className="grid w-full grid-cols-1 border-b border-white/[0.08] lg:grid-cols-12 lg:divide-x divide-white/[0.08]">
        <div className="p-6 sm:p-10 lg:col-span-6 lg:px-14">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="font-mono-tech text-[10px] tracking-widest text-slate-400">
                CLIENT
              </div>
              <div className="mt-1 text-sm font-medium text-white">{project.client}</div>
            </div>
            <div>
              <div className="font-mono-tech text-[10px] tracking-widest text-slate-400">
                ROLE
              </div>
              <div className="mt-1 text-sm font-medium text-white">{project.role}</div>
            </div>
            <div>
              <div className="font-mono-tech text-[10px] tracking-widest text-slate-400">
                YEAR
              </div>
              <div className="mt-1 text-sm font-medium text-white">{project.year}</div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
            {project.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono-tech text-[11px] text-slate-200"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="p-6 sm:p-10 lg:col-span-6 lg:px-14">
          <div className="font-mono-tech text-[10px] tracking-widest text-sky-300">
            OUTCOME TELEMETRY
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {project.metrics.map((m) => (
              <div key={m.label}>
                <div className="font-serif-display text-2xl text-white sm:text-4xl">
                  {m.value}
                </div>
                <div className="mt-1 font-mono-tech text-[10px] text-slate-400">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full-Bleed 3-Column Deep Breakdown */}
      <div className="grid w-full grid-cols-1 border-b border-white/[0.08] md:grid-cols-3 md:divide-x divide-white/[0.08]">
        <div className="border-b border-white/[0.08] p-6 sm:p-10 md:border-b-0 lg:px-14">
          <div className="font-mono-tech text-xs text-sky-300">01 // CHALLENGE</div>
          <h2 className="mt-2 text-lg font-semibold text-white">核心痛点与设计挑战</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{project.challenge}</p>
        </div>

        <div className="border-b border-white/[0.08] p-6 sm:p-10 md:border-b-0 lg:px-14">
          <div className="font-mono-tech text-xs text-violet-300">02 // ARCHITECTURE</div>
          <h2 className="mt-2 text-lg font-semibold text-white">光学材质与渲染架构</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{project.architecture}</p>
        </div>

        <div className="p-6 sm:p-10 lg:px-14">
          <div className="font-mono-tech text-xs text-amber-200">03 // MOTION CRAFT</div>
          <h2 className="mt-2 text-lg font-semibold text-white">页面衔接与动效细节</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{project.motionCraft}</p>
        </div>
      </div>

      {/* Full-Bleed Engineering Highlights */}
      <div className="w-full border-b border-white/[0.08] px-5 py-10 sm:px-8 lg:px-14">
        <div className="font-mono-tech text-xs tracking-widest text-sky-300">
          ENGINEERING HIGHLIGHTS
        </div>
        <ul className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {project.highlights.map((h) => (
            <li
              key={h}
              className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm leading-relaxed text-slate-200"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Full-Bleed Next Project Match-Cut Portal */}
      <div
        data-cursor="NEXT"
        onClick={() => onNavigate('project', nextProject.slug)}
        className="group w-full cursor-pointer bg-[#06080f]/60 px-5 py-12 transition-colors hover:bg-[#090c16]/80 sm:px-8 lg:px-14 lg:py-16"
      >
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="font-mono-tech text-xs tracking-[0.22em] text-sky-300">
              NEXT CASE STUDY // {nextProject.index}
            </div>
            <h3 className="mt-2 text-2xl font-semibold text-white transition-colors group-hover:text-sky-200 sm:text-4xl">
              {nextProject.title}
            </h3>
            <p className="mt-1.5 text-sm text-slate-300">{nextProject.subtitle}</p>
          </div>
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition group-hover:translate-x-1 group-hover:bg-white group-hover:text-slate-950">
            <ArrowRight className="h-5 w-5" />
          </span>
        </div>
      </div>
    </div>
  );
};
