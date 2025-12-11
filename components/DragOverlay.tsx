
import React from 'react';
import { UploadCloud, Image as ImageIcon, AlertCircle, Loader2, Sparkles, X } from 'lucide-react';

interface DragOverlayProps {
  isDragging: boolean;
  isValidType: boolean;
  isProcessing: boolean;
  onCancel?: () => void;
}

export const DragOverlay: React.FC<DragOverlayProps> = ({ isDragging, isValidType, isProcessing, onCancel }) => {
  if (!isDragging && !isProcessing) return null;

  return (
    <div 
      className={`
        fixed inset-0 z-[100] flex flex-col items-center justify-center 
        transition-all duration-300 ease-out backdrop-blur-xl
        ${isDragging || isProcessing ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}
        ${!isValidType && isDragging ? 'bg-rose-50/80' : 'bg-slate-900/40'}
      `}
    >
      <div 
        className={`
          relative w-[90%] max-w-lg p-10 rounded-3xl flex flex-col items-center text-center
          transition-all duration-500 shadow-2xl border
          ${isProcessing 
             ? 'bg-white/95 border-white/50 scale-100' 
             : isDragging 
                ? 'scale-105' 
                : 'scale-95'
          }
          ${!isValidType && isDragging 
             ? 'bg-white/90 border-rose-200' 
             : 'bg-white/90 border-white/40'
          }
        `}
      >
        {/* State: Processing */}
        {isProcessing ? (
          <>
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center relative z-10">
                   <Loader2 size={40} className="text-indigo-600 animate-spin" />
                </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">AI 正在阅读截图</h3>
            <p className="text-slate-500 font-medium mb-6">正在分析对话记录与时间信息...</p>
            
            {onCancel && (
              <button 
                onClick={onCancel}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-medium transition-colors"
              >
                <X size={16} />
                取消分析
              </button>
            )}
          </>
        ) : !isValidType ? (
          /* State: Invalid File */
          <>
            <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 shadow-inner ring-4 ring-rose-100">
               <AlertCircle size={40} className="text-rose-500" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-2">不支持的文件格式</h3>
            <p className="text-slate-500 font-medium">请拖入图片或截图 (JPG, PNG)</p>
          </>
        ) : (
          /* State: Valid Drag */
          <>
            <div className="relative mb-6">
               <div className="absolute inset-0 bg-blue-400 blur-2xl opacity-20 animate-pulse rounded-full"></div>
               <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg text-white relative z-10 transform rotate-3 transition-transform duration-500 group-hover:rotate-0">
                  <Sparkles size={36} className="absolute -top-3 -right-3 text-amber-300 drop-shadow-md animate-bounce" />
                  <ImageIcon size={40} />
               </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">释放以创建日程</h3>
            <p className="text-slate-600 font-medium max-w-[280px]">
              AI 将自动识别截图中的<br/>
              <span className="text-indigo-600 font-bold">待办事项</span>、<span className="text-indigo-600 font-bold">时间</span>与<span className="text-indigo-600 font-bold">任务详情</span>
            </p>
            
            <div className="mt-8 py-2 px-4 rounded-full bg-slate-100/50 border border-slate-200 text-xs font-semibold text-slate-500 flex items-center gap-2">
                <UploadCloud size={14} />
                支持微信、钉钉聊天记录或文档截图
            </div>
          </>
        )}
      </div>
    </div>
  );
};
