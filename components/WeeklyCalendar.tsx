
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { WorkPlan, PlanStatus } from '../types';
import { format, addDays, isSameDay, getHours, getMinutes, differenceInMinutes, addMinutes, startOfWeek } from 'date-fns';
import { Edit2, Trash2, CheckCircle2, Circle, Plus, PlayCircle } from 'lucide-react';

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
const ROW_HEIGHT = 64; 
const SIDEBAR_WIDTH = 64; 

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
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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
    // 1. Sort by start time, then duration (longer first for better packing)
    const sorted = [...dayPlans].sort((a, b) => {
        const startDiff = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        if (startDiff !== 0) return startDiff;
        const durA = new Date(a.endDate).getTime() - new Date(a.startDate).getTime();
        const durB = new Date(b.endDate).getTime() - new Date(b.startDate).getTime();
        return durB - durA;
    });

    const layoutMap = new Map<string, { left: string; width: string }>();
    if (sorted.length === 0) return layoutMap;

    // 2. Group into connected clusters
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

    // 3. Layout each cluster
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

    const top = (targetMinutes / 60) * ROW_HEIGHT;
    const padding = 48;
    
    gridRef.current.scrollTo({
      top: Math.max(0, top - padding),
      behavior: 'smooth'
    });

  }, [currentDate, plans]);

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
      isDragging: false
    });
    
    setContextMenu(null);
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
          const { snapDate, snapDay } = calculateSnap(dragState, weekDays);
          const newStart = new Date(snapDay);
          newStart.setHours(snapDate.getHours(), snapDate.getMinutes());
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
  }, [dragState, weekDays, onPlanUpdate, onPlanClick]);

  const calculateSnap = (state: DragState, days: Date[]) => {
    const columnsWidth = state.gridWidth - SIDEBAR_WIDTH;
    const colWidth = columnsWidth / DAYS_TO_SHOW;
    const xInCols = Math.max(0, state.pointerX - SIDEBAR_WIDTH);
    const colIndex = Math.min(DAYS_TO_SHOW - 1, Math.floor(xInCols / colWidth));
    const snapDay = days[colIndex];

    const rawTop = state.pointerY - state.offsetY;
    const rawMinutes = (rawTop / ROW_HEIGHT) * 60;
    const snappedMinutes = Math.max(0, Math.round(rawMinutes / 15) * 15);
    
    const snapDate = new Date(snapDay);
    snapDate.setHours(0, 0, 0, 0);
    snapDate.setMinutes(snappedMinutes);

    return { snapDate, snapDay, colIndex, snappedMinutes };
  };

  // --- External Drag & Drop Logic (Smart Create) ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
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
             const y = e.clientY - rect.top; // Relative to the column
             
             // Convert Y to minutes (approximate)
             const rawMinutes = (y / ROW_HEIGHT) * 60;
             // Snap to nearest 15 mins
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
    window.addEventListener('scroll', handleClickOutside, true); // Close on scroll
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
    const minutes = (y / ROW_HEIGHT) * 60;
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
    
    const top = (startMinutes / 60) * ROW_HEIGHT; 
    const height = (durationMinutes / 60) * ROW_HEIGHT;

    const colors: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
        indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
        purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
        rose: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
        orange: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    };
    
    return {
      top: `${top}px`,
      height: `${Math.max(height, 24)}px`, 
      className: `absolute rounded-lg border px-2 py-1 text-xs font-medium cursor-grab active:cursor-grabbing select-none overflow-hidden transition-all shadow-sm hover:z-20 hover:shadow-md ${colors[plan.color] || colors.blue}`
    };
  };

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    if (dragState) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = (y / ROW_HEIGHT) * 60;
    const snappedMinutes = Math.floor(minutes / 15) * 15;

    const newDate = new Date(day);
    newDate.setHours(0, 0, 0, 0);
    newDate.setMinutes(snappedMinutes);
    onSlotClick(newDate);
  };

  const currentTime = new Date();
  const currentMinutes = getHours(currentTime) * 60 + getMinutes(currentTime);
  const currentTimeTop = (currentMinutes / 60) * ROW_HEIGHT;

  let ghostData = null;
  if (dragState && dragState.isDragging) {
    const { snapDate, colIndex } = calculateSnap(dragState, weekDays);
    const startMinutes = getHours(snapDate) * 60 + getMinutes(snapDate);
    ghostData = {
        colIndex,
        top: (startMinutes / 60) * ROW_HEIGHT,
        height: (dragState.durationMinutes / 60) * ROW_HEIGHT,
        start: snapDate,
        end: addMinutes(snapDate, dragState.durationMinutes)
    };
  }

  // Helper to render status icon
  const renderStatusIcon = (status: PlanStatus) => {
    switch (status) {
        case PlanStatus.DONE:
            return <CheckCircle2 size={13} className="flex-shrink-0 text-emerald-600 fill-emerald-50" strokeWidth={2.5} />;
        case PlanStatus.IN_PROGRESS:
            return <PlayCircle size={13} className="flex-shrink-0 text-blue-600 fill-blue-50" strokeWidth={2.5} />;
        case PlanStatus.TODO:
        default:
             return <Circle size={13} className="flex-shrink-0 text-slate-400" strokeWidth={2} />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden relative" onContextMenu={(e) => e.preventDefault()}>
      
      {/* Header */}
      <div className="flex border-b border-slate-100 bg-white/50 backdrop-blur-md sticky top-0 z-20">
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
        <div className="flex relative" style={{ minHeight: `${24 * ROW_HEIGHT}px` }}>
          <div className="w-16 flex-shrink-0 border-r border-slate-100 bg-white sticky left-0 z-10">
            {HOURS.map((hour) => (
              <div key={hour} className="relative" style={{ height: `${ROW_HEIGHT}px` }}>
                <span className="absolute -top-3 right-3 text-xs text-slate-400 font-medium font-mono">
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-1 relative">
             <div className="absolute inset-0 flex flex-col pointer-events-none">
                {HOURS.map((h) => (
                    <div key={h} className="border-b border-slate-100/50 last:border-none box-border" style={{ height: `${ROW_HEIGHT}px` }}></div>
                ))}
             </div>

             {/* Current Time Line */}
             {weekDays.some(d => isSameDay(d, currentTime)) && (
                 <div 
                   className="absolute left-0 right-0 flex items-center pointer-events-none z-30"
                   style={{ top: `${currentTimeTop}px` }}
                 >
                    <div className="w-full h-[1px] bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.5)]"></div>
                    <div className="absolute -left-1 w-2 h-2 rounded-full bg-rose-500"></div>
                 </div>
             )}

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

              return (
                <div 
                  key={key} 
                  className={`flex-1 relative border-r border-slate-100/50 last:border-none group cursor-pointer transition-colors ${
                      isSelectedDay ? 'bg-blue-50/30' : 'bg-transparent hover:bg-white/40'
                  }`}
                  onClick={(e) => handleColumnClick(e, day)}
                  onContextMenu={(e) => handleSlotContextMenu(e, day)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  {isGhostCol && (
                      <div 
                        className="absolute inset-x-1 rounded-lg border-2 border-dashed border-indigo-400 bg-indigo-50/50 z-10 pointer-events-none flex items-center justify-center"
                        style={{ top: `${ghostData!.top}px`, height: `${Math.max(ghostData!.height, 24)}px` }}
                      >
                         <span className="text-indigo-600 font-bold text-xs bg-white/90 px-2 py-1 rounded-full shadow-sm backdrop-blur-sm">
                            {format(ghostData!.start, 'HH:mm')} - {format(ghostData!.end, 'HH:mm')} ({getDurationString(ghostData!.start.toISOString(), ghostData!.end.toISOString())})
                         </span>
                      </div>
                  )}

                  {dayPlans.map(plan => {
                    const style = getEventStyle(plan);
                    const layout = layoutMap.get(plan.id) || { left: '0%', width: '100%' };
                    const icon = renderStatusIcon(plan.status);
                    const durationStr = getDurationString(plan.startDate, plan.endDate);
                    
                    // Add tiny gaps for visual separation if sharing a column
                    const isFullWidth = layout.width === '100%';
                    
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
                         {/* Inner container to handle spacing if width is tight */}
                         <div className={`w-full h-full ${!isFullWidth ? 'border-l-0 border-r-0 rounded-none' : ''}`}>
                             <div className="flex items-center gap-1.5 h-full items-start pt-0.5">
                                {icon && <div className="mt-[1px]">{icon}</div>}
                                <div className="flex-1 min-w-0">
                                    <div className={`font-semibold truncate leading-tight`}>{plan.title}</div>
                                    {parseInt(style.height) > 40 && (
                                        <div className="text-[10px] opacity-80 truncate mt-0.5">
                                            {format(new Date(plan.startDate), 'HH:mm')} - {format(new Date(plan.endDate), 'HH:mm')}
                                            <span className="ml-1 font-medium">· {durationStr}</span>
                                        </div>
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
      
      {/* Draggable Proxy */}
      {dragState && dragState.isDragging && (
        <div 
            className="fixed z-50 pointer-events-none rounded-lg shadow-2xl bg-indigo-600 text-white px-3 py-2 text-xs font-medium opacity-90 ring-2 ring-white/30 backdrop-blur-sm flex flex-col justify-center"
            style={{ 
                width: 140, 
                left: dragState.currentClientX, 
                top: dragState.currentClientY,
                height: 50,
                transform: `translate(12px, 12px)`
            }}
        >
             <div className="font-bold truncate">{dragState.plan.title}</div>
             <div className="opacity-80 text-[10px] mt-0.5">
               {format(new Date(dragState.plan.startDate), 'HH:mm')} - {format(new Date(dragState.plan.endDate), 'HH:mm')}
               <span className="ml-1">· {getDurationString(dragState.plan.startDate, dragState.plan.endDate)}</span>
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
