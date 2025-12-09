
import React, { useState } from 'react';
import { WorkPlan, PlanStatus, LinkResource } from '../types';
import { X, Calendar, Clock, Tag, Trash2, Link as LinkIcon, ExternalLink } from 'lucide-react';

interface PlanModalProps {
  plan: WorkPlan | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: WorkPlan) => void;
  onDelete: (id: string) => void;
}

const STATUS_LABELS: Record<PlanStatus, string> = {
  [PlanStatus.TODO]: '待办',
  [PlanStatus.IN_PROGRESS]: '进行中',
  [PlanStatus.DONE]: '已完成',
};

const toLocalInputString = (isoString: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const offset = date.getTimezoneOffset() * 60000;
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

export const PlanModal: React.FC<PlanModalProps> = ({ plan, isOpen, onClose, onSave, onDelete }) => {
  if (!isOpen || !plan) return null;

  const [editedPlan, setEditedPlan] = React.useState<WorkPlan>(plan);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');

  React.useEffect(() => {
    setEditedPlan({
      ...plan,
      links: plan.links || []
    });
  }, [plan]);

  const handleChange = (field: keyof WorkPlan, value: any) => {
    setEditedPlan(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    if (!value) return;
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      handleChange(field, date.toISOString());
    }
  };

  // --- Link Handlers ---
  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    
    const newLink: LinkResource = {
      id: crypto.randomUUID(),
      title: newLinkTitle.trim() || url,
      url: url
    };
    setEditedPlan(prev => ({
      ...prev,
      links: [...prev.links, newLink]
    }));
    setNewLinkUrl('');
    setNewLinkTitle('');
  };

  const deleteLink = (id: string) => {
    setEditedPlan(prev => ({
      ...prev,
      links: prev.links.filter(l => l.id !== id)
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-white/50 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {/* Header Input */}
            <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
                <input 
                type="text" 
                value={editedPlan.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="w-full text-2xl font-semibold bg-transparent border-none outline-none placeholder-slate-400 text-slate-800"
                placeholder="日程标题"
                autoFocus
                />
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50 transition-colors">
                <X size={20} />
            </button>
            </div>

            {/* Time Inputs */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-3 text-slate-600 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 transition-colors focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-sm">
                    <Calendar size={18} className="text-slate-400 shrink-0" />
                    <div className="flex flex-col text-sm w-full min-w-0">
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">开始时间</span>
                        <input 
                        type="datetime-local" 
                        value={toLocalInputString(editedPlan.startDate)}
                        onChange={(e) => handleDateChange('startDate', e.target.value)}
                        className="bg-transparent border-none outline-none p-0 text-slate-700 font-medium w-full text-xs sm:text-sm"
                        />
                    </div>
                </div>
                
                <div className="flex items-center space-x-3 text-slate-600 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 transition-colors focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-sm">
                    <Clock size={18} className="text-slate-400 shrink-0" />
                    <div className="flex flex-col text-sm w-full min-w-0">
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">结束时间</span>
                        <input 
                        type="datetime-local" 
                        value={toLocalInputString(editedPlan.endDate)}
                        onChange={(e) => handleDateChange('endDate', e.target.value)}
                        className="bg-transparent border-none outline-none p-0 text-slate-700 font-medium w-full text-xs sm:text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Status & Tags */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center">
                    <select 
                        value={editedPlan.status}
                        onChange={(e) => handleChange('status', e.target.value)}
                        className="block w-full rounded-xl border-slate-200 bg-white py-2 px-3 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                        {Object.values(PlanStatus).map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                    </select>
                </div>
                
                <div className="flex items-center space-x-2 bg-white rounded-xl border border-slate-200 px-3 shadow-sm">
                    <Tag size={16} className="text-slate-400 shrink-0" />
                    <input 
                        type="text"
                        placeholder="添加标签..."
                        value={editedPlan.tags.join(', ')}
                        onChange={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()))}
                        className="flex-1 bg-transparent border-none py-2 text-sm outline-none w-full min-w-0"
                    />
                </div>
            </div>

            {/* Description */}
            <div className="mb-6">
                 <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 block">备注信息</label>
                <textarea 
                    value={editedPlan.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="添加备注详情..."
                    className="w-full h-20 p-3 bg-slate-50/50 rounded-2xl text-sm text-slate-700 resize-none outline-none border border-slate-100 focus:bg-white focus:shadow-sm focus:ring-1 focus:ring-blue-500/20 transition-all"
                />
            </div>

            {/* Links Section */}
            <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                     <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                        <LinkIcon size={14} /> 相关链接
                     </label>
                </div>
                <div className="space-y-2">
                    {editedPlan.links.map(link => (
                        <div key={link.id} className="flex items-center gap-2 group bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 hover:border-blue-200 hover:shadow-sm transition-all">
                             <div className="bg-blue-100 text-blue-600 p-1 rounded">
                                 <LinkIcon size={12} />
                             </div>
                             <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-blue-600 hover:underline truncate flex items-center gap-1">
                                 {link.title} <ExternalLink size={10} className="opacity-50" />
                             </a>
                             <button onClick={() => deleteLink(link.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1">
                                 <X size={14} />
                             </button>
                        </div>
                    ))}
                    
                    <div className="flex flex-col gap-2 mt-2 p-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
                        <div className="flex items-center gap-2">
                             <input 
                                type="text"
                                value={newLinkTitle}
                                onChange={(e) => setNewLinkTitle(e.target.value)}
                                placeholder="链接标题 (可选)"
                                className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-400"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                             <input 
                                type="text"
                                value={newLinkUrl}
                                onChange={(e) => setNewLinkUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addLink()}
                                placeholder="https://..."
                                className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-400"
                            />
                            <button 
                                onClick={addLink}
                                disabled={!newLinkUrl.trim()}
                                className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
                            >
                                添加
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t border-slate-100 bg-white/50 backdrop-blur-md flex justify-between items-center shrink-0">
          <button 
            onClick={() => onDelete(editedPlan.id)}
            className="flex items-center space-x-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-sm font-medium"
          >
            <Trash2 size={16} />
            <span>删除</span>
          </button>
          
          <button 
            onClick={() => onSave(editedPlan)}
            className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg shadow-slate-900/20 transform active:scale-95 transition-all text-sm font-medium"
          >
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
};
