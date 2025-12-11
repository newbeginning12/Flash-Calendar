
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, getHours, getMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, ChevronDown, Check } from 'lucide-react';

interface DateTimePickerProps {
  label?: string;
  value: string; // ISO String
  onChange: (value: string) => void;
  minDate?: string;
  isError?: boolean;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); 

export const DateTimePicker: React.FC<DateTimePickerProps> = ({ label, value, onChange, minDate, isError }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; position: 'top' | 'bottom' } | null>(null);
  
  // Parse input value
  const dateValue = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState(dateValue);

  // Sync view date when modal opens or value changes
  useEffect(() => {
    if (isOpen) {
        setViewDate(dateValue);
    }
  }, [isOpen]);

  // Handle outside clicks and scrolls to close the modal
  useEffect(() => {
    const handleScroll = (e: Event) => {
        if (isOpen) {
            if (popupRef.current && popupRef.current.contains(e.target as Node)) {
                return;
            }
            setIsOpen(false);
        }
    };
    
    const handleResize = () => {
        if (isOpen) setIsOpen(false);
    };
    
    if (isOpen) {
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
    }
    return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const currentHour = getHours(dateValue);
  const currentMinute = Math.floor(getMinutes(dateValue) / 5) * 5;

  // Auto-scroll to selected time
  useEffect(() => {
      if (isOpen && position) {
          // Use setTimeout to ensure the DOM elements are rendered and painted inside the portal
          const timer = setTimeout(() => {
              const hourEl = document.getElementById(`dtp-hour-${currentHour}`);
              const minuteEl = document.getElementById(`dtp-minute-${currentMinute}`);
              
              if (hourEl) hourEl.scrollIntoView({ block: 'center', behavior: 'auto' });
              if (minuteEl) minuteEl.scrollIntoView({ block: 'center', behavior: 'auto' });
          }, 0);
          return () => clearTimeout(timer);
      }
      // We only want to scroll when opening the popup or when position stabilizes.
      // We DO NOT want to scroll when currentHour/currentMinute changes (user interaction).
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, position]);

  const calculatePosition = () => {
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const popupHeight = 380;
          const spaceBelow = window.innerHeight - rect.bottom;
          
          if (spaceBelow < popupHeight && rect.top > popupHeight) {
              setPosition({
                  top: rect.top - 8, // Position above
                  left: rect.left,
                  position: 'top'
              });
          } else {
              setPosition({
                  top: rect.bottom + 8, // Position below
                  left: rect.left,
                  position: 'bottom'
              });
          }
      }
  };

  useEffect(() => {
      if (isOpen) {
          calculatePosition();
      }
  }, [isOpen]);

  const handleDateSelect = (day: Date) => {
    const newDate = new Date(dateValue);
    newDate.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    onChange(newDate.toISOString());
  };

  const handleTimeChange = (type: 'hour' | 'minute', val: number) => {
    const newDate = new Date(dateValue);
    if (type === 'hour') {
        newDate.setHours(val);
    } else {
        newDate.setMinutes(val);
    }
    onChange(newDate.toISOString());
  };

  const handlePrevMonth = () => setViewDate(subMonths(viewDate, 1));
  const handleNextMonth = () => setViewDate(addMonths(viewDate, 1));
  const handleJumpToToday = () => {
      const now = new Date();
      onChange(now.toISOString());
      setViewDate(now);
  };

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="relative w-full" ref={containerRef}>
        {label && (
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                {label}
            </label>
        )}
        
        <button
            onClick={() => setIsOpen(!isOpen)}
            className={`
                w-full flex items-center justify-between bg-slate-50 border rounded-xl px-3 py-2.5 text-sm transition-all
                ${isError 
                    ? 'border-rose-300 bg-rose-50/30 text-rose-600 hover:border-rose-400' 
                    : isOpen 
                        ? 'border-blue-500 ring-1 ring-blue-500/20 shadow-sm bg-white' 
                        : 'border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                }
            `}
        >
            <div className="flex items-center gap-2 truncate">
                <CalendarIcon size={16} className={isError ? "text-rose-400 flex-shrink-0" : "text-slate-400 flex-shrink-0"} />
                <span className="font-medium font-mono tracking-tight text-slate-700 truncate">
                    {format(dateValue, 'yyyy-MM-dd')}
                </span>
                <span className="w-px h-3 bg-slate-200 mx-1 flex-shrink-0"></span>
                <span className="font-medium font-mono tracking-tight flex items-center gap-1 text-slate-600 truncate">
                     {format(dateValue, 'HH:mm')}
                </span>
            </div>
            <ChevronDown size={14} className={`text-slate-400 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && position && createPortal(
            <div className="fixed inset-0 z-[9999]">
                <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

                <div 
                    ref={popupRef}
                    className={`
                        absolute bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200
                        ${position.position === 'top' ? 'origin-bottom-left' : 'origin-top-left'}
                    `}
                    style={{ 
                        top: position.top, 
                        left: position.left,
                        transform: position.position === 'top' ? 'translateY(-100%)' : 'none',
                        width: '320px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-4 border-b border-slate-100 bg-white">
                        <div className="flex items-center justify-between mb-3">
                            <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm font-bold text-slate-800 tracking-wide">
                                {format(viewDate, 'yyyy年 M月')}
                            </span>
                            <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-7 mb-2">
                            {WEEKDAYS.map(d => (
                                <div key={d} className="text-center text-[10px] text-slate-400 font-medium">{d}</div>
                            ))}
                        </div>
                        
                        <div className="grid grid-cols-7 gap-1">
                            {days.map((day, idx) => {
                                const isCurrentMonth = isSameMonth(day, viewDate);
                                const isSelected = isSameDay(day, dateValue);
                                const isTodayDate = isSameDay(day, new Date());
                                
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleDateSelect(day)}
                                        disabled={minDate && day < new Date(minDate) && !isSameDay(day, new Date(minDate))}
                                        className={`
                                            h-8 w-8 rounded-full text-xs flex items-center justify-center transition-all relative
                                            ${!isCurrentMonth ? 'text-slate-300' : ''}
                                            ${isSelected 
                                                ? 'bg-slate-900 text-white font-bold shadow-md transform scale-105' 
                                                : isTodayDate 
                                                    ? 'text-blue-600 bg-blue-50 font-bold' 
                                                    : 'text-slate-700 hover:bg-slate-100'
                                            }
                                            ${(minDate && day < new Date(minDate) && !isSameDay(day, new Date(minDate))) ? 'opacity-30 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        {format(day, 'd')}
                                        {isTodayDate && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-blue-500 rounded-full"></div>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex h-40 bg-slate-50/50 border-t border-slate-100">
                        <div className="flex-1 border-r border-slate-100 overflow-hidden flex flex-col">
                            <div className="px-3 py-1.5 text-[10px] text-slate-400 font-bold uppercase bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 z-10 text-center">
                                小时
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                {HOURS.map(h => (
                                    <button
                                        key={h}
                                        id={`dtp-hour-${h}`}
                                        onClick={() => handleTimeChange('hour', h)}
                                        className={`w-full text-center py-1.5 text-xs transition-colors ${
                                            h === currentHour 
                                                ? 'bg-blue-100 text-blue-700 font-bold' 
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
                                        }`}
                                    >
                                        {h.toString().padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-hidden flex flex-col">
                            <div className="px-3 py-1.5 text-[10px] text-slate-400 font-bold uppercase bg-slate-50/95 backdrop-blur-sm border-b border-slate-100 z-10 text-center">
                                分钟
                            </div>
                            <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
                                {MINUTES.map(m => (
                                    <button
                                        key={m}
                                        id={`dtp-minute-${m}`}
                                        onClick={() => handleTimeChange('minute', m)}
                                        className={`w-full text-center py-1.5 text-xs transition-colors ${
                                            m === currentMinute 
                                                ? 'bg-blue-100 text-blue-700 font-bold' 
                                                : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'
                                        }`}
                                    >
                                        {m.toString().padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-3 bg-white border-t border-slate-100 flex justify-between items-center">
                         <button 
                            onClick={handleJumpToToday}
                            className="text-xs font-medium text-slate-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                         >
                            现在
                         </button>
                         <button 
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-1 bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm active:scale-95"
                         >
                            <Check size={12} />
                            确定
                         </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};
