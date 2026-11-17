import React, { useCallback, useEffect, useRef } from 'react';
import { createRectCache } from '../lib/canvasOptics';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'glass' | 'ghost';
  strength?: number;
  cursorLabel?: string;
}

/**
 * Tactile magnetic button with cached rect lookups & cursor-reactive liquid specular sheen.
 */
export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  variant = 'glass',
  strength = 0.28,
  cursorLabel = 'OPEN',
  className = '',
  onPointerMove,
  onPointerLeave,
  ...rest
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const rectCacheRef = useRef<ReturnType<typeof createRectCache> | null>(null);

  useEffect(() => {
    if (!btnRef.current) return;
    const cache = createRectCache(btnRef.current);
    rectCacheRef.current = cache;
    return () => {
      cache.destroy();
      rectCacheRef.current = null;
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const el = btnRef.current;
      if (el) {
        const rect = rectCacheRef.current?.current ?? el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = (x - rect.width / 2) * strength;
        const dy = (y - rect.height / 2) * strength;
        el.style.setProperty('--mx', `${x.toFixed(1)}px`);
        el.style.setProperty('--my', `${y.toFixed(1)}px`);
        el.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0)`;
      }
      onPointerMove?.(e);
    },
    [onPointerMove, strength]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const el = btnRef.current;
      if (el) {
        el.style.transform = 'translate3d(0px, 0px, 0)';
      }
      onPointerLeave?.(e);
    },
    [onPointerLeave]
  );

  const variantClasses = {
    primary:
      'bg-gradient-to-b from-white/95 via-sky-50/90 to-sky-100/85 text-[#060913] shadow-[0_10px_34px_rgba(125,211,252,0.28),inset_0_1px_0_#ffffff] hover:shadow-[0_14px_42px_rgba(125,211,252,0.42)] font-medium',
    glass:
      'liquid-glass-pill text-white/95 hover:text-white hover:border-white/30 font-medium',
    ghost:
      'border border-white/10 bg-white/[0.02] text-slate-300 hover:text-white hover:border-white/25 hover:bg-white/[0.06]',
  }[variant];

  return (
    <button
      ref={btnRef}
      data-cursor={cursorLabel}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`group relative inline-flex cursor-pointer items-center justify-center gap-2.5 overflow-hidden rounded-full px-5 py-2.5 text-sm tracking-wide transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out active:scale-[0.97] ${variantClasses} ${className}`}
      {...rest}
    >
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
};
