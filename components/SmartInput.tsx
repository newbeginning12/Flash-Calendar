
import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, Loader2, Mic, Square } from 'lucide-react';
import { SmartSuggestion } from '../services/aiService';

interface SmartInputProps {
  onSubmit: (input: string) => Promise<void>;
  onSuggestionClick: (suggestion: SmartSuggestion) => Promise<void>;
  isProcessing: boolean;
  suggestions?: SmartSuggestion[];
}

const PLACEHOLDER_HINTS = [
  "尝试输入：明天下午3点和产品团队开会",
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

export const SmartInput: React.FC<SmartInputProps> = ({ onSubmit, onSuggestionClick, isProcessing, suggestions = [] }) => {
  const [value, setValue] = useState('');
  const [hintIndex, setHintIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  
  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  // Store the text that existed before recording started to append correctly
  const valueBeforeRecording = useRef(''); 

  // Rotate hints every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % PLACEHOLDER_HINTS.length);
    }, 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isProcessing) return;
    await onSubmit(value);
    setValue('');
  };

  const handleClick = async (suggestion: SmartSuggestion) => {
    if (isProcessing) return;
    await onSuggestionClick(suggestion);
  };

  // --- Speech Recognition Logic ---
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('您的浏览器暂不支持语音识别，请使用 Chrome 或 Edge 浏览器。');
      return;
    }

    // Save current text so we can append speech to it
    valueBeforeRecording.current = value;
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true; // Keep listening even if user pauses
    recognition.interimResults = true; // Crucial for "millisecond" feel (shows text as you speak)

    recognition.onstart = () => {
      setIsListening(true);
      setIsFocused(true); // Focus input to show visual active state
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
          // Update the baseline for the next segment
          valueBeforeRecording.current += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Update UI immediately with what we have so far
      setValue(valueBeforeRecording.current + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
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

      <form onSubmit={handleSubmit} className="relative group">
        <div className={`absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 ${isListening ? 'opacity-60 animate-pulse duration-700' : ''}`}></div>
        <div className={`
          relative flex items-center bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-2 transition-all 
          ${isFocused || isListening ? 'shadow-[0_8px_40px_rgb(0,0,0,0.12)] bg-white/95' : ''}
          ${isListening ? 'ring-2 ring-indigo-500/20' : ''}
        `}>
          
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-500 ml-1 flex-shrink-0 z-10 transition-colors duration-300">
            {isProcessing ? (
              <Loader2 className="animate-spin" size={20} />
            ) : isListening ? (
               <div className="flex gap-0.5 items-end justify-center h-4 pb-0.5">
                   <span className="w-1 h-3 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_0ms]"></span>
                   <span className="w-1 h-5 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_200ms]"></span>
                   <span className="w-1 h-3 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_400ms]"></span>
               </div>
            ) : (
              <Sparkles size={20} />
            )}
          </div>

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
                    <span className="text-indigo-500/60 text-base animate-pulse">正在聆听...</span>
                </div>
             )}

             {/* Actual Input */}
             <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                disabled={isProcessing}
                className="w-full h-full bg-transparent border-none outline-none text-slate-800 text-base relative z-10 placeholder-transparent"
             />
          </div>

          {/* Voice Button */}
          <button
             type="button"
             onClick={toggleListening}
             disabled={isProcessing}
             className={`p-2 mr-1 rounded-xl transition-all flex-shrink-0 z-10 hover:bg-slate-100 ${
                 isListening ? 'text-rose-500 bg-rose-50 hover:bg-rose-100' : 'text-slate-400 hover:text-indigo-500'
             }`}
             title={isListening ? "停止录音" : "语音输入"}
          >
              {isListening ? <Square size={18} fill="currentColor" /> : <Mic size={20} />}
          </button>

          <button 
            type="submit"
            disabled={!value.trim() || isProcessing}
            className={`p-2 bg-slate-900 text-white rounded-xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md flex-shrink-0 z-10`}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};
