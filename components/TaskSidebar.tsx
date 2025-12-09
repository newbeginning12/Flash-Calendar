
import React, { useMemo, useState, useEffect } from 'react';
import { WorkPlan, PlanStatus } from '../types';
import { format, isSameDay } from 'date-fns';
import { CheckCircle2, Circle, Clock, Target, CalendarDays, Plus, Edit2, Trash2, GripVertical, Zap } from 'lucide-react';

interface TaskSidebarProps {
  currentDate: Date;
  plans: WorkPlan[];
  onPlanClick: (plan: WorkPlan) => void;
  onPlanUpdate: (plan: WorkPlan) => void;
  onDeletePlan: (id: string) => void;
  onCreateNew: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  plan: WorkPlan;
}

const PRESET_DURATIONS = [
  { label: '30分钟', minutes: 30, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { label: '1小时', minutes: 60, color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { label: '2小时', minutes: 120, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { label: '4小时', minutes: 240, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { label: '6小时', minutes: 360, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { label: '8小时', minutes: 480, color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

export const TaskSidebar: React.FC<TaskSidebarProps> = ({ 
  currentDate, 
  plans, 
  onPlanClick, 
  onPlanUpdate,
  onDeletePlan,
  onCreateNew
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Filter and Sort Plans
  const dailyPlans = useMemo(() => {
    return plans
      .filter(p => isSameDay(new Date(p.startDate), currentDate))
      .sort((a, b) => {
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
  }, [plans, currentDate]);

  const stats = useMemo(() => {
    const total = dailyPlans.length;
    const done = dailyPlans.filter(p => p.status === PlanStatus.DONE).length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, progress };
  }, [dailyPlans]);

  // Handle Context Menu Outside Click
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleClickOutside, true);
    return () => {
        window.removeEventListener('click', handleClickOutside);
        window.removeEventListener('scroll', handleClickOutside, true);
    };
  }, []);

  const handleToggleStatus = (e: React.MouseEvent, plan: WorkPlan) => {
    e.stopPropagation();
    const newStatus = plan.status === PlanStatus.DONE ? PlanStatus.TODO : PlanStatus.DONE;
    onPlanUpdate({ ...plan, status: newStatus });
  };

  const handleContextMenu = (e: React.MouseEvent, plan: WorkPlan) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
        x: e.clientX,
        y: e.clientY,
        plan
    });
  };

  const handleMenuAction = (action: 'EDIT' | 'TOGGLE' | 'DELETE') => {
      if (!contextMenu) return;
      const { plan } = contextMenu;
      
      switch(action) {
          case 'EDIT':
              onPlanClick(plan);
              break;
          case 'TOGGLE':
               const newStatus = plan.status === PlanStatus.DONE ? PlanStatus.TODO : PlanStatus.DONE;
               onPlanUpdate({ ...plan, status: newStatus });
              break;
          case 'DELETE':
              onDeletePlan(plan.id);
              break;
      }
      setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, minutes: number) => {
      e.dataTransfer.setData('application/json', JSON.stringify({ type: 'PRESET_DURATION', minutes }));
      e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-slate-200/60 flex-shrink-0 z-20 overflow-hidden relative">
      {/* Header */}
      <div className="p-6 pb-4 flex-none">
        <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 whitespace-nowrap">
                <Target className="text-indigo-600" size={20} />
                今日任务
            </h2>
            <button 
                onClick={onCreateNew}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                title="新建任务"
            >
                <Plus size={20} />
            </button>
        </div>
        <div className="text-sm text-slate-500 font-medium mb-4 whitespace-nowrap">
            {format(currentDate, 'M月d日')} · 共 {stats.total} 项任务
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-100 rounded-full h-2 w-full overflow-hidden flex">
            <div 
                className="bg-indigo-500 h-full transition-all duration-500 ease-out rounded-full"
                style={{ width: `${stats.progress}%` }}
            ></div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-slate-400 font-medium">
            <span>已完成 {stats.done}</span>
            <span>{stats.progress}%</span>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-0 space-y-2">
        {dailyPlans.length > 0 ? (
          dailyPlans.map(plan => {
            const isDone = plan.status === PlanStatus.DONE;
            return (
              <div 
                key={plan.id}
                onClick={() => onPlanClick(plan)}
                onContextMenu={(e) => handleContextMenu(e, plan)}
                className={`group flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-md select-none ${
                    isDone 
                        ? 'bg-slate-50 border-slate-100 opacity-70' 
                        : 'bg-white border-slate-200/60 hover:border-indigo-200'
                }`}
              >
                {/* Checkbox */}
                <button
                    onClick={(e) => handleToggleStatus(e, plan)}
                    className={`mt-0.5 flex-shrink-0 transition-colors ${
                        isDone ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'
                    }`}
                >
                    {isDone ? <CheckCircle2 size={20} className="fill-emerald-50" /> : <Circle size={20} />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium leading-tight mb-1 truncate ${
                        isDone ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-800'
                    }`}>
                        {plan.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            <Clock size={10} />
                            {format(new Date(plan.startDate), 'HH:mm')}
                        </span>
                        {plan.tags.length > 0 && (
                            <span className="truncate max-w-[80px]">#{plan.tags[0]}</span>
                        )}
                    </div>
                </div>

                {/* Color Indicator */}
                <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-${plan.color}-400`}></div>
              </div>
            );
          })
        ) : (
          <div className="h-48 flex flex-col items-center justify-center text-slate-400 space-y-3 border-2 border-dashed border-slate-100 rounded-xl m-2">
             <CalendarDays size={32} className="opacity-20" />
             <span className="text-sm whitespace-nowrap">今日暂无安排</span>
             <button 
                onClick={onCreateNew}
                className="text-xs text-indigo-600 font-medium hover:underline"
             >
                添加日程
             </button>
          </div>
        )}
      </div>

      {/* Quick Presets for Drag & Drop */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <Zap size={12} className="text-amber-500 fill-amber-500" />
            快速安排 (拖拽)
        </div>
        <div className="grid grid-cols-3 gap-2">
            {PRESET_DURATIONS.map((preset) => (
                <div
                    key={preset.minutes}
                    draggable
                    onDragStart={(e) => handleDragStart(e, preset.minutes)}
                    className={`
                        flex items-center justify-center gap-1 py-2 px-1 rounded-lg border cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:-translate-y-0.5
                        ${preset.color}
                    `}
                >
                    <GripVertical size={14} className="opacity-50" />
                    <span className="text-xs font-bold">{preset.label}</span>
                </div>
            ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[60] bg-white/95 backdrop-blur-xl rounded-xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.15)] border border-white/50 w-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 150), left: Math.min(contextMenu.x, window.innerWidth - 170) }}
        >
           <div className="py-1">
               <button onClick={() => handleMenuAction('EDIT')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors">
                  <Edit2 size={14} /> 编辑
               </button>
               <button onClick={() => handleMenuAction('TOGGLE')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors">
                  {contextMenu.plan?.status === PlanStatus.DONE ? <Circle size={14} /> : <CheckCircle2 size={14} />}
                  {contextMenu.plan?.status === PlanStatus.DONE ? '标记未完成' : '标记完成'}
               </button>
               <div className="h-px bg-slate-100 my-1"></div>
               <button onClick={() => handleMenuAction('DELETE')} className="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 flex items-center gap-2 transition-colors">
                  <Trash2 size={14} /> 删除
               </button>
            </div>
        </div>
      )}
    </div>
  );
};
