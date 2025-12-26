
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  User, Plus, Bell, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Settings, PanelLeft, Sparkles, Search, X as CloseIcon, Clock, Tag, PlusCircle, LayoutDashboard
} from 'lucide-react';
import { 
  WorkPlan, AISettings, AIProvider, AppNotification, PlanStatus, WeeklyReportData, MonthlyAnalysisData
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
import { MonthlyReviewModal } from './components/MonthlyReviewModal';
import { SmartShelf } from './components/SmartShelf';
import { 
  processUserIntent, generateSmartSuggestions, DEFAULT_MODEL, SmartSuggestion, processMonthlyReview, processWeeklyReport, enhanceFuzzyTask
} from './services/aiService';
import { storageService, BackupData } from './services/storageService';
import { format, addDays, isSameDay, addMinutes, endOfDay, differenceInMinutes, isAfter, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

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
  
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  const [isProcessingReport, setIsProcessingReport] = useState(false);
  const [isProcessingReview, setIsProcessingReview] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [reportData, setReportData] = useState<WeeklyReportData | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  
  const [monthlyData, setMonthlyData] = useState<MonthlyAnalysisData | null>(null);
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);

  const [isShelfOpen, setIsShelfOpen] = useState(false);

  const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const lastCheckedOverdueRef = useRef<Set<string>>(new Set());

  const addNotification = useCallback((notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = { ...notif, id: crypto.randomUUID(), timestamp: new Date().toISOString(), read: false };
    setNotifications(prev => [newNotif, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    const checkOverdue = () => {
      const now = new Date();
      const overduePlans = plans.filter(p => !p.isFuzzy && p.status !== PlanStatus.DONE && isAfter(now, new Date(p.endDate)) && !lastCheckedOverdueRef.current.has(p.id));
      overduePlans.forEach(p => {
        addNotification({ type: 'OVERDUE', title: '任务已逾期', message: `计划 “${p.title}” 已超过结束时间，请及时处理。`, planId: p.id });
        lastCheckedOverdueRef.current.add(p.id);
      });
    };
    checkOverdue();
    const interval = setInterval(checkOverdue, 60000);
    return () => clearInterval(interval);
  }, [plans, addNotification]);

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

  const handleWeeklyReport = async () => {
    if (isProcessingReport) return;
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const weekPlansCount = plans.filter(p => { const d = new Date(p.startDate); return isWithinInterval(d, { start: weekStart, end: weekEnd }); }).length;
    if (weekPlansCount === 0) { setUnsupportedMessage("当前选择的周内暂无日程数据，无法生成周报数据。"); setTimeout(() => setUnsupportedMessage(null), 3000); return; }
    setIsProcessingReport(true);
    try { 
      const result = await processWeeklyReport(plans, settings); 
      if (result) { 
        const report = { ...result, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
        await storageService.saveWeeklyReport(report);
        setReportData(report); 
        setIsReportModalOpen(true); 
        setSearchTerm(''); 
      } 
    } 
    catch (e) { console.error(e); } finally { setIsProcessingReport(false); }
  };

  const handleMonthlyReview = async () => {
    if (isProcessingReview) return;
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Fix: Replaced undefined variable 'weekEnd' with 'monthEnd' and removed redundant counting logic.
    const monthPlansCount = plans.filter(p => { 
      const d = new Date(p.startDate); 
      return isWithinInterval(d, { start: monthStart, end: monthEnd }); 
    }).length;

    if (monthPlansCount === 0) { 
      setUnsupportedMessage("当前选择的月份内暂无日程数据，无法进行镜像诊断。"); 
      setTimeout(() => setUnsupportedMessage(null), 3000); 
      return; 
    }
    setIsProcessingReview(true);
    try {
      const result = await processMonthlyReview(plans, settings);
      if (result && result.type === 'MONTH_REVIEW') {
        const report = { ...result.data, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
        await storageService.saveMonthlyReport(report);
        setMonthlyData(report); setIsMonthlyModalOpen(true);
        setSearchTerm('');
      }
    } catch (e) { console.error(e); } finally { setIsProcessingReview(false); }
  };

  const filteredResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowerSearch = searchTerm.toLowerCase();
    return plans.filter(plan => plan.title.toLowerCase().includes(lowerSearch) || plan.tags.some(t => t.toLowerCase().includes(lowerSearch)) || (plan.description && plan.description.toLowerCase().includes(lowerSearch))).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [searchTerm, plans]);

  const handleResultClick = (plan: WorkPlan) => {
    const planDate = new Date(plan.startDate);
    setCurrentDate(planDate);
    setTargetPlanId(plan.id);
    setIsSearchFocused(false);
    setSearchTerm(''); // 点击搜索结果后自动清空
    if (plan.isFuzzy) setIsShelfOpen(true); 
    setTimeout(() => setTargetPlanId(null), 2500);
  };

  const handleSavePlan = async (plan: WorkPlan) => {
    const exists = plans.some(p => p.id === plan.id);
    const newPlans = exists ? plans.map(p => p.id === plan.id ? plan : p) : [...plans, plan];
    setPlans(newPlans);
    await storageService.savePlans(newPlans);
    setIsPlanModalOpen(false);
    setEditingPlan(null);

    if (!plan.isFuzzy && !plan.isEnhancing) {
        setCurrentDate(new Date(plan.startDate));
        setTargetPlanId(plan.id);
        setTimeout(() => setTargetPlanId(null), 2500);
    }
  };

  const handleSmartInput = async (input: string): Promise<boolean> => {
      if (isProcessingInput) return false;
      setUnsupportedMessage(null);
      setIsProcessingInput(true);
      const controller = new AbortController(); abortControllerRef.current = controller;
      try {
          const result = await processUserIntent(input, plans, settings, controller.signal);
          if (controller.signal.aborted) return false;
          if (result) {
              if (result.type === 'CREATE_PLAN' && result.data) {
                  const basePlan: WorkPlan = { id: crypto.randomUUID(), title: '新建日程', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 3600000).toISOString(), status: PlanStatus.TODO, tags: [], color: 'blue', links: [], ...result.data };
                  setEditingPlan(basePlan as WorkPlan); setIsPlanModalOpen(true);
                  setSearchTerm(''); // 成功：清空
                  return true;
              } else if (result.type === 'UNSUPPORTED') {
                  setUnsupportedMessage(result.message || "由于缺乏具体时间，建议使用挂载仓快速记录。");
                  setTimeout(() => setUnsupportedMessage(null), 4000);
                  return false; // 不支持：保留内容以便修改
              }
          }
      } catch (error: any) { console.error("AI Error:", error); return false; } finally { setIsProcessingInput(false); }
      return false;
  };

  const handleShelfCapture = async (text: string) => {
      const newId = crypto.randomUUID();
      const rawPlan: WorkPlan = {
          id: newId,
          title: text,
          startDate: new Date().toISOString(),
          endDate: addMinutes(new Date(), 60).toISOString(),
          status: PlanStatus.TODO,
          tags: [],
          color: 'slate', 
          links: [],
          isFuzzy: true,
          isEnhancing: true 
      };
      
      const newPlans = [...plans, rawPlan];
      setPlans(newPlans);
      await storageService.savePlans(newPlans);

      try {
          const enhancedData = await enhanceFuzzyTask(text, settings);
          if (enhancedData) {
              setPlans(prev => {
                  const updated = prev.map(p => p.id === newId ? { ...p, ...enhancedData, isEnhancing: false } : p);
                  storageService.savePlans(updated);
                  return updated;
              });
          } else {
              setPlans(prev => prev.map(p => p.id === newId ? { ...p, isEnhancing: false } : p));
          }
      } catch (e) {
          console.error("Enhance failed", e);
          setPlans(prev => prev.map(p => p.id === newId ? { ...p, isEnhancing: false } : p));
      }
  };
  
  const handleSuggestionClick = async (suggestion: SmartSuggestion) => {
      setEditingPlan({ id: crypto.randomUUID(), title: suggestion.planData.title, description: suggestion.planData.description, startDate: suggestion.planData.startDate, endDate: suggestion.planData.endDate, status: PlanStatus.TODO, tags: suggestion.planData.tags || [], color: 'blue', links: [] });
      setIsPlanModalOpen(true);
      setSearchTerm('');
  };

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = e.clientX;
      if (newWidth >= MIN_SIDEBAR_WIDTH && newWidth <= 600) { setSidebarWidth(newWidth); localStorage.setItem('zhihui_sidebar_width', newWidth.toString()); }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize); window.addEventListener("mouseup", () => setIsResizing(false));
    return () => { window.removeEventListener("mousemove", resize); window.removeEventListener("mouseup", () => setIsResizing(false)); };
  }, [resize]);

  return (
    <div className={`flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden relative ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
       <div ref={sidebarRef} className={`hidden lg:block h-full flex-shrink-0 bg-white shadow-[1px_0_20px_rgba(0,0,0,0.02)] transition-[width] ease-in-out will-change-[width] overflow-hidden ${isResizing ? 'duration-0' : 'duration-300'}`} style={{ width: isSidebarOpen ? sidebarWidth : 0 }}>
          <div style={{ width: sidebarWidth }} className="h-full">
            <TaskSidebar 
              currentDate={currentDate} 
              plans={plans} 
              onPlanClick={(p) => { setEditingPlan(p); setIsPlanModalOpen(true); }} 
              onPlanUpdate={handleSavePlan} 
              onDeletePlan={async (id) => { const np = plans.filter(x => x.id !== id); setPlans(np); await storageService.savePlans(np); setIsPlanModalOpen(false); }} 
              onDuplicatePlan={async (id, td) => {
                const s = plans.find(x => x.id === id); if(!s) return;
                const d = differenceInMinutes(new Date(s.endDate), new Date(s.startDate));
                const start = td || new Date(); const end = addMinutes(start, d);
                const np = { ...s, id: crypto.randomUUID(), startDate: start.toISOString(), endDate: end.toISOString(), status: PlanStatus.TODO };
                const nps = [...plans, np]; setPlans(nps); await storageService.savePlans(nps);
                if(td) { setTargetPlanId(np.id); setTimeout(() => setTargetPlanId(null), 2500); } else { setEditingPlan(np); setIsPlanModalOpen(true); }
              }}
              onCreateNew={() => {
                const d = new Date(); const np: WorkPlan = { id: crypto.randomUUID(), title: '新建日程', startDate: d.toISOString(), endDate: addMinutes(d, 60).toISOString(), status: PlanStatus.TODO, tags: [], color: 'blue', links: [] };
                setEditingPlan(np); setIsPlanModalOpen(true);
              }} 
              onQuickAdd={async (t, dur, c, tags) => {
                const d = new Date(); 
                const start = isSameDay(d, currentDate) ? d : new Date(new Date(currentDate).setHours(9, 0, 0, 0));
                const np: WorkPlan = { 
                  id: crypto.randomUUID(), 
                  title: t, 
                  startDate: start.toISOString(), 
                  endDate: addMinutes(start, dur).toISOString(), 
                  status: PlanStatus.TODO, 
                  tags: tags || ['快速'], 
                  color: c, 
                  links: [] 
                };
                const nps = [...plans, np]; 
                setPlans(nps); 
                await storageService.savePlans(nps);
                setCurrentDate(start);
                setTargetPlanId(np.id); 
                setTimeout(() => setTargetPlanId(null), 2500);
              }}
              onJumpToToday={() => setCurrentDate(new Date())}
              onMonthlyReview={handleMonthlyReview}
              onWeeklyReport={handleWeeklyReport}
              isProcessingReport={isProcessingReport}
              isProcessingReview={isProcessingReview}
            />
          </div>
       </div>

       {isSidebarOpen && <div className="hidden lg:block w-1 h-full cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500 transition-all z-40 flex-shrink-0 -ml-0.5" onMouseDown={() => setIsResizing(true)} />}

       <div className="flex-1 flex flex-col min-w-0 h-full relative bg-slate-50">
           <header className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex-shrink-0 z-[70] sticky top-0 shadow-sm">
                <div className="flex items-center gap-8 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all hidden lg:block"><PanelLeft size={20} /></button>
                        <div className="flex items-center gap-2.5 group cursor-default"><div className="w-8 h-8 flex-shrink-0 group-hover:scale-110 transition-transform duration-300"><AppIcon /></div><h1 className="text-xl font-black bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent tracking-tighter hidden sm:block whitespace-nowrap">闪历</h1></div>
                    </div>
                    <div className="relative flex items-center bg-slate-100/60 hover:bg-slate-100 border border-slate-200/50 rounded-xl p-0.5"><button onClick={() => setCurrentDate(addDays(currentDate, -7))} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded-lg transition-all"><ChevronLeft size={16} /></button><button onClick={() => setIsDatePickerOpen(!isDatePickerOpen)} className="flex items-center gap-2 px-3 py-1 text-sm font-bold text-slate-700 min-w-[100px] justify-center hover:text-indigo-600 transition-colors">{format(currentDate, 'M月yyyy')}</button><button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-white rounded-lg transition-all"><ChevronRight size={16} /></button>{isDatePickerOpen && <DatePicker currentDate={currentDate} onDateSelect={setCurrentDate} onClose={() => setIsDatePickerOpen(false)} />}</div>
                </div>

                <div className="flex items-center gap-4 justify-end flex-1">
                    <div className="w-[260px] lg:w-[380px] transition-all duration-300 ml-auto"><SmartInput onSubmit={handleSmartInput} onStop={() => { abortControllerRef.current?.abort(); setIsProcessingInput(false); }} onSuggestionClick={handleSuggestionClick} isProcessing={isProcessingInput} suggestions={smartSuggestions} layout="header" searchValue={searchTerm} onSearchChange={setSearchTerm} searchResults={filteredResults} onSearchResultClick={handleResultClick} unsupportedMessage={unsupportedMessage} onClearUnsupported={() => setUnsupportedMessage(null)} /></div>
                    <button onClick={() => { const d = new Date(); const np: WorkPlan = { id: crypto.randomUUID(), title: '新建日程', startDate: d.toISOString(), endDate: addMinutes(d, 60).toISOString(), status: PlanStatus.TODO, tags: [], color: 'blue', links: [] }; setEditingPlan(np); setIsPlanModalOpen(true); }} className="h-9 flex items-center justify-center gap-2 px-4 bg-slate-900 hover:bg-black text-white rounded-xl shadow-md active:scale-95 transition-all group whitespace-nowrap flex-shrink-0"><PlusCircle size={15} /><span className="text-sm font-bold tracking-tight">新建日程</span></button>
                    <div className="h-6 w-px bg-slate-200/60 mx-1"></div>
                    <div className="flex items-center gap-1"><div className="relative"><button onClick={() => setIsNotificationOpen(!isNotificationOpen)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors relative"><Bell size={20} />{notifications.some(n => !n.read) && <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-white animate-pulse"></span>}</button><NotificationCenter isOpen={isNotificationOpen} onClose={() => setIsNotificationOpen(false)} notifications={notifications} onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))} onClearAll={() => setNotifications([])} onDelete={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} onItemClick={(n) => { if(n.planId) { const p = plans.find(x => x.id === n.planId); if(p) handleResultClick(p); } setIsNotificationOpen(false); }} /></div><button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors"><Settings size={20} /></button></div>
                </div>
           </header>

           <div className="flex-1 overflow-hidden relative p-4">
              <WeeklyCalendar 
                currentDate={currentDate} 
                plans={plans} 
                searchTerm={searchTerm} 
                onClearSearch={() => setSearchTerm('')}
                targetPlanId={targetPlanId} 
                onPlanClick={(p) => { setEditingPlan(p); setIsPlanModalOpen(true); }} 
                onSlotClick={(d) => { const np: WorkPlan = { id: crypto.randomUUID(), title: '新建日程', startDate: d.toISOString(), endDate: addMinutes(d, 60).toISOString(), status: PlanStatus.TODO, tags: [], color: 'blue', links: [] }; setEditingPlan(np); setIsPlanModalOpen(true); }} 
                onPlanUpdate={handleSavePlan} 
                onDuplicatePlan={async (id, td) => { const s = plans.find(x => x.id === id); if(!s) return; const d = differenceInMinutes(new Date(s.endDate), new Date(s.startDate)); const start = td || new Date(); const end = addMinutes(start, d); const np = { ...s, id: crypto.randomUUID(), startDate: start.toISOString(), endDate: end.toISOString(), status: PlanStatus.TODO }; const nps = [...plans, np]; setPlans(nps); await storageService.savePlans(nps); if(td) { setTargetPlanId(np.id); setTimeout(() => setTargetPlanId(null), 2500); } else { setEditingPlan(np); setIsPlanModalOpen(true); } }} onDateSelect={setCurrentDate} onDeletePlan={async (id) => { const np = plans.filter(x => x.id !== id); setPlans(np); await storageService.savePlans(np); setIsPlanModalOpen(false); }} onDragCreate={async (startDate, duration, title, color, tags) => { 
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
                const nps = [...plans, newPlan];
                setPlans(nps);
                await storageService.savePlans(nps);
                setTargetPlanId(newPlan.id); 
                setTimeout(() => setTargetPlanId(null), 2500);
              }} />
           </div>
       </div>

       <SmartShelf 
         plans={plans} 
         isOpen={isShelfOpen} 
         onToggle={setIsShelfOpen} 
         onPlanClick={(p) => { setEditingPlan(p); setIsPlanModalOpen(true); }} 
         onPlanUpdate={handleSavePlan} 
         onDeletePlan={async (id) => { const np = plans.filter(x => x.id !== id); setPlans(np); await storageService.savePlans(np); }} 
         onCapture={handleShelfCapture}
       />

       <PlanModal plan={editingPlan} isOpen={isPlanModalOpen} onClose={() => setIsPlanModalOpen(false)} onSave={handleSavePlan} onDelete={async (id) => { const np = plans.filter(x => x.id !== id); setPlans(np); await storageService.savePlans(np); setIsPlanModalOpen(false); }} />
       <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} settings={settings} onSave={(s) => { setSettings(s); localStorage.setItem('zhihui_settings', JSON.stringify(s)); setIsSettingsOpen(false); }} onExport={() => storageService.exportData(plans, settings)} onImport={async (d) => { if (d.plans) { setPlans(d.plans); await storageService.savePlans(d.plans); } if (d.settings) { setSettings(d.settings); localStorage.setItem('zhihui_settings', JSON.stringify(d.settings)); } setIsSettingsOpen(false); }} />
       <WeeklyReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} data={reportData} />
       <MonthlyReviewModal isOpen={isMonthlyModalOpen} onClose={() => setIsMonthlyModalOpen(false)} data={monthlyData} />
       <FlashCommand plans={plans} settings={settings} onPlanCreated={handleSavePlan} onAnalysisCreated={async (data) => { 
          const report = { ...data, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
          await storageService.saveWeeklyReport(report);
          setReportData(report); 
          setIsReportModalOpen(true); 
        }} />
    </div>
  );
};
