import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paperclip,
  Mic,
  MicOff,
  ArrowUp,
  X,
  FileText,
  Globe,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { Attachment } from '../types';

interface PromptBarProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  webSearchEnabled: boolean;
  onToggleWebSearch: () => void;
  dualEngineEnabled: boolean;
  onToggleDualEngine: () => void;
  showScrollBottom: boolean;
  onScrollToBottom: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: SpeechRecognitionAlternativeLike;
  readonly length: number;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}

function getAttachmentType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  const knownTypes: Record<string, string> = {
    pdf: 'application/pdf',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    js: 'text/javascript',
    ts: 'text/plain',
    py: 'text/x-python',
    md: 'text/markdown',
  };
  return knownTypes[extension || ''] || 'application/octet-stream';
}

export const PromptBar: React.FC<PromptBarProps> = ({
  onSendMessage,
  isLoading,
  webSearchEnabled,
  onToggleWebSearch,
  dualEngineEnabled,
  onToggleDualEngine,
  showScrollBottom,
  onScrollToBottom,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [inputError, setInputError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const dictationBaseRef = useRef('');
  const finalTranscriptRef = useRef('');

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [inputText]);

  useEffect(() => {
    const windowWithSpeech = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = finalTranscriptRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript.trim();
        if (!transcript) continue;
        if (event.results[i].isFinal) {
          finalTranscript = [finalTranscript, transcript].filter(Boolean).join(' ');
        } else {
          interimTranscript = [interimTranscript, transcript].filter(Boolean).join(' ');
        }
      }
      finalTranscriptRef.current = finalTranscript;
      setInputText(
        [dictationBaseRef.current, finalTranscript, interimTranscript]
          .filter(Boolean)
          .join(' ')
      );
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const errorMessages: Record<string, string> = {
        'not-allowed': 'Allow microphone access in your browser settings, then try voice input again.',
        'service-not-allowed': 'Your browser or device has blocked speech recognition.',
        'audio-capture': 'No microphone was found. Connect a microphone and try again.',
        network: 'Speech recognition could not connect. Check your internet connection and try again.',
        'no-speech': 'No speech was detected. Try again and speak closer to the microphone.',
      };
      setInputError(errorMessages[event.error] || 'Voice input failed. Check microphone permissions and try again.');
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setInputError('Voice input is not supported in this browser. Try the latest Chrome or Edge over HTTPS.');
      return;
    }

    if (!window.isSecureContext) {
      setInputError('Voice input requires a secure HTTPS connection.');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        setInputError('');
        dictationBaseRef.current = inputText.trim();
        finalTranscriptRef.current = '';
        textareaRef.current?.focus();
        recognition.start();
        setIsListening(true);
      } catch (error) {
        setIsListening(false);
        console.error('Speech recognition failed to start:', error);
        setInputError('Could not start voice input. Check microphone permission and try again.');
      }
    }
  };

  const addFiles = useCallback(async (selectedFiles: File[]) => {
    if (!selectedFiles.length) return;
    setInputError('');

    try {
      const remainingSlots = 10 - attachments.length;
      if (remainingSlots <= 0) {
        setInputError('You can attach up to 10 files per message.');
        return;
      }

      const filesToProcess = selectedFiles.slice(0, remainingSlots);
      if (selectedFiles.length > remainingSlots) {
        setInputError(`Only ${remainingSlots} more file${remainingSlots === 1 ? '' : 's'} can be attached.`);
      }
      const newAttachments: Attachment[] = [];

      for (const file of filesToProcess) {
        if (file.size > 15 * 1024 * 1024) {
          setInputError(`${file.name || 'A selected file'} is larger than 15 MB. Choose a smaller file.`);
          continue;
        }

        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else reject(new Error(`Could not read ${file.name}.`));
          };
          reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
          reader.readAsDataURL(file);
        });

        newAttachments.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name || `pasted-image-${Date.now()}.png`,
          type: getAttachmentType(file),
          size: file.size,
          data: dataUrl,
        });
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (error) {
      console.error('Unable to read selected attachment:', error);
      setInputError(error instanceof Error ? error.message : 'Could not load the selected file.');
    }
  }, [attachments.length]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    await addFiles(Array.from(input.files || []));
    input.value = '';
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (!imageFiles.length) return;
    event.preventDefault();
    void addFiles(imageFiles);
  };

  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented || !event.clipboardData) return;
      const imageFiles = Array.from(event.clipboardData.items)
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      if (!imageFiles.length) return;
      event.preventDefault();
      void addFiles(imageFiles);
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [addFiles]);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    onSendMessage(inputText.trim(), attachments);
    setInputText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-3 md:px-6 pb-3 pt-1 select-none">
      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={onScrollToBottom}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-cyan-500/50 shadow-lg text-cyan-300 hover:bg-slate-800 transition cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Prompt Input Box */}
      <div className="relative rounded-2xl bg-[#09101d] border border-cyan-950/80 hover:border-cyan-500/40 focus-within:border-cyan-500/70 transition-colors shadow-2xl p-2.5 md:p-3">
        {/* Attachment chips row */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 p-1 border-b border-slate-800/80">
            {attachments.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-cyan-500/30 text-xs text-slate-200"
              >
                {file.type.startsWith('image/') ? (
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(file)}
                    title={`Preview ${file.name}`}
                    className="shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <img src={file.data} alt="" className="h-7 w-7 rounded object-cover" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(file)}
                    title={`Preview ${file.name}`}
                    className="shrink-0 rounded p-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  >
                    <FileText className="w-4 h-4 text-amber-400" />
                  </button>
                )}
                <span className="truncate max-w-[130px] font-medium text-[11px]">
                  {file.name}
                </span>
                <span className="text-[9px] text-slate-400">
                  ({(file.size / 1024).toFixed(0)}KB)
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(file.id)}
                  className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <span className="text-[10px] text-slate-500 self-center">
              {attachments.length}/10 files
            </span>
          </div>
        )}

        {previewAttachment && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 md:p-6"
            onClick={() => setPreviewAttachment(null)}
          >
            <div
              className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-cyan-500/40 bg-[#09101d]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
                <span className="truncate text-sm text-slate-200">{previewAttachment.name}</span>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  aria-label="Close attachment preview"
                  className="rounded p-1 text-slate-300 hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center bg-black/40 p-3">
                {previewAttachment.type.startsWith('image/') ? (
                  <img
                    src={previewAttachment.data}
                    alt={previewAttachment.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : previewAttachment.type === 'application/pdf' ? (
                  <iframe
                    src={previewAttachment.data}
                    title={previewAttachment.name}
                    className="h-full w-full rounded bg-white"
                  />
                ) : previewAttachment.type.startsWith('text/') ||
                  previewAttachment.type === 'application/json' ||
                  previewAttachment.type === 'application/csv' ? (
                  <iframe
                    src={previewAttachment.data}
                    title={previewAttachment.name}
                    className="h-full w-full rounded bg-white"
                  />
                ) : (
                  <div className="text-center text-sm text-slate-300">
                    This file type can be downloaded, but cannot be previewed in the browser.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            setInputError('');
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          placeholder="Ask JARVIS, paste a screenshot with Ctrl+V, or attach images and files"
          rows={1}
          className="w-full bg-transparent resize-none text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-1 py-1 max-h-48 leading-relaxed"
        />
        {inputError && (
          <p role="status" className="px-1 pb-2 text-[11px] leading-relaxed text-rose-300">
            {inputError}
          </p>
        )}

        {/* Bottom Toolbar inside the box */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 mt-1">
          {/* Left tools: Attachment, Mic, Web Grounding toggle, Dual Engine toggle */}
          <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
            {/* Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              accept="image/*,.pdf,.txt,.csv,.json,.js,.ts,.py,.md"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach up to 10 images or documents"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Voice Dictation (Mic) */}
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Stop listening' : 'Dictate with Voice'}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isListening
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse'
                  : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80'
              }`}
            >
              {isListening ? (
                <MicOff className="w-4 h-4 text-rose-400" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Live Web Knowledge Grounded Toggle Badge */}
            <button
              type="button"
              onClick={onToggleWebSearch}
              title="Toggle Google Search Real-Time Knowledge Grounding"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] md:text-[11px] font-medium border transition-colors cursor-pointer ${
                webSearchEnabled
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
            >
              <Globe className={`w-3 h-3 ${webSearchEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span className="font-semibold">Live Web Knowledge</span>
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  webSearchEnabled ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                }`}
              />
            </button>

            {/* Dual Engine Pro Badge */}
            <button
              type="button"
              onClick={onToggleDualEngine}
              title="Toggle Dual Engine Pro deep reasoning"
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] md:text-[11px] font-medium border transition-colors cursor-pointer ${
                dualEngineEnabled
                  ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400'
              }`}
            >
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>Dual Engine Pro</span>
            </button>
          </div>

          {/* Right: Circular Send Button */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={(!inputText.trim() && attachments.length === 0) || isLoading}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              (inputText.trim() || attachments.length > 0) && !isLoading
                ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.5)] scale-100'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed scale-95'
            }`}
          >
            <ArrowUp className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Footer Subtext */}
      <div className="text-center text-[10px] text-slate-400 mt-2 select-none">
        JARVIS AI Assistant
      </div>
    </div>
  );
};
