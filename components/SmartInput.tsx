import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowUp, Loader2, Mic, Square, ChevronDown, X, Command, StopCircle } from 'lucide-react';
import { SmartSuggestion } from '../services/aiService';

interface SmartInputProps {
  onSubmit: (input: string) => Promise<void>;
  onStop: () => void;
  onSuggestionClick: (suggestion: SmartSuggestion) => Promise<void>;
  isProcessing: boolean;
  suggestions?: SmartSuggestion[];
}

const PLACEHOLDER_HINTS = [
  "点击麦克风说话...",
  "尝试输入：生成本周工作周报",
  "尝试输入：帮我规划下周的开发计划",
  "尝试输入：查询下周三有什么安排？",
  "尝试输入：周五晚上8点提醒我健身"
];

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export const SmartInput: React.FC<SmartInputProps> = ({ onSubmit, onStop, onSuggestionClick, isProcessing, suggestions = [] }) => {
  const [value, setValue] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  
  // Collapsible State
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const valueBeforeRecording = useRef(''); 

  // Rotate hints
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
    }, 5000); 
    return () => clearInterval(interval);
  }, []);

  // Auto-expand if there is content or activity
  useEffect(() => {
      if (value || isProcessing || isListening) {
          setIsExpanded(true);
      }
  }, [value, isProcessing, isListening]);

  // Handle Click Outside to Collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
            // Only collapse if idle (no text, not listening, not processing)
            if (!value.trim() && !isListening && !isProcessing) {
                setIsExpanded(false);
            }
        }
    };

    if (isExpanded) {
        window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded, value, isListening, isProcessing]);

  // Focus input when expanding
  useEffect(() => {
      if (isExpanded && inputRef.current) {
          setTimeout(() => inputRef.current?.focus(), 100);
      }
  }, [isExpanded]);

  const stopAndSend = async () => {
    stopListening();
    if (value.trim()) {
        await onSubmit(value);
        setValue('');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isProcessing) {
        onStop();
        return;
    }
    if (isListening) {
        await stopAndSend();
        return;
    }
    if (!value.trim()) return;
    
    await onSubmit(value);
    setValue('');
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (isProcessing) return;
        if (isListening) {
            await stopAndSend();
        } else {
            await handleSubmit();
        }
    }
  };

  const handleClickSuggestion = async (suggestion: SmartSuggestion) => {
    if (isProcessing) return;
    stopListening();
    await onSuggestionClick(suggestion);
  };

  // --- Speech Recognition Logic ---
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器暂不支持语音识别，请使用 Chrome 或 Edge 浏览器。');
      return;
    }
    if (recognitionRef.current && isListening) return;
    valueBeforeRecording.current = value;
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true; 
        recognition.interimResults = true; 
        recognition.onstart = () => {
          setIsListening(true);
          setIsFocused(true);
          setIsExpanded(true); // Force expand
        };
        recognition.onresult = (event: any) => {
          let sessionTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
              sessionTranscript += event.results[i][0].transcript;
          }
          const prefix = valueBeforeRecording.current;
          const separator = prefix && !prefix.endsWith(' ') ? '' : ''; 
          const newValue = prefix + separator + sessionTranscript;
          setValue(newValue);
        };
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };
        recognition.onend = () => {
          setIsListening(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        };
        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) {
        console.error("Failed to start recognition", e);
        setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // --- Render ---

  // 1. Collapsed State: A minimal, transparent glass pill
  if (!isExpanded) {
      return (
          <div ref={containerRef} className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-500 ease-out">
              <button
                  onClick={() => setIsExpanded(true)}
                  className="group relative flex items-center gap-3 bg-white/40 backdrop-blur-2xl border border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.06)] rounded-full pl-2 pr-5 py-2 hover:scale-105 hover:bg-white/50 transition-all duration-300 cursor-pointer"
              >
                  {/* Apple Siri-like Orb Icon */}
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-400 via-purple-400 to-rose-400 flex items-center justify-center text-white shadow-sm group-hover:rotate-180 transition-transform duration-700 ease-in-out">
                      <Sparkles size={14} fill="currentColor" className="text-white/90" />
                  </div>
                  
                  <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-slate-700/80 tracking-tight group-hover:text-slate-900 transition-colors">AI 智能助手</span>
                  </div>

                  {suggestions.length > 0 && (
                      <div className="flex items-center justify-center bg-white/50 border border-white/20 text-indigo-600 h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold ml-1 shadow-sm">
                          {suggestions.length}
                      </div>
                  )}
              </button>
          </div>
      );
  }

  // 2. Expanded State: Full Glass Input Bar
  return (
    <div 
        ref={containerRef} 
        className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-40 flex flex-col justify-end transition-all duration-300 ease-out"
    >
      
      {/* Suggestions Panel */}
      {suggestions.length > 0 && !isProcessing && (
         <div className="mb-3 mx-2 animate-in slide-in-from-bottom-2 fade-in duration-500 origin-bottom">
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar mask-gradient-r">
                {suggestions.map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleClickSuggestion(item)}
                        className="flex-shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/40 backdrop-blur-xl border border-white/40 shadow-sm text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white/60 hover:-translate-y-0.5 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <Sparkles size={12} className="text-indigo-400" />
                        {item.label}
                    </button>
                ))}
            </div>
         </div>
      )}

      {/* Main Input Bar */}
      <div className="relative group w-full">
        <div className={`
          relative flex items-center bg-white/50 backdrop-blur-2xl border border-white/30 shadow-[0_12px_48px_rgba(0,0,0,0.08)] rounded-3xl p-1.5 transition-all duration-300
          ${isFocused || isListening ? 'bg-white/70 shadow-[0_20px_60px_rgba(0,0,0,0.12)] border-white/50' : ''}
        `}>
          
          {/* Collapse / Status Icon */}
          <button 
             onClick={() => !value && setIsExpanded(false)}
             className={`
                flex items-center justify-center w-10 h-10 rounded-2xl ml-1 flex-shrink-0 z-10 transition-all duration-300
                ${isListening ? 'text-indigo-500' : 'text-slate-400 hover:text-slate-600'}
             `}
             title="收起"
          >
            {isProcessing ? (
              <Loader2 className="animate-spin text-slate-600" size={20} />
            ) : isListening ? (
               <div className="flex items-end gap-[2px] h-3.5">
                  <div className="w-1 bg-indigo-500 rounded-full animate-[bounce_1s_infinite] h-2"></div>
                  <div className="w-1 bg-indigo-500 rounded-full animate-[bounce_1.2s_infinite] h-3.5"></div>
                  <div className="w-1 bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite] h-2.5"></div>
               </div>
            ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-100 to-white border border-white/50 flex items-center justify-center shadow-sm">
                    <Sparkles size={16} className="text-indigo-400 fill-indigo-100" />
                </div>
            )}
          </button>

          {/* Input Field */}
          <div className="flex-1 relative h-10 mx-2 overflow-hidden">
             {!value && !isListening && (
               <div className="absolute inset-0 flex items-center pointer-events-none">
                  <span 
                    key={hintIndex} 
                    className="text-slate-500/60 text-[15px] truncate animate-fade-in-up block w-full select-none"
                  >
                    {PLACEHOLDER_HINTS[hintIndex]}
                  </span>
               </div>
             )}
             
             {isListening && !value && (
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className="text-indigo-500/80 text-[15px] font-medium animate-pulse select-none">
                        正在聆听...
                    </span>
                </div>
             )}

             <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={isProcessing}
                className="w-full h-full bg-transparent border-none outline-none text-slate-800 text-[16px] leading-normal relative z-10 placeholder-transparent disabled:cursor-not-allowed"
             />
          </div>

          {/* Minimalist Actions */}
          <div className="flex items-center gap-1 pr-1">
             <button
                type="button"
                onClick={toggleListening}
                disabled={isProcessing}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-all flex-shrink-0 ${
                    isListening 
                        ? 'text-rose-500 bg-rose-50 ring-1 ring-rose-100' 
                        : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100/50'
                }`}
             >
                 {isListening ? <Square size={14} fill="currentColor" /> : <Mic size={20} />}
             </button>

             <button 
               type="button"
               onClick={() => handleSubmit()}
               disabled={!isProcessing && !isListening && !value.trim()}
               className={`
                   w-9 h-9 flex items-center justify-center rounded-full transition-all flex-shrink-0
                   ${(value.trim() || isListening || isProcessing) 
                       ? 'bg-slate-900 text-white shadow-md hover:scale-105 active:scale-95' 
                       : 'bg-slate-200/50 text-slate-400 cursor-not-allowed'
                   }
               `}
             >
               {isProcessing ? <StopCircle size={16} /> : <ArrowUp size={20} />}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
