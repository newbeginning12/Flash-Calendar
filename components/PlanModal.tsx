
import React from 'react';
import { WorkPlan, PlanStatus } from '../types';
import { X, Calendar, Clock, Tag, Trash2 } from 'lucide-react';

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

// Helper to convert a UTC ISO string to a Local ISO string for datetime-local input
// Input: "2024-05-21T10:00:00.000Z" (UTC)
// Output: "2024-05-21T18:00" (Local time string, if timezone is +8)
const toLocalInputString = (isoString: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  // Get offset in milliseconds. getTimezoneOffset returns minutes (positive for West, negative for East)
  // e.g., China is -480 minutes.
  const offset = date.getTimezoneOffset() * 60000;
  // Subtracting the offset (negative for East) adds the hours.
  const localDate = new Date(date.getTime() - offset);
  return localDate.toISOString().slice(0, 16);
};

export const PlanModal: React.FC<PlanModalProps> = ({ plan, isOpen, onClose, onSave, onDelete }) => {
  if (!isOpen || !plan) return null;

  const [editedPlan, setEditedPlan] = React.useState<WorkPlan>(plan);

  React.useEffect(() => {
    setEditedPlan(plan);
  }, [plan]);

  const handleChange = (field: keyof WorkPlan, value: any) => {
    setEditedPlan(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    // value is in local time format "YYYY-MM-DDTHH:mm"
    if (!value) return;
    const date = new Date(value); // This creates a Date object treating the string as local time
    if (!isNaN(date.getTime())) {
      handleChange(field, date.toISOString()); // Store back as standard UTC ISO
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-white/50 overflow-hidden transform transition-all scale-100 p-6 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
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
        <div className="space-y-4 mb-6">
          <div className="flex items-center space-x-3 text-slate-600 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 transition-colors focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-sm">
            <Calendar size={18} className="text-slate-400" />
            <div className="flex flex-col text-sm w-full">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">开始时间</span>
                <input 
                  type="datetime-local" 
                  value={toLocalInputString(editedPlan.startDate)}
                  onChange={(e) => handleDateChange('startDate', e.target.value)}
                  className="bg-transparent border-none outline-none p-0 text-slate-700 font-medium w-full"
                />
            </div>
          </div>
          
          <div className="flex items-center space-x-3 text-slate-600 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 transition-colors focus-within:bg-white focus-within:border-blue-200 focus-within:shadow-sm">
            <Clock size={18} className="text-slate-400" />
            <div className="flex flex-col text-sm w-full">
                <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">结束时间</span>
                 <input 
                  type="datetime-local" 
                  value={toLocalInputString(editedPlan.endDate)}
                  onChange={(e) => handleDateChange('endDate', e.target.value)}
                  className="bg-transparent border-none outline-none p-0 text-slate-700 font-medium w-full"
                />
            </div>
          </div>
        </div>

        {/* Status & Tags */}
        <div className="space-y-4 mb-6">
           <div className="flex items-center space-x-4">
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
           
           <div className="flex items-center space-x-2">
             <Tag size={16} className="text-slate-400" />
             <input 
                type="text"
                placeholder="添加标签（用逗号分隔）..."
                value={editedPlan.tags.join(', ')}
                onChange={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()))}
                className="flex-1 bg-transparent border-b border-slate-200 py-1 text-sm outline-none focus:border-blue-500 transition-colors"
             />
           </div>
        </div>

        {/* Description */}
        <textarea 
          value={editedPlan.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="添加备注、会议链接或详情..."
          className="w-full h-24 p-3 bg-slate-50/50 rounded-2xl text-sm text-slate-700 resize-none outline-none border border-slate-100 focus:bg-white focus:shadow-sm focus:ring-1 focus:ring-blue-500/20 transition-all mb-6"
        />

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-2">
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
