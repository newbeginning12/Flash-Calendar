
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, Loader2, Mic, Square, Send } from 'lucide-react';
import { SmartSuggestion } from '../services/aiService';

interface SmartInputProps {
  onSubmit: (input: string) => Promise<void>;
  onStop: () => void;
  onSuggestionClick: (suggestion: SmartSuggestion) => Promise<void>;
  isProcessing: boolean;
  suggestions?: SmartSuggestion[];
}

const PLACEHOLDER_HINTS = [
  "点击麦克风说话，或输入：明天下午3点和产品团队开会",
  "尝试输入：生成本周工作周报",
  "尝试输入：帮我规划下周的开发计划",
  "尝试输入：查询下周三有什么安排？",
  "尝试输入：本周完成了哪些任务？",
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
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const valueBeforeRecording = useRef(''); 
  const inputRef = useRef<HTMLInputElement>(null);

  // Rotate hints every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
    }, 5000); 
    return () => clearInterval(interval);
  }, []);

  const stopAndSend = async () => {
    // 1. Stop listening immediately
    stopListening();
    
    // 2. Submit immediately if there is content
    if (value.trim()) {
        await onSubmit(value);
        setValue('');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Case 1: AI is thinking -> Stop Generation
    if (isProcessing) {
        onStop();
        return;
    }

    // Case 2: User is Recording -> Stop Recording AND Send (Immediate)
    if (isListening) {
        await stopAndSend();
        return;
    }

    // Case 3: Normal Text Send
    if (!value.trim()) return;
    
    await onSubmit(value);
    setValue('');
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        
        if (isProcessing) return;

        // If listening, Enter key acts as "Stop & Send"
        if (isListening) {
            await stopAndSend();
        } else {
            await handleSubmit();
        }
    }
  };

  const handleClick = async (suggestion: SmartSuggestion) => {
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

    // Prevent starting if already started
    if (recognitionRef.current && isListening) return;

    valueBeforeRecording.current = value; // Preserve existing text
    
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true; 
        recognition.interimResults = true; 

        recognition.onstart = () => {
          setIsListening(true);
          setIsFocused(true);
        };

        recognition.onresult = (event: any) => {
          let sessionTranscript = '';
          for (let i = 0; i < event.results.length; ++i) {
              sessionTranscript += event.results[i][0].transcript;
          }

          // Just update text, DO NOT auto submit
          // If we had text before, append a space
          const prefix = valueBeforeRecording.current;
          const separator = prefix && !prefix.endsWith(' ') ? '' : ''; 
          const newValue = prefix + separator + sessionTranscript;
          setValue(newValue);
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          if (event.error === 'not-allowed') {
              alert('无法访问麦克风，请检查权限设置。');
          }
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          // Focus back to input so user can edit or send
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
    e.preventDefault(); // Prevent form submit or focus loss issues
    if (isListening) {
      stopListening(); // Manual click just stops, doesn't send (allows editing)
    } else {
      startListening();
    }
  };

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-40">
      {/* Suggestions Chips */}
      {suggestions.length > 0 && !isProcessing && !isListening && (
        <div className="flex justify-center gap-2 mb-3 overflow-x-auto pb-1 px-4 custom-scrollbar mask-gradient flex-wrap">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleClick(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white transition-all active:scale-95 animate-fade-in-up"
              style={{ animationDelay: `${idx * 100}ms`, animationFillMode: 'both' }}
            >
              <Sparkles size={12} className="text-indigo-400" />
              {item.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative group">
        <div className={`absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 ${isListening ? 'opacity-60 animate-pulse duration-700' : ''}`}></div>
        <div className={`
          relative flex items-center bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-2 transition-all 
          ${isFocused || isListening ? 'shadow-[0_8px_40px_rgb(0,0,0,0.12)] bg-white/95' : ''}
          ${isListening ? 'ring-2 ring-indigo-500/20' : ''}
        `}>
          
          {/* Leading Icon / Status */}
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ml-1 flex-shrink-0 z-10 transition-all duration-300 overflow-hidden ${isListening ? 'bg-indigo-50 text-indigo-500' : 'bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-500'}`}>
            {isProcessing ? (
              <Loader2 className="animate-spin" size={20} />
            ) : isListening ? (
               // Simple Waveform Animation
               <div className="flex items-end gap-[2px] h-4">
                  <div className="w-1 bg-indigo-500 rounded-full animate-[bounce_1s_infinite] h-2"></div>
                  <div className="w-1 bg-indigo-500 rounded-full animate-[bounce_1.2s_infinite] h-4"></div>
                  <div className="w-1 bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite] h-3"></div>
               </div>
            ) : (
              <Sparkles size={20} />
            )}
          </div>

          {/* Input Field */}
          <div className="flex-1 relative h-10 mx-2 overflow-hidden">
             {/* Dynamic Placeholder Text */}
             {!value && !isListening && (
               <div className="absolute inset-0 flex items-center pointer-events-none">
                  <span 
                    key={hintIndex} 
                    className="text-slate-500 text-base truncate animate-fade-in-up block w-full"
                  >
                    {PLACEHOLDER_HINTS[hintIndex]}
                  </span>
               </div>
             )}
             
             {isListening && !value && (
                <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className="text-indigo-500/60 text-base font-medium animate-pulse">
                        正在聆听... 按回车直接发送
                    </span>
                </div>
             )}

             {/* Actual Input */}
             <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={isProcessing}
                className="w-full h-full bg-transparent border-none outline-none text-slate-800 text-base relative z-10 placeholder-transparent disabled:cursor-not-allowed disabled:opacity-50"
             />
          </div>

          {/* Actions Container */}
          <div className="flex items-center gap-3 pr-1">
             {/* Voice Button */}
             <button
                type="button"
                onClick={toggleListening}
                disabled={isProcessing}
                className={`p-2 rounded-xl transition-all flex-shrink-0 z-10 hover:bg-slate-100 ${
                    isListening 
                        ? 'text-rose-500 bg-rose-50 ring-1 ring-rose-200 scale-105 shadow-sm hover:bg-rose-100' 
                        : 'text-slate-400 hover:text-indigo-500'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                title={isListening ? "停止录音 (不发送)" : "点击开始语音输入"}
             >
                 {isListening ? (
                     <Square size={18} fill="currentColor" />
                 ) : (
                     <Mic size={20} />
                 )}
             </button>

             {/* Send Button */}
             <button 
               type="button"
               onClick={() => handleSubmit()}
               disabled={!isProcessing && !isListening && !value.trim()}
               className={`
                   p-2 rounded-xl text-white transition-all active:scale-95 shadow-md flex-shrink-0 z-10 flex items-center justify-center w-10 h-10
                   ${isProcessing 
                       ? 'bg-slate-700 hover:bg-slate-600' 
                       : isListening 
                           ? 'bg-indigo-500 hover:bg-indigo-600 ring-2 ring-indigo-200'
                           : 'bg-slate-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300'
                   }
               `}
               title={isProcessing ? "停止生成" : isListening ? "停止录音并发送 (Enter)" : "确认发送"}
             >
               {isProcessing ? (
                   <Square size={14} fill="currentColor" /> 
               ) : isListening ? (
                   <Send size={16} className="ml-0.5" />
               ) : (
                   <ArrowRight size={18} />
               )}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
