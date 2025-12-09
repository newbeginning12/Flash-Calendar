
import React, { useState, useEffect, useRef } from 'react';
import { Command, CornerDownLeft, Sparkles, Loader2, X, Calendar, Clock } from 'lucide-react';
import { WorkPlan } from '../types';
import { processUserIntent } from '../services/aiService';

interface FlashCommandProps {
  plans: WorkPlan[];
  modelName: string;
  onPlanCreated: (plan: WorkPlan) => void;
}

export const FlashCommand: React.FC<FlashCommandProps> = ({ plans, modelName, onPlanCreated }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState<string | null>(null); // Stores the title of created plan
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for both 'k' and 'K' to handle CapsLock or Shift scenarios
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

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small timeout to ensure DOM is rendered
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

    // Call AI Service
    const result = await processUserIntent(input, plans, modelName);

    if (result && result.type === 'CREATE_PLAN' && result.data) {
        // Complete the partial plan
        const newPlan = result.data as WorkPlan;
        
        // Pass to parent
        onPlanCreated(newPlan);

        // Show success state briefly then close
        setShowSuccess(newPlan.title);
        setInput('');
        
        setTimeout(() => {
            setIsOpen(false);
            setShowSuccess(null);
        }, 1500);
    } else {
        // Handle error (shake animation or error toast could be added here)
        console.error("Failed to parse intent or not a creation intent");
    }

    setIsProcessing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Command Window */}
      <div className="relative w-full max-w-2xl bg-[#1a1a1a] rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Input Area */}
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
                placeholder={showSuccess ? "日程创建成功！" : "输入指令，如：明天下午2点和团队开会..."}
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

        {/* Footer / Status Bar */}
        <div className="bg-[#141414] px-4 py-2.5 flex justify-between items-center text-xs text-white/40 font-medium">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                    <Sparkles size={12} className={isProcessing ? "text-indigo-400 animate-pulse" : ""} />
                    {isProcessing ? "AI 正在思考..." : "AI 智能指令"}
                </span>
                {showSuccess && (
                     <span className="flex items-center gap-1.5 text-emerald-400 animate-in fade-in slide-in-from-left-2">
                        <Calendar size={12} />
                        已添加到日程
                     </span>
                )}
            </div>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                    <span>切换模型</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-[10px] text-white/60">Coming Soon</span>
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

        {/* Success Overlay Effect */}
        {showSuccess && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-emerald-500/5 mix-blend-overlay">
                <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"></div>
            </div>
        )}
      </div>
    </div>
  );
};
