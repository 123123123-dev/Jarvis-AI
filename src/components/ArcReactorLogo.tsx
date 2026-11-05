import React from 'react';

interface ArcReactorProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  glow?: boolean;
}

export const ArcReactorLogo: React.FC<ArcReactorProps> = ({
  size = 'md',
  className = '',
  glow = true,
}) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const pixelMap = {
    sm: 32,
    md: 40,
    lg: 96,
    xl: 128,
  };

  const px = pixelMap[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${sizeMap[size]} ${className}`}
      aria-label="JARVIS Arc Reactor"
    >
      {/* Outer Cyan Radial Halo */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full bg-cyan-500/25 blur-md -z-10 animate-pulse"
          style={{ transform: 'scale(1.2)' }}
        />
      )}

      {/* SVG Arc Reactor Structure */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id={`reactorGlow_${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#0891b2" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#060b13" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient background */}
        <circle cx="50" cy="50" r="48" fill={`url(#reactorGlow_${size})`} />

        {/* Thin outer boundary */}
        <circle
          cx="50"
          cy="50"
          r="46"
          stroke="#0891b2"
          strokeWidth="1.2"
          strokeOpacity="0.5"
        />

        {/* Outer segmented ring (slow clockwise spin) */}
        <circle
          cx="50"
          cy="50"
          r="41"
          stroke="#22d3ee"
          strokeWidth="2.2"
          strokeDasharray="9 7"
          strokeLinecap="round"
          className="animate-spin-slow origin-center"
        />

        {/* Middle dash ring (counter-clockwise spin) */}
        <circle
          cx="50"
          cy="50"
          r="33"
          stroke="#06b6d4"
          strokeWidth="2.8"
          strokeDasharray="14 7"
          strokeOpacity="0.85"
          className="animate-spin-reverse-slow origin-center"
        />

        {/* Inner dotted tracking ring */}
        <circle
          cx="50"
          cy="50"
          r="26"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          strokeOpacity="0.7"
        />

        {/* Central Core Reactor Ring */}
        <circle
          cx="50"
          cy="50"
          r="20"
          fill="#082f49"
          stroke="#22d3ee"
          strokeWidth="2"
        />

        <circle
          cx="50"
          cy="50"
          r="16"
          fill="#0c4a6e"
          stroke="#38bdf8"
          strokeWidth="1"
          strokeOpacity="0.8"
        />

        {/* Center 'J' Letter */}
        <text
          x="50"
          y="56"
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={px > 60 ? '19' : '17'}
          fontWeight="900"
          fill="#f0f9ff"
          style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }}
        >
          J
        </text>

        {/* Cardinal tick dots */}
        <circle cx="50" cy="7" r="1.5" fill="#22d3ee" />
        <circle cx="50" cy="93" r="1.5" fill="#22d3ee" />
        <circle cx="7" cy="50" r="1.5" fill="#22d3ee" />
        <circle cx="93" cy="50" r="1.5" fill="#22d3ee" />
      </svg>
    </div>
  );
};
