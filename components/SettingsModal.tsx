
import React, { useState, useEffect, useRef } from 'react';
import { X, Cpu, RotateCcw, Save, Key, Globe, Check, HardDrive, Download, UploadCloud, Settings, AlertTriangle, FileText, CalendarDays } from 'lucide-react';
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
  { id: AIProvider.GOOGLE, name: 'Google Gemini', icon: 'G' },
  { id: AIProvider.DEEPSEEK, name: 'DeepSeek', icon: 'D' },
  { id: AIProvider.ALI_QWEN, name: '阿里通义千问 (Qwen)', icon: 'Q' },
  { id: AIProvider.CUSTOM, name: 'OpenAI 兼容接口', icon: 'C' },
];

const PRESETS = {
  [AIProvider.GOOGLE]: [
    { name: 'gemini-2.5-flash', label: 'Flash 2.5' },
    { name: 'gemini-3-pro-preview', label: 'Pro 3 Preview' },
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

type TabType = 'ai' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, onExport, onImport }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [pendingData, setPendingData] = useState<BackupData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSettings({
        provider: AIProvider.GOOGLE,
        model: DEFAULT_MODEL,
        apiKey: '',
        baseUrl: '',
        ...settings
    });
    setPendingData(null);
    setImportError(null);
    setActiveTab('ai'); // Default to AI tab on open
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
          baseUrl: DEFAULT_URLS[provider as keyof typeof DEFAULT_URLS] || prev.baseUrl,
          model: PRESETS[provider as keyof typeof PRESETS]?.[0]?.name || ''
      }));
  };

  const handleImportClick = () => {
      setPendingData(null);
      setImportError(null);
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         setImportError(null);
         try {
             const data = await storageService.importData(file);
             if (data && Array.isArray(data.plans)) {
                 setPendingData(data);
             } else {
                 setImportError('文件格式错误或已损坏');
             }
         } catch (err) {
             setImportError('解析文件失败');
         }
      }
      if (e.target) e.target.value = '';
  };

  const handleConfirmImport = () => {
      if (pendingData) {
          onImport(pendingData);
          setPendingData(null);
      }
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
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 flex-none">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings size={20} className="text-slate-500" />
            <h2 className="text-lg font-bold">设置</h2>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100/50 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 pt-4 pb-0 flex-none">
            <div className="flex p-1 bg-slate-100/80 rounded-xl">
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'ai' 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                    <Cpu size={16} /> AI 配置
                </button>
                <button 
                     onClick={() => setActiveTab('data')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                        activeTab === 'data' 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                >
                    <HardDrive size={16} /> 数据管理
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
          
          {/* --- Tab 1: AI Settings --- */}
          {activeTab === 'ai' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
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
    
                 {/* Settings Fields */}
                 <div className="space-y-4">
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
                            模型名称
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
          )}

          {/* --- Tab 2: Data Settings --- */}
          {activeTab === 'data' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                 <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                     <div className="flex items-start gap-3">
                         <div className="p-2 bg-white rounded-lg border border-slate-100 text-emerald-500 shadow-sm">
                             <HardDrive size={20} />
                         </div>
                         <div>
                             <h4 className="text-sm font-bold text-slate-800 mb-1">本地存储 (IndexedDB)</h4>
                             <p className="text-xs text-slate-500 leading-relaxed">
                                 您的数据安全地存储在当前浏览器的本地数据库中。为了防止意外清理或跨设备同步，建议定期导出备份文件。
                             </p>
                         </div>
                     </div>
                 </div>
                 
                 {importError && (
                     <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-100 animate-in fade-in slide-in-from-top-2">
                         <AlertTriangle size={16} className="flex-shrink-0" />
                         <span>{importError}</span>
                     </div>
                 )}
    
                 <div className="grid grid-cols-1 gap-3">
                     <button 
                        onClick={onExport}
                        className="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-700 transition-all group"
                     >
                         <span className="flex items-center gap-3">
                            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                <Download size={18} />
                            </span>
                            <div className="text-left">
                                <div className="text-slate-900 font-semibold">导出备份</div>
                                <div className="text-xs text-slate-400 font-normal mt-0.5">保存为 .json 文件</div>
                            </div>
                         </span>
                     </button>

                     <div className="relative">
                         <button 
                            onClick={handleImportClick}
                            className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-sm font-medium text-slate-700 transition-all group"
                         >
                             <span className="flex items-center gap-3">
                                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                                    <UploadCloud size={18} />
                                </span>
                                <div className="text-left">
                                    <div className="text-slate-900 font-semibold">导入恢复</div>
                                    <div className="text-xs text-slate-400 font-normal mt-0.5">从 .json 文件还原数据</div>
                                </div>
                             </span>
                         </button>
                         <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".json" 
                            className="hidden" 
                         />
                     </div>
                 </div>
              </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'ai' && (
             <div className="p-6 pt-4 border-t border-slate-100 flex justify-between items-center flex-none bg-white/50 backdrop-blur-md">
               <button 
                 onClick={handleReset}
                 className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
               >
                 <RotateCcw size={14} />
                 重置
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
        )}

        {/* Full Overlay Confirmation for Import */}
        {pendingData && (
              <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-200">
                  <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mb-6 text-rose-500 shadow-sm ring-8 ring-rose-50/50">
                      <AlertTriangle size={36} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">确认覆盖数据？</h3>
                  <p className="text-sm text-slate-500 mb-8 max-w-[280px] leading-relaxed">
                      即将导入的数据将<strong className="text-rose-500">完全覆盖</strong>当前的日程和设置。此操作无法撤销，请谨慎操作。
                  </p>
                  
                  <div className="bg-white rounded-2xl p-5 w-full mb-8 border border-slate-100 shadow-sm">
                      <div className="flex items-center justify-between mb-3 text-sm border-b border-slate-50 pb-3">
                          <div className="flex items-center gap-2 text-slate-500">
                             <CalendarDays size={16} />
                             <span>备份日期</span>
                          </div>
                          <span className="font-semibold text-slate-900">{new Date(pendingData.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 text-slate-500">
                             <FileText size={16} />
                             <span>日程数量</span>
                          </div>
                          <span className="font-semibold text-slate-900">{pendingData.plans.length} 条</span>
                      </div>
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                      <button 
                          onClick={handleConfirmImport}
                          className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                          确认覆盖并导入
                      </button>
                      <button 
                          onClick={() => setPendingData(null)}
                          className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                      >
                          取消
                      </button>
                  </div>
              </div>
        )}

      </div>
    </div>
  );
};
