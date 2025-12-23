
import React, { useState, useEffect } from 'react';
// fix: remove missing subMonths, startOfMonth, startOfWeek exports; add addDays
import { format, addMonths, addDays, endOfMonth, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface DatePickerProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

export const DatePicker: React.FC<DatePickerProps> = ({ currentDate, onDateSelect, onClose }) => {
  const [viewDate, setViewDate] = useState(currentDate);

  // Sync view date if external current date changes drastically (optional, mostly for init)
  useEffect(() => {
    setViewDate(currentDate);
  }, [currentDate]);

  // fix: use addMonths with negative value instead of subMonths
  const handlePrevMonth = () => setViewDate(addMonths(viewDate, -1));
  const handleNextMonth = () => setViewDate(addMonths(viewDate, 1));

  const handleDayClick = (day: Date) => {
    onDateSelect(day);
    onClose();
  };

  const handleJumpToToday = () => {
    const today = new Date();
    onDateSelect(today);
    onClose();
  };

  // fix: manual replacement for startOfMonth and startOfWeek
  const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const result = addDays(d, -diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const monthStart = getMonthStart(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = getWeekStart(monthStart);
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  return (
    <>
      {/* Invisible backdrop to handle click outside */}
      <div className="fixed inset-0 z-40" onClick={onClose}></div>

      {/* Calendar Popover */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-[320px] bg-white/95 backdrop-blur-xl border border-white/60 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] rounded-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200 select-none">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <button 
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          
          <span className="text-base font-bold text-slate-800 tracking-wide">
            {format(viewDate, 'yyyy年 M月')}
          </span>

          <button 
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-y-1">
          {days.map((day, idx) => {
            const isSelected = isSameDay(day, currentDate);
            const isCurrentMonth = isSameMonth(day, viewDate);
            const isTodayDate = isToday(day);

            return (
              <div key={idx} className="flex justify-center">
                <button
                  onClick={() => handleDayClick(day)}
                  className={`
                    w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-all relative
                    ${isSelected 
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 hover:bg-black' 
                      : isTodayDate
                        ? 'text-blue-600 bg-blue-50 font-bold hover:bg-blue-100'
                        : isCurrentMonth 
                          ? 'text-slate-700 hover:bg-slate-100' 
                          : 'text-slate-300 hover:text-slate-500 hover:bg-slate-50'
                    }
                  `}
                >
                  {format(day, 'd')}
                  {isTodayDate && !isSelected && (
                    <div className="absolute bottom-1.5 w-1 h-1 bg-blue-600 rounded-full"></div>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 mt-3 pt-3 flex justify-center">
           <button 
             onClick={handleJumpToToday}
             className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
           >
             回到今天
           </button>
        </div>
      </div>
    </>
  );
};
