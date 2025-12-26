
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { WorkPlan, PlanStatus } from '../types';
import { format, isSameDay } from 'date-fns';
import { Inbox, ChevronRight, ChevronLeft, GripVertical, Clock, Sparkles, X, CheckCircle2, Circle, Send, Loader2 } from 'lucide-react';

interface SmartShelfProps {
  plans: WorkPlan[];
  isOpen: boolean;
  onToggle: (state: boolean) => void;
  onPlanClick: (plan: WorkPlan) => void;
  onPlanUpdate: (plan: WorkPlan) => void;
  onDeletePlan: (id: string) => void;
  onCapture: (text: string) => void; // 即时捕获处理
}

export const SmartShelf: React.FC<SmartShelfProps> = ({ plans, isOpen, onToggle, onPlanClick, onPlanUpdate, onDeletePlan, onCapture }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fuzzyPlans = useMemo(() => 
    plans.filter(p => p.isFuzzy).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  , [plans]);

  const handleDragStart = (e: React.DragEvent, plan: WorkPlan) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ 
      type: 'MOVE_PLAN', 
      planId: plan.id 
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;
    onCapture(inputValue.trim());
    setInputValue('');
    // 保持聚焦，支持连打
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const fuzzyCount = fuzzyPlans.length;

  return (
    <>
      <div 
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-[80] cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group ${
            isOpen ? 'opacity-0 translate-x-8 pointer-events-none' : 'opacity-100 translate-x-0'
        }`}
        onClick={() => onToggle(true)}
      >
        {fuzzyCount > 0 && (
            <div className="absolute inset-0 bg-indigo-500/10 blur-lg rounded-full animate-pulse" />
        )}

        <div className="relative flex items-center">
            {fuzzyCount > 0 && (
                <div className="absolute -top-1.5 -left-1.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md border border-white z-10 animate-in zoom-in duration-300">
                    {fuzzyCount}
                </div>
            )}

            <div className="flex flex-col items-center justify-center bg-white/90 backdrop-blur-xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_25px_rgba(79,70,229,0.15)] rounded-l-2xl pl-2 pr-1.5 py-4 transition-all group-hover:pl-4 group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:text-white text-slate-400">
                <Inbox size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                <div className="flex flex-col items-center mt-1.5 mb-1 gap-0.5">
                    <span className="text-[10px] font-black leading-none">闪</span>
                    <span className="text-[10px] font-black leading-none">念</span>
                </div>
                <ChevronLeft size={10} strokeWidth={3} className="opacity-50 group-hover:opacity-100 group-hover:-translate-x-0.5 transition-all" />
            </div>
        </div>
      </div>

      <div 
        className={`fixed right-0 top-16 bottom-0 z-[90] bg-white/70 backdrop-blur-2xl border-l border-slate-200 shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        style={{ width: '340px' }}
      >
        <div className="p-5 flex items-start justify-between border-b border-slate-100 bg-white/50">
            <div className="flex items-start gap-2 flex-1">
                <div className="p-1.5 bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-200 mt-0.5">
                    <Inbox size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-slate-800">闪念挂载仓</h3>
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 pr-2">
                      随手记录碎片化的想法与任务。无需思考排程，尽管记录，AI 将自动为您润色分类，静待被拖入日历。
                    </p>
                </div>
            </div>
            <button 
                onClick={() => onToggle(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors flex-shrink-0"
            >
                <ChevronRight size={20} />
            </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
            {fuzzyPlans.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-300 space-y-4 opacity-50 px-10 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                        <Sparkles size={32} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">闪念挂载仓空空如也</span>
                        <p className="text-[10px] font-medium leading-relaxed">在下方记录碎片想法，AI 将自动润色</p>
                    </div>
                </div>
            ) : (
                fuzzyPlans.map(plan => (
                    <div 
                        key={plan.id}
                        draggable={!plan.isEnhancing}
                        onDragStart={(e) => handleDragStart(e, plan)}
                        onClick={() => !plan.isEnhancing && onPlanClick(plan)}
                        className={`group relative p-4 rounded-2xl border-2 transition-all cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md ${
                            plan.isEnhancing 
                            ? 'bg-slate-50 border-slate-100 opacity-60 pointer-events-none' 
                            : `bg-${plan.color}-50/30 border-${plan.color}-200/50 border-dashed hover:border-${plan.color}-400 hover:bg-white`
                        } animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                        <div className="flex items-start gap-3">
                            {plan.isEnhancing ? (
                                <Loader2 size={14} className="mt-1 text-indigo-400 animate-spin flex-shrink-0" />
                            ) : (
                                <GripVertical size={14} className="mt-1 text-slate-300 group-hover:text-slate-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className={`text-[13px] font-bold text-slate-800 truncate mb-1 ${plan.isEnhancing ? 'italic' : ''}`}>
                                    {plan.title}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                    {plan.isEnhancing ? (
                                        <span className="flex items-center gap-1 text-indigo-500 animate-pulse">
                                            <Sparkles size={10} /> AI 正在增强...
                                        </span>
                                    ) : (
                                        <>
                                            <Clock size={10} />
                                            <span>{format(new Date(plan.startDate), 'M月d日')} · 待排程</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeletePlan(plan.id); }}
                                    className="p-1 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        </div>

                        {!plan.isEnhancing && (
                             <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                             <div className="flex gap-1">
                                 {plan.tags.slice(0, 2).map(tag => (
                                     <span key={tag} className="text-[9px] bg-white px-1.5 py-0.5 rounded border border-slate-100 text-slate-500">{tag}</span>
                                 ))}
                             </div>
                             <div className="text-[9px] font-black text-indigo-500/60 uppercase group-hover:animate-pulse">可拖入日历</div>
                        </div>
                        )}
                    </div>
                ))
            )}
        </div>

        {/* 底部快速录入输入框 */}
        <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
            <form onSubmit={handleSubmit} className="relative">
                <input 
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="快速记录闪念..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <button 
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-black disabled:opacity-30 disabled:hover:bg-slate-900 transition-all active:scale-90"
                >
                    <Send size={14} strokeWidth={3} />
                </button>
            </form>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 font-bold px-1">
                <Sparkles size={10} className="text-indigo-400" />
                <span>AI 将自动为您润色分类</span>
            </div>
        </div>
      </div>
    </>
  );
};
