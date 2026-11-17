import React from 'react';

/**
 * Global optical SVG filter definitions for subtle refractive edge displacement
 * and chromatic highlights without blurring readable foreground typography.
 */
export const LiquidSvgDefs: React.FC = () => {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed h-0 w-0 opacity-0"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="liquid-glass-refract" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.018"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2.5" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="18"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
};
