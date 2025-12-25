
import React, { useState, useEffect, useRef, memo } from 'react';
import { Sparkles, ArrowUp, Loader2, Mic, Square, StopCircle, X, Search, Clock, Calendar, AlertCircle, Info } from 'lucide-react';
import { SmartSuggestion } from '../services/aiService';
import { WorkPlan } from '../types';
import { format } from 'date-fns';

interface SmartInputProps {
  onSubmit: (input: string) => Promise<void>;
  onStop: () => void;
  onSuggestionClick: (suggestion: SmartSuggestion) => Promise<void>;
  isProcessing: boolean;
  suggestions?: SmartSuggestion[];
  layout?: 'default' | 'sidebar' | 'header';
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchResults?: WorkPlan[];
  onSearchResultClick?: (plan: WorkPlan) => void;
  unsupportedMessage?: string | null;
  onClearUnsupported?: () => void;
}

const VoiceVisualizer = ({ analyser, isHeader }: { analyser: AnalyserNode | null, isHeader?: boolean }) => {
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const animationRef = useRef<number | null>(null);
  const barCount = isHeader ? 20 : 12;
  const smoothedValues = useRef<number[]>(new Array(barCount).fill(0));

  useEffect(() => {
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      const step = Math.floor((bufferLength * 0.4) / barCount);
      for (let i = 0; i < barCount; i++) {
        const bar = barsRef.current[i];
        if (!bar) continue;
        const rawValue = dataArray[i * step] || 0;
        const distFromCenter = Math.abs(i - (barCount - 1) / 2);
        const weight = Math.exp(-Math.pow(distFromCenter / (isHeader ? 6 : 4), 2));
        const targetValue = (rawValue / 255) * (isHeader ? 30 : 25) * weight; 
        smoothedValues.current[i] += (targetValue - smoothedValues.current[i]) * 0.25;
        const val = smoothedValues.current[i];
        bar.style.transform = `scaleY(${1 + val * 0.5})`;
        bar.style.opacity = (0.3 + (val / 10) * 0.7).toString();
      }
      animationRef.current = requestAnimationFrame(update);
    };
    update();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [analyser, barCount, isHeader]);

  return (
    <div className="flex items-center gap-[2.5px] h-6 px-1.5 overflow-visible">
      {[...Array(barCount)].map((_, i) => (
        <div key={i} ref={el => { barsRef.current[i] = el; }} className="w-0.5 h-1.5 rounded-full bg-indigo-500 origin-center will-change-transform" />
      ))}
    </div>
  );
};

const AIAssistantIcon = memo(({ isListening, isProcessing, analyser, size = 18 }: { isListening: boolean, isProcessing: boolean, analyser: AnalyserNode | null, size?: number }) => {
  const isActive = isListening || isProcessing;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size + 10, height: size + 10 }}>
      <div className={`absolute inset-0 rounded-full bg-indigo-500 blur-lg transition-opacity duration-500 ${isActive ? 'opacity-30 animate-pulse' : 'opacity-0'}`} />
      <div className={`absolute inset-0 rounded-full transition-all duration-500 ${isActive ? 'bg-indigo-600 shadow-lg' : 'bg-slate-100 border border-slate-200'}`} />
      <div className={`relative z-10 flex items-center justify-center transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-400'}`}>
         {isProcessing ? <Loader2 className="animate-spin" size={size - 2} strokeWidth={2.5} /> : <Sparkles size={size - 2} className={isActive ? "fill-white" : ""} />}
      </div>
    </div>
  );
});

export const SmartInput: React.FC<SmartInputProps> = ({ onSubmit, onStop, onSuggestionClick, isProcessing, suggestions = [], layout = 'header', searchValue = '', onSearchChange, searchResults = [], onSearchResultClick, unsupportedMessage, onClearUnsupported }) => {
  const [hintIndex, setHintIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setHintIndex((prev) => (prev + 1) % 3), 5000);
    return () => {
        clearInterval(interval);
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (e) {}
        stopAudioAnalysis();
    };
  }, []);

  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyserNode = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyserNode);
      setAnalyser(analyserNode);
    } catch (err) { console.warn(err); }
  };

  const stopAudioAnalysis = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    setAnalyser(null);
  };

  const handleSubmit = async () => {
    if (isProcessing) { onStop(); return; }
    if (isListening) { stopListening(); return; }
    if (!searchValue?.trim()) return;
    const toSubmit = searchValue;
    onClearUnsupported?.();
    await onSubmit(toSubmit);
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isProcessing) { onStop(); return; }
      if (isListening) { stopListening(); return; }
      if (!searchValue?.trim()) { startListening(); return; }
      handleSubmit();
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || isListening) return;
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onstart = () => { setIsListening(true); startAudioAnalysis(); };
        recognition.onresult = (e: any) => {
            let text = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) text += e.results[i][0].transcript;
            onSearchChange?.(text);
        };
        recognition.onerror = () => stopListening();
        recognition.onend = () => { setIsListening(false); stopAudioAnalysis(); };
        recognitionRef.current = recognition;
        recognition.start();
    } catch (e) { setIsListening(false); }
  };

  const stopListening = () => {
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}
    setIsListening(false);
  };

  const isHeader = layout === 'header';
  const showDropdown = (isFocused || (searchValue && isFocused)) || !!unsupportedMessage;

  return (
    <div className={`relative flex flex-col group/input transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] w-full`}>
      
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-2xl border border-slate-200/60 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.18)] rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-500 z-[100]">
          
          {/* AI Unsupported Feedback - Integrated into dropdown */}
          {unsupportedMessage && (
            <div className="p-4 bg-slate-900 text-white animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                  <AlertCircle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">AI 助手反馈</div>
                  <p className="text-sm font-medium leading-relaxed">{unsupportedMessage}</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onClearUnsupported?.(); }}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {suggestions.length > 0 && !searchValue && !unsupportedMessage && (
            <div className="p-4 bg-slate-50/50 border-b border-slate-100">
              <div className="px-3 py-1.5 mb-2.5 flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">安排日程灵感</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-2.5">
                {suggestions.map((item, idx) => (
                  <button key={idx} onClick={() => onSuggestionClick(item)} className="flex items-center gap-3.5 p-3 rounded-2xl bg-white border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group/btn">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 group-hover/btn:scale-110 group-hover/btn:bg-indigo-500 group-hover/btn:text-white transition-all duration-300">
                      <Calendar size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-600 truncate">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {searchValue && (
             <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-3">
                {searchResults && searchResults.length > 0 ? (
                    searchResults.map(plan => (
                        <button key={plan.id} onClick={() => onSearchResultClick?.(plan)} className="w-full flex items-center gap-3.5 p-3 hover:bg-slate-50 rounded-2xl transition-all text-left group">
                            <div className={`w-11 h-11 flex flex-col items-center justify-center rounded-2xl bg-${plan.color}-50 text-${plan.color}-600 border border-${plan.color}-100 flex-shrink-0 group-hover:bg-${plan.color}-500 group-hover:text-white transition-all duration-300`}>
                                <span className="text-[9px] font-black leading-none uppercase">{format(new Date(plan.startDate), 'MMM')}</span>
                                <span className="text-sm font-black mt-0.5 leading-none">{format(new Date(plan.startDate), 'd')}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-800 text-[14px] truncate">{plan.title}</div>
                                <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                    <Clock size={11} /> {format(new Date(plan.startDate), 'HH:mm')} - {format(new Date(plan.endDate), 'HH:mm')}
                                </div>
                            </div>
                        </button>
                    ))
                ) : !unsupportedMessage && (
                    <div className="py-12 text-center flex flex-col items-center gap-3 animate-in fade-in duration-500">
                        <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
                           <Search size={28} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-400">未找到相关日程</span>
                          <span className="text-[11px] text-slate-300">按回车让 AI 帮您直接安排</span>
                        </div>
                    </div>
                )}
             </div>
          )}
        </div>
      )}

      <div className={`
        relative flex items-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${isHeader 
          ? 'h-9 rounded-xl bg-slate-100/60 border border-slate-200/50 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-[6px] focus-within:ring-indigo-500/5' 
          : 'h-14 rounded-2xl bg-white shadow-xl border border-slate-100 focus-within:ring-4 focus-within:ring-indigo-500/10'
        }
        ${unsupportedMessage ? 'ring-2 ring-rose-500/20 border-rose-400' : ''}
      `}>
        <div className="pl-3 flex items-center gap-3">
          <AIAssistantIcon isListening={isListening} isProcessing={isProcessing} analyser={analyser} size={14} />
          <div className={`w-px h-3.5 bg-slate-200 transition-opacity duration-300 ${(isFocused || searchValue) ? 'opacity-100' : 'opacity-0'}`} />
        </div>

        <div className="flex-1 relative h-full flex items-center ml-2.5">
           {!searchValue && !isListening && (
              <span className={`absolute inset-0 flex items-center text-slate-400 text-sm font-bold pointer-events-none truncate transition-all duration-500 ${isFocused ? 'opacity-40' : 'opacity-70'}`}>
                {isFocused ? ["搜索日程...", "安排明天下午开会", "创建本周五报告"][hintIndex] : "搜索日程或 AI 安排"}
              </span>
           )}
           
           {isListening && !searchValue && (
              <div className="flex items-center gap-2">
                <span className="text-indigo-600 font-black text-[11px] uppercase tracking-wider">Listening</span>
                <VoiceVisualizer analyser={analyser} isHeader={isHeader} />
              </div>
           )}

           <input
              ref={inputRef}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={handleEnterKey}
              className={`w-full h-full bg-transparent border-none outline-none text-sm font-bold text-slate-800 tracking-tight transition-all duration-300 ${isListening && !searchValue ? 'opacity-0' : 'opacity-100'}`}
           />
        </div>

        <div className="flex items-center pr-1 gap-1">
            {!searchValue && !isProcessing && (
              <button onClick={isListening ? stopListening : startListening} className={`p-1.5 rounded-lg transition-all ${isListening ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200/50'}`}>
                <Mic size={16} />
              </button>
            )}

            {searchValue && !isProcessing && (
              <button onClick={() => { onSearchChange?.(''); onClearUnsupported?.(); }} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors">
                <X size={15} />
              </button>
            )}

            {(searchValue || isProcessing || isListening) && (
                <button 
                onClick={handleSubmit}
                className={`
                    flex items-center justify-center rounded-lg transition-all w-7 h-7
                    ${(searchValue?.trim() || isListening || isProcessing) 
                        ? 'bg-slate-900 text-white shadow-lg hover:bg-black active:scale-90' 
                        : 'bg-slate-100 text-slate-300'
                    }
                `}
                >
                {isProcessing ? <StopCircle size={14} /> : isListening ? <Square size={10} fill="currentColor" /> : <ArrowUp size={16} strokeWidth={3} />}
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
