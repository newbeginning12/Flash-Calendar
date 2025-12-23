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
  [PlanStatus.TODO]: { 
    label: '待办', 
    icon: Circle, 
    color: 'slate',
    badgeClass: 'bg-slate-50 text-slate-400 border-slate-100'
  },
  [PlanStatus.IN_PROGRESS]: { 
    label: '进行中', 
    icon: PlayCircle, 
    color: 'blue',
    badgeClass: 'bg-blue-50 text-blue-600 border-blue-100'
  },
  [PlanStatus.DONE]: { 
    label: '已完成', 
    icon: CheckCircle2, 
    color: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-600 border-emerald-100'
  },
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

  const handleDragStart = (e: React.DragEvent, template: typeof TASK_TEMPLATES[0]) => {
      const dragData = { type: 'PRESET_DURATION', minutes: template.minutes, title: template.title, color: template.color, tags: template.tags };
      (window as any).__ACTIVE_DRAG_TEMPLATE__ = dragData;
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copyMove';
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-slate-200/60 flex-shrink-0 z-20 overflow-hidden relative">
      
      {/* 侧边栏顶部：紧凑后的今日任务汇总 */}
      <div className="p-5 pt-6 flex-none bg-slate-50/30">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                <Target className="text-indigo-500" size={16} />
                今日汇总
            </h2>
            <div className="text-[11px] text-indigo-600 font-black bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/50">
                {stats.done}/{stats.total}
            </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-200/60 rounded-full h-1 overflow-hidden">
              <div className="bg-indigo-500 h-full transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]" style={{ width: `${stats.progress}%` }}></div>
          </div>
          <span className="text-[10px] font-black text-slate-400 w-7 text-right">{stats.progress}%</span>
        </div>
      </div>

      {/* 列表区：压缩垂直间距 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {dailyPlans.length > 0 ? (
          dailyPlans.map(plan => {
            const isDone = plan.status === PlanStatus.DONE;
            const statusInfo = STATUS_CONFIG[plan.status];
            const StatusIconComp = statusInfo.icon;
            return (
              <div key={plan.id} onClick={() => onPlanClick(plan)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, plan }); }}
                className={`group relative flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none hover:shadow-[0_4px_15px_-5px_rgba(0,0,0,0.05)] ${isDone ? 'bg-slate-50/50 border-slate-100' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
              >
                {/* 左侧选择圈 */}
                <button onClick={(e) => handleToggleStatus(e, plan)} className={`flex-shrink-0 transition-all duration-300 ${isDone ? 'text-emerald-500' : 'text-slate-200 group-hover:text-indigo-400'}`}>
                    <StatusIconComp size={22} strokeWidth={2} className={isDone ? 'fill-emerald-50' : ''} />
                </button>

                {/* 中间信息：紧凑排列 */}
                <div className="flex-1 min-w-0">
                    <div className={`text-[14px] font-bold tracking-tight truncate leading-none mb-1.5 ${isDone ? 'text-slate-300 line-through' : 'text-slate-700'}`}>
                        {plan.title}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="text-[11px] text-slate-400 font-bold flex items-center gap-1 opacity-80">
                            <Clock size={11} strokeWidth={3} />
                            {format(new Date(plan.startDate), 'HH:mm')} - {format(new Date(plan.endDate), 'HH:mm')}
                        </div>
                        {/* 颜色圆点 */}
                        <div className={`w-1 h-1 rounded-full bg-${plan.color}-400`}></div>
                    </div>
                </div>

                {/* 右上角状态标签：差异化色彩方案 */}
                <div className="absolute top-3 right-3">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0 uppercase tracking-tighter border transition-colors ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                    </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-32 flex flex-col items-center justify-center text-slate-500 space-y-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
             <CalendarDays size={24} className="opacity-40" />
             <span className="text-[11px] font-bold uppercase tracking-widest">暂无日程安排</span>
          </div>
        )}
      </div>

      {/* 底部模版区域：压缩内边距 */}
      <div className="border-t border-slate-100 bg-slate-50/30 flex-none p-4">
        <button 
            onClick={() => setIsTemplatesExpanded(!isTemplatesExpanded)}
            className="w-full flex items-center justify-between py-1 hover:bg-white rounded-lg transition-all group mb-3 px-1"
        >
            <div className="flex items-center gap-2">
                <Zap size={12} className="text-amber-500 fill-amber-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">原子模版</span>
            </div>
            {isTemplatesExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronUp size={14} className="text-slate-300" />}
        </button>

        {isTemplatesExpanded && (
            <div className="grid grid-cols-2 gap-2">
                {TASK_TEMPLATES.map((template) => (
                    <div key={template.title} draggable onDragStart={(e) => handleDragStart(e, template)} onClick={() => onQuickAdd(template.title, template.minutes, template.color)} className="flex flex-col p-3 rounded-xl border border-slate-100 bg-white cursor-grab active:cursor-grabbing transition-all hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 group">
                        <div className="flex items-center justify-between mb-2">
                            <div className={`w-7 h-7 flex items-center justify-center rounded-lg bg-${template.color}-50 text-${template.color}-600 group-hover:bg-${template.color}-500 group-hover:text-white transition-all duration-300`}>
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
        <div className="fixed z-[9999] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 w-44 overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-150"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 280), left: Math.min(contextMenu.x, window.innerWidth - 190) }}
        >
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">标记状态</div>
            <button onClick={(e) => handleToggleStatus(e, contextMenu.plan, PlanStatus.TODO)} className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-2.5 rounded-lg transition-colors"><Circle size={14} /> 待办</button>
            <button onClick={(e) => handleToggleStatus(e, contextMenu.plan, PlanStatus.IN_PROGRESS)} className="w-full text-left px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 flex items-center gap-2.5 rounded-lg transition-colors"><PlayCircle size={14} /> 进行中</button>
            <button onClick={(e) => handleToggleStatus(e, contextMenu.plan, PlanStatus.DONE)} className="w-full text-left px-3 py-2 text-sm font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center gap-2.5 rounded-lg transition-colors"><CheckCircle2 size={14} /> 已完成</button>
            <div className="h-px bg-slate-100 my-1.5 mx-1"></div>
            <button onClick={() => { onDeletePlan(contextMenu.plan.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-sm font-semibold text-rose-500 hover:bg-rose-50 flex items-center gap-2.5 rounded-lg transition-colors"><Trash2 size={14} /> 删除计划</button>
        </div>,
        document.body
      )}
    </div>
  );
};