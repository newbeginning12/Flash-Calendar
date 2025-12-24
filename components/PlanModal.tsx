
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WorkPlan, PlanStatus, LinkResource } from '../types';
import { X, Tag, Trash2, Link as LinkIcon, ExternalLink, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlignLeft, Check, Clock, AlertCircle, ArrowRight, Calendar, Sparkles, Loader2, Minus, Plus } from 'lucide-react';
import { DateTimePicker } from './DateTimePicker';
import { differenceInMinutes, addMinutes, isSameDay } from 'date-fns';

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

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];

const DEFAULT_TAGS = [
  '工作', '会议', '开发', 'Bug修复', '需求', '设计', 
  '测试', '发布', '运维', '学习', '前端', '后端', 
  '全栈', 'Code Review', '重构', '调研', '面试', '周报', '分享',
  '紧急', '规划', '文档', '摸鱼'
];

export const PlanModal: React.FC<PlanModalProps> = ({ plan, isOpen, onClose, onSave, onDelete }) => {
  if (!isOpen || !plan) return null;

  const inputRef = useRef<HTMLInputElement>(null);
  const [editedPlan, setEditedPlan] = useState<WorkPlan>(plan);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [linkUrlError, setLinkUrlError] = useState<string | null>(null);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  
  const [tagInput, setTagInput] = useState('');
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);

  useEffect(() => {
    setEditedPlan({
      ...plan,
      links: plan.links || []
    });
    setTagInput('');
    setIsTagsExpanded(false);
    setShowColorPicker(false);
    setTimeError(null);
    setNewLinkUrl('');
    setNewLinkTitle('');
    setLinkUrlError(null);
    setIsFetchingTitle(false);
  }, [plan]);

  useEffect(() => {
    if (isOpen && plan) {
        const timer = setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.focus();
                if (plan.title === '新建日程') {
                    inputRef.current.select();
                }
            }
        }, 50);
        return () => clearTimeout(timer);
    }
  }, [isOpen, plan]);

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

  useEffect(() => {
    const start = new Date(editedPlan.startDate);
    const end = new Date(editedPlan.endDate);
    
    if (end.getTime() <= start.getTime()) {
        setTimeError('结束时间不能早于开始时间');
    } else if (!isSameDay(start, end)) {
        setTimeError('暂不支持跨天计划');
    } else {
        setTimeError(null);
    }
  }, [editedPlan.startDate, editedPlan.endDate]);

  useEffect(() => {
      if (editedPlan.title === '新建日程') {
          const now = new Date();
          const start = new Date(editedPlan.startDate);
          const end = new Date(editedPlan.endDate);
          
          let newStatus = PlanStatus.TODO;
          
          if (end <= now) {
              newStatus = PlanStatus.DONE;
          } else if (start <= now && end > now) {
              newStatus = PlanStatus.IN_PROGRESS;
          }
          
          if (newStatus !== editedPlan.status) {
              setEditedPlan(prev => ({ ...prev, status: newStatus }));
          }
      }
  }, [editedPlan.startDate, editedPlan.endDate, editedPlan.title]);

  const allTags = useMemo(() => Array.from(new Set([...DEFAULT_TAGS, ...customTags])), [customTags]);

  const handleChange = (field: keyof WorkPlan, value: any) => {
    setEditedPlan(prev => ({ ...prev, [field]: value }));
  };

  const handleStartTimeChange = (newStartIso: string) => {
      const oldStart = new Date(editedPlan.startDate);
      const oldEnd = new Date(editedPlan.endDate);
      const newStart = new Date(newStartIso);
      
      const durationMins = differenceInMinutes(oldEnd, oldStart);
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

  const durationLabel = useMemo(() => {
      const start = new Date(editedPlan.startDate);
      const end = new Date(editedPlan.endDate);
      const diff = differenceInMinutes(end, start);
      
      if (diff <= 0) return null;
      
      const h = Math.floor(diff / 60);
      const m = diff % 60;
      
      if (h > 0 && m > 0) return `${h}小时${m}分钟`;
      if (h > 0) return `${h}小时`;
      return `${m}分钟`;
  }, [editedPlan.startDate, editedPlan.endDate]);

  const adjustDuration = (hours: number) => {
      const start = new Date(editedPlan.startDate);
      const currentEnd = new Date(editedPlan.endDate);
      const newEnd = addMinutes(currentEnd, hours * 60);
      
      if (newEnd.getTime() > start.getTime() && isSameDay(start, newEnd)) {
          handleChange('endDate', newEnd.toISOString());
      }
  };

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

  const handleDeleteCustomTag = (e: React.MouseEvent, tag: string) => {
      e.stopPropagation(); 
      const newCustom = customTags.filter(t => t !== tag);
      setCustomTags(newCustom);
      localStorage.setItem('zhihui_custom_tags', JSON.stringify(newCustom));
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

  const isValidUrl = (string: string) => {
    try {
      new URL(string.startsWith('http') ? string : `https://${string}`);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewLinkUrl(val);
    if (val && !isValidUrl(val)) {
        setLinkUrlError('链接格式无效');
    } else {
        setLinkUrlError(null);
    }
  };

  const handleUrlPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    if (isValidUrl(pastedText)) {
        if (!newLinkTitle.trim()) {
            let fullUrl = pastedText;
            if (!/^https?:\/\//i.test(fullUrl)) {
                fullUrl = 'https://' + fullUrl;
            }

            try {
                const urlObj = new URL(fullUrl);
                const hostname = urlObj.hostname.replace(/^www\./, '');
                setNewLinkTitle(hostname);

                setIsFetchingTitle(true);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(fullUrl, {
                    signal: controller.signal,
                    mode: 'cors',
                    headers: { 'Accept': 'text/html' }
                });
                clearTimeout(timeoutId);

                if (response.ok) {
                    const html = await response.text();
                    const doc = new DOMParser().parseFromString(html, "text/html");
                    const pageTitle = doc.title;
                    if (pageTitle && pageTitle.trim()) {
                        setNewLinkTitle(pageTitle.trim());
                    }
                }
            } catch (err) {
            } finally {
                setIsFetchingTitle(false);
            }
        }
    }
  };

  const addLink = () => {
    if (!newLinkUrl.trim() || linkUrlError) return;
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
    setLinkUrlError(null);
  };

  const deleteLink = (id: string) => {
    setEditedPlan(prev => ({
      ...prev,
      links: prev.links.filter(l => l.id !== id)
    }));
  };

  const isDefaultTitle = editedPlan.title === '新建日程';

  const isDecreaseDisabled = useMemo(() => {
      const start = new Date(editedPlan.startDate);
      const end = new Date(editedPlan.endDate);
      return differenceInMinutes(end, start) <= 60;
  }, [editedPlan.startDate, editedPlan.endDate]);

  const isIncreaseDisabled = useMemo(() => {
      const start = new Date(editedPlan.startDate);
      const end = new Date(editedPlan.endDate);
      const nextEnd = addMinutes(end, 60);
      return !isSameDay(start, nextEnd);
  }, [editedPlan.startDate, editedPlan.endDate]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        <div className="px-8 pt-8 pb-4 flex-none">
            <div className="flex gap-5">
                <div className="pt-3 flex-shrink-0">
                     <div className="relative">
                        <button 
                            onClick={() => setShowColorPicker(!showColorPicker)}
                            className={`w-6 h-6 rounded-full bg-${editedPlan.color}-500 ring-4 ring-${editedPlan.color}-50 hover:ring-${editedPlan.color}-100 transition-all cursor-pointer shadow-sm`}
                            title="更换颜色"
                        />
                        {showColorPicker && (
                            <div className="absolute top-full left-0 mt-3 p-3 bg-white rounded-xl shadow-xl border border-slate-100 flex gap-2 z-50 animate-in fade-in zoom-in-95 w-[164px] flex-wrap">
                                {COLORS.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => { handleChange('color', c); setShowColorPicker(false); }}
                                        className={`w-6 h-6 rounded-full bg-${c}-500 hover:scale-110 transition-transform ${editedPlan.color === c ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                    />
                                ))}
                            </div>
                        )}
                     </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="relative group">
                        {isDefaultTitle && (
                            <div className="absolute -top-5 left-0 flex items-center gap-1 text-xs font-medium text-indigo-500 animate-in fade-in slide-in-from-bottom-1 pointer-events-none select-none opacity-90">
                                <Sparkles size={10} className="fill-indigo-500" />
                                <span>建议修改标题</span>
                            </div>
                        )}
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={editedPlan.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            className={`w-full text-2xl font-semibold bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none placeholder-slate-300 leading-tight py-1 transition-all ${
                                isDefaultTitle ? 'text-slate-400 font-normal' : 'text-slate-800'
                            }`}
                            placeholder="添加日程标题"
                        />
                    </div>
                    
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px]">
                            <DateTimePicker 
                                value={editedPlan.startDate} 
                                onChange={handleStartTimeChange} 
                                label="开始时间"
                            />
                        </div>
                        <ArrowRight size={16} className="text-slate-300 flex-shrink-0 mt-4 hidden sm:block" />
                        <div className="flex-1 min-w-[200px]">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    结束时间
                                </label>
                                {durationLabel && (
                                    <div className="flex items-center gap-1 px-1 animate-in fade-in group/stepper">
                                        <button 
                                            onClick={() => adjustDuration(-1)}
                                            disabled={isDecreaseDisabled}
                                            className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                            title="减少1小时"
                                        >
                                            <ChevronLeft size={12} strokeWidth={3} />
                                        </button>
                                        <span className="text-[10px] text-slate-600 font-bold px-1 min-w-[3.5em] text-center">
                                            {durationLabel}
                                        </span>
                                        <button 
                                            onClick={() => adjustDuration(1)}
                                            disabled={isIncreaseDisabled}
                                            className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                                            title="增加1小时"
                                        >
                                            <ChevronRight size={12} strokeWidth={3} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <DateTimePicker 
                                value={editedPlan.endDate} 
                                onChange={handleEndTimeChange}
                                minDate={editedPlan.startDate}
                                isError={!!timeError}
                            />
                        </div>
                    </div>
                    {timeError && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-rose-500 font-medium animate-in slide-in-from-top-1 fade-in">
                            <AlertCircle size={12} />
                            {timeError}
                        </div>
                    )}
                </div>
                
                <button onClick={onClose} className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors h-10 w-10 flex items-center justify-center self-start">
                    <X size={20} />
                </button>
            </div>
        </div>

        <div className="h-px bg-slate-100 w-full"></div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
            <div className="space-y-6">

                <div className="flex gap-5">
                    <div className="w-6 flex-shrink-0 flex justify-center mt-1 text-slate-400">
                        <Check size={20} />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">状态</label>
                        <div className="flex gap-2">
                            {Object.values(PlanStatus).map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleChange('status', s)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                        editedPlan.status === s
                                        ? 'bg-slate-800 text-white shadow-md'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    {STATUS_LABELS[s]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex gap-5">
                    <div className="w-6 flex-shrink-0 flex justify-center mt-1.5 text-slate-400">
                        <Tag size={20} />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">标签</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {editedPlan.tags.map(tag => (
                                <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 group">
                                    {tag}
                                    <button 
                                        onClick={() => handleRemoveTag(tag)}
                                        className="ml-1.5 text-indigo-400 hover:text-indigo-700 opacity-60 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                            <input 
                                type="text"
                                placeholder="输入标签按回车..."
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagInputKeyDown}
                                className="bg-transparent text-sm outline-none placeholder-slate-400 min-w-[120px] py-1 border-b border-transparent focus:border-indigo-300 transition-colors"
                            />
                        </div>
                        
                        <div className="relative">
                            <button 
                                onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                                className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors font-medium"
                            >
                                {isTagsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                {isTagsExpanded ? '收起推荐标签' : '显示推荐标签'}
                            </button>
                            
                            {isTagsExpanded && (
                                <div className="mt-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                                    {allTags.map(tag => {
                                        const isCustom = customTags.includes(tag);
                                        const isSelected = editedPlan.tags.includes(tag);
                                        return (
                                            <div key={tag} className="relative group/tagitem">
                                                <button
                                                    onClick={() => toggleTag(tag)}
                                                    className={`px-2.5 py-1 rounded-md text-xs border transition-all flex items-center gap-1 ${
                                                        isSelected
                                                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                                    }`}
                                                >
                                                    {tag}
                                                </button>
                                                {isCustom && (
                                                    <button 
                                                        onClick={(e) => handleDeleteCustomTag(e, tag)}
                                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-slate-200 text-slate-500 items-center justify-center hover:bg-rose-500 hover:text-white transition-all hidden group-hover/tagitem:flex shadow-sm z-10"
                                                        title="从推荐中删除"
                                                    >
                                                        <X size={8} strokeWidth={4} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-5">
                    <div className="w-6 flex-shrink-0 flex justify-center mt-1 text-slate-400">
                        <AlignLeft size={20} />
                    </div>
                    <div className="flex-1">
                         <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">备注</label>
                         <textarea 
                            value={editedPlan.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="添加详细说明..."
                            className="w-full min-h-[100px] text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 resize-none outline-none focus:border-indigo-500 focus:bg-white transition-all leading-relaxed"
                        />
                    </div>
                </div>

                <div className="flex gap-5">
                    <div className="w-6 flex-shrink-0 flex justify-center mt-1.5 text-slate-400">
                        <LinkIcon size={20} />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">相关链接</label>
                        <div className="space-y-2 mb-3">
                             {editedPlan.links.map(link => (
                                <div key={link.id} className="flex items-center gap-2 group text-sm bg-white border border-slate-100 p-2 rounded-lg hover:border-indigo-200 transition-colors">
                                     <div className="p-1.5 bg-slate-50 rounded text-slate-400">
                                         <LinkIcon size={12} />
                                     </div>
                                     <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline truncate flex-1 flex items-center gap-1 font-medium">
                                         {link.title} <ExternalLink size={10} className="opacity-50" />
                                     </a>
                                     <button onClick={() => deleteLink(link.id)} className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-rose-50 transition-colors">
                                         <X size={14} />
                                     </button>
                                </div>
                            ))}
                        </div>
                        
                        <div className="space-y-1.5">
                            <div className={`flex items-center gap-2 bg-slate-50 p-1 rounded-xl border focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all ${linkUrlError ? 'border-rose-300 focus-within:border-rose-400' : 'border-slate-200 focus-within:border-indigo-400'}`}>
                                 <div className="relative w-1/3 border-r border-slate-200">
                                     <input 
                                        type="text"
                                        value={newLinkTitle}
                                        onChange={(e) => setNewLinkTitle(e.target.value)}
                                        placeholder="链接名称 (可选)"
                                        className="w-full bg-transparent text-sm px-3 py-1.5 outline-none text-slate-700 placeholder-slate-400"
                                    />
                                    {isFetchingTitle && (
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <Loader2 size={12} className="animate-spin text-indigo-400" />
                                        </div>
                                    )}
                                 </div>
                                 <input 
                                    type="text"
                                    value={newLinkUrl}
                                    onChange={handleUrlChange}
                                    onPaste={handleUrlPaste}
                                    onKeyDown={(e) => e.key === 'Enter' && addLink()}
                                    placeholder="输入或粘贴 URL (https://...)"
                                    className="flex-1 bg-transparent text-sm px-3 py-1.5 outline-none text-slate-700 placeholder-slate-400"
                                />
                                <button 
                                    onClick={addLink}
                                    disabled={!newLinkUrl.trim() || !!linkUrlError}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                >
                                    添加
                                </button>
                            </div>
                            {linkUrlError && (
                                <div className="flex items-center gap-1.5 px-1 text-xs text-rose-500 animate-in fade-in slide-in-from-top-1">
                                    <AlertCircle size={10} />
                                    <span>{linkUrlError}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <div className="flex-none px-8 py-5 border-t border-slate-100 bg-white flex justify-between items-center z-10">
          <button 
            onClick={() => onDelete(editedPlan.id)}
            className="text-slate-400 hover:text-rose-600 text-sm font-medium flex items-center gap-1.5 px-3 py-2 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <Trash2 size={16} />
            删除
          </button>
          
          <div className="flex gap-3">
             <button 
                onClick={onClose}
                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors text-sm"
             >
                取消
             </button>
             <button 
                onClick={() => onSave(editedPlan)}
                disabled={!!timeError}
                className="px-8 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg shadow-slate-900/20 transform active:scale-95 transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
             >
                保存修改
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
