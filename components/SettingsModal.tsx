
import React, { useState, useEffect, useRef } from 'react';
import { X, Cpu, RotateCcw, Save, Key, Globe, Check, HardDrive, Download, UploadCloud, Settings, AlertTriangle, FileText, CalendarDays, Sparkles, ExternalLink, ArrowRight, Circle } from 'lucide-react';
import { AISettings, AIProvider } from '../types';
import { DEFAULT_MODEL } from '../services/aiService';
import { storageService, BackupData } from '../services/storageService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AISettings;
  onSave: (settings: AISettings) => void;
  onExport: () => void;
  onImport: (data: BackupData) => void;
}

const PROVIDERS = [
  { id: AIProvider.DEEPSEEK, name: 'DeepSeek', icon: 'D', desc: '高性能国产模型，支持 V3 及 R1 推理' },
  { id: AIProvider.ALI_QWEN, name: '阿里通义千问', icon: 'Q', desc: '中文语境理解专家，响应速度极快' },
  { id: AIProvider.CUSTOM, name: '自定义接口', icon: 'C', desc: '连接任何 OpenAI 兼容的第三方平台' },
  { id: AIProvider.GOOGLE, name: 'Google Gemini', icon: 'G', desc: '谷歌原厂模型，支持官方 Key 安全授权' },
];

const PRESETS = {
  [AIProvider.GOOGLE]: [
    { name: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
    { name: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
  ],
  [AIProvider.DEEPSEEK]: [
    { name: 'deepseek-chat', label: 'DeepSeek V3' },
    { name: 'deepseek-reasoner', label: 'DeepSeek R1 (推理)' },
  ],
  [AIProvider.ALI_QWEN]: [
    { name: 'qwen-plus', label: 'Qwen Plus' },
    { name: 'qwen-max', label: 'Qwen Max' },
  ]
};

const DEFAULT_URLS = {
  [AIProvider.DEEPSEEK]: 'https://api.deepseek.com',
  [AIProvider.ALI_QWEN]: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  [AIProvider.CUSTOM]: 'https://api.openai.com/v1',
};

type TabType = 'ai' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, onExport, onImport }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [pendingData, setPendingData] = useState<BackupData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [geminiKeySelected, setGeminiKeySelected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSettings({ ...settings });
    setPendingData(null);
    setImportError(null);
    
    if (isOpen) {
        checkGeminiKey();
    }
  }, [settings, isOpen]);

  const checkGeminiKey = async () => {
    if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setGeminiKeySelected(hasKey);
    }
  };

  const handleOpenGeminiKeySelector = async () => {
    if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
        setGeminiKeySelected(true);
    }
  };

  if (!isOpen) return null;

  const handleProviderChange = (provider: AIProvider) => {
      setLocalSettings(prev => ({
          ...prev,
          provider,
          baseUrl: DEFAULT_URLS[provider as keyof typeof DEFAULT_URLS] || '',
          model: PRESETS[provider as keyof typeof PRESETS]?.[0]?.name || prev.model,
          apiKey: provider === AIProvider.GOOGLE ? '' : prev.apiKey
      }));
  };

  const isGoogle = localSettings.provider === AIProvider.GOOGLE;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-white/50 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 flex-none">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings size={20} className="text-slate-500" />
            <h2 className="text-lg font-bold">系统设置</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4 pb-0 flex-none">
            <div className="flex p-1 bg-slate-100/80 rounded-xl">
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'ai' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Cpu size={16} /> AI 服务
                </button>
                <button 
                     onClick={() => setActiveTab('data')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'data' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <HardDrive size={16} /> 数据
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'ai' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">选择服务商</label>
                    <div className="flex flex-col gap-2.5">
                        {PROVIDERS.map(p => {
                            const isSelected = localSettings.provider === p.id;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => handleProviderChange(p.id)}
                                    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left ${
                                        isSelected 
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg ring-4 ring-slate-900/5' 
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-black flex-shrink-0 ${isSelected ? 'bg-white/20' : 'bg-slate-100'}`}>
                                        {p.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold flex items-center gap-2">
                                            {p.name}
                                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
                                        </div>
                                        <div className={`text-[10px] truncate mt-0.5 font-medium ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                                            {p.desc}
                                        </div>
                                    </div>
                                    <div className={`flex-shrink-0 ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                        {isSelected ? <Check size={20} strokeWidth={3} /> : <Circle size={20} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-slate-100">
                    {isGoogle ? (
                        <div className="space-y-4">
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5">
                                <h4 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                                    <Key size={16} /> Gemini 授权
                                </h4>
                                <p className="text-xs text-indigo-700/70 mb-4 leading-relaxed">
                                    为了保障个人数据安全，请点击下方按钮选择您的个人 Gemini API Key。
                                </p>
                                <button 
                                    onClick={handleOpenGeminiKeySelector}
                                    className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                                        geminiKeySelected 
                                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                                        : 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700'
                                    }`}
                                >
                                    {geminiKeySelected ? <Check size={16} /> : <Sparkles size={16} />}
                                    {geminiKeySelected ? '已授权 API Key' : '立即选择 API Key'}
                                </button>
                                <a 
                                    href="https://ai.google.dev/gemini-api/docs/billing" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="mt-3 flex items-center justify-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors uppercase tracking-wider"
                                >
                                    查看计费说明 <ExternalLink size={10} />
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    <Key size={12} /> API Key
                                </label>
                                <input 
                                    type="password"
                                    value={localSettings.apiKey || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                                    placeholder="输入您的 API Key"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                    <Globe size={12} /> Base URL
                                </label>
                                <input 
                                    type="text"
                                    value={localSettings.baseUrl || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, baseUrl: e.target.value })}
                                    placeholder="接口基准地址"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">模型选择</label>
                        <input 
                            type="text"
                            value={localSettings.model}
                            onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono"
                        />
                        {PRESETS[localSettings.provider as keyof typeof PRESETS] && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {PRESETS[localSettings.provider as keyof typeof PRESETS].map(preset => (
                                    <button 
                                        key={preset.name}
                                        onClick={() => setLocalSettings({ ...localSettings, model: preset.name })}
                                        className={`px-3 py-1 text-[10px] rounded-lg transition-all border ${
                                            localSettings.model === preset.name 
                                                ? 'bg-slate-900 border-slate-900 text-white' 
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
          )}

          {activeTab === 'data' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-start gap-3">
                     <HardDrive size={20} className="text-indigo-500 mt-1" />
                     <div className="flex-1">
                         <h4 className="text-sm font-bold text-slate-800">本地离线存储</h4>
                         <p className="text-xs text-slate-500 mt-1 leading-relaxed">您的日程数据仅保存在当前浏览器的 IndexedDB 中。建议每周导出一次备份。</p>
                     </div>
                 </div>

                 <div className="grid grid-cols-1 gap-3">
                     <button onClick={onExport} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 group transition-all">
                         <span className="flex items-center gap-3">
                            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform"><Download size={18} /></span>
                            <span className="text-sm font-bold text-slate-800">导出数据备份</span>
                         </span>
                         <ArrowRight size={16} className="text-slate-300" />
                     </button>
                     <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 group transition-all">
                         <span className="flex items-center gap-3">
                            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform"><UploadCloud size={18} /></span>
                            <span className="text-sm font-bold text-slate-800">导入数据恢复</span>
                         </span>
                         <ArrowRight size={16} className="text-slate-300" />
                     </button>
                     <input type="file" ref={fileInputRef} onChange={async (e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                             const data = await storageService.importData(file);
                             if (data) setPendingData(data);
                         }
                         e.target.value = '';
                     }} accept=".json" className="hidden" />
                 </div>
              </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white/50 backdrop-blur-md flex justify-end">
            <button 
                onClick={() => onSave(localSettings)}
                className="flex items-center gap-2 px-8 py-2.5 bg-slate-900 hover:bg-black text-white rounded-2xl shadow-lg transition-all text-sm font-bold active:scale-95"
            >
                <Save size={16} />
                保存配置
            </button>
        </div>

        {/* Import Confirmation */}
        {pendingData && (
              <div className="absolute inset-0 z-[110] bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32} /></div>
                  <h3 className="text-lg font-bold mb-2">确认覆盖数据？</h3>
                  <p className="text-xs text-slate-500 mb-8 max-w-[240px]">导入操作将清除当前所有日程并替换为备份中的内容。</p>
                  <div className="flex flex-col gap-3 w-full max-w-[200px]">
                      <button onClick={() => { onImport(pendingData); setPendingData(null); }} className="w-full py-2.5 bg-rose-500 text-white rounded-xl text-sm font-bold">确认导入</button>
                      <button onClick={() => setPendingData(null)} className="w-full py-2.5 text-slate-500 font-bold text-sm">取消</button>
                  </div>
              </div>
        )}
      </div>
    </div>
  );
};
