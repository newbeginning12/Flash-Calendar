
import React, { useState, useEffect, useRef } from 'react';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { SmartInput } from './components/SmartInput';
import { PlanModal } from './components/PlanModal';
import { SettingsModal } from './components/SettingsModal';
import { WorkPlan, PlanStatus, AISettings } from './types';
import { processUserIntent, generateSmartSuggestions, SmartSuggestion, DEFAULT_MODEL } from './services/aiService';
import { Calendar as CalendarIcon, Settings, Bell, Search, Plus, User, ChevronLeft, ChevronRight, ChevronDown, X, Sparkles, ClipboardList, Check, Copy, AlertCircle, Clock, Hash } from 'lucide-react';
import { addHours, format, addDays, startOfDay, isSameDay } from 'date-fns';

// Helper to generate fresh mock data on init
const generateMockPlans = (): WorkPlan[] => {
  const today = new Date();
  const tomorrow = addDays(new Date(), 1);

  // Helper to set time without mutating original date object
  const setTime = (date: Date, hours: number, minutes: number) => {
    const d = new Date(date);
    d.setHours(hours, minutes, 0, 0);
    return d;
  };

  return [
   
  ];
};

const COLORS = ['blue', 'indigo', 'purple', 'rose', 'orange', 'emerald'];
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

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
  // Regex to detect if this looks like our structured weekly report
  // Checks for "### 1." followed by content
  if (!/###\s*1\./.test(text)) return null;

  const sections = [
    { id: '1', title: '本周完成工作' },
    { id: '2', title: '本周工作总结' },
    { id: '3', title: '下周工作计划' },
    { id: '4', title: '需协调与帮助' }
  ];

  return sections.map((section, index) => {
    // Regex explanation:
    // ###\s*1\.\s*Title : Matches the header, allowing flexible spaces
    // ([\s\S]*?) : Captures any character (including newlines) non-greedily
    // (?=###\s*2\.|$): Lookahead stop condition. Stop at the NEXT header number OR end of string ($)
    
    const nextId = index < sections.length - 1 ? sections[index + 1].id : null;
    const stopPattern = nextId ? `###\\s*${nextId}\\.` : '$';
    
    // Create dynamic regex
    const regex = new RegExp(`###\\s*${section.id}\\.\\s*${section.title}([\\s\\S]*?)(?=${stopPattern})`, 'i');
    const match = text.match(regex);

    let content = match ? match[1].trim() : '';
    
    // Fallback: if content is empty or undefined, show placeholder
    if (!content) content = '（暂无内容）';

    return {
      title: `${section.id}. ${section.title}`,
      content: content
    };
  });
};

function App() {
  // CHANGED: Initialize from localStorage or fallback to mock
  const [plans, setPlans] = useState<WorkPlan[]>(() => {
    try {
      const savedPlans = localStorage.getItem('zhihui_plans');
      if (savedPlans) {
        return JSON.parse(savedPlans);
      }
    } catch (error) {
      console.error('Failed to load plans from localStorage:', error);
    }
    return generateMockPlans();
  });

  // Settings State
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    try {
        const saved = localStorage.getItem('zhihui_ai_settings');
        return saved ? JSON.parse(saved) : { model: DEFAULT_MODEL };
    } catch (e) {
        return { model: DEFAULT_MODEL };
    }
  });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPlan, setSelectedPlan] = useState<WorkPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // AI Suggestions - Store full objects for immediate action
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  
  // AI Analysis Result State
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // CHANGED: Save to localStorage whenever plans change
  useEffect(() => {
    try {
      localStorage.setItem('zhihui_plans', JSON.stringify(plans));
    } catch (error) {
      console.error('Failed to save plans to localStorage:', error);
    }
  }, [plans]);

  // Save Settings
  useEffect(() => {
      try {
          localStorage.setItem('zhihui_ai_settings', JSON.stringify(aiSettings));
      } catch (e) {
          console.error('Failed to save settings', e);
      }
  }, [aiSettings]);

  // Init suggestions on load (using current model setting)
  useEffect(() => {
    const fetchSuggestions = async () => {
      // Small delay to ensure mock data is ready and UI is responsive
      setTimeout(async () => {
        const sugs = await generateSmartSuggestions(plans, aiSettings.model);
        setSuggestions(sugs);
      }, 500);
    };
    fetchSuggestions();
  }, []); // Only run on mount, though ideally should re-run if plans change significantly

  // Auto-hide error message
  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Handle Natural Language Input
  const handleAIInput = async (input: string) => {
    setIsProcessingAI(true);
    setAnalysisResult(null); 
    setErrorMessage(null);
    setSuggestions([]);

    const result = await processUserIntent(input, plans, aiSettings.model);
    
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
        setErrorMessage("AI 服务响应异常，请重试。");
    }
    
    setIsProcessingAI(false);
  };

  // Handle Smart Suggestion Click (Immediate creation without AI call)
  const handleSuggestionClick = async (suggestion: SmartSuggestion) => {
    setSuggestions([]); // Clear suggestions
    
    // Create new plan immediately from pre-calculated data
    const newPlan: WorkPlan = {
      id: crypto.randomUUID(),
      title: suggestion.planData.title,
      description: suggestion.planData.description || '',
      startDate: suggestion.planData.startDate,
      endDate: suggestion.planData.endDate,
      tags: suggestion.planData.tags || [],
      status: PlanStatus.TODO,
      color: getRandomColor()
    };

    setPlans(prev => [...prev, newPlan]);
  };

  const handlePlanClick = (plan: WorkPlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleSlotClick = (date: Date) => {
    // Create new plan at specific slot
    const newPlan: WorkPlan = {
      id: crypto.randomUUID(),
      title: '新建日程',
      startDate: date.toISOString(),
      endDate: addHours(date, 1).toISOString(),
      status: PlanStatus.TODO,
      tags: [],
      color: 'blue'
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
    // 1. Move calendar to that date
    setCurrentDate(new Date(plan.startDate));
    // 2. Open Modal
    setSelectedPlan(plan);
    setIsModalOpen(true);
    // 3. Clear search
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const handleSaveSettings = (newSettings: AISettings) => {
    setAiSettings(newSettings);
    setIsSettingsOpen(false);
    setErrorMessage("设置已更新"); // Reusing error message for success toast temporarily, or could add success type
    // Refresh suggestions with new model
    setTimeout(async () => {
        const sugs = await generateSmartSuggestions(plans, newSettings.model);
        setSuggestions(sugs);
    }, 100);
  };

  // derived state for report
  const reportSections = analysisResult ? parseWeeklyReport(analysisResult) : null;

  // derived state for search
  const searchResults = searchQuery.trim() 
    ? plans
        .filter(p => 
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
          p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()) // Sort by newest
    : [];

  return (
    <div className="flex flex-col h-screen w-full bg-[#F5F5F7] text-slate-900 font-sans selection:bg-blue-100 overflow-hidden relative">
      
      {/* Unified Header */}
      <header className="flex-none h-16 px-6 flex items-center justify-between bg-white/60 backdrop-blur-xl border-b border-slate-200/60 z-30 relative">
        
        {/* Left: Brand & Date Nav */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center gap-2 text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white shadow-md shadow-slate-900/20">
               <CalendarIcon size={16} />
            </div>
            <span className="text-lg font-bold tracking-tight hidden sm:block">智汇计划</span>
          </div>

          <div className="h-6 w-px bg-slate-300 mx-2 hidden sm:block"></div>

          <div className="flex items-center bg-slate-100/50 rounded-lg p-1 border border-slate-200/50">
             <button onClick={() => setCurrentDate(d => addDays(d, -7))} className="p-1.5 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-800 hover:shadow-sm">
                <ChevronLeft size={16} />
             </button>
             
             {/* Date Picker Overlay */}
             <div className="relative group px-1">
                 <div className="flex items-center gap-1 px-3 py-1 rounded-md cursor-pointer hover:bg-white/60 transition-colors">
                     <span className="text-sm font-semibold text-slate-700 tabular-nums min-w-[80px] text-center">
                        {format(currentDate, 'yyyy年 M月')}
                     </span>
                     <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-600 transition-colors" />
                 </div>
                 {/* Hidden Native Input */}
                 <input 
                    type="date" 
                    value={format(currentDate, 'yyyy-MM-dd')}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    onChange={(e) => {
                        const d = e.target.valueAsDate;
                        if(d) setCurrentDate(d);
                    }}
                 />
             </div>

             <button onClick={() => setCurrentDate(d => addDays(d, 7))} className="p-1.5 hover:bg-white rounded-md transition-all text-slate-500 hover:text-slate-800 hover:shadow-sm">
                <ChevronRight size={16} />
             </button>
          </div>
          <button onClick={() => setCurrentDate(new Date())} className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
            回到今天
          </button>
        </div>

        {/* Right: Actions & Profile */}
        <div className="flex items-center space-x-2 sm:space-x-4">
           {/* Enhanced Search */}
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
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)} // Delay to allow click on result
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

              {/* Search Results Dropdown (Spotlight Style) */}
              {searchQuery && (
                <div className="absolute top-full left-0 w-[320px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-100 mt-2 p-1 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                   {searchResults.length > 0 ? (
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                         <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            找到 {searchResults.length} 个结果
                         </div>
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
                                   {plan.status === PlanStatus.DONE && (
                                     <span className="bg-emerald-100 text-emerald-700 px-1.5 rounded text-[10px]">已完成</span>
                                   )}
                                </div>
                             </div>
                           </button>
                         ))}
                      </div>
                   ) : (
                      <div className="p-8 text-center text-slate-400">
                         <Search size={24} className="mx-auto mb-2 opacity-50" />
                         <p className="text-sm">未找到相关日程</p>
                      </div>
                   )}
                </div>
              )}
           </div>

           {/* Icon Buttons */}
           <button 
             onClick={() => handleAIInput("生成本周工作周报，包含完成工作、总结、计划和需协调")}
             className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors relative group"
             title="一键生成周报"
           >
             <ClipboardList size={20} />
           </button>

           <button className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors relative">
             <Bell size={20} />
             <span className="absolute top-1.5 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
           </button>
           
           <button 
             onClick={() => setIsSettingsOpen(true)}
             className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
           >
             <Settings size={20} />
           </button>

           <div className="h-6 w-px bg-slate-300 mx-2 hidden sm:block"></div>

           {/* User Profile */}
           <div className="flex items-center gap-2 cursor-pointer p-1 pr-2 hover:bg-slate-100 rounded-full transition-colors">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white shadow-sm">
                 <User size={16} className="text-slate-500" />
              </div>
              <span className="text-sm font-medium text-slate-700 hidden lg:block">Alex</span>
           </div>

           {/* New Plan Button */}
           <button 
              onClick={() => handleSlotClick(startOfDay(currentDate))}
              className="hidden lg:flex bg-slate-900 hover:bg-black text-white px-4 py-1.5 rounded-full text-sm font-medium shadow-lg shadow-slate-900/10 transition-transform active:scale-95 items-center gap-2 ml-2"
           >
              <Plus size={16} />
              <span>新建</span>
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Error Toast */}
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

        {/* Calendar Grid */}
        <div className="flex-1 h-full overflow-hidden p-4 sm:p-6 pb-24">
            <WeeklyCalendar 
                currentDate={currentDate} 
                plans={plans} 
                onPlanClick={handlePlanClick} 
                onSlotClick={handleSlotClick}
                onPlanUpdate={handlePlanUpdate}
                onDeletePlan={handleDeletePlan}
                onDateSelect={setCurrentDate}
            />
        </div>

        {/* Floating AI Input with Suggestions */}
        <SmartInput 
          onSubmit={handleAIInput} 
          onSuggestionClick={handleSuggestionClick}
          isProcessing={isProcessingAI} 
          suggestions={suggestions}
        />

        {/* AI Analysis Modal */}
        {analysisResult && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div 
                className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
                onClick={() => setAnalysisResult(null)}
              />
              <div className="relative w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/60 p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
                 <div className="flex items-center gap-3 mb-4 flex-none">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-inner">
                        <Sparkles size={20} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">AI 分析报告</h3>
                    <button onClick={() => setAnalysisResult(null)} className="ml-auto p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                      <X size={20} />
                    </button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                     {/* Weekly Report Specialized View */}
                     {reportSections ? (
                        <div className="space-y-4 pt-2">
                           <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                             <span className="text-2xl">📅</span>
                             <h2 className="text-lg font-bold text-slate-800">本周工作周报</h2>
                           </div>
                           
                           {reportSections.map((section, idx) => (
                             <div key={idx} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-100/80 relative hover:border-blue-200/50 hover:shadow-sm transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                  <h3 className="font-bold text-slate-800 text-base">{section.title}</h3>
                                  <CopyButton text={section.content} />
                                </div>
                                <div className="text-slate-600 text-sm leading-relaxed">
                                   <MarkdownRenderer content={section.content} />
                                </div>
                             </div>
                           ))}

                           <div className="text-xs text-center text-slate-400 pt-4">
                              --------------------------------------------------
                           </div>
                        </div>
                     ) : (
                       /* Generic Markdown View */
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

        {/* Edit Modal */}
        <PlanModal 
            plan={selectedPlan} 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSave={handleSavePlan}
            onDelete={handleDeletePlan}
        />
        
        {/* Settings Modal */}
        <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={aiSettings}
            onSave={handleSaveSettings}
        />

      </main>
    </div>
  );
}

export default App;
