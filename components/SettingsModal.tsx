
import React, { useState, useEffect } from 'react';
import { X, Cpu, RotateCcw, Save, Key, Globe, Check } from 'lucide-react';
import { AISettings, AIProvider } from '../types';
import { DEFAULT_MODEL } from '../services/aiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
}

const PROVIDERS = [
  { id: AIProvider.GOOGLE, name: 'Google Gemini', icon: 'G' },
  { id: AIProvider.DEEPSEEK, name: 'DeepSeek', icon: 'D' },
  { id: AIProvider.ALI_QWEN, name: '阿里通义千问 (Qwen)', icon: 'Q' },
  { id: AIProvider.CUSTOM, name: 'OpenAI 兼容接口', icon: 'C' },
];

const PRESETS = {
  [AIProvider.GOOGLE]: [
    { name: 'gemini-2.5-flash', label: 'Flash 2.5' },
    { name: 'gemini-1.5-pro', label: 'Pro 1.5' },
    { name: 'gemini-2.0-flash-thinking-exp', label: 'Flash 2.0 Thinking' },
  ],
  [AIProvider.DEEPSEEK]: [
    { name: 'deepseek-chat', label: 'DeepSeek V3' },
    { name: 'deepseek-reasoner', label: 'DeepSeek R1 (推理)' },
  ],
  [AIProvider.ALI_QWEN]: [
    { name: 'qwen-plus', label: 'Qwen Plus' },
    { name: 'qwen-turbo', label: 'Qwen Turbo' },
    { name: 'qwen-max', label: 'Qwen Max' },
  ]
};

const DEFAULT_URLS = {
  [AIProvider.DEEPSEEK]: 'https://api.deepseek.com',
  [AIProvider.ALI_QWEN]: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  [AIProvider.CUSTOM]: 'https://api.openai.com/v1',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);

  useEffect(() => {
    // Merge incoming settings with defaults to ensure all fields exist
    setLocalSettings({
        provider: AIProvider.GOOGLE,
        model: DEFAULT_MODEL,
        apiKey: '',
        baseUrl: '',
        ...settings
    });
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleReset = () => {
    setLocalSettings({ 
        provider: AIProvider.GOOGLE, 
        model: DEFAULT_MODEL,
        apiKey: '',
        baseUrl: ''
    });
  };

  const handleProviderChange = (provider: AIProvider) => {
      setLocalSettings(prev => ({
          ...prev,
          provider,
          // Auto-fill Base URL if switching to a known provider
          baseUrl: DEFAULT_URLS[provider as keyof typeof DEFAULT_URLS] || prev.baseUrl,
          // Reset model to first preset if available
          model: PRESETS[provider as keyof typeof PRESETS]?.[0]?.name || ''
      }));
  };

  const isCustomProvider = localSettings.provider !== AIProvider.GOOGLE;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-white/50 overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-100 flex-none">
          <div className="flex items-center gap-2 text-slate-800">
            <Cpu size={20} className="text-slate-500" />
            <h2 className="text-lg font-bold">AI 模型设置</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Provider Selection */}
          <div className="space-y-3">
             <label className="block text-sm font-semibold text-slate-700">
               模型提供商 (Provider)
             </label>
             <div className="grid grid-cols-1 gap-2">
                {PROVIDERS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => handleProviderChange(p.id)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm font-medium ${
                            localSettings.provider === p.id 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <span className="flex items-center gap-2">
                             <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${
                                 localSettings.provider === p.id ? 'bg-white/20' : 'bg-slate-100'
                             }`}>
                                 {p.icon}
                             </span>
                             {p.name}
                        </span>
                        {localSettings.provider === p.id && <Check size={16} />}
                    </button>
                ))}
             </div>
          </div>
          
          {/* Settings Fields */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
             
             {/* Custom API Key & Base URL (Hidden for Google) */}
             {isCustomProvider && (
                 <>
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            <Key size={12} /> API Key
                        </label>
                        <input 
                            type="password"
                            value={localSettings.apiKey || ''}
                            onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                            placeholder={`输入 ${PROVIDERS.find(p => p.id === localSettings.provider)?.name} API Key`}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        />
                        <p className="text-[10px] text-slate-400">您的 API Key 仅存储在本地浏览器中，不会上传到我们的服务器。</p>
                    </div>

                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            <Globe size={12} /> Base URL
                        </label>
                        <input 
                            type="text"
                            value={localSettings.baseUrl || ''}
                            onChange={(e) => setLocalSettings({ ...localSettings, baseUrl: e.target.value })}
                            placeholder="https://api.example.com/v1"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                        />
                    </div>
                 </>
             )}

             {/* Model Name */}
             <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    模型名称 (Model Name)
                </label>
                <input 
                    type="text"
                    value={localSettings.model}
                    onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                />
                
                {/* Presets */}
                {PRESETS[localSettings.provider as keyof typeof PRESETS] && (
                    <div className="flex flex-wrap gap-2 mt-2">
                        {PRESETS[localSettings.provider as keyof typeof PRESETS].map(preset => (
                            <button 
                                key={preset.name}
                                onClick={() => setLocalSettings({ ...localSettings, model: preset.name })}
                                className={`px-2 py-1 text-[10px] rounded-md transition-colors border ${
                                    localSettings.model === preset.name 
                                        ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' 
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                )}
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-slate-100 flex justify-between items-center flex-none bg-white/50 backdrop-blur-md">
           <button 
             onClick={handleReset}
             className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
           >
             <RotateCcw size={14} />
             恢复默认
           </button>
           
           <button 
             onClick={() => onSave(localSettings)}
             disabled={isCustomProvider && !localSettings.apiKey}
             className="flex items-center gap-2 px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg shadow-slate-900/20 transform active:scale-95 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
           >
             <Save size={16} />
             <span>保存配置</span>
           </button>
        </div>
      </div>
    </div>
  );
};
