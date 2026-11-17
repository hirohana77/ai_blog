import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { PageRoute, ProjectCategory, PROJECTS } from '../data/portfolio';
import { ProjectPreviewCanvas } from '../components/canvas/ProjectPreviewCanvas';

interface WorksViewProps {
  onNavigate: (route: PageRoute, slug?: string) => void;
}

const CATEGORIES: ProjectCategory[] = [
  'All',
  'WebGL & Shaders',
  'Physics & Canvas',
  'Design Systems',
];

export const WorksView: React.FC<WorksViewProps> = ({ onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory>('All');

  const filtered = useMemo(() => {
    if (selectedCategory === 'All') return PROJECTS;
    return PROJECTS.filter((p) => p.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="relative z-10 w-full bg-[#05060a]/30">
      {/* Full-Bleed Archive Header Band */}
      <div className="flex w-full flex-col justify-between gap-6 border-b border-white/[0.08] px-5 pb-10 pt-28 sm:px-8 md:flex-row md:items-end lg:px-14">
        <div>
          <div className="font-mono-tech text-xs tracking-[0.24em] text-sky-300">
            02 // SELECTED WORKS ARCHIVE
          </div>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            交互设计 &{' '}
            <span className="font-serif-display text-liquid-pearl font-normal italic">
              Shader Studies
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
            点击任意项目卡片，通过平滑液态转场进入完整工程架构与光学交互解析。
          </p>
        </div>

        {/* Filter Pills with Framer Motion layoutId Liquid Droplet */}
        <div className="liquid-glass-pill inline-flex flex-wrap gap-1 rounded-full p-1.5">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`relative cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active ? 'text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="works-filter-droplet"
                    transition={{ type: 'spring', stiffness: 360, damping: 28 }}
                    className="liquid-droplet absolute inset-0 rounded-full"
                  />
                )}
                <span className="relative z-10">{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edge-to-Edge Architectural Project Grid */}
      <motion.div
        layout
        className="grid w-full grid-cols-1 border-b border-white/[0.08] md:grid-cols-2 md:divide-x divide-white/[0.08]"
      >
        {filtered.map((project) => (
          <motion.div
            key={project.slug}
            layout
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            data-cursor="OPEN"
            onClick={() => onNavigate('project', project.slug)}
            className="group cursor-pointer border-b border-white/[0.08] bg-[#05060a]/58 p-6 transition-colors duration-300 hover:bg-[#080b13]/78 sm:p-10 md:[&:nth-last-child(-n+2)]:border-b-0 lg:p-14"
          >
            <div className="relative h-64 overflow-hidden rounded-2xl border border-white/10 sm:h-72">
              <ProjectPreviewCanvas
                mode={project.previewMode}
                accentFrom={project.accentFrom}
                accentTo={project.accentTo}
                className="transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="pointer-events-none absolute left-3.5 top-3.5 flex items-center gap-2">
                <span className="liquid-glass-pill rounded-full px-3 py-1 font-mono-tech text-[10px] tracking-widest text-white">
                  {project.index} · {project.category}
                </span>
              </div>
              <div className="pointer-events-none absolute right-3.5 top-3.5">
                <span className="liquid-glass-pill rounded-full px-2.5 py-1 font-mono-tech text-[10px] text-slate-200">
                  {project.year}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-semibold text-white transition-colors group-hover:text-sky-200">
                    {project.title}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-sky-200/85">
                    {project.subtitle}
                  </p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white transition group-hover:bg-white group-hover:text-slate-950">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {project.summary}
              </p>

              <div className="mt-5 flex flex-wrap gap-1.5">
                {project.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono-tech text-[10px] text-slate-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
