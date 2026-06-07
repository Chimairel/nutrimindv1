import React from 'react';

interface CalorieRingProps {
  consumed: number;
  target: number;
  className?: string;
}

export default function CalorieRing({ consumed, target, className = '' }: CalorieRingProps) {
  // Safe boundaries to prevent divisions by zero
  const safeTarget = Math.max(1, target);
  const percentage = Math.min(100, Math.round((consumed / safeTarget) * 100));
  const isOverLimit = consumed > safeTarget;

  // SVG Geometry metrics
  const radius = 80;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate stroke offsets
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`flex flex-col items-center justify-center relative select-none ${className}`}>
      {/* Glow shadow backdrop */}
      <div 
        className={`
          absolute h-36 w-36 rounded-full blur-[40px] opacity-15 transition-all duration-500 pointer-events-none
          ${isOverLimit ? 'bg-status-error-text' : 'bg-brand-green'}
        `} 
      />

      <svg className="w-56 h-56 transform -rotate-90 drop-shadow-2xl">
        {/* Track circle (Backdrop) */}
        <circle
          cx="112"
          cy="112"
          r={radius}
          stroke="#2a2a2e"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-40"
        />

        {/* Fill circle (Progress Indicator) */}
        <circle
          cx="112"
          cy="112"
          r={radius}
          stroke={isOverLimit ? '#f87171' : '#52B788'} // Red warning if over target, primary green otherwise
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out cursor-pointer"
        />
      </svg>

      {/* Internal Text Labels */}
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-[10px] tracking-widest font-extrabold text-brand-muted uppercase">
          Calories
        </span>
        <span 
          className={`
            text-3xl font-extrabold tracking-tight font-display mt-0.5 leading-none transition-colors duration-300
            ${isOverLimit ? 'text-status-error-text' : 'text-brand-text'}
          `}
        >
          {consumed.toLocaleString()}
        </span>
        <span className="text-[10px] text-brand-muted font-bold mt-1">
          of {safeTarget.toLocaleString()} kcal
        </span>
        
        {isOverLimit && (
          <span className="text-[9px] font-bold text-status-error-text bg-status-error-bg/10 border border-status-error-text/30 px-2 py-0.5 rounded-full mt-2 animate-pulse leading-none">
            LIMIT EXCEEDED
          </span>
        )}
      </div>
    </div>
  );
}
