
import React, { useState, useEffect, useRef } from 'react';
import { MonthlyAnalysisData, MonthlyPattern } from '../types';
import { X, Sparkles, ShieldAlert, Target, Zap, Info, ArrowRight, ChevronDown, History, Calendar, Check, Activity, BarChart3, Fingerprint, Layout } from 'lucide-react';
import { format } from 'date-fns';
import { storageService } from '../services/storageService';

interface MonthlyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MonthlyAnalysisData | null;
}

export const MonthlyReviewModal: React.FC<MonthlyReviewModalProps> = ({ isOpen, onClose, data: initialData }) => {
  const [currentData, setCurrentData] = useState<MonthlyAnalysisData | null>(initialData);
  const [history, setHistory] = useState<MonthlyAnalysisData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentData(initialData);
    if (isOpen) {
        loadHistory();
        setShowScrollHint(true);
    }
  }, [initialData, isOpen]);

  const loadHistory = async () => {
    const reports = await storageService.getAllMonthlyReports();
    setHistory(reports);
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        if (scrollTop > 50 && showScrollHint) {
            setShowScrollHint(false);
        } else if (scrollTop <= 50 && !showScrollHint) {
            setShowScrollHint(true);
        }
    }
  };

  if (!isOpen || !currentData) return null;

  const getGradeColor = (grade: string) => {
    if (['S', 'A'].includes(grade)) return 'text-emerald-500';
    if (['B', 'C'].includes(grade)) return 'text-indigo-500';
    return 'text-rose-500';
  };

  const normalizeData = (data: MonthlyAnalysisData) => {
    const chaosNum = typeof data.chaosLevel === 'number' ? data.chaosLevel : 50; 
    let normalizedPatterns: MonthlyPattern[] = [];
    if (Array.isArray(data.patterns)) {
      normalizedPatterns = data.patterns.map((p: any, idx) => {
        if (typeof p === 'string') {
          return { id: idx.toString(), label: '观察发现', description: p, type: 'info' as const };
        }
        return {
          id: p.id || idx.toString(),
          label: p.label || '行为模式',
          description: p.description || '',
          type: p.type || 'info'
        };
      });
    }

    let normalizedAdvice: { truth: string, action: string }[] = [];
    if (typeof data.candidAdvice === 'string') {
        normalizedAdvice = [{ truth: '整体洞察', action: data.candidAdvice }];
    } else if (Array.isArray(data.candidAdvice)) {
        normalizedAdvice = data.candidAdvice.map((a: any) => {
            if (typeof a === 'string') return { truth: '现状反馈', action: a };
            return {
                truth: a.truth || '深度真相',
                action: a.action || '待执行建议'
            };
        });
    }

    return { ...data, chaosLevel: chaosNum, patterns: normalizedPatterns, candidAdvice: normalizedAdvice };
  };

  const safeData = normalizeData(currentData);
  const blurAmount = Math.min(20, (safeData.chaosLevel / 100) * 15);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl transition-opacity duration-700" onClick={onClose} />
      
      <div className="relative w-full max-w-[1400px] w-[96vw] h-[96vh] bg-white rounded-[40px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col border border-white/20 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Header - 更简洁现代 */}
        <div className="px-8 py-6 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-[60] border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">月度行为镜像诊断书</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Data Analysis Engine v3.0</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${showHistory ? 'bg-slate-900 text-white shadow-lg' : 'hover:bg-slate-50 text-slate-500 border border-slate-200'}`}
            >
                <History size={16} />
                <span className="text-xs font-black uppercase">历史存档</span>
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <button onClick={onClose} className="p-2 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-colors text-slate-400">
                <X size={24} />
            </button>
          </div>
        </div>

        {/* History Sidebar */}
        {showHistory && (
          <div className="absolute inset-0 z-[70] bg-white/98 backdrop-blur-3xl animate-in slide-in-from-right duration-500 flex flex-col">
              <div className="p-10 pb-6 flex justify-between items-center border-b border-slate-100">
                  <h3 className="text-xl font-black flex items-center gap-3 text-slate-800">
                      <Calendar size={22} className="text-indigo-500" />
                      历程档案库
                  </h3>
                  <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                      <X size={24} />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                  {history.map((h) => (
                      <button
                          key={h.id}
                          onClick={() => { setCurrentData(h); setShowHistory(false); }}
                          className={`w-full flex items-center justify-between p-6 rounded-[24px] border transition-all ${safeData.id === h.id ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-[1.01]' : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20'}`}
                      >
                          <div className="flex flex-col text-left">
                              <span className="text-base font-black">{format(new Date(h.timestamp), 'yyyy年MM月dd日')}</span>
                              <span className={`text-[11px] font-bold ${safeData.id === h.id ? 'opacity-60' : 'text-slate-400'}`}>{h.gradeTitle}</span>
                          </div>
                          <div className="flex items-center gap-6">
                              <span className={`text-3xl font-black ${safeData.id === h.id ? 'text-indigo-400' : getGradeColor(h.grade)}`}>{h.grade}</span>
                              {safeData.id === h.id && <Check size={20} className="text-indigo-400" />}
                          </div>
                      </button>
                  ))}
              </div>
          </div>
        )}

        {/* Main Viewport */}
        <div className="flex-1 flex overflow-hidden bg-slate-50/20">
            {/* Left: Score & Hero Section (Sticky) - 紧凑化布局调整 */}
            <div className="w-[380px] h-full hidden xl:flex flex-col border-r border-slate-100 bg-white relative overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 opacity-40 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-100/30 rounded-full blur-[100px]" />
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-start p-8 pt-12 text-center relative z-10 overflow-y-auto custom-scrollbar">
                    <div className="relative flex items-center justify-center w-52 h-52 mb-6">
                        <div 
                            className="absolute inset-0 rounded-full border-[2px] border-indigo-200/40 transition-all duration-1000 animate-[spin_12s_linear_infinite]"
                            style={{ 
                                transform: `scale(${1 + safeData.chaosLevel / 250})`,
                                filter: `blur(${blurAmount * 0.8}px)`, 
                                opacity: 0.8,
                                borderStyle: 'dashed'
                            }}
                        />
                        <div className="relative flex flex-col items-center">
                            <span className={`text-[100px] font-black ${getGradeColor(safeData.grade)} leading-none tracking-tighter drop-shadow-2xl`}>
                                {safeData.grade}
                            </span>
                            <div className="mt-4 flex flex-col items-center gap-0.5">
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-1.5">
                                    <Fingerprint size={10} className="text-indigo-400" />
                                    Diagnostic Score
                                </div>
                                <span className="text-2xl font-black text-slate-800">{safeData.healthScore}</span>
                            </div>
                        </div>
                    </div>
                    
                    <h3 className="text-2xl font-black text-slate-800 leading-[1.2] mb-3 px-4">{safeData.gradeTitle}</h3>
                    <p className="text-[13px] text-slate-400 font-medium leading-relaxed max-w-[260px]">
                        基于本月 {safeData.metrics.deepWorkRatio > 0.3 ? '高强度' : '碎片化'} 的工作流数据生成的深度行为镜像。
                    </p>

                    <div className="mt-8 w-full grid grid-cols-3 gap-3 border-t border-slate-100 pt-6">
                        <div className="flex flex-col items-center">
                            <span className="text-base font-black text-slate-800">{Math.round(safeData.metrics.taggedRatio * 100)}%</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">标签覆盖</span>
                        </div>
                        <div className="flex flex-col items-center border-x border-slate-100">
                            <span className="text-base font-black text-slate-800">{Math.round(safeData.metrics.deepWorkRatio * 100)}%</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">深度专注</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-base font-black text-slate-800">{Math.round(safeData.metrics.descriptionRate * 100)}%</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">记录完备</span>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                            <Info size={14} />
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-tight">
                            诊断结果受数据量影响，记录越详细，AI 洞察越精准。
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: Detailed Content (Scrollable) */}
            <div 
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto custom-scrollbar relative"
            >
                <div className="max-w-[800px] mx-auto px-10 pt-4 pb-16 md:px-16 md:pt-10 md:pb-24 space-y-16">
                    
                    {/* 移动端/窄屏显示的 Hero Header */}
                    <div className="xl:hidden flex flex-col items-center text-center pb-12 border-b border-slate-100 mb-12">
                         <span className={`text-[120px] font-black ${getGradeColor(safeData.grade)} leading-none`}>{safeData.grade}</span>
                         <h3 className="text-3xl font-black text-slate-800 mt-6">{safeData.gradeTitle}</h3>
                         <div className="mt-4 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest">
                            Health Score: {safeData.healthScore}
                         </div>
                    </div>

                    {/* Section 1: Patterns */}
                    <section className="space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-px bg-slate-200" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] whitespace-nowrap">Core Behavioral Patterns</h4>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                            {safeData.patterns.map((p) => (
                                <div 
                                    key={p.id} 
                                    className="p-8 rounded-[32px] bg-white border border-slate-100 hover:border-indigo-500/30 transition-all duration-500 hover:shadow-[0_32px_64px_-16px_rgba(99,102,241,0.08)] hover:-translate-y-1 group relative overflow-hidden"
                                >
                                    {/* Tech Glow Overlay on Hover */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.01] via-transparent to-indigo-500/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[40px] rounded-full translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                    
                                    <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-[0.03] transition-all duration-700 group-hover:scale-110 pointer-events-none">
                                        <BarChart3 size={140} />
                                    </div>
                                    <div className="flex items-start gap-6 relative z-10">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500 ${
                                            p.type === 'warning' ? 'bg-rose-50 text-rose-500' : 
                                            p.type === 'positive' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'
                                        }`}>
                                            {p.type === 'warning' ? <ShieldAlert size={22} /> : p.type === 'positive' ? <Zap size={22} /> : <Target size={22} />}
                                        </div>
                                        <div className="flex-1">
                                            <h5 className="font-black text-slate-800 text-lg mb-2 tracking-tight group-hover:text-indigo-600 transition-colors duration-300">{p.label}</h5>
                                            <p className="text-sm text-slate-500 leading-relaxed font-medium group-hover:text-slate-600 transition-colors duration-300">{p.description}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Section 2: Truth & Advice */}
                    <section className="space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-px bg-slate-200" />
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] whitespace-nowrap">Deep Reflection & Action</h4>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        <div className="space-y-8">
                            {safeData.candidAdvice.map((advice, idx) => (
                                <div key={idx} className="group overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] hover:border-slate-200 hover:-translate-y-1.5 transition-all duration-500">
                                    <div className="p-8 border-b border-slate-50 relative">
                                        <div className="absolute top-4 right-8 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                                            <Fingerprint size={80} />
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-300 mb-4 group-hover:text-indigo-400 transition-colors">
                                            <Fingerprint size={14} strokeWidth={2.5} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">镜像真相</span>
                                        </div>
                                        <p className="text-xl text-slate-800 font-black leading-tight tracking-tight relative z-10">{advice.truth}</p>
                                    </div>
                                    <div className="bg-slate-50/50 p-8 flex items-start gap-6 group-hover:bg-indigo-500/[0.02] transition-colors duration-500">
                                        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex-shrink-0 flex items-center justify-center group-hover:bg-indigo-600 transition-all duration-500 shadow-lg group-hover:shadow-indigo-200">
                                            <ArrowRight size={20} strokeWidth={3} />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black text-slate-400 group-hover:text-indigo-500 uppercase tracking-widest block mb-2">行动建议</span>
                                            <p className="text-base text-slate-600 font-bold leading-relaxed">{advice.action}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Scroll Hint Fade */}
                    {showScrollHint && (
                        <div className="sticky bottom-6 flex justify-center animate-bounce pointer-events-none opacity-40">
                            <ChevronDown size={24} className="text-indigo-500" />
                        </div>
                    )}
                    
                    <div className="pt-10 pb-20 text-center">
                        <div className="inline-flex items-center gap-3 px-5 py-2 bg-slate-100/50 rounded-full border border-slate-200/50">
                            <Sparkles size={12} className="text-indigo-400" />
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Enhanced by Neural Intelligence</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer - 更加精简 */}
        <div className="px-10 py-6 border-t border-slate-100 bg-white/80 backdrop-blur-md flex items-center justify-between z-50">
           <div className="hidden sm:flex items-center gap-3 text-slate-400 text-xs font-bold uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              Diagnosis Complete
           </div>
           
           <div className="flex items-center gap-4 w-full sm:w-auto">
                <button 
                  onClick={onClose}
                  className="px-8 py-3 text-sm font-black text-slate-500 hover:text-slate-800 transition-colors"
                >
                  暂存回顾
                </button>
                <button 
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-12 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl font-black shadow-xl shadow-slate-200 active:scale-95 transition-all text-sm flex items-center justify-center gap-3 group"
                >
                  开启高效循环
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
           </div>
        </div>
      </div>
    </div>
  );
};
