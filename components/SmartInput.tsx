
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowUp, Loader2, Mic, Square, StopCircle } from 'lucide-react';
import { SmartSuggestion } from '../services/aiService';

interface SmartInputProps {
  onSubmit: (input: string) => Promise<void>;
  onStop: () => void;
  onSuggestionClick: (suggestion: SmartSuggestion) => Promise<void>;
  isProcessing: boolean;
  suggestions?: SmartSuggestion[];
}

const PLACEHOLDER_HINTS = [
  "生成本周工作周报",
  "帮我规划下周的开发计划",
  "查询下周三有什么安排？",
  "周五晚上8点提醒我健身"
];

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

// --- Custom AI Icon (Nano Banana - Flash Style) ---
const NanoIcon = ({ isExpanded, isListening, isProcessing }: { isExpanded: boolean, isListening: boolean, isProcessing: boolean }) => {
  const isActive = isListening || isProcessing;
  
  return (
    <div className={`relative flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isExpanded ? 'w-8 h-8' : 'w-9 h-9'}`}>
      
      {/* Active Glow - Warm Amber/Gold for "Flash" */}
      <div className={`absolute inset-0 rounded-full bg-gradient-to-tr from-amber-300 via-orange-400 to-blue-400 blur-xl transition-all duration-500 ${isActive ? 'scale-150 opacity-60' : 'scale-75 opacity-0'}`} />
      
      {/* Main Orb */}
      <div className={`
          absolute inset-0 rounded-full transition-all duration-500 overflow-hidden border border-white/20
          ${isActive 
             ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-blue-500 shadow-[0_0_15px_rgba(251,191,36,0.5)]' 
             : 'bg-gradient-to-br from-slate-100 to-slate-200 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_4px_10px_rgba(0,0,0,0.05)]'
          }
      `}>
          {/* Glass Sheen */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-transparent opacity-100" />
      </div>
      
      {/* Icon Content */}
      <div className={`relative z-10 drop-shadow-sm flex items-center justify-center transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-400'}`}>
         {isProcessing ? (
            <Loader2 className="animate-spin" size={16} strokeWidth={2.5} />
         ) : isListening ? (
             <div className="flex gap-0.5 items-center h-2.5">
                <div className="w-0.5 bg-white rounded-full animate-[bounce_1s_infinite] h-2"></div>
                <div className="w-0.5 bg-white rounded-full animate-[bounce_1.2s_infinite] h-2.5"></div>
                <div className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite] h-2"></div>
             </div>
         ) : (
            // The Flash Spark
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={`transition-transform duration-500 ${isExpanded ? 'scale-[0.85]' : 'scale-100'}`}>
                <path 
                    d="M12 2L14.5 9.5H22L16 14.5L18.5 22L12 17L5.5 22L8 14.5L2 9.5H9.5L12 2Z" 
                    fill="currentColor" 
                    className={isActive ? 'fill-white' : 'fill-slate-400'}
                />
             </svg>
         )}
      </div>
    </div>
  );
};

export const SmartInput: React.FC<SmartInputProps> = ({ onSubmit, onStop, onSuggestionClick, isProcessing, suggestions = [] }) => {
  const [value, setValue] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  
  // Collapsible State
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const valueBeforeRecording = useRef(''); 

  // Rotate hints
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
    }, 4000); 
    return () => clearInterval(interval);
  }, []);

  // Auto-expand logic
  useEffect(() => {
      if (value || isProcessing || isListening) {
          setIsExpanded(true);
      }
  }, [value, isProcessing, isListening]);

  // Click Outside to Collapse
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as Node;
        // Check if click is inside Main Input Container OR Suggestions Container
        const isInsideInput = containerRef.current && containerRef.current.contains(target);
        const isInsideSuggestions = suggestionsRef.current && suggestionsRef.current.contains(target);

        if (!isInsideInput && !isInsideSuggestions) {
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

  // Focus management
  useEffect(() => {
      if (isExpanded && inputRef.current) {
          // Small delay to match animation start
          setTimeout(() => inputRef.current?.focus(), 100);
      }
  }, [isExpanded]);

  const handleSubmit = async () => {
    if (isProcessing) {
        onStop();
        return;
    }
    if (isListening) {
        stopListening();
        setTimeout(() => {
            if (value.trim()) onSubmit(value);
            setValue('');
        }, 100);
        return;
    }
    if (!value.trim()) return;
    
    await onSubmit(value);
    setValue('');
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
    }
  };

  const handleClickSuggestion = async (suggestion: SmartSuggestion) => {
    if (isProcessing) return;
    stopListening();
    await onSuggestionClick(suggestion);
  };

  // --- Speech Logic ---
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器暂不支持语音识别。');
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
          setIsExpanded(true); 
        };
        
        recognition.onresult = (event: any) => {
          let sessionTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
              sessionTranscript += event.results[i][0].transcript;
          }
          const prefix = valueBeforeRecording.current;
          setValue(prefix + sessionTranscript);
        };
        
        recognition.onerror = (event: any) => {
           if (event.error !== 'no-speech') {
               console.warn('Speech error', event.error);
           }
           setIsListening(false);
        };
        
        recognition.onend = () => {
          setIsListening(false);
          inputRef.current?.focus();
        };
        
        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) {
        console.error(e);
        setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = (e: React.MouseEvent) => {
    e.stopPropagation();
    isListening ? stopListening() : startListening();
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-full max-w-3xl flex flex-col items-center justify-end z-50 pointer-events-none">
      
      {/* Suggestions (Float above) */}
      <div 
        ref={suggestionsRef}
        className={`
            w-full flex justify-center mb-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]
            ${isExpanded && suggestions.length > 0 && !isProcessing 
                ? 'opacity-100 translate-y-0 pointer-events-auto scale-100' 
                : 'opacity-0 translate-y-8 pointer-events-none scale-90 h-0 overflow-hidden'
            }
        `}
      >
        <div className="flex gap-2 px-6 overflow-x-auto custom-scrollbar max-w-full pb-1 justify-center">
            {suggestions.map((item, idx) => (
                <button
                    key={idx}
                    onClick={() => handleClickSuggestion(item)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white/80 backdrop-blur-xl border border-white/60 shadow-lg shadow-slate-200/50 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:bg-white hover:scale-105 transition-all group ring-1 ring-black/5"
                >
                    <Sparkles size={11} className="text-amber-400 group-hover:text-amber-500 transition-colors" />
                    {item.label}
                </button>
            ))}
        </div>
      </div>

      {/* Main Container - Apple Style Glass Capsule */}
      <div 
        ref={containerRef}
        onClick={() => { if (!isExpanded) setIsExpanded(true); }}
        className={`
            relative flex items-center shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)] backdrop-blur-3xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto
            ${isExpanded 
                ? 'w-[90%] max-w-[600px] h-[56px] rounded-[28px] bg-white/95 border border-white/60 cursor-text ring-1 ring-black/5' 
                : 'w-[136px] h-[46px] rounded-full bg-white/95 border border-white/60 hover:scale-[1.02] cursor-pointer hover:shadow-[0_16px_50px_-10px_rgba(0,0,0,0.15)] ring-1 ring-black/5'
            }
        `}
      >
        
        {/* Left Icon Wrapper */}
        <div 
            className={`absolute top-1/2 -translate-y-1/2 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-20 flex items-center justify-center
                ${isExpanded ? 'left-3' : 'left-1.5'}
            `}
        >
             <NanoIcon isExpanded={isExpanded} isListening={isListening} isProcessing={isProcessing} />
        </div>

        {/* Collapsed Label */}
        <div 
            className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${!isExpanded ? 'opacity-100 translate-x-3 scale-100' : 'opacity-0 translate-x-[-20px] scale-90'}
            `}
        >
             <span className="text-[14px] font-semibold text-slate-600 tracking-tight">
                闪历 AI
             </span>
        </div>

        {/* Expanded Content */}
        <div 
            className={`absolute inset-0 pl-[56px] pr-2 flex items-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
                ${isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
            `}
        >
            <div className="relative flex-1 h-full flex items-center">
                 {!value && !isListening && (
                    <div className="absolute inset-0 flex items-center pointer-events-none">
                        <span className="text-slate-400 text-[15px] truncate animate-fade-in font-normal tracking-wide">
                            {PLACEHOLDER_HINTS[hintIndex]}
                        </span>
                    </div>
                 )}
                 {isListening && !value && (
                    <span className="absolute text-amber-500 font-medium animate-pulse text-[15px]">
                        正在聆听...
                    </span>
                 )}
                 <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!isExpanded || isProcessing}
                    className="w-full h-full bg-transparent border-none outline-none text-[16px] text-slate-800 placeholder-transparent font-medium caret-amber-500"
                 />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 pl-2">
                 <button
                    onClick={toggleListening}
                    disabled={isProcessing}
                    className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-200 ${
                        isListening 
                            ? 'bg-rose-50 text-rose-500 ring-2 ring-rose-100' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                 >
                     {isListening ? <Square size={12} fill="currentColor" /> : <Mic size={20} strokeWidth={1.5} />}
                 </button>

                 <button 
                   onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                   disabled={!isProcessing && !isListening && !value.trim()}
                   className={`
                       w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300
                       ${(value.trim() || isListening || isProcessing) 
                           ? 'bg-slate-900 text-white scale-100 shadow-md hover:bg-black hover:scale-105' 
                           : 'bg-slate-100 text-slate-300 scale-90 cursor-not-allowed'
                       }
                   `}
                 >
                   {isProcessing ? <StopCircle size={16} /> : <ArrowUp size={20} strokeWidth={2.5} />}
                 </button>
            </div>
        </div>
        
      </div>
    </div>
  );
};
