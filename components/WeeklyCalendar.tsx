import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { WorkPlan, PlanStatus } from '../types';
import { format, addDays, isSameDay, getHours, getMinutes, differenceInMinutes, addMinutes, startOfMonth } from 'date-fns';
import { Plus, Clock, CheckCircle2, Circle, PlayCircle, Trash2, AlignLeft, ZoomIn, ZoomOut, RotateCcw, Copy, CalendarPlus, Focus, Inbox, MousePointer2, ChevronLeft, ChevronRight, ChevronDownCircle } from 'lucide-react';

interface WeeklyCalendarProps {
  currentDate: Date;
  plans: WorkPlan[];
  searchTerm?: string;
  targetPlanId?: string | null;
  onPlanClick: (plan: WorkPlan) => void;
  onSlotClick: (date: Date) => void;
  onPlanUpdate: (plan: WorkPlan) => void;
  onDuplicatePlan: (id: string, targetDate?: Date) => void;
  onDeletePlan: (id: string) => void;
  onDateSelect: (date: Date) => void;
  onDragCreate: (startDate: Date, durationMinutes: number, title?: string, color?: string, tags?: string[]) => void;
}

interface PositionedPlan extends WorkPlan {
  column: number;
  totalColumns: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_TO_SHOW = 7;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SIDEBAR_WIDTH = 60; 

const BASE_ROW_HEIGHT = 68; 
const BASE_COL_MIN_WIDTH = 180; 
const GRID_TOP_OFFSET = 24; 

const CORE_START_HOUR = 8;
const CORE_END_HOUR = 20;

const STATUS_LABELS = {
  [PlanStatus.TODO]: '待办',
  [PlanStatus.IN_PROGRESS]: '进行中',
  [PlanStatus.DONE]: '已完成',
};

const STATUS_BADGE_CLASSES = {
  [PlanStatus.TODO]: 'bg-slate-200 text-slate-700',
  [PlanStatus.IN_PROGRESS]: 'bg-blue-600 text-white shadow-sm',
  [PlanStatus.DONE]: 'bg-emerald-100 text-emerald-700',
};

const OFFSET_STEP_PCT = 12;

const formatDuration = (start: string, end: string) => {
    const diff = differenceInMinutes(new Date(end), new Date(start));
    if (diff < 60) return `${diff}m`;
    const hours = (diff / 60).toFixed(1).replace('.0', '');
    return `${hours}h`;
};

const getPositionedPlans = (dayPlans: WorkPlan[]): PositionedPlan[] => {
  const normalPlans = dayPlans.filter(p => !p.isFuzzy);
  if (normalPlans.length === 0) return [];
  
  const sorted = [...normalPlans].sort((a, b) => {
    const startA = new Date(a.startDate).getTime();
    const startB = new Date(b.startDate).getTime();
    if (startA !== startB) return startA - startB;
    const endA = new Date(a.endDate).getTime();
    const endB = new Date(b.endDate).getTime();
    return endB - endA;
  });

  const positioned: PositionedPlan[] = [];
  const columns: WorkPlan[][] = [];

  sorted.forEach(plan => {
    let colIndex = 0;
    const planStart = new Date(plan.startDate).getTime();
    while (true) {
      if (!columns[colIndex]) {
        columns[colIndex] = [];
        break;
      }
      const lastInCol = columns[colIndex][columns[colIndex].length - 1];
      const lastEnd = new Date(lastInCol.endDate).getTime();
      if (planStart >= lastEnd) break;
      colIndex++;
    }
    columns[colIndex].push(plan);
    positioned.push({ ...plan, column: colIndex, totalColumns: 0 });
  });

  positioned.forEach(p1 => {
    const s1 = new Date(p1.startDate).getTime();
    const e1 = new Date(p1.endDate).getTime();
    const overlapping = positioned.filter(p2 => {
      const s2 = new Date(p2.startDate).getTime();
      const e2 = new Date(p2.endDate).getTime();
      return s1 < e2 && e1 > s2;
    });
    const maxColInCluster = overlapping.length > 0 ? Math.max(...overlapping.map(o => o.column)) + 1 : 1;
    p1.totalColumns = maxColInCluster;
  });
  return positioned;
};

export const WeeklyCalendar: React.FC<WeeklyCalendarProps> = ({ 
  currentDate, 
  plans, 
  searchTerm = '',
  targetPlanId = null,
  onPlanClick, 
  onSlotClick, 
  onPlanUpdate, 
  onDuplicatePlan,
  onDeletePlan,
  onDateSelect,
  onDragCreate
}) => {
  const [now, setNow] = useState(new Date());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; plan: WorkPlan } | null>(null);
  const [hoveredPlanId, setHoveredPlanId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1.0);
  const [isFocusMode, setIsFocusMode] = useState(false); 
  
  const zoomAnchorRef = useRef<{ xRatio: number; yRatio: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dragInfo, setDragInfo] = useState<{
      planId?: string;
      durationMins: number;
      color: string;
      activeDay: Date | null;
      activeMinutes: number;
      isNew?: boolean;
      isCopy?: boolean;
      title?: string;
      tags?: string[];
  } | null>(null);

  const rowHeight = BASE_ROW_HEIGHT * zoomScale;
  const colMinWidth = BASE_COL_MIN_WIDTH * zoomScale;

  const getHourHeight = useCallback((hour: number) => {
    if (!isFocusMode) return rowHeight;
    if (hour < CORE_START_HOUR || hour >= CORE_END_HOUR) return rowHeight * 0.35;
    return rowHeight;
  }, [isFocusMode, rowHeight]);

  const getTimeTop = useCallback((date: Date) => {
    const h = getHours(date);
    const m = getMinutes(date);
    let top = GRID_TOP_OFFSET;
    for (let i = 0; i < h; i++) {
        top += getHourHeight(i);
    }
    top += (m / 60) * getHourHeight(h);
    return top;
  }, [getHourHeight]);

  const getMinutesFromTop = useCallback((top: number) => {
    let remainingTop = top - GRID_TOP_OFFSET;
    if (remainingTop < 0) return 0;
    let totalMinutes = 0;
    for (let i = 0; i < 24; i++) {
        const hHeight = getHourHeight(i);
        if (remainingTop <= hHeight) {
            totalMinutes += (remainingTop / hHeight) * 60;
            return Math.min(1439, totalMinutes);
        }
        remainingTop -= hHeight;
        totalMinutes += 60;
    }
    return 1439;
  }, [getHourHeight]);

  const totalGridHeight = useMemo(() => {
    let total = GRID_TOP_OFFSET;
    for (let i = 0; i < 24; i++) { total += getHourHeight(i); }
    return total;
  }, [getHourHeight]);

  const calculateWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    const monday = addDays(d, -diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const weekStart = calculateWeekStart(currentDate);
  const weekDays = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(weekStart, i));
  const weekOfMonth = useMemo(() => {
    const firstDayOfCurrentMonth = startOfMonth(weekStart);
    const firstMondayOfCurrentMonth = calculateWeekStart(firstDayOfCurrentMonth);
    const diffInWeeks = Math.round((weekStart.getTime() - firstMondayOfCurrentMonth.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return diffInWeeks + 1;
  }, [weekStart]);

  const currentTimeTop = useMemo(() => getTimeTop(now), [now, getTimeTop]);

  useEffect(() => {
    if (containerRef.current && !targetPlanId) {
      const initialScroll = getTimeTop(new Date()) - 150;
      containerRef.current.scrollTop = Math.max(0, initialScroll);
    }
  }, []); 

  useEffect(() => {
    if (targetPlanId && containerRef.current) {
      const targetPlan = plans.find(p => p.id === targetPlanId);
      if (targetPlan) {
        const top = getTimeTop(new Date(targetPlan.startDate));
        containerRef.current.scrollTo({ top: top - 150, behavior: 'smooth' });
      }
    }
  }, [targetPlanId, plans, getTimeTop]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !zoomAnchorRef.current) return;
    const { xRatio, yRatio } = zoomAnchorRef.current;
    const { clientWidth, clientHeight, scrollWidth, scrollHeight } = container;
    container.scrollLeft = xRatio * scrollWidth - clientWidth / 2;
    container.scrollTop = yRatio * scrollHeight - clientHeight / 2;
    zoomAnchorRef.current = null;
  }, [zoomScale, isFocusMode]);

  const handleZoomUpdate = useCallback((newScale: number) => {
    const container = containerRef.current;
    if (!container) return;
    const clampedScale = Math.max(0.6, Math.min(2.0, newScale));
    if (Math.abs(clampedScale - zoomScale) < 0.001) return;
    const { scrollLeft, scrollTop, clientWidth, clientHeight, scrollWidth, scrollHeight } = container;
    zoomAnchorRef.current = {
      xRatio: (scrollLeft + clientWidth / 2) / scrollWidth,
      yRatio: (scrollTop + clientHeight / 2) / scrollHeight
    };
    setZoomScale(clampedScale);
  }, [zoomScale]);

  const handleToggleFocusMode = () => {
    const container = containerRef.current;
    if (container) {
        const { scrollLeft, scrollTop, clientWidth, clientHeight, scrollWidth, scrollHeight } = container;
        zoomAnchorRef.current = { xRatio: (scrollLeft + clientWidth / 2) / scrollWidth, yRatio: (scrollTop + clientHeight / 2) / scrollHeight };
    }
    setIsFocusMode(!isFocusMode);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); handleZoomUpdate(zoomScale + 0.1); }
      else if (e.key === '-') { e.preventDefault(); handleZoomUpdate(zoomScale - 0.1); }
      else if (e.key === '0') { e.preventDefault(); handleZoomUpdate(1.0); }
    };
    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) { e.preventDefault(); const factor = e.deltaY > 0 ? -0.05 : 0.05; handleZoomUpdate(zoomScale + factor); }
    };
    window.addEventListener('keydown', handleKeyDown);
    if (containerRef.current) containerRef.current.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (containerRef.current) containerRef.current.removeEventListener('wheel', handleWheel);
    };
  }, [zoomScale, handleZoomUpdate]);

  const createDragGhost = (title: string, isCopy?: boolean) => {
    const ghost = document.createElement('div');
    ghost.className = `fixed -top-[1000px] left-0 ${isCopy ? 'bg-indigo-600' : 'bg-slate-900/90'} text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xl pointer-events-none z-[9999] flex items-center gap-2`;
    ghost.innerHTML = isCopy 
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> 复制: ${title}`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7-7 7 7"/><path d="M12 2v15"/><path d="m19 17-7 7-7-7"/></svg> ${title}`;
    document.body.appendChild(ghost);
    return ghost;
  };

  const handleDragStartExisting = (e: React.DragEvent, plan: WorkPlan) => {
    const isCopy = e.altKey;
    const duration = differenceInMinutes(new Date(plan.endDate), new Date(plan.startDate));
    setDragInfo({ planId: plan.id, durationMins: duration, color: plan.color, activeDay: null, activeMinutes: 0, isNew: false, isCopy: isCopy, title: plan.title, tags: plan.tags });
    const ghost = createDragGhost(plan.title, isCopy);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
    e.dataTransfer.setData('application/json', JSON.stringify({ type: isCopy ? 'COPY_PLAN' : 'MOVE_PLAN', planId: plan.id }));
    e.dataTransfer.effectAllowed = isCopy ? 'copy' : 'move';
  };

  const handleDragOver = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const template = (window as any).__ACTIVE_DRAG_TEMPLATE__;
    const isAltCopy = !!(e.altKey && !template && dragInfo?.planId);
    e.dataTransfer.dropEffect = (template || isAltCopy) ? 'copy' : 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const topOffset = e.clientY - rect.top;
    const rawMinutes = getMinutesFromTop(topOffset);
    const snappedMinutes = Math.max(0, Math.floor(rawMinutes / 15) * 15);
    setDragInfo(prev => {
        if (!prev) return { durationMins: template?.minutes || 60, color: template?.color || 'blue', activeDay: day, activeMinutes: snappedMinutes, isNew: true, isCopy: false, title: template?.title || '新日程', tags: template?.tags || [] };
        return { ...prev, activeDay: day, activeMinutes: snappedMinutes, isCopy: isAltCopy || prev.isCopy, durationMins: template?.minutes || prev.durationMins, color: template?.color || prev.color, title: template?.title || prev.title, tags: template?.tags || prev.tags, isNew: !!template };
    });
  };

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDragInfo(null);
    try {
        const jsonStr = e.dataTransfer.getData('application/json');
        const rect = e.currentTarget.getBoundingClientRect();
        const topOffset = e.clientY - rect.top;
        const rawMinutes = getMinutesFromTop(topOffset);
        const snappedMinutes = Math.max(0, Math.floor(rawMinutes / 15) * 15);
        const targetStart = new Date(day);
        targetStart.setHours(0, snappedMinutes, 0, 0);
        let data: any = null;
        if (jsonStr) { try { data = JSON.parse(jsonStr); } catch (e) {} }
        if (!data) data = (window as any).__ACTIVE_DRAG_TEMPLATE__;

        if (data && data.type === 'PRESET_DURATION') {
            onDragCreate(targetStart, data.minutes, data.title, data.color, data.tags);
        } else if (data && (data.type === 'MOVE_PLAN' || data.type === 'COPY_PLAN' || data.planId)) {
            const planId = data.planId;
            const isCopyAction = data.type === 'COPY_PLAN' || e.altKey;
            if (isCopyAction) { onDuplicatePlan(planId, targetStart); } 
            else {
                const plan = plans.find(p => p.id === planId);
                if (plan) {
                    const duration = differenceInMinutes(new Date(plan.endDate), new Date(plan.startDate));
                    onPlanUpdate({
                        ...plan,
                        isFuzzy: false, 
                        startDate: targetStart.toISOString(),
                        endDate: addMinutes(targetStart, duration).toISOString()
                    });
                }
            }
        }
        (window as any).__ACTIVE_DRAG_TEMPLATE__ = null;
    } catch (err) { console.error("Drop failed:", err); }
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setContextMenu(null); };
    if (contextMenu) { document.addEventListener('mousedown', handleClickOutside); window.addEventListener('scroll', () => setContextMenu(null), true); }
    return () => { document.removeEventListener('mousedown', handleClickOutside); window.removeEventListener('scroll', () => setContextMenu(null), true); };
  }, [contextMenu]);

  const getSimpleStatusIcon = (status: PlanStatus, color: string, size: number = 12) => {
    switch (status) {
        case PlanStatus.DONE: return <CheckCircle2 size={size} className="text-emerald-500" />;
        case PlanStatus.IN_PROGRESS: return <PlayCircle size={size} className="text-blue-500 animate-pulse" />;
        default: return <Circle size={size} className="text-slate-400" />;
    }
  };

  const handleCardContextMenu = (e: React.MouseEvent, plan: WorkPlan) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, plan }); };

  const isPlanHighlighted = (plan: WorkPlan) => {
    if (!searchTerm.trim()) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return plan.title.toLowerCase().includes(lowerSearch) || (plan.description && plan.description.toLowerCase().includes(lowerSearch)) || (plan.tags && plan.tags.some(tag => tag.toLowerCase().includes(lowerSearch)));
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_4px_30px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden relative group/calendar">
      <div className="absolute bottom-6 right-6 z-[60] flex items-center gap-2 bg-white/70 backdrop-blur-2xl border border-white/60 shadow-[0_15px_45px_-12px_rgba(0,0,0,0.15)] rounded-2xl p-2 opacity-0 group-hover/calendar:opacity-100 transition-all duration-300 scale-95 group-hover/calendar:scale-100 select-none">
          <button onClick={handleToggleFocusMode} className={`flex items-center gap-2 px-3 h-8 rounded-lg transition-all text-xs font-bold ${isFocusMode ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100'}`} title={isFocusMode ? "退出专注模式" : "开启时间轴专注模式"}><Focus size={14} className={isFocusMode ? "animate-pulse" : ""} /><span>专注时段</span></button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <button onClick={() => handleZoomUpdate(zoomScale - 0.2)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"><ZoomOut size={16} /></button>
          <div className="flex items-center gap-2 px-2 group/slider"><input type="range" min="0.6" max="2.0" step="0.05" value={zoomScale} onChange={(e) => handleZoomUpdate(parseFloat(e.target.value))} className="w-24 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 focus:outline-none" /><span className="text-[10px] font-bold font-mono text-slate-400 w-9 text-right cursor-pointer hover:text-indigo-600" onDoubleClick={() => handleZoomUpdate(1.0)}>{Math.round(zoomScale * 100)}%</span></div>
          <button onClick={() => handleZoomUpdate(zoomScale + 0.2)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"><ZoomIn size={16} /></button>
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          <button onClick={() => handleZoomUpdate(1.0)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${zoomScale === 1.0 ? 'text-slate-300 pointer-events-none' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 active:scale-90'}`}><RotateCcw size={14} /></button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/10 scroll-smooth">
        <div className="min-w-max flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
            <div className="sticky top-0 z-40 flex border-b border-slate-200/60 bg-white">
                <div className="sticky left-0 z-50 bg-white border-r border-slate-50 flex flex-col items-center justify-center leading-none" style={{ width: SIDEBAR_WIDTH }}><span className="text-[9px] font-bold text-slate-400 mb-1">{format(weekStart, 'M月')}</span><span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">第{weekOfMonth}周</span></div>
                <div className="flex flex-1">
                    {weekDays.map((day) => {
                        const isSelected = isSameDay(day, currentDate);
                        return (
                            <div key={day.toISOString()} className={`flex-1 py-3 flex flex-col items-center justify-center cursor-pointer transition-all border-r border-slate-100/50 hover:bg-slate-50 ${isSelected ? 'bg-blue-50/20' : ''}`} style={{ minWidth: colMinWidth }} onClick={() => onDateSelect(day)}><span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-400'}`}>{WEEKDAYS_ZH[day.getDay()]}</span><div className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-slate-900 text-white' : (isSameDay(day, new Date()) ? 'text-blue-600 bg-blue-50' : 'text-slate-800')}`}>{format(day, 'd')}</div></div>
                        );
                    })}
                </div>
            </div>

            <div className="flex relative">
                <div className="sticky left-0 z-30 bg-white border-r border-slate-100 flex-shrink-0" style={{ width: SIDEBAR_WIDTH }}>
                  <div style={{ height: `${GRID_TOP_OFFSET}px` }}></div>
                  {HOURS.map((hour) => {
                    const hHeight = getHourHeight(hour);
                    const isCollapsed = isFocusMode && (hour < CORE_START_HOUR || hour >= CORE_END_HOUR);
                    return (
                      <div key={hour} className={`relative w-full transition-all duration-500 ${isCollapsed ? 'bg-slate-50/30 overflow-hidden' : ''}`} style={{ height: `${hHeight}px` }}>
                        <span className={`absolute -top-2.5 right-3 text-[10px] font-bold font-mono opacity-50 transition-all origin-right ${isCollapsed ? 'opacity-20 scale-75' : 'text-slate-400'}`}>
                          {hour.toString().padStart(2, '0')}:00
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex-1 relative" style={{ height: `${totalGridHeight}px` }}>
                    <div className="absolute inset-0 flex flex-col pointer-events-none">
                      <div style={{ height: `${GRID_TOP_OFFSET}px` }}></div>
                      {HOURS.map((hour) => {
                        const hHeight = getHourHeight(hour);
                        const isCollapsed = isFocusMode && (hour < CORE_START_HOUR || hour >= CORE_END_HOUR);
                        return (
                          <div key={hour} className={`border-b transition-all duration-500 ${isCollapsed ? 'border-slate-100/30' : 'border-slate-100/60'}`} style={{ height: `${hHeight}px` }} />
                        );
                      })}
                    </div>

                    <div className="flex-1 relative h-full flex">
                        {weekDays.map((day) => {
                            const dayPlansRaw = plans.filter(p => isSameDay(new Date(p.startDate), day));
                            const dayPlans = getPositionedPlans(dayPlansRaw);
                            const isDraggingOverMe = dragInfo?.activeDay && isSameDay(dragInfo.activeDay, day);
                            return (
                                <div 
                                    key={day.toISOString()}
                                    className="flex-1 relative border-r border-slate-100/50"
                                    style={{ minWidth: colMinWidth }}
                                    onDragOver={(e) => handleDragOver(e, day)}
                                    onDragLeave={() => setDragInfo(prev => prev ? {...prev, activeDay: null} : null)}
                                    onDrop={(e) => handleDrop(e, day)}
                                    onClick={(e) => {
                                        if (e.target === e.currentTarget) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const topOffset = e.clientY - rect.top;
                                            const rawMinutes = getMinutesFromTop(topOffset);
                                            const snappedMinutes = Math.max(0, Math.floor(rawMinutes / 15) * 15);
                                            const timeDate = new Date(day);
                                            timeDate.setHours(0, snappedMinutes, 0, 0);
                                            onSlotClick(timeDate);
                                        }
                                    }}
                                >
                                    {isDraggingOverMe && dragInfo && (
                                        <div 
                                            className={`absolute inset-x-1 z-[35] rounded-xl border-2 border-dashed transition-all duration-300 ${dragInfo.isCopy ? 'border-indigo-500 bg-indigo-100/20' : `border-${dragInfo.color}-400/60 bg-${dragInfo.color}-100/15`} pointer-events-none flex flex-col items-center justify-center`}
                                            style={{ 
                                                top: `${getTimeTop(new Date(new Date(day).setHours(0, dragInfo.activeMinutes, 0, 0)))}px`, 
                                                height: `${(dragInfo.durationMins / 60) * getHourHeight(Math.floor(dragInfo.activeMinutes / 60))}px` 
                                            }}
                                        >
                                            <div className={`absolute left-2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-full shadow-[0_12px_35px_rgba(0,0,0,0.4)] font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 z-[100] ${dragInfo.activeMinutes < 90 ? 'top-full mt-2' : '-top-10'}`}>
                                              {dragInfo.isCopy ? <Copy size={10} className="text-indigo-400" /> : <Clock size={10} className="text-blue-400" />}
                                              <span>{dragInfo.isCopy ? '复制到: ' : ''}{format(new Date(new Date(day).setHours(0, dragInfo.activeMinutes, 0, 0)), 'HH:mm')} <span className="mx-1 opacity-50">-</span>{format(addMinutes(new Date(new Date(day).setHours(0, dragInfo.activeMinutes, 0, 0)), dragInfo.durationMins), 'HH:mm')}</span>
                                            </div>
                                        </div>
                                    )}

                                    {isSameDay(day, now) && ( 
                                      <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center transition-all duration-500" style={{ top: `${currentTimeTop}px` }}>
                                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.25 shadow-sm ring-2 ring-white"></div>
                                        <div className="h-px w-full bg-rose-500"></div>
                                      </div> 
                                    )}

                                    {dayPlans.map(plan => {
                                        const start = new Date(plan.startDate);
                                        const end = new Date(plan.endDate);
                                        const top = getTimeTop(start);
                                        let h = 0;
                                        const diff = differenceInMinutes(end, start);
                                        const startHour = getHours(start);
                                        const startMin = getMinutes(start);
                                        if (diff <= 60) { h = (diff / 60) * getHourHeight(startHour); } 
                                        else { let remainingMins = diff; let currentH = startHour; let currentM = startMin; while (remainingMins > 0) { const minsInThisHour = Math.min(60 - currentM, remainingMins); h += (minsInThisHour / 60) * getHourHeight(currentH); remainingMins -= minsInThisHour; currentH = (currentH + 1) % 24; currentM = 0; } }
                                        const cardHeight = Math.max(h - 2, 18);
                                        const isDone = plan.status === PlanStatus.DONE;
                                        const timeRangeStr = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
                                        const durationStr = formatDuration(plan.startDate, plan.endDate);
                                        const leftPct = plan.column * OFFSET_STEP_PCT;
                                        const widthPct = 100 - leftPct;
                                        const isHighlighted = isPlanHighlighted(plan);
                                        const isSearchActive = searchTerm.trim().length > 0;
                                        const isTarget = targetPlanId === plan.id;
                                        const isHovered = hoveredPlanId === plan.id;
                                        const COMPACT_THRESHOLD = 38;
                                        const SHOW_TAGS_THRESHOLD = 80;
                                        const SHOW_DESC_THRESHOLD = 115;
                                        
                                        return (
                                            <div 
                                              key={plan.id} 
                                              draggable 
                                              onDragStart={(e) => handleDragStartExisting(e, plan)} 
                                              onDragEnd={() => setDragInfo(null)} 
                                              onContextMenu={(e) => handleCardContextMenu(e, plan)} 
                                              onMouseEnter={() => setHoveredPlanId(plan.id)} 
                                              onMouseLeave={() => setHoveredPlanId(null)} 
                                              style={{ 
                                                top: `${top}px`, 
                                                height: `${cardHeight}px`, 
                                                left: `${leftPct}%`, 
                                                width: `calc(${widthPct}% - 4px)`, 
                                                zIndex: isHovered ? 100 : (isTarget ? 50 : 10 + plan.column), 
                                                transform: isHovered ? 'scale(1.02)' : 'scale(1)', 
                                              }} 
                                              className={`absolute cursor-grab active:cursor-grabbing overflow-hidden transition-all duration-500 flex flex-col backdrop-blur-md group ${isDone ? `bg-${plan.color}-50/40 border-${plan.color}-200/40` : `bg-${plan.color}-50/90 border-${plan.color}-200/60 hover:border-${plan.color}-400 hover:bg-${plan.color}-50 text-${plan.color}-900`} ${dragInfo?.planId === plan.id && !dragInfo.isCopy ? 'opacity-20 scale-95' : ''} ${cardHeight < COMPACT_THRESHOLD ? 'p-1 px-1.5' : cardHeight < 75 ? 'p-2' : cardHeight < 115 ? 'p-2.5' : 'p-3'} ${isSearchActive && !isHighlighted ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'} ${isTarget ? 'ring-2 ring-indigo-500/40 border-indigo-400 z-50 shadow-xl' : ''} ${isHovered ? 'shadow-xl z-[100]' : 'shadow-sm'} rounded-xl border`} 
                                              onClick={() => onPlanClick(plan)}
                                            >
                                                {cardHeight < COMPACT_THRESHOLD ? (
                                                  <div className="flex items-center justify-between gap-1 h-full">
                                                    <span className={`text-[10px] font-bold truncate flex-1 ${isDone ? 'text-slate-400 line-through opacity-80' : ''}`}>
                                                      <span className="opacity-70 mr-1 text-[9px]">[{STATUS_LABELS[plan.status]}]</span>{plan.title}
                                                    </span>
                                                    {getSimpleStatusIcon(plan.status, plan.color, 10)}
                                                  </div>
                                                ) : (
                                                  <div className="flex flex-col h-full overflow-hidden">
                                                    <div className="flex items-start justify-between gap-1.5 mb-1.5 min-w-0 flex-shrink-0">
                                                      <div className={`font-bold truncate leading-tight ${cardHeight >= 115 ? 'text-[15px]' : cardHeight >= 75 ? 'text-[13px]' : 'text-[11px]'} ${isDone ? 'text-slate-400 line-through font-normal opacity-70' : 'text-slate-800'} flex-1`}>{plan.title}</div>
                                                      {getSimpleStatusIcon(plan.status, plan.color, cardHeight < 75 ? 10 : 12)}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mb-1.5 overflow-hidden whitespace-nowrap flex-shrink-0">
                                                      <div className={`flex-shrink-0 inline-flex items-center px-1 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${STATUS_BADGE_CLASSES[plan.status]}`}>{STATUS_LABELS[plan.status]}</div>
                                                      <div className={`flex items-center gap-1 font-bold font-mono min-w-0 ${isDone ? `text-${plan.color}-600/40` : `text-${plan.color}-600/80`}`}>
                                                        {cardHeight >= 115 && <Clock size={11} strokeWidth={2.5} className="mr-0.5 opacity-60" />}
                                                        <span className={`${cardHeight < 75 ? 'text-[9px]' : 'text-[10px]'} truncate`}>{timeRangeStr}{cardHeight >= 75 && <span className="ml-1 opacity-60 font-normal">({durationStr})</span>}</span>
                                                      </div>
                                                    </div>
                                                    {cardHeight >= SHOW_TAGS_THRESHOLD && plan.tags && plan.tags.length > 0 && (
                                                      <div className="flex flex-wrap gap-1 mt-0.5 mb-1 overflow-hidden flex-shrink-0 max-h-[36px]">
                                                        {plan.tags.slice(0, 3).map(tag => (
                                                          <span key={tag} className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold whitespace-nowrap ${isDone ? `bg-${plan.color}-100/30 text-${plan.color}-400` : `bg-${plan.color}-100/50 text-${plan.color}-700 border border-${plan.color}-200/30`}`}>{tag}</span>
                                                        ))}
                                                        {plan.tags.length > 3 && <span className="text-[8px] text-slate-400">+{plan.tags.length - 3}</span>}
                                                      </div>
                                                    )}
                                                    {cardHeight >= SHOW_DESC_THRESHOLD && plan.description && (
                                                      <div className={`mt-auto text-[11px] leading-relaxed flex items-start gap-1.5 pt-2 border-t border-black/5 ${isDone ? 'text-slate-300' : 'text-slate-600'} overflow-hidden`}>
                                                        <AlignLeft size={10} className="mt-1 flex-shrink-0 opacity-40" />
                                                        <span className={`flex-1 ${cardHeight > 160 ? 'line-clamp-4' : 'line-clamp-2'}`}>{plan.description}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {contextMenu && createPortal(
        <div ref={menuRef} className="fixed z-[9999] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 p-1.5 w-48 animate-in fade-in zoom-in-95 duration-150 origin-top-left" style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 200) }}>
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">日程管理</div>
          <button onClick={() => { onPlanUpdate({...contextMenu.plan!, isFuzzy: true}); setContextMenu(null); }} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-amber-50 text-amber-600 font-bold text-xs transition-all"><Inbox size={14} /> 移至挂载仓 (转为模糊)</button>
          <button onClick={() => { const tomorrow = addDays(new Date(contextMenu.plan!.startDate), 1); onDuplicatePlan(contextMenu.plan!.id, tomorrow); setContextMenu(null); }} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-blue-50 text-blue-600 font-bold text-xs transition-all"><CalendarPlus size={14} /> 明天继续 (复制到明天)</button>
          <div className="h-px bg-slate-100 my-1.5 mx-1"></div>
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">状态 (当前: {STATUS_LABELS[contextMenu.plan.status]})</div>
          {contextMenu.plan.status !== PlanStatus.DONE && (
            <button onClick={() => { onPlanUpdate({...contextMenu.plan!, status: PlanStatus.DONE}); setContextMenu(null); }} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 font-bold text-xs transition-all"><CheckCircle2 size={14} /> 标记完成</button>
          )}
          <button onClick={() => { onDeletePlan(contextMenu.plan!.id); setContextMenu(null); }} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-rose-50 text-rose-500 font-bold text-xs transition-all"><Trash2 size={14} /> 删除日程</button>
        </div>,
        document.body
      )}
    </div>
  );
};