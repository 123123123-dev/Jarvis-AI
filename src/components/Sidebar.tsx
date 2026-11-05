import React, { useState } from 'react';
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  Share2,
  Download,
  Pin,
  X,
  Sparkles,
} from 'lucide-react';
import { Conversation, UserProfile } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string, e: React.MouseEvent) => void;
  onClearAll: () => void;
  onTogglePin: (id: string, e: React.MouseEvent) => void;
  user: UserProfile;
  onOpenAuth: () => void;
  onExport: () => void;
  onShare: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  conversations,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClearAll,
  onTogglePin,
  user,
  onOpenAuth,
  onExport,
  onShare,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter conversations
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pinned first, then sorted by updatedAt desc
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-45 w-72 flex flex-col bg-[#080d16] border-r border-cyan-950/70 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } shrink-0 select-none`}
      >
        {/* Top Header inside sidebar on mobile */}
        <div className="p-3.5 pb-2 flex items-center justify-between md:hidden">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            JARVIS Menu
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 pb-2">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 hover:border-cyan-500/50 text-slate-100 text-xs font-medium transition-colors group cursor-pointer shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform" />
              <span>New Chat</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono border border-slate-700">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Guest Mode / Cloud Sync Card */}
        <div className="px-3 py-1">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  user.isGuest ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
                }`}
              />
              <span className="text-slate-200 font-medium text-[11px]">
                {user.isGuest ? 'Guest Mode' : 'Cloud Sync Active'}
              </span>
            </div>
            {user.isGuest ? (
              <button
                onClick={onOpenAuth}
                className="text-cyan-400 hover:text-cyan-300 font-semibold text-[11px] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400 font-mono">Live</span>
            )}
          </div>
        </div>

        {/* Search Chats Input */}
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 focus:border-cyan-500/60 focus:outline-none text-xs text-slate-200 placeholder-slate-500 transition-colors"
            />
          </div>
        </div>

        {/* Conversations Header */}
        <div className="px-3 py-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Conversations
          </span>
          {conversations.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-[10px] text-slate-400 hover:text-rose-400 font-medium transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {sortedConversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs leading-relaxed">
              {searchQuery ? (
                <p>No conversations matching &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                <div className="py-6 flex flex-col items-center justify-center space-y-2">
                  <MessageSquare className="w-6 h-6 text-slate-600 stroke-[1.5]" />
                  <p className="text-slate-400 font-medium">Guest session (Memory only)</p>
                  <p className="text-[11px] text-slate-400">
                    Chats reset on tab refresh
                  </p>
                </div>
              )}
            </div>
          ) : (
            sortedConversations.map((conv) => {
              const isActive = conv.id === activeChatId;
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSelectChat(conv.id);
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-200'
                      : 'hover:bg-slate-900/80 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-cyan-400' : 'text-slate-500'
                      }`}
                    />
                    <span className="truncate font-medium">{conv.title}</span>
                  </div>

                  {/* Actions: Pin & Delete */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => onTogglePin(conv.id, e)}
                      title={conv.pinned ? 'Unpin chat' : 'Pin chat'}
                      className={`p-1 rounded hover:bg-slate-800 ${
                        conv.pinned ? 'text-cyan-400 opacity-100' : 'text-slate-500'
                      }`}
                    >
                      <Pin className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => onDeleteChat(conv.id, e)}
                      title="Delete chat"
                      className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer: Export, Share, User Profile */}
        <div className="p-3 border-t border-slate-800/80 space-y-2 bg-[#060b13]">
          {/* Export & Share buttons side-by-side */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onExport}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export</span>
            </button>
            <button
              onClick={onShare}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-cyan-300 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Share</span>
            </button>
          </div>

          {/* User profile card */}
          <div
            onClick={onOpenAuth}
            className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 cursor-pointer transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-xs font-bold text-cyan-300">
              {user.isGuest ? 'G' : user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {user.name}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {user.isGuest
                  ? 'Chats reset on tab refresh'
                  : 'LGS Paragon · Lahore'}
              </div>
            </div>
            <Sparkles className="w-3.5 h-3.5 text-cyan-500/70 shrink-0" />
          </div>
        </div>
      </aside>
    </>
  );
};
