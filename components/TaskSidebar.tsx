
import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WorkPlan, PlanStatus } from '../types';
import { format, isSameDay, addDays, differenceInMinutes, isToday } from 'date-fns';
import { CheckCircle2, Circle, Clock, Target, CalendarDays, Plus, Trash2, Zap, FileSearch, Users, PencilRuler, ShieldCheck, ChevronDown, ChevronUp, PlayCircle, Copy, CalendarPlus, Timer, ArrowLeftCircle, Sparkles, FileText, Loader2, BarChart3, Activity, ArrowUpRight, MoreHorizontal, ChevronRight, MousePointer2, Info } from 'lucide-react';

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
  onMonthlyReview: () => void;
  onWeeklyReport: () => void;
  isProcessingReport?: boolean;
  isProcessingReview?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  plan: WorkPlan;
}

const STATUS_CONFIG = {
  [PlanStatus.TODO]: { label: '待办', icon: Circle, color: 'slate', badgeClass: 'bg-slate-100 text-slate-600' },
  [PlanStatus.IN_PROGRESS]: { label: '进行中', icon: PlayCircle, color: 'blue', badgeClass: 'bg-blue-600 text-white shadow-sm' },
  [PlanStatus.DONE]: { label: '已完成', icon: CheckCircle2, color: 'emerald', badgeClass: 'bg-emerald-100 text-emerald-700' },
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
  currentDate, plans, onPlanClick, onPlanUpdate, onDuplicatePlan, onDeletePlan, onCreateNew, onQuickAdd, onJumpToToday, onMonthlyReview, onWeeklyReport, 
  isProcessingReport = false,
  isProcessingReview = false
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  // 智能折叠状态
  const [isAiLabExpanded, setIsAiLabExpanded] = useState(true);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(true);
  const [hasUserToggledAi, setHasUserToggledAi] = useState(false);
  const [hasUserToggledTemplates, setHasUserToggledTemplates] = useState(false);

  const dailyPlans = useMemo(() => {
    return plans.filter(p => isSameDay(new Date(p.startDate), currentDate)).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [plans, currentDate]);

  // 智能折叠逻辑：任务超过4个时自动收起，任务少时且用户未手动操作过则自动展开
  useEffect(() => {
    if (dailyPlans.length > 4) {
      if (!hasUserToggledAi) setIsAiLabExpanded(false);
      if (!hasUserToggledTemplates) setIsTemplatesExpanded(false);
    } else {
      if (!hasUserToggledAi) setIsAiLabExpanded(true);
      if (!hasUserToggledTemplates) setIsTemplatesExpanded(true);
    }
  }, [dailyPlans.length, hasUserToggledAi, hasUserToggledTemplates]);

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
    return () => { window.removeEventListener('click', handleClickOutside); window.removeEventListener('scroll', handleClickOutside, true); };
  }, []);

  const handleToggleStatus = (e: React.MouseEvent, plan: WorkPlan, status?: PlanStatus) => {
    e.stopPropagation();
    onPlanUpdate({ ...plan, status: status || (plan.status === PlanStatus.DONE ? PlanStatus.TODO : PlanStatus.DONE) });
    setContextMenu(null);
  };

  const handleDragStart = (e: React.DragEvent, template: typeof TASK_TEMPLATES[0]) => {
      const dragData = { type: 'PRESET_DURATION', minutes: template.minutes, title: template.title, color: template.color, tags: template.tags };
      (window as any).__ACTIVE_DRAG_TEMPLATE__ = dragData;
      e.dataTransfer.setData('application/json', JSON.stringify(dragData)); e.dataTransfer.effectAllowed = 'copyMove';
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-slate-200/60 flex-shrink-0 z-20 overflow-hidden relative">
      
      {/* AI Hub Section - 还原原始大卡片设计 + 优化高度 + 智能折叠 */}
      <div className="p-5 flex-none space-y-3 bg-white border-b border-slate-50">
        <button 
          onClick={() => { setIsAiLabExpanded(!isAiLabExpanded); setHasUserToggledAi(true); }}
          className="w-full flex items-center justify-between px-1 py-1 hover:bg-slate-50 rounded-lg transition-all group"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-blue-500 fill-blue-500/10" />
            <span className="text-[11px] font-black text-slate-400 tracking-wider uppercase">AI 实验室</span>
          </div>
          <div className="flex items-center gap-2">
            {!isAiLabExpanded && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>}
            {isAiLabExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronRight size={14} className="text-slate-300" />}
          </div>
        </button>
        
        {isAiLabExpanded && (
          <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* 还原：珍珠白周报卡片 - 优化高度 */}
            <button 
              onClick={onWeeklyReport}
              disabled={isProcessingReport}
              className="group relative flex flex-col items-start py-4 px-4 rounded-[28px] bg-white border border-slate-100 shadow-[0_8px_25px_rgb(0,0,0,0.03)] hover:shadow-[0_15px_35px_rgba(59,130,246,0.06)] hover:border-blue-100 transition-all duration-300 active:scale-95 disabled:opacity-50 overflow-hidden text-left"
            >
              <div className="absolute right-0 top-0 opacity-[0.03] translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700">
                  <FileText size={64} />
              </div>
              <div className="mb-3 w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                  {isProcessingReport ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} strokeWidth={2.5} />}
              </div>
              <span className="text-[14px] font-black text-slate-800 tracking-tight leading-none mb-1">周报生成</span>
              <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">汇总节奏与洞察</span>
            </button>

            {/* 还原：深蓝渐变镜像诊断卡片 - 优化高度 */}
            <button 
              onClick={onMonthlyReview}
              disabled={isProcessingReview}
              className="group relative flex flex-col items-start py-4 px-4 rounded-[28px] bg-gradient-to-br from-blue-500 to-indigo-500 shadow-[0_10px_30px_rgba(59,130,246,0.25)] hover:shadow-[0_18px_45px_rgba(59,130,246,0.4)] hover:from-blue-600 hover:to-indigo-600 transition-all duration-300 active:scale-95 disabled:opacity-50 overflow-hidden text-left"
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute right-0 top-0 opacity-[0.15] translate-x-1/4 -translate-y-1/4 group-hover:scale-110 transition-transform duration-700">
                  <BarChart3 size={64} className="text-white" />
              </div>
              <div className="mb-3 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg group-hover:bg-white group-hover:text-blue-600 transition-all duration-300">
                  {isProcessingReview ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} strokeWidth={2.5} />}
              </div>
              <span className="text-[14px] font-black text-white tracking-tight leading-none mb-1">镜像诊断</span>
              <span className="text-[10px] font-bold text-blue-100/70 whitespace-nowrap">穿透数据真相</span>
            </button>
          </div>
        )}
      </div>

      <div className="p-5 pt-4 flex-none bg-white">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-[12px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                <Target className={isSelectedToday ? "text-blue-500" : "text-slate-400"} size={16} />
                {isSelectedToday ? '今日汇总' : `${format(currentDate, 'M月d日')} 汇总`}
            </h2>
            {!isSelectedToday && <button onClick={onJumpToToday} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 transition-all active:scale-95"><ArrowLeftCircle size={10} />回到今天</button>}
            {isSelectedToday && stats.total > 0 && <div className="text-[11px] text-blue-600 font-black bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100/50">{stats.done}/{stats.total}</div>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-200/60 rounded-full h-1 overflow-hidden">
              <div className={`h-full transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSelectedToday ? 'bg-blue-500' : 'bg-slate-400'}`} style={{ width: `${stats.progress}%` }}></div>
          </div>
          <span className="text-[10px] font-black text-slate-400 w-7 text-right">{stats.progress}%</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-0 space-y-2">
        {dailyPlans.length > 0 ? (
          dailyPlans.map(plan => {
            const isDone = plan.status === PlanStatus.DONE;
            const statusInfo = STATUS_CONFIG[plan.status];
            const StatusIconComp = statusInfo.icon;
            const duration = formatDuration(plan.startDate, plan.endDate);
            return (
              <div key={plan.id} onClick={() => onPlanClick(plan)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, plan }); }} className={`group relative flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none hover:shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 ${isDone ? 'bg-slate-50/50 border-slate-100' : 'bg-white border-slate-100 hover:border-blue-100'}`}>
                <button onClick={(e) => handleToggleStatus(e, plan)} className={`flex-shrink-0 mt-0.5 transition-all duration-300 ${isDone ? 'text-emerald-500' : 'text-slate-200 group-hover:text-blue-400'}`}><StatusIconComp size={20} strokeWidth={2.5} className={isDone ? 'fill-emerald-50' : ''} /></button>
                <div className="flex-1 min-w-0">
                    <div className={`text-[14px] font-bold tracking-tight truncate leading-tight mb-2 ${isDone ? 'text-slate-300 line-through' : 'text-slate-700'}`}>{plan.title}</div>
                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-3">
                        <div className={`inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[9px] font-black uppercase tracking-tighter ${statusInfo.badgeClass}`}>{statusInfo.label}</div>
                        <div className="flex items-center gap-3 text-[10px] font-bold">
                            <div className="text-slate-400 flex items-center gap-1"><Clock size={11} strokeWidth={3} /><span>{format(new Date(plan.startDate), 'HH:mm')} - {format(new Date(plan.endDate), 'HH:mm')}</span></div>
                            <div className="text-blue-500 bg-blue-50/50 px-1.5 py-0.5 rounded border border-blue-100/50 flex items-center gap-1"><Timer size={10} strokeWidth={3} /><span>{duration}</span></div>
                        </div>
                    </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-32 flex flex-col items-center justify-center text-slate-500 space-y-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 animate-in fade-in duration-500">
             <CalendarDays size={24} className="opacity-40" /><span className="text-[11px] font-bold uppercase tracking-widest">该日暂无日程</span>
          </div>
        )}
      </div>

      {/* 原子模版 - 还原原始大卡片设计 + 智能折叠 + 并排引导语 */}
      <div className="border-t border-slate-100 bg-slate-50/30 flex-none p-4">
        <button 
          onClick={() => { setIsTemplatesExpanded(!isTemplatesExpanded); setHasUserToggledTemplates(true); }}
          className="w-full flex items-center justify-between py-1 hover:bg-white rounded-lg transition-all group mb-3 px-1"
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <Zap size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">原子模版</span>
                <div className="w-px h-2 bg-slate-200/60 mx-0.5 hidden sm:block"></div>
                <span className="text-[9px] font-bold text-slate-400/70 truncate hidden sm:block">点击添加 · 拖拽排程</span>
            </div>
            {isTemplatesExpanded ? <ChevronDown size={14} className="text-slate-300" /> : <ChevronRight size={14} className="text-slate-300" />}
        </button>

        {isTemplatesExpanded && (
            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {TASK_TEMPLATES.map((template) => (
                    <div 
                      key={template.title} 
                      draggable 
                      onDragStart={(e) => handleDragStart(e, template)} 
                      onClick={() => onQuickAdd(template.title, template.minutes, template.color)} 
                      className="flex flex-col p-3 rounded-xl border border-slate-100 bg-white cursor-grab active:cursor-grabbing transition-all hover:border-blue-200 hover:shadow-[0_4px_12px_rgba(59,130,246,0.05)] group text-left relative overflow-hidden"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className={`w-7 h-7 flex items-center justify-center rounded-lg bg-${template.color}-50 text-${template.color}-600 group-hover:bg-${template.color}-500 group-hover:text-white transition-all`}><template.icon size={14} /></div>
                            <span className="text-[9px] font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md group-hover:bg-slate-100 transition-colors">{template.label}</span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-600 truncate group-hover:text-slate-800 transition-colors">{template.title}</div>
                        
                        <MousePointer2 size={10} className="absolute bottom-2 right-2 text-blue-500 opacity-0 group-hover:opacity-30 transition-opacity" />
                    </div>
                ))}
            </div>
        )}
      </div>

      {contextMenu && createPortal(
        <div className="fixed z-[9999] bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 w-48 overflow-hidden p-1.5 animate-in fade-in zoom-in-95 duration-150 origin-top-left" style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 200) }}>
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">复刻与复制</div>
            <button onClick={() => { onDuplicatePlan(contextMenu.plan.id); setContextMenu(null); }} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 font-bold text-xs transition-all"><Copy size={14} /> 复刻任务</button>
            <button onClick={() => { const tomorrow = addDays(new Date(contextMenu.plan.startDate), 1); onDuplicatePlan(contextMenu.plan.id, tomorrow); setContextMenu(null); }} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-blue-50 text-blue-600 font-bold text-xs transition-all"><CalendarPlus size={14} /> 明天继续</button>
            <div className="h-px bg-slate-100 my-1.5 mx-1"></div>
            <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">状态标记</div>
            <button onClick={(e) => handleToggleStatus(e, contextMenu.plan, PlanStatus.DONE)} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-emerald-50 text-emerald-600 font-bold text-xs transition-all"><CheckCircle2 size={14} /> 已完成</button>
            <button onClick={() => { onDeletePlan(contextMenu.plan.id); setContextMenu(null); }} className="w-full text-left flex items-center gap-2.5 p-2 rounded-lg hover:bg-rose-50 text-rose-500 font-bold text-xs transition-all"><Trash2 size={14} /> 删除计划</button>
        </div>,
        document.body
      )}
    </div>
  );
};
