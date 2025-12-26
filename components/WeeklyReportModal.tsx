
import React, { useState, useEffect } from 'react';
import { WeeklyReportData } from '../types';
import { X, Copy, Check, FileText, Sparkles, AlertTriangle, ListChecks, CalendarRange, MessageSquareQuote, History, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { storageService } from '../services/storageService';

interface WeeklyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: WeeklyReportData | null;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({ isOpen, onClose, data: initialData }) => {
  const [currentData, setCurrentData] = useState<WeeklyReportData | null>(initialData);
  const [history, setHistory] = useState<WeeklyReportData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    setCurrentData(initialData);
    if (isOpen) {
        loadHistory();
        setShowHistory(false);
    }
  }, [initialData, isOpen]);

  const loadHistory = async () => {
    const reports = await storageService.getAllWeeklyReports();
    setHistory(reports);
  };

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(id);
      setTimeout(() => setCopiedSection(null), 2000);
    });
  };

  if (!currentData || !isOpen) return null;

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
        // 移除 onClick={onClose} 以防误触
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
                   生成日期：{currentData.timestamp ? format(new Date(currentData.timestamp), 'yyyy-MM-dd HH:mm') : format(new Date(), 'yyyy-MM-dd')}
               </p>
           </div>
           <div className="flex items-center gap-2">
               <button 
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-2 rounded-lg transition-all flex items-center gap-2 px-3 ${showHistory ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 border border-slate-100'}`}
                  title="查看历史周报"
               >
                  <History size={16} />
                  <span className="text-[12px] font-bold">历史</span>
               </button>
               <button 
                 onClick={onClose} 
                 className="text-slate-400 hover:text-slate-600 p-2 rounded-md transition-colors hover:bg-slate-50"
               >
                  <X size={20} />
               </button>
           </div>
        </div>

        {/* History Sidebar Overlay */}
        {showHistory && (
          <div className="absolute inset-0 z-40 bg-white/95 backdrop-blur-md animate-in slide-in-from-right duration-300 flex flex-col">
              <div className="p-6 pb-4 flex justify-between items-center border-b border-slate-100">
                  <h3 className="text-base font-bold flex items-center gap-2 text-slate-800">
                      <Calendar size={18} className="text-blue-500" />
                      历史周报记录
                  </h3>
                  <button onClick={() => setShowHistory(false)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400">
                      <X size={20} />
                  </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {history.length > 0 ? (
                      history.map((h) => (
                          <button
                              key={h.id}
                              onClick={() => { setCurrentData(h); setShowHistory(false); }}
                              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left group ${currentData.id === h.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-100 hover:border-blue-200 hover:bg-blue-50/30'}`}
                          >
                              <div className="flex flex-col">
                                  <span className="text-sm font-bold">{h.timestamp ? format(new Date(h.timestamp), 'yyyy-MM-dd HH:mm') : '未知日期'}</span>
                                  <span className={`text-[10px] truncate max-w-[200px] mt-1 ${currentData.id === h.id ? 'text-white/70' : 'text-slate-400'}`}>
                                      {h.summary.slice(0, 40)}...
                                  </span>
                              </div>
                              <ChevronRight size={16} className={currentData.id === h.id ? 'text-white' : 'text-slate-300 group-hover:text-blue-400'} />
                          </button>
                      ))
                  ) : (
                      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                          <History size={40} className="opacity-20 mb-4" />
                          <p className="text-sm">暂无历史记录</p>
                      </div>
                  )}
              </div>
          </div>
        )}

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
                        text={(currentData.achievements || []).map((i, idx) => `${idx + 1}. ${i}`).join('\n')} 
                    />
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 min-h-[80px]">
                    {currentData.achievements && currentData.achievements.length > 0 ? (
                        <ul className="space-y-2">
                            {currentData.achievements.map((item, idx) => (
                                <li key={idx} className="text-sm text-slate-700 flex items-start gap-2.5 leading-relaxed">
                                    <span className="text-blue-600 font-bold min-w-[1.25rem] text-right mt-0.5">{idx + 1}.</span>
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
                    <CopyButton id="summary" text={currentData.summary || ""} />
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed min-h-[60px]">
                    {currentData.summary || "未生成有效总结。"}
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
                        text={(currentData.nextWeekPlans || []).map((i, idx) => `${idx + 1}. ${i}`).join('\n')} 
                    />
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 min-h-[80px]">
                    {currentData.nextWeekPlans && currentData.nextWeekPlans.length > 0 ? (
                        <ul className="space-y-2">
                            {currentData.nextWeekPlans.map((item, idx) => (
                                <li key={idx} className="text-sm text-slate-700 flex items-start gap-2.5 leading-relaxed">
                                    <span className="text-slate-400 font-bold min-w-[1.25rem] text-right mt-0.5">{idx + 1}.</span>
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
                    <CopyButton id="risks" text={currentData.risks || "无"} />
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm text-slate-700 leading-relaxed flex items-start gap-2 min-h-[60px]">
                     {currentData.risks && currentData.risks !== "无" ? (
                         <span>{currentData.risks}</span>
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
