
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WorkPlan, PlanStatus } from '../types';
import { format, isSameDay, addDays, differenceInMinutes, isToday } from 'date-fns';
import { CheckCircle2, Circle, Clock, Target, CalendarDays, Plus, Trash2, Zap, FileSearch, Users, PencilRuler, ShieldCheck, ChevronDown, ChevronUp, PlayCircle, Copy, CalendarPlus, Timer, ArrowLeftCircle } from 'lucide-react';

interface TaskSidebarProps {
  currentDate: Date;
  plans: WorkPlan[];
  onPlanClick: (plan: WorkPlan) => void;
  onPlanUpdate: (plan: WorkPlan) => void;
  onDuplicatePlan: (id: string, targetDate?: Date) => void;
  onDeletePlan: (id: string) => void;
  onCreateNew: () => void;
  onQuickAdd: (title: string, duration: number, color: string) => void;
  onJumpToToday?: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  plan: WorkPlan;
}

const STATUS_CONFIG = {
  [PlanStatus.TODO]: { 
    label: '待办', 
    icon: Circle, 
    color: 'slate',
    badgeClass: 'bg-slate-100 text-slate-600'
  },
  [PlanStatus.IN_PROGRESS]: { 
    label: '进行中', 
    icon: PlayCircle, 
    color: 'blue',
    badgeClass: 'bg-blue-600 text-white shadow-sm'
  },
  [PlanStatus.DONE]: { 
    label: '已完成', 
    icon: CheckCircle2, 
    color: 'emerald',
    badgeClass: 'bg-emerald-100 text-emerald-700'
  },
};

const TASK_TEMPLATES = [
  { title: '需求评审', minutes: 180, icon: FileSearch, color: 'purple', label: '3h', tags: ['需求', '评审'] },
  { title: '例行周会', minutes: 120, icon: Users, color: 'blue', label: '2h', tags: ['例行', '会议'] },
  { title: '详细设计评审', minutes: 120, icon: PencilRuler, color: 'indigo', label: '2h', tags: ['设计', '技术'] },
  { title: '测试用例评审', minutes: 120, icon: ShieldCheck, color: 'orange', label: '2h', tags: ['测试', 'QA'] },
];

const formatDuration = (start: string, end: string) => {
    const diff = differenceInMinutes(new Date(end), new Date(start));
    if (diff < 60) return `${diff}m`;
    const hours = (diff / 60).toFixed(1).replace('.0', '');
    return `${hours}h`;
};

export const TaskSidebar: React.FC<TaskSidebarProps> = ({ 
  currentDate, 
  plans, 
  onPlanClick, 
  onPlanUpdate,
  onDuplicatePlan,
  onDeletePlan,
  onCreateNew,
  onQuickAdd,
  onJumpToToday
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(true);

  const dailyPlans = useMemo(() => {
    return plans
      .filter(p => isSameDay(new Date(p.startDate), currentDate))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [plans, currentDate]);

  const stats = useMemo(() => {
    const total = dailyPlans.length;
    const done = dailyPlans.filter(p => p.status === PlanStatus.DONE).length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, progress };
  }, [dailyPlans]);

  const isSelectedToday = isToday(currentDate);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    window.addEventListener('scroll', handleClickOutside, true);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('scroll', handleClickOutside, true);
    };
  }, []);

  const handleToggleStatus = (e: React.MouseEvent, plan: WorkPlan, status?: PlanStatus) => {
    e.stopPropagation();
    const newStatus = status || (plan.status === PlanStatus.DONE ? PlanStatus.TODO : PlanStatus.DONE);
    onPlanUpdate({ ...plan, status: newStatus });
    setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, template: typeof TASK_TEMPLATES[0]) => {
      const dragData = { type: 'PRESET_DURATION', minutes: template.minutes, title: template.title, color: template.color, tags: template.tags };
      (window as any).__ACTIVE_DRAG_TEMPLATE__ = dragData;
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copyMove';
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-slate-200/60 flex-shrink-0 z-20 overflow-hidden relative">
      <div className="p-5 pt-6 flex-none bg-slate-50/30">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                <Target className={isSelectedToday ? "text-indigo-500" : "text-slate-400"} size={16} />
                {isSelectedToday ? '今日汇总' : `${format(currentDate, 'M月d日')} 汇总`}
            </h2>
            {!isSelectedToday && (
              <button 
                onClick={onJumpToToday}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 transition-all active:scale-95"
              >
                <ArrowLeftCircle size={10} />
                回到今天
              </button>
            )}
            {isSelectedToday && stats.total > 0 && (
              <div className="text-[11px] text-indigo-600 font-black bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/50">
                  {stats.done}/{stats.total}
              </div>
            )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-200/60 rounded-full h-1 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSelectedToday ? 'bg-indigo-500' : 'bg-slate-400'}`} 
                style={{ width: `${stats.progress}%` }}
              ></div>
          </div>
          <span className="text-[10px] font-black text-slate-400 w-7 text-right">{stats.progress}%</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {dailyPlans.length > 0 ? (
          dailyPlans.map(plan => {
            const isDone = plan.status === PlanStatus.DONE;
            const statusInfo = STATUS_CONFIG[plan.status];
            const StatusIconComp = statusInfo.icon;
            const duration = formatDuration(plan.startDate, plan.endDate);
            return (
              <div key={plan.id} onClick={() => onPlanClick(plan)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, plan }); }}
                className={`group relative flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none hover:shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 ${isDone ? 'bg-slate-50/50 border-slate-100' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
              >
                <button onClick={(e) => handleToggleStatus(e, plan)} className={`flex-shrink-0 mt-0.5 transition-all duration-300 ${isDone ? 'text-emerald-500' : 'text-slate-200 group-hover:text-indigo-400'}`}>
                    <StatusIconComp size={20} strokeWidth={2.5} className={isDone ? 'fill-emerald-50' : ''} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className={`text-[14px] font-bold tracking-tight truncate leading-tight mb-2 ${isDone ? 'text-slate-300 line-through' : 'text-slate-700'}`}>{plan.title}</div>
                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3">
                        <div className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-tighter ${statusInfo.badgeClass}`}>
                            {statusInfo.label}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-bold">
                            <div className="text-slate-400 flex items-center gap-1">
                                <Clock size={11} strokeWidth={3} />
                                <span>{format(new Date(plan.startDate), 'HH:mm')} - {format(new Date(plan.endDate), 'HH:mm')}</span>
                            </div>
                            <div className="text-indigo-500 bg-indigo-50/50 px-1.5 py-0.5 rounded border border-indigo-100/50 flex items-center gap-1">
                                <Timer size={10} strokeWidth={3} />
                                <span>{duration}</span>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-32 flex flex-col items-center justify-center text-slate-500 space-y-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 animate-in fade-in duration-500">
             <CalendarDays size={24} className="opacity-40" />
             <span className="text-[11px] font-bold uppercase tracking-widest">该日暂无日程</span>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/30 flex-none p-4">
        <button onClick={() => setIsTemplatesExpanded(!isTemplatesExpanded)} className="w-full flex items-center justify-between py-1 hover:bg-white rounded-lg transition-all group mb-3 px-1">
            <div className="flex items-center gap-2"><Zap size={12} className="text-amber-500 fill-amber-500" /><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">原子模版</span></div>
            {isTemplatesExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronUp size={14} className="text-slate-300" />}
        </button>
        {isTemplatesExpanded && (
            <div className="grid grid-cols-2 gap-2">
                {TASK_TEMPLATES.map((template) => (
                    <div key={template.title} draggable onDragStart={(e) => handleDragStart(e, template)} onClick={() => onQuickAdd(template.title, template.minutes, template.color)} className="flex flex-col p-3 rounded-xl border border-slate-100 bg-white cursor-grab active:cursor-grabbing transition-all hover:border-indigo-200 group">
                        <div className="flex items-center justify-between mb-2">
                            <div className={`w-7 h-7 flex items-center justify-center rounded-lg bg-${template.color}-50 text-${template.color}-600 group-hover:bg-${template.color}-500 group-hover:text-white transition-all`}>
                                <template.icon size={14} />
                            </div>
                            <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">{template.label}</span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-600 truncate">{template.title}</div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {contextMenu && createPortal(
        <div className="fixed z-[9999] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 w-48 overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 340), left: Math.min(contextMenu.x, window.innerWidth - 200) }}
        >
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">复刻与复制</div>
            <button onClick={() => { onDuplicatePlan(contextMenu.plan.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2.5 rounded-lg transition-colors">
                <Copy size={14} /> 复刻任务
            </button>
            <button onClick={() => { 
                const tomorrow = addDays(new Date(contextMenu.plan.startDate), 1);
                onDuplicatePlan(contextMenu.plan.id, tomorrow); 
                setContextMenu(null); 
            }} className="w-full text-left px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2.5 rounded-lg transition-colors">
                <CalendarPlus size={14} /> 明天继续
            </button>
            <div className="h-px bg-slate-100 my-1.5 mx-1"></div>
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">状态标记</div>
            <button onClick={(e) => handleToggleStatus(e, contextMenu.plan, PlanStatus.DONE)} className="w-full text-left px-3 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5 rounded-lg transition-colors"><CheckCircle2 size={14} /> 已完成</button>
            <button onClick={() => { onDeletePlan(contextMenu.plan.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 flex items-center gap-2.5 rounded-lg transition-colors"><Trash2 size={14} /> 删除计划</button>
        </div>,
        document.body
      )}
    </div>
  );
};
