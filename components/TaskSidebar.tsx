
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WorkPlan, PlanStatus } from '../types';
import { format, isSameDay } from 'date-fns';
import { CheckCircle2, Circle, Clock, Target, CalendarDays, Plus, Trash2, Zap, FileSearch, Users, PencilRuler, ShieldCheck, ChevronDown, ChevronUp, PlayCircle } from 'lucide-react';

interface TaskSidebarProps {
  currentDate: Date;
  plans: WorkPlan[];
  onPlanClick: (plan: WorkPlan) => void;
  onPlanUpdate: (plan: WorkPlan) => void;
  onDeletePlan: (id: string) => void;
  onCreateNew: () => void;
  onQuickAdd: (title: string, duration: number, color: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  plan: WorkPlan;
}

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

const STATUS_CONFIG = {
  [PlanStatus.TODO]: { label: '待办', icon: Circle, color: 'slate' },
  [PlanStatus.IN_PROGRESS]: { label: '进行中', icon: PlayCircle, color: 'blue' },
  [PlanStatus.DONE]: { label: '已完成', icon: CheckCircle2, color: 'emerald' },
};

const TASK_TEMPLATES = [
  { title: '需求评审', minutes: 180, icon: FileSearch, color: 'purple', label: '3h', tags: ['需求', '评审'] },
  { title: '例行周会', minutes: 120, icon: Users, color: 'blue', label: '2h', tags: ['例行', '会议'] },
  { title: '详细设计评审', minutes: 120, icon: PencilRuler, color: 'indigo', label: '2h', tags: ['设计', '技术'] },
  { title: '测试用例评审', minutes: 120, icon: ShieldCheck, color: 'orange', label: '2h', tags: ['测试', 'QA'] },
];

export const TaskSidebar: React.FC<TaskSidebarProps> = ({ 
  currentDate, 
  plans, 
  onPlanClick, 
  onPlanUpdate,
  onDeletePlan,
  onCreateNew,
  onQuickAdd
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(true);

  const dailyPlans = useMemo(() => {
    const today = new Date();
    return plans
      .filter(p => isSameDay(new Date(p.startDate), today))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [plans]);

  const stats = useMemo(() => {
    const total = dailyPlans.length;
    const done = dailyPlans.filter(p => p.status === PlanStatus.DONE).length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    return { total, done, progress };
  }, [dailyPlans]);

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

  const handleChangeColor = (e: React.MouseEvent, plan: WorkPlan, color: string) => {
    e.stopPropagation();
    onPlanUpdate({ ...plan, color });
    setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, template: typeof TASK_TEMPLATES[0]) => {
      const dragData = { 
          type: 'PRESET_DURATION', 
          minutes: template.minutes,
          title: template.title,
          color: template.color,
          tags: template.tags 
      };
      
      const jsonString = JSON.stringify(dragData);
      (window as any).__ACTIVE_DRAG_TEMPLATE__ = dragData;
      
      e.dataTransfer.setData('application/json', jsonString);
      e.dataTransfer.setData('text/plain', jsonString); 
      e.dataTransfer.effectAllowed = 'copyMove';
      
      const ghost = document.createElement('div');
      ghost.className = `fixed -top-[1000px] p-2 px-4 bg-slate-900 text-white rounded-full text-xs font-bold shadow-2xl border border-white/20 flex items-center gap-2`;
      ghost.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg> ${template.title}`;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, 0, 0);
      setTimeout(() => document.body.removeChild(ghost), 0);
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-slate-200/60 flex-shrink-0 z-20 overflow-hidden relative">
      <div className="p-5 pb-3 flex-none">
        <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Target className="text-indigo-600" size={18} />
                今日任务
            </h2>
            <button onClick={onCreateNew} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                <Plus size={18} />
            </button>
        </div>
        <div className="text-xs text-slate-400 font-medium mb-3">
            {format(new Date(), 'MM月dd日')} · 已完成 {stats.done}/{stats.total}
        </div>
        <div className="bg-slate-100 rounded-full h-1.5 w-full overflow-hidden flex">
            <div className="bg-indigo-500 h-full transition-all duration-500 ease-out" style={{ width: `${stats.progress}%` }}></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-0 space-y-2">
        {dailyPlans.length > 0 ? (
          dailyPlans.map(plan => {
            const isDone = plan.status === PlanStatus.DONE;
            const statusInfo = STATUS_CONFIG[plan.status];
            const StatusIconComp = statusInfo.icon;
            const timeStr = `${format(new Date(plan.startDate), 'HH:mm')} - ${format(new Date(plan.endDate), 'HH:mm')}`;

            return (
              <div key={plan.id} onClick={() => onPlanClick(plan)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, plan });
                }}
                className={`group flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm select-none ${isDone ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200/60 hover:border-indigo-200'}`}
              >
                <button onClick={(e) => handleToggleStatus(e, plan)} className={`mt-0.5 flex-shrink-0 transition-colors ${isDone ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}>
                    <StatusIconComp size={18} className={isDone ? 'fill-emerald-50' : ''} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className={`text-sm font-semibold leading-tight truncate ${isDone ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{plan.title}</div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-${statusInfo.color}-50 text-${statusInfo.color}-600 border border-${statusInfo.color}-100 flex-shrink-0`}>
                            {statusInfo.label}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 font-bold font-mono">
                        <Clock size={10} className="text-slate-300" />
                        {timeStr}
                        <span className={`w-1.5 h-1.5 rounded-full bg-${plan.color}-400 ml-1`}></span>
                    </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-32 flex flex-col items-center justify-center text-slate-300 space-y-2 border-2 border-dashed border-slate-50 rounded-xl m-2">
             <CalendarDays size={24} className="opacity-30" />
             <span className="text-[11px]">今日暂无安排</span>
          </div>
        )}
      </div>

      <div className="mt-auto border-t border-slate-100 bg-slate-50/50 flex-none">
        <button 
            onClick={() => setIsTemplatesExpanded(!isTemplatesExpanded)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-100 transition-colors group"
        >
            <div className="flex items-center gap-2">
                <Zap size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">原子模版 (可拖拽)</span>
            </div>
            {isTemplatesExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronUp size={14} className="text-slate-300" />}
        </button>

        {isTemplatesExpanded && (
            <div className="px-4 pb-5">
                <div className="grid grid-cols-2 gap-2">
                    {TASK_TEMPLATES.map((template) => (
                        <div
                            key={template.title}
                            draggable
                            onDragStart={(e) => handleDragStart(e, template)}
                            onDragEnd={() => { (window as any).__ACTIVE_DRAG_TEMPLATE__ = null; }}
                            onClick={() => onQuickAdd(template.title, template.minutes, template.color)}
                            className={`
                                flex flex-col p-2.5 rounded-xl border border-slate-200 bg-white cursor-grab active:cursor-grabbing transition-all hover:border-${template.color}-300 hover:shadow-md active:scale-[0.96] group
                            `}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <div className={`w-6 h-6 flex items-center justify-center rounded-lg bg-${template.color}-50 text-${template.color}-600 group-hover:bg-${template.color}-500 group-hover:text-white transition-colors`}>
                                    <template.icon size={12} />
                                </div>
                                <span className="text-[9px] font-bold text-slate-400 group-hover:text-slate-500">{template.label}</span>
                            </div>
                            <div className="text-[11px] font-bold text-slate-700 truncate leading-tight mt-1">
                                {template.title}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {contextMenu && createPortal(
        <div className="fixed z-[9999] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 w-44 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-1.5"
          style={{ 
              top: Math.min(contextMenu.y, window.innerHeight - 280), 
              left: Math.min(contextMenu.x, window.innerWidth - 190) 
          }}
        >
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">标记状态 (切换)</div>
            
            {contextMenu.plan.status !== PlanStatus.TODO && (
              <button onClick={(e) => handleToggleStatus(e, contextMenu.plan, PlanStatus.TODO)} className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 rounded-lg transition-colors"><Circle size={14} /> 设为待办</button>
            )}
            {contextMenu.plan.status !== PlanStatus.IN_PROGRESS && (
              <button onClick={(e) => handleToggleStatus(e, contextMenu.plan, PlanStatus.IN_PROGRESS)} className="w-full text-left px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2.5 rounded-lg transition-colors"><PlayCircle size={14} /> 标记进行中</button>
            )}
            {contextMenu.plan.status !== PlanStatus.DONE && (
              <button onClick={(e) => handleToggleStatus(e, contextMenu.plan, PlanStatus.DONE)} className="w-full text-left px-3 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5 rounded-lg transition-colors"><CheckCircle2 size={14} /> 标记已完成</button>
            )}
            
            <div className="h-px bg-slate-100 my-1.5 mx-1"></div>
            
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">快捷标记</div>
            <div className="grid grid-cols-6 gap-1 px-2 pb-2 mt-1">
                {COLORS.map(c => (
                    <button 
                        key={c}
                        onClick={(e) => handleChangeColor(e, contextMenu.plan, c)}
                        className={`w-5 h-5 rounded-full bg-${c}-500 hover:scale-125 transition-transform ring-2 ring-transparent hover:ring-white shadow-sm ${contextMenu.plan.color === c ? 'ring-slate-400' : ''}`}
                    />
                ))}
            </div>

            <div className="h-px bg-slate-100 my-1.5 mx-1"></div>
            <button onClick={() => { onDeletePlan(contextMenu.plan.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 flex items-center gap-2.5 rounded-lg transition-colors"><Trash2 size={14} /> 删除计划</button>
        </div>,
        document.body
      )}
    </div>
  );
};
