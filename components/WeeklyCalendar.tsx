
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WorkPlan, PlanStatus } from '../types';
import { format, addDays, isSameDay, getHours, getMinutes, differenceInMinutes, addMinutes, startOfWeek } from 'date-fns';
import { Plus, Clock, Move, Tag, CheckCircle2, Circle, PlayCircle, Edit2, Trash2, AlignLeft } from 'lucide-react';

interface WeeklyCalendarProps {
  currentDate: Date;
  plans: WorkPlan[];
  onPlanClick: (plan: WorkPlan) => void;
  onSlotClick: (date: Date) => void;
  onPlanUpdate: (plan: WorkPlan) => void;
  onDeletePlan: (id: string) => void;
  onDateSelect: (date: Date) => void;
  onDragCreate: (startDate: Date, durationMinutes: number, title?: string, color?: string, tags?: string[]) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_TO_SHOW = 7;
const WEEKDAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const SIDEBAR_WIDTH = 60; 
const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

const DEFAULT_ROW_HEIGHT = 48;
const BASE_COL_MIN_WIDTH = 130; 

const STATUS_LABELS = {
  [PlanStatus.TODO]: '待办',
  [PlanStatus.IN_PROGRESS]: '执行中',
  [PlanStatus.DONE]: '已完成',
};

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
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; date?: Date; timeStr?: string; plan?: WorkPlan } | null>(null);
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

  const rowHeight = DEFAULT_ROW_HEIGHT;
  const colMinWidth = BASE_COL_MIN_WIDTH;

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
    const rawMinutes = ((e.clientY - rect.top) / rowHeight) * 60;
    const snappedMinutes = Math.floor(rawMinutes / 15) * 15;

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
        const snappedMinutes = Math.floor(((e.clientY - rect.top) / rowHeight) * 60 / 15) * 15;
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

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const currentTimeTop = (getHours(now) * 60 + getMinutes(now)) / 60 * rowHeight;

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

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-[0_4px_30px_rgb(0,0,0,0.03)] border border-slate-100 overflow-hidden relative">
      <div ref={containerRef} className="flex-1 overflow-auto custom-scrollbar relative bg-slate-50/10">
        <div className="min-w-max flex flex-col">
            <div className="sticky top-0 z-40 flex border-b border-slate-200/60 bg-white">
                <div className="sticky left-0 z-50 bg-white border-r border-slate-50" style={{ width: SIDEBAR_WIDTH }}></div>
                <div className="flex flex-1">
                    {weekDays.map((day) => {
                        const isSelected = isSameDay(day, currentDate);
                        return (
                            <div key={day.toISOString()} className={`flex-1 py-3 flex flex-col items-center justify-center cursor-pointer transition-colors border-r border-slate-100/50 hover:bg-slate-50 ${isSelected ? 'bg-blue-50/20' : ''}`} style={{ minWidth: colMinWidth }} onClick={() => onDateSelect(day)}>
                                <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isSameDay(day, new Date()) ? 'text-blue-600' : 'text-slate-400'}`}>{WEEKDAYS_ZH[day.getDay()]}</span>
                                <div className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-slate-900 text-white' : (isSameDay(day, new Date()) ? 'text-blue-600 bg-blue-50' : 'text-slate-800')}`}>{format(day, 'd')}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex relative">
                <div className="sticky left-0 z-30 bg-white border-r border-slate-100 flex-shrink-0" style={{ width: SIDEBAR_WIDTH }}>
                    {HOURS.map((hour) => (
                        <div key={hour} className="relative w-full" style={{ height: `${rowHeight}px` }}>
                            <span className="absolute -top-2.5 right-3 text-[10px] text-slate-400 font-bold font-mono opacity-50">{hour.toString().padStart(2, '0')}:00</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-1 relative">
                    <div className="absolute inset-0 flex flex-col pointer-events-none">
                        {HOURS.map((h) => <div key={h} className="border-b border-slate-100/60" style={{ height: `${rowHeight}px` }} />)}
                    </div>

                    {weekDays.map((day) => {
                        const dayPlans = plans.filter(p => isSameDay(new Date(p.startDate), day));
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
                                        const snappedMinutes = Math.floor(((e.clientY - rect.top) / rowHeight) * 60 / 15) * 15;
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
                                            top: `${(dragInfo.activeMinutes / 60) * rowHeight}px`, 
                                            height: `${(dragInfo.durationMins / 60) * rowHeight}px` 
                                        }}
                                    >
                                        <div 
                                            className={`
                                                absolute left-2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-full shadow-[0_12px_35px_rgba(0,0,0,0.4)] 
                                                font-bold flex items-center gap-2 whitespace-nowrap transition-all duration-200 z-[100]
                                                ${dragInfo.activeMinutes < 60 ? 'top-3' : '-top-14'}
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
                                    const top = (getHours(start) * 60 + getMinutes(start)) / 60 * rowHeight;
                                    const h = Math.max(differenceInMinutes(end, start) / 60 * rowHeight, 18);
                                    const isDone = plan.status === PlanStatus.DONE;
                                    const timeRangeStr = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;

                                    // 智能显示分级逻辑
                                    // 极小尺寸 (H < 35px): 仅标题+图标
                                    // 小型尺寸 (35 <= H < 65px): 标题+紧凑起止时间
                                    // 中型尺寸 (65 <= H < 100px): 标题+状态标签+起止时间
                                    // 大型尺寸 (100 <= H < 160px): 标题+状态标签+起止时间+标签列表
                                    // 巨型尺寸 (H >= 160px): 标题+状态标签+起止时间+备注预览+标签列表

                                    return (
                                        <div
                                            key={plan.id}
                                            draggable
                                            onDragStart={(e) => handleDragStartExisting(e, plan)}
                                            onDragEnd={() => setDragInfo(null)}
                                            onContextMenu={(e) => handleCardContextMenu(e, plan)}
                                            style={{ top: `${top}px`, height: `${h}px` }}
                                            className={`
                                                absolute inset-x-1 rounded-xl border z-10 cursor-grab active:cursor-grabbing overflow-hidden transition-all flex flex-col
                                                shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:z-30 hover:shadow-lg backdrop-blur-md group
                                                ${isDone 
                                                    ? `bg-slate-50/75 border-slate-100 opacity-60` 
                                                    : `bg-${plan.color}-50/90 border-${plan.color}-200/60 hover:border-${plan.color}-400 hover:bg-${plan.color}-50 text-${plan.color}-900`
                                                }
                                                ${dragInfo?.planId === plan.id ? 'opacity-20 scale-95' : ''}
                                                ${h < 35 ? 'p-1 px-1.5' : h < 100 ? 'p-2' : h < 160 ? 'p-2.5' : 'p-3'}
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
                                                        {h >= 65 ? (
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

                                                    {h >= 160 && plan.description && (
                                                        <div className="mt-2 text-[11px] text-slate-500 leading-snug line-clamp-3 opacity-80 flex items-start gap-1.5">
                                                            <AlignLeft size={10} className="mt-1 flex-shrink-0 opacity-40" />
                                                            <span className="flex-1">{plan.description}</span>
                                                        </div>
                                                    )}

                                                    {h >= 100 && plan.tags && plan.tags.length > 0 && (
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
