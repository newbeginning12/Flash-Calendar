
import React, { useState, useEffect } from 'react';
import { X, Cpu, RotateCcw, Save } from 'lucide-react';
import { AISettings } from '../types';
import { DEFAULT_MODEL } from '../services/aiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    setLocalSettings({ model: DEFAULT_MODEL });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-white/50 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-800">
            <Cpu size={20} className="text-slate-500" />
            <h2 className="text-lg font-bold">系统设置</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          <div className="space-y-3">
             <label className="block text-sm font-semibold text-slate-700">
               AI 模型提供商
             </label>
             <div className="p-3 bg-slate-100 rounded-xl text-slate-500 text-sm border border-slate-200 cursor-not-allowed select-none">
                Google Gemini
             </div>
             <p className="text-[10px] text-slate-400">目前仅支持 Google Gemini 服务。</p>
          </div>

          <div className="space-y-3">
             <label className="block text-sm font-semibold text-slate-700">
               模型名称
             </label>
             <input 
                type="text"
                value={localSettings.model}
                onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
                placeholder="例如: gemini-2.5-flash"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
             />
             <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setLocalSettings({ ...localSettings, model: 'gemini-2.5-flash' })}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors"
                >
                  Flash 2.5
                </button>
                <button 
                  onClick={() => setLocalSettings({ ...localSettings, model: 'gemini-1.5-pro' })}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors"
                >
                  Pro 1.5
                </button>
                <button 
                  onClick={() => setLocalSettings({ ...localSettings, model: 'gemini-2.0-flash-thinking-exp' })}
                  className="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors"
                >
                  Flash 2.0 Thinking
                </button>
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed">
               输入有效的 Gemini 模型名称。设置将全局应用于智能建议和日程生成功能。
             </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 flex justify-between items-center">
           <button 
             onClick={handleReset}
             className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
           >
             <RotateCcw size={14} />
             恢复默认
           </button>
           
           <button 
             onClick={() => onSave(localSettings)}
             className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg shadow-slate-900/20 transform active:scale-95 transition-all text-sm font-medium"
           >
             <Save size={16} />
             <span>保存配置</span>
           </button>
        </div>
      </div>
    </div>
  );
};
