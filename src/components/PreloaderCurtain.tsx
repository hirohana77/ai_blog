import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SITE_PROFILE } from '../data/portfolio';

interface PreloaderCurtainProps {
  onComplete: () => void;
}

export const PreloaderCurtain: React.FC<PreloaderCurtainProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(false);
      onComplete();
      return;
    }

    const start = performance.now();
    const duration = 900;
    let raf = 0;

    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(Math.round(eased * 100));
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setTimeout(() => {
          setVisible(false);
          onComplete();
        }, 160);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="preloader"
          initial={{ clipPath: 'inset(0% 0% 0% 0%)', opacity: 1 }}
          exit={{
            clipPath: 'inset(0% 0% 100% 0%)',
            opacity: 0.96,
            transition: { duration: 0.72, ease: [0.76, 0, 0.24, 1] },
          }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#05060a] px-6"
        >
          <div className="liquid-glass flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl px-8 py-9 text-center">
            <div className="font-mono-tech text-[11px] uppercase tracking-[0.26em] text-sky-200/80">
              OPTICAL CALIBRATION
            </div>
            <div className="font-serif-display text-3xl tracking-tight text-white">
              {SITE_PROFILE.brand}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-300 via-violet-300 to-amber-200 transition-[width] duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex w-full items-center justify-between font-mono-tech text-[11px] text-slate-400">
              <span>GLSL · MATTER · MOTION</span>
              <span className="text-white">{String(progress).padStart(3, '0')}%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
