
import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { WorkPlan, PlanStatus } from '../types';
import { format, addDays, isSameDay, getHours, getMinutes, differenceInMinutes, addMinutes, startOfWeek } from 'date-fns';
import { Edit2, Trash2, CheckCircle2, Circle, Plus, PlayCircle, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface WeeklyCalendarProps {
  currentDate: Date;
  plans: WorkPlan[];
  onPlanClick: (plan: WorkPlan) => void;
  onSlotClick: (date: Date) => void;
  onPlanUpdate: (plan: WorkPlan) => void;
  onDeletePlan: (id: string) => void;
  onDateSelect: (date: Date) => void;
  onDragCreate: (startDate: Date, durationMinutes: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_TO_SHOW = 7;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SIDEBAR_WIDTH = 64; 

// Zoom Constraints
const MIN_ROW_HEIGHT = 40;
const MAX_ROW_HEIGHT = 180;
const DEFAULT_ROW_HEIGHT = 48;

interface DragState {
  plan: WorkPlan;
  durationMinutes: number;
  offsetX: number; 
  offsetY: number;
  startX: number;
  startY: number;
  pointerX: number; 
  pointerY: number; 
  currentClientX: number; 
  currentClientY: number; 
  gridWidth: number; 
  isDragging: boolean;
  originalRowHeight: number; // Capture row height at start of drag
}

interface ContextMenuState {
  x: number;
  y: number;
  type: 'PLAN' | 'SLOT';
  plan?: WorkPlan;
  date?: Date;
}

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ 
  currentDate, 
  plans, 
  onPlanClick, 
  onSlotClick, 
  onPlanUpdate, 
  onDeletePlan, 
  onDateSelect,
  onDragCreate
}) => {
  const [now, setNow] = useState(new Date());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  
  // --- Zoom State ---
  const [rowHeight, setRowHeight] = useState<number>(() => {
    try {
        const saved = localStorage.getItem('zhihui_calendar_row_height');
        return saved ? Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, parseInt(saved))) : DEFAULT_ROW_HEIGHT;
    } catch {
        return DEFAULT_ROW_HEIGHT;
    }
  });

  // Keep a ref of current rowHeight for event handlers to access the latest value without re-binding
  const rowHeightRef = useRef(rowHeight);
  useEffect(() => { rowHeightRef.current = rowHeight; }, [rowHeight]);

  // Store the anchor point for zoom operations: { time (hours from 0:00), offset (pixels from top of viewport) }
  const zoomAnchorRef = useRef<{ time: number; offset: number } | null>(null);

  // Save zoom preference
  useEffect(() => {
    localStorage.setItem('zhihui_calendar_row_height', rowHeight.toString());
  }, [rowHeight]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Unified Zoom Handler
  // anchorY: relative Y position in the grid container (e.g., mouse position or center). If undefined, defaults to center.
  const handleZoom = useCallback((newHeight: number, anchorY?: number) => {
     const currentHeight = rowHeightRef.current;
     const clamped = Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, newHeight));
     
     if (clamped === currentHeight || !gridRef.current) return;
     
     const container = gridRef.current;
     let offset = anchorY;
     
     // If no specific anchor is provided (e.g. slider/button), use the center of the viewport
     if (offset === undefined) {
         offset = container.clientHeight / 2;
     }

     // Calculate the "Time" at the anchor point.
     // Formula: (ScrollTop + Offset) = TotalPixelsFromTop = Time * RowHeight
     // So: Time = (ScrollTop + Offset) / RowHeight
     const time = (container.scrollTop + offset) / currentHeight;
     
     // Store this anchor so we can restore it after the render updates the height
     zoomAnchorRef.current = { time, offset };
     
     setRowHeight(clamped);
  }, []);

  // Use Layout Effect to restore scroll position BEFORE the browser paints
  useLayoutEffect(() => {
     if (gridRef.current && zoomAnchorRef.current) {
         const { time, offset } = zoomAnchorRef.current;
         // Calculate new ScrollTop to keep the 'time' at the same 'offset'
         // NewScrollTop + Offset = Time * NewRowHeight
         const newScroll = time * rowHeight - offset;
         
         gridRef.current.scrollTop = newScroll;
         zoomAnchorRef.current = null;
     }
  }, [rowHeight]);

  // --- Wheel Zoom Logic ---
  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (!gridRef.current) return;

        // Calculate mouse position relative to the scrolling container
        const rect = gridRef.current.getBoundingClientRect();
        const mouseRelY = e.clientY - rect.top;
        const currentRH = rowHeightRef.current;
        
        const delta = e.deltaY > 0 ? -4 : 4;
        handleZoom(currentRH + delta, mouseRelY);
    }
  }, [handleZoom]);

  useEffect(() => {
      const el = gridRef.current;
      if (el) {
          el.addEventListener('wheel', handleWheel, { passive: false });
      }
      return () => {
          if (el) el.removeEventListener('wheel', handleWheel);
      }
  }, [handleWheel]);

  // Use reliable startOfWeek from date-fns (Monday start)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(weekStart, i));

  // --- Helper: Duration Display ---
  const getDurationString = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const diff = Math.abs(differenceInMinutes(end, start));
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    
    if (h > 0 && m > 0) return `${h}小时${m}分`;
    if (h > 0) return `${h}小时`;
    return `${m}分钟`;
  };

  // --- Layout Algorithm for Overlapping Events ---
  const calculateLayout = (dayPlans: WorkPlan[]) => {
    // 1. Sort by start time, then duration
    const sorted = [...dayPlans].sort((a, b) => {
        const startDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (startDiff !== 0) return startDiff;
        const durA = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
        const durB = new Date(b.endDate).getTime() - new Date(b.startDate).getTime();
        return durB - durA;
    });

    const layoutMap = new Map<string, { left: string; width: string }>();
    if (sorted.length === 0) return layoutMap;

    const clusters: WorkPlan[][] = [];
    let currentCluster: WorkPlan[] = [sorted[0]];
    let clusterEnd = new Date(sorted[0].endDate).getTime();

    for (let i = 1; i < sorted.length; i++) {
        const plan = sorted[i];
        const start = new Date(plan.startDate).getTime();
        const end = new Date(plan.endDate).getTime();

        if (start < clusterEnd) {
            currentCluster.push(plan);
            clusterEnd = Math.max(clusterEnd, end);
        } else {
            clusters.push(currentCluster);
            currentCluster = [plan];
            clusterEnd = end;
        }
    }
    clusters.push(currentCluster);

    clusters.forEach(cluster => {
        const columns: WorkPlan[][] = [];
        cluster.forEach(plan => {
            let placed = false;
            for (let i = 0; i < columns.length; i++) {
                const lastPlanInCol = columns[i][columns[i].length - 1];
                if (new Date(lastPlanInCol.endDate).getTime() <= new Date(plan.startDate).getTime()) {
                    columns[i].push(plan);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                columns.push([plan]);
            }
        });

        const count = columns.length;
        columns.forEach((col, colIndex) => {
            col.forEach(plan => {
                layoutMap.set(plan.id, {
                    left: `${(colIndex / count) * 100}%`,
                    width: `${(1 / count) * 100}%`
                });
            });
        });
    });

    return layoutMap;
  };

  // --- Auto Scroll Logic ---
  // We only run this when the currentDate changes to avoid fighting with user scrolling/zooming
  useEffect(() => {
    if (!gridRef.current) return;

    const isToday = isSameDay(currentDate, new Date());
    const selectedDateStr = format(currentDate, 'yyyy-MM-dd');
    const dayPlans = plans.filter(p => format(new Date(p.startDate), 'yyyy-MM-dd') === selectedDateStr);

    let targetMinutes = 8 * 60; // Default to 08:00

    if (dayPlans.length > 0) {
      if (isToday) {
        const now = new Date();
        const nowMinutes = getHours(now) * 60 + getMinutes(now);
        let closestPlan = dayPlans[0];
        let minDiff = Infinity;
        dayPlans.forEach(p => {
          const start = new Date(p.startDate);
          const startMins = getHours(start) * 60 + getMinutes(start);
          const diff = Math.abs(startMins - nowMinutes);
          if (diff < minDiff) {
            minDiff = diff;
            closestPlan = p;
          }
        });
        const start = new Date(closestPlan.startDate);
        targetMinutes = getHours(start) * 60 + getMinutes(start);
      } else {
        const sorted = [...dayPlans].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
        const start = new Date(sorted[0].startDate);
        targetMinutes = getHours(start) * 60 + getMinutes(start);
      }
    } else if (isToday) {
        const now = new Date();
        targetMinutes = getHours(now) * 60 + getMinutes(now);
    }

    const top = (targetMinutes / 60) * rowHeight;
    const padding = rowHeight; // One hour padding
    
    // Only scroll if we haven't scrolled manually yet (simplification: actually we scroll whenever date changes)
    // To prevent this from running on zoom, we must ensure it depends only on currentDate
    gridRef.current.scrollTo({
      top: Math.max(0, top - padding),
      behavior: 'smooth'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]); 

  // --- Drag & Drop (Internal Moving) Logic ---
  const handleMouseDown = (e: React.MouseEvent, plan: WorkPlan) => {
    if (e.button !== 0) return;

    e.stopPropagation();
    e.preventDefault();
    if (!gridRef.current) return;

    const eventEl = e.currentTarget as HTMLElement;
    const eventRect = eventEl.getBoundingClientRect();
    const gridRect = gridRef.current.getBoundingClientRect();
    
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const duration = differenceInMinutes(end, start);

    setDragState({
      plan,
      durationMinutes: duration,
      offsetX: e.clientX - eventRect.left,
      offsetY: e.clientY - eventRect.top,
      startX: e.clientX,
      startY: e.clientY,
      pointerX: e.clientX - gridRect.left,
      pointerY: e.clientY - gridRect.top + gridRef.current.scrollTop,
      currentClientX: e.clientX,
      currentClientY: e.clientY,
      gridWidth: gridRect.width,
      isDragging: false,
      originalRowHeight: rowHeight
    });
    
    setContextMenu(null);
  };

  const calculateSnap = (state: DragState, days: Date[], currentRH: number) => {
    const columnsWidth = state.gridWidth - SIDEBAR_WIDTH;
    const colWidth = columnsWidth / DAYS_TO_SHOW;
    const xInCols = Math.max(0, state.pointerX - SIDEBAR_WIDTH);
    const colIndex = Math.min(DAYS_TO_SHOW - 1, Math.floor(xInCols / colWidth));
    const snapDay = days[colIndex];

    const rawTop = state.pointerY - state.offsetY;
    const rawMinutes = (rawTop / currentRH) * 60;
    const snappedMinutes = Math.max(0, Math.round(rawMinutes / 15) * 15);
    
    const snapDate = new Date(snapDay);
    snapDate.setHours(0, 0, 0, 0);
    snapDate.setMinutes(snappedMinutes);

    return { snapDate, snapDay, colIndex, snappedMinutes };
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!gridRef.current) return;
      
      const gridRect = gridRef.current.getBoundingClientRect();
      const dist = Math.sqrt(Math.pow(e.clientX - dragState.startX, 2) + Math.pow(e.clientY - dragState.startY, 2));

      setDragState(prev => prev ? ({
        ...prev,
        pointerX: e.clientX - gridRect.left,
        pointerY: e.clientY - gridRect.top + gridRef.current.scrollTop,
        currentClientX: e.clientX,
        currentClientY: e.clientY,
        isDragging: prev.isDragging || dist > 3
      }) : null);
    };

    const handleMouseUp = () => {
      if (dragState) {
        if (!dragState.isDragging) {
          onPlanClick(dragState.plan);
        } else {
          // Use the row height from state or the one captured? 
          // Using current state is better for responsive updates
          const { snapDate } = calculateSnap(dragState, weekDays, rowHeight);
          const newStart = new Date(snapDate);
          const newEnd = addMinutes(newStart, dragState.durationMinutes);

          onPlanUpdate({
            ...dragState.plan,
            startDate: newStart.toISOString(),
            endDate: newEnd.toISOString()
          });
        }
        setDragState(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, weekDays, onPlanUpdate, onPlanClick, rowHeight]);

  // --- External Drag & Drop Logic (Smart Create) ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); 
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent, day: Date) => {
      e.preventDefault();
      try {
          const data = e.dataTransfer.getData('application/json');
          if (!data) return;
          
          const { type, minutes } = JSON.parse(data);
          
          if (type === 'PRESET_DURATION' && minutes) {
             const rect = e.currentTarget.getBoundingClientRect();
             const y = e.clientY - rect.top; 
             
             // Convert Y to minutes using dynamic rowHeight
             const rawMinutes = (y / rowHeight) * 60;
             const snappedMinutes = Math.floor(rawMinutes / 15) * 15;
             
             const startDate = new Date(day);
             startDate.setHours(0, 0, 0, 0);
             startDate.setMinutes(snappedMinutes);
             
             onDragCreate(startDate, minutes);
          }
      } catch (err) {
          console.error("Drop failed", err);
      }
  };

  // --- Context Menu Logic ---
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleClickOutside, true);
    return () => {
        window.removeEventListener('click', handleClickOutside);
        window.removeEventListener('scroll', handleClickOutside, true);
    };
  }, []);

  const handlePlanContextMenu = (e: React.MouseEvent, plan: WorkPlan) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'PLAN',
      plan
    });
  };

  const handleSlotContextMenu = (e: React.MouseEvent, day: Date) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Dynamic calculation
    const minutes = (y / rowHeight) * 60;
    const snappedMinutes = Math.floor(minutes / 15) * 15;
    
    const date = new Date(day);
    date.setHours(0, 0, 0, 0);
    date.setMinutes(snappedMinutes);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'SLOT',
      date
    });
  };

  const handleMenuAction = (action: string) => {
    if (!contextMenu) return;

    if (action === 'NEW' && contextMenu.date) {
      onSlotClick(contextMenu.date);
    }
    
    if (contextMenu.plan) {
      if (action === 'EDIT') {
        onPlanClick(contextMenu.plan);
      } else if (action === 'DELETE') {
        onDeletePlan(contextMenu.plan.id);
      } else if (action === 'TOGGLE_STATUS') {
        const newStatus = contextMenu.plan.status === PlanStatus.DONE ? PlanStatus.TODO : PlanStatus.DONE;
        onPlanUpdate({ ...contextMenu.plan, status: newStatus });
      }
    }
    setContextMenu(null);
  };

  // --- Rendering Helpers ---
  const getEventStyle = (plan: WorkPlan) => {
    const start = new Date(plan.startDate);
    const end = new Date(plan.endDate);
    const startMinutes = getHours(start) * 60 + getMinutes(start);
    const durationMinutes = differenceInMinutes(end, start);
    
    const top = (startMinutes / 60) * rowHeight; 
    const height = (durationMinutes / 60) * rowHeight;

    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
        purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
        orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    };
    
    // Check if height is too small for full details
    const isSmall = height < 30;

    return {
      top: `${top}px`,
      height: `${Math.max(height, 20)}px`, 
      // IMPORTANT: Removed 'transition-all' to prevent jitter during zoom. 
      // Added specific transitions for visual flair only.
      className: `absolute rounded-lg border px-1.5 ${isSmall ? 'py-0 flex items-center' : 'py-1'} text-xs font-medium cursor-grab active:cursor-grabbing select-none overflow-hidden transition-colors transition-shadow shadow-sm hover:z-20 hover:shadow-md ${colors[plan.color] || colors.blue}`
    };
  };

  const currentMinutes = getHours(now) * 60 + getMinutes(now);
  const currentTimeTop = (currentMinutes / 60) * rowHeight;

  let ghostData = null;
  if (dragState && dragState.isDragging) {
    const { snapDate, colIndex } = calculateSnap(dragState, weekDays, rowHeight);
    const startMinutes = getHours(snapDate) * 60 + getMinutes(snapDate);
    ghostData = {
        colIndex,
        top: (startMinutes / 60) * rowHeight,
        height: (dragState.durationMinutes / 60) * rowHeight,
        start: snapDate,
        end: addMinutes(snapDate, dragState.durationMinutes)
    };
  }

  const renderStatusIcon = (status: PlanStatus) => {
    switch (status) {
        case PlanStatus.DONE:
            return <CheckCircle2 size={12} className="flex-shrink-0 text-emerald-600 fill-emerald-50" strokeWidth={2.5} />;
        case PlanStatus.IN_PROGRESS:
            return <PlayCircle size={12} className="flex-shrink-0 text-blue-600 fill-blue-50" strokeWidth={2.5} />;
        case PlanStatus.TODO:
        default:
             return <Circle size={12} className="flex-shrink-0 text-slate-400" strokeWidth={2} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden relative group/calendar" onContextMenu={(e) => e.preventDefault()}>
      
      {/* Header */}
      <div className="flex border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="w-16 flex-shrink-0 border-r border-slate-50"></div> 
        <div className="flex flex-1">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, currentDate);
            const key = format(day, 'yyyy-MM-dd');

            return (
              <div 
                key={key} 
                className={`flex-1 py-4 flex flex-col items-center justify-center cursor-pointer group transition-colors ${
                    isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'
                }`}
                onClick={() => onDateSelect(day)}
              >
                <span className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                    isToday ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}>
                  {WEEKDAYS_ZH[day.getDay()]}
                </span>
                <div className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-all
                    ${isSelected 
                        ? (isToday ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-900 text-white shadow-md') 
                        : (isToday ? 'text-blue-600 bg-blue-50' : 'text-slate-800 group-hover:bg-slate-100')
                    }
                `}>
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-slate-50/20" ref={gridRef}>
        <div className="flex relative" style={{ minHeight: `${24 * rowHeight}px` }}>
          
          {/* Timeline Sidebar */}
          <div className="w-16 flex-shrink-0 border-r border-slate-100 bg-white sticky left-0 z-10 select-none">
            {HOURS.map((hour) => (
              <div key={hour} className="relative w-full" style={{ height: `${rowHeight}px` }}>
                <span className="absolute -top-2.5 right-3 text-[10px] text-slate-400 font-medium font-mono">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
            
             <div 
                className="absolute right-0 z-20 -translate-y-1/2 pointer-events-none pr-1 flex items-center justify-end w-full"
                style={{ top: `${currentTimeTop}px` }}
            >
                <div className="text-[10px] font-bold text-rose-500 bg-white/90 backdrop-blur-sm border border-rose-100 px-1.5 py-0.5 rounded shadow-sm font-mono">
                    {format(now, 'HH:mm')}
                </div>
            </div>
          </div>

          {/* Main Grid Columns */}
          <div className="flex flex-1 relative">
             <div className="absolute inset-0 flex flex-col pointer-events-none">
                {HOURS.map((h) => (
                    <div key={h} className="border-b border-slate-100/60 last:border-none box-border" style={{ height: `${rowHeight}px` }}></div>
                ))}
             </div>

            {weekDays.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const key = dayStr;
              
              const dayPlans = plans.filter(p => {
                  const planDateStr = format(new Date(p.startDate), 'yyyy-MM-dd');
                  return planDateStr === dayStr && p.id !== dragState?.plan.id;
              });

              // Calculate layout for overlaps
              const layoutMap = calculateLayout(dayPlans);

              const isGhostCol = ghostData && ghostData.colIndex === idx;
              const isSelectedDay = isSameDay(day, currentDate);
              const isToday = isSameDay(day, now);

              return (
                <div 
                  key={key} 
                  className={`flex-1 relative border-r border-slate-100/50 last:border-none group transition-colors ${
                      isSelectedDay ? 'bg-blue-50/30' : 'bg-transparent hover:bg-white/40'
                  }`}
                  onContextMenu={(e) => handleSlotContextMenu(e, day)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  {isGhostCol && (
                      <div 
                        className="absolute inset-x-1 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/50 z-10 pointer-events-none flex items-center justify-center overflow-hidden"
                        style={{ top: `${ghostData!.top}px`, height: `${Math.max(ghostData!.height, 24)}px` }}
                      >
                         <span className="text-indigo-600 font-bold text-[10px] bg-white/90 px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm truncate max-w-full">
                            {format(ghostData!.start, 'HH:mm')} - {format(ghostData!.end, 'HH:mm')}
                         </span>
                      </div>
                  )}

                  {/* Current Time Line */}
                  {isToday && (
                      <div 
                        className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
                        style={{ top: `${currentTimeTop}px` }}
                      >
                         <div className="w-1.5 h-1.5 rounded-full bg-rose-500 -ml-[4px] ring-2 ring-white shadow-sm"></div>
                         <div className="h-px w-full bg-rose-500/50 shadow-[0_1px_2px_rgba(244,63,94,0.1)]"></div>
                      </div>
                  )}

                  {dayPlans.map(plan => {
                    const style = getEventStyle(plan);
                    const layout = layoutMap.get(plan.id) || { left: '0%', width: '100%' };
                    const icon = renderStatusIcon(plan.status);
                    
                    const isFullWidth = layout.width === '100%';
                    const heightVal = parseFloat(style.height);
                    const isTight = heightVal < 30;
                    
                    return (
                      <div
                        key={plan.id}
                        style={{ 
                            ...style, 
                            left: layout.left, 
                            width: layout.width 
                        }}
                        className={`${style.className} ${isFullWidth ? 'mx-1' : 'px-1'}`}
                        onMouseDown={(e) => handleMouseDown(e, plan)}
                        onContextMenu={(e) => handlePlanContextMenu(e, plan)}
                      >
                         <div className={`w-full h-full overflow-hidden ${!isFullWidth ? 'border-l-0 border-r-0 rounded-none' : ''}`}>
                             <div className={`flex items-start gap-1 h-full ${isTight ? 'items-center' : ''}`}>
                                {icon && <div className={isTight ? "flex-shrink-0" : "mt-0.5 flex-shrink-0"}>{icon}</div>}
                                <div className="flex-1 min-w-0 flex flex-col">
                                    <div className={`font-semibold truncate leading-tight text-[11px] ${isTight ? 'mt-0' : ''}`}>
                                        {plan.title}
                                    </div>
                                    {!isTight && (
                                      <>
                                          {heightVal >= 40 && (
                                              <div className="text-[9px] opacity-80 truncate mt-0.5 font-mono flex-shrink-0">
                                                  {format(new Date(plan.startDate), 'HH:mm')} - {format(new Date(plan.endDate), 'HH:mm')}
                                              </div>
                                          )}
                                          
                                          {heightVal >= 80 && plan.tags && plan.tags.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mt-1.5 overflow-hidden max-h-[18px]">
                                                  {plan.tags.slice(0, 3).map(t => (
                                                      <span key={t} className="px-1 py-0.5 rounded-sm bg-black/5 text-[9px] leading-none opacity-80 whitespace-nowrap">
                                                          {t}
                                                      </span>
                                                  ))}
                                              </div>
                                          )}

                                          {heightVal >= 120 && plan.description && (
                                              <div className="text-[10px] opacity-70 mt-1.5 leading-snug line-clamp-3">
                                                  {plan.description}
                                              </div>
                                          )}
                                      </>
                                    )}
                                </div>
                             </div>
                         </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Zoom Control - Positioned bottom right over the grid */}
      <div className="absolute bottom-6 right-8 z-40 transition-opacity duration-300 opacity-0 group-hover/calendar:opacity-100 hover:opacity-100 flex items-center gap-2 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100">
          <button 
             onClick={() => handleZoom(rowHeight - 10)}
             className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
             title="缩小视图"
          >
             <ZoomOut size={14} />
          </button>
          
          <div className="w-20 px-2 flex items-center">
             <input 
                type="range" 
                min={MIN_ROW_HEIGHT} 
                max={MAX_ROW_HEIGHT} 
                step={2}
                value={rowHeight}
                onChange={(e) => handleZoom(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500"
             />
          </div>

          <button 
             onClick={() => handleZoom(rowHeight + 10)}
             className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
             title="放大视图"
          >
             <ZoomIn size={14} />
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5"></div>

          <button 
             onClick={() => handleZoom(DEFAULT_ROW_HEIGHT)}
             className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors"
             title="重置视图"
          >
             <RotateCcw size={12} />
          </button>
      </div>
      
      {/* Draggable Proxy */}
      {dragState && dragState.isDragging && (
        <div 
            className="fixed z-50 pointer-events-none rounded-lg shadow-2xl bg-indigo-600 text-white px-3 py-2 text-xs font-medium opacity-90 ring-2 ring-white/30 backdrop-blur-sm flex flex-col justify-center"
            style={{ 
                width: 140, 
                left: dragState.currentClientX, 
                top: dragState.currentClientY,
                height: 40,
                transform: `translate(12px, 12px)`
            }}
        >
             <div className="font-bold truncate">{dragState.plan.title}</div>
             <div className="opacity-80 text-[10px] mt-0.5 font-mono">
               {format(new Date(dragState.plan.startDate), 'HH:mm')} - {format(new Date(dragState.plan.endDate), 'HH:mm')}
             </div>
        </div>
      )}

      {/* Custom Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[60] bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.15)] border border-white/50 w-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 170) }}
        >
          {contextMenu.type === 'PLAN' ? (
            <div className="py-1">
               <button onClick={() => handleMenuAction('EDIT')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors">
                  <Edit2 size={14} /> 编辑
               </button>
               <button onClick={() => handleMenuAction('TOGGLE_STATUS')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors">
                  {contextMenu.plan?.status === PlanStatus.DONE ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                  {contextMenu.plan?.status === PlanStatus.DONE ? '标记未完成' : '标记完成'}
               </button>
               <div className="h-px bg-slate-100 my-1"></div>
               <button onClick={() => handleMenuAction('DELETE')} className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 flex items-center gap-2 transition-colors">
                  <Trash2 size={14} /> 删除
               </button>
            </div>
          ) : (
            <div className="py-1">
               <div className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">
                  {contextMenu.date && format(contextMenu.date, 'HH:mm')}
               </div>
               <button onClick={() => handleMenuAction('NEW')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors">
                  <Plus size={14} /> 在此新建
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
