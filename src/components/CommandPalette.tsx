import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Copy, Search, X } from 'lucide-react';
import { PageRoute, PROJECTS, SITE_PROFILE } from '../data/portfolio';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (route: PageRoute, slug?: string) => void;
}

interface CommandAction {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const actions = useMemo<CommandAction[]>(() => {
    const navActions: CommandAction[] = [
      {
        id: 'nav-home',
        group: 'PAGES',
        title: '概览首页 · Overview',
        subtitle: '3D 折射棱镜雕塑、精选作品与设计原则',
        run: () => {
          onNavigate('home');
          onClose();
        },
      },
      {
        id: 'nav-works',
        group: 'PAGES',
        title: '精选作品集 · Selected Works',
        subtitle: '浏览全部交互案例与光学界面系统',
        run: () => {
          onNavigate('works');
          onClose();
        },
      },
      {
        id: 'nav-lab',
        group: 'PAGES',
        title: 'Canvas 交互实验室 · Shader & Physics Lab',
        subtitle: '试玩 GLSL 水波、旋度粒子星云与 Matter.js 物理沙盒',
        run: () => {
          onNavigate('lab');
          onClose();
        },
      },
      {
        id: 'nav-about',
        group: 'PAGES',
        title: '关于与履历 · Profile & Craft',
        subtitle: '个人履历、开源技术栈矩阵与合作方式',
        run: () => {
          onNavigate('about');
          onClose();
        },
      },
    ];

    const projectActions: CommandAction[] = PROJECTS.map((p) => ({
      id: `proj-${p.slug}`,
      group: 'CASE STUDIES',
      title: `${p.index} · ${p.title}`,
      subtitle: p.subtitle,
      run: () => {
        onNavigate('project', p.slug);
        onClose();
      },
    }));

    const utilActions: CommandAction[] = [
      {
        id: 'copy-email',
        group: 'CONTACT',
        title: copied ? '已复制邮箱地址!' : `复制联系邮箱 · ${SITE_PROFILE.email}`,
        subtitle: '点击或回车复制到剪贴板',
        run: () => {
          navigator.clipboard?.writeText(SITE_PROFILE.email).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        },
      },
    ];

    return [...navActions, ...projectActions, ...utilActions];
  }, [copied, onClose, onNavigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.group.toLowerCase().includes(q)
    );
  }, [actions, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (filtered.length ? (i + 1) % filtered.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        filtered[selectedIndex].run();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtered, onClose, open, selectedIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="cmd-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[95] flex items-start justify-center bg-black/65 px-4 pt-20 backdrop-blur-md sm:pt-28"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="liquid-glass w-full max-w-xl overflow-hidden rounded-3xl"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <Search className="h-4 w-4 text-sky-300" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索页面、作品案例或 Canvas 实验室..."
                className="w-full bg-transparent text-sm text-white placeholder-slate-400 outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="关闭搜索"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-2.5">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">未找到匹配内容</div>
              ) : (
                filtered.map((item, idx) => {
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={item.run}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                        active ? 'bg-white/12 text-white' : 'text-slate-300 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-tech text-[10px] tracking-widest text-sky-300/80">
                            {item.group}
                          </span>
                          <span className="truncate text-sm font-medium text-white">
                            {item.title}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{item.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-slate-400">
                        {item.id === 'copy-email' ? (
                          copied ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-5 py-2.5 font-mono-tech text-[10px] text-slate-400">
              <span>↑↓ 选择 · ENTER 跳转</span>
              <span>ESC 关闭</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
