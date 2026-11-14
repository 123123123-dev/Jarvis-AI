/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
} from './services/storage';
import { WifiOff, Sparkles, Link } from 'lucide-react';

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
  const data = await readJsonResponse<{ token?: string }>(response, 'The server returned an invalid sign-in link.');
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const accountSaveQueue = useRef(Promise.resolve());

  // Active conversation object
  const activeConversation =
    conversations.find((c) => c.id === activeChatId) || null;

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
        const data = await readJsonResponse<{ conversations: Conversation[] }>(response, 'The server returned an invalid conversation list.');
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
      .then((response) => readJsonResponse<{ aiConfigured?: boolean }>(response, 'The health check response was invalid.'))
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
      const { conversations: accountConversations } = await readJsonResponse<{ conversations: Conversation[] }>(
        response,
        'The account conversations response was invalid.'
      );
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

  // Online / Offline listener & auto-flush sync queue
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K for new chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
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

    // Clean markdown and citations before speaking
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

    // Try to pick a natural English voice
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

  // Send message
  const handleSendMessage = async (
    text: string,
    attachments: Attachment[] = []
  ) => {
    if (!text.trim() && attachments.length === 0) return;

    // Check if prompt is an image generation request
    const hasImageReference = attachments.some((attachment) => attachment.type.startsWith('image/'));
    const isImageReq =
      settings.selectedModel === 'jarvis-art' ||
      /^(?:\/image\b|(?:generate|create|make)\s+(?:(?:an?|the)\s+)?(?:image|picture|artwork|illustration|photo|photograph|portrait)\b|(?:draw|paint|illustrate)\b|turn\s+.+\s+into\b)/i.test(text.trim()) ||
      (hasImageReference && /\b(?:edit|change|remove|replace|restyle|redraw|transform|turn|add|put|place|dress|make\s+(?:it|this|the image|him|her|them)|convert)\b/i.test(text));

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    let currentConvId = activeChatId;
    let updatedConversations = [...conversations];

    // If no active chat, create one
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

      let endpoint = '/api/chat';
      let body: Record<string, unknown> = {
        messages: activeMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        webSearch: settings.webSearchEnabled,
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
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await readJsonResponse<{ error?: string; content?: string; prompt?: string; imageUrl?: string; sources?: Array<{ uri: string; title: string }> }>(
        res,
        `JARVIS API error (${res.status}): ${res.statusText}`
      );
      if (!res.ok) {
        throw new Error(data.error || `JARVIS API error (${res.status}): ${res.statusText}`);
      }

      let assistantMessage: Message;
      if (endpoint === '/api/generate-image') {
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

      // Auto-speak if voice is enabled
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
        onExport={() => setExportModalOpen(true)}
        onShare={() => setShareModalOpen(true)}
      />

      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
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

        {!isOnline && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                <strong>Offline:</strong> Guest chats are not saved and AI replies require an internet connection. Account changes may not sync.
              </span>
            </div>
          </div>
        )}

        {accountNotice && (
          <div role="status" className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex items-center justify-between gap-3 text-xs text-slate-300">
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
                <p><strong>Signed in:</strong> conversations are saved to your account.</p>
                <p className="text-[10px] text-cyan-200/70">Anyone with this reusable link can access your account until you sign out or sign in again.</p>
              </div>
            </div>
            {directSignInUrl && (
              <div className="flex items-center gap-2 min-w-0 md:max-w-[50%]">
                <input
                  type="text"
                  readOnly
                  value={directSignInUrl}
                  aria-label="Reusable account sign-in URL"
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded border border-cyan-500/30 bg-slate-950/70 px-2 py-1 text-[10px] text-cyan-100"
                />
                <button
                  onClick={handleCopyDirectSignInUrl}
                  className="shrink-0 text-[11px] underline hover:text-cyan-200 cursor-pointer"
                >
                  Copy URL
                </button>
              </div>
            )}
          </div>
        )}

        <div
          ref={chatScrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto flex flex-col relative"
        >
          {!activeConversation || activeConversation.messages.length === 0 ? (
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
                          ? 'JARVIS is accessing real-time web knowledge...'
                          : 'JARVIS is preparing a response...'}
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
    </div>
  );
}