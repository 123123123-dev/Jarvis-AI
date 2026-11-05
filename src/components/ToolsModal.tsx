import React, { useState } from 'react';
import {
  X,
  Calculator,
  ArrowRightLeft,
  Wand2,
  Clock,
  Check,
  Copy,
  Sparkles,
} from 'lucide-react';

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertPrompt: (text: string) => void;
}

export const ToolsModal: React.FC<ToolsModalProps> = ({
  isOpen,
  onClose,
  onInsertPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<'calc' | 'converter' | 'prompts' | 'time'>('calc');

  // Calculator State
  const [calcInput, setCalcInput] = useState('25 * 4 + 50');
  const [calcResult, setCalcResult] = useState<string | null>(null);

  // Unit Converter State
  const [convertValue, setConvertValue] = useState(100);
  const [convertType, setConvertType] = useState<'c_to_f' | 'km_to_miles' | 'kg_to_lbs' | 'gb_to_mb'>('c_to_f');

  // Prompt Enhancer State
  const [rawPrompt, setRawPrompt] = useState('');
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [copiedEnhanced, setCopiedEnhanced] = useState(false);

  if (!isOpen) return null;

  const handleEvaluateCalc = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Safe sanitized arithmetic evaluation
      const sanitized = calcInput.replace(/[^0-9\+\-\*\/\.\(\)\s]/g, '');
      // eslint-disable-next-line no-eval
      const res = Function(`'use strict'; return (${sanitized})`)();
      setCalcResult(String(res));
    } catch {
      setCalcResult('Invalid Expression');
    }
  };

  const getConvertedResult = () => {
    switch (convertType) {
      case 'c_to_f':
        return `${convertValue}°C = ${(convertValue * 9) / 5 + 32}°F`;
      case 'km_to_miles':
        return `${convertValue} km = ${(convertValue * 0.621371).toFixed(2)} miles`;
      case 'kg_to_lbs':
        return `${convertValue} kg = ${(convertValue * 2.20462).toFixed(2)} lbs`;
      case 'gb_to_mb':
        return `${convertValue} GB = ${convertValue * 1024} MB`;
    }
  };

  const handleEnhancePrompt = () => {
    if (!rawPrompt.trim()) return;
    const enhanced = `Act as an expert specialist in this domain. Provide a highly detailed, comprehensive, step-by-step breakdown regarding: "${rawPrompt.trim()}". Include practical examples, theoretical foundations, code or mathematical formulas where appropriate, and actionable recommendations.`;
    setEnhancedPrompt(enhanced);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#09101d] border border-cyan-500/40 p-5 md:p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">JARVIS AI Multi-Tool Studio</h3>
            <p className="text-xs text-slate-400">
              Computational & Cognitive Tools · Abdullah Waheed (LGS Paragon)
            </p>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 p-1 bg-slate-900 rounded-xl mb-4 border border-slate-800">
          <button
            onClick={() => setActiveTab('calc')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'calc'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Math</span>
          </button>

          <button
            onClick={() => setActiveTab('converter')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'converter'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Units</span>
          </button>

          <button
            onClick={() => setActiveTab('prompts')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'prompts'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Enhancer</span>
          </button>

          <button
            onClick={() => setActiveTab('time')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'time'
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Clocks</span>
          </button>
        </div>

        {/* Tab 1: Scientific Calculator */}
        {activeTab === 'calc' && (
          <form onSubmit={handleEvaluateCalc} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Arithmetic or Expression
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={calcInput}
                  onChange={(e) => setCalcInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm font-mono text-cyan-200 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. (15 * 40) + sqrt(144)"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  Solve
                </button>
              </div>
            </div>

            {calcResult && (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Computed Result</div>
                  <div className="text-xl font-mono font-bold text-cyan-300">{calcResult}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onInsertPrompt(`Solve this calculation step by step: ${calcInput}`);
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 text-xs font-semibold transition cursor-pointer"
                >
                  Ask JARVIS
                </button>
              </div>
            )}
          </form>
        )}

        {/* Tab 2: Universal Unit Converter */}
        {activeTab === 'converter' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Value
                </label>
                <input
                  type="number"
                  value={convertValue}
                  onChange={(e) => setConvertValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Conversion
                </label>
                <select
                  value={convertType}
                  onChange={(e) => setConvertType(e.target.value as typeof convertType)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="c_to_f">Celsius to Fahrenheit</option>
                  <option value="km_to_miles">Kilometers to Miles</option>
                  <option value="kg_to_lbs">Kilograms to Pounds</option>
                  <option value="gb_to_mb">Gigabytes to Megabytes</option>
                </select>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Converted Value</span>
              <span className="text-xl font-bold font-mono text-cyan-300">{getConvertedResult()}</span>
            </div>
          </div>
        )}

        {/* Tab 3: Prompt Enhancer */}
        {activeTab === 'prompts' && (
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Your Raw Idea or Question
              </label>
              <textarea
                value={rawPrompt}
                onChange={(e) => setRawPrompt(e.target.value)}
                rows={2}
                placeholder="e.g. write an essay on artificial intelligence"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 resize-none"
              />
              <button
                type="button"
                onClick={handleEnhancePrompt}
                className="mt-1.5 w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Supercharge Prompt</span>
              </button>
            </div>

            {enhancedPrompt && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 space-y-2">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  Enhanced Prompt Output
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-mono bg-slate-950 p-2 rounded border border-slate-800">
                  {enhancedPrompt}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(enhancedPrompt);
                      setCopiedEnhanced(true);
                      setTimeout(() => setCopiedEnhanced(false), 2000);
                    }}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    {copiedEnhanced ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedEnhanced ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onInsertPrompt(enhancedPrompt);
                      onClose();
                    }}
                    className="flex-1 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <span>Use in Chat</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Global Time Clocks */}
        {activeTab === 'time' && (
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-900 border border-cyan-500/30">
              <span className="text-[10px] text-cyan-400 uppercase font-mono font-bold">Lahore (PKT)</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <span className="text-[10px] text-slate-400">LGS Paragon Headquarters</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">London (GMT)</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                {new Date().toLocaleTimeString('en-US', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <span className="text-[10px] text-slate-400">UTC +00:00</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">New York (EST)</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                {new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <span className="text-[10px] text-slate-400">UTC -05:00</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">Tokyo (JST)</span>
              <div className="text-lg font-bold text-white font-mono mt-1">
                {new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <span className="text-[10px] text-slate-400">UTC +09:00</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
