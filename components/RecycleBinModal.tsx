
import React from 'react';
import { WorkPlan } from '../types';
import { X, Trash2, RotateCcw, Info, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface RecycleBinModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: WorkPlan[];
  onRestore: (plan: WorkPlan) => void;
  onPermanentDelete: (id: string) => void;
}

export const RecycleBinModal: React.FC<RecycleBinModalProps> = ({ isOpen, onClose, plans, onRestore, onPermanentDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Trash2 size={18} className="text-slate-400" />
            <h2 className="text-base font-bold text-slate-800">最近删除</h2>
            <span className="bg-slate-200 text-slate-600 text-[10px] font-black px-1.5 py-0.5 rounded-full ml-1">
              {plans.length}
            </span>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2 bg-white">
          {plans.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-300">
              <Trash2 size={48} className="opacity-10 mb-4" />
              <p className="text-sm font-bold">回收站是空的</p>
              <p className="text-xs mt-1">删除的日程将在此保留 7 天</p>
            </div>
          ) : (
            plans.map(plan => {
              const daysLeft = 7 - differenceInDays(new Date(), new Date(plan.deletedAt!));
              return (
                <div key={plan.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all bg-slate-50/30 group">
                  <div className={`w-10 h-10 rounded-xl bg-${plan.color}-50 text-${plan.color}-400 flex items-center justify-center opacity-50`}>
                    <Calendar size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-600 truncate">{plan.title}</h4>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-400">删除于: {format(new Date(plan.deletedAt!), 'MM-dd HH:mm')}</span>
                      <span className="text-[10px] font-black text-rose-400 uppercase tracking-tighter bg-rose-50 px-1.5 rounded">
                        {daysLeft <= 0 ? '即将清理' : `${daysLeft}天后清理`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => onRestore(plan)}
                      className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                      title="恢复日程"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button 
                      onClick={() => onPermanentDelete(plan.id)}
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="彻底删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-start gap-2 text-[11px] text-slate-400 font-medium italic">
            <Info size={12} className="mt-0.5 flex-shrink-0" />
            已删除的日程不会出现在日历中，且不会被发送给 AI 进行周报生成或镜像诊断。
          </div>
        </div>
      </div>
    </div>
  );
};
