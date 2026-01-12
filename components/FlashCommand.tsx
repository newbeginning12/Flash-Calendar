
import React, { useState, useEffect, useRef } from 'react';
import { Command, CornerDownLeft, Sparkles, Loader2, X, Calendar, Clock, FileText, AlertCircle } from 'lucide-react';
import { WorkPlan, AISettings, WeeklyReportData, PlanStatus } from '../types';
import { processUserIntent } from '../services/aiService';

interface FlashCommandProps {
  plans: WorkPlan[];
  settings: AISettings;
  onPlanCreated: (plan: WorkPlan) => void;
  onAnalysisCreated: (data: WeeklyReportData) => void;
}

/**
 * 根据起止时间自动计算初始状态 (与 App.tsx 保持一致)
 */
const getInitialStatus = (startDate: string, endDate: string): PlanStatus => {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (end < now) return PlanStatus.DONE;
  if (start <= now && now <= end) return PlanStatus.IN_PROGRESS;
  return PlanStatus.TODO;
};

export const FlashCommand: React.FC<FlashCommandProps> = ({ plans, settings, onPlanCreated, onAnalysisCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState<'plan' | 'report' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        setShowSuccess(null);
        setErrorMessage(null);
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
        setErrorMessage(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setErrorMessage(null);

    try {
        const result = await processUserIntent(input, plans, settings);

        if (result) {
            if (result.type === 'CREATE_PLAN' && result.data) {
                const startDate = result.data.startDate || new Date().toISOString();
                const endDate = result.data.endDate || new Date(Date.now() + 3600000).toISOString();
                
                // Explicitly add required properties like 'updatedAt' before spreading the Partial result data
                const newPlan: WorkPlan = {
                    id: crypto.randomUUID(),
                    title: '新建日程',
                    startDate,
                    endDate,
                    status: getInitialStatus(startDate, endDate),
                    tags: [],
                    color: 'blue',
                    links: [],
                    updatedAt: new Date().toISOString(),
                    ...result.data
                };
                onPlanCreated(newPlan);
                setShowSuccess('plan');
                setInput('');
                setTimeout(() => {
                    setIsOpen(false);
                    setShowSuccess(null);
                }, 1200);
            } else if (result.type === 'ANALYSIS' && result.data) {
                setInput('');
                setShowSuccess('report');
                onAnalysisCreated(result.data);
                setTimeout(() => {
                    setIsOpen(false);
                    setShowSuccess(null);
                }, 500);
            } else if (result.type === 'UNSUPPORTED') {
                setErrorMessage(result.message);
                // 4秒后自动清除错误信息
                setTimeout(() => setErrorMessage(null), 4000);
            }
        }
    } catch (error: any) {
        console.error("Flash Command Error:", error);
        setErrorMessage("指令处理出错，请稍后再试。");
    } finally {
        setIsProcessing(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[20vh] px-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => setIsOpen(false)}
      />

      <div className="relative w-full max-w-2xl bg-[#1a1a1a] rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        <div className={`flex items-center px-4 py-4 md:py-5 border-b border-white/5 transition-colors ${errorMessage ? 'bg-rose-500/5' : ''}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-4 transition-colors ${
                isProcessing ? 'bg-indigo-500/20 text-indigo-400' : 
                errorMessage ? 'bg-rose-500/20 text-rose-400' : 'bg-white/10 text-white'
            }`}>
                {isProcessing ? (
                    <Loader2 size={20} className="animate-spin" />
                ) : errorMessage ? (
                    <AlertCircle size={20} />
                ) : (
                    <Command size={20} />
                )}
            </div>
            
            <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={showSuccess ? (showSuccess === 'plan' ? "日程创建成功！" : "周报生成完毕！") : "输入指令，如：明天下午开会..."}
                className={`flex-1 bg-transparent border-none outline-none text-xl md:text-2xl text-white placeholder-white/30 font-medium h-10 ${errorMessage ? 'text-rose-200' : ''}`}
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

        <div className={`px-4 py-2.5 flex justify-between items-center text-xs font-medium transition-colors ${
            errorMessage ? 'bg-rose-950/40 text-rose-300' : 'bg-[#141414] text-white/40'
        }`}>
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                    {errorMessage ? (
                        <>
                            <AlertCircle size={12} className="text-rose-400" />
                            <span className="animate-in slide-in-from-left-2">{errorMessage}</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={12} className={isProcessing ? "text-indigo-400 animate-pulse" : ""} />
                            {isProcessing ? "AI 正在思考..." : "AI 智能指令中心"}
                        </>
                    )}
                </span>
                {showSuccess === 'plan' && (
                     <span className="flex items-center gap-1.5 text-emerald-400 animate-in fade-in slide-in-from-left-2">
                        <Calendar size={12} />
                        已添加到日程
                     </span>
                )}
            </div>

            <div className="flex items-center gap-3">
                {!errorMessage && (
                    <div className="flex items-center gap-1 opacity-60">
                        <span>当前模型:</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white">
                            {settings.model}
                        </span>
                    </div>
                )}
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
