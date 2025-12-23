import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { WorkPlan, PlanStatus } from '../types';
import { format, addDays, isSameDay, getHours, getMinutes, differenceInMinutes, addMinutes } from 'date-fns';
import { Plus, Clock, Move, Tag, CheckCircle2, Circle, PlayCircle, Edit2, Trash2, AlignLeft, ZoomIn, ZoomOut, Maximize2, Minimize2, Search, RotateCcw } from 'lucide-react';

interface WeeklyCalendarProps {
  currentDate: Date;
  plans: WorkPlan[];
  searchTerm?: string;
  targetPlanId?: string | null;
  onPlanClick: (plan: WorkPlan) => void;
  onSlotClick: (date: Date) => void;
  onPlanUpdate: (plan: WorkPlan) => void;
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
const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

// 基础常量
const BASE_ROW_HEIGHT = 48;
const BASE_COL_MIN_WIDTH = 130; 
const GRID_TOP_OFFSET = 24; // 增加顶部间距，防止 00:00 被遮挡

const STATUS_LABELS = {
  [PlanStatus.TODO]: '待办',
  [PlanStatus.IN_PROGRESS]: '执行中',
  [PlanStatus.DONE]: '已完成',
};

const getPositionedPlans = (dayPlans: WorkPlan[]): PositionedPlan[] => {
  if (dayPlans.length === 0) return [];

  const sorted = [...dayPlans].sort((a, b) => {
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
      
      if (planStart >= lastEnd) {
        break;
      }
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

    const maxColInCluster = Math.max(...overlapping.map(o => o.column)) + 1;
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
  onDeletePlan,
  onDateSelect,
  onDragCreate
}) => {
  const [now, setNow] = useState(new Date());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date?: Date; timeStr?: string; plan?: WorkPlan } | null>(null);
  
  // 缩放状态控制
  const [zoomScale, setZoomScale] = useState(1.0);
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
      title?: string;
      tags?: string[];
  } | null>(null);

  // 动态尺寸计算
  const rowHeight = BASE_ROW_HEIGHT * zoomScale;
  const colMinWidth = BASE_COL_MIN_WIDTH * zoomScale;

  // 计算当前时间点在视图中的高度
  const currentTimeTop = useMemo(() => {
    return (getHours(now) * 60 + getMinutes(now)) / 60 * rowHeight + GRID_TOP_OFFSET;
  }, [now, rowHeight]);

  // 1. 初始加载：自动滚动到当前时间 (Human-friendly initial scroll)
  useEffect(() => {
    if (containerRef.current && !targetPlanId) {
      // 默认将当前时间定位在视图上方约 1/4 处，更符合直觉
      const initialScroll = currentTimeTop - 150;
      containerRef.current.scrollTop = Math.max(0, initialScroll);
    }
  }, []); // 仅在组件挂载时执行一次

  // 2. 自动平滑滚动到目标日程 (Target navigation)
  useEffect(() => {
    if (targetPlanId && containerRef.current) {
      const targetPlan = plans.find(p => p.id === targetPlanId);
      if (targetPlan) {
        const start = new Date(targetPlan.startDate);
        const top = (getHours(start) * 60 + getMinutes(start)) / 60 * rowHeight + GRID_TOP_OFFSET;
        
        containerRef.current.scrollTo({
          top: top - 150, 
          behavior: 'smooth'
        });
      }
    }
  }, [targetPlanId, plans, rowHeight]);

  // 关键：锚点缩放补偿
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || !zoomAnchorRef.current) return;

    const { xRatio, yRatio } = zoomAnchorRef.current;
    const { clientWidth, clientHeight, scrollWidth, scrollHeight } = container;

    const newLeft = xRatio * scrollWidth - clientWidth / 2;
    const newTop = yRatio * scrollHeight - clientHeight / 2;

    container.scrollLeft = newLeft;
    container.scrollTop = newTop;
    
    zoomAnchorRef.current = null;
  }, [zoomScale]);

  const handleZoomUpdate = useCallback((newScale: number) => {
    const container = containerRef.current;
    if (!container) return;

    const clampedScale = Math.max(0.6, Math.min(2.5, newScale));
    if (Math.abs(clampedScale - zoomScale) < 0.001) return;

    const { scrollLeft, scrollTop, clientWidth, clientHeight, scrollWidth, scrollHeight } = container;
    
    zoomAnchorRef.current = {
      xRatio: (scrollLeft + clientWidth / 2) / scrollWidth,
      yRatio: (scrollTop + clientHeight / 2) / scrollHeight
    };

    setZoomScale(clampedScale);
  }, [zoomScale]);

  // 全局快捷键与滚轮缩放支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (!isCmdOrCtrl) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleZoomUpdate(zoomScale + 0.1);
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomUpdate(zoomScale - 0.1);
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomUpdate(1.0);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        const factor = delta > 0 ? 0.05 : -0.05;
        handleZoomUpdate(zoomScale + factor);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [zoomScale, handleZoomUpdate]);

  const createDragGhost = (title: string) => {
    const ghost = document.createElement('div');
    ghost.className = "fixed -top-[1000px] left-0 bg-slate-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xl pointer-events-none z-[9999] flex items-center gap-2";
    ghost.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7-7 7 7"/><path d="M12 2v15"/><path d="m19 17-7 7-7-7"/></svg> ${title}`;
    document.body.appendChild(ghost);
    return ghost;
  };

  const handleDragStartExisting = (e: React.DragEvent, plan: WorkPlan) => {
    const duration = differenceInMinutes(new Date(plan.endDate), new Date(plan.startDate));
    setDragInfo({
        planId: plan.id,
        durationMins: duration,
        color: plan.color,
        activeDay: null,
        activeMinutes: 0,
        isNew: false,
        title: plan.title,
        tags: plan.tags
    });

    const ghost = createDragGhost(plan.title);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);

    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'MOVE_PLAN', planId: plan.id }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    const template = (window as any).__ACTIVE_DRAG_TEMPLATE__;
    e.dataTransfer.dropEffect = template ? 'copy' : 'move';
    
    const rect = e.currentTarget.getBoundingClientRect();
    // 偏移计算需减去 GRID_TOP_OFFSET
    const rawMinutes = ((e.clientY - rect.top - GRID_TOP_OFFSET) / rowHeight) * 60;
    const snappedMinutes = Math.max(0, Math.floor(rawMinutes / 15) * 15);

    setDragInfo(prev => {
        if (!prev) {
            return {
                durationMins: template?.minutes || 60,
                color: template?.color || 'blue',
                activeDay: day,
                activeMinutes: snappedMinutes,
                isNew: true,
                title: template?.title || '新日程',
                tags: template?.tags || []
            };
        }
        return { 
            ...prev, 
            activeDay: day, 
            activeMinutes: snappedMinutes,
            durationMins: template?.minutes || prev.durationMins,
            color: template?.color || prev.color,
            title: template?.title || prev.title,
            tags: template?.tags || prev.tags,
            isNew: !!template
        };
    });
  };

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    setDragInfo(null);
    try {
        const jsonStr = e.dataTransfer.getData('application/json');
        const textStr = e.dataTransfer.getData('text/plain');
        const rect = e.currentTarget.getBoundingClientRect();
        const snappedMinutes = Math.max(0, Math.floor(((e.clientY - rect.top - GRID_TOP_OFFSET) / rowHeight) * 60 / 15) * 15);
        const targetStart = new Date(day);
        targetStart.setHours(0, snappedMinutes, 0, 0);

        let data: any = null;
        if (jsonStr) { try { data = JSON.parse(jsonStr); } catch (e) {} }
        if (!data && textStr) { try { data = JSON.parse(textStr); } catch (e) {} }
        if (!data) { data = (window as any).__ACTIVE_DRAG_TEMPLATE__; }

        if (data && data.type === 'PRESET_DURATION') {
            onDragCreate(targetStart, data.minutes, data.title, data.color, data.tags);
        } else if (data && (data.type === 'MOVE_PLAN' || data.planId)) {
            const planId = data.planId;
            const plan = plans.find(p => p.id === planId);
            if (plan) {
                const duration = differenceInMinutes(new Date(plan.endDate), new Date(plan.startDate));
                onPlanUpdate({
                    ...plan,
                    startDate: targetStart.toISOString(),
                    endDate: addMinutes(targetStart, duration).toISOString()
                });
            }
        }
        (window as any).__ACTIVE_DRAG_TEMPLATE__ = null;
    } catch (err) { console.error("Drop process failed:", err); }
  };

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

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    if (contextMenu) {
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', () => setContextMenu(null), true);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', () => setContextMenu(null), true);
    };
  }, [contextMenu]);

  const getSimpleStatusIcon = (status: PlanStatus, color: string, size: number = 12) => {
    switch (status) {
        case PlanStatus.DONE: return <CheckCircle2 size={size} className="text-emerald-500" />;
        case PlanStatus.IN_PROGRESS: return <PlayCircle size={size} className="text-blue-500 animate-pulse" />;
        default: return <Circle size={size} className="text-slate-400" />;
    }
  };

  const handleCardContextMenu = (e: React.MouseEvent, plan: WorkPlan) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, plan });
  };

  // 搜索过滤逻辑
  const isPlanHighlighted = (plan: WorkPlan) => {
    if (!searchTerm.trim()) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return (
      plan.title.toLowerCase().includes(lowerSearch) ||
      (plan.description && plan.description.toLowerCase().includes(lowerSearch)) ||
      (plan.tags && plan.tags.some(tag => tag.toLowerCase().includes(lowerSearch)))
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_4px_30px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden relative group/calendar">
      
      {/* 工业级缩放控制器 - Apple 风格悬浮窗 */}
      <div className="absolute bottom-6 right-6 z-[60] flex items-center gap-1 bg-white/70 backdrop-blur-2xl border border-white/60 shadow-[0_15px_45px_-12px_rgba(0,0,0,0.15)] rounded-2xl p-2 opacity-0 group-hover/calendar:opacity-100 transition-all duration-300 scale-95 group-hover/calendar:scale-100 select-none">
          <button 
            onClick={() => handleZoomUpdate(zoomScale - 0.2)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
            title="缩小 (Cmd -)"
          >
            <ZoomOut size={16} />
          </button>
          
          <div className="flex items-center gap-2 px-2 group/slider">
            <input 
              type="range"
              min="0.6"
              max="2.5"
              step="0.05"
              value={zoomScale}
              onChange={(e) => handleZoomUpdate(parseFloat(e.target.value))}
              className="w-24 h-1 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
            />
            <span 
              className="text-[10px] font-bold font-mono text-slate-400 w-9 text-right cursor-pointer hover:text-indigo-600"
              onDoubleClick={() => handleZoomUpdate(1.0)}
              title="双击恢复默认 (Cmd 0)"
            >
              {Math.round(zoomScale * 100)}%
            </span>
          </div>

          <button 
            onClick={() => handleZoomUpdate(zoomScale + 0.2)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
            title="放大 (Cmd +)"
          >
            <ZoomIn size={16} />
          </button>
          
          <div className="w-px h-4 bg-slate-200 mx-1"></div>
          
          <button 
            onClick={() => handleZoomUpdate(1.0)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${zoomScale === 1.0 ? 'text-slate-300 pointer-events-none' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 active:scale-90'}`}
            title="重置缩放"
          >
            <RotateCcw size={14} />
          </button>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/10 scroll-smooth">
        <div className="min-w-max flex flex-col">
            <div className="sticky top-0 z-40 flex border-b border-slate-200/60 bg-white">
                <div className="sticky left-0 z-50 bg-white border-r border-slate-50" style={{ width: SIDEBAR_WIDTH }}></div>
                <div className="flex flex-1">
                    {weekDays.map((day) => {
                        const isSelected = isSameDay(day, currentDate);
                        return (
                            <div key={day.toISOString()} className={`flex-1 py-3 flex flex-col items-center justify-center cursor-pointer transition-all border-r border-slate-100/50 hover:bg-slate-50 ${isSelected ? 'bg-blue-50/20' : ''}`} style={{ minWidth: colMinWidth }} onClick={() => onDateSelect(day)}>
                                <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-400'}`} style={{ transform: `scale(${Math.max(0.85, zoomScale > 1.2 ? 1.1 : zoomScale)})`, transformOrigin: 'center' }}>{WEEKDAYS_ZH[day.getDay()]}</span>
                                <div className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-slate-900 text-white' : (isSameDay(day, new Date()) ? 'text-blue-600 bg-blue-50' : 'text-slate-800')}`} style={{ transform: `scale(${Math.max(0.9, Math.min(1.2, zoomScale))})` }}>{format(day, 'd')}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex relative">
                {/* 侧边时间轴 - 增加顶部 Offset 容器 */}
                <div className="sticky left-0 z-30 bg-white border-r border-slate-100 flex-shrink-0" style={{ width: SIDEBAR_WIDTH }}>
                    <div style={{ height: `${GRID_TOP_OFFSET}px` }}></div>
                    {HOURS.map((hour) => (
                        <div key={hour} className="relative w-full" style={{ height: `${rowHeight}px` }}>
                            <span className="absolute -top-2.5 right-3 text-[10px] text-slate-400 font-bold font-mono opacity-50 transition-all origin-right" style={{ transform: `scale(${Math.max(0.8, Math.min(1.1, zoomScale))})` }}>{hour.toString().padStart(2, '0')}:00</span>
                        </div>
                    ))}
                </div>

                <div className="flex-1 relative min-h-[1152px]">
                    {/* 背景网格线 - 增加顶部 Offset */}
                    <div className="absolute inset-0 flex flex-col pointer-events-none">
                        <div style={{ height: `${GRID_TOP_OFFSET}px` }}></div>
                        {HOURS.map((h) => <div key={h} className="border-b border-slate-100/60" style={{ height: `${rowHeight}px` }} />)}
                    </div>

                    <div className="flex flex-1 relative h-full">
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
                                    onContextMenu={(e) => {
                                        if (e.target === e.currentTarget) {
                                            e.preventDefault();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const snappedMinutes = Math.max(0, Math.floor(((e.clientY - rect.top - GRID_TOP_OFFSET) / rowHeight) * 60 / 15) * 15);
                                            const timeDate = new Date(day);
                                            timeDate.setHours(0, snappedMinutes, 0, 0);
                                            setContextMenu({ x: e.clientX, y: e.clientY, date: timeDate, timeStr: format(timeDate, 'HH:mm') });
                                        }
                                    }}
                                >
                                    {isDraggingOverMe && dragInfo && (
                                        <div 
                                            className={`absolute inset-x-1 z-[35] rounded-xl border-2 border-dashed border-${dragInfo.color}-400/60 bg-${dragInfo.color}-100/15 pointer-events-none flex flex-col items-center justify-center transition-all duration-75`}
                                            style={{ 
                                                top: `${(dragInfo.activeMinutes / 60) * rowHeight + GRID_TOP_OFFSET}px`, 
                                                height: `${(dragInfo.durationMins / 60) * rowHeight}px` 
                                            }}
                                        >
                                            <div 
                                                className={`
                                                    absolute left-2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-full shadow-[0_12px_35px_rgba(0,0,0,0.4)] 
                                                    font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 z-[100]
                                                    ${dragInfo.activeMinutes < 90 ? 'top-full mt-2' : '-top-10'}
                                                `}
                                            >
                                                <Clock size={10} className="text-blue-400" />
                                                <span>
                                                    {format(addMinutes(new Date().setHours(0, dragInfo.activeMinutes, 0, 0), 0), 'HH:mm')} 
                                                    <span className="mx-1 opacity-50">-</span>
                                                    {format(addMinutes(new Date().setHours(0, dragInfo.activeMinutes, 0, 0), dragInfo.durationMins), 'HH:mm')}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {isSameDay(day, now) && (
                                        <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: `${currentTimeTop}px` }}>
                                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.25 shadow-sm ring-2 ring-white"></div>
                                            <div className="h-px w-full bg-rose-500"></div>
                                        </div>
                                    )}

                                    {dayPlans.map(plan => {
                                        const start = new Date(plan.startDate);
                                        const end = new Date(plan.endDate);
                                        const top = (getHours(start) * 60 + getMinutes(start)) / 60 * rowHeight + GRID_TOP_OFFSET;
                                        const h = Math.max(differenceInMinutes(end, start) / 60 * rowHeight, 18);
                                        const isDone = plan.status === PlanStatus.DONE;
                                        const timeRangeStr = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;

                                        const widthPct = 100 / plan.totalColumns;
                                        const leftPct = plan.column * widthPct;
                                        
                                        // 确定高亮状态
                                        const isHighlighted = isPlanHighlighted(plan);
                                        const isSearchActive = searchTerm.trim().length > 0;
                                        const isTarget = targetPlanId === plan.id;

                                        return (
                                            <div
                                                key={plan.id}
                                                draggable
                                                onDragStart={(e) => handleDragStartExisting(e, plan)}
                                                onDragEnd={() => setDragInfo(null)}
                                                onContextMenu={(e) => handleCardContextMenu(e, plan)}
                                                style={{ 
                                                    top: `${top}px`, 
                                                    height: `${h}px`,
                                                    left: `${leftPct}%`,
                                                    width: `${widthPct}%`,
                                                    paddingLeft: '4px',
                                                    paddingRight: '4px'
                                                }}
                                                className={`
                                                    absolute z-10 cursor-grab active:cursor-grabbing overflow-hidden transition-all flex flex-col
                                                    shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:z-30 hover:shadow-lg backdrop-blur-md group
                                                    ${isDone 
                                                        ? `bg-slate-50/75 border-slate-100 opacity-60` 
                                                        : `bg-${plan.color}-50/90 border-${plan.color}-200/60 hover:border-${plan.color}-400 hover:bg-${plan.color}-50 text-${plan.color}-900`
                                                    }
                                                    ${dragInfo?.planId === plan.id ? 'opacity-20 scale-95' : ''}
                                                    ${h < 35 ? 'p-1 px-1.5' : h < 100 ? 'p-2' : h < 160 ? 'p-2.5' : 'p-3'}
                                                    ${isSearchActive && !isHighlighted ? 'opacity-20 grayscale pointer-events-none' : 'opacity-100'}
                                                    ${isSearchActive && isHighlighted ? 'ring-2 ring-indigo-500 ring-offset-2 z-40 animate-pulse' : ''}
                                                    ${isTarget ? 'ring-2 ring-indigo-500/40 border-indigo-400 z-50 shadow-xl scale-[1.01]' : ''}
                                                    rounded-xl border
                                                `}
                                                onClick={() => onPlanClick(plan)}
                                            >
                                                {h < 35 ? (
                                                    <div className="flex items-center justify-between gap-1 h-full">
                                                        <span className={`text-[10px] font-bold truncate flex-1 ${isDone ? 'text-slate-400 line-through' : ''}`}>
                                                            {plan.title}
                                                        </span>
                                                        {getSimpleStatusIcon(plan.status, plan.color, 10)}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col h-full">
                                                        <div className="flex items-start justify-between gap-1.5 mb-1 min-w-0">
                                                            <div className={`font-bold truncate leading-tight flex-1 ${h >= 160 ? 'text-[15px]' : h >= 65 ? 'text-[13px]' : 'text-[11px]'} ${isDone ? 'text-slate-400 line-through font-normal' : 'text-slate-800'}`}>
                                                                {plan.title}
                                                            </div>
                                                            {h >= 65 && plan.totalColumns < 3 ? (
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border flex-shrink-0 transition-all
                                                                    ${plan.status === PlanStatus.DONE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                                                      plan.status === PlanStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-600 border-blue-100 animate-pulse' : 
                                                                      'bg-slate-100 text-slate-500 border-slate-200'}
                                                                `}>
                                                                    {STATUS_LABELS[plan.status]}
                                                                </span>
                                                            ) : (
                                                                getSimpleStatusIcon(plan.status, plan.color)
                                                            )}
                                                        </div>

                                                        <div className={`flex items-center gap-1 font-bold font-mono ${isDone ? 'text-slate-300' : `text-${plan.color}-600/80`}`}>
                                                            <Clock size={h < 65 ? 10 : 12} strokeWidth={2.5} />
                                                            <span className={`${h < 65 ? 'text-[9px]' : 'text-[10px]'}`}>
                                                                {timeRangeStr}
                                                            </span>
                                                        </div>

                                                        {h >= 160 && plan.description && plan.totalColumns < 2 && (
                                                            <div className="mt-2 text-[11px] text-slate-500 leading-snug line-clamp-3 opacity-80 flex items-start gap-1.5">
                                                                <AlignLeft size={10} className="mt-1 flex-shrink-0 opacity-40" />
                                                                <span className="flex-1">{plan.description}</span>
                                                            </div>
                                                        )}

                                                        {h >= 100 && plan.tags && plan.tags.length > 0 && plan.totalColumns < 3 && (
                                                            <div className="flex flex-wrap gap-1 mt-auto pt-2 pb-1 overflow-hidden max-h-[44px]">
                                                                {plan.tags.slice(0, h >= 160 ? 4 : 2).map(tag => (
                                                                    <span key={tag} className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-colors whitespace-nowrap ${isDone ? 'bg-slate-100 text-slate-300 border-slate-200' : `bg-${plan.color}-100/50 text-${plan.color}-700 border-${plan.color}-200/50 group-hover:bg-${plan.color}-100 group-hover:border-${plan.color}-200`}`}>
                                                                        {tag}
                                                                    </span>
                                                                ))}
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
        <div ref={menuRef} 
            className="fixed z-[9999] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 p-1.5 w-48 animate-in fade-in zoom-in-95 duration-150 origin-top-left" 
            style={{ 
                top: Math.min(contextMenu.y, window.innerHeight - 320), 
                left: Math.min(contextMenu.x, window.innerWidth - 200) 
            }}
        >
            {contextMenu.plan ? (
                <>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">切换状态 (当前: {STATUS_LABELS[contextMenu.plan.status]})</div>
                    
                    {contextMenu.plan.status !== PlanStatus.TODO && (
                      <button onClick={() => { onPlanUpdate({...contextMenu.plan!, status: PlanStatus.TODO}); setContextMenu(null); }} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 text-slate-600 font-bold text-xs transition-all">
                          <Circle size={14} /> 设为待办
                      </button>
                    )}
                    {contextMenu.plan.status !== PlanStatus.IN_PROGRESS && (
                      <button onClick={() => { onPlanUpdate({...contextMenu.plan!, status: PlanStatus.IN_PROGRESS}); setContextMenu(null); }} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-blue-50 text-blue-600 font-bold text-xs transition-all">
                          <PlayCircle size={14} /> 标记执行中
                      </button>
                    )}
                    {contextMenu.plan.status !== PlanStatus.DONE && (
                      <button onClick={() => { onPlanUpdate({...contextMenu.plan!, status: PlanStatus.DONE}); setContextMenu(null); }} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 font-bold text-xs transition-all">
                          <CheckCircle2 size={14} /> 标记完成
                      </button>
                    )}

                    <div className="h-px bg-slate-100 my-1.5 mx-1"></div>
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">颜色标签</div>
                    <div className="grid grid-cols-6 gap-1 px-2 pb-2 mt-1">
                        {COLORS.map(c => (
                            <button 
                                key={c}
                                onClick={() => { onPlanUpdate({...contextMenu.plan!, color: c}); setContextMenu(null); }}
                                className={`w-5 h-5 rounded-full bg-${c}-500 hover:scale-125 transition-transform ring-2 ring-transparent hover:ring-white shadow-sm ${contextMenu.plan!.color === c ? 'ring-slate-400' : ''}`}
                            />
                        ))}
                    </div>

                    <div className="h-px bg-slate-100 my-1.5 mx-1"></div>
                    <button onClick={() => { onDeletePlan(contextMenu.plan!.id); setContextMenu(null); }} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-rose-50 text-rose-500 font-bold text-xs transition-all">
                        <Trash2 size={14} /> 删除此日程
                    </button>
                </>
            ) : (
                <button onClick={() => { onSlotClick(contextMenu.date!); setContextMenu(null); }} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all group">
                    <div className="w-7 h-7 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Plus size={16} />
                    </div>
                    <div className="flex flex-col text-left">
                        <span>新建日程</span>
                        <span className="text-[10px] text-slate-400 font-normal">{contextMenu.timeStr}</span>
                    </div>
                </button>
            )}
        </div>,
        document.body
      )}
    </div>
  );
};