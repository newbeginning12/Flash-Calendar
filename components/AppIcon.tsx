
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
          {/* Calendar Body: Clean white with very subtle metallic sheen at bottom */}
          <linearGradient id="cal_body" x1="60" y1="0" x2="60" y2="120" gradientUnits="userSpaceOnUse">
             <stop stopColor="#FFFFFF" />
             <stop offset="1" stopColor="#F1F5F9" />
          </linearGradient>

          {/* Header: Apple System Blue Gradient - Clean & Professional */}
          <linearGradient id="cal_header" x1="60" y1="0" x2="60" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>

          {/* Bolt: Dynamic Amber/Gold Gradient */}
          <linearGradient id="bolt_grad" x1="50" y1="30" x2="80" y2="100" gradientUnits="userSpaceOnUse">
             <stop stopColor="#FCD34D" /> 
             <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>

          {/* Soft Shadow for Bolt */}
          <filter id="bolt_shadow" x="-50%" y="-50%" width="200%" height="200%">
             <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
             <feOffset dx="0" dy="2" result="offsetblur" />
             <feFlood floodColor="#B45309" floodOpacity="0.15" />
             <feComposite in2="offsetblur" operator="in" />
             <feMerge>
               <feMergeNode />
               <feMergeNode in="SourceGraphic" />
             </feMerge>
          </filter>
        </defs>

        {/* Shape Container */}
        <g transform="translate(10, 10)">
            {/* Soft Paper Shadow */}
            <rect x="0" y="4" width="100" height="100" rx="22" fill="#000000" fillOpacity="0.08" />
            
            {/* Calendar Base */}
            <rect x="0" y="0" width="100" height="100" rx="22" fill="url(#cal_body)" />
            
            {/* Header Mask */}
            <path d="M 0 22 C 0 9.84974 9.84974 0 22 0 L 78 0 C 90.1503 0 100 9.84974 100 22 L 100 34 L 0 34 L 0 22 Z" fill="url(#cal_header)" />
            
            {/* Header Rings (Simulating metal binding) */}
            <circle cx="30" cy="11" r="3" fill="#FFFFFF" fillOpacity="0.3" />
            <circle cx="70" cy="11" r="3" fill="#FFFFFF" fillOpacity="0.3" />

            {/* Content Lines (Minimalist representation of tasks) */}
            <rect x="20" y="52" width="45" height="6" rx="3" fill="#E2E8F0" />
            <rect x="20" y="66" width="60" height="6" rx="3" fill="#E2E8F0" />
            <rect x="20" y="80" width="35" height="6" rx="3" fill="#E2E8F0" />

            {/* The Flash Bolt */}
            <g filter="url(#bolt_shadow)">
               <path 
                 d="M 72 34 L 50 64 L 62 64 L 52 92 L 86 54 L 70 54 L 78 34 Z" 
                 fill="url(#bolt_grad)" 
                 stroke="#FFFFFF" 
                 strokeWidth="3" 
                 strokeLinejoin="round" 
               />
            </g>
        </g>
      </svg>
    </div>
  );
};
