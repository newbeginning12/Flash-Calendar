import React, { useState, useEffect, useRef } from 'react';
import { 
  User, Plus, Bell, ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Settings 
} from 'lucide-react';
import { 
  WorkPlan, AISettings, AIProvider, AppNotification, PlanStatus 
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
import { DragOverlay } from './components/DragOverlay';
import { 
  processUserIntent, generateSmartSuggestions, DEFAULT_MODEL, SmartSuggestion, analyzeScheduleImage
} from './services/aiService';
import { storageService, BackupData } from './services/storageService';
import { format, addDays, subDays } from 'date-fns';
import { compressImage } from './utils/imageHelpers';

const App: React.FC = () => {
  // State
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WorkPlan | null>(null);
  
  const [settings, setSettings] = useState<AISettings>({
    provider: AIProvider.GOOGLE,
    model: DEFAULT_MODEL,
    apiKey: '',
    baseUrl: ''
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Drag & Drop
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const [isValidDropType, setIsValidDropType] = useState(false);

  // Load Initial Data
  useEffect(() => {
    const init = async () => {
      try {
        await storageService.init();
        const storedPlans = await storageService.getAllPlans();
        setPlans(storedPlans);
        
        // Load settings from localStorage if available (simple persist)
        const savedSettings = localStorage.getItem('zhihui_settings');
        if (savedSettings) {
            setSettings(JSON.parse(savedSettings));
        }
      } catch (e) {
        console.error("Initialization failed", e);
      }
    };
    init();
  }, []);

  // Save plans when changed
  const savePlansToStorage = async (newPlans: WorkPlan[]) => {
      setPlans(newPlans);
      await storageService.savePlans(newPlans);
  };

  // ... CRUD Handlers ...
  const handleSlotClick = (date: Date) => {
    // New Plan Template
    const newPlan: WorkPlan = {
      id: crypto.randomUUID(),
      title: '新建日程',
      startDate: date.toISOString(),
      endDate: new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
      status: PlanStatus.TODO,
      tags: [],
      color: 'blue',
      links: []
    };
    setEditingPlan(newPlan);
    setIsPlanModalOpen(true);
  };

  const handlePlanClick = (plan: WorkPlan) => {
    setEditingPlan(plan);
    setIsPlanModalOpen(true);
  };

  const handleSavePlan = async (plan: WorkPlan) => {
    const exists = plans.some(p => p.id === plan.id);
    let newPlans;
    if (exists) {
        newPlans = plans.map(p => p.id === plan.id ? plan : p);
    } else {
        newPlans = [...plans, plan];
    }
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
    // Direct update without modal close (e.g. status toggle, drag drop)
    const newPlans = plans.map(p => p.id === plan.id ? plan : p);
    await savePlansToStorage(newPlans);
  };

  // ... AI Handlers ...
  const handleSmartInput = async (input: string) => {
      setIsProcessingAI(true);
      try {
          const result = await processUserIntent(input, plans, settings);
          if (result) {
              if (result.type === 'CREATE_PLAN' && result.data) {
                  const basePlan: WorkPlan = {
                      id: crypto.randomUUID(),
                      title: '新建日程',
                      startDate: new Date().toISOString(),
                      endDate: new Date(Date.now() + 3600000).toISOString(),
                      status: PlanStatus.TODO,
                      tags: [],
                      color: 'blue',
                      links: [],
                      ...result.data
                  };
                  setEditingPlan(basePlan as WorkPlan);
                  setIsPlanModalOpen(true);
              } else if (result.type === 'ANALYSIS') {
                  alert(result.content);
              }
          }
      } finally {
          setIsProcessingAI(false);
      }
  };
  
  const handleSuggestionClick = async (suggestion: SmartSuggestion) => {
      const newPlan: WorkPlan = {
          id: crypto.randomUUID(),
          title: suggestion.planData.title,
          description: suggestion.planData.description,
          startDate: suggestion.planData.startDate,
          endDate: suggestion.planData.endDate,
          status: PlanStatus.TODO,
          tags: suggestion.planData.tags || [],
          color: 'blue',
          links: []
      };
      setEditingPlan(newPlan);
      setIsPlanModalOpen(true);
  };

  // Generate suggestions periodically or on idle
  useEffect(() => {
     if (plans.length > 0 && !isProcessingAI) {
         generateSmartSuggestions(plans, settings).then(setSmartSuggestions);
     }
  }, [plans.length]);

  // ... Drag Drop Handlers ...
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        // Explicitly cast to DataTransferItem to avoid 'unknown' type error in some TS environments
        const item = e.dataTransfer.items[0] as DataTransferItem;
        setIsValidDropType(item.kind === 'file' && item.type.startsWith('image/'));
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the window or overlay
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };
  
  const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      
      const files = Array.from(e.dataTransfer.files);
      // Cast the found file to File | undefined to handle potentially inferred unknown type
      const imageFile = files.find((f: any) => f.type.startsWith('image/')) as File | undefined;
      
      if (imageFile) {
          setIsProcessingDrop(true);
          try {
              const base64 = await compressImage(imageFile);
              const result = await analyzeScheduleImage(base64, settings);
               if (result && result.type === 'CREATE_PLAN' && result.data) {
                  const basePlan: WorkPlan = {
                      id: crypto.randomUUID(),
                      title: '识别日程',
                      startDate: new Date().toISOString(),
                      endDate: new Date(Date.now() + 3600000).toISOString(),
                      status: PlanStatus.TODO,
                      tags: [],
                      color: 'purple',
                      links: [],
                      ...result.data
                  };
                  setEditingPlan(basePlan as WorkPlan);
                  setIsPlanModalOpen(true);
              }
          } catch (err) {
              console.error("Image analysis failed", err);
              alert("无法识别图片内容");
          } finally {
              setIsProcessingDrop(false);
          }
      }
  };

  // ... Settings Handlers ...
  const handleSettingsSave = (newSettings: AISettings) => {
      setSettings(newSettings);
      localStorage.setItem('zhihui_settings', JSON.stringify(newSettings));
      setIsSettingsOpen(false);
  };
  
  const handleExport = () => {
      storageService.exportData(plans, settings);
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

  return (
    <div 
        className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden relative"
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
       <DragOverlay 
          isDragging={isDragOver} 
          isValidType={isValidDropType} 
          isProcessing={isProcessingDrop} 
          onCancel={() => setIsProcessingDrop(false)}
       />
       
       {/* Sidebar */}
       <div className="hidden lg:block w-72 h-full flex-shrink-0">
          <TaskSidebar 
             currentDate={currentDate}
             plans={plans}
             onPlanClick={handlePlanClick}
             onPlanUpdate={handleUpdatePlan}
             onDeletePlan={handleDeletePlan}
             onCreateNew={() => handleSlotClick(new Date())}
          />
       </div>

       {/* Main Content */}
       <div className="flex-1 flex flex-col min-w-0 h-full relative">
           {/* Header */}
           <header className="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200/60 flex-shrink-0 z-30">
                <div className="flex items-center gap-4">
                    <div className="lg:hidden">
                        <AppIcon size={32} />
                    </div>
                    
                    {/* Date Nav */}
                    <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl relative">
                        <button onClick={() => setCurrentDate(subDays(currentDate, 7))} className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-slate-800 hover:shadow-sm">
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="relative">
                            <button 
                                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                className="flex items-center gap-2 px-3 py-1 text-sm font-semibold text-slate-700 hover:bg-white rounded-lg transition-all"
                            >
                                <CalendarIcon size={14} className="text-slate-400" />
                                <span>{format(currentDate, 'yyyy年 M月')}</span>
                            </button>
                            
                            {isDatePickerOpen && (
                                <DatePicker 
                                    currentDate={currentDate} 
                                    onDateSelect={(d) => setCurrentDate(d)} 
                                    onClose={() => setIsDatePickerOpen(false)} 
                                />
                            )}
                        </div>

                        <button onClick={() => setCurrentDate(addDays(currentDate, 7))} className="p-1.5 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-slate-800 hover:shadow-sm">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
                        title="设置"
                    >
                        <Settings size={20} />
                    </button>
                    
                    <div className="relative">
                        <button 
                            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors relative"
                        >
                            <Bell size={20} />
                            {notifications.some(n => !n.read) && (
                                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white"></span>
                            )}
                        </button>
                        <NotificationCenter 
                            isOpen={isNotificationOpen}
                            onClose={() => setIsNotificationOpen(false)}
                            notifications={notifications}
                            onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
                            onClearAll={() => setNotifications([])}
                            onDelete={(id) => setNotifications(prev => prev.filter(n => n.id !== id))}
                            onItemClick={(n) => { 
                                if (n.planId) {
                                    const p = plans.find(p => p.id === n.planId);
                                    if (p) handlePlanClick(p);
                                }
                                setIsNotificationOpen(false);
                            }}
                        />
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-2 cursor-pointer p-1 pr-2 hover:bg-slate-100 rounded-full transition-colors">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                            <User size={16} className="text-slate-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-700 hidden lg:block">Alex</span>
                    </div>

                    <button 
                        onClick={() => {
                            const now = new Date();
                            now.setSeconds(0, 0);
                            handleSlotClick(now);
                        }}
                        className="hidden lg:flex bg-slate-900 hover:bg-black text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg shadow-slate-900/10 transition-transform active:scale-95 items-center gap-2 ml-2"
                    >
                        <Plus size={16} />
                        <span>新建</span>
                    </button>
                </div>
           </header>
           
           {/* Weekly Calendar */}
           <div className="flex-1 overflow-hidden">
               <WeeklyCalendar 
                   currentDate={currentDate}
                   plans={plans}
                   onPlanClick={handlePlanClick}
                   onSlotClick={handleSlotClick}
                   onPlanUpdate={handleUpdatePlan}
                   onDeletePlan={handleDeletePlan}
                   onDateSelect={setCurrentDate}
                   onDragCreate={(startDate, durationMinutes) => {
                       const newPlan: WorkPlan = {
                           id: crypto.randomUUID(),
                           title: '新建日程',
                           startDate: startDate.toISOString(),
                           endDate: new Date(startDate.getTime() + durationMinutes * 60000).toISOString(),
                           status: PlanStatus.TODO,
                           tags: [],
                           color: 'blue',
                           links: []
                       };
                       setEditingPlan(newPlan);
                       setIsPlanModalOpen(true);
                   }}
               />
           </div>
           
           {/* Smart Input */}
           <SmartInput 
               onSubmit={handleSmartInput}
               onStop={() => { setIsProcessingAI(false); }}
               isProcessing={isProcessingAI}
               onSuggestionClick={handleSuggestionClick}
               suggestions={smartSuggestions}
           />
       </div>

       {/* Modals */}
       <PlanModal 
           isOpen={isPlanModalOpen}
           plan={editingPlan}
           onClose={() => setIsPlanModalOpen(false)}
           onSave={handleSavePlan}
           onDelete={handleDeletePlan}
       />
       
       <SettingsModal 
           isOpen={isSettingsOpen}
           settings={settings}
           onClose={() => setIsSettingsOpen(false)}
           onSave={handleSettingsSave}
           onExport={handleExport}
           onImport={handleImport}
       />
       
       <FlashCommand 
           plans={plans}
           settings={settings}
           onPlanCreated={(p) => {
               handleSavePlan(p);
               setCurrentDate(new Date(p.startDate));
           }}
       />
    </div>
  );
};

export default App;