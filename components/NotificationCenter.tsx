
import React, { useRef, useEffect } from 'react';
import { AppNotification } from '../types';
import { Bell, AlertCircle, Trash2, Check, X, Clock } from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
  onItemClick: (notification: AppNotification) => void;
}

const formatTimeAgo = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = (now.getTime() - date.getTime()) / 1000;
    
    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
    return `${Math.floor(diff / 86400)} 天前`;
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onClearAll,
  onDelete,
  onItemClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sortedNotifications = [...notifications].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="absolute top-14 right-0 z-50 w-[380px] max-w-[95vw] sm:right-0 transform translate-x-2 sm:translate-x-0" ref={containerRef}>
      {/* 优化后的箭头：背景改为纯白，防止透光 */}
      <div className="absolute top-0 right-5 w-4 h-4 bg-white border-t border-l border-slate-200 transform rotate-45 -translate-y-2 z-0"></div>

      {/* 优化后的主体容器：背景改为纯白(bg-white)，增强阴影(shadow-2xl) */}
      <div className="relative z-10 bg-white rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.15),0_10px_30px_-15px_rgba(0,0,0,0.2)] border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
        
        {/* Header: 背景颜色微调以增加对比度 */}
        <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 sticky top-0 z-20 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-800 tracking-tight">通知中心</h3>
            {notifications.length > 0 && (
                <span className="bg-slate-200/60 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {notifications.length}
                </span>
            )}
          </div>
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors px-2 py-1 rounded-lg hover:bg-slate-200/40 active:scale-95 transform"
            >
              清空
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[450px] overflow-y-auto custom-scrollbar">
          {sortedNotifications.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 bg-white">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                 <Bell size={24} className="opacity-30" />
              </div>
              <p className="text-sm font-medium text-slate-500">暂无新消息</p>
              <p className="text-xs text-slate-400 mt-1">您所有的通知都将显示在这里</p>
            </div>
          ) : (
            <div className="p-2 space-y-2 bg-white">
              {sortedNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  className={`relative p-4 rounded-xl transition-all cursor-pointer group border border-transparent
                    ${!n.read 
                        ? 'bg-blue-50/50 hover:bg-blue-50/80 border-blue-100/40' 
                        : 'bg-transparent hover:bg-slate-50 hover:border-slate-100/80 hover:shadow-sm'
                    }
                  `}
                >
                  <div className="flex gap-3.5">
                    {/* Icon Column */}
                    <div className="flex-shrink-0 mt-0.5">
                       {n.type === 'OVERDUE' ? (
                           <div className="relative">
                               <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center shadow-sm border border-rose-100">
                                   <Clock size={18} strokeWidth={2.5} />
                               </div>
                               {!n.read && (
                                   <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></span>
                               )}
                           </div>
                       ) : (
                           <div className="relative">
                               <div className="w-10 h-10 rounded-full bg-slate-50 text-slate-500 flex items-center justify-center shadow-sm border border-slate-100">
                                   <Bell size={18} strokeWidth={2.5} />
                               </div>
                               {!n.read && (
                                   <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></span>
                               )}
                           </div>
                       )}
                    </div>

                    {/* Content Column */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex justify-between items-start mb-1">
                          <h4 className={`text-sm leading-snug truncate pr-4 ${!n.read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap flex-shrink-0 pt-0.5">
                             {formatTimeAgo(n.timestamp)}
                          </span>
                      </div>
                      <p className={`text-xs leading-relaxed line-clamp-2 ${!n.read ? 'text-slate-600' : 'text-slate-400'}`}>
                        {n.message}
                      </p>
                    </div>
                  </div>
                  
                  {/* Hover Actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {!n.read && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onMarkRead(n.id); }}
                            className="p-1.5 bg-white hover:bg-blue-50 rounded-full text-blue-400 hover:text-blue-600 shadow-sm border border-slate-100 transition-colors"
                            title="标记已读"
                        >
                            <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                        </button>
                      )}
                      <button 
                         onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
                         className="p-1.5 bg-white hover:bg-rose-50 rounded-full text-slate-300 hover:text-rose-500 shadow-sm border border-slate-100 transition-colors"
                         title="删除"
                      >
                          <X size={12} />
                      </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer Fade: 同样保持纯白遮罩 */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none"></div>
      </div>
    </div>
  );
};
