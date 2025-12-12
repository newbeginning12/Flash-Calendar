import React, { useState } from 'react';
import { WeeklyReportData } from '../types';
import { X, Copy, Check, FileText, Sparkles, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WeeklyReportData | null;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose, data }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !data) return null;

  const handleCopy = () => {
    const text = `
【本周工作周报】 ${format(new Date(), 'yyyy-MM-dd')}

### 1. 本周完成工作
${data.achievements.map(i => `- ${i}`).join('\n')}

### 2. 本周工作总结
${data.summary}

### 3. 下周工作计划
${data.nextWeekPlans.map(i => `- ${i}`).join('\n')}

### 4. 需协调与帮助
${data.risks}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Darker backdrop for better focus */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-300" 
        onClick={onClose}
      />
      
      {/* Modal Container: Apple System Gray Style */}
      <div className="relative w-full max-w-2xl bg-[#F2F2F7] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 border border-white/20">
        
        {/* Header - Clean & Minimal */}
        <div className="px-6 py-4 flex items-center justify-between bg-white/70 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-10">
           <div className="flex flex-col">
               <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                   <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                        <Sparkles size={14} />
                   </div>
                   智能周报
               </h2>
               <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide opacity-80 mt-0.5 ml-9">
                   {format(new Date(), 'yyyy年MM月dd日')}
               </p>
           </div>
           <button 
             onClick={onClose} 
             className="w-8 h-8 flex items-center justify-center bg-slate-200/50 hover:bg-slate-300 text-slate-500 hover:text-slate-700 rounded-full transition-colors"
           >
              <X size={16} />
           </button>
        </div>

        {/* Content - Grouped List Style (Like iOS Settings/Notes) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-6">
            
            {/* Section 1: Achievements */}
            <section>
                <div className="px-3 mb-2 flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">本周工作 (Achievements)</h3>
                </div>
                <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-200/60 overflow-hidden">
                    {data.achievements.length > 0 ? (
                        <div className="divide-y divide-slate-100/80">
                            {data.achievements.map((item, idx) => (
                                <div key={idx} className="p-4 text-[15px] text-slate-800 leading-relaxed flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                                    <div className="mt-1.5 w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 border border-emerald-200">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                    </div>
                                    <span className="flex-1">{item}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-sm text-slate-400 italic text-center bg-slate-50/30">
                            本周暂无已完成的记录
                        </div>
                    )}
                </div>
            </section>

            {/* Section 2: Summary */}
            <section>
                <div className="px-3 mb-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">总结 (Summary)</h3>
                </div>
                <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-200/60 p-5 text-[15px] text-slate-700 leading-relaxed">
                    {data.summary}
                </div>
            </section>

             {/* Section 3: Next Week */}
             <section>
                <div className="px-3 mb-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">下周规划 (Next Week)</h3>
                </div>
                <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-200/60 overflow-hidden">
                    {data.nextWeekPlans.length > 0 ? (
                        <div className="divide-y divide-slate-100/80">
                            {data.nextWeekPlans.map((item, idx) => (
                                <div key={idx} className="p-4 text-[15px] text-slate-800 leading-relaxed flex items-start gap-3 hover:bg-slate-50/50 transition-colors">
                                    <div className="mt-1.5 w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0 border border-indigo-200">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                    </div>
                                    <span className="flex-1">{item}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-6 text-sm text-slate-400 italic text-center bg-slate-50/30">
                            暂无具体安排
                        </div>
                    )}
                </div>
            </section>

            {/* Section 4: Risks/Help */}
            <section>
                <div className="px-3 mb-2">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">风险与支持 (Risks)</h3>
                </div>
                <div className="bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-200/60 p-5 text-[15px] text-slate-700 leading-relaxed flex items-start gap-3">
                     {data.risks && data.risks !== "无" ? (
                         <>
                            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <span>{data.risks}</span>
                         </>
                     ) : (
                         <span className="text-slate-400">无明显风险</span>
                     )}
                </div>
            </section>
            
            <div className="h-6"></div> {/* Bottom Spacer */}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 flex justify-end items-center gap-4 sticky bottom-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
            <button 
                onClick={handleCopy}
                className={`
                    flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all
                    ${copied 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105' 
                        : 'bg-slate-900 hover:bg-black text-white shadow-lg shadow-slate-900/10 hover:scale-[1.02]'
                    }
                    active:scale-[0.98]
                `}
            >
                {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
                {copied ? "已复制" : "复制周报"}
            </button>
        </div>

      </div>
    </div>
  );
};