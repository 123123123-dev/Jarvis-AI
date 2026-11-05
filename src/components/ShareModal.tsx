import React, { useState } from 'react';
import { X, Share2, Copy, Check, MessageSquare } from 'lucide-react';
import { Conversation } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  conversation,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen || !conversation) return null;

  const shareUrl = window.location.href;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyFullText = () => {
    let text = `JARVIS AI Conversation: "${conversation.title}"\nDeveloped by Abdullah Waheed (LGS Paragon, Lahore)\n\n`;
    for (const msg of conversation.messages) {
      const author = msg.role === 'user' ? 'User' : 'JARVIS AI';
      text += `[${author}]: ${msg.content}\n\n`;
    }
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `JARVIS AI - ${conversation.title}`,
          text: `Check out this AI conversation on JARVIS AI (Developed by Abdullah Waheed, LGS Paragon): "${conversation.title}"`,
          url: shareUrl,
        });
      } catch {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#09101d] border border-cyan-500/30 p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Share Conversation</h3>
            <p className="text-xs text-slate-400 truncate max-w-[280px]">
              {conversation.title}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-4 leading-relaxed">
          Share this conversation with classmates or colleagues. You can copy the web app URL or
          copy the full dialog text directly to your clipboard.
        </p>

        <div className="space-y-2.5">
          {/* App URL Share */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="bg-transparent text-xs text-slate-300 flex-1 focus:outline-none px-1 truncate"
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>

          {/* Copy Full Transcript */}
          <button
            onClick={handleCopyFullText}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
          >
            {copiedText ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <MessageSquare className="w-4 h-4 text-cyan-400" />
            )}
            <span>{copiedText ? 'Transcript Copied to Clipboard!' : 'Copy Full Conversation Text'}</span>
          </button>

          {/* Native mobile share if supported */}
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full py-2.5 px-3 rounded-xl bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share via System Dialog</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
