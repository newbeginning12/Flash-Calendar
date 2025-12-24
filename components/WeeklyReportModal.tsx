
import React, { useState } from 'react';
import { WeeklyReportData } from '../types';
import { X, Copy, Check, FileText, Sparkles, AlertTriangle, ListChecks, CalendarRange, Info, MessageSquareQuote } from 'lucide-react';
import { format } from 'date-fns';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WeeklyReportData | null;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose, data }) => {
  const [copied, setCopied] = useState(false);

  // 如果没有数据，绝对不渲染
  if (!data) return null;
  // 如果 isOpen 为假，由于 React 状态同步可能微秒级延迟，但在 App.tsx 中它们是同步设置的，所以这里主要防误触
  if (!isOpen) return null;

  const handleCopy = () => {
    const text = `
【本周工作周报】 ${format(new Date(), 'yyyy-MM-dd')}

### 1. 本周完成工作
${(data.achievements || []).map(i => `- ${i}`).join('\n')}

### 2. 本周工作总结
${data.summary || ""}

### 3. 下周工作计划
${(data.nextWeekPlans || []).map(i => `- ${i}`).join('\n')}

### 4. 需协调与帮助
${data.risks || "无"}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-[#F8F9FA] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header - 钉钉风格紧凑页眉 */}
        <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-200 sticky top-0 z-10">
           <div className="flex flex-col">
               <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                   <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white">
                        <FileText size={14} />
                   </div>
                   工作周报
               </h2>
               <p className="text-[11px] text-slate-400 font-medium mt-0.5 ml-8">
                   生成日期：{format(new Date(), 'yyyy-MM-dd')}
               </p>
           </div>
           <button 
             onClick={onClose} 
             className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
           >
              <X size={20} />
           </button>
        </div>

        {/* Content - 钉钉风格的独立输入块感 */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* Section 1: Achievements */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <ListChecks size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-700">1. 本周完成工作</h3>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 min-h-[80px]">
                    {data.achievements && data.achievements.length > 0 ? (
                        <ul className="space-y-2">
                            {data.achievements.map((item, idx) => (
                                <li key={idx} className="text-sm text-slate-700 flex items-start gap-2.5 leading-relaxed">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></div>
                                    <span className="flex-1">{item}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-sm text-slate-400 italic">本周无已完成日程，建议手动补充。</div>
                    )}
                </div>
            </section>

            {/* Section 2: Summary */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <MessageSquareQuote size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-700">2. 本周工作总结</h3>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed min-h-[60px]">
                    {data.summary || "请补充本周的核心产出与思考。"}
                </div>
            </section>

             {/* Section 3: Next Week */}
             <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <CalendarRange size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-slate-700">3. 下周工作计划</h3>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 min-h-[80px]">
                    {data.nextWeekPlans && data.nextWeekPlans.length > 0 ? (
                        <ul className="space-y-2">
                            {data.nextWeekPlans.map((item, idx) => (
                                <li key={idx} className="text-sm text-slate-700 flex items-start gap-2.5 leading-relaxed">
                                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                    <span className="flex-1">{item}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-sm text-slate-400 italic">暂未排入下周计划。</div>
                    )}
                </div>
            </section>

            {/* Section 4: Risks/Help */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <h3 className="text-sm font-bold text-slate-700">4. 需协调与帮助</h3>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed flex items-start gap-2 min-h-[60px]">
                     {data.risks && data.risks !== "无" ? (
                         <span>{data.risks}</span>
                     ) : (
                         <span className="text-slate-400 italic">目前暂无风险。</span>
                     )}
                </div>
            </section>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end items-center gap-3 sticky bottom-0 z-10">
            <div className="mr-auto flex items-center gap-1.5 text-[11px] text-slate-400 px-2">
                <Sparkles size={12} className="text-blue-400" />
                AI 已为您根据本周日程自动分类
            </div>
            <button 
                onClick={handleCopy}
                className={`
                    flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-bold text-sm transition-all
                    ${copied 
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/10' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/10'
                    }
                    active:scale-[0.98]
                `}
            >
                {copied ? <Check size={16} strokeWidth={3} /> : <Copy size={16} />}
                {copied ? "已复制内容" : "复制全部内容"}
            </button>
        </div>

      </div>
    </div>
  );
};
