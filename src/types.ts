export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 data URL
}

export interface SourceCitation {
  uri: string;
  title: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  sources?: SourceCitation[];
  imageUrl?: string;
  isError?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  pinned?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  school?: string;
  avatar?: string;
  isGuest: boolean;
}

export type AIModelId = 'gemini-3.8-flash' | 'gemini-4-argon' | 'art-studio';

export interface AppSettings {
  voiceEnabled: boolean;
  webSearchEnabled: boolean;
  dualEngineEnabled: boolean;
  selectedModel: AIModelId;
}

export interface AIModelOption {
  id: AIModelId;
  name: string;
  badge: string;
  description: string;
  speed: string;
}
