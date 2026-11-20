/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * JARVIS Live Full-Duplex Voice Conversation Studio (ChatGPT Voice Mode Experience)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Activity,
  X,
  Send,
  Volume2,
  Save,
  Sparkles,
} from 'lucide-react';
import { ArcReactorLogo } from './ArcReactorLogo';
import {
  ProfessionProfile,
  MemoryEntry,
  detectLiveNewsOrCurrentEventIntent,
  buildTemporalGroundingPrefix,
} from '../services/jarvisKnowledgeEngine';

export interface VoiceTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface LiveVoiceStudioProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfession: ProfessionProfile;
  memories: MemoryEntry[];
  selectedModel: string;
  dualEngineEnabled: boolean;
  onSaveTranscriptToChat?: (turns: VoiceTurn[]) => void;
}

export const LiveVoiceStudio: React.FC<LiveVoiceStudioProps> = ({
  isOpen,
  onClose,
  activeProfession,
  memories,
  selectedModel,
  dualEngineEnabled,
  onSaveTranscriptToChat,
}) => {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [typedFallback, setTypedFallback] = useState('');
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [autoLoop, setAutoLoop] = useState(true);
  const [speechRate, setSpeechRate] = useState(1.05);
  const [voiceLang, setVoiceLang] = useState('en-US');
  const [audioLevels, setAudioLevels] = useState<number[]>(() => Array(16).fill(14));

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isOpenRef = useRef(isOpen);
  const autoLoopRef = useRef(autoLoop);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    autoLoopRef.current = autoLoop;
  }, [autoLoop]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, interimTranscript]);

  // Stop Web Audio visualizer safely
  const stopAudioVisualizer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAudioLevels(Array(16).fill(14));
  }, []);

  // Start live microphone frequency spectrum visualizer
  const startAudioVisualizer = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateBars = () => {
        analyser.getByteFrequencyData(dataArray);
        const bars: number[] = [];
        for (let i = 0; i < 16; i++) {
          const val = dataArray[i] || 0;
          bars.push(Math.max(14, Math.min(100, Math.round((val / 255) * 100))));
        }
        setAudioLevels(bars);
        rafRef.current = requestAnimationFrame(updateBars);
      };

      updateBars();
    } catch {
      // Fallback silent visualizer if mic permissions are restricted
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore abort errors
      }
      recognitionRef.current = null;
    }
    setListening(false);
    stopAudioVisualizer();
  }, [stopAudioVisualizer]);

  const stopSpeechOutput = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speakReply = useCallback(
    (replyText: string, onFinished?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onFinished?.();
        return;
      }
      window.speechSynthesis.cancel();

      const cleanText = replyText
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/[*#`_>-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        onFinished?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = speechRate;
      utterance.pitch = 0.96;
      utterance.lang = voiceLang;

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find(
          (v) =>
            v.lang.startsWith(voiceLang.slice(0, 2)) &&
            (v.name.includes('Natural') ||
              v.name.includes('Google') ||
              v.name.includes('Daniel'))
        ) || voices.find((v) => v.lang.startsWith(voiceLang.slice(0, 2)));

      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        onFinished?.();
      };
      utterance.onerror = () => {
        setSpeaking(false);
        onFinished?.();
      };

      window.speechSynthesis.speak(utterance);
    },
    [speechRate, voiceLang]
  );

  const handleVoicePrompt = useCallback(
    async (spokenText: string) => {
      const trimmed = spokenText.trim();
      if (!trimmed) return;

      setThinking(true);
      setErrorMsg('');

      const userTurn: VoiceTurn = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'user',
        text: trimmed,
        timestamp: Date.now(),
      };
      setTurns((prev) => [...prev.slice(-18), userTurn]);

      try {
        const isLiveNews = detectLiveNewsOrCurrentEventIntent(trimmed);
        const grounding = buildTemporalGroundingPrefix(activeProfession, memories, isLiveNews);

        const payloadMessages = turns.slice(-8).map((t) => ({
          role: t.role,
          content: t.text,
        }));
        payloadMessages.push({
          role: 'user',
          content: `${grounding}\n[LIVE VOICE MODE: Respond clearly, naturally, and concisely as if speaking out loud in real time. Avoid raw markdown tables unless asked.]\n\nUser Spoken Message: ${trimmed}`,
        });

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: payloadMessages,
            webSearch: true,
            model: dualEngineEnabled ? 'jarvis-pro' : selectedModel,
            attachments: [],
          }),
        });

        const raw = await res.text();
        const parsed = raw ? (JSON.parse(raw) as { content?: string; error?: string }) : {};
        if (!res.ok) {
          throw new Error(parsed.error || `JARVIS Voice API error (${res.status})`);
        }

        const reply = parsed.content || 'Processed, sir.';
        const assistantTurn: VoiceTurn = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          text: reply,
          timestamp: Date.now(),
        };
        setTurns((prev) => [...prev.slice(-18), assistantTurn]);
        setThinking(false);

        speakReply(reply, () => {
          if (isOpenRef.current && autoLoopRef.current) {
            startListening();
          }
        });
      } catch (err) {
        setThinking(false);
        setErrorMsg(err instanceof Error ? err.message : 'Live voice processing failed.');
      }
    },
    [activeProfession, memories, turns, dualEngineEnabled, selectedModel, speakReply]
  );

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      setErrorMsg(
        'Speech Recognition is not supported in this browser. You can still type below to hear JARVIS speak back.'
      );
      return;
    }

    stopRecognition();
    stopSpeechOutput();

    const recognition = new SpeechRecCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = voiceLang;

    let finalBuffer = '';

    recognition.onstart = () => {
      setListening(true);
      setErrorMsg('');
      setInterimTranscript('');
      void startAudioVisualizer();
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalBuffer += piece + ' ';
        } else {
          interim += piece;
        }
      }
      setInterimTranscript((finalBuffer + interim).trim());
    };

    recognition.onerror = (event: { error?: string }) => {
      setListening(false);
      stopAudioVisualizer();
      if (event.error && event.error !== 'aborted' && event.error !== 'no-speech') {
        setErrorMsg(`Microphone notice: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setListening(false);
      stopAudioVisualizer();
      const captured = finalBuffer.trim();
      setInterimTranscript('');
      if (captured) {
        void handleVoicePrompt(captured);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setErrorMsg('Microphone permission required to start live voice.');
    }
  }, [voiceLang, stopRecognition, stopSpeechOutput, startAudioVisualizer, handleVoicePrompt]);

  useEffect(() => {
    if (isOpen) {
      const t = window.setTimeout(() => {
        startListening();
      }, 250);
      return () => window.clearTimeout(t);
    } else {
      stopRecognition();
      stopSpeechOutput();
      setThinking(false);
      setInterimTranscript('');
    }
  }, [isOpen, startListening, stopRecognition, stopSpeechOutput]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#040811]/95 backdrop-blur-xl flex flex-col justify-between p-4 md:p-6 text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono text-cyan-300">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            JARVIS LIVE VOICE • {activeProfession.shortName.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {turns.length > 0 && onSaveTranscriptToChat && (
            <button
              type="button"
              onClick={() => {
                onSaveTranscriptToChat(turns);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save to Chat</span>
            </button>
          )}

          <select
            value={voiceLang}
            onChange={(e) => setVoiceLang(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
            aria-label="Voice language"
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="ur-PK">Urdu (Pakistan)</option>
            <option value="hi-IN">Hindi (India)</option>
            <option value="ar-SA">Arabic</option>
            <option value="es-ES">Spanish</option>
            <option value="fr-FR">French</option>
            <option value="de-DE">German</option>
          </select>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300"
            aria-label="Close Live Voice Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Reactor + Live Frequency Bars + Transcript */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto text-center gap-5 my-3 overflow-y-auto">
        <div
          className={`relative w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 ${
            listening
              ? 'scale-105 shadow-[0_0_80px_rgba(34,211,238,0.55)] bg-cyan-500/15 border-2 border-cyan-400'
              : speaking
                ? 'scale-105 shadow-[0_0_80px_rgba(59,130,246,0.6)] bg-blue-500/20 border-2 border-blue-400'
                : thinking
                  ? 'animate-pulse bg-violet-500/15 border-2 border-violet-400'
                  : 'bg-slate-900/80 border border-slate-700'
          }`}
        >
          <ArcReactorLogo glow={listening || speaking || thinking} size="lg" />
        </div>

        {/* Real-Time Audio Frequency Spectrum Bars */}
        <div className="flex items-end justify-center gap-1 h-8">
          {audioLevels.map((lvl, idx) => (
            <span
              key={idx}
              style={{ height: `${listening ? lvl : speaking ? 24 + ((idx * 17) % 45) : 14}%` }}
              className={`w-1.5 rounded-full transition-all duration-100 ${
                listening
                  ? 'bg-cyan-400'
                  : speaking
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg md:text-xl font-semibold text-cyan-200 flex items-center justify-center gap-2">
            {thinking && <Sparkles className="w-5 h-5 text-violet-400 animate-spin" />}
            {speaking && <Volume2 className="w-5 h-5 text-blue-400 animate-pulse" />}
            <span>
              {listening
                ? 'Listening — Speak naturally...'
                : thinking
                  ? 'JARVIS is analyzing & checking live knowledge...'
                  : speaking
                    ? 'JARVIS is speaking...'
                    : 'Tap microphone or type below'}
            </span>
          </h2>

          {interimTranscript && (
            <p className="text-sm text-cyan-300 italic max-w-lg mx-auto">
              “{interimTranscript}”
            </p>
          )}

          {errorMsg && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 inline-block">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Live Transcript Feed */}
        {turns.length > 0 && (
          <div className="w-full max-h-44 overflow-y-auto bg-slate-900/75 border border-slate-800 rounded-xl p-3 text-left space-y-2">
            {turns.map((t) => (
              <div
                key={t.id}
                className={`text-xs leading-relaxed ${
                  t.role === 'user' ? 'text-cyan-300' : 'text-slate-200'
                }`}
              >
                <strong className="uppercase font-mono mr-1.5">
                  {t.role === 'user' ? 'You:' : 'JARVIS:'}
                </strong>
                <span>{t.text}</span>
              </div>
            ))}
            <div ref={feedEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Controls + Typed Voice Input Fallback */}
      <div className="max-w-xl w-full mx-auto flex flex-col items-center gap-3">
        <div className="w-full flex gap-2">
          <input
            type="text"
            value={typedFallback}
            onChange={(e) => setTypedFallback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && typedFallback.trim()) {
                const msg = typedFallback;
                setTypedFallback('');
                void handleVoicePrompt(msg);
              }
            }}
            placeholder="Or type a message for JARVIS to answer aloud..."
            className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
          />
          <button
            type="button"
            onClick={() => {
              if (!typedFallback.trim()) return;
              const msg = typedFallback;
              setTypedFallback('');
              void handleVoicePrompt(msg);
            }}
            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
            aria-label="Send voice text"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (listening) {
                stopRecognition();
              } else {
                startListening();
              }
            }}
            className={`p-4 rounded-full transition shadow-lg ${
              listening
                ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                : 'bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-cyan-500/40'
            }`}
            title={listening ? 'Pause Microphone' : 'Start Listening'}
          >
            {listening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>

          {speaking && (
            <button
              type="button"
              onClick={() => {
                stopSpeechOutput();
                if (autoLoop) startListening();
              }}
              className="px-4 py-2.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-medium hover:bg-amber-500/30"
            >
              Interrupt & Speak
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg"
            title="End Voice Session"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoLoop}
              onChange={(e) => setAutoLoop(e.target.checked)}
              className="accent-cyan-400"
            />
            <span>Auto-listen after reply</span>
          </label>
          <label className="flex items-center gap-1.5">
            <span>Voice Speed: {speechRate.toFixed(2)}x</span>
            <input
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="w-20 accent-cyan-400"
            />
          </label>
        </div>
      </div>
    </div>
  );
};
