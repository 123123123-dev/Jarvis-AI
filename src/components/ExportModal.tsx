import React from 'react';
import { X, Download, FileCode, FileText, Code2, FileDown } from 'lucide-react';
import { Conversation } from '../types';
import { exportConversationToFile } from '../services/storage';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  conversation,
}) => {
  if (!isOpen || !conversation) return null;

  const handleExport = (format: 'pdf' | 'text' | 'markdown' | 'json') => {
    exportConversationToFile(conversation, format);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#09101d] border border-cyan-500/40 p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Export Conversation</h3>
            <p className="text-xs text-slate-400 truncate max-w-[260px]">
              {conversation.title}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Save your complete interaction history locally as a printable **PDF document** or readable **Plain Text (.txt)** file:
        </p>

        {/* Primary 1-Click Quick Buttons for User's Target Formats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 text-xs font-bold transition shadow-lg cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-rose-400" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={() => handleExport('text')}
            className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/40 text-amber-200 text-xs font-bold transition shadow-lg cursor-pointer"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Download Text (.txt)</span>
          </button>
        </div>

        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          All Available Export Formats
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {/* PDF Option */}
          <button
            onClick={() => handleExport('pdf')}
            className="w-full p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-rose-500/50 text-left flex items-center gap-3 transition cursor-pointer group"
          >
            <div className="p-2 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-500/30">
              <FileDown className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-rose-300">
                  PDF Document (.pdf)
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-mono">
                  Recommended
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Formatted A4 document with Stark branding, timestamps & sources
              </div>
            </div>
          </button>

          {/* Plain Text (.txt) Option */}
          <button
            onClick={() => handleExport('text')}
            className="w-full p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left flex items-center gap-3 transition cursor-pointer group"
          >
            <div className="p-2 rounded-lg bg-amber-950/80 text-amber-400 border border-amber-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 group-hover:text-amber-300">
                  Plain Text File (.txt)
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 font-mono">
                  Universal
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Clean text transcript readable in Notepad, VS Code, or any text editor
              </div>
            </div>
          </button>

          {/* Markdown (.md) Option */}
          <button
            onClick={() => handleExport('markdown')}
            className="w-full p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-left flex items-center gap-3 transition cursor-pointer group"
          >
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
              <FileCode className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                Markdown (.md)
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Includes headings, code blocks, and source citations
              </div>
            </div>
          </button>

          {/* Structured JSON (.json) Option */}
          <button
            onClick={() => handleExport('json')}
            className="w-full p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 text-left flex items-center gap-3 transition cursor-pointer group"
          >
            <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
              <Code2 className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 group-hover:text-emerald-300">
                Structured JSON (.json)
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Complete data schema with timestamps & attachments
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
