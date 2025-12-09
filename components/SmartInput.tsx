import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { SmartSuggestion } from '../services/aiService';

interface SmartInputProps {
  onSubmit: (input: string) => Promise<void>;
  onSuggestionClick: (suggestion: SmartSuggestion) => Promise<void>;
  isProcessing: boolean;
  suggestions?: SmartSuggestion[];
}

export const SmartInput: React.FC<SmartInputProps> = ({ onSubmit, onSuggestionClick, isProcessing, suggestions = [] }) => {
  const [value, setValue] = useState('');

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

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 w-full max-w-2xl px-4 z-40">
      {/* Suggestions Chips */}
      {suggestions.length > 0 && !isProcessing && (
        <div className="flex justify-center gap-2 mb-3 overflow-x-auto pb-1 px-4 custom-scrollbar mask-gradient flex-wrap">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleClick(item)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/60 shadow-sm text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-white transition-all active:scale-95 animate-in fade-in slide-in-from-bottom-2 duration-300"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <Sparkles size={12} className="text-indigo-400" />
              {item.label}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative flex items-center bg-white/80 backdrop-blur-xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl p-2 transition-all group-focus-within:shadow-[0_8px_40px_rgb(0,0,0,0.12)] group-focus-within:bg-white/95">
          
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 text-indigo-500 ml-1">
            {isProcessing ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <Sparkles size={20} />
            )}
          </div>

          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isProcessing}
            placeholder="安排日程，或尝试输入 '生成本周周报' ..."
            className="flex-1 bg-transparent border-none outline-none px-4 text-slate-800 placeholder-slate-400 text-base"
          />

          <button 
            type="submit"
            disabled={!value.trim() || isProcessing}
            className="p-2 bg-slate-900 text-white rounded-xl hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-md"
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};