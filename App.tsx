import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { SmartInput } from './components/SmartInput';
import { PlanModal } from './components/PlanModal';
import { SettingsModal } from './components/SettingsModal';
import { TaskSidebar } from './components/TaskSidebar';
import { DatePicker } from './components/DatePicker';
import { AppIcon } from './components/AppIcon';
import { FlashCommand } from './components/FlashCommand';
import { NotificationCenter } from './components/NotificationCenter';
import { WorkPlan, PlanStatus, AISettings, AIProvider, AppNotification } from './types';
import { processUserIntent, generateSmartSuggestions, SmartSuggestion, DEFAULT_MODEL } from './services/aiService';
import { storageService, BackupData } from './services/storageService';
import { Calendar as CalendarIcon, Settings, Bell, Search, Plus, User, ChevronLeft, ChevronRight, ChevronDown, X, Sparkles, ClipboardList, Check, Copy, AlertCircle, Clock, Hash, PanelLeft, Loader2, Info } from 'lucide-react';
import { addHours, format, addDays, startOfDay, isSameDay, addMinutes } from 'date-fns';

// Helper to generate fresh mock data on init
const generateMockPlans = (): WorkPlan[] => {
  return [];
};

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

// Helper: Determine Plan Status based on time for manual creation
const determineDefaultStatus = (startStr: string, endStr: string): PlanStatus => {
  const now = new Date();
  const start = new Date(startStr);
  const end = new Date(endStr);

  if (end <= now) {
    return PlanStatus.DONE;
  }
  if (start <= now && end > now) {
    return PlanStatus.IN_PROGRESS;
  }
  return PlanStatus.TODO;
};

// --- Simple Markdown Renderer ---
const parseInline = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  const lines = content.split('\n');
  
  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-bold text-slate-800 mt-4 mb-2">{parseInline(line.replace('### ', ''))}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-bold text-slate-900 mt-5 mb-3 border-b border-slate-200/60 pb-1">{parseInline(line.replace('## ', ''))}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-black text-slate-900 mt-6 mb-4">{parseInline(line.replace('# ', ''))}</h1>;
        }

        // Unordered Lists
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return (
            <div key={index} className="flex items-start space-x-2.5 mb-1.5 ml-1">
              <span className="text-indigo-500 mt-2 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0"></span>
              <span className="text-slate-600 leading-relaxed text-sm">{parseInline(trimmed.replace(/^[\-\*]\s/, ''))}</span>
            </div>
          );
        }

        // Ordered Lists
        if (/^\d+\.\s/.test(trimmed)) {
           const number = trimmed.match(/^\d+\./)![0];
           const text = trimmed.replace(/^\d+\.\s/, '');
           return (
            <div key={index} className="flex items-start space-x-2 mb-1.5 ml-1">
              <span className="text-indigo-600 font-semibold text-sm min-w-[20px]">{number}</span>
              <span className="text-slate-600 leading-relaxed text-sm">{parseInline(text)}</span>
            </div>
          );
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
             return (
                 <div key={index} className="border-l-4 border-indigo-200 pl-4 py-1 my-2 bg-slate-50 rounded-r-lg">
                     <p className="text-slate-500 italic text-sm">{parseInline(trimmed.replace('> ', ''))}</p>
                 </div>
             )
        }

        // Empty lines
        if (!trimmed) {
          return <div key={index} className="h-2"></div>;
        }

        // Standard Paragraph
        return <p key={index} className="text-slate-600 leading-relaxed text-sm mb-2">{parseInline(line)}</p>;
      })}
    </div>
  );
};

// --- Copy Button Component ---
const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button 
      onClick={handleCopy}
      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied 
          ? 'bg-green-50 text-green-600 ring-1 ring-green-200' 
          : 'bg-white text-slate-500 hover:text-blue-600 ring-1 ring-slate-200 hover:ring-blue-200 hover:bg-blue-50'
      }`}
      title="复制内容"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      <span>{copied ? '已复制' : '复制'}</span>
    </button>
  );
};

// --- Weekly Report Parser ---
interface ReportSection {
  title: string;
  content: string;
}

const parseWeeklyReport = (text: string): ReportSection[] | null => {
  // Relaxed detection: if it mentions at least one of the headers
  if (!text.includes('本周完成工作') && !text.includes('本周工作总结')) return null;

  const sections = [
    { key: '本周完成工作', title: '本周完成工作' },
    { key: '本周工作总结', title: '本周工作总结' },
    { key: '下周工作计划', title: '下周工作计划' },
    { key: '需协调与帮助', title: '需协调与帮助' }
  ];

  const results: ReportSection[] = [];

  sections.forEach((section, index) => {
      // Create a regex that finds the header line.
      // Robust Regex: Matches optional markdown (###), optional numbering (1.), and then the title
      // Example match: "### 1. 本周完成工作" OR "1. 本周完成工作" OR "### 本周完成工作"
      const headerRegex = new RegExp(`(?:^|\\n)(?:#{1,6}\\s*)?(?:\\d+[.、]\\s*)?${section.key}.*`, 'i');
      const match = text.match(headerRegex);
      
      let content = '';
      if (match) {
          const startIndex = match.index! + match[0].length;
          let rest = text.slice(startIndex);
          
          // Find the start of the next section to slice
          // We look for any of the other section headers that appear AFTER this one
          let nearestNextIndex = rest.length;
          
          for (let j = index + 1; j < sections.length; j++) {
               const nextKey = sections[j].key;
               const nextRegex = new RegExp(`(?:^|\\n)(?:#{1,6}\\s*)?(?:\\d+[.、]\\s*)?${nextKey}.*`, 'i');
               const nextMatch = rest.match(nextRegex);
               if (nextMatch) {
                   if (nextMatch.index! < nearestNextIndex) {
                       nearestNextIndex = nextMatch.index!;
                   }
               }
          }
          
          content = rest.slice(0, nearestNextIndex).trim();
      }
      
      results.push({
          title: section.title,
          content: content
      });
  });

  return results;
};

function App() {
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Settings State
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    try {
        const saved = localStorage.getItem('zhihui_ai_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            return { provider: AIProvider.GOOGLE, model: DEFAULT_MODEL, ...parsed };
        }
        return { provider: AIProvider.GOOGLE, model: DEFAULT_MODEL };
    } catch (e) {
        return { provider: AIProvider.GOOGLE, model: DEFAULT_MODEL };
    }
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [today] = useState(() => new Date());

  const [selectedPlan, setSelectedPlan] = useState<WorkPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<AppNotification | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isResizingRef = useRef(false);

  // Notification State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const overdueAckRef = useRef<Record<string, string>>({});

  // Abort Controller Ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Persistence Logic ---
  useEffect(() => {
    const initData = async () => {
        try {
            await storageService.init();
            const savedPlans = await storageService.getAllPlans();
            if (savedPlans.length === 0) {
               setPlans([]);
            } else {
               setPlans(savedPlans);
            }

            const savedNotes = localStorage.getItem('zhihui_notifications');
            if (savedNotes) setNotifications(JSON.parse(savedNotes));

            const savedAck = localStorage.getItem('zhihui_overdue_ack');
            if (savedAck) overdueAckRef.current = JSON.parse(savedAck);

        } catch (e) {
            console.error("Failed to load plans from DB:", e);
            setErrorMessage("数据加载失败");
        } finally {
            setIsDataLoaded(true);
        }
    };
    initData();
  }, []);

  useEffect(() => {
    if (isDataLoaded) {
      storageService.savePlans(plans).catch(err => {
          console.error("Auto-save failed:", err);
      });
    }
  }, [plans, isDataLoaded]);

  useEffect(() => {
      try {
          localStorage.setItem('zhihui_ai_settings', JSON.stringify(aiSettings));
      } catch (e) {
          console.error('Failed to save settings', e);
      }
  }, [aiSettings]);

  useEffect(() => {
      if (isDataLoaded) {
          localStorage.setItem('zhihui_notifications', JSON.stringify(notifications));
      }
  }, [notifications, isDataLoaded]);

  // --- Overdue Checker ---
  useEffect(() => {
      if (!isDataLoaded) return;
      const checkOverdue = () => {
          const now = new Date();
          const newNotes: AppNotification[] = [];
          let ackChanged = false;

          plans.forEach(p => {
              if (p.status !== PlanStatus.DONE) {
                  const end = new Date(p.endDate);
                  if (end < now) {
                      const lastAckDate = overdueAckRef.current[p.id];
                      if (lastAckDate !== p.endDate) {
                          const newNote: AppNotification = {
                              id: crypto.randomUUID(),
                              type: 'OVERDUE',
                              title: '任务已逾期',
                              message: `"${p.title}" 计划于 ${format(end, 'HH:mm')} 完成，请确认状态。`,
                              timestamp: now.toISOString(),
                              read: false,
                              planId: p.id
                          };
                          newNotes.push(newNote);
                          overdueAckRef.current[p.id] = p.endDate;
                          ackChanged = true;
                      }
                  }
              }
          });

          if (newNotes.length > 0) {
              setNotifications(prev => [...newNotes, ...prev]);
              setNotificationToast(newNotes[0]);
          }
          if (ackChanged) {
              localStorage.setItem('zhihui_overdue_ack', JSON.stringify(overdueAckRef.current));
          }
      };

      const timer = setInterval(checkOverdue, 60000); 
      checkOverdue(); 
      return () => clearInterval(timer);
  }, [plans, isDataLoaded]);

  // --- Suggestions ---
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!isDataLoaded) return;
      setTimeout(async () => {
        const sugs = await generateSmartSuggestions(plans, aiSettings);
        setSuggestions(sugs);
      }, 500);
    };
    fetchSuggestions();
  }, [isDataLoaded]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (notificationToast) {
        const timer = setTimeout(() => setNotificationToast(null), 6000);
        return () => clearTimeout(timer);
    }
  }, [notificationToast]);

  // --- Event Handlers ---

  const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
  };

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startResizing = useCallback(() => {
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizingRef.current) {
        const newWidth = mouseMoveEvent.clientX;
        const minWidth = 240;
        const maxWidth = window.innerWidth * 0.4;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            setSidebarWidth(newWidth);
        }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = (id: string) => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleClearNotifications = () => {
      setNotifications([]);
  };

  const handleDeleteNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationClick = (notification: AppNotification) => {
      handleMarkRead(notification.id);
      setIsNotificationOpen(false);
      setNotificationToast(null);
      if (notification.planId) {
          const plan = plans.find(p => p.id === notification.planId);
          if (plan) {
              setCurrentDate(new Date(plan.startDate));
              handlePlanClick(plan);
          } else {
              setErrorMessage("该日程已被删除");
          }
      }
  };

  const handleAIInput = async (input: string) => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsProcessingAI(true);
    setAnalysisResult(null); 
    setErrorMessage(null);
    setSuggestions([]);

    try {
        const result = await processUserIntent(input, plans, aiSettings, controller.signal);
        if (controller.signal.aborted) return;

        if (result) {
          if (result.type === 'CREATE_PLAN') {
            const newPlan = result.data;
            if (newPlan.title) {
              setPlans(prev => [...prev, newPlan as WorkPlan]);
            }
          } else if (result.type === 'ANALYSIS') {
            setAnalysisResult(result.content);
          }
        } else {
            setErrorMessage("AI 服务响应异常，请检查网络或配置。");
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted by user');
        } else {
            console.error(error);
            setErrorMessage("请求发生错误");
        }
    } finally {
        if (abortControllerRef.current === controller) {
            setIsProcessingAI(false);
            abortControllerRef.current = null;
        }
    }
  };

  const handleStopAI = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
          setIsProcessingAI(false);
      }
  };

  const handleSuggestionClick = async (suggestion: SmartSuggestion) => {
    setSuggestions([]);
    const newPlan: WorkPlan = {
      id: crypto.randomUUID(),
      title: suggestion.planData.title,
      description: suggestion.planData.description || '',
      startDate: suggestion.planData.startDate,
      endDate: suggestion.planData.endDate,
      tags: suggestion.planData.tags || [],
      status: determineDefaultStatus(suggestion.planData.startDate, suggestion.planData.endDate),
      color: getRandomColor(),
      links: []
    };
    setSelectedPlan(newPlan);
    setIsModalOpen(true);
  };

  const handlePlanClick = (plan: WorkPlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleSlotClick = (date: Date) => {
    const startDate = date.toISOString();
    const endDate = addHours(date, 1).toISOString();
    
    const newPlan: WorkPlan = {
      id: crypto.randomUUID(),
      title: '新建日程',
      startDate: startDate,
      endDate: endDate,
      status: determineDefaultStatus(startDate, endDate),
      tags: [],
      color: 'blue',
      links: []
    };
    setSelectedPlan(newPlan);
    setIsModalOpen(true);
  };

  const handleDragCreate = (startDate: Date, durationMinutes: number) => {
     const startStr = startDate.toISOString();
     const endStr = addMinutes(startDate, durationMinutes).toISOString();

     const newPlan: WorkPlan = {
        id: crypto.randomUUID(),
        title: '新建日程',
        startDate: startStr,
        endDate: endStr,
        status: determineDefaultStatus(startStr, endStr),
        tags: [],
        color: getRandomColor(),
        links: []
     };
     setSelectedPlan(newPlan);
     setIsModalOpen(true);
  };

  const handleSavePlan = (updatedPlan: WorkPlan) => {
    setPlans(prev => {
      const exists = prev.find(p => p.id === updatedPlan.id);
      if (exists) {
        return prev.map(p => p.id === updatedPlan.id ? updatedPlan : p);
      }
      return [...prev, updatedPlan];
    });
    setIsModalOpen(false);
    setSelectedPlan(null);
  };

  const handlePlanUpdate = (updatedPlan: WorkPlan) => {
    setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
  };

  const handleDeletePlan = (id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    setIsModalOpen(false);
    setSelectedPlan(null);
  };

  const handleSearchResultClick = (plan: WorkPlan) => {
    setCurrentDate(new Date(plan.startDate));
    setSelectedPlan(plan);
    setIsModalOpen(true);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const handleSaveSettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    setIsSettingsOpen(false);
    setSuccessMessage("配置已更新");
    setTimeout(async () => {
        const sugs = await generateSmartSuggestions(plans, newSettings);
        setSuggestions(sugs);
    }, 100);
  };

  const handleExportData = () => {
    storageService.exportData(plans, aiSettings);
    setSuccessMessage("数据已导出");
  };

  const handleImportData = (data: BackupData) => {
      if (data) {
          if (data.plans) setPlans(data.plans);
          if (data.settings) setAiSettings(data.settings);
          setSuccessMessage(`成功导入 ${data.plans.length} 条日程`);
          setIsSettingsOpen(false);
      }
  };

  const reportSections = analysisResult ? parseWeeklyReport(analysisResult) : null;

  const searchResults = searchQuery.trim() 
    ? plans
        .filter(p => 
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()) 
    : [];

  return (
    <div className="flex flex-col h-screen w-full bg-[#F5F5F7] text-slate-900 font-sans selection:bg-blue-100 overflow-hidden relative">
      
      {!isDataLoaded ? (
         <div className="fixed inset-0 z-[60] bg-[#F5F5F7] flex items-center justify-center flex-col gap-4">
             <Loader2 className="animate-spin text-slate-400" size={32} />
             <p className="text-slate-500 font-medium text-sm">正在加载数据...</p>
         </div>
      ) : (
         <FlashCommand 
            plans={plans}
            settings={aiSettings}
            onPlanCreated={(newPlan) => {
                setPlans(prev => [...prev, newPlan]);
            }}
         />
      )}

      <header className="flex-none h-16 px-6 flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-slate-200/60 z-30 relative">
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-4 text-slate-900">
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className={`p-2 rounded-lg transition-colors ${isSidebarOpen ? 'bg-slate-200/50 text-slate-900' : 'text-slate-500 hover:bg-slate-100'}`}
                title="切换侧边栏"
            >
                <PanelLeft size={20} />
            </button>

            <div className="flex items-center gap-2">
                <AppIcon size={32} />
                <div className="hidden sm:flex flex-col justify-center">
                    <span className="text-lg font-bold tracking-tight leading-none text-slate-900">闪历</span>
                    <span className="text-[10px] text-slate-500 font-medium leading-none tracking-wide mt-0.5">AI 智能日程</span>
                </div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-300 mx-2 hidden sm:block"></div>

          <div className="flex items-center bg-slate-100/50 rounded-lg p-1 border border-slate-200/50">
             <button onClick={() => setCurrentDate(d => addDays(d, -7))} className="p-1.5 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-800 hover:shadow-sm">
                <ChevronLeft size={16} />
             </button>
             
             <div className="relative">
                 <button 
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md cursor-pointer transition-colors ${
                        isDatePickerOpen ? 'bg-white shadow-sm text-slate-900' : 'hover:bg-white/60 text-slate-700'
                    }`}
                 >
                     <span className="text-sm font-semibold tabular-nums min-w-[80px] text-center">
                        {format(currentDate, 'yyyy年 M月')}
                     </span>
                     <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDatePickerOpen ? 'rotate-180' : ''}`} />
                 </button>

                 {isDatePickerOpen && (
                    <DatePicker 
                        currentDate={currentDate}
                        onDateSelect={(d) => {
                            setCurrentDate(d);
                            setIsDatePickerOpen(false);
                        }}
                        onClose={() => setIsDatePickerOpen(false)}
                    />
                 )}
             </div>

             <button onClick={() => setCurrentDate(d => addDays(d, 7))} className="p-1.5 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-800 hover:shadow-sm">
                <ChevronRight size={16} />
             </button>
          </div>
          <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
            回到今天
          </button>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-4">
           {/* Search Logic */}
           <div className="relative hidden md:flex items-center group">
              <div className={`
                 flex items-center bg-slate-100/50 border border-transparent rounded-full px-3 py-1.5 w-48 transition-all duration-300
                 ${isSearchFocused || searchQuery ? 'w-64 bg-white border-blue-500/30 ring-4 ring-blue-500/10 shadow-sm' : ''}
              `}>
                  <Search size={16} className={`mr-2 transition-colors ${isSearchFocused ? 'text-blue-500' : 'text-slate-400'}`} />
                  <input 
                    type="text" 
                    placeholder="搜索日程..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)} 
                    className="bg-transparent border-none outline-none text-sm w-full placeholder-slate-400 text-slate-700" 
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="ml-1 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                    >
                       <X size={14} />
                    </button>
                  )}
              </div>
              {/* Search Results Dropdown */}
              {searchQuery && (
                <div className="absolute top-full left-0 w-[320px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 mt-2 p-1 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                   {searchResults.length > 0 ? (
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                         {searchResults.map(plan => (
                           <button
                             key={plan.id}
                             onClick={() => handleSearchResultClick(plan)}
                             className="w-full text-left flex items-start gap-3 p-3 rounded-xl hover:bg-blue-50/50 hover:text-blue-700 group transition-all"
                           >
                             <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-${plan.color}-50 text-${plan.color}-600`}>
                                <CalendarIcon size={16} />
                             </div>
                             <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm text-slate-800 group-hover:text-blue-700 truncate">
                                   {plan.title}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                   <span className="flex items-center gap-1">
                                      <Clock size={10} />
                                      {format(new Date(plan.startDate), 'M月d日 HH:mm')}
                                   </span>
                                </div>
                             </div>
                           </button>
                         ))}
                      </div>
                   ) : (
                      <div className="p-8 text-center text-slate-400 flex flex-col items-center animate-in fade-in zoom-in duration-200">
                         <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                            <Search size={20} className="text-slate-300" />
                         </div>
                         <p className="text-sm font-medium text-slate-600 mb-1">未找到相关日程</p>
                         <button 
                            onClick={() => {
                                handleSlotClick(startOfDay(currentDate));
                                setSearchQuery('');
                                setIsSearchFocused(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors active:scale-95 mt-3"
                         >
                            <Plus size={16} />
                            新建日程
                         </button>
                      </div>
                   )}
                </div>
              )}
           </div>

           <button 
             onClick={() => handleAIInput("生成本周工作周报，包含完成工作、总结、计划和需协调")}
             className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative group"
             title="一键生成周报"
           >
             <ClipboardList size={20} />
           </button>

           <div className="relative">
             <button 
               onClick={() => setIsNotificationOpen(!isNotificationOpen)}
               className={`p-2 rounded-full transition-colors relative ${
                   isNotificationOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
               }`}
               title="通知中心"
             >
               <Bell size={20} />
               {unreadCount > 0 && (
                 <span className="absolute top-1.5 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white ring-1 ring-white/50 animate-pulse"></span>
               )}
             </button>
             
             <NotificationCenter
                isOpen={isNotificationOpen}
                onClose={() => setIsNotificationOpen(false)}
                notifications={notifications}
                onMarkRead={handleMarkRead}
                onClearAll={handleClearNotifications}
                onDelete={handleDeleteNotification}
                onItemClick={handleNotificationClick}
             />
           </div>
           
           <button 
             onClick={() => setIsSettingsOpen(true)}
             className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
           >
             <Settings size={20} />
           </button>

           <div className="h-6 w-px bg-slate-300 mx-2 hidden sm:block"></div>

           <div className="flex items-center gap-2 cursor-pointer p-1 pr-2 hover:bg-slate-100 rounded-full transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                 <User size={16} className="text-slate-500" />
              </div>
              <span className="text-sm font-medium text-slate-700 hidden lg:block">Alex</span>
           </div>

           <button 
              onClick={() => handleSlotClick(startOfDay(currentDate))}
              className="hidden lg:flex bg-slate-900 hover:bg-black text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg shadow-slate-900/10 transition-transform active:scale-95 items-center gap-2 ml-2"
           >
              <Plus size={16} />
              <span>新建</span>
           </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div 
          style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
          className="relative transition-all duration-300 ease-in-out flex-shrink-0"
        >
          <div className="w-full h-full overflow-hidden">
             <TaskSidebar 
                currentDate={today}
                plans={plans}
                onPlanClick={handlePlanClick}
                onPlanUpdate={handlePlanUpdate}
                onDeletePlan={handleDeletePlan}
                onCreateNew={() => handleSlotClick(startOfDay(today))}
            />
          </div>

          {isSidebarOpen && (
              <div
                onMouseDown={startResizing}
                className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 z-30 transition-colors"
              >
                  <div className="absolute top-0 -left-2 w-4 h-full bg-transparent"></div>
              </div>
          )}
        </div>
        
        {/* Messages */}
        {errorMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
             <div className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm">
                <AlertCircle size={18} />
                <span className="text-sm font-medium">{errorMessage}</span>
                <button onClick={() => setErrorMessage(null)} className="ml-1 text-slate-400 hover:text-white">
                   <X size={14} />
                </button>
             </div>
          </div>
        )}
        
        {successMessage && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
             <div className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-full shadow-lg backdrop-blur-sm">
                <Check size={18} />
                <span className="text-sm font-medium">{successMessage}</span>
             </div>
          </div>
        )}

        {/* --- Real-time Notification Banner (Apple Style) --- */}
        {notificationToast && (
          <div 
            onClick={() => handleNotificationClick(notificationToast)}
            className="fixed top-20 right-5 z-[70] w-80 bg-white/90 backdrop-blur-2xl rounded-2xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] border border-white/60 p-4 cursor-pointer hover:scale-[1.02] transition-all animate-in slide-in-from-right-10 fade-in duration-300 flex items-start gap-3 group ring-1 ring-black/5"
          >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center">
                 <Clock size={20} />
              </div>
              <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-bold text-sm text-slate-800">任务已逾期</h4>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setNotificationToast(null); }}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100"
                    >
                        <X size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                     {notificationToast.message}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">点击查看详情</p>
              </div>
          </div>
        )}

        <div className="flex-1 h-full overflow-hidden p-0 sm:p-4 pb-24 relative flex flex-col min-w-0">
            <div className="flex-1 h-full overflow-hidden sm:rounded-3xl sm:shadow-[0_2px_20px_rgb(0,0,0,0.02)] sm:border sm:border-slate-100 bg-white">
                <WeeklyCalendar 
                    currentDate={currentDate} 
                    plans={plans} 
                    onPlanClick={handlePlanClick} 
                    onSlotClick={handleSlotClick}
                    onPlanUpdate={handlePlanUpdate}
                    onDeletePlan={handleDeletePlan}
                    onDateSelect={setCurrentDate}
                    onDragCreate={handleDragCreate}
                />
            </div>
        </div>

        <SmartInput 
          onSubmit={handleAIInput} 
          onStop={handleStopAI}
          onSuggestionClick={handleSuggestionClick}
          isProcessing={isProcessingAI} 
          suggestions={suggestions}
        />

        {/* AI Analysis Report Modal */}
        {analysisResult && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
                onClick={() => setAnalysisResult(null)}
              />
              <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/60 p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
                 <div className="flex items-center gap-3 mb-6 flex-none">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-inner">
                        <Sparkles size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">AI 分析报告</h3>
                    <button onClick={() => setAnalysisResult(null)} className="ml-auto p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                      <X size={20} />
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                     {reportSections ? (
                        <div className="space-y-6 pt-2">
                           <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                             <span className="text-2xl">📅</span>
                             <h2 className="text-lg font-bold text-slate-800">本周工作周报</h2>
                           </div>
                           
                           {reportSections.map((section, idx) => (
                             <div key={idx} className="group">
                                <div className="flex justify-between items-center mb-2">
                                  <h3 className="font-bold text-slate-800 text-base">{section.title}</h3>
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <CopyButton text={section.content || section.title} />
                                  </div>
                                </div>
                                <div className="text-slate-600 text-sm leading-relaxed">
                                   {section.content ? (
                                       <MarkdownRenderer content={section.content} />
                                   ) : (
                                       <div className="text-slate-300 text-sm italic py-2">请输入</div>
                                   )}
                                </div>
                             </div>
                           ))}
                        </div>
                     ) : (
                       <div className="prose prose-slate prose-sm max-w-none bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                          <MarkdownRenderer content={analysisResult} />
                       </div>
                     )}
                 </div>

                 <div className="mt-6 flex justify-end flex-none">
                    <button 
                      onClick={() => setAnalysisResult(null)}
                      className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-black transition-colors shadow-lg shadow-slate-900/10"
                    >
                      知道了
                    </button>
                 </div>
              </div>
           </div>
        )}

        <PlanModal 
            plan={selectedPlan} 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSavePlan}
            onDelete={handleDeletePlan}
        />
        
        <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={aiSettings}
            onSave={handleSaveSettings}
            onExport={handleExportData}
            onImport={handleImportData}
        />

      </main>
    </div>
  );
}

export default App;