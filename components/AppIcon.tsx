
import React from 'react';

interface AppIconProps {
  size?: number;
  className?: string;
  withShadow?: boolean;
}

export const AppIcon: React.FC<AppIconProps> = ({ size = 32, className = "", withShadow = true }) => {
  return (
    <div 
      className={`relative flex items-center justify-center select-none ${className}`} 
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full ${withShadow ? 'drop-shadow-sm' : ''}`}
      >
        <defs>
          {/* Calendar Body Gradient: clean white/silver */}
          <linearGradient id="cal_body" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
             <stop stopColor="#FFFFFF" />
             <stop offset="1" stopColor="#F1F5F9" />
          </linearGradient>

          {/* Header Gradient: Vibrant Indigo/Purple (Tech/AI feel) */}
          <linearGradient id="cal_header" x1="20" y1="20" x2="100" y2="20" gradientUnits="userSpaceOnUse">
            <stop stopColor="#6366f1" />  {/* Indigo 500 */}
            <stop offset="1" stopColor="#8b5cf6" /> {/* Violet 500 */}
          </linearGradient>

          {/* Bolt Gradient: Electric Amber/Yellow */}
          <linearGradient id="bolt_grad" x1="50" y1="40" x2="70" y2="100" gradientUnits="userSpaceOnUse">
             <stop stopColor="#fbbf24" /> {/* Amber 400 */}
             <stop offset="0.5" stopColor="#f59e0b" /> {/* Amber 500 */}
             <stop offset="1" stopColor="#d97706" /> {/* Amber 600 */}
          </linearGradient>

          {/* Shadow for the bolt to lift it off the paper */}
          <filter id="bolt_glow" x="-50%" y="-50%" width="200%" height="200%">
             <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
             <feOffset dx="0" dy="1.5" result="offsetblur" />
             <feFlood floodColor="#B45309" floodOpacity="0.2" />
             <feComposite in2="offsetblur" operator="in" />
             <feMerge>
               <feMergeNode />
               <feMergeNode in="SourceGraphic" />
             </feMerge>
          </filter>
        </defs>

        {/* 1. Calendar Shape Container */}
        <g transform="translate(10, 10)">
            {/* Paper Shadow */}
            <rect x="2" y="4" width="100" height="100" rx="22" fill="#000" fillOpacity="0.08" />
            
            {/* Paper Body */}
            <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#cal_body)" stroke="#FFFFFF" strokeWidth="2" />
            
            {/* Header Area Masked by rounded corners */}
            <path d="M 0 22 C 0 9.84974 9.84974 0 22 0 L 78 0 C 90.1503 0 100 9.84974 100 22 L 100 32 L 0 32 L 0 22 Z" fill="url(#cal_header)" />
            
            {/* Calendar Rings (Subtle) */}
            <circle cx="28" cy="12" r="3" fill="rgba(255,255,255,0.4)" />
            <circle cx="72" cy="12" r="3" fill="rgba(255,255,255,0.4)" />

            {/* Grid Hints (Minimalist) */}
            <g fill="#E2E8F0">
               <rect x="18" y="48" width="12" height="12" rx="3" />
               <rect x="36" y="48" width="12" height="12" rx="3" />
               <rect x="54" y="48" width="12" height="12" rx="3" />
               <rect x="72" y="48" width="12" height="12" rx="3" />
               
               <rect x="18" y="66" width="12" height="12" rx="3" />
               <rect x="36" y="66" width="12" height="12" rx="3" />
               <rect x="54" y="66" width="12" height="12" rx="3" />
               <rect x="72" y="66" width="12" height="12" rx="3" />
            </g>

            {/* The Flash Bolt */}
            <g filter="url(#bolt_glow)">
               <path 
                 d="M 62 35 L 42 62 L 54 62 L 46 88 L 74 52 L 60 52 L 68 35 Z" 
                 fill="url(#bolt_grad)" 
                 stroke="white" 
                 strokeWidth="2" 
                 strokeLinejoin="round" 
               />
            </g>
        </g>
      </svg>
    </div>
  );
};
