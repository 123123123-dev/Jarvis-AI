import { Conversation, UserProfile, AppSettings } from '../types';

const SETTINGS_KEY = 'jarvis_settings_v1';

export const ACCOUNT_SESSION_TOKEN_KEY = 'jarvis_account_session';

export function getAccountAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem(ACCOUNT_SESSION_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getDirectSignInTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.pathname.match(/^\/app\/([a-f0-9]{64})$/i);
  return match?.[1] || null;
}

export function getDirectSignInUrl(token: string): string {
  if (typeof window === 'undefined') return '';
  return new URL(`/app/${token}`, window.location.origin).toString();
}

export const defaultUser: UserProfile = {
  id: 'guest_user',
  name: 'Guest User',
  email: '',
  isGuest: true,
};

export const defaultSettings: AppSettings = {
  voiceEnabled: false,
  webSearchEnabled: true,
  dualEngineEnabled: false,
  selectedModel: 'jarvis-turbo',
};

export function isConversationArchive(value: unknown): value is Conversation {
  if (!value || typeof value !== 'object') return false;
  const conversation = value as Record<string, unknown>;
  if (
    typeof conversation.id !== 'string' ||
    typeof conversation.title !== 'string' ||
    typeof conversation.createdAt !== 'number' ||
    typeof conversation.updatedAt !== 'number' ||
    !Array.isArray(conversation.messages)
  ) {
    return false;
  }

  return conversation.messages.every((message: unknown) => {
    if (!message || typeof message !== 'object') return false;
    const item = message as Record<string, unknown>;
    if (
      typeof item.id !== 'string' ||
      (item.role !== 'user' && item.role !== 'assistant') ||
      typeof item.content !== 'string' ||
      typeof item.timestamp !== 'number'
    ) {
      return false;
    }

    if (item.attachments !== undefined && !Array.isArray(item.attachments)) return false;
    if (
      Array.isArray(item.attachments) &&
      !item.attachments.every((attachment: unknown) => {
        if (!attachment || typeof attachment !== 'object') return false;
        const file = attachment as Record<string, unknown>;
        return (
          typeof file.id === 'string' &&
          typeof file.name === 'string' &&
          typeof file.type === 'string' &&
          typeof file.size === 'number' &&
          typeof file.data === 'string'
        );
      })
    ) {
      return false;
    }

    if (
      item.sources !== undefined &&
      (!Array.isArray(item.sources) ||
        !item.sources.every(
          (source: unknown) =>
            source !== null &&
            typeof source === 'object' &&
            typeof (source as Record<string, unknown>).uri === 'string' &&
            typeof (source as Record<string, unknown>).title === 'string'
        ))
    ) {
      return false;
    }

    return item.imageUrl === undefined || typeof item.imageUrl === 'string';
  });
}

export function loadSettings(): AppSettings {
  try {
    const raw = sessionStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const settings = { ...defaultSettings, ...JSON.parse(raw) };
    if (settings.selectedModel === 'gemini-3.8-flash' || settings.selectedModel === 'gemini-2.5-flash' || settings.selectedModel === 'gemini-3.5-flash-lite') {
      settings.selectedModel = 'jarvis-turbo';
    } else if (settings.selectedModel === 'gemini-4-argon' || settings.selectedModel === 'gemini-2.5-pro' || settings.selectedModel === 'gemini-3.1-pro-preview') {
      settings.selectedModel = 'jarvis-pro';
    } else if (settings.selectedModel === 'art-studio') {
      settings.selectedModel = 'jarvis-art';
    }
    return settings;
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    sessionStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

import { jsPDF } from 'jspdf';

// Export conversation utilities
export function exportConversationToFile(
  conv: Conversation,
  format: 'pdf' | 'markdown' | 'json' | 'text' | 'html' = 'pdf'
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
    doc.text('Private conversation transcript', margin + 6, y + 11);

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
        `JARVIS AI · Page ${i} of ${totalPages}`,
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
  } else if (format === 'html') {
    const appUrl = new URL('/', window.location.origin).toString();
    const escapeHtml = (value: string) =>
      value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] || character);
    const safeImageData = (value?: string) =>
        value && /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\r\n]+$/i.test(value)
          ? value
          : null;
    const messages = conv.messages.map((msg) => {
      const images = [
        ...(msg.imageUrl ? [msg.imageUrl] : []),
        ...(msg.attachments || [])
          .filter((attachment) => attachment.type.startsWith('image/'))
          .map((attachment) => attachment.data),
      ]
        .map(safeImageData)
        .filter((image): image is string => image !== null)
        .map((image) => `<img src="${escapeHtml(image)}" alt="Conversation image">`)
        .join('');
      const sources = (msg.sources || [])
        .map((source) => {
          const href = /^https?:\/\//i.test(source.uri) ? source.uri : '';
          return href
            ? `<li><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title || href)}</a></li>`
            : `<li>${escapeHtml(source.title || source.uri)}</li>`;
        })
        .join('');
      const attachments = (msg.attachments || [])
        .filter((attachment) => !attachment.type.startsWith('image/'))
        .map((attachment) => `<li>${escapeHtml(attachment.name)}</li>`)
        .join('');
      const role = msg.role === 'user' ? 'You' : 'JARVIS';
      return `<article class="message ${msg.role}">
        <div class="message-heading"><strong>${role}</strong><time>${new Date(msg.timestamp).toLocaleString()}</time></div>
        <div class="message-content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
        ${images ? `<div class="images">${images}</div>` : ''}
        ${attachments ? `<ul class="attachments">${attachments}</ul>` : ''}
        ${sources ? `<details><summary>Sources</summary><ul>${sources}</ul></details>` : ''}
      </article>`;
    }).join('\n');
    const htmlTitle = escapeHtml(conv.title);
    const serializedConversation = JSON.stringify(conv).replace(/</g, '\\u003c');
    content = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Portable, offline JARVIS AI conversation archive">
  <title>${htmlTitle} - JARVIS AI</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#060b13;color:#e2e8f0}
    *{box-sizing:border-box}body{margin:0;min-height:100vh}.layout{min-height:100vh}
    main{width:min(100%,1200px);margin:0 auto;padding:18px 20px 36px}.topline{color:#22d3ee;font-size:12px;text-transform:uppercase;letter-spacing:.12em}
    h1{font-size:clamp(22px,4vw,32px);margin:10px 0 6px;overflow-wrap:anywhere}.meta{color:#94a3b8;font-size:12px;margin-bottom:16px}
    .message{margin:14px 0;padding:16px;border:1px solid #1e293b;border-radius:14px;background:#0b1220;overflow-wrap:anywhere}
    .message.user{background:#0b1c2a;border-color:#164e63}.message-heading{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px;color:#67e8f9;font-size:12px}
    time{color:#94a3b8;font-size:11px;text-align:right}.message-content{font-size:14px;line-height:1.7;white-space:normal}
    .images{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}.images img{max-width:min(100%,420px);max-height:420px;object-fit:contain;border-radius:10px;border:1px solid #334155}
    ul{padding-left:20px;font-size:12px;line-height:1.7}a{color:#67e8f9}details{margin-top:12px;color:#94a3b8;font-size:12px}
    .notice{border:1px solid #334155;border-radius:10px;padding:12px;color:#94a3b8;font-size:12px;line-height:1.6;margin-bottom:16px}
    .app-frame{width:100%;height:calc(100vh - 190px);min-height:520px;border:1px solid #164e63;border-radius:12px;background:#080d16}
    .app-frame iframe{width:100%;height:100%;border:0;border-radius:inherit;background:#060b13}
    .fallback{margin-top:10px;border:0;border-radius:8px;padding:9px 12px;background:#164e63;color:#cffafe;font-size:12px;font-weight:600;cursor:pointer}
    .archive{margin-top:18px;padding:12px;border:1px solid #1e293b;border-radius:10px}
    @media(max-width:640px){main{padding:14px 10px 28px}.app-frame{height:calc(100vh - 210px);min-height:460px}}
    @media print{.app-frame,.notice,.fallback{display:none}body{background:white;color:#111}.message{break-inside:avoid;background:white;color:#111;border-color:#ccc}time,.meta{color:#555}}
  </style>
</head>
<body>
  <div class="layout">
    <main>
      <div class="topline">Conversation snapshot</div>
      <h1>${htmlTitle}</h1>
      <div class="meta">${conv.messages.length} messages · Exported ${new Date().toLocaleString()}</div>
      <div id="import-status" class="notice" role="status">Opening a signed-out JARVIS session with this conversation. Your imported guest chat is temporary and will not be saved after you close or refresh the app.</div>
      <div class="app-frame">
        <iframe id="jarvis-app" title="JARVIS AI chat with imported conversation"></iframe>
      </div>
      <button id="open-in-tab" class="fallback" type="button" hidden>Open JARVIS in a new tab</button>
      <details class="archive">
        <summary>View the saved conversation offline</summary>
        ${messages || '<p class="meta">This conversation has no messages yet.</p>'}
      </details>
    </main>
  </div>
  <script type="application/json" id="conversation-data">${serializedConversation}</script>
  <script>
    const appUrl = ${JSON.stringify(appUrl)};
    const appOrigin = new URL(appUrl).origin;
    const appFrame = document.getElementById('jarvis-app');
    const openInTabButton = document.getElementById('open-in-tab');
    const importStatus = document.getElementById('import-status');
    const conversation = JSON.parse(document.getElementById('conversation-data').textContent);
    const nonce = Date.now().toString(36) + Math.random().toString(36).slice(2);
    let appWindow = appFrame.contentWindow;

    const onAppMessage = (event) => {
      if (event.source !== appWindow || event.origin !== appOrigin || !event.data || event.data.nonce !== nonce) return;
      if (event.data.type === 'jarvis-portable-ready') {
        appWindow.postMessage({ type: 'jarvis-restore-conversation', nonce, conversation }, appOrigin);
      } else if (event.data.type === 'jarvis-portable-restored') {
        importStatus.textContent = 'Conversation opened in a signed-out JARVIS session. Continue chatting there; guest chats are not saved after closing or refreshing the app.';
        openInTabButton.hidden = true;
        window.clearTimeout(transferTimeout);
      }
    };

    window.addEventListener('message', onAppMessage);
    appFrame.src = appUrl + '#portable-import=' + encodeURIComponent(nonce);
    const transferTimeout = window.setTimeout(() => {
      importStatus.textContent = 'JARVIS did not load in this frame. You can try opening the app in a new tab.';
      openInTabButton.hidden = false;
    }, 15000);

    openInTabButton.addEventListener('click', () => {
      appWindow = window.open(appUrl + '#portable-import=' + encodeURIComponent(nonce), '_blank');
      if (!appWindow) importStatus.textContent = 'Please allow pop-ups for this file, then try again.';
    });
  </script>
</body>
</html>`;
    filename += '.html';
    mimeType = 'text/html;charset=utf-8';
  } else if (format === 'markdown') {
    // 3. Markdown Export
    mimeType = 'text/markdown';
    filename += '.md';
    content = `# ${conv.title}\n*JARVIS AI Assistant*\n*Exported: ${new Date().toLocaleString()}*\n\n---\n\n`;
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