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
  loadConversations,
  saveConversations,
  loadActiveChatId,
  saveActiveChatId,
  loadUserProfile,
  saveUserProfile,
  loadSettings,
  saveSettings,
  syncToServer,
  flushOfflineQueue,
} from './services/storage';
import { WifiOff, Sparkles } from 'lucide-react';

export default function App() {
  // Persistence state
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    loadConversations()
  );
  const [activeChatId, setActiveChatId] = useState<string | null>(() =>
    loadActiveChatId()
  );
  const [user, setUser] = useState<UserProfile>(() => loadUserProfile());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncStatus, setSyncStatus] = useState<
    'synced' | 'syncing' | 'offline' | 'guest'
  >(user.isGuest ? 'guest' : 'synced');

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Active conversation object
  const activeConversation =
    conversations.find((c) => c.id === activeChatId) || null;

  // Save conversations whenever they change
  useEffect(() => {
    saveConversations(conversations);
    if (!user.isGuest && isOnline) {
      setSyncStatus('syncing');
      syncToServer(user.id, conversations).then((res) => {
        setSyncStatus(res.success ? 'synced' : 'offline');
      });
    }
  }, [conversations, user, isOnline]);

  // Save active chat ID
  useEffect(() => {
    saveActiveChatId(activeChatId);
  }, [activeChatId]);

  // Save settings
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Save user profile
  useEffect(() => {
    saveUserProfile(user);
    setSyncStatus(user.isGuest ? 'guest' : 'synced');
  }, [user]);

  // Online / Offline listener & auto-flush sync queue
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const flushed = await flushOfflineQueue();
      if (flushed && !user.isGuest) {
        setSyncStatus('synced');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user.isGuest]);

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
    const isImageReq =
      settings.selectedModel === 'art-studio' ||
      text.toLowerCase().startsWith('generate image') ||
      text.toLowerCase().startsWith('create image') ||
      text.toLowerCase().startsWith('generate artwork') ||
      text.toLowerCase().startsWith('draw ') ||
      text.toLowerCase().startsWith('paint ') ||
      text.toLowerCase().includes('dall-e');

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
        model: settings.dualEngineEnabled ? 'gemini-4-argon' : settings.selectedModel,
        attachments: attachments.map((a) => ({
          name: a.name,
          type: a.type,
          data: a.data,
        })),
      };

      if (isImageReq && settings.selectedModel === 'art-studio') {
        endpoint = '/api/generate-image';
        body = { prompt: text, aspectRatio: '1:1' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`JARVIS API error (${res.status}): ${res.statusText}`);
      }

      const data = await res.json();

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
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: `**JARVIS Core Notice:** ${(err as Error).message}\n\nPlease verify network connection or Gemini API credentials in the Settings panel.`,
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
      {/* Sidebar Navigation */}
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

      {/* Main App Container */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          selectedModel={settings.selectedModel}
          onSelectModel={(model: AIModelId) =>
            setSettings((prev) => ({ ...prev, selectedModel: model }))
          }
          voiceEnabled={settings.voiceEnabled}
          onToggleVoice={() => {
            if (settings.voiceEnabled) stopSpeaking();
            setSettings((prev) => ({
              ...prev,
              voiceEnabled: !prev.voiceEnabled,
            }));
          }}
          user={user}
          onOpenAuth={() => setAuthModalOpen(true)}
          isOnline={isOnline}
          syncStatus={syncStatus}
          onOpenTools={() => setToolsModalOpen(true)}
          onExport={() => setExportModalOpen(true)}
          hasMessages={(activeConversation?.messages?.length || 0) > 0}
        />

        {/* Offline Alert Banner */}
        {!isOnline && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                <strong>Offline Mode:</strong> JARVIS is utilizing local offline cache.
                Your conversations are preserved and will synchronize automatically when
                reconnected.
              </span>
            </div>
          </div>
        )}

        {/* Chat / Hero Scroll Area */}
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

              {/* Loading / Thinking Indicator */}
              {isLoading && (
                <div className="py-4 px-3 md:px-6 bg-slate-900/30 border-y border-slate-800/40">
                  <div className="max-w-4xl mx-auto flex gap-3 md:gap-4 items-center">
                    <ArcReactorLogo size="sm" glow={true} />
                    <div className="flex items-center gap-2 text-xs md:text-sm text-cyan-300">
                      <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
                      <span className="font-mono">
                        {settings.webSearchEnabled
                          ? 'JARVIS is accessing real-time Google search knowledge...'
                          : 'JARVIS neural core is synthesizing response...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Bottom Prompt Input Area */}
        <PromptBar
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          webSearchEnabled={settings.webSearchEnabled}
          onToggleWebSearch={() =>
            setSettings((prev) => ({
              ...prev,
              webSearchEnabled: !prev.webSearchEnabled,
            }))
          }
          dualEngineEnabled={settings.dualEngineEnabled}
          onToggleDualEngine={() =>
            setSettings((prev) => ({
              ...prev,
              dualEngineEnabled: !prev.dualEngineEnabled,
            }))
          }
          showScrollBottom={showScrollBottom}
          onScrollToBottom={scrollToBottom}
        />
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={user}
        onSaveUser={(newUser) => setUser(newUser)}
        onTriggerSync={() => {
          setSyncStatus('syncing');
          syncToServer(user.id, conversations).then((res) => {
            setSyncStatus(res.success ? 'synced' : 'offline');
          });
        }}
        isSyncing={syncStatus === 'syncing'}
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
