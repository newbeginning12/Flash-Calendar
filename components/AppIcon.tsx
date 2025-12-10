
import React from 'react';

interface AppIconProps {
  size?: number;
  className?: string;
  withShadow?: boolean;
}

export const AppIcon: React.FC<AppIconProps> = ({ size = 32, className = "", withShadow = true }) => {
  return (
    <div 
      className={`relative flex items-center justify-center ${className}`} 
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full ${withShadow ? 'drop-shadow-lg' : ''}`}
      >
        <defs>
          <linearGradient id="flash_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" /> {/* Amber-400 */}
            <stop offset="40%" stopColor="#f59e0b" /> {/* Amber-500 */}
            <stop offset="100%" stopColor="#3b82f6" /> {/* Blue-500 - Electric spark at end */}
          </linearGradient>
          
          <linearGradient id="icon_bg" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f3f4f6" />
          </linearGradient>
          
          <filter id="inner_glow" x="-20%" y="-20%" width="140%" height="140%">
             <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
             <feComposite in="blur" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowDiff"/>
             <feFlood floodColor="white" floodOpacity="0.5"/>
             <feComposite in2="shadowDiff" operator="in"/>
             <feComposite in2="SourceGraphic" operator="over" result="firstfilter"/>
             <feGaussianBlur in="firstfilter" stdDeviation="2" />
             <feOffset dx="0" dy="1" />
             <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadowDiff2"/>
             <feFlood floodColor="rgba(0,0,0,0.1)" floodOpacity="1"/>
             <feComposite in2="shadowDiff2" operator="in"/>
             <feComposite in2="firstfilter" operator="over"/>
          </filter>
        </defs>
        
        {/* Apple Style Squircle Background */}
        <rect 
            x="5" y="5" width="90" height="90" rx="22" 
            fill="url(#icon_bg)" 
            stroke="rgba(0,0,0,0.04)"
            strokeWidth="1"
        />
        
        {/* Flash/Spark Shape */}
        <g transform="translate(50, 50) scale(0.9)">
            <path 
                d="M-5 -28 C-5 -28 5 -5 20 0 C5 5 -5 28 -5 28 C-5 28 -15 5 -30 0 C-15 -5 -5 -28 -5 -28 Z" 
                fill="url(#flash_gradient)"
                className="drop-shadow-sm"
            />
            
            {/* Central Bright Spot */}
            <circle cx="-5" cy="0" r="4" fill="white" fillOpacity="0.9" filter="blur(1px)" />
        </g>
        
        {/* Gloss Reflection */}
        <path 
            d="M 15 15 Q 50 5 85 15 Q 50 40 15 15 Z" 
            fill="white" 
            fillOpacity="0.4"
            className="pointer-events-none"
        />
      </svg>
    </div>
  );
};
