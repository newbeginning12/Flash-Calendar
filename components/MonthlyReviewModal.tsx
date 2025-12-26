
import React, { useState, useEffect, useRef } from 'react';
import { MonthlyAnalysisData, MonthlyPattern } from '../types';
import { X, Sparkles, ShieldAlert, Target, Zap, Info, ArrowRight, ChevronDown, History, Calendar, Check, Activity, BarChart3, Fingerprint } from 'lucide-react';
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

  // 数据容错与规范化转换
  const normalizeData = (data: MonthlyAnalysisData) => {
    // 1. 处理 chaosLevel，有些 AI 可能会返回字符串，需转为数字
    const chaosNum = typeof data.chaosLevel === 'number' ? data.chaosLevel : 50; 
    
    // 2. 处理 patterns，AI 可能返回 ["string", "string"]
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

    // 3. 处理 candidAdvice，AI 可能返回一个大字符串或不带 truth/action 的数组
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
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-500" onClick={onClose} />
      
      <div className="relative w-full max-w-3xl bg-white/90 backdrop-blur-2xl rounded-[48px] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col max-h-[92vh] border border-white/60 animate-in fade-in zoom-in-95 duration-700">
        
        <div className="px-10 py-8 flex items-center justify-between sticky top-0 bg-white/50 backdrop-blur-md z-30">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
              <Activity size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                镜像诊断书
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-500 text-[10px] font-black rounded-full uppercase tracking-widest">Premium Insight</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
                Generated at {format(new Date(safeData.timestamp), 'yyyy/MM/dd HH:mm')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2.5 rounded-2xl transition-all flex items-center gap-2 px-5 ${showHistory ? 'bg-slate-900 text-white shadow-xl' : 'hover:bg-slate-50 text-slate-500 border border-slate-100'}`}
            >
                <History size={18} />
                <span className="text-[12px] font-black uppercase tracking-wider">历史存档</span>
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-rose-50 hover:text-rose-500 rounded-full transition-colors text-slate-300">
                <X size={24} />
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-3xl animate-in slide-in-from-right duration-500 flex flex-col">
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
                          className={`w-full flex items-center justify-between p-6 rounded-[32px] border transition-all ${safeData.id === h.id ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-[1.02]' : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/20'}`}
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

        <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto custom-scrollbar p-10 pt-4 space-y-16 relative bg-gradient-to-b from-transparent via-slate-50/30 to-transparent"
        >
          <div className="flex flex-col items-center justify-center py-12 min-h-[65vh] relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-50/40 rounded-full blur-[100px] -z-10" />
            
            <div className="relative flex items-center justify-center w-80 h-80">
              <div 
                className="absolute inset-0 rounded-full border-[2px] border-indigo-200/50 transition-all duration-1000 animate-[spin_10s_linear_infinite]"
                style={{ 
                  transform: `scale(${1 + safeData.chaosLevel / 200})`,
                  filter: `blur(${blurAmount}px)`, 
                  opacity: 0.6,
                  borderStyle: 'dashed'
                }}
              />
              <div className="relative flex flex-col items-center animate-in zoom-in duration-1000 ease-out">
                <span className={`text-[140px] font-black ${getGradeColor(safeData.grade)} leading-none tracking-tighter drop-shadow-2xl`}>{safeData.grade}</span>
                <div className="mt-8 flex flex-col items-center gap-2">
                   <div className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">
                     <Fingerprint size={12} className="text-indigo-400" />
                     Diagnostic Score
                   </div>
                   <span className="text-4xl font-black text-slate-800">{safeData.healthScore}</span>
                </div>
              </div>
            </div>
            
            <h3 className="mt-14 text-4xl font-black text-slate-800 text-center px-10 leading-[1.1] max-w-xl">{safeData.gradeTitle}</h3>

            {showScrollHint && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-indigo-400 font-black text-[10px] uppercase tracking-[0.5em] animate-bounce pointer-events-none opacity-50">
                    <span>Scroll to Dive Deep</span>
                    <ChevronDown size={18} strokeWidth={3} />
                </div>
            )}
          </div>

          <section className="space-y-10">
            <div className="flex items-center gap-4">
               <div className="w-8 h-px bg-slate-200" />
               <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] whitespace-nowrap">Core Behavioral Patterns</h4>
               <div className="flex-1 h-px bg-slate-200" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {safeData.patterns.map((p) => (
                <div key={p.id} className="p-8 rounded-[40px] bg-white border border-slate-100 hover:border-indigo-200 transition-all hover:shadow-[0_24px_48px_-12px_rgba(99,102,241,0.08)] group relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 opacity-[0.02] group-hover:opacity-[0.06] transition-all duration-500 group-hover:rotate-12">
                     <BarChart3 size={180} />
                  </div>
                  <div className="flex items-center gap-5 mb-6">
                    <div className={`w-14 h-14 rounded-[20px] flex items-center justify-center shadow-inner ${
                      p.type === 'warning' ? 'bg-rose-50 text-rose-500' : 
                      p.type === 'positive' ? 'bg-emerald-50 text-emerald-500' : 'bg-indigo-50 text-indigo-500'
                    }`}>
                      {p.type === 'warning' ? <ShieldAlert size={26} /> : p.type === 'positive' ? <Zap size={26} /> : <Target size={26} />}
                    </div>
                    <span className="font-black text-slate-800 text-xl tracking-tight">{p.label}</span>
                  </div>
                  <p className="text-base text-slate-500 leading-relaxed font-medium">{p.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-10 pb-16">
             <div className="flex items-center gap-4">
                <div className="w-8 h-px bg-slate-200" />
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.5em] whitespace-nowrap">Deep Reflection & Action</h4>
                <div className="flex-1 h-px bg-slate-200" />
             </div>
             <div className="space-y-8">
                {safeData.candidAdvice.map((advice, idx) => (
                  <div key={idx} className="overflow-hidden rounded-[48px] border border-slate-100 bg-white/40 backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="p-10 md:p-12 border-b border-slate-100/50">
                      <div className="flex items-center gap-3 text-slate-400 mb-6">
                        <Info size={16} strokeWidth={2.5} />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em]">深度真相</span>
                      </div>
                      <p className="text-xl md:text-2xl text-slate-800 font-black leading-tight tracking-tight">{advice.truth}</p>
                    </div>
                    <div className="bg-indigo-500/5 p-10 md:p-12 flex items-start gap-8">
                       <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex-shrink-0 flex items-center justify-center text-white shadow-lg shadow-indigo-300 transform -rotate-2 group-hover:rotate-0 transition-transform">
                         <ArrowRight size={26} strokeWidth={3} />
                       </div>
                       <div>
                         <span className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.3em] block mb-3">改进协议</span>
                         <p className="text-lg md:text-xl text-indigo-900 font-bold leading-relaxed">{advice.action}</p>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
          </section>

          <div className="py-12 text-center">
             <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-slate-100/50 rounded-full border border-slate-200/50">
               <Sparkles size={14} className="text-indigo-400 animate-pulse" />
               <p className="text-[12px] text-slate-500 font-bold uppercase tracking-widest">Enhanced by Gemini Neural Engine</p>
             </div>
          </div>
        </div>

        <div className="px-10 pb-10 pt-6 border-t border-slate-100 bg-white/50 backdrop-blur-xl z-30">
          <button 
            onClick={onClose}
            className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[32px] font-black shadow-2xl shadow-slate-300 active:scale-[0.98] transition-all text-xl flex items-center justify-center gap-4 group"
          >
            <span>开启下个月的高效循环</span>
            <ArrowRight size={24} className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
