
import React, { useState } from 'react';
import { WeeklyReportData } from '../types';
import { X, Copy, Check, FileText, Sparkles, AlertTriangle, ListChecks, CalendarRange, MessageSquareQuote } from 'lucide-react';
import { format } from 'date-fns';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WeeklyReportData | null;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose, data }) => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  if (!data || !isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(id);
      setTimeout(() => setCopiedSection(null), 2000);
    });
  };

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleCopy(text, id);
      }}
      className={`
        flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border
        ${copiedSection === id 
          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
          : 'bg-slate-50 text-slate-500 hover:bg-white hover:border-slate-300 border-slate-100 hover:text-slate-700'
        }
      `}
      title="复制此项"
    >
      {copiedSection === id ? <Check size={12} strokeWidth={3} /> : <Copy size={12} />}
      {copiedSection === id ? '已复制' : '复制此项'}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity duration-300" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-[#F8F9FA] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
           <div className="flex flex-col">
               <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                   <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white">
                        <FileText size={14} />
                   </div>
                   工作周报预览
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
            
            {/* Section 1: Achievements */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <ListChecks size={16} className="text-blue-500" />
                        <h3 className="text-sm font-bold text-slate-700">1. 本周完成工作</h3>
                    </div>
                    <CopyButton 
                        id="achievements" 
                        text={(data.achievements || []).map(i => `- ${i}`).join('\n')} 
                    />
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
                        <div className="text-sm text-slate-400 italic">本周无已完成日程。</div>
                    )}
                </div>
            </section>

            {/* Section 2: Summary */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <MessageSquareQuote size={16} className="text-blue-500" />
                        <h3 className="text-sm font-bold text-slate-700">2. 本周工作总结</h3>
                    </div>
                    <CopyButton id="summary" text={data.summary || ""} />
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed min-h-[60px]">
                    {data.summary || "未生成有效总结。"}
                </div>
            </section>

             {/* Section 3: Next Week */}
             <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <CalendarRange size={16} className="text-blue-500" />
                        <h3 className="text-sm font-bold text-slate-700">3. 下周工作计划</h3>
                    </div>
                    <CopyButton 
                        id="nextWeek" 
                        text={(data.nextWeekPlans || []).map(i => `- ${i}`).join('\n')} 
                    />
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
                        <div className="text-sm text-slate-400 italic">暂无下周计划。</div>
                    )}
                </div>
            </section>

            {/* Section 4: Risks/Help */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-amber-500" />
                        <h3 className="text-sm font-bold text-slate-700">4. 需协调与帮助</h3>
                    </div>
                    <CopyButton id="risks" text={data.risks || "无"} />
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
        <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-center sticky bottom-0 z-10">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 px-2 font-medium italic">
                <Sparkles size={12} className="text-blue-400" />
                请根据钉钉周报字段要求，分别点击各标题旁的按钮进行复制
            </div>
        </div>

      </div>
    </div>
  );
};
