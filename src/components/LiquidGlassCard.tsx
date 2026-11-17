import React, { useCallback, useEffect, useRef } from 'react';
import { createRectCache } from '../lib/canvasOptics';

interface LiquidGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  tilt?: boolean;
  maxTilt?: number;
  cursorLabel?: string;
  as?: 'div' | 'article' | 'section';
}

/**
 * High-craft Liquid Glass optical container:
 * - Uses cached bounding rect (zero layout thrash during pointer sweeps)
 * - Tracks pointer coordinates to illuminate prismatic rim & inner caustic sheen
 * - Optional subtle 3D perspective tilt with smooth CSS damping
 */
export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  className = '',
  tilt = false,
  maxTilt = 4.5,
  cursorLabel,
  as: Component = 'div',
  onPointerMove,
  onPointerLeave,
  ...rest
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const rectCacheRef = useRef<ReturnType<typeof createRectCache> | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cache = createRectCache(ref.current);
    rectCacheRef.current = cache;
    return () => {
      cache.destroy();
      rectCacheRef.current = null;
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (el) {
        const rect = rectCacheRef.current?.current ?? el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--mx', `${x.toFixed(1)}px`);
        el.style.setProperty('--my', `${y.toFixed(1)}px`);

        if (tilt && rect.width > 0 && rect.height > 0) {
          const rx = (y / rect.height - 0.5) * -maxTilt * 2;
          const ry = (x / rect.width - 0.5) * maxTilt * 2;
          el.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;
        }
      }
      onPointerMove?.(e);
    },
    [maxTilt, onPointerMove, tilt]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (el && tilt) {
        el.style.transform = 'perspective(1100px) rotateX(0deg) rotateY(0deg) translateZ(0)';
      }
      onPointerLeave?.(e);
    },
    [onPointerLeave, tilt]
  );

  return (
    <Component
      ref={ref}
      data-cursor={cursorLabel}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`liquid-glass rounded-3xl transition-transform duration-300 ease-out will-change-transform ${className}`}
      {...rest}
    >
      <div className="relative z-10 h-full w-full">{children}</div>
    </Component>
  );
};
