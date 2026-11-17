import React, { useEffect, useRef } from 'react';

interface ScrollProgressBeamProps {
  scrollProgressRef: React.MutableRefObject<number>;
}

/**
 * Top optical liquid-prism beam tracking page scroll progress at 120fps without React re-renders.
 */
export const ScrollProgressBeam: React.FC<ScrollProgressBeamProps> = ({ scrollProgressRef }) => {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let smooth = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const target = Math.max(0, Math.min(1, scrollProgressRef.current));
      smooth += (target - smooth) * 0.22;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${smooth.toFixed(4)})`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scrollProgressRef]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-[2px] bg-white/[0.04]"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-sky-300 via-violet-300 to-amber-200 shadow-[0_0_12px_rgba(125,211,252,0.75)] will-change-transform"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
};
