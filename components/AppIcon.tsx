
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
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full ${withShadow ? 'drop-shadow-md' : ''}`}
      >
        <defs>
          <linearGradient id="sparkle_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" /> {/* Indigo-400 */}
            <stop offset="50%" stopColor="#c084fc" /> {/* Purple-400 */}
            <stop offset="100%" stopColor="#f472b6" /> {/* Pink-400 */}
          </linearGradient>
        </defs>
        
        {/* Background: Dark Slate 900 to match app theme */}
        <rect 
          x="0" y="0" 
          width="512" height="512" 
          rx="110" ry="110" 
          fill="#0F172A" 
        />
        
        {/* The Intelligent Loop: Minimalist White Outline */}
        <path 
          d="M360 126H152C137.641 126 126 137.641 126 152V360C126 374.359 137.641 386 152 386H360C374.359 386 386 374.359 386 360V220" 
          stroke="white" 
          strokeWidth="36" 
          strokeLinecap="round" 
        />
        
        {/* The AI Sparkle: Completing the loop with magic */}
        <path 
          d="M430 115C430 115 430 150 410 170C390 190 355 190 355 190C355 190 390 190 410 210C430 230 430 265 430 265C430 265 430 230 450 210C470 190 505 190 505 190C505 190 470 190 450 170C430 150 430 115 430 115Z" 
          fill="url(#sparkle_gradient)" 
          transform="translate(-20, 10) scale(0.9)"
        />
      </svg>
    </div>
  );
};
