/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  WifiOff,
  Sparkles,
  Link2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
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
  Activity,
  ShieldAlert,
  Layers,
  Download,
  Trash2,
  Search,
  RefreshCw,
  Wrench,
  Menu,
  Paperclip,
  Globe,
  ArrowUp,
  LogIn,
  LogOut,
  Calendar as CalendarIcon,
  Keyboard,
  CheckCircle2,
  Plus,
  Home,
  Copy,
  Check,
  User,
  Share2,
  FileDown,
  Smartphone,
  Lock,
  Mail,
} from 'lucide-react';

// ============================================================================
// CORE TYPES
// ============================================================================

export type AIModelId = 'jarvis-turbo' | 'jarvis-deep' | 'jarvis-art';

export interface Attachment {
  name: string;
  type: string;
  data: string;
}

export interface SourceLink {
  uri: string;
  title: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  sources?: SourceLink[];
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
  isGuest: boolean;
}

export interface StoredAccountRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

export interface AppSettings {
  selectedModel: AIModelId;
  voiceEnabled: boolean;
  webSearchEnabled: boolean;
  dualEngineEnabled: boolean;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DEFAULT_USER: UserProfile = {
  id: 'guest',
  name: 'Guest Mode',
  email: '',
  isGuest: true,
};

const ACCOUNTS_REGISTRY_KEY = 'jarvis_registered_gmail_accounts_v1';

// Account-scoped storage helpers (Guest mode returns null -> NOTHING saved)
function getAccountStorageKeys(user: UserProfile) {
  if (user.isGuest || !user.email) return null;
  const slug = encodeURIComponent(user.email.toLowerCase().trim());
  return {
    conversations: `jarvis_acct_${slug}_conversations_v1`,
    memory: `jarvis_acct_${slug}_memory_v1`,
    gallery: `jarvis_acct_${slug}_gallery_v1`,
  };
}

function hashPasswordSimple(pw: string): string {
  let hash = 0;
  for (let i = 0; i < pw.length; i++) {
    hash = (hash << 5) - hash + pw.charCodeAt(i);
    hash |= 0;
  }
  return `jh_${Math.abs(hash).toString(16)}_${pw.length}`;
}

function loadRegisteredAccounts(): StoredAccountRecord[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_REGISTRY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRegisteredAccounts(records: StoredAccountRecord[]) {
  try {
    localStorage.setItem(ACCOUNTS_REGISTRY_KEY, JSON.stringify(records));
  } catch {
    // Ignore storage quota errors
  }
}

// ============================================================================
// URL ENCODING / DECODING FOR DIRECT ACCOUNT URL & FULL CHAT SHARING
// ============================================================================

function encodeSharePayload(payload: {
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
}): string {
  try {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch {
    return '';
  }
}

function decodeSharePayload(encoded: string): {
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
} | null {
  try {
    let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (parsed && Array.isArray(parsed.messages)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// GLOBAL ERROR BOUNDARY
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class JarvisErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error occurred.',
    };
  }

  componentDidMount() {
    window.addEventListener('error', this.handleWindowError);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleWindowError);
  }

  handleWindowError = (event: ErrorEvent) => {
    if (event?.message) {
      this.setState({ hasError: true, errorMessage: event.message });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full bg-[#030914] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900/95 border border-cyan-500/40 rounded-2xl p-6 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-cyan-300">JARVIS HUD Recovery</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              A runtime error was caught instead of showing a blank screen:
            </p>
            <div className="p-3 rounded-xl bg-slate-950 border border-rose-500/40 text-xs font-mono text-rose-300 break-words">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
            >
              Reload JARVIS
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// ARC REACTOR BADGE
// ============================================================================

function ArcReactorBadge({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-11 h-11';
  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-br from-cyan-400/30 to-blue-600/30 border border-cyan-400/80 shadow-[0_0_16px_rgba(34,211,238,0.65)] flex items-center justify-center shrink-0 relative`}
    >
      <div className="w-4 h-4 rounded-full border-2 border-cyan-300 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_#22d3ee]" />
      </div>
    </div>
  );
}

// ============================================================================
// SPECIALIST PROFILES & DATABASES
// ============================================================================

type ProfessionId =
  | 'general'
  | 'medical'
  | 'pharmacology'
  | 'mechanical-eng'
  | 'electrical-eng'
  | 'civil-eng'
  | 'aerospace-eng'
  | 'software'
  | 'cybersecurity'
  | 'legal'
  | 'finance'
  | 'science'
  | 'architecture'
  | 'business'
  | 'education'
  | 'creative';

interface ProfessionProfile {
  id: ProfessionId;
  name: string;
  shortName: string;
  category: string;
  description: string;
  badgeColor: string;
  systemDirective: string;
  disclaimer?: string;
}

interface MemoryEntry {
  id: string;
  category: 'Identity' | 'Profession' | 'Preference' | 'Project';
  content: string;
  createdAt: number;
}

interface GeneratedArtItem {
  id: string;
  prompt: string;
  style: string;
  aspectRatio: string;
  imageUrl: string;
  createdAt: number;
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

const NATURAL_CHAT_SYSTEM_PROMPT = `You are JARVIS, an intelligent, accurate, and helpful AI assistant.
Core rules:
1. Clean Notebook Writing Style (Strict):
  - Always write answers neatly just like a person writes by hand in a school or college notebook.
  - NEVER use LaTeX or formatting symbols such as $,$$, \\frac, \\times, **, *, #, ##, ###, ^, //, @, or backticks.
  - Write fractions simply with a slash like 1/2 or 4/8, powers like x² or x³, multiplication as ×, and division as ÷.
  - Write clear plain headings and numbered steps (Step 1:, Step 2:, 1., 2., 3.) without asterisks or hash symbols.
2. Single Standard/Formal Response by Default:
  - For general questions and all writing tasks (letters, applications, emails, essays, messages), provide ONLY ONE clean, direct answer in a standard, formal tone.
  - NEVER output multiple styles, versions, or variations unless the user explicitly asks to change the style.
3. Multi-Answer Questions ("full form of...", "types of...", "kinds of...", "meanings of..."):
  - When a question asks for full forms, meanings, or types/kinds/categories, list ALL major answers/types clearly in a numbered list unless the user says "only say one answer".`;

const PROFESSION_PROFILES: ProfessionProfile[] = [
  {
    id: 'general',
    name: 'JARVIS Omniscient Core',
    shortName: 'All-Domain Core',
    category: 'Universal',
    description: 'Universal intelligence across study help, writing, coding, science, and live news.',
    badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    systemDirective: 'Answer clearly, accurately, and directly in clean notebook style without formatting symbols.',
  },
  {
    id: 'medical',
    name: 'Medical & Clinical Intelligence',
    shortName: 'Medical & Health',
    category: 'Healthcare',
    description: 'Pathophysiology, differential considerations, diagnostic lab interpretation, and clinical guidelines.',
    badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    systemDirective: 'Provide clear clinical explanations of pathophysiology, differential considerations, and diagnostic markers.',
    disclaimer: 'Clinical Reference Mode: Educational medical information only — not a substitute for professional medical care.',
  },
  {
    id: 'pharmacology',
    name: 'Clinical Pharmacology & Toxicology',
    shortName: 'Pharmacology',
    category: 'Healthcare',
    description: 'Pharmacokinetics (ADME), receptor mechanisms, CYP450 drug interactions, and therapeutic monitoring.',
    badgeColor: 'text-teal-300 border-teal-500/40 bg-teal-500/10',
    systemDirective: 'Explain mechanisms of action, pharmacokinetics, drug interactions, and contraindications clearly.',
    disclaimer: 'Pharmacology Reference Mode: Verify all dosing and drug interactions with a licensed pharmacist or physician.',
  },
  {
    id: 'mechanical-eng',
    name: 'Mechanical & Thermodynamics Engineer',
    shortName: 'Mechanical Eng',
    category: 'Engineering',
    description: 'Statics, dynamics, FEA stress/strain, fluid mechanics, heat transfer, HVAC, and CAD/CAM.',
    badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    systemDirective: 'Provide clear mechanical engineering calculations, equations, and material considerations.',
  },
  {
    id: 'electrical-eng',
    name: 'Electrical, Power & Embedded Engineer',
    shortName: 'Electrical Eng',
    category: 'Engineering',
    description: 'Analog/digital circuits, PCB layout, power electronics, microcontrollers, and control theory.',
    badgeColor: 'text-yellow-300 border-yellow-500/40 bg-yellow-500/10',
    systemDirective: 'Provide clear circuit analysis, component sizing formulas, and embedded systems design.',
  },
  {
    id: 'civil-eng',
    name: 'Civil, Structural & Geotechnical Engineer',
    shortName: 'Civil & Structural',
    category: 'Engineering',
    description: 'Reinforced concrete, structural steel, seismic load design, foundation engineering, and hydraulics.',
    badgeColor: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
    systemDirective: 'Analyze structural loads, reinforced concrete design, foundation engineering, and hydraulics clearly.',
  },
  {
    id: 'aerospace-eng',
    name: 'Aerospace & Propulsion Systems Engineer',
    shortName: 'Aerospace Eng',
    category: 'Engineering',
    description: 'Aerodynamics, orbital mechanics, rocket propulsion (Isp, delta-v), avionics, and composites.',
    badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
    systemDirective: 'Provide clear aerospace engineering explanations covering aerodynamics, orbital mechanics, and propulsion.',
  },
  {
    id: 'software',
    name: 'Principal Software & AI Architect',
    shortName: 'Software & AI',
    category: 'Technology',
    description: 'Full-stack TypeScript/React, distributed systems, algorithms, databases, and DevOps.',
    badgeColor: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
    systemDirective: 'Deliver clean explanations and sound software architecture recommendations.',
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity & Zero-Trust Engineer',
    shortName: 'Cybersecurity',
    category: 'Security',
    description: 'Threat modeling, OWASP Top 10, cryptography, cloud IAM, and defensive hardening.',
    badgeColor: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
    systemDirective: 'Provide defensive cybersecurity guidance, vulnerability remediation, and zero-trust architecture.',
  },
  {
    id: 'legal',
    name: 'Legal & Regulatory Analyst',
    shortName: 'Legal & Policy',
    category: 'Law',
    description: 'Contract structure, intellectual property, compliance frameworks, and statutory analysis.',
    badgeColor: 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10',
    systemDirective: 'Break down contract clauses, compliance obligations, and legal concepts clearly.',
    disclaimer: 'Legal Analysis Mode: Educational regulatory and contract breakdown; consult qualified counsel.',
  },
  {
    id: 'finance',
    name: 'Quantitative Finance & Macro Strategist',
    shortName: 'Finance & Markets',
    category: 'Economics',
    description: 'Corporate valuation, DCF modeling, macroeconomics, portfolio risk, and financial statements.',
    badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    systemDirective: 'Provide clear financial analysis, valuation frameworks, and macroeconomic insights.',
  },
  {
    id: 'science',
    name: 'Scientific Research & Physics Fellow',
    shortName: 'Physics & Science',
    category: 'Research',
    description: 'Quantum mechanics, astrophysics, molecular biology, chemistry, and experimental methodology.',
    badgeColor: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
    systemDirective: 'Explain scientific concepts across physics, chemistry, and biology clearly and rigorously.',
  },
  {
    id: 'architecture',
    name: 'Architectural & Structural Designer',
    shortName: 'Architecture & CAD',
    category: 'Design',
    description: 'Sustainable building design, structural loads, urban planning, acoustics, and HVAC systems.',
    badgeColor: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
    systemDirective: 'Address architectural design, spatial planning, materials, and sustainable building systems.',
  },
  {
    id: 'business',
    name: 'Executive Strategy & Operations COO',
    shortName: 'Business & Ops',
    category: 'Leadership',
    description: 'Go-to-market strategy, unit economics, OKRs, supply chain optimization, and negotiations.',
    badgeColor: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
    systemDirective: 'Deliver practical business strategy, unit economics, and operational recommendations.',
  },
  {
    id: 'education',
    name: 'Master Educator & Socratic Tutor',
    shortName: 'Education & Tutor',
    category: 'Learning',
    description: 'Step-by-step intuitive explanations, exam prep, flashcards, and mental models for any subject.',
    badgeColor: 'text-lime-300 border-lime-500/40 bg-lime-500/10',
    systemDirective: 'Teach concepts step-by-step from beginner intuition to deeper mastery with clear examples.',
  },
  {
    id: 'creative',
    name: 'Creative Director & Narrative Studio',
    shortName: 'Creative & Media',
    category: 'Arts',
    description: 'Screenwriting, visual storytelling, brand identity, world-building, and art direction.',
    badgeColor: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10',
    systemDirective: 'Craft vivid, natural prose, stories, letters, scripts, and creative concepts.',
  },
];

const ENGINEERING_MATERIALS_DB = [
  { name: 'Structural Steel (ASTM A36)', density: 7850, youngsGPa: 200, yieldMPa: 250, thermalWmK: 50 },
  { name: 'Aerospace Aluminum (7075-T6)', density: 2810, youngsGPa: 71.7, yieldMPa: 503, thermalWmK: 130 },
  { name: 'Titanium Alloy (Ti-6Al-4V)', density: 4430, youngsGPa: 113.8, yieldMPa: 880, thermalWmK: 6.7 },
  { name: 'Carbon Fiber Epoxy (UD)', density: 1600, youngsGPa: 135, yieldMPa: 1500, thermalWmK: 5.0 },
  { name: 'Reinforced Concrete', density: 2400, youngsGPa: 30, yieldMPa: 40, thermalWmK: 1.7 },
  { name: 'Pure Copper (C11000)', density: 8940, youngsGPa: 117, yieldMPa: 69, thermalWmK: 398 },
];

const CLINICAL_LAB_REFERENCES = [
  { test: 'Hemoglobin (Hgb)', range: '13.5–17.5 (M) / 12.0–15.5 (F) g/dL', note: 'Oxygen-carrying capacity & anemia screening.' },
  { test: 'White Blood Cells (WBC)', range: '4.5–11.0 ×10³/µL', note: 'Infection, inflammation, and immune status.' },
  { test: 'Platelets (PLT)', range: '150–450 ×10³/µL', note: 'Primary hemostasis and blood clotting.' },
  { test: 'Fasting Blood Glucose', range: '70–99 mg/dL', note: '≥126 mg/dL diagnostic threshold for diabetes.' },
  { test: 'HbA1c', range: '< 5.7%', note: '2–3 month average glycemic control.' },
  { test: 'Serum Creatinine', range: '0.7–1.3 (M) / 0.6–1.1 (F) mg/dL', note: 'Renal filtration biomarker (eGFR).' },
  { test: 'TSH (Thyroid)', range: '0.4–4.0 mIU/L', note: 'Primary hypothyroidism / hyperthyroidism screen.' },
];

const NEWS_CATEGORIES = [
  { id: 'breaking', label: 'Top World & Breaking News', prompt: 'Give me a briefing from Google grounding of the biggest breaking world news and headlines today.' },
  { id: 'ai-tech', label: 'AI, Robotics & Tech', prompt: 'Give me today’s latest AI, robotics, and technology news from Google grounding.' },
  { id: 'markets', label: 'Global Markets & Economy', prompt: 'Give me today’s stock market and global economy headlines from Google grounding.' },
  { id: 'science-space', label: 'Science, Space & Energy', prompt: 'Give me the latest science, space, and energy discoveries from Google grounding.' },
  { id: 'medical-news', label: 'Medicine & Biotech Updates', prompt: 'Give me today’s latest medical and biotech news from Google grounding.' },
  { id: 'sports', label: 'Live Sports & Tournaments', prompt: 'Give me today’s major sports scores and headlines from Google grounding.' },
];

const IMAGE_STYLE_PRESETS = [
  { id: 'cinematic', label: 'Cinematic Photoreal 8K', suffix: 'photorealistic, 8k ultra-detailed, dramatic volumetric lighting, shot on 35mm lens' },
  { id: 'blueprint', label: 'JARVIS Holographic Blueprint', suffix: 'futuristic cyan and gold holographic CAD schematic blueprint on dark obsidian background' },
  { id: 'medical-3d', label: '3D Medical Illustration', suffix: 'high-precision 3D anatomical and cellular scientific visualization, studio lighting' },
  { id: 'concept-art', label: 'Sci-Fi Concept Art', suffix: 'epic futuristic concept art, atmospheric perspective, intricate mechanical detail' },
  { id: 'architecture', label: 'Architectural Render', suffix: 'modern luxury architectural visualization, golden hour sunlight, glass and concrete textures' },
  { id: 'anime', label: 'Studio Anime Illustration', suffix: 'high-budget theatrical anime key visual, vibrant lighting, expressive linework' },
];

const ACRONYM_KNOWLEDGE_BASE: Record<
  string,
  Array<{ expansion: string; domain: string; details: string }>
> = {
  DHA: [
    { expansion: 'Defence Housing Authority', domain: 'housing real estate pakistan', details: 'A major residential real estate and housing authority in Pakistan (Lahore, Karachi, Islamabad/Rawalpindi, Multan, Bahawalpur, Gujranwala, Peshawar, Quetta).' },
    { expansion: 'Docosahexaenoic Acid', domain: 'biology nutrition medicine', details: 'An essential omega-3 fatty acid that is a primary structural component of the human brain, cerebral cortex, skin, and retina.' },
    { expansion: 'Dubai Health Authority', domain: 'healthcare dubai uae', details: 'The government body responsible for overseeing healthcare services, hospitals, and medical licensing in Dubai, UAE.' },
    { expansion: 'District Health Authority', domain: 'health government punjab', details: 'Regional public health administrative bodies responsible for district-level hospitals and public healthcare delivery.' },
  ],
  ATM: [
    { expansion: 'Automated Teller Machine', domain: 'banking finance', details: 'An electronic banking outlet allowing customers to complete basic financial transactions without a branch representative.' },
    { expansion: 'Standard Atmosphere (unit)', domain: 'physics chemistry', details: 'A unit of pressure defined as 101,325 pascals (Pa), approximately equal to Earth’s average sea-level atmospheric pressure.' },
  ],
  SIM: [
    { expansion: 'Subscriber Identity Module', domain: 'mobile telecom', details: 'A smart card storing the International Mobile Subscriber Identity (IMSI) and cryptographic keys on mobile devices.' },
  ],
  CSS: [
    { expansion: 'Cascading Style Sheets', domain: 'web development', details: 'A stylesheet language used for describing the presentation, layout, colors, and typography of HTML documents.' },
    { expansion: 'Central Superior Services', domain: 'pakistan civil service', details: 'A premier competitive examination conducted by the Federal Public Service Commission (FPSC) in Pakistan.' },
  ],
};

// ============================================================================
// NOTEBOOK FORMATTER & SAFE MATH EVALUATOR
// ============================================================================

const SUPERSCRIPT_CHAR_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
};

function toUnicodeSuperscript(exp: string): string {
  return exp.split('').map((ch) => SUPERSCRIPT_CHAR_MAP[ch] ?? ch).join('');
}

function formatAsCleanNotebookText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?p>/gi, '\n');

  const preservedUrls: string[] = [];
  text = text.replace(/https?:\/\/[^\s)\]]+/g, (url) => {
    const token = `JARVISURLTOKEN${preservedUrls.length}END`;
    preservedUrls.push(url);
    return token;
  });

  text = text
    .replace(/\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pi\b/g, 'π')
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    .replace(/\^\{([^{}]+)\}/g, (_m, exp: string) => toUnicodeSuperscript(exp))
    .replace(/\^([0-9+-]+)/g, (_m, exp: string) => toUnicodeSuperscript(exp))
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/\*{1,3}/g, '')
    .replace(/`+/g, '');

  text = text.replace(/JARVISURLTOKEN(\d+)END/g, (_m, idxStr: string) => {
    return preservedUrls[Number(idxStr)] || '';
  });

  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function evaluateSafeMathExpression(rawExpr: string): number {
  const sanitized = rawExpr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/(\d)\s*\(/g, '$1*(')
    .replace(/\)\s*(\d)/g, ')*$1')
    .replace(/(\d)\s*(pi|e|sin|cos|tan|sqrt|log|ln|abs)\b/gi, '$1*$2')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/π/g, 'pi')
    .replace(/\*\*/g, '^');

  if (!sanitized) throw new Error('Enter a mathematical expression.');
  if (!/^[0-9a-z+\-*/^().]+$/.test(sanitized)) {
    throw new Error('Unsupported characters in expression.');
  }

  let pos = 0;
  const peek = () => sanitized[pos] || '';
  const consume = () => sanitized[pos++];

  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      value = op === '+' ? value + right : value - right;
    }
    return value;
  };

  const parseTerm = (): number => {
    let value = parsePower();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parsePower();
      if (op === '/') {
        if (right === 0) throw new Error('Division by zero.');
        value /= right;
      } else {
        value *= right;
      }
    }
    return value;
  };

  const parsePower = (): number => {
    let base = parseUnary();
    if (peek() === '^') {
      consume();
      base = Math.pow(base, parsePower());
    }
    return base;
  };

  const parseUnary = (): number => {
    if (peek() === '+') {
      consume();
      return parseUnary();
    }
    if (peek() === '-') {
      consume();
      return -parseUnary();
    }
    return parsePrimary();
  };

  const parsePrimary = (): number => {
    if (peek() === '(') {
      consume();
      const inside = parseExpression();
      if (peek() !== ')') throw new Error('Mismatched parentheses.');
      consume();
      return inside;
    }
    if (/[a-z]/.test(peek())) {
      let ident = '';
      while (/[a-z]/.test(peek())) ident += consume();
      if (ident === 'pi') return Math.PI;
      if (ident === 'e') return Math.E;
      if (peek() !== '(') throw new Error(`Expected '(' after ${ident}.`);
      consume();
      const arg = parseExpression();
      if (peek() !== ')') throw new Error(`Expected ')' after ${ident}.`);
      consume();
      switch (ident) {
        case 'sin': return Math.sin(arg);
        case 'cos': return Math.cos(arg);
        case 'tan': return Math.tan(arg);
        case 'sqrt':
          if (arg < 0) throw new Error('Square root of negative number.');
          return Math.sqrt(arg);
        case 'log': return Math.log10(arg);
        case 'ln': return Math.log(arg);
        case 'abs': return Math.abs(arg);
        default: throw new Error(`Unknown function: ${ident}`);
      }
    }
    let numStr = '';
    while (/[0-9.]/.test(peek())) numStr += consume();
    if (!numStr) throw new Error(`Unexpected token "${peek()}"`);
    const parsed = Number(numStr);
    if (!Number.isFinite(parsed)) throw new Error('Invalid number.');
    return parsed;
  };

  const result = parseExpression();
  if (pos !== sanitized.length) throw new Error('Unexpected trailing characters.');
  if (!Number.isFinite(result)) throw new Error('Calculation overflow.');
  return result;
}

function formatCleanNumber(num: number): string {
  if (Math.abs(num) < 1e-12) return '0';
  if (Number.isInteger(num)) return String(num);
  return Number(num.toPrecision(10)).toString();
}

function solveMathOrEquation(rawInput: string): string | null {
  const cleaned = rawInput
    .trim()
    .replace(/^(?:what\s+is|calculate|compute|solve|evaluate|simplify)\s+/i, '')
    .replace(/[?]+$/g, '')
    .trim();

  if (!cleaned) return null;

  const linearMatch = cleaned.match(
    /^([+-]?\d*\.?\d*)\s*([a-zA-Z])\s*([+-]\s*\d+\.?\d*)?\s*=\s*([+-]?\d+\.?\d*)$/
  );
  if (linearMatch) {
    const aRaw = linearMatch[1];
    const variable = linearMatch[2];
    const bRaw = (linearMatch[3] || '0').replace(/\s+/g, '');
    const cRaw = linearMatch[4];
    const a = aRaw === '' || aRaw === '+' ? 1 : aRaw === '-' ? -1 : Number(aRaw);
    const b = Number(bRaw);
    const c = Number(cRaw);
    if (Number.isFinite(a) && a !== 0 && Number.isFinite(b) && Number.isFinite(c)) {
      const rhs = c - b;
      const ans = rhs / a;
      return [
        `Given equation: ${cleaned}`,
        `Step 1: Move constant to the right side: ${a}${variable} = ${formatCleanNumber(rhs)}`,
        `Step 2: Divide both sides by ${a}: ${variable} = ${formatCleanNumber(ans)}`,
      ].join('\n');
    }
  }

  const stripped = cleaned.replace(/\b(?:pi|e|sin|cos|tan|sqrt|log|ln|abs)\b/gi, '').trim();
  if (/\d/.test(stripped) && /[+\-*/^()]/.test(stripped) && /^[0-9+\-*/^().\s]+$/.test(stripped)) {
    try {
      const value = evaluateSafeMathExpression(cleaned);
      return `${cleaned} = ${formatCleanNumber(value)}`;
    } catch {
      return null;
    }
  }
  return null;
}

function getInstantGreetingReply(text: string): string | null {
  const cleaned = text.trim().toLowerCase().replace(/[!?.]+$/g, '');
  if (/^(?:hi|hello|hey|yo|greetings)$/.test(cleaned)) {
    return 'Hello! How can I help you today?';
  }
  if (/^(?:assalam\s*o?\s*alaikum|salam|as-salamu alaykum)$/.test(cleaned)) {
    return 'Wa Alaikum Assalam! How can I help you today?';
  }
  if (/^(?:how are you|how r u|how are you doing)$/.test(cleaned)) {
    return "I'm operating at peak efficiency, thank you! How can I assist you today?";
  }
  return null;
}

function resolveCuratedAcronym(text: string): string | null {
  const isFullForm = /\b(?:full\s*form|stands?\s+for|acronym|meaning)\b/i.test(text);
  const match = text.match(/\b([A-Z]{2,8})\b/) || text.match(/(?:full\s*form\s+of\s+)([a-zA-Z]{2,8})\b/i);
  const acronym = match ? match[1].toUpperCase() : '';
  if (!isFullForm || !acronym || !ACRONYM_KNOWLEDGE_BASE[acronym]) return null;

  const entries = ACRONYM_KNOWLEDGE_BASE[acronym];
  const lines = entries.map((e, i) => `${i + 1}. ${e.expansion} — ${e.details}`).join('\n');
  return `Here are the major full forms of ${acronym}:\n\n${lines}`;
}

function isImagePrompt(text: string): boolean {
  return /\b(?:create|generate|draw|render|design|make)\s+(?:an?\s+)?(?:image|picture|photo|art|artwork|illustration|logo|wallpaper|diagram|car|scene)\b/i.test(
    text
  );
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<Response> {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(id);
  }
}

async function fetchLiveGoogleNews(
  query: string
): Promise<{ contextText: string; sources: SourceLink[] }> {
  const cleanTopic = query
    .replace(/give me (?:a briefing from google grounding of|today['’]s|the)|from google grounding/gi, '')
    .trim()
    .slice(0, 80);

  const rssUrl =
    !cleanTopic || /breaking world news|top world/i.test(query)
      ? 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
      : `https://news.google.com/rss/search?q=${encodeURIComponent(cleanTopic)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetchWithTimeout(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`,
      {},
      4000
    );
    if (!res.ok) return { contextText: '', sources: [] };
    const data = (await res.json()) as {
      items?: Array<{ title?: string; pubDate?: string; link?: string }>;
    };
    const items = (data.items || []).filter((i) => i.title && i.link).slice(0, 6);
    if (items.length === 0) return { contextText: '', sources: [] };

    return {
      contextText: items.map((i, idx) => `${idx + 1}. ${i.title}`).join('\n'),
      sources: items.map((i) => ({ uri: i.link!, title: i.title! })),
    };
  } catch {
    return { contextText: '', sources: [] };
  }
}

async function generateFreeImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' = '1:1'
): Promise<string> {
  const dims = {
    '1:1': { w: 768, h: 768 },
    '16:9': { w: 1024, h: 576 },
    '9:16': { w: 576, h: 1024 },
    '4:3': { w: 896, h: 672 },
  }[aspectRatio];
  const seed = Math.floor(Math.random() * 999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 450))}?width=${dims.w}&height=${dims.h}&nologo=true&seed=${seed}`;
}

async function compressImageDataUrl(dataUrl: string, maxSide = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        const scale = maxSide / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function extractTextViaFreeOcr(imageDataUrl: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('base64Image', imageDataUrl);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');

    const res = await fetchWithTimeout(
      'https://api.ocr.space/parse/image',
      {
        method: 'POST',
        headers: { apikey: 'helloworld' },
        body: formData,
      },
      12000
    );
    if (!res.ok) return '';
    const data = (await res.json()) as {
      ParsedResults?: Array<{ ParsedText?: string }>;
    };
    return (data.ParsedResults?.[0]?.ParsedText || '').trim();
  } catch {
    return '';
  }
}

async function queryFreeAiResponse(
  history: Array<{ role: string; content: string; attachments?: Attachment[] }>,
  systemInstruction: string,
  liveNewsContext: string
): Promise<string> {
  const latestMsg = history[history.length - 1];
  const latestUser = latestMsg?.content || 'Analyze this image.';
  const latestAttachments = latestMsg?.attachments || [];
  const imageAttachments = latestAttachments.filter(
    (a) => a.type.startsWith('image/') || a.data.startsWith('data:image/')
  );

  const compressedImages: string[] = [];
  for (const img of imageAttachments.slice(0, 3)) {
    compressedImages.push(await compressImageDataUrl(img.data));
  }

  const apiMessages: Array<{
    role: string;
    content:
      | string
      | Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string } }
        >;
  }> = [{ role: 'system', content: systemInstruction }];

  const sliceArr = history.slice(-8);
  for (let i = 0; i < sliceArr.length; i++) {
    const m = sliceArr[i];
    const isLast = i === sliceArr.length - 1;

    if (isLast && m.role === 'user' && compressedImages.length > 0) {
      const promptText =
        m.content.trim() ||
        'Read all text and details in this image carefully and answer or rewrite clearly.';
      apiMessages.push({
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          ...compressedImages.map((url) => ({
            type: 'image_url' as const,
            image_url: { url },
          })),
        ],
      });
    } else if (isLast && m.role === 'user' && liveNewsContext) {
      apiMessages.push({
        role: 'user',
        content: `Latest News Headlines:\n${liveNewsContext}\n\nSummarize these headlines clearly for: ${m.content}`,
      });
    } else {
      apiMessages.push({ role: m.role, content: m.content });
    }
  }

  try {
    const backendRes = await fetchWithTimeout(
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          systemInstruction,
          attachments: latestAttachments,
        }),
      },
      10000
    );
    if (backendRes.ok) {
      const data = (await backendRes.json()) as { content?: string };
      if (data?.content) return formatAsCleanNotebookText(data.content);
    }
  } catch {
    // Fallback to cloud multimodal vision
  }

  try {
    const res = await fetchWithTimeout(
      'https://text.pollinations.ai/openai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'openai',
          messages: apiMessages,
          private: true,
        }),
      },
      16000
    );
    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      if (text && !text.startsWith('<html')) {
        return formatAsCleanNotebookText(text);
      }
    }
  } catch {
    // Fallback to OCR if image was attached
  }

  if (compressedImages.length > 0) {
    const ocrText = await extractTextViaFreeOcr(compressedImages[0]);
    if (ocrText) {
      const combinedPrompt = `${systemInstruction}\n\nText extracted from the user's uploaded image:\n"""\n${ocrText}\n"""\n\nUser instruction: ${latestUser}`;
      try {
        const ocrAiRes = await fetchWithTimeout(
          'https://text.pollinations.ai/openai',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'openai',
              messages: [{ role: 'user', content: combinedPrompt }],
              private: true,
            }),
          },
          12000
        );
        if (ocrAiRes.ok) {
          const data = (await ocrAiRes.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const reply = data.choices?.[0]?.message?.content?.trim();
          if (reply) return formatAsCleanNotebookText(reply);
        }
      } catch {
        // Return extracted OCR text directly
      }
      return formatAsCleanNotebookText(`Text read from your image:\n\n${ocrText}`);
    }
    return 'I received your image, but the vision server timed out. Please try sending it again.';
  }

  try {
    const prompt = liveNewsContext
      ? `${liveNewsContext}\n\nSummarize clearly: ${latestUser}`
      : `${systemInstruction}\n\nQuestion: ${latestUser}`;
    const res = await fetchWithTimeout(
      `https://text.pollinations.ai/${encodeURIComponent(prompt.slice(0, 750))}?model=openai`,
      {},
      10000
    );
    if (res.ok) {
      const txt = (await res.text()).trim();
      if (txt && !txt.startsWith('<html')) return formatAsCleanNotebookText(txt);
    }
  } catch {
    // Final fallback
  }

  if (liveNewsContext) return liveNewsContext;
  return 'I am online and ready. Please rephrase or share a bit more detail so I can help.';
}

// ============================================================================
// MAIN HUD WORKSPACE COMPONENT
// ============================================================================

function JarvisWorkspace() {
  const initialBootState = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      const acctEmail = url.searchParams.get('account')?.toLowerCase().trim() || '';
      const sharedToken = url.searchParams.get('share') || '';

      let bootedUser: UserProfile = DEFAULT_USER;
      if (acctEmail && acctEmail.endsWith('@gmail.com')) {
        const accounts = loadRegisteredAccounts();
        const found = accounts.find((a) => a.email.toLowerCase() === acctEmail);
        if (found) {
          bootedUser = {
            id: found.id,
            name: found.name,
            email: found.email,
            isGuest: false,
          };
        }
      }

      let sharedConv: Conversation | null = null;
      if (sharedToken) {
        const decoded = decodeSharePayload(sharedToken);
        if (decoded && decoded.messages.length > 0) {
          sharedConv = {
            id: 'shared_' + Math.random().toString(36).substring(2, 9),
            title: decoded.title || 'Shared JARVIS Session',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messages: decoded.messages.map((m, idx) => ({
              id: `sh_${idx}_${Math.random().toString(36).substring(2, 6)}`,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp || Date.now(),
            })),
          };
        }
      }

      return { bootedUser, sharedConv };
    } catch {
      return { bootedUser: DEFAULT_USER, sharedConv: null };
    }
  }, []);

  const [user, setUser] = useState<UserProfile>(initialBootState.bootedUser);

  // Conversations: ONLY loaded from device storage if signed in (Guest starts empty)
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const keys = getAccountStorageKeys(initialBootState.bootedUser);
    let saved: Conversation[] = [];
    if (keys) {
      try {
        const raw = localStorage.getItem(keys.conversations);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) saved = parsed;
      } catch {
        saved = [];
      }
    }
    if (initialBootState.sharedConv) {
      return [initialBootState.sharedConv, ...saved];
    }
    return saved;
  });

  // Always reset to fresh Core HUD on refresh (unless a shared link was just opened)
  const [activeChatId, setActiveChatId] = useState<string | null>(
    initialBootState.sharedConv ? initialBootState.sharedConv.id : null
  );

  useEffect(() => {
    if (initialBootState.sharedConv) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('share');
        window.history.replaceState({}, '', url.toString());
      } catch {
        // Ignore
      }
    }
  }, [initialBootState.sharedConv]);

  // Settings reset cleanly on every tab refresh
  const [settings, setSettings] = useState<AppSettings>({
    selectedModel: 'jarvis-turbo',
    voiceEnabled: false,
    webSearchEnabled: false,
    dualEngineEnabled: false,
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [mobileHudTab, setMobileHudTab] = useState<'center' | 'left' | 'right'>('center');
  const [accountNotice, setAccountNotice] = useState('');

  // Gmail + Password Auth Modal State
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');
  const [authNameInput, setAuthNameInput] = useState('');
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authPasswordInput, setAuthPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Export & Share Modal State
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [generatedShareUrl, setGeneratedShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);

  // Direct Native PWA Install State (NO instruction modal!)
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);

  // Question & Voice Capsule State
  const [questionInput, setQuestionInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [voiceConversationAllowed, setVoiceConversationAllowed] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceInterimTranscript, setVoiceInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [voiceAutoLoop, setVoiceAutoLoop] = useState(true);
  const [voiceLang, setVoiceLang] = useState('en-US');

  // Specialist resets on every refresh
  const [activeProfessionId, setActiveProfessionId] = useState<ProfessionId>('general');

  // Memory & Gallery ONLY saved/loaded for signed-in accounts
  const [memories, setMemories] = useState<MemoryEntry[]>(() => {
    const keys = getAccountStorageKeys(initialBootState.bootedUser);
    if (!keys) return [];
    try {
      const raw = localStorage.getItem(keys.memory);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [artGallery, setArtGallery] = useState<GeneratedArtItem[]>(() => {
    const keys = getAccountStorageKeys(initialBootState.bootedUser);
    if (!keys) return [];
    try {
      const raw = localStorage.getItem(keys.gallery);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Modals
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [professionsModalOpen, setProfessionsModalOpen] = useState(false);
  const [imageStudioOpen, setImageStudioOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [liveClock, setLiveClock] = useState(() => new Date());

  // Studio & Workbench States
  const [studioPrompt, setStudioPrompt] = useState('');
  const [studioStyle, setStudioStyle] = useState(IMAGE_STYLE_PRESETS[0].id);
  const [studioAspectRatio, setStudioAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [studioGenerating, setStudioGenerating] = useState(false);

  const [workbenchTab, setWorkbenchTab] = useState<
    'calc' | 'ohms' | 'units' | 'materials' | 'clinical' | 'labs'
  >('calc');
  const [calcInput, setCalcInput] = useState('sqrt(144) + (25 * 4) / 2');
  const [calcResult, setCalcResult] = useState('62');
  const [calcError, setCalcError] = useState('');
  const [ohmsVoltage, setOhmsVoltage] = useState('12');
  const [ohmsResistance, setOhmsResistance] = useState('470');
  const [unitCategory, setUnitCategory] = useState<'length' | 'pressure' | 'energy' | 'temp'>('pressure');
  const [unitValue, setUnitValue] = useState('101325');
  const [clinicalWeightKg, setClinicalWeightKg] = useState('72');
  const [clinicalHeightCm, setClinicalHeightCm] = useState('176');
  const [clinicalAge, setClinicalAge] = useState('30');

  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryEntry['category']>('Profession');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [professionSearch, setProfessionSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceAllowedRef = useRef(false);
  const voiceAutoLoopRef = useRef(true);

  useEffect(() => {
    voiceAllowedRef.current = voiceConversationAllowed;
  }, [voiceConversationAllowed]);

  useEffect(() => {
    voiceAutoLoopRef.current = voiceAutoLoop;
  }, [voiceAutoLoop]);

  // Persist chats, memory, and images ONLY when user is signed in (Guest mode saves nothing)
  useEffect(() => {
    const keys = getAccountStorageKeys(user);
    if (!keys) return;
    try {
      const compactConvs = conversations.slice(0, 40).map((c) => ({
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          attachments: m.attachments?.map((a) => ({
            name: a.name,
            type: a.type,
            data: a.data.length > 250000 ? '' : a.data,
          })),
        })),
      }));
      localStorage.setItem(keys.conversations, JSON.stringify(compactConvs));
    } catch {
      // Ignore quota errors
    }
  }, [conversations, user]);

  useEffect(() => {
    const keys = getAccountStorageKeys(user);
    if (!keys) return;
    try {
      localStorage.setItem(keys.memory, JSON.stringify(memories));
    } catch {
      // Ignore
    }
  }, [memories, user]);

  useEffect(() => {
    const keys = getAccountStorageKeys(user);
    if (!keys) return;
    try {
      localStorage.setItem(keys.gallery, JSON.stringify(artGallery.slice(0, 24)));
    } catch {
      // Ignore
    }
  }, [artGallery, user]);

  // Register Service Worker & capture native browser Install prompt
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setAppInstalled(true);
      setDeferredInstallPrompt(null);
      setAccountNotice('JARVIS has been installed directly onto your device!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Auto-trigger native install if opened with ?autoinstall=1
  useEffect(() => {
    if (!deferredInstallPrompt) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('autoinstall') === '1') {
      url.searchParams.delete('autoinstall');
      window.history.replaceState({}, '', url.toString());
      void deferredInstallPrompt.prompt();
    }
  }, [deferredInstallPrompt]);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ==========================================================================
  // GMAIL + PASSWORD SIGN UP, DIRECT SIGN IN, AND URL ACCOUNT ROUTING
  // ==========================================================================

  const syncAccountUrl = (profile: UserProfile) => {
    try {
      const url = new URL(window.location.href);
      if (profile.isGuest || !profile.email) {
        url.searchParams.delete('account');
      } else {
        url.searchParams.set('account', profile.email.toLowerCase());
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore history API restrictions
    }
  };

  const loadAccountDataIntoState = (profile: UserProfile) => {
    const keys = getAccountStorageKeys(profile);
    if (!keys) {
      setConversations([]);
      setMemories([]);
      setArtGallery([]);
      setActiveChatId(null);
      return;
    }
    try {
      const rawConvs = localStorage.getItem(keys.conversations);
      setConversations(rawConvs ? JSON.parse(rawConvs) : []);
      const rawMem = localStorage.getItem(keys.memory);
      setMemories(rawMem ? JSON.parse(rawMem) : []);
      const rawGal = localStorage.getItem(keys.gallery);
      setArtGallery(rawGal ? JSON.parse(rawGal) : []);
    } catch {
      setConversations([]);
      setMemories([]);
      setArtGallery([]);
    }
    setActiveChatId(null);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    const cleanEmail = authEmailInput.trim().toLowerCase();
    const cleanPassword = authPasswordInput.trim();

    if (!cleanEmail.endsWith('@gmail.com') || cleanEmail.length < 11) {
      setAuthError('Please enter a valid @gmail.com address (e.g., yourname@gmail.com).');
      return;
    }
    if (cleanPassword.length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }

    const accounts = loadRegisteredAccounts();
    const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);

    if (authMode === 'signup') {
      if (existing) {
        setAuthError('This Gmail account already exists. Switch to "Sign In" to access it.');
        return;
      }
      const displayName =
        authNameInput.trim() ||
        cleanEmail.split('@')[0].replace(/[._-]+/g, ' ');
      const newRecord: StoredAccountRecord = {
        id: 'acct_' + Math.random().toString(36).substring(2, 10),
        name: displayName,
        email: cleanEmail,
        passwordHash: hashPasswordSimple(cleanPassword),
        createdAt: Date.now(),
      };
      saveRegisteredAccounts([...accounts, newRecord]);

      const loggedInProfile: UserProfile = {
        id: newRecord.id,
        name: newRecord.name,
        email: newRecord.email,
        isGuest: false,
      };
      setUser(loggedInProfile);
      syncAccountUrl(loggedInProfile);
      loadAccountDataIntoState(loggedInProfile);
      setAuthModalOpen(false);
      setAuthPasswordInput('');
      setAccountNotice(
        `Account created & signed in as ${newRecord.email}. Bookmark this URL to open your account directly!`
      );
    } else {
      if (!existing) {
        setAuthError('No account found with this Gmail. Please create an account first.');
        return;
      }
      if (existing.passwordHash !== hashPasswordSimple(cleanPassword)) {
        setAuthError('Incorrect password for this Gmail account.');
        return;
      }
      const loggedInProfile: UserProfile = {
        id: existing.id,
        name: existing.name,
        email: existing.email,
        isGuest: false,
      };
      setUser(loggedInProfile);
      syncAccountUrl(loggedInProfile);
      loadAccountDataIntoState(loggedInProfile);
      setAuthModalOpen(false);
      setAuthPasswordInput('');
      setAccountNotice(`Signed in to ${existing.email}. Chats and images are saved on this device.`);
    }
  };

  const handleSignOut = () => {
    setUser(DEFAULT_USER);
    syncAccountUrl(DEFAULT_USER);
    setConversations([]);
    setMemories([]);
    setArtGallery([]);
    setActiveChatId(null);
    setAccountNotice('Signed out. You are now in Guest Mode (chats will not be saved).');
  };

  // ==========================================================================
  // EXPORT CHAT (.HTML, .JSON, .TXT, .MD) & FULL SHARE LINK
  // ==========================================================================

  const activeConversation = conversations.find((c) => c.id === activeChatId) || null;
  const isWelcomeScreen = !activeConversation || activeConversation.messages.length === 0;

  const handleExportChat = (format: 'html' | 'json' | 'txt' | 'md') => {
    if (!activeConversation) return;
    const safeTitle =
      activeConversation.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'jarvis_chat';
    let content = '';
    let mimeType = 'text/plain;charset=utf-8';
    const extension = format;

    if (format === 'json') {
      content = JSON.stringify(
        {
          app: 'JARVIS AI Assistant',
          exportedAt: new Date().toISOString(),
          account: user.isGuest ? 'Guest' : user.email,
          title: activeConversation.title,
          messages: activeConversation.messages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp).toISOString(),
            imageUrl: m.imageUrl,
          })),
        },
        null,
        2
      );
      mimeType = 'application/json;charset=utf-8';
    } else if (format === 'txt') {
      content = [
        `JARVIS AI CHAT EXPORT — ${activeConversation.title}`,
        `Exported: ${new Date().toLocaleString()}`,
        '====================================================',
        '',
        ...activeConversation.messages.map(
          (m) =>
            `[${m.role === 'user' ? 'YOU' : 'JARVIS'}] (${new Date(
              m.timestamp
            ).toLocaleTimeString()})\n${m.content}\n`
        ),
      ].join('\n');
    } else if (format === 'md') {
      content = [
        `# ${activeConversation.title}`,
        `_Exported from JARVIS AI on ${new Date().toLocaleString()}_`,
        '',
        ...activeConversation.messages.map(
          (m) => `### ${m.role === 'user' ? 'You' : 'JARVIS'}\n\n${m.content}\n`
        ),
      ].join('\n');
      mimeType = 'text/markdown;charset=utf-8';
    } else {
      const escapeHtml = (str: string) =>
        str
          .replace(/&/g, '&')
          .replace(/</g, '<')
          .replace(/>/g, '>')
          .replace(/\n/g, '<br/>');

      const bubbles = activeConversation.messages
        .map(
          (m) => `
          <div style="margin-bottom:16px;padding:14px 18px;border-radius:14px;background:${
            m.role === 'user' ? '#0e2947' : '#09182d'
          };border:1px solid ${m.role === 'user' ? '#22d3ee' : '#1e3a5f'};">
            <div style="font-size:11px;font-weight:bold;color:#38bdf8;margin-bottom:6px;text-transform:uppercase;">
              ${m.role === 'user' ? 'You' : 'JARVIS'} • ${new Date(m.timestamp).toLocaleTimeString()}
            </div>
            <div style="font-size:14px;line-height:1.6;color:#f1f5f9;">${escapeHtml(m.content)}</div>
            ${
              m.imageUrl
                ? `<div style="margin-top:10px;"><img src="${m.imageUrl}" style="max-width:100%;border-radius:10px;" /></div>`
                : ''
            }
          </div>`
        )
        .join('');

      content = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(activeConversation.title)} - JARVIS Export</title>
</head>
<body style="background:#020813;color:#f8fafc;font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:32px auto;padding:20px;">
  <h1 style="color:#22d3ee;letter-spacing:2px;">JARVIS AI — ${escapeHtml(activeConversation.title)}</h1>
  <p style="color:#94a3b8;font-size:12px;">Exported on ${new Date().toLocaleString()}</p>
  <hr style="border-color:#1e293b;margin:20px 0;" />
  ${bubbles}
</body>
</html>`;
      mimeType = 'text/html;charset=utf-8';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  const handleOpenShareChat = () => {
    if (!activeConversation) return;
    const token = encodeSharePayload({
      title: activeConversation.title,
      messages: activeConversation.messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content.slice(0, 1500),
        timestamp: m.timestamp,
      })),
    });
    const shareUrl = new URL(window.location.origin + window.location.pathname);
    if (token) shareUrl.searchParams.set('share', token);
    setGeneratedShareUrl(shareUrl.toString());
    setShareCopied(false);
    setShareModalOpen(true);
  };

  // Direct Native App Install Handler (Zero Instruction Modal!)
  const handleInstallAppClick = async () => {
    // 1. Direct native one-click browser install
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setAppInstalled(true);
      }
      setDeferredInstallPrompt(null);
      return;
    }

    // 2. If running inside an iframe preview, pop out to top-level tab and auto-trigger install
    if (window.self !== window.top) {
      const targetUrl = new URL(window.location.href);
      targetUrl.searchParams.set('autoinstall', '1');
      window.open(targetUrl.toString(), '_blank', 'noopener,noreferrer');
      return;
    }

    // 3. Direct standalone app launcher download fallback
    const appUrl = window.location.origin + window.location.pathname;
    const shortcutContent = `[InternetShortcut]\nURL=${appUrl}\nIconIndex=0\n`;
    const blob = new Blob([shortcutContent], { type: 'application/internet-shortcut' });
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = dlUrl;
    a.download = 'JARVIS AI.url';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
    setAccountNotice('JARVIS AI app launcher downloaded directly to your device!');
  };

  const activeProfession = useMemo(
    () => PROFESSION_PROFILES.find((p) => p.id === activeProfessionId) || PROFESSION_PROFILES[0],
    [activeProfessionId]
  );

  const calendarData = useMemo(() => {
    const year = liveClock.getFullYear();
    const month = liveClock.getMonth();
    const today = liveClock.getDate();
    const monthLabel = liveClock.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; isToday: boolean }> = [];
    for (let i = 0; i < firstDayIndex; i++) cells.push({ day: null, isToday: false });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, isToday: d === today });
    return { monthLabel, cells };
  }, [liveClock]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      setVoiceSpeaking(false);
    }
  }, []);

  const stopVoiceRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
      recognitionRef.current = null;
    }
    setVoiceListening(false);
  }, []);

  const speakTextAloud = useCallback(
    (text: string, messageId?: string, onDone?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onDone?.();
        return;
      }
      window.speechSynthesis.cancel();
      const clean = formatAsCleanNotebookText(text).replace(/\s+/g, ' ').trim();
      if (!clean) {
        onDone?.();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.03;
      utterance.pitch = 0.96;
      utterance.lang = voiceLang;
      utterance.onstart = () => {
        if (messageId) setSpeakingMessageId(messageId);
        setVoiceSpeaking(true);
      };
      utterance.onend = () => {
        setSpeakingMessageId(null);
        setVoiceSpeaking(false);
        onDone?.();
      };
      utterance.onerror = () => {
        setSpeakingMessageId(null);
        setVoiceSpeaking(false);
        onDone?.();
      };
      window.speechSynthesis.speak(utterance);
    },
    [voiceLang]
  );

  const handleNewChat = () => {
    stopSpeaking();
    setActiveChatId(null);
    setSidebarOpen(false);
    setMobileHudTab('center');
  };

  const handleSelectChat = (id: string) => {
    stopSpeaking();
    setActiveChatId(id);
    setSidebarOpen(false);
    setMobileHudTab('center');
  };

  const handleSendMessage = useCallback(
    async (
      text: string,
      incomingAttachments: Attachment[] = [],
      options?: { forceGoogleGrounding?: boolean; onVoiceReplyComplete?: () => void }
    ) => {
      if (!text.trim() && incomingAttachments.length === 0) return;
      setMobileHudTab('center');

      const displayPrompt =
        text.trim() ||
        (incomingAttachments.length > 0 ? 'Analyze this attached image.' : '');

      const userMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'user',
        content: displayPrompt,
        timestamp: Date.now(),
        attachments: incomingAttachments.length > 0 ? incomingAttachments : undefined,
      };

      let currentConvId = activeChatId;
      let updatedConversations = [...conversations];

      if (!currentConvId) {
        const title =
          displayPrompt.slice(0, 36) + (displayPrompt.length > 36 ? '...' : '') ||
          'JARVIS Session';
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
        updatedConversations = updatedConversations.map((c) =>
          c.id === currentConvId
            ? { ...c, updatedAt: Date.now(), messages: [...c.messages, userMessage] }
            : c
        );
        setConversations(updatedConversations);
      }

      const shouldSpeakAfter = Boolean(settings.voiceEnabled) || Boolean(voiceAllowedRef.current);

      const instantGreeting = getInstantGreetingReply(displayPrompt);
      const instantMath = !instantGreeting ? solveMathOrEquation(displayPrompt) : null;
      const instantAcronym = !instantGreeting && !instantMath ? resolveCuratedAcronym(displayPrompt) : null;
      const instantReply = instantGreeting || instantMath || instantAcronym;

      if (instantReply && incomingAttachments.length === 0) {
        const msg: Message = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: formatAsCleanNotebookText(instantReply),
          timestamp: Date.now(),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? { ...c, updatedAt: Date.now(), messages: [...c.messages, msg] }
              : c
          )
        );
        if (shouldSpeakAfter) {
          speakTextAloud(msg.content, msg.id, options?.onVoiceReplyComplete);
        }
        return;
      }

      setIsLoading(true);
      try {
        const isImageReq =
          incomingAttachments.length === 0 &&
          (settings.selectedModel === 'jarvis-art' || isImagePrompt(displayPrompt));
        let assistantMessage: Message;

        if (isImageReq) {
          const cleanPrompt = displayPrompt || 'Futuristic glowing arc reactor core, 8k';
          const imageUrl = await generateFreeImage(cleanPrompt, '1:1');
          if (!user.isGuest) {
            setArtGallery((prev) => [
              {
                id: Math.random().toString(36).substring(2, 9),
                prompt: cleanPrompt,
                style: 'Neural Studio',
                aspectRatio: '1:1',
                imageUrl,
                createdAt: Date.now(),
              },
              ...prev,
            ]);
          }
          assistantMessage = {
            id: Math.random().toString(36).substring(2, 9),
            role: 'assistant',
            content: `Here is the image created for "${cleanPrompt}":`,
            imageUrl,
            timestamp: Date.now(),
          };
        } else {
          const useWeb =
            incomingAttachments.length === 0 &&
            (Boolean(options?.forceGoogleGrounding) ||
              Boolean(settings.webSearchEnabled) ||
              /\b(?:news|headlines|google grounding)\b/i.test(displayPrompt));
          const liveNews = useWeb
            ? await fetchLiveGoogleNews(displayPrompt)
            : { contextText: '', sources: [] };

          const memoryBlock =
            memories.length > 0
              ? `\nUser Memory:\n${memories
                  .slice(0, 5)
                  .map((m) => `- (${m.category}) ${m.content}`)
                  .join('\n')}`
              : '';
          const systemInstruction = `${NATURAL_CHAT_SYSTEM_PROMPT}\n\nActive Role (${activeProfession.name}): ${activeProfession.systemDirective}${memoryBlock}`;

          const activeMsgs =
            updatedConversations.find((c) => c.id === currentConvId)?.messages || [userMessage];
          const replyText = await queryFreeAiResponse(
            activeMsgs.map((m) => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments,
            })),
            systemInstruction,
            liveNews.contextText
          );

          assistantMessage = {
            id: Math.random().toString(36).substring(2, 9),
            role: 'assistant',
            content: replyText,
            sources: liveNews.sources,
            timestamp: Date.now(),
          };
        }

        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? { ...c, updatedAt: Date.now(), messages: [...c.messages, assistantMessage] }
              : c
          )
        );

        if (shouldSpeakAfter && assistantMessage.content) {
          speakTextAloud(
            assistantMessage.content,
            assistantMessage.id,
            options?.onVoiceReplyComplete
          );
        }
      } catch (err) {
        const errMsg: Message = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `JARVIS notice: ${err instanceof Error ? err.message : 'Request failed.'}`,
          timestamp: Date.now(),
          isError: true,
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? { ...c, updatedAt: Date.now(), messages: [...c.messages, errMsg] }
              : c
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      activeChatId,
      conversations,
      settings.voiceEnabled,
      settings.selectedModel,
      settings.webSearchEnabled,
      activeProfession,
      memories,
      speakTextAloud,
      user.isGuest,
    ]
  );

  // ==========================================================================
  // VOICE CONVERSATION CAPSULE
  // ==========================================================================

  const startInlineVoiceListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      setVoiceError('Speech recognition is not supported in this browser.');
      return;
    }

    stopVoiceRecognition();
    stopSpeaking();

    const recognition = new SpeechRecCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = voiceLang;

    let finalBuffer = '';

    recognition.onstart = () => {
      setVoiceListening(true);
      setVoiceError('');
      setVoiceInterimTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0]?.transcript || '';
        if (event.results[i].isFinal) {
          finalBuffer += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      setVoiceInterimTranscript((finalBuffer + interim).trim());
    };

    recognition.onerror = (event: { error?: string }) => {
      setVoiceListening(false);
      if (event.error && event.error !== 'aborted' && event.error !== 'no-speech') {
        setVoiceError(`Mic notice: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
      const captured = finalBuffer.trim();
      setVoiceInterimTranscript('');
      if (captured) {
        void handleSendMessage(captured, [], {
          onVoiceReplyComplete: () => {
            if (voiceAllowedRef.current && voiceAutoLoopRef.current) {
              startInlineVoiceListening();
            }
          },
        });
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setVoiceError('Unable to access microphone. Please allow microphone permissions.');
    }
  }, [voiceLang, stopVoiceRecognition, stopSpeaking, handleSendMessage]);

  const handleAllowVoiceConversation = () => {
    setVoiceConversationAllowed(true);
    setVoiceError('');
    window.setTimeout(() => startInlineVoiceListening(), 150);
  };

  const handleSwitchBackToTextInput = () => {
    setVoiceConversationAllowed(false);
    stopVoiceRecognition();
    stopSpeaking();
    setVoiceInterimTranscript('');
    setVoiceError('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 6 - attachments.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type || 'application/octet-stream',
              data: reader.result as string,
            },
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleQuestionSubmit = () => {
    if ((!questionInput.trim() && attachments.length === 0) || isLoading) return;
    const textToSend = questionInput;
    const filesToSend = [...attachments];
    setQuestionInput('');
    setAttachments([]);
    void handleSendMessage(textToSend, filesToSend);
  };

  const handleCaptureScreenVision = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setAccountNotice('Screen sharing is not supported in this browser. Attach a screenshot instead.');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((t) => t.stop());
      const dataUrl = canvas.toDataURL('image/png');
      await handleSendMessage(
        'Analyze this screen capture and summarize the key details.',
        [{ name: 'screen-capture.png', type: 'image/png', data: dataUrl }]
      );
    } catch {
      // Cancelled
    }
  };

  const handleRunScientificCalc = () => {
    try {
      const val = evaluateSafeMathExpression(calcInput);
      setCalcResult(formatCleanNumber(val));
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
    return {
      currentAmps: i.toFixed(4) + ' A',
      currentMa: (i * 1000).toFixed(2) + ' mA',
      powerWatts: (v * i).toFixed(4) + ' W',
    };
  }, [ohmsVoltage, ohmsResistance]);

  const unitConversions = useMemo(() => {
    const val = parseFloat(unitValue);
    if (!Number.isFinite(val)) return [];
    if (unitCategory === 'length') {
      return [
        { label: 'Meters (m)', value: val.toFixed(4) },
        { label: 'Kilometers (km)', value: (val / 1000).toFixed(6) },
        { label: 'Feet (ft)', value: (val * 3.28084).toFixed(4) },
      ];
    }
    if (unitCategory === 'pressure') {
      return [
        { label: 'Pascals (Pa)', value: val.toFixed(2) },
        { label: 'Bar', value: (val / 100000).toFixed(5) },
        { label: 'PSI', value: (val * 0.000145038).toFixed(4) },
      ];
    }
    if (unitCategory === 'energy') {
      return [
        { label: 'Joules (J)', value: val.toFixed(2) },
        { label: 'Kilojoules (kJ)', value: (val / 1000).toFixed(4) },
        { label: 'kWh', value: (val / 3.6e6).toFixed(6) },
      ];
    }
    return [
      { label: 'Celsius (°C)', value: val.toFixed(2) },
      { label: 'Fahrenheit (°F)', value: ((val * 9) / 5 + 32).toFixed(2) },
      { label: 'Kelvin (K)', value: (val + 273.15).toFixed(2) },
    ];
  }, [unitCategory, unitValue]);

  const clinicalMetrics = useMemo(() => {
    const w = parseFloat(clinicalWeightKg);
    const hCm = parseFloat(clinicalHeightCm);
    const age = parseFloat(clinicalAge) || 30;
    if (!Number.isFinite(w) || !Number.isFinite(hCm) || hCm <= 0 || w <= 0) {
      return { bmi: '—', category: 'Invalid', bmrMale: '—', bmrFemale: '—' };
    }
    const bmiVal = w / ((hCm / 100) * (hCm / 100));
    const category =
      bmiVal < 18.5
        ? 'Underweight'
        : bmiVal < 25
          ? 'Normal weight'
          : bmiVal < 30
            ? 'Overweight'
            : 'Obesity range';
    return {
      bmi: bmiVal.toFixed(1) + ' kg/m²',
      category,
      bmrMale: `${Math.round(10 * w + 6.25 * hCm - 5 * age + 5)} kcal/day`,
      bmrFemale: `${Math.round(10 * w + 6.25 * hCm - 5 * age - 161)} kcal/day`,
    };
  }, [clinicalWeightKg, clinicalHeightCm, clinicalAge]);

  const radialNodes = useMemo(
    () => [
      { id: 'voice', label: 'Voice AI', angleDeg: -90, icon: Mic, accent: 'text-cyan-300 border-cyan-400/70', onClick: () => handleAllowVoiceConversation() },
      { id: 'specialists', label: 'Specialists', angleDeg: -45, icon: Stethoscope, accent: 'text-emerald-300 border-emerald-400/60', onClick: () => setProfessionsModalOpen(true) },
      { id: 'image', label: 'Image Studio', angleDeg: 0, icon: Palette, accent: 'text-fuchsia-300 border-fuchsia-400/60', onClick: () => setImageStudioOpen(true) },
      { id: 'news', label: 'Live News', angleDeg: 45, icon: Newspaper, accent: 'text-amber-300 border-amber-400/60', onClick: () => setNewsModalOpen(true) },
      { id: 'workbench', label: 'Eng & Med', angleDeg: 90, icon: Calculator, accent: 'text-sky-300 border-sky-400/60', onClick: () => setWorkbenchOpen(true) },
      { id: 'vision', label: 'Screen Scan', angleDeg: 135, icon: Monitor, accent: 'text-blue-300 border-blue-400/60', onClick: () => void handleCaptureScreenVision() },
      { id: 'memory', label: 'Memory', angleDeg: 180, icon: Brain, accent: 'text-violet-300 border-violet-400/60', onClick: () => setMemoryModalOpen(true) },
      { id: 'new', label: 'New Chat', angleDeg: -135, icon: Plus, accent: 'text-amber-200 border-amber-400/60', onClick: () => handleNewChat() },
    ],
    []
  );

  const rightSideFeatures = useMemo(
    () => [
      {
        id: 'voice-conv',
        title: 'Two-Way Voice Conversation',
        subtitle: voiceConversationAllowed ? 'Active • Waveform Ready' : 'Click to allow voice',
        badge: voiceConversationAllowed ? 'LIVE' : 'VOICE',
        active: voiceConversationAllowed,
        icon: Mic,
        onClick: () =>
          voiceConversationAllowed ? handleSwitchBackToTextInput() : handleAllowVoiceConversation(),
      },
      {
        id: 'specialists',
        title: 'Specialist Matrix (16 Domains)',
        subtitle: activeProfession.name,
        badge: 'PRO',
        active: activeProfession.id !== 'general',
        icon: Briefcase,
        onClick: () => setProfessionsModalOpen(true),
      },
      {
        id: 'image-studio',
        title: 'Neural Image Studio',
        subtitle: user.isGuest
          ? 'Sign in to save generated art'
          : `Saved on account (${artGallery.length})`,
        badge: 'FREE',
        active: false,
        icon: ImageIcon,
        onClick: () => setImageStudioOpen(true),
      },
      {
        id: 'live-news',
        title: 'Real-Time World News',
        subtitle: 'Live Google headlines & briefings',
        badge: 'LIVE',
        active: false,
        icon: Newspaper,
        onClick: () => setNewsModalOpen(true),
      },
      {
        id: 'workbench',
        title: 'Engineering & Medical Lab',
        subtitle: 'Scientific calc, Ohm’s law, BMI & labs',
        badge: 'LAB',
        active: false,
        icon: Calculator,
        onClick: () => setWorkbenchOpen(true),
      },
      {
        id: 'screen-vision',
        title: 'Live Screen Vision',
        subtitle: 'Capture screen for instant AI analysis',
        badge: 'SCAN',
        active: false,
        icon: Monitor,
        onClick: () => void handleCaptureScreenVision(),
      },
      {
        id: 'neural-memory',
        title: 'Persistent Neural Memory',
        subtitle: user.isGuest
          ? 'Guest Mode (Disabled)'
          : `${memories.length} facts saved on account`,
        badge: 'MEM',
        active: memories.length > 0,
        icon: Brain,
        onClick: () => setMemoryModalOpen(true),
      },
    ],
    [voiceConversationAllowed, activeProfession, artGallery.length, memories.length, user.isGuest]
  );

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

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-[#020813] text-slate-100 antialiased font-sans relative">
      {/* Holographic Ambient Radial Grid Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, rgba(14, 165, 233, 0.16) 0%, rgba(3, 13, 30, 0.92) 52%, #02060f 100%)',
        }}
      />

      {/* SLIDE-OVER CHAT HISTORY DRAWER */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-[85vw] bg-[#041022] border-r border-cyan-500/35 p-4 flex flex-col gap-3 h-full shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-cyan-500/25">
              <span className="text-xs font-mono tracking-wider text-cyan-300 uppercase">
                {user.isGuest ? 'Guest Session (Not Saved)' : 'Account History'}
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleNewChat}
              className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>New Session</span>
            </button>

            {user.isGuest && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/30 text-[11px] text-amber-200">
                Guest Mode resets on refresh and does not save chats. Sign in with Gmail to save & delete history.
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-1.5">
              {conversations.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No chats in this session.</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between gap-1 p-2 rounded-xl border text-xs ${
                      c.id === activeChatId
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectChat(c.id)}
                      className="flex-1 text-left truncate"
                    >
                      {c.title}
                    </button>
                    <button
                      type="button"
                      title="Delete Chat"
                      onClick={() => {
                        setConversations((prev) => prev.filter((item) => item.id !== c.id));
                        if (activeChatId === c.id) setActiveChatId(null);
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400"
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

      {/* TOP HUD BAR WITH DIRECT INSTALL APP BUTTON & SIGN IN */}
      <header className="relative z-20 px-3 sm:px-5 py-2 bg-[#040d1d]/90 backdrop-blur-md border-b border-cyan-500/30 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title="Chat History"
            className="w-9 h-9 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/40 flex items-center justify-center text-cyan-300 transition shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          <ArcReactorBadge size="sm" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold tracking-[0.18em] text-cyan-200">
                JARVIS
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-mono text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <p className="text-[9px] font-mono tracking-[0.16em] text-cyan-400/75 uppercase truncate">
              {user.isGuest ? 'GUEST MODE • RESETS ON REFRESH' : `ACCOUNT: ${user.email}`}
            </p>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-4 text-[10px] font-mono tracking-[0.16em] text-cyan-300/75 uppercase">
          <span>CONNECTED • ANYTIME ANYWHERE</span>
          <span className="text-cyan-500/50">|</span>
          <span className="flex items-center gap-1.5 text-cyan-200">
            <Clock className="w-3 h-3 text-cyan-400" />
            {liveClock.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
            {liveClock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <select
            aria-label="Select JARVIS Model"
            value={settings.selectedModel}
            onChange={(e) =>
              setSettings((prev) => ({ ...prev, selectedModel: e.target.value as AIModelId }))
            }
            className="hidden md:block bg-[#07152b] border border-cyan-500/35 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-cyan-200"
          >
            <option value="jarvis-turbo">JARVIS Turbo</option>
            <option value="jarvis-deep">JARVIS Deep Think</option>
            <option value="jarvis-art">JARVIS Art Mode</option>
          </select>

          <button
            type="button"
            onClick={() => {
              if (settings.voiceEnabled) stopSpeaking();
              setSettings((prev) => ({ ...prev, voiceEnabled: !prev.voiceEnabled }));
            }}
            title="Toggle Auto-Speak"
            className={`p-2 rounded-lg border text-xs transition ${
              settings.voiceEnabled
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                : 'bg-[#07152b] border-cyan-500/30 text-slate-400 hover:text-cyan-200'
            }`}
          >
            {settings.voiceEnabled ? (
              <Volume2 className="w-4 h-4 text-cyan-300" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          {/* DIRECT INSTALL APP BUTTON NEXT TO SIGN IN */}
          <button
            type="button"
            onClick={() => void handleInstallAppClick()}
            title="Install JARVIS Directly to Your Device"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/50 text-emerald-200 font-semibold text-xs transition"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-300" />
            <span className="hidden sm:inline">{appInstalled ? 'Installed' : 'Install App'}</span>
          </button>

          {/* SIGN-IN / ACCOUNT BUTTON */}
          {user.isGuest ? (
            <button
              type="button"
              onClick={() => {
                setAuthError('');
                setAuthModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-[0_0_16px_rgba(34,211,238,0.45)] transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setAuthError('');
                  setAuthModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/50 text-cyan-200 text-xs font-medium max-w-[140px]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{user.name}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign Out"
                className="p-1.5 rounded-lg bg-[#07152b] border border-rose-500/40 text-rose-300 hover:bg-rose-950/50"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile HUD Switcher Tabs */}
      <div className="lg:hidden relative z-20 flex items-center justify-around bg-[#040d1d]/95 border-b border-cyan-500/25 px-2 py-1.5 text-[11px] font-mono shrink-0">
        <button
          type="button"
          onClick={() => setMobileHudTab('left')}
          className={`px-3 py-1 rounded-lg ${
            mobileHudTab === 'left'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
              : 'text-slate-400'
          }`}
        >
          Radial Hub
        </button>
        <button
          type="button"
          onClick={() => setMobileHudTab('center')}
          className={`px-3 py-1 rounded-lg ${
            mobileHudTab === 'center'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
              : 'text-slate-400'
          }`}
        >
          JARVIS Core
        </button>
        <button
          type="button"
          onClick={() => setMobileHudTab('right')}
          className={`px-3 py-1 rounded-lg ${
            mobileHudTab === 'right'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
              : 'text-slate-400'
          }`}
        >
          Features
        </button>
      </div>

      {!isOnline && (
        <div className="relative z-20 bg-amber-500/20 border-b border-amber-500/30 px-4 py-1 text-xs text-amber-200 flex items-center gap-2 shrink-0">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Offline: Internet connection required for live AI replies.</span>
        </div>
      )}

      {accountNotice && (
        <div className="relative z-20 bg-[#07152b] border-b border-cyan-500/40 px-4 py-1.5 text-xs text-cyan-200 flex items-center justify-between gap-2 shrink-0">
          <span>{accountNotice}</span>
          <button
            type="button"
            onClick={() => setAccountNotice('')}
            className="text-cyan-400 hover:text-white font-semibold shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeProfession.disclaimer && (
        <div className="relative z-20 bg-emerald-950/60 border-b border-emerald-500/30 px-4 py-1 flex items-center justify-between text-[11px] text-emerald-200 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{activeProfession.disclaimer}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveProfessionId('general')}
            className="text-emerald-300 hover:text-white underline ml-2 shrink-0"
          >
            Reset
          </button>
        </div>
      )}

      {/* MAIN 3-COLUMN HUD BODY */}
      <main className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)_290px] xl:grid-cols-[315px_minmax(0,1fr)_315px] gap-3 p-2.5 sm:p-4 overflow-hidden">
        {/* LEFT COLUMN: RADIAL WHEEL + CALENDAR + SYSTEM STATUS */}
        <aside
          className={`${
            mobileHudTab === 'left' ? 'flex' : 'hidden'
          } lg:flex flex-col gap-3 min-h-0 overflow-y-auto pr-0.5`}
        >
          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3 shadow-[0_0_25px_rgba(6,182,212,0.14)] shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono tracking-[0.16em] text-cyan-300 uppercase">
                JARVIS COMMAND WHEEL
              </span>
              <span className="text-[9px] font-mono text-amber-300/90">8 MODULES</span>
            </div>

            <div className="relative w-[236px] h-[236px] mx-auto my-1 flex items-center justify-center">
              <div className="absolute inset-1 rounded-full border-2 border-cyan-400/45 shadow-[0_0_25px_rgba(34,211,238,0.28)]" />
              <div className="absolute inset-5 rounded-full border border-amber-400/35 border-dashed" />
              <div className="absolute inset-12 rounded-full border border-cyan-400/40" />

              <button
                type="button"
                onClick={handleNewChat}
                className="relative z-10 w-[76px] h-[76px] rounded-full bg-gradient-to-b from-[#071e3d] to-[#030d1f] border-2 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.65)] flex flex-col items-center justify-center text-center hover:scale-105 transition"
              >
                <span className="text-[11px] font-extrabold tracking-[0.14em] text-cyan-200">
                  JARVIS
                </span>
                <span className="text-[8px] font-mono text-cyan-400 mt-0.5">CORE</span>
              </button>

              {radialNodes.map((node) => {
                const IconComponent = node.icon;
                const rad = (node.angleDeg * Math.PI) / 180;
                const x = Math.cos(rad) * 88;
                const y = Math.sin(rad) * 88;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={node.onClick}
                    title={node.label}
                    style={{ transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` }}
                    className={`absolute z-10 w-[54px] h-[54px] rounded-2xl bg-[#061830]/95 hover:bg-cyan-500/25 border ${node.accent} flex flex-col items-center justify-center gap-0.5 px-1 transition hover:scale-110`}
                  >
                    <IconComponent className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[8px] font-medium leading-tight text-slate-100 text-center line-clamp-1">
                      {node.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-cyan-200 text-xs font-semibold">
                <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Calendar</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-300">{calendarData.monthLabel}</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-mono text-slate-400 mb-1">
              <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono">
              {calendarData.cells.map((cell, idx) => (
                <div
                  key={idx}
                  className={`h-5 flex items-center justify-center rounded-full ${
                    cell.isToday
                      ? 'bg-cyan-400 text-slate-950 font-bold shadow-[0_0_10px_rgba(34,211,238,0.85)]'
                      : cell.day
                        ? 'text-slate-300'
                        : ''
                  }`}
                >
                  {cell.day || ''}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3 shrink-0">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-[0.14em] text-cyan-300 uppercase">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>SYSTEM STATUS</span>
              </div>
              <span className="text-[9px] font-mono text-slate-400">v2.6</span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[
                { label: 'CPU', pct: 82, color: '#22d3ee' },
                { label: 'MEMORY', pct: 74, color: '#38bdf8' },
                { label: 'STORAGE', pct: 56, color: '#34d399' },
                { label: 'AI CORE', pct: 96, color: '#a855f7' },
              ].map((gauge) => {
                const r = 16;
                const circ = 2 * Math.PI * r;
                const offset = circ - (gauge.pct / 100) * circ;
                return (
                  <div key={gauge.label} className="flex flex-col items-center">
                    <div className="relative w-11 h-11 flex items-center justify-center">
                      <svg className="w-11 h-11 -rotate-90" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(30,41,59,0.85)" strokeWidth="3.5" />
                        <circle
                          cx="20"
                          cy="20"
                          r={r}
                          fill="none"
                          stroke={gauge.color}
                          strokeWidth="3.5"
                          strokeDasharray={circ}
                          strokeDashoffset={offset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-[9px] font-mono font-bold text-slate-100">
                        {gauge.pct}%
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 mt-1">{gauge.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>

        {/* CENTER HUD STAGE */}
        <section
          className={`${
            mobileHudTab === 'center' ? 'flex' : 'hidden'
          } lg:flex flex-col min-h-0 rounded-2xl bg-[#030c1b]/75 backdrop-blur-sm border border-cyan-500/30 relative overflow-hidden`}
        >
          <div className="pointer-events-none absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-cyan-400/70 rounded-tl-md" />
          <div className="pointer-events-none absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-cyan-400/70 rounded-tr-md" />

          {/* Active Chat Action Bar: Export (HTML, JSON, TXT, MD), Share Full Session, Core HUD */}
          {!isWelcomeScreen && (
            <div className="px-4 py-2 bg-[#051226]/95 border-b border-cyan-500/25 flex items-center justify-between gap-2 shrink-0 z-20 relative">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-cyan-200 truncate">
                  {activeConversation.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Export Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setExportMenuOpen((prev) => !prev)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-500/35 text-[11px] text-cyan-200"
                  >
                    <FileDown className="w-3 h-3 text-cyan-400" />
                    <span>Export</span>
                  </button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-[#07152b] border border-cyan-500/40 shadow-2xl py-1 z-30 text-xs">
                      <button
                        type="button"
                        onClick={() => handleExportChat('html')}
                        className="w-full px-3 py-2 text-left text-slate-200 hover:bg-cyan-500/20"
                      >
                        Export as HTML (.html)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportChat('json')}
                        className="w-full px-3 py-2 text-left text-slate-200 hover:bg-cyan-500/20"
                      >
                        Export as JSON (.json)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportChat('txt')}
                        className="w-full px-3 py-2 text-left text-slate-200 hover:bg-cyan-500/20"
                      >
                        Export as Text (.txt)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportChat('md')}
                        className="w-full px-3 py-2 text-left text-slate-200 hover:bg-cyan-500/20"
                      >
                        Export as Markdown (.md)
                      </button>
                    </div>
                  )}
                </div>

                {/* Share Full Chat & App Button */}
                <button
                  type="button"
                  onClick={handleOpenShareChat}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/45 text-[11px] text-indigo-200"
                >
                  <Share2 className="w-3 h-3 text-indigo-300" />
                  <span>Share Chat</span>
                </button>

                <button
                  type="button"
                  onClick={handleNewChat}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-[11px] text-cyan-200"
                >
                  <Home className="w-3 h-3" />
                  <span>Core HUD</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
            {isWelcomeScreen ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center relative">
                <div className="relative w-60 h-60 sm:w-72 sm:h-72 flex items-center justify-center my-auto">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 shadow-[0_0_70px_rgba(34,211,238,0.32)] animate-pulse" />
                  <div className="absolute inset-3 rounded-full border-[3px] border-dashed border-cyan-300/55" />
                  <div className="absolute inset-7 rounded-full border-2 border-sky-400/75 bg-gradient-to-b from-cyan-500/15 via-blue-600/10 to-slate-950/80 flex items-center justify-center">
                    <div className="px-4">
                      <h1 className="text-3xl sm:text-4xl font-black tracking-[0.22em] text-white drop-shadow-[0_0_18px_rgba(34,211,238,0.9)]">
                        JARVIS
                      </h1>
                      <p className="text-xs sm:text-sm font-medium text-cyan-200/95 mt-1.5">
                        Your Personal AI Assistant
                      </p>
                      <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-mono text-cyan-300">
                        <span>{activeProfession.shortName}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mt-2">
                  {[
                    "Today's Top News",
                    'Full form of DHA',
                    'Solve 2x + 5 = 19',
                    'Create futuristic car image',
                  ].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => void handleSendMessage(sample, [])}
                      className="px-3 py-1.5 rounded-full bg-[#06162d]/90 hover:bg-cyan-500/20 border border-cyan-500/35 text-[11px] text-cyan-200 transition"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 p-3 sm:p-5 space-y-3 w-full max-w-3xl mx-auto">
                {activeConversation.messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`p-3.5 rounded-2xl border ${
                        isUser
                          ? 'bg-cyan-500/15 border-cyan-400/40 ml-6 sm:ml-14'
                          : msg.isError
                            ? 'bg-rose-950/40 border-rose-500/40 mr-4 sm:mr-10'
                            : 'bg-[#06162d]/90 border-cyan-500/25 mr-4 sm:mr-10'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">
                          {isUser ? 'You' : 'JARVIS'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(msg.content);
                              setCopiedId(msg.id);
                              window.setTimeout(() => setCopiedId(null), 1500);
                            }}
                            className="p-1 text-slate-400 hover:text-cyan-300"
                            title="Copy"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {!isUser && (
                            <button
                              type="button"
                              onClick={() =>
                                speakingMessageId === msg.id
                                  ? stopSpeaking()
                                  : speakTextAloud(msg.content, msg.id)
                              }
                              className="p-1 text-slate-400 hover:text-cyan-300"
                              title="Read aloud"
                            >
                              {speakingMessageId === msg.id ? (
                                <VolumeX className="w-3.5 h-3.5 text-cyan-300" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {msg.attachments.map((att, idx) =>
                            att.data &&
                            (att.type.startsWith('image/') ||
                              att.data.startsWith('data:image/')) ? (
                              <img
                                key={idx}
                                src={att.data}
                                alt={att.name}
                                className="max-h-52 rounded-xl border border-cyan-400/40 object-contain bg-slate-950/60"
                              />
                            ) : (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 border border-cyan-500/30 text-[11px] text-cyan-200"
                              >
                                {att.name}
                              </span>
                            )
                          )}
                        </div>
                      )}

                      <div className="text-xs sm:text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </div>

                      {msg.imageUrl && (
                        <div className="mt-3">
                          <img
                            src={msg.imageUrl}
                            alt="JARVIS Visual"
                            className="rounded-xl max-h-72 border border-cyan-500/30"
                          />
                        </div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex flex-wrap gap-1.5">
                          {msg.sources.map((src, i) => (
                            <a
                              key={i}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-cyan-500/30 text-[10px] text-cyan-300 hover:underline max-w-[220px] truncate"
                            >
                              <Link2 className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{src.title}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/25 flex items-center gap-2.5 text-xs text-cyan-300 font-mono">
                    <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span>JARVIS is analyzing & processing...</span>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-3" />
              </div>
            )}
          </div>

          {/* BOTTOM-CENTER CAPSULE */}
          <div className="px-3 sm:px-6 pb-3 pt-2 bg-gradient-to-t from-[#020813] via-[#030c1b]/95 to-transparent shrink-0 z-10">
            {voiceConversationAllowed ? (
              <div className="max-w-xl mx-auto flex flex-col items-center gap-2">
                <div className="w-full rounded-full bg-[#05142b]/95 border border-cyan-400/70 shadow-[0_0_30px_rgba(34,211,238,0.3)] px-4 py-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleSwitchBackToTextInput}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-[11px] text-cyan-200 shrink-0"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Write</span>
                  </button>

                  <div className="flex-1 flex items-center justify-end gap-1 h-8 overflow-hidden">
                    {[14, 24, 18, 30, 22, 12, 26, 16, 28, 20].map((barH, idx) => (
                      <span
                        key={idx}
                        style={{ height: voiceListening || voiceSpeaking ? `${barH}px` : '6px' }}
                        className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${
                          voiceListening || voiceSpeaking ? 'animate-pulse' : 'opacity-45'
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      voiceListening ? stopVoiceRecognition() : startInlineVoiceListening()
                    }
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition shrink-0 ${
                      voiceListening
                        ? 'bg-cyan-400 border-white text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.95)]'
                        : 'bg-[#071d3b] border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.55)]'
                    }`}
                  >
                    {voiceListening ? <Mic className="w-5 h-5 animate-bounce" /> : <MicOff className="w-5 h-5" />}
                  </button>

                  <div className="flex-1 flex items-center justify-start gap-1 h-8 overflow-hidden">
                    {[20, 28, 16, 26, 12, 22, 30, 18, 24, 14].map((barH, idx) => (
                      <span
                        key={idx}
                        style={{ height: voiceListening || voiceSpeaking ? `${barH}px` : '6px' }}
                        className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${
                          voiceListening || voiceSpeaking ? 'animate-pulse' : 'opacity-45'
                        }`}
                      />
                    ))}
                  </div>

                  <select
                    aria-label="Voice language"
                    value={voiceLang}
                    onChange={(e) => setVoiceLang(e.target.value)}
                    className="bg-slate-900/90 border border-cyan-500/35 rounded-full px-2 py-1 text-[10px] font-mono text-cyan-200 shrink-0"
                  >
                    <option value="en-US">EN</option>
                    <option value="ur-PK">UR</option>
                    <option value="hi-IN">HI</option>
                    <option value="ar-SA">AR</option>
                  </select>
                </div>

                <div className="flex items-center justify-center gap-3 text-[11px] font-mono text-cyan-300/90">
                  <span>
                    {voiceInterimTranscript
                      ? `"${voiceInterimTranscript}"`
                      : voiceListening
                        ? 'Listening... Speak your question'
                        : voiceSpeaking
                          ? 'JARVIS is speaking...'
                          : 'Voice Active • Tap mic to speak'}
                  </span>
                  <label className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceAutoLoop}
                      onChange={(e) => setVoiceAutoLoop(e.target.checked)}
                      className="accent-cyan-400"
                    />
                    <span>Auto-loop</span>
                  </label>
                </div>
                {voiceError && <p className="text-[11px] text-amber-300">{voiceError}</p>}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                <div className="rounded-2xl bg-[#05142b]/95 border border-cyan-500/55 shadow-[0_0_25px_rgba(6,182,212,0.2)] p-2.5 space-y-2">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 px-1">
                      {attachments.map((att, i) => (
                        <div
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-[10px] text-cyan-200"
                        >
                          {(att.type.startsWith('image/') ||
                            att.data.startsWith('data:image/')) && (
                            <img
                              src={att.data}
                              alt={att.name}
                              className="w-6 h-6 rounded object-cover"
                            />
                          )}
                          <span className="truncate max-w-[140px]">{att.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                            }
                            className="hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-1">
                    <input
                      type="text"
                      value={questionInput}
                      onChange={(e) => setQuestionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleQuestionSubmit();
                        }
                      }}
                      placeholder={
                        attachments.length > 0
                          ? 'Ask JARVIS about your attached image...'
                          : 'Write your question to JARVIS...'
                      }
                      className="flex-1 bg-transparent text-sm text-white placeholder-cyan-200/45 focus:outline-none min-w-0"
                    />

                    <button
                      type="button"
                      onClick={handleAllowVoiceConversation}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 text-xs font-medium shrink-0"
                    >
                      <Mic className="w-3.5 h-3.5 text-cyan-300" />
                      <span className="hidden sm:inline">Voice</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleQuestionSubmit}
                      disabled={isLoading || (!questionInput.trim() && attachments.length === 0)}
                      className="w-9 h-9 rounded-full bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 flex items-center justify-center shrink-0"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 px-1 pt-0.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,.txt,.csv,.json"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-slate-300 hover:text-cyan-300"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Attach Image</span>
                      </button>

                      <span className="text-slate-700">|</span>

                      <button
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            webSearchEnabled: !prev.webSearchEnabled,
                          }))
                        }
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          settings.webSearchEnabled
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                            : 'bg-slate-900/80 border-slate-700 text-slate-300'
                        }`}
                      >
                        <Globe className="w-3 h-3 text-cyan-400" />
                        <span>Web</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            dualEngineEnabled: !prev.dualEngineEnabled,
                          }))
                        }
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          settings.dualEngineEnabled
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                            : 'bg-slate-900/80 border-slate-700 text-slate-300'
                        }`}
                      >
                        <Cpu className="w-3 h-3 text-cyan-400" />
                        <span>Dual Engine</span>
                      </button>
                    </div>

                    <span className="hidden sm:inline text-[10px] font-mono text-cyan-400/70">
                      Speak. Plan. Create. Achieve.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT HUD COLUMN */}
        <aside
          className={`${
            mobileHudTab === 'right' ? 'flex' : 'hidden'
          } lg:flex flex-col gap-3 min-h-0 overflow-y-auto pl-0.5`}
        >
          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3.5 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-cyan-500/25 shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
                  JARVIS Features
                </h2>
              </div>
              <span className="text-[10px] font-mono text-cyan-300/80">All Active</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {rightSideFeatures.map((feat) => {
                const IconComp = feat.icon;
                return (
                  <button
                    key={feat.id}
                    type="button"
                    onClick={feat.onClick}
                    className={`w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl border text-left transition ${
                      feat.active
                        ? 'bg-cyan-500/20 border-cyan-400/60'
                        : 'bg-[#06162d]/85 hover:bg-cyan-950/60 border-cyan-500/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-300 shrink-0">
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 truncate">
                          {feat.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{feat.subtitle}</div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 shrink-0">
                      {feat.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3.5 shrink-0">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/25">
              <span className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
                Quick Tasks
              </span>
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 hover:text-white"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {[
                {
                  label: 'Morning World News Briefing',
                  tag: 'Live',
                  prompt:
                    'Give me a briefing from Google grounding of today’s top world and technology news.',
                },
                {
                  label: 'Write Formal Application',
                  tag: 'Write',
                  prompt: 'Write an application to the Principal for two days sick leave.',
                },
                {
                  label: 'Explain Quantum Computing',
                  tag: 'Learn',
                  prompt: 'Explain how quantum computers work in simple notebook points.',
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => void handleSendMessage(item.prompt, [])}
                  className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-[#06162d]/80 hover:bg-cyan-950/60 border border-cyan-500/20 text-left transition"
                >
                  <span className="text-[11px] text-slate-200 truncate">{item.label}</span>
                  <span className="text-[9px] font-mono text-cyan-300 shrink-0">{item.tag}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </main>

      {/* ==================================================================== */}
      {/* GMAIL + PASSWORD ACCOUNT CREATION & SIGN-IN MODAL */}
      {/* ==================================================================== */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#081326] border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  {user.isGuest ? 'JARVIS Gmail Account' : 'Your Signed-In Account'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!user.isGuest ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-400/40 space-y-1.5">
                  <div className="text-xs font-bold text-cyan-200">{user.name}</div>
                  <div className="text-xs font-mono text-slate-300">{user.email}</div>
                  <div className="text-[11px] text-emerald-300 pt-1">
                    ✓ Direct Account URL active in your address bar. Typing or opening that URL logs directly into this account on this device.
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(window.location.href);
                      setAccountNotice('Direct Account URL copied to clipboard!');
                      setAuthModalOpen(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                  >
                    Copy Direct Account URL
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSignOut();
                      setAuthModalOpen(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-200 font-semibold text-xs"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setAuthError('');
                    }}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${
                      authMode === 'signup'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    1. Create Account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signin');
                      setAuthError('');
                    }}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${
                      authMode === 'signin'
                        ? 'bg-cyan-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    2. Direct Sign In
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3">
                  {authMode === 'signup' && (
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={authNameInput}
                        onChange={(e) => setAuthNameInput(e.target.value)}
                        placeholder="e.g. Ali Khan"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Gmail Address (required)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        required
                        value={authEmailInput}
                        onChange={(e) => setAuthEmailInput(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 mb-1">
                      Password (min 6 characters)
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-cyan-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        required
                        value={authPasswordInput}
                        onChange={(e) => setAuthPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {authError && (
                    <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-lg"
                  >
                    {authMode === 'signup'
                      ? 'Create Gmail Account & Sign In'
                      : 'Sign In to My Account'}
                  </button>
                </form>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  In Guest Mode, nothing is saved. Once you create your @gmail.com account and sign in, your URL updates for instant access and your chats & images are saved on this device.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SHARE FULL CHAT & APP LINK MODAL */}
      {/* ==================================================================== */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#081326] border border-indigo-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Share Full Chat & JARVIS App</h3>
              </div>
              <button
                type="button"
                onClick={() => setShareModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Send this link to your other device or account. Opening it loads the full JARVIS app together with every question and AI answer from this chat so you can continue talking to JARVIS seamlessly:
            </p>

            <div className="p-2.5 rounded-xl bg-slate-950 border border-indigo-500/35 text-[11px] font-mono text-cyan-200 break-all max-h-28 overflow-y-auto">
              {generatedShareUrl}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(generatedShareUrl);
                  setShareCopied(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                {shareCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{shareCopied ? 'Link Copied!' : 'Copy Share Link'}</span>
              </button>
              {typeof navigator !== 'undefined' && navigator.share && (
                <button
                  type="button"
                  onClick={() =>
                    void navigator.share({
                      title: 'JARVIS AI Conversation',
                      text: 'Continue my JARVIS AI conversation:',
                      url: generatedShareUrl,
                    })
                  }
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
                >
                  Share via Device
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* REAL-TIME NEWS MODAL */}
      {newsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-cyan-500/30 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-semibold text-white">JARVIS Real-Time News</h3>
              </div>
              <button type="button" onClick={() => setNewsModalOpen(false)} className="p-1.5 text-slate-400">
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
                    void handleSendMessage(cat.prompt, [], { forceGoogleGrounding: true });
                  }}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left"
                >
                  <span className="text-sm font-medium text-slate-100">{cat.label}</span>
                  <ChevronRight className="w-4 h-4 text-cyan-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SPECIALISTS MODAL */}
      {professionsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-cyan-500/30 rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-semibold text-white">Specialist Matrix (16 Domains)</h3>
              </div>
              <button type="button" onClick={() => setProfessionsModalOpen(false)} className="p-1.5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="my-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={professionSearch}
                onChange={(e) => setProfessionSearch(e.target.value)}
                placeholder="Search Medical, Mechanical, Electrical, Software, Legal..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white"
              />
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredProfessions.map((prof) => (
                <div key={prof.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{prof.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${prof.badgeColor}`}>
                      {prof.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{prof.description}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveProfessionId(prof.id);
                      setProfessionsModalOpen(false);
                    }}
                    className={`w-full py-2 rounded-lg text-xs font-medium ${
                      prof.id === activeProfessionId
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-cyan-500/20 text-slate-200'
                    }`}
                  >
                    {prof.id === activeProfessionId ? '✓ Active Mode' : `Activate ${prof.shortName}`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* IMAGE STUDIO MODAL */}
      {imageStudioOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-fuchsia-500/30 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-fuchsia-400" />
                <h3 className="text-base font-semibold text-white">JARVIS Neural Image Studio</h3>
              </div>
              <button type="button" onClick={() => setImageStudioOpen(false)} className="p-1.5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              rows={2}
              value={studioPrompt}
              onChange={(e) => setStudioPrompt(e.target.value)}
              placeholder="Describe the image you want to create..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white"
            />
            <div className="flex flex-wrap gap-2">
              <select
                value={studioStyle}
                onChange={(e) => setStudioStyle(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
              >
                {IMAGE_STYLE_PRESETS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label}
                  </option>
                ))}
              </select>
              <select
                value={studioAspectRatio}
                onChange={(e) => setStudioAspectRatio(e.target.value as '1:1' | '16:9' | '9:16' | '4:3')}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
              >
                <option value="1:1">1:1 Square</option>
                <option value="16:9">16:9 Wide</option>
                <option value="9:16">9:16 Portrait</option>
                <option value="4:3">4:3 Standard</option>
              </select>
              <button
                type="button"
                disabled={studioGenerating || !studioPrompt.trim()}
                onClick={async () => {
                  const preset = IMAGE_STYLE_PRESETS.find((p) => p.id === studioStyle) || IMAGE_STYLE_PRESETS[0];
                  setStudioGenerating(true);
                  const url = await generateFreeImage(`${studioPrompt.trim()}, ${preset.suffix}`, studioAspectRatio);
                  setArtGallery((prev) => [
                    {
                      id: Math.random().toString(36).substring(2, 9),
                      prompt: studioPrompt.trim(),
                      style: preset.label,
                      aspectRatio: studioAspectRatio,
                      imageUrl: url,
                      createdAt: Date.now(),
                    },
                    ...prev,
                  ]);
                  setStudioGenerating(false);
                }}
                className="ml-auto px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-cyan-600 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {studioGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Generate</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
              {artGallery.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <img src={item.imageUrl} alt={item.prompt} className="w-full h-44 object-cover" />
                  <div className="p-2.5 flex items-center justify-between text-xs gap-2">
                    <span className="truncate text-slate-300 flex-1">{item.prompt}</span>
                    <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 shrink-0">
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setArtGallery((prev) => prev.filter((g) => g.id !== item.id))}
                      className="text-rose-400 shrink-0"
                      title="Delete image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ENGINEERING & CLINICAL WORKBENCH MODAL */}
      {workbenchOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-emerald-500/30 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-semibold text-white">Engineering & Clinical Workbench</h3>
              </div>
              <button type="button" onClick={() => setWorkbenchOpen(false)} className="p-1.5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['calc', 'ohms', 'units', 'materials', 'clinical', 'labs'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setWorkbenchTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase ${
                    workbenchTab === tab ? 'bg-emerald-500 text-slate-950' : 'bg-slate-900 text-slate-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {workbenchTab === 'calc' && (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={calcInput}
                      onChange={(e) => setCalcInput(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-200"
                    />
                    <button
                      type="button"
                      onClick={handleRunScientificCalc}
                      className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-semibold"
                    >
                      Compute
                    </button>
                  </div>
                  {calcError ? (
                    <p className="text-xs text-rose-400">{calcError}</p>
                  ) : (
                    <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-mono text-emerald-300">
                      Result: {calcResult}
                    </div>
                  )}
                </>
              )}

              {workbenchTab === 'ohms' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      value={ohmsVoltage}
                      onChange={(e) => setOhmsVoltage(e.target.value)}
                      placeholder="Voltage (V)"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="number"
                      value={ohmsResistance}
                      onChange={(e) => setOhmsResistance(e.target.value)}
                      placeholder="Resistance (Ohms)"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-900 text-cyan-300">I: {ohmsMetrics.currentAmps}</div>
                    <div className="p-3 rounded-xl bg-slate-900 text-cyan-300">mA: {ohmsMetrics.currentMa}</div>
                    <div className="p-3 rounded-xl bg-slate-900 text-amber-300">P: {ohmsMetrics.powerWatts}</div>
                  </div>
                </div>
              )}

              {workbenchTab === 'units' && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <select
                      value={unitCategory}
                      onChange={(e) => setUnitCategory(e.target.value as 'length' | 'pressure' | 'energy' | 'temp')}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                    >
                      <option value="pressure">Pressure (Pa)</option>
                      <option value="length">Length (m)</option>
                      <option value="energy">Energy (J)</option>
                      <option value="temp">Temperature (°C)</option>
                    </select>
                    <input
                      type="number"
                      value={unitValue}
                      onChange={(e) => setUnitValue(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {unitConversions.map((u) => (
                      <div key={u.label} className="p-2.5 rounded-xl bg-slate-900 text-xs">
                        <div className="text-slate-400">{u.label}</div>
                        <div className="font-mono text-emerald-300">{u.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {workbenchTab === 'materials' && (
                <div className="space-y-2">
                  {ENGINEERING_MATERIALS_DB.map((m) => (
                    <div key={m.name} className="p-2.5 rounded-xl bg-slate-900 text-xs flex justify-between">
                      <span>{m.name}</span>
                      <span className="font-mono text-cyan-300">
                        {m.density} kg/m³ • {m.youngsGPa} GPa • {m.yieldMPa} MPa
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {workbenchTab === 'clinical' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={clinicalWeightKg} onChange={(e) => setClinicalWeightKg(e.target.value)} placeholder="kg" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />
                    <input type="number" value={clinicalHeightCm} onChange={(e) => setClinicalHeightCm(e.target.value)} placeholder="cm" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />
                    <input type="number" value={clinicalAge} onChange={(e) => setClinicalAge(e.target.value)} placeholder="age" className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-900 text-emerald-300">BMI: {clinicalMetrics.bmi} ({clinicalMetrics.category})</div>
                    <div className="p-3 rounded-xl bg-slate-900 text-cyan-300">BMR (M): {clinicalMetrics.bmrMale}</div>
                    <div className="p-3 rounded-xl bg-slate-900 text-cyan-300">BMR (F): {clinicalMetrics.bmrFemale}</div>
                  </div>
                </div>
              )}

              {workbenchTab === 'labs' && (
                <div className="space-y-2">
                  {CLINICAL_LAB_REFERENCES.map((lab) => (
                    <div key={lab.test} className="p-2.5 rounded-xl bg-slate-900 flex justify-between text-xs">
                      <span>{lab.test}</span>
                      <span className="font-mono text-cyan-300">{lab.range}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* NEURAL MEMORY MODAL */}
      {memoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-violet-500/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-violet-400" />
                <h3 className="text-base font-semibold text-white">JARVIS Persistent Memory</h3>
              </div>
              <button type="button" onClick={() => setMemoryModalOpen(false)} className="p-1.5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            {user.isGuest && (
              <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-400/30 p-2.5 rounded-xl">
                Guest Mode active: Memory will reset when the page refreshes. Sign in with Gmail to save permanently.
              </p>
            )}
            <div className="flex gap-2">
              <select
                value={newMemoryCategory}
                onChange={(e) => setNewMemoryCategory(e.target.value as MemoryEntry['category'])}
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
                placeholder="Add a personal fact for JARVIS..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newMemoryText.trim()) return;
                  setMemories((prev) => [
                    {
                      id: Math.random().toString(36).substring(2, 9),
                      category: newMemoryCategory,
                      content: newMemoryText.trim(),
                      createdAt: Date.now(),
                    },
                    ...prev,
                  ]);
                  setNewMemoryText('');
                }}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium"
              >
                Save
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {memories.map((mem) => (
                <div key={mem.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 text-xs">
                  <span>
                    <strong className="text-violet-300 mr-2">[{mem.category}]</strong>
                    {mem.content}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMemories((prev) => prev.filter((m) => m.id !== mem.id))}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* COMMAND PALETTE */}
      {commandPaletteOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-16 p-4">
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
              <button type="button" onClick={() => setCommandPaletteOpen(false)} className="text-xs text-slate-400">
                ESC
              </button>
            </div>
            <div className="divide-y divide-slate-800">
              {[
                { label: 'Create Gmail Account / Sign In', action: () => setAuthModalOpen(true) },
                { label: 'Install JARVIS Directly to Device', action: () => void handleInstallAppClick() },
                { label: 'Allow Voice Conversation', action: () => handleAllowVoiceConversation() },
                { label: 'Open Live World News', action: () => setNewsModalOpen(true) },
                { label: 'Open Specialist Matrix', action: () => setProfessionsModalOpen(true) },
                { label: 'Open Neural Image Studio', action: () => setImageStudioOpen(true) },
                { label: 'Open Engineering & Medical Workbench', action: () => setWorkbenchOpen(true) },
              ]
                .filter((c) => c.label.toLowerCase().includes(commandQuery.toLowerCase()))
                .map((cmd) => (
                  <button
                    key={cmd.label}
                    type="button"
                    onClick={() => {
                      setCommandPaletteOpen(false);
                      cmd.action();
                    }}
                    className="w-full px-4 py-3 text-left text-xs text-slate-200 hover:bg-cyan-500/10"
                  >
                    {cmd.label}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <JarvisErrorBoundary>
      <JarvisWorkspace />
    </JarvisErrorBoundary>
  );
}
