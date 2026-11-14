import React, { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  Mic,
  MicOff,
  ArrowUp,
  X,
  FileText,
  Image as ImageIcon,
  Globe,
  Zap,
  ChevronDown,
  Camera,
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
  const [isListening, setIsListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<unknown>(null);
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

  // Voice Speech-to-Text Setup (Web Speech API)
  useEffect(() => {
    // Check if webkitSpeechRecognition or SpeechRecognition exists
    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: new () => unknown;
      webkitSpeechRecognition?: new () => unknown;
    };
    const SpeechRecognitionClass =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechRecognitionClass as any)();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = finalTranscriptRef.current;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();
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

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = recognitionRef.current as any;
    if (!recognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome/Edge.');
      return;
    }

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        dictationBaseRef.current = inputText.trim();
        finalTranscriptRef.current = '';
        recognition.start();
        setIsListening(true);
      } catch (err) {
        setIsListening(false);
        console.warn('Speech recognition start failed:', err);
      }
    }
  };

  // Handle file selection (up to 10 files)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const remainingSlots = 10 - attachments.length;
      if (remainingSlots <= 0) {
        alert('Maximum 10 files allowed per prompt.');
        return;
      }

      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      const newAttachments: Attachment[] = [];

      for (const file of filesToProcess) {
        if (file.size > 15 * 1024 * 1024) {
          alert(`File ${file.name} is larger than 15MB. Please choose a smaller file.`);
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
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          data: dataUrl,
        });
      }

      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not load the selected file.');
    } finally {
      input.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && attachments.length === 0) || isLoading) return;

    if (isListening && recognitionRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (recognitionRef.current as any).stop();
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
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
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

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask JARVIS anything, attach up to 10 images/files, or say 'Generate image of...'"
          rows={1}
          className="w-full bg-transparent resize-none text-xs md:text-sm text-slate-100 placeholder-slate-500 focus:outline-none px-1 py-1 max-h-48 leading-relaxed"
        />

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
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
              capture="environment"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach up to 10 images or documents"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              title="Take a photo and attach it"
              aria-label="Take a photo and attach it"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
            </button>

            {/* Voice Dictation (Mic) */}
            <button
              type="button"
              onClick={toggleListening}
              title={isListening ? 'Stop listening' : 'Dictate with Voice'}
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
