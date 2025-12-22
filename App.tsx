
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  User, Plus, Bell, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Settings, PanelLeft, Sparkles
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
import { format, addDays, subDays, isSameDay, addMinutes, differenceInMinutes, startOfDay, endOfDay } from 'date-fns';

const MIN_SIDEBAR_WIDTH = 240;
const DEFAULT_SIDEBAR_WIDTH = 280;

export const App: React.FC = () => {
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
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

          if (!hasConflict) {
              foundSlot = new Date(cursor);
              break;
          }
          cursor = addMinutes(cursor, 15);
      }

      const targetDate = foundSlot || cursor;
      const newPlan: WorkPlan = {
          id: crypto.randomUUID(),
          title,
          startDate: targetDate.toISOString(),
          endDate: addMinutes(targetDate, duration).toISOString(),
          status: PlanStatus.TODO,
          tags: ['快速安排'],
          color,
          links: []
      };

      await savePlansToStorage([...plans, newPlan]);
      
      setNotifications(prev => [{
          id: crypto.randomUUID(),
          type: 'SYSTEM',
          title: '已自动安排任务',
          message: `"${title}" 已排入今日 ${format(targetDate, 'HH:mm')}`,
          timestamp: new Date().toISOString(),
          read: false,
          planId: newPlan.id
      }, ...prev]);
  };

  const handlePlanClick = (plan: WorkPlan) => {
    setEditingPlan(plan);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (plan: WorkPlan) => {
    const exists = plans.some(p => p.id === plan.id);
    const newPlans = exists ? plans.map(p => p.id === plan.id ? plan : p) : [...plans, plan];
    await savePlansToStorage(newPlans);
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
      } catch (error: any) { console.error("AI Error:", error); } finally { setIsProcessingAI(false); }
  };
  
  const handleSuggestionClick = async (suggestion: SmartSuggestion) => {
      const newPlan: WorkPlan = { id: crypto.randomUUID(), title: suggestion.planData.title, description: suggestion.planData.description, startDate: suggestion.planData.startDate, endDate: suggestion.planData.endDate, status: PlanStatus.TODO, tags: suggestion.planData.tags || [], color: 'blue', links: [] };
      setEditingPlan(newPlan);
      setIsPlanModalOpen(true);
  };

  useEffect(() => {
     if (plans.length > 0 && !isProcessingAI) generateSmartSuggestions(plans, settings).then(setSmartSuggestions);
  }, [plans.length]);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const maxWidth = window.innerWidth * 0.4;
      const newWidth = Math.min(Math.max(mouseMoveEvent.clientX, MIN_SIDEBAR_WIDTH), maxWidth);
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", () => setIsResizing(false));
    return () => { window.removeEventListener("mousemove", resize); window.removeEventListener("mouseup", () => setIsResizing(false)); };
  }, [resize]);

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden relative ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
       <div ref={sidebarRef} className={`hidden lg:block h-full flex-shrink-0 bg-white shadow-[1px_0_20px_rgba(0,0,0,0.02)] transition-[width] ease-in-out will-change-[width] overflow-hidden ${isResizing ? 'duration-0' : 'duration-300'}`} style={{ width: isSidebarOpen ? sidebarWidth : 0 }}>
          <div style={{ width: sidebarWidth }} className="h-full">
            <TaskSidebar currentDate={currentDate} plans={plans} onPlanClick={handlePlanClick} onPlanUpdate={handleUpdatePlan} onDeletePlan={handleDeletePlan} onCreateNew={() => handleSlotClick(new Date())} onQuickAdd={handleQuickAdd} />
          </div>
       </div>

       {isSidebarOpen && <div className="hidden lg:block w-1 hover:w-1.5 h-full cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500 active:w-1.5 transition-all z-40 flex-shrink-0 -ml-0.5" onMouseDown={() => setIsResizing(true)} />}

       <div className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-50">
           <header className="h-16 flex items-center justify-between px-4 lg:px-6 bg-white border-b border-slate-200/60 flex-shrink-0 z-[70]">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors lg:block hidden"><PanelLeft size={20} /></button>
                    <div className="w-8 h-8 flex-shrink-0"><AppIcon /></div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent tracking-tight">闪历</h1>
                    <div className="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>
                    <div className="flex items-center bg-slate-100/50 hover:bg-slate-100 rounded-xl p-1 transition-colors border border-slate-200/50 relative">
                        <button onClick={() => setCurrentDate(subDays(currentDate, 7))} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg shadow-sm transition-all"><ChevronLeft size={16} /></button>
                        <button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-slate-700 w-[140px] justify-center hover:text-indigo-600 transition-colors"><CalendarIcon size={14} className="mb-0.5" />{format(currentDate, 'yyyy年 M月')}</button>
                        <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg shadow-sm transition-all"><ChevronRight size={16} /></button>
                        {isDatePickerOpen && <DatePicker currentDate={currentDate} onDateSelect={setCurrentDate} onClose={() => setIsDatePickerOpen(false)} />}
                    </div>
                </div>

                <div className="flex items-center gap-3 md:gap-5">
                    {/* Apple Style Midnight/Pro Button */}
                    <button 
                        onClick={() => handleSlotClick(new Date())} 
                        className="
                            group relative flex items-center gap-1.5 px-5 py-2.5 
                            bg-[#1C1C1E] text-white rounded-full text-sm font-semibold tracking-tight
                            shadow-[0_4px_12px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.12)]
                            hover:bg-[#2C2C2E] hover:shadow-[0_8px_20px_rgba(0,0,0,0.15)]
                            hover:-translate-y-0.5 active:translate-y-0 active:scale-95
                            transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
                            overflow-hidden ring-1 ring-white/10
                        "
                    >
                        {/* Apple-style internal highlight (Top Rim Light) */}
                        <div className="absolute inset-x-0 top-0 h-[1px] bg-white/15" />
                        
                        <Plus size={18} strokeWidth={2.5} className="transition-transform duration-500 group-hover:rotate-90" />
                        <span className="hidden sm:inline">新建日程</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors relative"><Bell size={20} />{notifications.some(n => !n.read) && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>}</button>
                            <NotificationCenter isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} notifications={notifications} onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))} onClearAll={() => setNotifications([])} onDelete={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} onItemClick={(n) => n.planId && handlePlanClick(plans.find(p => p.id === n.planId)!)} />
                        </div>
                        <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"><Settings size={20} /></button>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 cursor-pointer hover:scale-105 transition-transform"><User size={16} /></div>
                    </div>
                </div>
           </header>

           <div className="flex-1 overflow-hidden relative p-4">
              <WeeklyCalendar currentDate={currentDate} plans={plans} onPlanClick={handlePlanClick} onSlotClick={handleSlotClick} onPlanUpdate={handleUpdatePlan} onDeletePlan={handleDeletePlan} onDateSelect={setCurrentDate} onDragCreate={(startDate, duration, title, color, tags) => {
                  const newPlan: WorkPlan = { 
                    id: crypto.randomUUID(), 
                    title: title || '新建日程', 
                    startDate: startDate.toISOString(), 
                    endDate: addMinutes(startDate, duration).toISOString(), 
                    status: PlanStatus.TODO, 
                    tags: tags || [], 
                    color: color || 'blue', 
                    links: [] 
                  };
                  setEditingPlan(newPlan);
                  setIsPlanModalOpen(true);
              }} />
           </div>

           <SmartInput onSubmit={handleSmartInput} onStop={handleStopAI} onSuggestionClick={handleSuggestionClick} isProcessing={isProcessingAI} suggestions={smartSuggestions} />
       </div>

       <PlanModal plan={editingPlan} isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} onSave={handleSavePlan} onDelete={handleDeletePlan} />
       <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={(s) => { setSettings(s); localStorage.setItem('zhihui_settings', JSON.stringify(s)); setIsSettingsOpen(false); }} onExport={() => storageService.exportData(plans, settings)} onImport={handleImport} />
       <WeeklyReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} data={reportData} />
       <FlashCommand plans={plans} settings={settings} onPlanCreated={handleSavePlan} />
    </div>
  );
};
