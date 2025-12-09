
import React, { useState, useEffect } from 'react';
import { WorkPlan, PlanStatus, LinkResource } from '../types';
import { X, Tag, Trash2, Link as LinkIcon, ExternalLink, ChevronDown, ChevronUp, CornerDownLeft, AlertCircle } from 'lucide-react';
import { DateTimePicker } from './DateTimePicker';
import { differenceInMinutes, addMinutes } from 'date-fns';

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

// Built-in Programmer/Productivity Tags
const DEFAULT_TAGS = [
  '工作', '会议', '开发', 'Bug修复', '需求', '设计', 
  '测试', '发布', '运维', '学习', '前端', '后端', 
  '全栈', 'Code Review', '重构', '调研', '面试', '周报', '分享',
  '紧急', '规划', '文档', '摸鱼'
];

export const PlanModal: React.FC<PlanModalProps> = ({ plan, isOpen, onClose, onSave, onDelete }) => {
  if (!isOpen || !plan) return null;

  const [editedPlan, setEditedPlan] = useState<WorkPlan>(plan);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  
  // Tag State
  const [tagInput, setTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  
  // Validation State
  const [timeError, setTimeError] = useState<string | null>(null);

  useEffect(() => {
    setEditedPlan({
      ...plan,
      links: plan.links || []
    });
    setTagInput('');
    setIsTagsExpanded(false);
    setTimeError(null);
  }, [plan]);

  // Load custom tags from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('zhihui_custom_tags');
    if (saved) {
        try {
            setCustomTags(JSON.parse(saved));
        } catch(e) {
            console.error('Failed to load custom tags');
        }
    }
  }, []);

  // Validate time whenever dates change
  useEffect(() => {
    const start = new Date(editedPlan.startDate).getTime();
    const end = new Date(editedPlan.endDate).getTime();
    
    if (end <= start) {
        setTimeError('结束时间不能早于开始时间');
    } else {
        setTimeError(null);
    }
  }, [editedPlan.startDate, editedPlan.endDate]);

  // Combine default and custom tags
  const allTags = Array.from(new Set([...DEFAULT_TAGS, ...customTags]));

  const handleChange = (field: keyof WorkPlan, value: any) => {
    setEditedPlan(prev => ({ ...prev, [field]: value }));
  };

  const handleStartTimeChange = (newStartIso: string) => {
      const oldStart = new Date(editedPlan.startDate);
      const oldEnd = new Date(editedPlan.endDate);
      const newStart = new Date(newStartIso);
      
      // Calculate original duration
      const durationMins = differenceInMinutes(oldEnd, oldStart);
      
      // Auto-shift End Time to maintain duration (or at least keep it valid)
      // If duration was negative or zero (invalid), default to 1 hour
      const validDuration = durationMins > 0 ? durationMins : 60;
      const newEnd = addMinutes(newStart, validDuration);

      setEditedPlan(prev => ({
          ...prev,
          startDate: newStartIso,
          endDate: newEnd.toISOString()
      }));
  };

  const handleEndTimeChange = (newEndIso: string) => {
      handleChange('endDate', newEndIso);
  };

  // --- Tag Handlers ---
  const handleAddTag = (tag: string) => {
      const cleanTag = tag.trim();
      if (!cleanTag) return;
      
      if (!editedPlan.tags.includes(cleanTag)) {
          handleChange('tags', [...editedPlan.tags, cleanTag]);
      }
      
      if (!DEFAULT_TAGS.includes(cleanTag) && !customTags.includes(cleanTag)) {
          const newCustom = [...customTags, cleanTag];
          setCustomTags(newCustom);
          localStorage.setItem('zhihui_custom_tags', JSON.stringify(newCustom));
      }
      setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
      handleChange('tags', editedPlan.tags.filter(t => t !== tagToRemove));
  };

  const toggleTag = (tag: string) => {
      if (editedPlan.tags.includes(tag)) {
          handleRemoveTag(tag);
      } else {
          handleAddTag(tag);
      }
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          e.preventDefault();
          handleAddTag(tagInput);
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
        
        {/* --- Sticky Header --- */}
        <div className="flex-none p-6 pb-2 border-b border-transparent">
             <div className="flex justify-between items-start mb-2">
                <div className="flex-1 mr-4">
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
        </div>
        
        {/* --- Scrollable Body --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6">
            
            {/* Time Inputs (New DateTimePicker) */}
            <div className="mb-6 pt-2">
                <div className="grid grid-cols-2 gap-4">
                    <DateTimePicker 
                        label="开始时间"
                        value={editedPlan.startDate}
                        onChange={handleStartTimeChange}
                    />
                    <DateTimePicker 
                        label="结束时间"
                        value={editedPlan.endDate}
                        onChange={handleEndTimeChange}
                        isError={!!timeError}
                        minDate={editedPlan.startDate}
                    />
                </div>
                
                {/* Error Message */}
                {timeError && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-500 font-medium animate-in slide-in-from-top-1 fade-in">
                        <AlertCircle size={12} />
                        {timeError}
                    </div>
                )}
            </div>

            {/* Status */}
            <div className="mb-6">
                 <div className="flex items-center">
                    <select 
                        value={editedPlan.status}
                        onChange={(e) => handleChange('status', e.target.value)}
                        className="block w-full rounded-xl border-slate-200 bg-slate-50/50 py-2 px-3 text-sm font-medium text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 hover:bg-white transition-colors cursor-pointer"
                    >
                        {Object.values(PlanStatus).map(s => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tags Section */}
            <div className="mb-6">
                <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1.5 block">
                    标签
                </label>
                
                {/* 1. Active Tags & Input Area */}
                <div className="flex flex-wrap gap-2 mb-3 bg-white border border-slate-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all">
                    {editedPlan.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            {tag}
                            <button 
                                onClick={() => handleRemoveTag(tag)}
                                className="ml-1.5 text-blue-400 hover:text-blue-600 focus:outline-none"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                    
                    <div className="relative flex-1 min-w-[120px]">
                        <input 
                            type="text"
                            placeholder={editedPlan.tags.length === 0 ? "输入新标签..." : "添加..."}
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleTagInputKeyDown}
                            className="w-full h-full bg-transparent border-none py-1 px-1 text-sm outline-none placeholder-slate-400"
                        />
                        {tagInput && (
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 animate-in fade-in shadow-sm">
                                <CornerDownLeft size={10} />
                                回车保存
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Collapsible Presets Area */}
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 transition-all">
                    <div 
                        className="flex items-center justify-between cursor-pointer mb-2 select-none"
                        onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                    >
                        <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                           <Tag size={12} /> 常用标签
                        </span>
                        <button className="text-slate-400 hover:text-blue-600 transition-colors">
                            {isTagsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    </div>
                    
                    <div className={`relative transition-all duration-300 ease-in-out overflow-hidden ${isTagsExpanded ? 'max-h-48 opacity-100' : 'max-h-[28px] opacity-90'}`}>
                        <div className="flex flex-wrap gap-2 pb-1">
                            {allTags.map(tag => {
                                const isSelected = editedPlan.tags.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`
                                            px-2 py-0.5 rounded-md text-xs border transition-all whitespace-nowrap
                                            ${isSelected 
                                                ? 'bg-blue-100 text-blue-700 border-blue-200 font-medium' 
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                            }
                                        `}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                        {!isTagsExpanded && (
                            <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none"></div>
                        )}
                    </div>
                    
                    {!isTagsExpanded && (
                        <div 
                            onClick={() => setIsTagsExpanded(true)}
                            className="text-[10px] text-center text-slate-400 mt-1 cursor-pointer hover:text-blue-500 flex items-center justify-center gap-1 pt-1 border-t border-slate-100/50"
                        >
                            <ChevronDown size={10} /> 展开全部
                        </div>
                    )}
                </div>
            </div>

            {/* Description */}
            <div className="mb-6">
                 <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1.5 block">备注信息</label>
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
                     <label className="text-[10px] text-slate-400 font-medium uppercase tracking-wide flex items-center gap-1">
                        <LinkIcon size={12} /> 相关链接
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

        {/* --- Sticky Footer --- */}
        <div className="flex-none p-6 pt-4 border-t border-slate-100 bg-white/50 backdrop-blur-md flex justify-between items-center z-10">
          <button 
            onClick={() => onDelete(editedPlan.id)}
            className="flex items-center space-x-2 px-4 py-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors text-sm font-medium"
          >
            <Trash2 size={16} />
            <span>删除</span>
          </button>
          
          <button 
            onClick={() => onSave(editedPlan)}
            disabled={!!timeError}
            className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg shadow-slate-900/20 transform active:scale-95 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            保存修改
          </button>
        </div>
      </div>
    </div>
  );
};
