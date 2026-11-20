/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { WelcomeHero } from './components/WelcomeHero';
import { MessageItem } from './components/MessageItem';
import { PromptBar } from './components/PromptBar';
import { AuthModal } from './components/AuthModal';
import { ShareModal } from './components/ShareModal';
import { ExportModal } from './components/ExportModal';
import { ToolsModal } from './components/ToolsModal';
import { ArcReactorLogo } from './components/ArcReactorLogo';
import { LiveVoiceStudio, VoiceTurn } from './components/LiveVoiceStudio';
import {
  Attachment,
  Conversation,
  Message,
  UserProfile,
  AIModelId,
  AppSettings,
} from './types';
import {
  defaultUser,
  loadSettings,
  saveSettings,
  ACCOUNT_SESSION_TOKEN_KEY,
  getAccountAuthHeaders,
  getDirectSignInTokenFromUrl,
  getDirectSignInUrl,
  isConversationArchive,
} from './services/storage';
import { isImageGenerationPrompt } from './services/imagePrompts';
import { getWeatherRequest } from './services/weather';
import {
  ProfessionId,
  PROFESSION_PROFILES,
  ENGINEERING_MATERIALS_DB,
  CLINICAL_LAB_REFERENCES,
  MemoryEntry,
  detectLiveNewsOrCurrentEventIntent,
  buildTemporalGroundingPrefix,
  evaluateSafeMathExpression,
} from './services/jarvisKnowledgeEngine';
import {
  WifiOff,
  Sparkles,
  Link,
  Radio,
  Newspaper,
  Stethoscope,
  Cpu,
  Briefcase,
  Palette,
  Image as ImageIcon,
  Calculator,
  Brain,
  Monitor,
  Command,
  X,
  ChevronRight,
  Clock,
  ShieldAlert,
  Layers,
  Download,
  Trash2,
  Search,
  RefreshCw,
  Wrench,
} from 'lucide-react';

interface GeneratedArtItem {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  imageUrl: string;
  createdAt: number;
}

const JARVIS_MEMORY_STORAGE_KEY = 'jarvis_neural_memory_v1';
const JARVIS_GALLERY_STORAGE_KEY = 'jarvis_art_gallery_v1';
const JARVIS_PROFESSION_STORAGE_KEY = 'jarvis_active_profession_v1';

const NEWS_CATEGORIES = [
  {
    id: 'breaking',
    label: 'Top World & Breaking News',
    prompt:
      'Search the live web and give me a comprehensive, well-structured briefing of the biggest breaking world news and major headlines happening right now today.',
  },
  {
    id: 'ai-tech',
    label: 'AI, Robotics & Tech',
    prompt:
      'Search the live web for today’s latest artificial intelligence, robotics, semiconductor, and major tech industry news and breakthroughs.',
  },
  {
    id: 'markets',
    label: 'Global Markets & Economy',
    prompt:
      'Search the live web for today’s stock market movements, macroeconomic news, central bank updates, and major business headlines.',
  },
  {
    id: 'science-space',
    label: 'Science, Space & Energy',
    prompt:
      'Search the live web for the latest scientific discoveries, space exploration missions, and clean energy breakthroughs happening now.',
  },
  {
    id: 'medical-news',
    label: 'Medicine & Biotech Updates',
    prompt:
      'Search the live web for the latest medical research breakthroughs, clinical trial milestones, and global public health news today.',
  },
  {
    id: 'sports',
    label: 'Live Sports & Tournaments',
    prompt:
      'Search the live web for today’s major sports scores, ongoing tournaments, and top athletic headlines worldwide.',
  },
];

const IMAGE_STYLE_PRESETS = [
  {
    id: 'cinematic',
    label: 'Cinematic Photoreal 8K',
    suffix:
      'photorealistic, 8k ultra-detailed, dramatic volumetric lighting, shot on 35mm lens, shallow depth of field, masterwork photography',
  },
  {
    id: 'blueprint',
    label: 'JARVIS Holographic Blueprint',
    suffix:
      'futuristic cyan and gold holographic CAD schematic blueprint on dark obsidian background, crisp technical vector lines, aerospace engineering HUD',
  },
  {
    id: 'medical-3d',
    label: '3D Medical Illustration',
    suffix:
      'high-precision 3D anatomical and cellular scientific visualization, studio subsurface scattering, clean medical textbook render, ultra sharp',
  },
  {
    id: 'concept-art',
    label: 'Sci-Fi Concept Art',
    suffix:
      'epic futuristic concept art, atmospheric perspective, intricate mechanical detail, matte painting, Unreal Engine 5 cinematic render',
  },
  {
    id: 'architecture',
    label: 'Architectural Render',
    suffix:
      'modern luxury architectural visualization, golden hour natural sunlight, glass and concrete textures, V-Ray photorealistic exterior render',
  },
  {
    id: 'anime',
    label: 'Studio Anime Illustration',
    suffix:
      'high-budget theatrical anime key visual, vibrant lighting, expressive linework, Makoto Shinkai inspired sky and reflections',
  },
  {
    id: 'logo',
    label: 'Minimalist Vector Emblem',
    suffix:
      'clean minimalist geometric vector logo design, centered emblem, crisp edges, modern brand identity on solid dark background',
  },
  {
    id: 'oil-painting',
    label: 'Classical Fine Art',
    suffix:
      'museum-quality classical oil painting on canvas, rich chiaroscuro lighting, visible expressive brushwork, timeless composition',
  },
];

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const rawText = await response.text();
  const trimmed = rawText.trim();

  if (!trimmed) {
    if (!response.ok) throw new Error(fallbackMessage);
    return {} as T;
  }

  const contentType = response.headers.get('content-type') || '';
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (!response.ok) {
    try {
      const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
      const errorMessage =
        typeof parsed?.error === 'string'
          ? parsed.error
          : typeof parsed?.message === 'string'
            ? parsed.message
            : '';
      if (errorMessage) throw new Error(errorMessage);
    } catch (error) {
      if (error instanceof Error && error.message && !error.message.includes('Unexpected token')) {
        throw error;
      }
    }

    const preview = trimmed.replace(/\s+/g, ' ').slice(0, 220);
    throw new Error(preview || fallbackMessage);
  }

  if (!contentType.includes('application/json') && !looksLikeJson) {
    const preview = trimmed.replace(/\s+/g, ' ').slice(0, 220);
    throw new Error(preview || fallbackMessage);
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.replace(/\s+/g, ' ').slice(0, 220);
    throw new Error(preview || fallbackMessage);
  }
}

async function createDirectSignInUrl(): Promise<string> {
  const response = await fetch('/api/auth/direct-link', {
    method: 'POST',
    headers: getAccountAuthHeaders(),
  });
  if (!response.ok) throw new Error('Could not create a direct sign-in link.');
  const data = await readJsonResponse<{ token?: string }>(
    response,
    'The server returned an invalid sign-in link.'
  );
  if (!data.token) throw new Error('The server returned an invalid sign-in link.');
  return getDirectSignInUrl(data.token);
}

async function revokeAccountSession(): Promise<void> {
  if (!sessionStorage.getItem(ACCOUNT_SESSION_TOKEN_KEY)) return;
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAccountAuthHeaders(),
    });
    if (!response.ok) throw new Error('Could not revoke the temporary account session.');
  } catch (error) {
    console.error('Unable to revoke account session:', error);
  } finally {
    sessionStorage.removeItem(ACCOUNT_SESSION_TOKEN_KEY);
  }
}

export default function App() {
  // Persistence state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [directSignInUrl, setDirectSignInUrl] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState('');

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 768
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [aiConfigured, setAiConfigured] = useState(false);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);

  // Expanded JARVIS Modular Capability States
  const [activeProfessionId, setActiveProfessionId] = useState<ProfessionId>(() => {
    try {
      const saved = localStorage.getItem(JARVIS_PROFESSION_STORAGE_KEY) as ProfessionId | null;
      if (saved && PROFESSION_PROFILES.some((p) => p.id === saved)) return saved;
    } catch {
      // Ignore storage errors
    }
    return 'general';
  });

  const [memories, setMemories] = useState<MemoryEntry[]>(() => {
    try {
      const raw = localStorage.getItem(JARVIS_MEMORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [artGallery, setArtGallery] = useState<GeneratedArtItem[]>(() => {
    try {
      const raw = localStorage.getItem(JARVIS_GALLERY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Studio & Overlay Modals
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [professionsModalOpen, setProfessionsModalOpen] = useState(false);
  const [imageStudioOpen, setImageStudioOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  // Live Clock Telemetry
  const [liveClock, setLiveClock] = useState(() => new Date());

  // Image Studio State
  const [studioPrompt, setStudioPrompt] = useState('');
  const [studioStyle, setStudioStyle] = useState(IMAGE_STYLE_PRESETS[0].id);
  const [studioAspectRatio, setStudioAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [studioError, setStudioError] = useState('');

  // Engineering & Medical Workbench State
  const [workbenchTab, setWorkbenchTab] = useState<
    'calc' | 'ohms' | 'units' | 'materials' | 'clinical' | 'labs'
  >('calc');
  const [calcInput, setCalcInput] = useState('sqrt(144) + (25 * 4) / 2');
  const [calcResult, setCalcResult] = useState<string>('62');
  const [calcError, setCalcError] = useState<string>('');
  const [ohmsVoltage, setOhmsVoltage] = useState('12');
  const [ohmsResistance, setOhmsResistance] = useState('470');
  const [unitCategory, setUnitCategory] = useState<'length' | 'pressure' | 'energy' | 'temp'>(
    'pressure'
  );
  const [unitValue, setUnitValue] = useState('101325');
  const [clinicalWeightKg, setClinicalWeightKg] = useState('72');
  const [clinicalHeightCm, setClinicalHeightCm] = useState('176');
  const [clinicalAge, setClinicalAge] = useState('30');

  // Memory & Profession Filter Inputs
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryEntry['category']>('Profession');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [professionSearch, setProfessionSearch] = useState('');

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const accountSaveQueue = useRef(Promise.resolve());

  // Persist profession, memory, and art gallery
  useEffect(() => {
    try {
      localStorage.setItem(JARVIS_PROFESSION_STORAGE_KEY, activeProfessionId);
    } catch {
      // Ignore storage errors
    }
  }, [activeProfessionId]);

  useEffect(() => {
    try {
      localStorage.setItem(JARVIS_MEMORY_STORAGE_KEY, JSON.stringify(memories));
    } catch {
      // Ignore storage errors
    }
  }, [memories]);

  useEffect(() => {
    try {
      localStorage.setItem(JARVIS_GALLERY_STORAGE_KEY, JSON.stringify(artGallery.slice(0, 24)));
    } catch {
      // Ignore storage errors
    }
  }, [artGallery]);

  // Live 1-second clock update for real-time HUD
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveClock(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Active conversation & active profession
  const activeConversation =
    conversations.find((c) => c.id === activeChatId) || null;
  const isWelcomeScreen = !activeConversation || activeConversation.messages.length === 0;

  const activeProfession = useMemo(
    () =>
      PROFESSION_PROFILES.find((p) => p.id === activeProfessionId) ||
      PROFESSION_PROFILES[0],
    [activeProfessionId]
  );

  // Portable archive restore
  useEffect(() => {
    const nonce = new URLSearchParams(window.location.hash.slice(1)).get('portable-import');
    const archiveWindow = window.parent !== window ? window.parent : window.opener;
    if (!nonce || !archiveWindow) return;

    const handlePortableRestore = (event: MessageEvent) => {
      if (
        event.source !== archiveWindow ||
        (event.origin !== 'null' && event.origin !== window.location.origin) ||
        !event.data ||
        event.data.type !== 'jarvis-restore-conversation' ||
        event.data.nonce !== nonce
      ) {
        return;
      }

      if (!isConversationArchive(event.data.conversation)) {
        setAccountNotice('This conversation archive is invalid and could not be opened.');
        return;
      }

      setConversations([event.data.conversation]);
      setActiveChatId(event.data.conversation.id);
      setUser(defaultUser);
      setDirectSignInUrl(null);
      setAccountNotice(
        'Conversation imported in a signed-out guest session. Guest chats are not saved after you close or refresh the app.'
      );
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
      archiveWindow.postMessage({ type: 'jarvis-portable-restored', nonce }, '*');
      window.removeEventListener('message', handlePortableRestore);
    };

    window.addEventListener('message', handlePortableRestore);
    archiveWindow.postMessage({ type: 'jarvis-portable-ready', nonce }, '*');
    return () => window.removeEventListener('message', handlePortableRestore);
  }, []);

  // Redeem a reusable account link; ordinary tabs still start as guests.
  useEffect(() => {
    const linkToken = getDirectSignInTokenFromUrl();
    if (!linkToken) return;

    let active = true;
    const redeemLink = async () => {
      try {
        const redemption = await fetch('/api/auth/redeem-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: linkToken }),
        });
        if (!redemption.ok) throw new Error('This sign-in link is invalid, expired, or already used.');
        const { user: account, token } = await readJsonResponse<{ user: UserProfile; token: string }>(
          redemption,
          'The sign-in link response was incomplete.'
        );
        sessionStorage.setItem(ACCOUNT_SESSION_TOKEN_KEY, token);

        const response = await fetch('/api/conversations', {
          headers: getAccountAuthHeaders(),
        });
        if (!response.ok) throw new Error('Could not load the account conversations.');
        const data = await readJsonResponse<{ conversations: Conversation[] }>(
          response,
          'The server returned an invalid conversation list.'
        );
        if (!active) return;

        setConversations(data.conversations);
        setActiveChatId(null);
        setUser(account);
        setDirectSignInUrl(getDirectSignInUrl(linkToken));
        window.history.replaceState({}, '', '/');
      } catch (error) {
        await revokeAccountSession();
        if (!active) return;
        console.error('Unable to redeem direct sign-in link:', error);
        setAccountNotice(error instanceof Error ? error.message : 'Unable to open this sign-in link.');
        window.history.replaceState({}, '', '/');
      }
    };

    void redeemLink();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then((response) =>
        readJsonResponse<{ aiConfigured?: boolean }>(response, 'The health check response was invalid.')
      )
      .then((health) => {
        if (active) setAiConfigured(Boolean(health.aiConfigured));
      })
      .catch(() => {
        if (active) setAiConfigured(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Only authenticated conversations are persisted.
  useEffect(() => {
    if (user.isGuest) return;

    accountSaveQueue.current = accountSaveQueue.current
      .then(async () => {
        const response = await fetch('/api/conversations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAccountAuthHeaders() },
          body: JSON.stringify({ conversations }),
        });
        if (!response.ok) throw new Error('Account conversation save failed.');
      })
      .catch((error) => console.error('Unable to save account conversations:', error));
  }, [conversations, user]);

  // Save settings
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const handleAuthenticated = async (account: UserProfile, token: string) => {
    sessionStorage.setItem(ACCOUNT_SESSION_TOKEN_KEY, token);
    try {
      const response = await fetch('/api/conversations', {
        headers: getAccountAuthHeaders(),
      });
      if (!response.ok) throw new Error('Signed in, but account conversations could not be loaded.');
      const { conversations: accountConversations } = await readJsonResponse<{
        conversations: Conversation[];
      }>(response, 'The account conversations response was invalid.');
      const nextDirectSignInUrl = await createDirectSignInUrl();
      setConversations(accountConversations);
      setActiveChatId(null);
      setUser(account);
      setDirectSignInUrl(nextDirectSignInUrl);
      setAccountNotice('');
      window.history.replaceState({}, '', '/');
    } catch (error) {
      await revokeAccountSession();
      throw error;
    }
  };

  const handleSignOut = async () => {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAccountAuthHeaders(),
    });
    if (!response.ok) throw new Error('Sign out failed. Please try again.');
    sessionStorage.removeItem(ACCOUNT_SESSION_TOKEN_KEY);
    setConversations([]);
    setActiveChatId(null);
    setUser(defaultUser);
    setDirectSignInUrl(null);
    window.history.replaceState({}, '', '/');
  };

  const handleCopyDirectSignInUrl = async () => {
    if (!directSignInUrl) return;
    try {
      await navigator.clipboard.writeText(directSignInUrl);
      setAccountNotice('Reusable account link copied. It stays active until sign-out or your next sign-in.');
    } catch (error) {
      console.error('Unable to copy direct sign-in link:', error);
      setAccountNotice('Could not copy the sign-in link. Check clipboard permissions and try again.');
    }
  };

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard shortcuts: Ctrl+K (New Chat), Ctrl+P (Command Palette), Escape (Close Overlays)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setNewsModalOpen(false);
        setProfessionsModalOpen(false);
        setImageStudioOpen(false);
        setWorkbenchOpen(false);
        setMemoryModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  // Scroll detection for floating scroll-to-bottom button
  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      chatScrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 160;
    setShowScrollBottom(isUp);
  };

  // Create new conversation
  const handleNewChat = () => {
    stopSpeaking();
    setActiveChatId(null);
  };

  // Select existing conversation
  const handleSelectChat = (id: string) => {
    stopSpeaking();
    setActiveChatId(id);
  };

  // Delete conversation
  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  // Clear all conversations
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all conversation history?')) {
      stopSpeaking();
      setConversations([]);
      setActiveChatId(null);
    }
  };

  // Pin / unpin conversation
  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  // Voice speech synthesis for specific message
  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    }
  };

  const handleToggleSpeakMessage = (messageId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    const cleanText = text
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/[*#`_>-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const jarvisVoice =
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Daniel') ||
            v.name.includes('Male'))
      ) || voices.find((v) => v.lang.startsWith('en'));

    if (jarvisVoice) {
      utterance.voice = jarvisVoice;
    }

    utterance.onstart = () => setSpeakingMessageId(messageId);
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    activeUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Save Live Voice Studio transcript into active or new chat thread
  const handleSaveVoiceTranscriptToChat = (turns: VoiceTurn[]) => {
    if (turns.length === 0) return;
    const importedMessages: Message[] = turns.map((turn) => ({
      id: turn.id,
      role: turn.role,
      content: turn.text,
      timestamp: turn.timestamp,
    }));

    if (activeChatId) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                updatedAt: Date.now(),
                messages: [...c.messages, ...importedMessages],
              }
            : c
        )
      );
    } else {
      const firstUser = turns.find((t) => t.role === 'user');
      const newConv: Conversation = {
        id: Math.random().toString(36).substring(2, 9),
        title: firstUser
          ? `Voice: ${firstUser.text.slice(0, 28)}...`
          : 'Live Voice Conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: importedMessages,
      };
      setConversations((prev) => [newConv, ...prev]);
      setActiveChatId(newConv.id);
    }
  };

  // Send message with Temporal, Profession & Memory Grounding
  const handleSendMessage = async (
    text: string,
    attachments: Attachment[] = []
  ) => {
    if (!text.trim() && attachments.length === 0) return;

    const hasImageReference = attachments.some((attachment) =>
      attachment.type.startsWith('image/')
    );
    const isImageReq =
      settings.selectedModel === 'jarvis-art' ||
      isImageGenerationPrompt(text) ||
      (hasImageReference &&
        /\b(?:edit|change|remove|replace|restyle|redraw|transform|turn|add|put|place|dress|make\s+(?:it|this|the image|him|her|them)|convert)\b/i.test(
          text
        ));
    const weatherRequest = getWeatherRequest(text);
    const isLiveNewsReq = detectLiveNewsOrCurrentEventIntent(text);

    if (isLiveNewsReq && !settings.webSearchEnabled) {
      setSettings((prev) => ({ ...prev, webSearchEnabled: true }));
    }

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    let currentConvId = activeChatId;
    let updatedConversations = [...conversations];

    if (!currentConvId) {
      const title =
        text.trim().slice(0, 36) + (text.length > 36 ? '...' : '') ||
        'Vision & File Analysis';
      const newConv: Conversation = {
        id: Math.random().toString(36).substring(2, 9),
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [userMessage],
      };
      updatedConversations = [newConv, ...conversations];
      currentConvId = newConv.id;
      setActiveChatId(currentConvId);
      setConversations(updatedConversations);
    } else {
      updatedConversations = updatedConversations.map((c) => {
        if (c.id === currentConvId) {
          return {
            ...c,
            updatedAt: Date.now(),
            messages: [...c.messages, userMessage],
          };
        }
        return c;
      });
      setConversations(updatedConversations);
    }

    setIsLoading(true);

    try {
      const activeMessages =
        updatedConversations.find((c) => c.id === currentConvId)?.messages || [
          userMessage,
        ];

      const groundingPrefix = buildTemporalGroundingPrefix(
        activeProfession,
        memories,
        isLiveNewsReq
      );

      const enrichedMessages = activeMessages.map((m, index) => {
        const isLastUserTurn = index === activeMessages.length - 1 && m.role === 'user';
        return {
          role: m.role,
          content: isLastUserTurn ? `${groundingPrefix}\n\nUser Query:\n${m.content}` : m.content,
        };
      });

      let endpoint = '/api/chat';
      let body: Record<string, unknown> = {
        messages: enrichedMessages,
        webSearch: settings.webSearchEnabled || isLiveNewsReq,
        model: settings.dualEngineEnabled ? 'jarvis-pro' : settings.selectedModel,
        attachments: attachments.map((a) => ({
          name: a.name,
          type: a.type,
          data: a.data,
        })),
      };

      if (isImageReq) {
        endpoint = '/api/generate-image';
        body = {
          prompt: text || 'Create an artistic interpretation of the attached image.',
          aspectRatio: '1:1',
          attachments: attachments
            .filter((attachment) => attachment.type.startsWith('image/'))
            .map((attachment) => ({
              name: attachment.name,
              type: attachment.type,
              data: attachment.data,
            })),
        };
      } else if (weatherRequest) {
        const parameters = new URLSearchParams({
          location: weatherRequest.location,
          temperatureUnit: weatherRequest.temperatureUnit,
        });
        endpoint = `/api/weather?${parameters.toString()}`;
      }

      const res = endpoint.startsWith('/api/weather?')
        ? await fetch(endpoint)
        : await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

      const data = await readJsonResponse<{
        error?: string;
        content?: string;
        prompt?: string;
        imageUrl?: string;
        sources?: Array<{ uri: string; title: string }>;
        location?: string;
        temperature?: number;
        temperatureUnit?: string;
        feelsLike?: number;
        humidity?: number;
        windSpeed?: number;
        windSpeedUnit?: string;
        conditions?: string;
        observedAt?: string;
        source?: string;
      }>(res, `JARVIS API error (${res.status}): ${res.statusText}`);

      if (!res.ok) {
        throw new Error(data.error || `JARVIS API error (${res.status}): ${res.statusText}`);
      }

      let assistantMessage: Message;
      if (endpoint.startsWith('/api/weather?')) {
        if (typeof data.temperature !== 'number' || !data.location) {
          throw new Error('The weather service returned an incomplete response. Please try again.');
        }
        const unit = data.temperatureUnit || '°C';
        const feelsLike =
          typeof data.feelsLike === 'number' ? ` Feels like ${data.feelsLike}${unit}.` : '';
        const humidity =
          typeof data.humidity === 'number' ? ` Humidity ${data.humidity}%.` : '';
        const wind =
          typeof data.windSpeed === 'number'
            ? ` Wind ${data.windSpeed} ${data.windSpeedUnit || 'km/h'}.`
            : '';
        const observedAt = data.observedAt ? ` Local observation time: ${data.observedAt}.` : '';
        assistantMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `Current weather in ${data.location}: ${data.temperature}${unit}, ${data.conditions || 'conditions unavailable'}.${feelsLike}${humidity}${wind}${observedAt}`,
          sources: data.source ? [{ uri: data.source, title: 'Open-Meteo weather data' }] : [],
          timestamp: Date.now(),
        };
      } else if (endpoint === '/api/generate-image') {
        if (data.imageUrl) {
          setArtGallery((prev) => [
            {
              id: Math.random().toString(36).substring(2, 9),
              prompt: data.prompt || text,
              style: 'Auto Studio',
              aspectRatio: '1:1',
              imageUrl: data.imageUrl!,
              createdAt: Date.now(),
            },
            ...prev,
          ]);
        }
        assistantMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `Here is the artwork generated for **"${data.prompt}"**:\n\n*Synthesized with JARVIS Neural Studio.*`,
          imageUrl: data.imageUrl,
          timestamp: Date.now(),
        };
      } else {
        assistantMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: data.content || 'Response processed, sir.',
          sources: data.sources || [],
          imageUrl: data.imageUrl,
          timestamp: Date.now(),
        };
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === currentConvId) {
            return {
              ...c,
              updatedAt: Date.now(),
              messages: [...c.messages, assistantMessage],
            };
          }
          return c;
        })
      );

      if (settings.voiceEnabled && assistantMessage.content) {
        handleToggleSpeakMessage(assistantMessage.id, assistantMessage.content);
      }
    } catch (err) {
      console.error('Error contacting JARVIS backend:', err);
      const errorText = err instanceof Error ? err.message : 'The request failed.';
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: errorText.includes('not configured')
          ? `**Setup required:** ${errorText}\n\nAdd GEMINI_API_KEY to the server's untracked .env file and restart the server.`
          : `**JARVIS could not answer:** ${errorText}`,
        timestamp: Date.now(),
        isError: true,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === currentConvId) {
            return {
              ...c,
              updatedAt: Date.now(),
              messages: [...c.messages, errorMessage],
            };
          }
          return c;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Quick prompt selection from Welcome Hero
  const handleSelectPrompt = (prompt: string) => {
    handleSendMessage(prompt, []);
  };

  // Image Studio Generation Handler
  const handleGenerateStudioImage = async () => {
    const cleanPrompt = studioPrompt.trim();
    if (!cleanPrompt || studioGenerating) return;

    const preset =
      IMAGE_STYLE_PRESETS.find((p) => p.id === studioStyle) || IMAGE_STYLE_PRESETS[0];
    const fullPrompt = `${cleanPrompt}, ${preset.suffix}`;

    setStudioGenerating(true);
    setStudioError('');

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          aspectRatio: studioAspectRatio,
          attachments: [],
        }),
      });

      const data = await readJsonResponse<{
        imageUrl?: string;
        prompt?: string;
        error?: string;
      }>(res, 'Image generation failed.');

      if (!res.ok || !data.imageUrl) {
        throw new Error(data.error || 'No image URL was returned by JARVIS Neural Studio.');
      }

      const newArt: GeneratedArtItem = {
        id: Math.random().toString(36).substring(2, 9),
        prompt: cleanPrompt,
        style: preset.label,
        aspectRatio: studioAspectRatio,
        imageUrl: data.imageUrl,
        createdAt: Date.now(),
      };

      setArtGallery((prev) => [newArt, ...prev]);
    } catch (err) {
      setStudioError(err instanceof Error ? err.message : 'Could not synthesize image.');
    } finally {
      setStudioGenerating(false);
    }
  };

  // Live Screen Vision Capture Handler
  const handleCaptureScreenVision = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setAccountNotice('Screen capture is not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      stream.getTracks().forEach((track) => track.stop());
      const dataUrl = canvas.toDataURL('image/png');

      const screenAttachment: Attachment = {
        name: `jarvis-screen-vision-${Date.now()}.png`,
        type: 'image/png',
        data: dataUrl,
      };

      await handleSendMessage(
        'Analyze this live screen capture in detail. Explain what is shown, identify any errors or key insights, and advise next steps.',
        [screenAttachment]
      );
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        setAccountNotice(`Screen capture error: ${err.message}`);
      }
    }
  };

  // Engineering & Medical Workbench Computations
  const handleRunScientificCalc = () => {
    try {
      const value = evaluateSafeMathExpression(calcInput);
      setCalcResult(
        Number.isInteger(value) ? String(value) : value.toPrecision(10).replace(/\.?0+$/, '')
      );
      setCalcError('');
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : 'Invalid expression');
    }
  };

  const ohmsMetrics = useMemo(() => {
    const v = parseFloat(ohmsVoltage);
    const r = parseFloat(ohmsResistance);
    if (!Number.isFinite(v) || !Number.isFinite(r) || r <= 0) {
      return { currentAmps: '—', currentMa: '—', powerWatts: '—' };
    }
    const i = v / r;
    const p = v * i;
    return {
      currentAmps: i.toFixed(4) + ' A',
      currentMa: (i * 1000).toFixed(2) + ' mA',
      powerWatts: p.toFixed(4) + ' W',
    };
  }, [ohmsVoltage, ohmsResistance]);

  const unitConversions = useMemo(() => {
    const val = parseFloat(unitValue);
    if (!Number.isFinite(val)) return [];
    switch (unitCategory) {
      case 'length':
        return [
          { label: 'Meters (m)', value: val.toFixed(4) },
          { label: 'Kilometers (km)', value: (val / 1000).toFixed(6) },
          { label: 'Feet (ft)', value: (val * 3.28084).toFixed(4) },
          { label: 'Inches (in)', value: (val * 39.3701).toFixed(3) },
          { label: 'Miles (mi)', value: (val * 0.000621371).toFixed(6) },
        ];
      case 'pressure':
        return [
          { label: 'Pascals (Pa)', value: val.toFixed(2) },
          { label: 'Kilopascals (kPa)', value: (val / 1000).toFixed(4) },
          { label: 'Megapascals (MPa)', value: (val / 1e6).toFixed(6) },
          { label: 'Bar', value: (val / 100000).toFixed(5) },
          { label: 'PSI (lbf/in²)', value: (val * 0.000145038).toFixed(4) },
        ];
      case 'energy':
        return [
          { label: 'Joules (J)', value: val.toFixed(2) },
          { label: 'Kilojoules (kJ)', value: (val / 1000).toFixed(4) },
          { label: 'Kilowatt-hours (kWh)', value: (val / 3.6e6).toFixed(6) },
          { label: 'Calories (kcal)', value: (val / 4184).toFixed(4) },
          { label: 'BTU', value: (val * 0.000947817).toFixed(4) },
        ];
      case 'temp':
        return [
          { label: 'Celsius (°C)', value: val.toFixed(2) },
          { label: 'Fahrenheit (°F)', value: ((val * 9) / 5 + 32).toFixed(2) },
          { label: 'Kelvin (K)', value: (val + 273.15).toFixed(2) },
        ];
    }
  }, [unitCategory, unitValue]);

  const clinicalMetrics = useMemo(() => {
    const w = parseFloat(clinicalWeightKg);
    const hCm = parseFloat(clinicalHeightCm);
    const age = parseFloat(clinicalAge);
    if (!Number.isFinite(w) || !Number.isFinite(hCm) || hCm <= 0 || w <= 0) {
      return { bmi: '—', category: 'Invalid input', bmrMale: '—', bmrFemale: '—' };
    }
    const hM = hCm / 100;
    const bmiVal = w / (hM * hM);
    let category = 'Normal weight';
    if (bmiVal < 18.5) category = 'Underweight';
    else if (bmiVal >= 25 && bmiVal < 30) category = 'Overweight';
    else if (bmiVal >= 30) category = 'Obesity range';

    const validAge = Number.isFinite(age) && age > 0 ? age : 30;
    const bmrMale = Math.round(10 * w + 6.25 * hCm - 5 * validAge + 5);
    const bmrFemale = Math.round(10 * w + 6.25 * hCm - 5 * validAge - 161);

    return {
      bmi: bmiVal.toFixed(1) + ' kg/m²',
      category,
      bmrMale: `${bmrMale} kcal/day`,
      bmrFemale: `${bmrFemale} kcal/day`,
    };
  }, [clinicalWeightKg, clinicalHeightCm, clinicalAge]);

  // Memory & Command Palette Helpers
  const handleAddMemory = () => {
    const trimmed = newMemoryText.trim();
    if (!trimmed) return;
    setMemories((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        category: newMemoryCategory,
        content: trimmed,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    setNewMemoryText('');
  };

  const handleDeleteMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const filteredProfessions = useMemo(() => {
    const q = professionSearch.trim().toLowerCase();
    if (!q) return PROFESSION_PROFILES;
    return PROFESSION_PROFILES.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [professionSearch]);

  const commandActions = useMemo(
    () => [
      {
        id: 'voice',
        label: 'Start Live Two-Way Voice Conversation (ChatGPT Voice Mode)',
        shortcut: 'VOICE',
        action: () => {
          stopSpeaking();
          setLiveVoiceOpen(true);
        },
      },
      {
        id: 'news',
        label: 'Open Live World News & Real-Time Briefing Hub',
        shortcut: 'NEWS',
        action: () => setNewsModalOpen(true),
      },
      {
        id: 'professions',
        label: 'Switch Specialist Profession (Medical, Engineering, Law, Finance...)',
        shortcut: 'PRO',
        action: () => setProfessionsModalOpen(true),
      },
      {
        id: 'image-studio',
        label: 'Open JARVIS Neural Image Creation & Gallery Studio',
        shortcut: 'ART',
        action: () => setImageStudioOpen(true),
      },
      {
        id: 'workbench',
        label: 'Open Engineering & Medical Scientific Workbench',
        shortcut: 'CALC',
        action: () => setWorkbenchOpen(true),
      },
      {
        id: 'screen-vision',
        label: 'Capture Live Screen & Analyze with JARVIS Vision',
        shortcut: 'VISION',
        action: () => void handleCaptureScreenVision(),
      },
      {
        id: 'memory',
        label: 'Manage JARVIS Persistent Neural Memory & Preferences',
        shortcut: 'MEM',
        action: () => setMemoryModalOpen(true),
      },
      {
        id: 'new-chat',
        label: 'Start New Conversation Session',
        shortcut: 'Ctrl+K',
        action: () => handleNewChat(),
      },
    ],
    []
  );

  const filteredCommands = useMemo(() => {
    const q = commandQuery.trim().toLowerCase();
    if (!q) return commandActions;
    return commandActions.filter(
      (c) => c.label.toLowerCase().includes(q) || c.shortcut.toLowerCase().includes(q)
    );
  }, [commandActions, commandQuery]);

  const isMedicalRole =
    activeProfession.id === 'medical' || activeProfession.id === 'pharmacology';
  const isEngineeringRole = activeProfession.id.endsWith('-eng');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#060b13] text-slate-100 antialiased font-sans">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onClearAll={handleClearAll}
        onTogglePin={handleTogglePin}
        user={user}
        onOpenAuth={() => setAuthModalOpen(true)}
        directSignInUrl={directSignInUrl}
        onCopyDirectSignInUrl={handleCopyDirectSignInUrl}
        onExport={() => setExportModalOpen(true)}
        onShare={() => setShareModalOpen(true)}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <Header
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          isSidebarOpen={sidebarOpen}
          selectedModel={settings.selectedModel}
          onSelectModel={(model: AIModelId) =>
            setSettings((prev) => ({ ...prev, selectedModel: model }))
          }
          voiceEnabled={settings.voiceEnabled}
          onToggleVoice={() => {
            if (settings.voiceEnabled) stopSpeaking();
            setSettings((prev) => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
          }}
          user={user}
          onOpenAuth={() => setAuthModalOpen(true)}
          isOnline={isOnline}
          aiConfigured={aiConfigured}
          onOpenTools={() => setToolsModalOpen(true)}
          onExport={() => setExportModalOpen(true)}
          hasMessages={(activeConversation?.messages?.length || 0) > 0}
        />

        {/* JARVIS OMNISCIENT COMMAND & TELEMETRY DOCK */}
        <div className="bg-[#08101d]/95 border-b border-cyan-500/20 px-3 md:px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                stopSpeaking();
                setLiveVoiceOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-400/40 text-cyan-200 text-xs font-medium transition shadow-sm"
              title="Start ChatGPT-style two-way hands-free voice conversation"
            >
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Live Voice</span>
            </button>

            <button
              type="button"
              onClick={() => setNewsModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              title="Real-time breaking news and live world briefings"
            >
              <Newspaper className="w-3.5 h-3.5 text-amber-400" />
              <span>Today's News</span>
            </button>

            <button
              type="button"
              onClick={() => setProfessionsModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${activeProfession.badgeColor}`}
              title="Switch active profession specialist (18 domains)"
            >
              {isMedicalRole ? (
                <Stethoscope className="w-3.5 h-3.5" />
              ) : isEngineeringRole ? (
                <Cpu className="w-3.5 h-3.5" />
              ) : (
                <Briefcase className="w-3.5 h-3.5" />
              )}
              <span>{activeProfession.shortName}</span>
            </button>

            <button
              type="button"
              onClick={() => setImageStudioOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              title="Open JARVIS Neural Image Creation & Gallery Studio"
            >
              <ImageIcon className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>Image Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setWorkbenchOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              title="Engineering Materials, Lab References, Ohm's Law & Scientific Calculator"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
              <span>Eng & Med Lab</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCaptureScreenVision()}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              title="Capture a live screenshot and send to JARVIS Vision"
            >
              <Monitor className="w-3.5 h-3.5 text-sky-400" />
              <span>Screen Vision</span>
            </button>

            <button
              type="button"
              onClick={() => setMemoryModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              title="Manage persistent JARVIS memory & user preferences"
            >
              <Brain className="w-3.5 h-3.5 text-violet-400" />
              <span>Memory ({memories.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-slate-400">
            <span className="hidden lg:flex items-center gap-1 text-cyan-300/80">
              <Clock className="w-3 h-3" />
              {liveClock.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              {liveClock.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <button
              type="button"
              onClick={() => setCommandPaletteOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
              title="Open Command Palette (Ctrl+P)"
            >
              <Command className="w-3 h-3 text-cyan-400" />
              <span>Ctrl+P</span>
            </button>
          </div>
        </div>

        {/* Active Profession Disclaimer Banner */}
        {activeProfession.disclaimer && (
          <div className="bg-emerald-950/50 border-b border-emerald-500/25 px-4 py-1 flex items-center justify-between text-[11px] text-emerald-200/90">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{activeProfession.disclaimer}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveProfessionId('general')}
              className="text-emerald-300 hover:text-white underline ml-2 shrink-0"
            >
              Reset to Core
            </button>
          </div>
        )}

        {!isOnline && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                <strong>Offline:</strong> Guest chats are not saved and AI replies require an
                internet connection. Account changes may not sync.
              </span>
            </div>
          </div>
        )}

        {accountNotice && (
          <div
            role="status"
            className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex items-center justify-between gap-3 text-xs text-slate-300"
          >
            <span>{accountNotice}</span>
            <button
              type="button"
              onClick={() => setAccountNotice('')}
              className="text-slate-400 hover:text-white"
              aria-label="Dismiss account notice"
            >
              Dismiss
            </button>
          </div>
        )}

        {!user.isGuest && (
          <div className="bg-cyan-950/80 border-b border-cyan-500/30 px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs text-cyan-300">
            <div className="flex items-start gap-2 min-w-0">
              <Link className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p>
                  <strong>Signed in:</strong> conversations are saved to your account.
                </p>
                <p className="text-[10px] text-cyan-200/70">
                  Your reusable sign-in URL is in the sidebar. Keep it private.
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto flex flex-col relative"
          style={
            isWelcomeScreen
              ? {
                  backgroundImage:
                    "linear-gradient(rgba(6, 11, 19, 0.28), rgba(6, 11, 19, 0.55)), url('/jarvis-welcome-bg.png')",
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: 'cover',
                }
              : undefined
          }
        >
          {isWelcomeScreen ? (
            <WelcomeHero onSelectPrompt={handleSelectPrompt} />
          ) : (
            <div className="flex-1 py-4 space-y-1">
              {activeConversation.messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onSpeak={handleToggleSpeakMessage}
                  isSpeaking={speakingMessageId === msg.id}
                  onSelectPrompt={handleSelectPrompt}
                />
              ))}

              {isLoading && (
                <div className="py-4 px-3 md:px-6 bg-slate-900/30 border-y border-slate-800/40">
                  <div className="max-w-4xl mx-auto flex gap-3 md:gap-4 items-center">
                    <ArcReactorLogo glow={true} size="sm" />
                    <div className="flex items-center gap-2 text-xs md:text-sm text-cyan-300">
                      <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
                      <span className="font-mono">
                        {settings.webSearchEnabled
                          ? `JARVIS (${activeProfession.shortName}) is accessing real-time web knowledge...`
                          : `JARVIS (${activeProfession.shortName}) is preparing a response...`}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        <PromptBar
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          webSearchEnabled={settings.webSearchEnabled}
          onToggleWebSearch={() =>
            setSettings((prev) => ({ ...prev, webSearchEnabled: !prev.webSearchEnabled }))
          }
          dualEngineEnabled={settings.dualEngineEnabled}
          onToggleDualEngine={() =>
            setSettings((prev) => ({ ...prev, dualEngineEnabled: !prev.dualEngineEnabled }))
          }
          showScrollBottom={showScrollBottom}
          onScrollToBottom={scrollToBottom}
        />
      </div>

      {/* EXISTING MODALS */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={user}
        onAuthenticated={handleAuthenticated}
        onSignOut={handleSignOut}
      />
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        conversation={activeConversation}
      />
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        conversation={activeConversation}
      />
      <ToolsModal
        isOpen={toolsModalOpen}
        onClose={() => setToolsModalOpen(false)}
        onInsertPrompt={(text) => handleSendMessage(text, [])}
      />

      {/* MODULAR LIVE VOICE STUDIO COMPONENT */}
      <LiveVoiceStudio
        isOpen={liveVoiceOpen}
        onClose={() => setLiveVoiceOpen(false)}
        activeProfession={activeProfession}
        memories={memories}
        selectedModel={settings.selectedModel}
        dualEngineEnabled={settings.dualEngineEnabled}
        onSaveTranscriptToChat={handleSaveVoiceTranscriptToChat}
      />

      {/* REAL-TIME NEWS & CURRENT EVENTS BRIEFING MODAL */}
      {newsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-cyan-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Newspaper className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    JARVIS Real-Time News & Global Intelligence
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live grounded briefings for{' '}
                    {liveClock.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNewsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {NEWS_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setNewsModalOpen(false);
                    setSettings((prev) => ({ ...prev, webSearchEnabled: true }));
                    void handleSendMessage(cat.prompt, []);
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-left transition group"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100 group-hover:text-cyan-300">
                      {cat.label}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      Live web search + verified headlines
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ALL-PROFESSIONS SPECIALIST HUB (18 DOMAINS) */}
      {professionsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-cyan-500/30 rounded-2xl max-w-4xl w-full max-h-[88vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    All-Professions Specialist Matrix ({PROFESSION_PROFILES.length} Expert Domains)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Equip JARVIS with domain-specific reasoning across medicine, pharmacology,
                    engineering, law, finance, and science
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfessionsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={professionSearch}
                onChange={(e) => setProfessionSearch(e.target.value)}
                placeholder="Search 18 professions (Medical, Pharmacology, Mechanical, Electrical, Civil, Aerospace, Law, Finance)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 pr-1">
              {filteredProfessions.map((prof) => {
                const isSelected = prof.id === activeProfessionId;
                return (
                  <div
                    key={prof.id}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'bg-cyan-950/35 border-cyan-400/60'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{prof.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border ${prof.badgeColor}`}
                        >
                          {prof.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        {prof.description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {prof.quickPrompts.slice(0, 2).map((qp, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setActiveProfessionId(prof.id);
                              setProfessionsModalOpen(false);
                              void handleSendMessage(qp, []);
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 truncate max-w-full text-left"
                          >
                            ⚡ {qp}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveProfessionId(prof.id);
                          setProfessionsModalOpen(false);
                        }}
                        className={`w-full py-1.5 rounded-lg text-xs font-medium transition ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950'
                            : 'bg-slate-800 hover:bg-cyan-500/20 text-slate-200 border border-slate-700'
                        }`}
                      >
                        {isSelected ? '✓ Active Specialist Mode' : `Activate ${prof.shortName}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* JARVIS NEURAL IMAGE CREATION & GALLERY STUDIO MODAL */}
      {imageStudioOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-fuchsia-500/30 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Palette className="w-5 h-5 text-fuchsia-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    JARVIS Neural Image Creation & Blueprint Studio
                  </h3>
                  <p className="text-xs text-slate-400">
                    Synthesize photorealistic artwork, engineering schematics, and medical renders
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImageStudioOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 border-b border-slate-800">
              <textarea
                rows={2}
                value={studioPrompt}
                onChange={(e) => setStudioPrompt(e.target.value)}
                placeholder="Describe the image, medical diagram, architectural render, or sci-fi concept you want JARVIS to create..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-fuchsia-400"
              />

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={studioStyle}
                  onChange={(e) => setStudioStyle(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                >
                  {IMAGE_STYLE_PRESETS.map((st) => (
                    <option key={st.id} value={st.id}>
                      Style: {st.label}
                    </option>
                  ))}
                </select>

                <select
                  value={studioAspectRatio}
                  onChange={(e) =>
                    setStudioAspectRatio(e.target.value as '1:1' | '16:9' | '9:16' | '4:3')
                  }
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200"
                >
                  <option value="1:1">1:1 Square</option>
                  <option value="16:9">16:9 Widescreen</option>
                  <option value="9:16">9:16 Portrait</option>
                  <option value="4:3">4:3 Standard</option>
                </select>

                <button
                  type="button"
                  disabled={studioGenerating || !studioPrompt.trim()}
                  onClick={() => void handleGenerateStudioImage()}
                  className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
                >
                  {studioGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Image</span>
                    </>
                  )}
                </button>
              </div>

              {studioError && <p className="text-xs text-rose-400">{studioError}</p>}
            </div>

            <div className="flex-1 overflow-y-auto pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300">
                  Generated Studio Gallery ({artGallery.length})
                </span>
                {artGallery.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setArtGallery([])}
                    className="text-[11px] text-slate-400 hover:text-rose-400"
                  >
                    Clear Gallery
                  </button>
                )}
              </div>

              {artGallery.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No images synthesized yet. Enter a prompt above to generate your first creation.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {artGallery.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col"
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.prompt}
                        className="w-full h-44 object-cover bg-slate-950"
                      />
                      <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                        <p className="text-[11px] text-slate-300 line-clamp-2">{item.prompt}</p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{item.style}</span>
                          <a
                            href={item.imageUrl}
                            download={`jarvis-art-${item.id}.png`}
                            className="flex items-center gap-1 text-cyan-400 hover:underline"
                          >
                            <Download className="w-3 h-3" />
                            <span>Save</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ENGINEERING & MEDICAL SCIENTIFIC WORKBENCH MODAL */}
      {workbenchOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-emerald-500/30 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Engineering & Clinical Calculation Workbench
                  </h3>
                  <p className="text-xs text-slate-400">
                    Scientific evaluator, Ohm's law, unit conversions, materials database &
                    clinical lab ranges
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWorkbenchOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'calc', label: 'Scientific Calculator' },
                  { id: 'ohms', label: "Ohm's Law & Power" },
                  { id: 'units', label: 'Engineering Units' },
                  { id: 'materials', label: 'Materials DB' },
                  { id: 'clinical', label: 'Medical BMI / BMR' },
                  { id: 'labs', label: 'Clinical Lab Ranges' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setWorkbenchTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    workbenchTab === tab.id
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {workbenchTab === 'calc' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={calcInput}
                      onChange={(e) => setCalcInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRunScientificCalc();
                      }}
                      placeholder="e.g., sin(pi/4) * 100 + sqrt(256)"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-200"
                    />
                    <button
                      type="button"
                      onClick={handleRunScientificCalc}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold"
                    >
                      Compute
                    </button>
                  </div>
                  {calcError ? (
                    <p className="text-xs text-rose-400">{calcError}</p>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Result:</span>
                      <span className="text-base font-mono font-bold text-emerald-300">
                        {calcResult}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setWorkbenchOpen(false);
                      setActiveProfessionId('mechanical-eng');
                      void handleSendMessage(
                        `Verify and explain the engineering/mathematical derivation for: ${calcInput} = ${calcResult}`,
                        []
                      );
                    }}
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    → Ask JARVIS Engineering Suite to analyze this calculation
                  </button>
                </div>
              )}

              {workbenchTab === 'ohms' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Voltage (Volts)
                      </label>
                      <input
                        type="number"
                        value={ohmsVoltage}
                        onChange={(e) => setOhmsVoltage(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Resistance (Ohms Ω)
                      </label>
                      <input
                        type="number"
                        value={ohmsResistance}
                        onChange={(e) => setOhmsResistance(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Current (I)</div>
                      <div className="text-sm font-mono text-cyan-300 mt-0.5">
                        {ohmsMetrics.currentAmps}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Current (mA)</div>
                      <div className="text-sm font-mono text-cyan-300 mt-0.5">
                        {ohmsMetrics.currentMa}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Power Dissipation</div>
                      <div className="text-sm font-mono text-amber-300 mt-0.5">
                        {ohmsMetrics.powerWatts}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {workbenchTab === 'units' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      value={unitCategory}
                      onChange={(e) =>
                        setUnitCategory(
                          e.target.value as 'length' | 'pressure' | 'energy' | 'temp'
                        )
                      }
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="pressure">Pressure / Stress (Pa base)</option>
                      <option value="length">Length / Distance (m base)</option>
                      <option value="energy">Energy / Work (J base)</option>
                      <option value="temp">Temperature (°C base)</option>
                    </select>
                    <input
                      type="number"
                      value={unitValue}
                      onChange={(e) => setUnitValue(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {unitConversions.map((u) => (
                      <div
                        key={u.label}
                        className="p-2.5 rounded-xl bg-slate-900 border border-slate-800"
                      >
                        <div className="text-[10px] text-slate-400">{u.label}</div>
                        <div className="text-xs font-mono text-emerald-300 mt-0.5">{u.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {workbenchTab === 'materials' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                        <th className="py-2 pr-3">Material</th>
                        <th className="py-2 px-2">Density (kg/m³)</th>
                        <th className="py-2 px-2">Young's (GPa)</th>
                        <th className="py-2 px-2">Yield (MPa)</th>
                        <th className="py-2 pl-2">Thermal (W/m·K)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {ENGINEERING_MATERIALS_DB.map((mat) => (
                        <tr key={mat.name} className="hover:bg-slate-900/70">
                          <td className="py-2 pr-3 font-medium text-slate-200">{mat.name}</td>
                          <td className="py-2 px-2 font-mono text-cyan-300">{mat.densityKgM3}</td>
                          <td className="py-2 px-2 font-mono text-emerald-300">
                            {mat.youngsModulusGPa}
                          </td>
                          <td className="py-2 px-2 font-mono text-amber-300">
                            {mat.yieldStrengthMPa}
                          </td>
                          <td className="py-2 pl-2 font-mono text-slate-300">
                            {mat.thermalConductivityWmK}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {workbenchTab === 'clinical' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        value={clinicalWeightKg}
                        onChange={(e) => setClinicalWeightKg(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Height (cm)</label>
                      <input
                        type="number"
                        value={clinicalHeightCm}
                        onChange={(e) => setClinicalHeightCm(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Age (yrs)</label>
                      <input
                        type="number"
                        value={clinicalAge}
                        onChange={(e) => setClinicalAge(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Body Mass Index</div>
                      <div className="text-sm font-mono text-emerald-300 mt-0.5">
                        {clinicalMetrics.bmi}
                      </div>
                      <div className="text-[10px] text-slate-400">{clinicalMetrics.category}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Est. BMR (Male)</div>
                      <div className="text-sm font-mono text-cyan-300 mt-0.5">
                        {clinicalMetrics.bmrMale}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400">Est. BMR (Female)</div>
                      <div className="text-sm font-mono text-cyan-300 mt-0.5">
                        {clinicalMetrics.bmrFemale}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {workbenchTab === 'labs' && (
                <div className="space-y-2">
                  {CLINICAL_LAB_REFERENCES.map((lab) => (
                    <div
                      key={lab.abbreviation}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-100">
                          {lab.testName}{' '}
                          <span className="font-mono text-emerald-400">({lab.abbreviation})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">{lab.clinicalNote}</div>
                      </div>
                      <div className="text-xs font-mono text-cyan-300 shrink-0">
                        {lab.normalRange} {lab.unit}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JARVIS NEURAL MEMORY & CUSTOM INSTRUCTIONS MODAL */}
      {memoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-violet-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-violet-400" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    JARVIS Persistent Neural Memory
                  </h3>
                  <p className="text-xs text-slate-400">
                    Facts and preferences JARVIS remembers across every conversation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMemoryModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={newMemoryCategory}
                onChange={(e) =>
                  setNewMemoryCategory(e.target.value as MemoryEntry['category'])
                }
                className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200"
              >
                <option value="Profession">Profession</option>
                <option value="Identity">Identity</option>
                <option value="Preference">Preference</option>
                <option value="Project">Project</option>
              </select>
              <input
                type="text"
                value={newMemoryText}
                onChange={(e) => setNewMemoryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddMemory();
                }}
                placeholder="e.g., I am a civil engineer based in Lahore; use SI units."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleAddMemory}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium"
              >
                Save
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {memories.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No neural memories saved yet. Add your role, city, or response preferences above.
                </p>
              ) : (
                memories.map((mem) => (
                  <div
                    key={mem.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 mr-2">
                        {mem.category}
                      </span>
                      <span className="text-slate-200">{mem.content}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMemory(mem.id)}
                      className="text-slate-500 hover:text-rose-400 p-1"
                      aria-label="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* CTRL+P QUICK COMMAND PALETTE */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
          <div className="bg-[#0b1322] border border-cyan-500/40 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
              <Command className="w-4 h-4 text-cyan-400" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Type a JARVIS command..."
                className="flex-1 bg-transparent text-sm text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                ESC
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/60">
              {filteredCommands.map((cmd) => (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    setCommandQuery('');
                    cmd.action();
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-cyan-500/10 transition"
                >
                  <span className="text-xs text-slate-200">{cmd.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300">
                    {cmd.shortcut}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
