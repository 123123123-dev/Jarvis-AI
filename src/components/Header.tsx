import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Volume2,
  VolumeX,
  ChevronDown,
  Zap,
  Sparkles,
  Palette,
  User,
  Check,
  Download,
  Wifi,
  WifiOff,
  Wand2,
} from 'lucide-react';
import { ArcReactorLogo } from './ArcReactorLogo';
import { AIModelId, UserProfile } from '../types';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface HeaderProps {
  onToggleSidebar: () => void;
  selectedModel: AIModelId;
  onSelectModel: (model: AIModelId) => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  user: UserProfile;
  onOpenAuth: () => void;
  isOnline: boolean;
  syncStatus: 'synced' | 'syncing' | 'offline' | 'guest';
  onOpenTools: () => void;
  onExport?: () => void;
  hasMessages?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleSidebar,
  selectedModel,
  onSelectModel,
  voiceEnabled,
  onToggleVoice,
  user,
  onOpenAuth,
  isOnline,
  syncStatus,
  onOpenTools,
  onExport,
  hasMessages = false,
}) => {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isInstallable, install } = usePWAInstall();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const models: Array<{
    id: AIModelId;
    title: string;
    badge: string;
    icon: React.ReactNode;
    desc: string;
  }> = [
    {
      id: 'gemini-3.8-flash',
      title: 'JARVIS Turbo (Vision & Speed)',
      badge: 'Fastest',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      desc: 'Multimodal vision, high speed, and real-time Google search grounding.',
    },
    {
      id: 'gemini-4-argon',
      title: 'JARVIS Ultra (Deep Reasoning & STEM)',
      badge: 'Reasoning',
      icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
      desc: 'Deep analytical thinking for complex math, coding, and scientific logic.',
    },
    {
      id: 'art-studio',
      title: 'JARVIS Art Studio (DALL-E 3 Style)',
      badge: 'Image Gen',
      icon: <Palette className="w-4 h-4 text-fuchsia-400" />,
      desc: 'High-fidelity visual art and digital paintings from text descriptions.',
    },
  ];

  const currentModelObj = models.find((m) => m.id === selectedModel) || models[0];

  return (
    <header className="h-14 border-b border-cyan-950/60 bg-[#060b13]/90 backdrop-blur-md px-3 md:px-5 flex items-center justify-between z-30 sticky top-0 select-none">
      {/* Left: Hamburger + Logo + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <ArcReactorLogo size="sm" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-wider text-slate-100 text-sm md:text-base font-mono">
                JARVIS AI
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold tracking-wider uppercase bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                PRO
              </span>
            </div>
            <span className="text-[10px] text-slate-400 hidden sm:inline-block leading-tight font-medium">
              Developed by Abdullah Waheed (LGS Paragon, Lahore)
            </span>
          </div>
        </div>
      </div>

      {/* Right Controls: Model Selector, Voice Toggle, PWA, User */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Model Selector Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/70 hover:border-cyan-500/50 text-xs md:text-sm text-slate-200 transition-colors shadow-sm cursor-pointer"
          >
            {currentModelObj.icon}
            <span className="font-medium truncate max-w-[140px] md:max-w-[210px]">
              {currentModelObj.title}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
          </button>

          {modelDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 md:w-80 rounded-xl bg-[#09101d] border border-cyan-500/30 shadow-2xl p-1.5 z-50 backdrop-blur-lg">
              <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                Select Intelligence Engine
              </div>
              <div className="mt-1 space-y-1">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelectModel(model.id);
                      setModelDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg flex items-start gap-2.5 transition-colors cursor-pointer ${
                      selectedModel === model.id
                        ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-200'
                        : 'hover:bg-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="mt-0.5">{model.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{model.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                          {model.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                        {model.desc}
                      </p>
                    </div>
                    {selectedModel === model.id && (
                      <Check className="w-4 h-4 text-cyan-400 shrink-0 mt-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Voice Toggle Button */}
        <button
          onClick={onToggleVoice}
          title={voiceEnabled ? 'Mute JARVIS Voice' : 'Enable JARVIS Voice Speech'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
            voiceEnabled
              ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]'
              : 'bg-slate-900/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
          }`}
        >
          {voiceEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="hidden sm:inline">Voice On</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Voice Off</span>
            </>
          )}
        </button>

        {/* AI Studio Multi-Tools Button */}
        <button
          onClick={onOpenTools}
          title="Open AI Studio Tools (Calculator, Converter, Prompt Enhancer, Clocks)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-cyan-500/30 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 text-xs font-medium transition-colors cursor-pointer"
        >
          <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Tools</span>
        </button>

        {/* Export Conversation Button (PDF / TXT / MD / JSON) */}
        {onExport && (
          <button
            onClick={onExport}
            title="Export conversation history locally as PDF or text file"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-rose-500/30 hover:border-rose-400 text-rose-300 hover:text-rose-200 text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}

        {/* In-App PWA Install Button (Chromium / Desktop) */}
        {isInstallable && (
          <button
            onClick={install}
            title="Install JARVIS AI as a Desktop / Mobile Web App"
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/50 hover:bg-cyan-900/60 text-cyan-300 text-xs font-medium transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
        )}

        {/* Sync / Offline Connectivity Status Pill */}
        <div
          title={
            !isOnline
              ? 'Offline mode: changes are cached locally'
              : syncStatus === 'syncing'
              ? 'Syncing with cloud...'
              : user.isGuest
              ? 'Guest Mode: Local memory store'
              : 'Cloud Sync: Active & synchronized'
          }
          className="hidden lg:flex items-center gap-1 px-2 py-1 rounded bg-slate-900/60 border border-slate-800 text-[11px]"
        >
          {!isOnline ? (
            <>
              <WifiOff className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400">Offline</span>
            </>
          ) : (
            <>
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-mono text-[10px]">
                {user.isGuest ? 'Guest' : 'Synced'}
              </span>
            </>
          )}
        </div>

        {/* Sign In / User Profile Button */}
        <button
          onClick={onOpenAuth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#060b13] font-semibold text-xs transition-colors shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
        >
          <User className="w-3.5 h-3.5" />
          <span>{user.isGuest ? 'Sign In' : user.name.split(' ')[0]}</span>
        </button>
      </div>
    </header>
  );
};
