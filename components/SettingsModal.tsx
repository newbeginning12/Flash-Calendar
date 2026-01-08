
import React, { useState, useEffect, useRef } from 'react';
import { X, Cpu, RotateCcw, Save, Key, Globe, Check, HardDrive, Download, UploadCloud, Settings, AlertTriangle, FileText, CalendarDays, Sparkles, ExternalLink, ArrowRight, Circle, Loader2, FolderSync, ShieldCheck, Plus, ShieldAlert } from 'lucide-react';
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
  { id: AIProvider.GOOGLE, name: 'Google Gemini', icon: 'G', desc: '谷歌原厂模型，支持 Flash 与 Pro 系列' },
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
  [AIProvider.GOOGLE]: '',
};

type TabType = 'ai' | 'data';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, onExport, onImport }) => {
  const [localSettings, setLocalSettings] = useState<AISettings>(settings);
  const [activeTab, setActiveTab] = useState<TabType>('ai');
  const [pendingData, setPendingData] = useState<BackupData | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hasMirror, setHasMirror] = useState(false);
  const [mirrorHasPermission, setMirrorHasPermission] = useState(false);
  const [isSettingMirror, setIsSettingMirror] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalSettings({ ...settings });
    setPendingData(null);
    if (isOpen) {
        checkMirrorStatus();
    }
  }, [settings, isOpen]);

  const checkMirrorStatus = async () => {
    const handle = await storageService.getFileMirrorHandle();
    if (handle) {
        setHasMirror(true);
        // 实时检测当前是否真的有写入权限
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        setMirrorHasPermission(permission === 'granted');
    } else {
        setHasMirror(false);
        setMirrorHasPermission(false);
    }
  };

  if (!isOpen) return null;

  const handleProviderChange = (provider: AIProvider) => {
      setLocalSettings(prev => ({
          ...prev,
          provider,
          baseUrl: DEFAULT_URLS[provider as keyof typeof DEFAULT_URLS] || '',
          model: PRESETS[provider as keyof typeof PRESETS]?.[0]?.name || prev.model,
          apiKey: prev.provider === provider ? prev.apiKey : ''
      }));
  };

  const handleExport = async () => {
      setIsExporting(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      onExport();
      setIsExporting(false);
  };

  const handleSetMirror = async () => {
      setIsSettingMirror(true);
      try {
        // 如果已经有句柄但没权限，触发 requestPermission 引导
        const existingHandle = await storageService.getFileMirrorHandle();
        if (existingHandle && !mirrorHasPermission) {
            const result = await existingHandle.requestPermission({ mode: 'readwrite' });
            if (result === 'granted') {
                setMirrorHasPermission(true);
                // 恢复权限后立即同步一次
                const plans = await storageService.getAllPlans();
                await storageService.savePlans(plans, settings);
            }
        } else {
            // 全新关联
            const success = await storageService.requestFileMirror();
            if (success) {
                setHasMirror(true);
                setMirrorHasPermission(true);
            }
        }
      } catch (err) {
        console.error('Mirror activation failed', err);
      } finally {
        setIsSettingMirror(false);
      }
  };

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
                    <HardDrive size={16} /> 数据与同步
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
                                    className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all text-left group ${
                                        isSelected 
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-xs font-black flex-shrink-0 ${isSelected ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-white transition-colors'}`}>
                                        {p.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold flex items-center gap-2">
                                            {p.name}
                                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
                                        </div>
                                        <div className="text-[10px] font-medium opacity-60 mt-0.5 truncate">{p.desc}</div>
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
                    <div className="space-y-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                            <Key size={12} /> API Key
                        </label>
                        <input 
                            type="password"
                            value={localSettings.apiKey || ''}
                            onChange={(e) => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                            placeholder={`输入 ${PROVIDERS.find(p => p.id === localSettings.provider)?.name} 的 API Key`}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                        />
                    </div>
                    
                    {localSettings.provider !== AIProvider.GOOGLE && (
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
                                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
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
                 <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
                     <ShieldCheck size={20} className="text-emerald-500 mt-1" />
                     <div className="flex-1">
                         <h4 className="text-sm font-bold text-emerald-800">存储护卫已开启 (OPFS)</h4>
                         <p className="text-[11px] text-emerald-600 mt-1 leading-relaxed font-medium">应用已在浏览器分配的永久存储空间内自动建立实时镜像。即使 IDB 数据库被清除，数据也能瞬间找回。</p>
                     </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">数据备份</label>
                    <div className="grid grid-cols-1 gap-2.5">
                        <button 
                            onClick={handleExport} 
                            disabled={isExporting}
                            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 group transition-all disabled:opacity-70"
                        >
                            <span className="flex items-center gap-3">
                                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                                    {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                </span>
                                <span className="text-sm font-bold text-slate-800">
                                    {isExporting ? '正在生成备份文件...' : '导出 JSON 备份'}
                                </span>
                            </span>
                            {!isExporting && <ArrowRight size={16} className="text-slate-300" />}
                        </button>
                        
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 group transition-all"
                        >
                            <span className="flex items-center gap-3">
                                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform"><UploadCloud size={18} /></span>
                                <span className="text-sm font-bold text-slate-800">导入历史恢复</span>
                            </span>
                            <ArrowRight size={16} className="text-slate-300" />
                        </button>
                    </div>
                 </div>

                 <div className="space-y-3 pt-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">磁盘同步镜像</label>
                    <button 
                        onClick={handleSetMirror}
                        disabled={isSettingMirror}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all group ${
                            hasMirror && mirrorHasPermission 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' 
                            : hasMirror 
                                ? 'bg-amber-500 text-white border-amber-500 shadow-lg'
                                : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20'
                        }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-xl flex items-center justify-center ${hasMirror ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                                {isSettingMirror ? <Loader2 size={20} className="animate-spin" /> : (hasMirror && !mirrorHasPermission ? <ShieldAlert size={20} /> : <FolderSync size={20} />)}
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-black">
                                    {hasMirror && mirrorHasPermission ? '本地磁盘镜像已激活' : hasMirror ? '镜像权限已过期，点击恢复' : '关联本地同步文件夹'}
                                </div>
                                <div className={`text-[10px] font-bold mt-0.5 ${hasMirror ? 'text-white/70' : 'text-slate-400'}`}>
                                    {hasMirror && mirrorHasPermission ? '实时镜像写入中 · 配合 iCloud/OneDrive 实现同步' : hasMirror ? '由于安全策略，需重新授予写入权限' : '零服务器实现跨设备数据双向同步'}
                                </div>
                            </div>
                        </div>
                        {!hasMirror && <Plus size={18} className="text-slate-300 group-hover:text-indigo-500" />}
                        {hasMirror && mirrorHasPermission && <Check size={18} className="text-white" strokeWidth={3} />}
                        {hasMirror && !mirrorHasPermission && <ArrowRight size={18} className="text-white animate-pulse" />}
                    </button>
                    {isSettingMirror && (
                      <div className="px-2 pt-1">
                        <div className="text-[10px] text-indigo-500 font-bold flex items-center gap-1.5 animate-pulse">
                          <Loader2 size={10} className="animate-spin" />
                          正在等待系统文件选择器响应...
                        </div>
                      </div>
                    )}
                 </div>

                 <input type="file" ref={fileInputRef} onChange={async (e) => {
                     const file = e.target.files?.[0];
                     if (file) {
                         const data = await storageService.importData(file);
                         if (data) setPendingData(data);
                     }
                     e.target.value = '';
                 }} accept=".json" className="hidden" />
              </div>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'ai' && (
            <div className="p-6 border-t border-slate-100 bg-white/50 backdrop-blur-md flex justify-end">
                <button 
                    onClick={() => onSave(localSettings)}
                    className="flex items-center gap-2 px-8 py-2.5 bg-slate-900 hover:bg-black text-white rounded-2xl shadow-lg transition-all text-sm font-bold active:scale-95"
                >
                    <Save size={16} />
                    保存配置
                </button>
            </div>
        )}

        {/* Detailed Import Confirmation */}
        {pendingData && (
              <div className="absolute inset-0 z-[110] bg-white/80 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95">
                  <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-rose-50/50">
                      <AlertTriangle size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">确认覆盖数据？</h3>
                  <p className="text-xs text-slate-500 mb-6 max-w-[260px]">导入操作将清除当前所有本地日程并替换为备份中的内容。</p>
                  
                  <div className="w-full bg-white rounded-2xl border border-slate-100 p-5 mb-8 text-left shadow-sm">
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-50">
                          <div className="flex items-center gap-2 text-slate-400">
                             <CalendarDays size={14} />
                             <span className="text-[11px] font-bold">备份时间</span>
                          </div>
                          <span className="text-xs font-bold text-slate-700">{new Date(pendingData.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-50">
                          <div className="flex items-center gap-2 text-slate-400">
                             <FileText size={14} />
                             <span className="text-[11px] font-bold">日程总数</span>
                          </div>
                          <span className="text-xs font-bold text-slate-700">{pendingData.plans?.length || 0} 条数据</span>
                      </div>
                      <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-slate-400">
                             <Cpu size={14} />
                             <span className="text-[11px] font-bold">AI 配置</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                              {pendingData.settings ? '包含配置' : '仅数据'}
                          </span>
                      </div>
                  </div>

                  <div className="flex flex-col gap-3 w-full max-w-[240px]">
                      <button 
                        onClick={() => { onImport(pendingData); setPendingData(null); }} 
                        className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-rose-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                          确认导入并覆盖
                      </button>
                      <button onClick={() => setPendingData(null)} className="w-full py-2.5 text-slate-500 font-bold text-sm hover:text-slate-800 transition-colors">
                          取消
                      </button>
                  </div>
              </div>
        )}
      </div>
    </div>
  );
};
