
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  User, Plus, Bell, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Settings, PanelLeft, Sparkles, Search, X as CloseIcon, Clock, Tag, PlusCircle
} from 'lucide-react';
import { 
  WorkPlan, AISettings, AIProvider, AppNotification, PlanStatus, WeeklyReportData
} from './types';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { TaskSidebar } from './components/TaskSidebar';
import { PlanModal } from './components/PlanModal';
import { SmartInput } from './components/SmartInput';
import { SettingsModal } from './components/SettingsModal';
import { DatePicker } from './components/DatePicker';
import { AppIcon } from './components/AppIcon';
import { FlashCommand } from './components/FlashCommand';
import { NotificationCenter } from './components/NotificationCenter';
import { WeeklyReportModal } from './components/WeeklyReportModal';
import { 
  processUserIntent, generateSmartSuggestions, DEFAULT_MODEL, SmartSuggestion
} from './services/aiService';
import { storageService, BackupData } from './services/storageService';
import { format, addDays, isSameDay, addMinutes, endOfDay } from 'date-fns';

const MIN_SIDEBAR_WIDTH = 240;
const DEFAULT_SIDEBAR_WIDTH = 280;

export const App: React.FC = () => {
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [targetPlanId, setTargetPlanId] = useState<string | null>(null);
  
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WorkPlan | null>(null);
  const [settings, setSettings] = useState<AISettings>({ provider: AIProvider.GOOGLE, model: DEFAULT_MODEL, apiKey: '', baseUrl: '' });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await storageService.init();
        const storedPlans = await storageService.getAllPlans();
        setPlans(storedPlans);
        const savedSettings = localStorage.getItem('zhihui_settings');
        if (savedSettings) setSettings(JSON.parse(savedSettings));
        const savedWidth = localStorage.getItem('zhihui_sidebar_width');
        if (savedWidth) setSidebarWidth(parseInt(savedWidth));
        const savedState = localStorage.getItem('zhihui_sidebar_open');
        if (savedState) setIsSidebarOpen(savedState === 'true');
      } catch (e) { console.error("Initialization failed", e); }
    };
    init();
  }, []);

  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowerSearch = searchTerm.toLowerCase();
    return plans.filter(plan => 
      plan.title.toLowerCase().includes(lowerSearch) ||
      plan.tags.some(t => t.toLowerCase().includes(lowerSearch)) ||
      (plan.description && plan.description.toLowerCase().includes(lowerSearch))
    ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [searchTerm, plans]);

  const handleResultClick = (plan: WorkPlan) => {
    const planDate = new Date(plan.startDate);
    setCurrentDate(planDate);
    setTargetPlanId(plan.id);
    setIsSearchFocused(false);
    setTimeout(() => setTargetPlanId(null), 2500);
  };

  const savePlansToStorage = async (newPlans: WorkPlan[]) => {
      setPlans(newPlans);
      await storageService.savePlans(newPlans);
  };

  const handleSlotClick = (date: Date) => {
    const newPlan: WorkPlan = {
      id: crypto.randomUUID(),
      title: '新建日程',
      startDate: date.toISOString(),
      endDate: addMinutes(date, 60).toISOString(),
      status: PlanStatus.TODO,
      tags: [],
      color: 'blue',
      links: []
    };
    setEditingPlan(newPlan);
    setIsPlanModalOpen(true);
  };

  const handleQuickAdd = async (title: string, duration: number, color: string) => {
      const today = new Date();
      const dayPlans = plans
        .filter(p => isSameDay(new Date(p.startDate), today))
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      let cursor = new Date();
      cursor.setMinutes(Math.ceil(cursor.getMinutes() / 15) * 15, 0, 0);
      const dayEnd = endOfDay(today);
      let foundSlot: Date | null = null;
      while (addMinutes(cursor, duration) <= dayEnd) {
          const slotEnd = addMinutes(cursor, duration);
          const hasConflict = dayPlans.some(p => {
              const pStart = new Date(p.startDate);
              const pEnd = new Date(p.endDate);
              return (cursor < pEnd && slotEnd > pStart);
          });
          if (!hasConflict) { foundSlot = new Date(cursor); break; }
          cursor = addMinutes(cursor, 15);
      }
      const targetDate = foundSlot || cursor;
      const newPlan: WorkPlan = { id: crypto.randomUUID(), title, startDate: targetDate.toISOString(), endDate: addMinutes(targetDate, duration).toISOString(), status: PlanStatus.TODO, tags: ['快速安排'], color, links: [] };
      
      await savePlansToStorage([...plans, newPlan]);

      // 自动导航逻辑
      setCurrentDate(targetDate);
      setTargetPlanId(newPlan.id);
      setTimeout(() => setTargetPlanId(null), 2500);
  };

  const handlePlanClick = (plan: WorkPlan) => { setEditingPlan(plan); setIsPlanModalOpen(true); };

  const handleSavePlan = async (plan: WorkPlan) => {
    const exists = plans.some(p => p.id === plan.id);
    const newPlans = exists ? plans.map(p => p.id === plan.id ? plan : p) : [...plans, plan];
    await savePlansToStorage(newPlans);
    
    // 关键优化：保存后自动跳转到该日期并高亮
    const planDate = new Date(plan.startDate);
    setCurrentDate(planDate);
    setTargetPlanId(plan.id);
    setTimeout(() => setTargetPlanId(null), 2500);

    setIsPlanModalOpen(false);
    setEditingPlan(null);
  };

  const handleDeletePlan = async (id: string) => {
    const newPlans = plans.filter(p => p.id !== id);
    await savePlansToStorage(newPlans);
    setIsPlanModalOpen(false);
  };
  
  const handleUpdatePlan = async (plan: WorkPlan) => {
    const newPlans = plans.map(p => p.id === plan.id ? plan : p);
    await savePlansToStorage(newPlans);
  };

  const handleImport = async (data: BackupData) => {
    if (data.plans) {
      await savePlansToStorage(data.plans);
    }
    if (data.settings) {
      setSettings(data.settings);
      localStorage.setItem('zhihui_settings', JSON.stringify(data.settings));
    }
    setIsSettingsOpen(false);
  };

  const handleStopAI = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setIsProcessingAI(false);
  };

  const handleSmartInput = async (input: string) => {
      if (isProcessingAI) return;
      setIsProcessingAI(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      try {
          const result = await processUserIntent(input, plans, settings, controller.signal);
          if (controller.signal.aborted) return;
          if (result) {
              if (result.type === 'CREATE_PLAN' && result.data) {
                  const basePlan: WorkPlan = { id: crypto.randomUUID(), title: '新建日程', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 3600000).toISOString(), status: PlanStatus.TODO, tags: [], color: 'blue', links: [], ...result.data };
                  setEditingPlan(basePlan as WorkPlan);
                  setIsPlanModalOpen(true);
              } else if (result.type === 'ANALYSIS' && result.data) {
                  setReportData(result.data);
                  setIsReportModalOpen(true);
              }
          }
      } catch (error: any) { 
          console.error("AI Error:", error); 
      } finally { 
          setIsProcessingAI(false); 
      }
  };
  
  const handleSuggestionClick = async (suggestion: SmartSuggestion) => {
      const newPlan: WorkPlan = { id: crypto.randomUUID(), title: suggestion.planData.title, description: suggestion.planData.description, startDate: suggestion.planData.startDate, endDate: suggestion.planData.endDate, status: PlanStatus.TODO, tags: suggestion.planData.tags || [], color: 'blue', links: [] };
      setEditingPlan(newPlan);
      setIsPlanModalOpen(true);
  };

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= 600) {
        setSidebarWidth(newWidth);
        localStorage.setItem('zhihui_sidebar_width', newWidth.toString());
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", () => setIsResizing(false));
    return () => { 
      window.removeEventListener("mousemove", resize); 
      window.removeEventListener("mouseup", () => setIsResizing(false)); 
    };
  }, [resize]);

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden relative ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
       <div ref={sidebarRef} className={`hidden lg:block h-full flex-shrink-0 bg-white shadow-[1px_0_20px_rgba(0,0,0,0.02)] transition-[width] ease-in-out will-change-[width] overflow-hidden ${isResizing ? 'duration-0' : 'duration-300'}`} style={{ width: isSidebarOpen ? sidebarWidth : 0 }}>
          <div style={{ width: sidebarWidth }} className="h-full">
            <TaskSidebar 
              currentDate={currentDate} 
              plans={plans} 
              onPlanClick={handlePlanClick} 
              onPlanUpdate={handleUpdatePlan} 
              onDeletePlan={handleDeletePlan} 
              onCreateNew={() => handleSlotClick(new Date())} 
              onQuickAdd={handleQuickAdd}
            />
          </div>
       </div>

       {isSidebarOpen && <div className="hidden lg:block w-1 hover:w-1.5 h-full cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500 active:w-1.5 transition-all z-40 flex-shrink-0 -ml-0.5" onMouseDown={() => setIsResizing(true)} />}

       <div className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-50">
           {/* Header - 重新布局后的样式 */}
           <header className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex-shrink-0 z-[70] sticky top-0 shadow-sm">
                
                {/* 左侧：品牌 + 日期视图控制 (Navigation Group) */}
                <div className="flex items-center gap-8 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all hidden lg:block">
                            <PanelLeft size={20} />
                        </button>
                        <div className="flex items-center gap-2.5 group cursor-default">
                            <div className="w-8 h-8 flex-shrink-0 group-hover:scale-110 transition-transform duration-300"><AppIcon /></div>
                            <h1 className="text-xl font-black bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent tracking-tighter hidden sm:block whitespace-nowrap">闪历</h1>
                        </div>
                    </div>

                    {/* 日期选择器 */}
                    <div className="relative flex items-center bg-slate-100/60 hover:bg-slate-100 border border-slate-200/50 rounded-xl p-0.5">
                        <button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded-lg transition-all"><ChevronLeft size={16} /></button>
                        <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className="flex items-center gap-2 px-3 py-1 text-sm font-bold text-slate-700 min-w-[100px] justify-center hover:text-indigo-600 transition-colors">{format(currentDate, 'M月yyyy')}</button>
                        <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded-lg transition-all"><ChevronRight size={16} /></button>
                        {isDatePickerOpen && <DatePicker currentDate={currentDate} onDateSelect={setCurrentDate} onClose={() => setIsDatePickerOpen(false)} />}
                    </div>
                </div>

                {/* 右侧：AI 搜索 + 新建按钮 + 系统操作 (Tool Group) */}
                <div className="flex items-center gap-4 justify-end flex-1">
                    {/* 搜索框 - 分离后的容器 */}
                    <div className="w-[300px] lg:w-[420px] transition-all duration-300 ml-auto">
                        <SmartInput 
                            onSubmit={handleSmartInput} 
                            onStop={handleStopAI} 
                            onSuggestionClick={handleSuggestionClick} 
                            isProcessing={isProcessingAI} 
                            suggestions={smartSuggestions}
                            layout="header"
                            searchValue={searchTerm}
                            onSearchChange={setSearchTerm}
                            searchResults={filteredResults}
                            onSearchResultClick={handleResultClick}
                        />
                    </div>

                    {/* 新建按钮 - 独立放置 */}
                    <button 
                        onClick={() => handleSlotClick(new Date())}
                        className="h-10 flex items-center justify-center gap-2 px-5 bg-slate-900 hover:bg-black text-white rounded-xl shadow-md active:scale-95 transition-all group whitespace-nowrap flex-shrink-0"
                    >
                        <PlusCircle size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                        <span className="text-sm font-bold tracking-tight">新建日程</span>
                    </button>

                    <div className="h-6 w-px bg-slate-200/60 mx-1"></div>

                    {/* 系统通知与设置 */}
                    <div className="flex items-center gap-1">
                        <div className="relative">
                            <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors relative"><Bell size={20} />{notifications.some(n => !n.read) && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>}</button>
                            <NotificationCenter isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} notifications={notifications} onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))} onClearAll={() => setNotifications([])} onDelete={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} onItemClick={(n) => n.planId && handlePlanClick(plans.find(p => p.id === n.planId)!)} />
                        </div>
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"><Settings size={20} /></button>
                    </div>
                </div>
           </header>

           <div className="flex-1 overflow-hidden relative p-4">
              <WeeklyCalendar 
                currentDate={currentDate} 
                plans={plans} 
                searchTerm={searchTerm}
                targetPlanId={targetPlanId}
                onPlanClick={handlePlanClick} 
                onSlotClick={handleSlotClick} 
                onPlanUpdate={handleUpdatePlan} 
                onDateSelect={setCurrentDate} 
                onDeletePlan={handleDeletePlan} 
                onDragCreate={(startDate, duration, title, color, tags) => {
                  const newPlan: WorkPlan = { id: crypto.randomUUID(), title: title || '新建日程', startDate: startDate.toISOString(), endDate: addMinutes(startDate, duration).toISOString(), status: PlanStatus.TODO, tags: tags || [], color: color || 'blue', links: [] };
                  setEditingPlan(newPlan);
                  setIsPlanModalOpen(true);
              }} />
           </div>
       </div>

       <PlanModal plan={editingPlan} isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} onSave={handleSavePlan} onDelete={handleDeletePlan} />
       <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={(s) => { setSettings(s); localStorage.setItem('zhihui_settings', JSON.stringify(s)); setIsSettingsOpen(false); }} onExport={() => storageService.exportData(plans, settings)} onImport={handleImport} />
       <WeeklyReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} data={reportData} />
       <FlashCommand 
          plans={plans} 
          settings={settings} 
          onPlanCreated={handleSavePlan} 
          onAnalysisCreated={(data) => {
            setReportData(data);
            setIsReportModalOpen(true);
          }}
       />
    </div>
  );
};
