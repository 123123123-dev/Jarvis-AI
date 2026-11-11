import React, { useState } from 'react';
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  Square,
  Globe,
  FileText,
  Download,
  Maximize2,
  X,
  Sparkles,
} from 'lucide-react';
import { Message, SourceCitation } from '../types';
import { ArcReactorLogo } from './ArcReactorLogo';

interface MessageItemProps {
  message: Message;
  onSpeak: (messageId: string, text: string) => void;
  isSpeaking: boolean;
  onSelectPrompt?: (prompt: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onSpeak,
  isSpeaking,
}) => {
  const [copied, setCopied] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const isUser = message.role === 'user';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReadAloudToggle = () => {
    onSpeak(message.id, message.content);
  };

  // Helper to convert sub/superscripts and clean chemical/math symbols
  const formatChemicalAndMath = (text: string): string => {
    return text
      .replace(/\$([A-Za-z0-9_{}\s\+\-\*\/\^\\=]+)\$/g, '$1')
      .replace(/_\{(\d+)\}/g, (_, n) => {
        const subs: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' };
        return n.split('').map((c: string) => subs[c] || c).join('');
      })
      .replace(/\^\{?(\d+)\}?/g, (_, n) => {
        const sups: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
        return n.split('').map((c: string) => sups[c] || c).join('');
      })
      .replace(/\\mathbf\{([^}]+)\}/g, '$1')
      .replace(/\\text\{([^}]+)\}/g, '$1');
  };

  // Helper to parse bold, italic, and inline code
  const parseInlineStyles = (text: string) => {
    const formatted = formatChemicalAndMath(text);
    const parts = formatted.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-bold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return (
          <em key={i} className="text-cyan-200/90 italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono text-[11px] border border-slate-700"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  // Comprehensive Markdown block & inline renderer
  const renderFormattedContent = (content: string) => {
    const rawLines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines: string[] = [];

    const flushCodeBlock = (key: number) => {
      if (codeBlockLines.length === 0) return;
      const codeText = codeBlockLines.join('\n');
      elements.push(
        <div
          key={`code-${key}`}
          className="my-3 rounded-xl overflow-hidden border border-cyan-500/30 bg-[#070d17] shadow-xl"
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-cyan-950/60 text-[11px] font-mono text-slate-400">
            <span className="uppercase tracking-wider text-cyan-400 font-semibold">
              {codeBlockLang || 'Code'}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(codeText);
              }}
              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>
          <pre className="p-3 overflow-x-auto font-mono text-xs text-cyan-100 leading-relaxed">
            <code>{codeText}</code>
          </pre>
        </div>
      );
      codeBlockLines = [];
    };

    for (let index = 0; index < rawLines.length; index++) {
      const line = rawLines[index];
      const trimmed = line.trim();

      // Multi-line code block start/end
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock(index);
          inCodeBlock = false;
          codeBlockLang = '';
        } else {
          inCodeBlock = true;
          codeBlockLang = trimmed.replace('```', '').trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Markdown image
      const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        const alt = imgMatch[1];
        const src = imgMatch[2];
        elements.push(
          <div
            key={index}
            className="my-3 rounded-xl overflow-hidden border border-cyan-500/30 group relative"
          >
            <img
              src={src}
              alt={alt}
              className="w-full max-h-96 object-contain bg-slate-950 cursor-pointer"
              onClick={() => setImageModalOpen(true)}
            />
            <div className="p-2 bg-slate-900 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium truncate">
                {alt || 'Generated Artwork'}
              </span>
              <a
                href={src}
                download={`jarvis-artwork-${Date.now()}.png`}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 text-xs"
              >
                <Download className="w-3 h-3" />
                <span>Download</span>
              </a>
            </div>
          </div>
        );
        continue;
      }

      // Horizontal rules
      if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
        elements.push(
          <hr key={index} className="border-t border-cyan-950/70 my-3" />
        );
        continue;
      }

      // Blockquotes
      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote
            key={index}
            className="border-l-2 border-cyan-400/60 bg-cyan-950/20 pl-3 pr-2 py-1.5 my-2 rounded-r text-slate-300 italic text-xs md:text-sm"
          >
            {parseInlineStyles(trimmed.substring(2))}
          </blockquote>
        );
        continue;
      }

      // Headers with inline markdown parsed
      if (trimmed.startsWith('#### ')) {
        elements.push(
          <h5 key={index} className="text-xs font-bold text-cyan-400 mt-2.5 mb-1 tracking-wide">
            {parseInlineStyles(trimmed.replace('#### ', ''))}
          </h5>
        );
        continue;
      }
      if (trimmed.startsWith('### ')) {
        elements.push(
          <h4 key={index} className="text-sm font-bold text-cyan-300 mt-3 mb-1 tracking-wide">
            {parseInlineStyles(trimmed.replace('### ', ''))}
          </h4>
        );
        continue;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(
          <h3 key={index} className="text-base font-bold text-cyan-200 mt-3.5 mb-1">
            {parseInlineStyles(trimmed.replace('## ', ''))}
          </h3>
        );
        continue;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(
          <h2
            key={index}
            className="text-lg font-extrabold text-white mt-4 mb-1 border-b border-cyan-950/80 pb-1"
          >
            {parseInlineStyles(trimmed.replace('# ', ''))}
          </h2>
        );
        continue;
      }

      // Unordered Lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <div key={index} className="flex items-start gap-2 pl-2 my-0.5">
            <span className="text-cyan-400 mt-1 shrink-0">•</span>
            <span className="flex-1">{parseInlineStyles(trimmed.substring(2))}</span>
          </div>
        );
        continue;
      }

      // Numbered Lists
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <div key={index} className="flex items-start gap-2 pl-2 my-0.5">
            <span className="text-cyan-400 font-mono font-bold shrink-0">{numMatch[1]}.</span>
            <span className="flex-1">{parseInlineStyles(numMatch[2])}</span>
          </div>
        );
        continue;
      }

      if (!trimmed) {
        elements.push(<div key={index} className="h-1.5" />);
        continue;
      }

      elements.push(<p key={index} className="my-1">{parseInlineStyles(line)}</p>);
    }

    if (inCodeBlock) {
      flushCodeBlock(rawLines.length);
    }

    return (
      <div className="space-y-1 text-xs md:text-sm leading-relaxed text-slate-200">
        {elements}
      </div>
    );
  };

  return (
    <div
      className={`py-3.5 px-3 md:px-6 transition-all duration-200 ${
        isUser
          ? 'bg-transparent'
          : isSpeaking
          ? 'bg-cyan-950/20 border-y border-cyan-500/40 shadow-[inset_0_0_20px_rgba(34,211,238,0.06)]'
          : 'bg-slate-900/30 border-y border-slate-800/40'
      }`}
    >
      <div className="max-w-4xl mx-auto flex gap-3 md:gap-4 items-start">
        {/* Avatar */}
        <div className="shrink-0 mt-0.5">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
              U
            </div>
          ) : (
            <div className="relative">
              <ArcReactorLogo size="sm" glow={true} />
              {isSpeaking && (
                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-[#060b13] animate-ping" />
              )}
            </div>
          )}
        </div>

        {/* Message Content Body */}
        <div className="flex-1 min-w-0">
          {/* Header row: Author + Timestamp + Top Actions */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-bold ${
                  isUser ? 'text-slate-300' : 'text-cyan-400 font-mono tracking-wide'
                }`}
              >
                {isUser ? 'You' : 'JARVIS AI'}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {!isUser && isSpeaking && (
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                  <Volume2 className="w-3 h-3" />
                  Speaking...
                </span>
              )}
            </div>

            {/* Quick Actions in Header */}
            {!isUser && (
              <div className="flex items-center gap-2">
                {/* Dedicated 'Read Aloud' button in header */}
                <button
                  type="button"
                  onClick={handleReadAloudToggle}
                  title={isSpeaking ? 'Stop speaking this response' : 'Read this response aloud with JARVIS voice'}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isSpeaking
                      ? 'bg-cyan-950 border border-cyan-500/70 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                      : 'bg-slate-800/80 hover:bg-cyan-950/70 text-slate-300 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/50'
                  }`}
                >
                  {isSpeaking ? (
                    <>
                      <Square className="w-3 h-3 text-cyan-400 fill-cyan-400 animate-pulse" />
                      <span className="font-semibold text-cyan-200">Stop Reading</span>
                      {/* Animated Sound Wave Equalizer */}
                      <span className="flex items-end gap-0.5 h-3 ml-0.5" aria-hidden="true">
                        <span className="w-0.5 h-3 bg-cyan-400 animate-pulse" />
                        <span className="w-0.5 h-2 bg-cyan-400 animate-pulse delay-75" />
                        <span className="w-0.5 h-3.5 bg-cyan-300 animate-pulse delay-150" />
                        <span className="w-0.5 h-1.5 bg-cyan-400 animate-pulse delay-100" />
                      </span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Read Aloud</span>
                    </>
                  )}
                </button>

                {/* Copy Button */}
                <button
                  type="button"
                  onClick={copyToClipboard}
                  title="Copy to clipboard"
                  className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* User Attachments Preview (if any) */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 my-2">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-800/90 border border-slate-700 text-xs"
                >
                  {att.type.startsWith('image/') ? (
                    <img
                      src={att.data}
                      alt={att.name}
                      className="w-7 h-7 object-cover rounded"
                    />
                  ) : (
                    <FileText className="w-5 h-5 text-amber-400" />
                  )}
                  <span className="text-[11px] text-slate-200 font-medium truncate max-w-[120px]">
                    {att.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Assistant Generated Image / Artwork */}
          {message.imageUrl && (
            <div className="my-3 rounded-xl overflow-hidden border border-cyan-500/40 bg-slate-950 max-w-lg shadow-xl">
              <div className="relative group">
                <img
                  src={message.imageUrl}
                  alt="JARVIS Generated Artwork"
                  className="w-full h-auto object-cover max-h-96"
                />
                <button
                  type="button"
                  onClick={() => setImageModalOpen(true)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-cyan-300 font-medium">
                  JARVIS AI Artwork
                </span>
                <a
                  href={message.imageUrl}
                  download="jarvis-artwork.png"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900 text-xs font-medium"
                >
                  <Download className="w-3 h-3" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          )}

          {/* Formatted Text Content */}
          {renderFormattedContent(message.content)}

          {/* Google Search Grounding Sources Cards */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 mb-2">
                <Globe className="w-3.5 h-3.5" />
                <span>Google Search Grounded Sources & Real-Time Knowledge</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {message.sources.map((source: SourceCitation, sIdx: number) => (
                  <a
                    key={sIdx}
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/40 transition group"
                  >
                    <Globe className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-slate-200 group-hover:text-cyan-300 truncate">
                        {source.title}
                      </div>
                      <div className="text-[9px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                        <span>{new URL(source.uri).hostname}</span>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Dedicated Assistant Message Action Footer */}
          {!isUser && (
            <div className="mt-3 pt-2.5 flex items-center justify-between border-t border-slate-800/50">
              <div className="flex items-center gap-2">
                {/* Secondary prominent Read Aloud action */}
                <button
                  type="button"
                  onClick={handleReadAloudToggle}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer ${
                    isSpeaking
                      ? 'bg-cyan-950/90 border border-cyan-500/80 text-cyan-200 shadow-[0_0_14px_rgba(34,211,238,0.3)]'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40'
                  }`}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Stop Voice</span>
                      <span className="flex items-end gap-0.5 h-2.5 ml-1" aria-hidden="true">
                        <span className="w-0.5 h-2.5 bg-cyan-400 animate-bounce" />
                        <span className="w-0.5 h-1.5 bg-cyan-400 animate-bounce delay-100" />
                        <span className="w-0.5 h-3 bg-cyan-300 animate-bounce delay-200" />
                      </span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Read Aloud</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                <Sparkles className="w-3 h-3 text-cyan-500/80" />
                <span>JARVIS Voice Core</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Image Modal */}
      {imageModalOpen && message.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md"
          onClick={() => setImageModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setImageModalOpen(false)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={message.imageUrl}
              alt="Artwork preview"
              className="max-h-[80vh] w-auto rounded-lg shadow-2xl object-contain border border-cyan-500/40"
            />
            <div className="mt-3 flex gap-3">
              <a
                href={message.imageUrl}
                download="jarvis-artwork-hd.png"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Save High-Resolution Artwork</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
