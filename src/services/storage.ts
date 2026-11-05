import { Conversation, UserProfile, AppSettings } from '../types';

const STORAGE_KEYS = {
  CONVERSATIONS: 'jarvis_conversations_v1',
  ACTIVE_CHAT_ID: 'jarvis_active_chat_id_v1',
  USER_PROFILE: 'jarvis_user_profile_v1',
  OFFLINE_QUEUE: 'jarvis_offline_sync_queue_v1',
  SETTINGS: 'jarvis_settings_v1',
};

export const defaultUser: UserProfile = {
  id: 'guest_user',
  name: 'Guest User',
  email: 'guest@jarvis.local',
  school: 'LGS Paragon, Lahore',
  isGuest: true,
};

export const defaultSettings: AppSettings = {
  voiceEnabled: false,
  webSearchEnabled: true,
  dualEngineEnabled: false,
  selectedModel: 'gemini-3.8-flash',
};

// Local storage management
export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load conversations from storage:', e);
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
  } catch (e) {
    console.error('Failed to save conversations to storage:', e);
  }
}

export function loadActiveChatId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
  } catch {
    return null;
  }
}

export function saveActiveChatId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
    }
  } catch {
    // ignore
  }
}

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!raw) return defaultUser;
    return JSON.parse(raw);
  } catch {
    return defaultUser;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save profile:', e);
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

// Real-time Cloud Synchronization
export async function syncToServer(
  userId: string,
  conversations: Conversation[]
): Promise<{ success: boolean; syncedAt?: number; error?: string }> {
  if (!navigator.onLine) {
    // Enqueue for offline sync
    try {
      localStorage.setItem(
        STORAGE_KEYS.OFFLINE_QUEUE,
        JSON.stringify({ userId, conversations, queuedAt: Date.now() })
      );
    } catch {
      // ignore
    }
    return { success: false, error: 'Offline mode active. Queued locally for sync.' };
  }

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, chats: conversations }),
    });

    if (!res.ok) {
      throw new Error(`Sync server responded with ${res.status}`);
    }

    const data = await res.json();
    // Clear offline queue on successful sync
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return { success: true, syncedAt: data.syncedAt };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Flush offline queue when returning online
export async function flushOfflineQueue(): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    const queueRaw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    if (!queueRaw) return true;
    const { userId, conversations } = JSON.parse(queueRaw);
    const result = await syncToServer(userId, conversations);
    return result.success;
  } catch {
    return false;
  }
}

import { jsPDF } from 'jspdf';

// Export conversation utilities
export function exportConversationToFile(
  conv: Conversation,
  format: 'pdf' | 'markdown' | 'json' | 'text' = 'pdf'
) {
  let content = '';
  let filename = `${conv.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;
  let mimeType = 'text/plain';

  // 1. PDF Export
  if (format === 'pdf') {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const checkPageBreak = (neededHeight: number) => {
      if (y + neededHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // Header banner
    doc.setFillColor(6, 11, 19); // Stark dark background
    doc.rect(margin, y - 5, contentWidth, 22, 'F');

    doc.setTextColor(34, 211, 238); // Cyan
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('JARVIS AI · INTERACTION TRANSCRIPT', margin + 6, y + 4);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('Developed by Abdullah Waheed (LGS Paragon, Lahore)', margin + 6, y + 11);

    y += 26;

    // Metadata card
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 14, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 14, 'S');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    const titleLines = doc.splitTextToSize(`Topic: ${conv.title}`, contentWidth - 45);
    doc.text(titleLines[0] || conv.title, margin + 4, y + 6);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Exported: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      margin + 4,
      y + 11
    );
    doc.text(`Messages: ${conv.messages.length}`, pageWidth - margin - 30, y + 11);

    y += 20;

    // Messages sequence
    for (const msg of conv.messages) {
      const isUser = msg.role === 'user';
      const roleTitle = isUser ? '👤 USER' : '⚡ JARVIS AI (ASSISTANT)';
      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      checkPageBreak(25);

      // Sender tag
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      if (isUser) {
        doc.setTextColor(2, 132, 199); // Sky blue
      } else {
        doc.setTextColor(13, 148, 136); // Teal/cyan
      }
      doc.text(`${roleTitle}  ·  ${timeStr}`, margin, y);
      y += 5;

      // Clean markdown syntax for PDF formatting
      const cleanContent = msg.content
        .replace(/###\s+/g, '')
        .replace(/##\s+/g, '')
        .replace(/#\s+/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/```[a-z]*\n?/gi, '')
        .replace(/!\[.*?\]\(.*?\)/g, '[Embedded Artwork / Image]')
        .trim();

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85); // Slate 700

      const lines = doc.splitTextToSize(cleanContent, contentWidth);
      for (const line of lines) {
        checkPageBreak(5);
        doc.text(line, margin, y);
        y += 4.5;
      }

      // Grounding sources
      if (msg.sources && msg.sources.length > 0) {
        checkPageBreak(12);
        y += 2;
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(71, 85, 105);
        doc.text('Sources Consulted:', margin, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(14, 116, 144);
        for (const s of msg.sources) {
          checkPageBreak(5);
          doc.text(`• ${s.title}: ${s.uri}`, margin + 3, y);
          y += 4;
        }
      }

      // Separator
      y += 4;
      checkPageBreak(6);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
      y += 7;
    }

    // Pagination footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(
        `JARVIS AI · Developed by Abdullah Waheed (LGS Paragon, Lahore) · Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    doc.save(`${filename}.pdf`);
    return;
  }

  // 2. Structured JSON Export
  if (format === 'json') {
    content = JSON.stringify(conv, null, 2);
    filename += '.json';
    mimeType = 'application/json';
  } else if (format === 'markdown') {
    // 3. Markdown Export
    mimeType = 'text/markdown';
    filename += '.md';
    content = `# ${conv.title}\n*JARVIS AI Assistant — Developed by Abdullah Waheed (LGS Paragon, Lahore)*\n*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`;
    for (const msg of conv.messages) {
      const roleName = msg.role === 'user' ? '👤 User' : '⚡ JARVIS';
      content += `### ${roleName} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n${msg.content}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        content += `**Google Grounded Sources:**\n`;
        for (const s of msg.sources) {
          content += `- [${s.title}](${s.uri})\n`;
        }
        content += `\n`;
      }
      content += `---\n\n`;
    }
  } else {
    // 4. Plain Text File (.txt) Export
    filename += '.txt';
    mimeType = 'text/plain;charset=utf-8';
    content = `================================================================================
JARVIS AI CONVERSATION TRANSCRIPT
Title: ${conv.title}
Date: ${new Date().toLocaleString()}
Developer: Abdullah Waheed (LGS Paragon, Lahore)
Total Messages: ${conv.messages.length}
================================================================================\n\n`;

    for (const msg of conv.messages) {
      const roleLabel = msg.role === 'user' ? 'USER' : 'JARVIS AI';
      const timeLabel = new Date(msg.timestamp).toLocaleTimeString();
      content += `[${roleLabel}] (${timeLabel})\n`;
      content += `--------------------------------------------------------------------------------\n`;
      content += `${msg.content}\n`;
      if (msg.sources && msg.sources.length > 0) {
        content += `\nSources:\n`;
        for (const s of msg.sources) {
          content += `  - ${s.title}: ${s.uri}\n`;
        }
      }
      content += `\n================================================================================\n\n`;
    }
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
