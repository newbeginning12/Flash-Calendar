
import React, { useState, useEffect, useRef } from 'react';
import { Command, CornerDownLeft, Sparkles, Loader2, X, Calendar, Clock, FileText } from 'lucide-react';
import { WorkPlan, AISettings, WeeklyReportData } from '../types';
import { processUserIntent } from '../services/aiService';

interface FlashCommandProps {
  plans: WorkPlan[];
  settings: AISettings;
  onPlanCreated: (plan: WorkPlan) => void;
  onAnalysisCreated: (data: WeeklyReportData) => void;
}

export const FlashCommand: React.FC<FlashCommandProps> = ({ plans, settings, onPlanCreated, onAnalysisCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState<'plan' | 'report' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setShowSuccess(null);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
        setInput('');
        setIsProcessing(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);

    try {
        const result = await processUserIntent(input, plans, settings);

        if (result) {
            if (result.type === 'CREATE_PLAN' && result.data) {
                const newPlan = result.data as WorkPlan;
                onPlanCreated(newPlan);
                setShowSuccess('plan');
                setInput('');
                setTimeout(() => {
                    setIsOpen(false);
                    setShowSuccess(null);
                }, 1200);
            } else if (result.type === 'ANALYSIS' && result.data) {
                onAnalysisCreated(result.data);
                setShowSuccess('report');
                setInput('');
                // 周报生成后立即关闭指令框，以便用户看到弹出的周报 Modal
                setTimeout(() => {
                    setIsOpen(false);
                    setShowSuccess(null);
                }, 800);
            }
        }
    } catch (error: any) {
        console.error("Flash Command Error:", error);
    } finally {
        setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[20vh] px-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative w-full max-w-2xl bg-[#1a1a1a] rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center px-4 py-4 md:py-5 border-b border-white/5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 transition-colors ${isProcessing ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/10 text-white'}`}>
                {isProcessing ? (
                    <Loader2 size={20} className="animate-spin" />
                ) : (
                    <Command size={20} />
                )}
            </div>
            
            <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={showSuccess ? (showSuccess === 'plan' ? "日程创建成功！" : "周报生成完毕！") : "输入指令，如：明天下午开会 或 生成本周周报..."}
                className="flex-1 bg-transparent border-none outline-none text-xl md:text-2xl text-white placeholder-white/30 font-medium h-10"
                autoComplete="off"
            />

            {!isProcessing && !showSuccess && (
                <button 
                   onClick={() => setIsOpen(false)}
                   className="ml-4 p-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                >
                    <span className="text-xs font-medium px-1.5 py-0.5 border border-white/20 rounded bg-white/5">ESC</span>
                </button>
            )}
        </div>

        <div className="bg-[#141414] px-4 py-2.5 flex justify-between items-center text-xs text-white/40 font-medium">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                    <Sparkles size={12} className={isProcessing ? "text-indigo-400 animate-pulse" : ""} />
                    {isProcessing ? "AI 正在思考..." : "AI 智能指令中心"}
                </span>
                {showSuccess === 'plan' && (
                     <span className="flex items-center gap-1.5 text-emerald-400 animate-in fade-in slide-in-from-left-2">
                        <Calendar size={12} />
                        已添加到日程
                     </span>
                )}
                {showSuccess === 'report' && (
                     <span className="flex items-center gap-1.5 text-blue-400 animate-in fade-in slide-in-from-left-2">
                        <FileText size={12} />
                        正在展示周报
                     </span>
                )}
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 opacity-60">
                    <span>当前模型:</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">
                        {settings.model}
                    </span>
                </div>
                <div className="w-px h-3 bg-white/10"></div>
                <div className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onClick={() => handleSubmit()}>
                    <span>运行</span>
                    <div className="flex items-center justify-center w-5 h-5 rounded bg-white/10 text-white/80">
                        <CornerDownLeft size={12} />
                    </div>
                </div>
            </div>
        </div>

        {showSuccess && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-white/5 mix-blend-overlay">
                <div className={`absolute top-0 w-full h-1 bg-gradient-to-r ${showSuccess === 'plan' ? 'from-emerald-500 via-teal-400 to-emerald-500' : 'from-blue-500 via-indigo-400 to-blue-500'}`}></div>
            </div>
        )}
      </div>
    </div>
  );
};
