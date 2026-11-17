import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PageRoute, ROUTE_MOODS } from '../data/portfolio';

interface PageTransitionOverlayProps {
  isTransitioning: boolean;
  targetRoute: PageRoute;
  customTitle?: string;
}

/**
 * Organic Liquid Glass curtain bridging route switches with optical refraction feel
 * and clear chapter telemetry.
 */
export const PageTransitionOverlay: React.FC<PageTransitionOverlayProps> = ({
  isTransitioning,
  targetRoute,
  customTitle,
}) => {
  const mood = ROUTE_MOODS[targetRoute];

  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          key="route-curtain"
          initial={{ clipPath: 'circle(0% at 50% 100%)', opacity: 0.4 }}
          animate={{
            clipPath: 'circle(150% at 50% 50%)',
            opacity: 1,
            transition: { duration: 0.24, ease: [0.76, 0, 0.24, 1] },
          }}
          exit={{
            clipPath: 'circle(0% at 50% 0%)',
            opacity: 0,
            transition: { duration: 0.28, ease: [0.76, 0, 0.24, 1] },
          }}
          className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-[#060913]/88 backdrop-blur-2xl"
        >
          <div className="liquid-glass-pill flex flex-col items-center gap-2 rounded-3xl px-8 py-5 text-center">
            <span className="font-mono-tech text-[11px] tracking-[0.28em] text-sky-300/90">
              {mood.code} // {mood.label}
            </span>
            <span className="font-serif-display text-2xl tracking-wide text-white sm:text-3xl">
              {customTitle ?? mood.labelZh}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
