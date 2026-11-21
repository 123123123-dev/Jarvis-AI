/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  isConversationArchive,
} from './services/storage';
import { isImageGenerationPrompt } from './services/imagePrompts';
import { getWeatherRequest } from './services/weather';
import {
  WifiOff,
  Sparkles,
  Link,
  Mic,
  MicOff,
  Volume2,
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
  Send,
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
  PhoneOff,
  Save,
  Menu,
  Paperclip,
  Globe,
  ArrowUp,
} from 'lucide-react';

// ============================================================================
// TYPES & CONSTANTS
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
  quickPrompts: string[];
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

interface VoiceTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let earlyDeferredInstallPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    earlyDeferredInstallPrompt = e as BeforeInstallPromptEvent;
  });
}

const JARVIS_MEMORY_STORAGE_KEY = 'jarvis_neural_memory_v1';
const JARVIS_GALLERY_STORAGE_KEY = 'jarvis_art_gallery_v1';
const JARVIS_PROFESSION_STORAGE_KEY = 'jarvis_active_profession_v1';

let cachedBackendAvailable: boolean | null = null;

const NATURAL_CHAT_SYSTEM_PROMPT = `You are JARVIS, an intelligent, accurate, and helpful AI assistant.
Core rules:
1. Clean Notebook Writing Style (Strict):
   - Always write answers neatly just like a person writes by hand in a school or college notebook.
   - NEVER use LaTeX or formatting symbols such as $, $$, \\frac, \\times, **, *, #, ##, ###, ^, //, @, or backticks.
   - Write fractions simply with a slash like 1/2 or 4/8, powers like x² or x³, multiplication as ×, and division as ÷.
   - Write clear plain headings and numbered steps (Step 1:, Step 2:, 1., 2., 3.) without asterisks or hash symbols.
2. Single Standard/Formal Response by Default:
   - For general questions and all writing tasks (letters, applications, emails, essays, messages), provide ONLY ONE clean, direct answer in a standard, formal tone.
   - NEVER output multiple styles, versions, or variations unless the user explicitly asks to change the style.
3. Multi-Answer Questions ("full form of...", "types of...", "kinds of...", "meanings of..."):
   - When a question asks for full forms, meanings, or types/kinds/categories, list ALL major answers/types clearly in a numbered list unless the user says "only say one answer".
   - If the user subsequently asks for "more answers" or "all possible answers", look at the previous question in conversation history and list the remaining/all possible answers for that topic.`;

const PROFESSION_PROFILES: ProfessionProfile[] = [
  {
    id: 'general',
    name: 'JARVIS Omniscient Core',
    shortName: 'All-Domain Core',
    category: 'Universal',
    description:
      'Universal intelligence across study help, writing, coding, science, and live news.',
    badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    systemDirective:
      'Answer clearly, accurately, and directly in clean notebook style without formatting symbols.',
    quickPrompts: [
      'Give me a briefing on today’s top global and technology news from Google grounding.',
      'Explain photosynthesis in simple terms for a high school student.',
      'Help me plan a daily study timetable.',
    ],
  },
  {
    id: 'medical',
    name: 'Medical & Clinical Intelligence',
    shortName: 'Medical & Health',
    category: 'Healthcare',
    description:
      'Pathophysiology, differential considerations, diagnostic lab interpretation, and clinical guidelines.',
    badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    systemDirective:
      'Provide clear clinical explanations of pathophysiology, differential considerations, and diagnostic markers. Include a brief reminder to consult a licensed healthcare provider.',
    disclaimer:
      'Clinical Reference Mode: Educational medical information only — not a substitute for professional medical care.',
    quickPrompts: [
      'Explain how to interpret a Complete Blood Count (CBC) and Comprehensive Metabolic Panel.',
      'Outline common causes and red-flag symptoms for acute chest discomfort.',
      'Compare diagnostic criteria and first-line management of Type 2 Diabetes.',
    ],
  },
  {
    id: 'pharmacology',
    name: 'Clinical Pharmacology & Toxicology',
    shortName: 'Pharmacology',
    category: 'Healthcare',
    description:
      'Pharmacokinetics (ADME), receptor mechanisms, CYP450 drug interactions, and therapeutic monitoring.',
    badgeColor: 'text-teal-300 border-teal-500/40 bg-teal-500/10',
    systemDirective:
      'Explain mechanisms of action, pharmacokinetics, drug interactions, and contraindications clearly and completely.',
    disclaimer:
      'Pharmacology Reference Mode: Verify all dosing and drug interactions with a licensed pharmacist or physician.',
    quickPrompts: [
      'What are potential interactions between NSAIDs, ACE inhibitors, and diuretics?',
      'Explain CYP3A4 and CYP2D6 metabolic pathways and major drug interactions.',
      'Compare beta-blockers by cardioselectivity and clinical indications.',
    ],
  },
  {
    id: 'mechanical-eng',
    name: 'Mechanical & Thermodynamics Engineer',
    shortName: 'Mechanical Eng',
    category: 'Engineering',
    description:
      'Statics, dynamics, FEA stress/strain, fluid mechanics, heat transfer, HVAC, and CAD/CAM.',
    badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    systemDirective:
      'Provide clear mechanical engineering calculations, equations, material considerations, and SI/imperial unit clarity.',
    quickPrompts: [
      'Calculate maximum bending stress and deflection for a simply supported steel I-beam.',
      'Compare Rankine, Brayton, and Carnot thermodynamic cycle efficiencies.',
      'Select bearing types and tolerances for a high-RPM precision CNC spindle.',
    ],
  },
  {
    id: 'electrical-eng',
    name: 'Electrical, Power & Embedded Engineer',
    shortName: 'Electrical Eng',
    category: 'Engineering',
    description:
      'Analog/digital circuits, PCB layout, power electronics, microcontrollers, and control theory.',
    badgeColor: 'text-yellow-300 border-yellow-500/40 bg-yellow-500/10',
    systemDirective:
      'Provide clear circuit analysis, component sizing formulas, power electronics guidance, and embedded systems design.',
    quickPrompts: [
      'Design a 12V to 3.3V synchronous buck converter circuit with component sizing formulas.',
      'Explain PCB impedance control, ground planes, and EMI mitigation.',
      'Compare PID controller tuning methods (Ziegler-Nichols vs pole placement).',
    ],
  },
  {
    id: 'civil-eng',
    name: 'Civil, Structural & Geotechnical Engineer',
    shortName: 'Civil & Structural',
    category: 'Engineering',
    description:
      'Reinforced concrete, structural steel, seismic load design, foundation engineering, and hydraulics.',
    badgeColor: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
    systemDirective:
      'Analyze structural loads, reinforced concrete design, foundation engineering, and hydraulics clearly.',
    quickPrompts: [
      'Explain ACI 318 flexural strength design steps for a reinforced concrete beam.',
      'Compare shallow spread footings vs deep bored pile foundations in soft clay.',
      'Calculate Manning’s equation open-channel flow velocity and discharge.',
    ],
  },
  {
    id: 'aerospace-eng',
    name: 'Aerospace & Propulsion Systems Engineer',
    shortName: 'Aerospace Eng',
    category: 'Engineering',
    description:
      'Aerodynamics, orbital mechanics, rocket propulsion (Isp, delta-v), avionics, and composites.',
    badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
    systemDirective:
      'Provide clear aerospace engineering explanations covering aerodynamics, orbital mechanics, and propulsion.',
    quickPrompts: [
      'Calculate delta-v using the Tsiolkovsky rocket equation for a two-stage launch vehicle.',
      'Compare LOX/Methane (methalox) vs LOX/RP-1 rocket engine performance.',
      'Explain transonic wave drag and supercritical airfoil geometry.',
    ],
  },
  {
    id: 'software',
    name: 'Principal Software & AI Architect',
    shortName: 'Software & AI',
    category: 'Technology',
    description:
      'Full-stack TypeScript/React, distributed systems, algorithms, databases, and DevOps.',
    badgeColor: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
    systemDirective:
      'Deliver clean explanations and sound software architecture recommendations.',
    quickPrompts: [
      'Architect a fault-tolerant real-time WebSocket and Redis pub/sub backend.',
      'Review React rendering bottlenecks and propose memoization strategies.',
      'Explain a rate limiter algorithm using token bucket logic.',
    ],
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity & Zero-Trust Engineer',
    shortName: 'Cybersecurity',
    category: 'Security',
    description:
      'Threat modeling, OWASP Top 10, cryptography, cloud IAM, and defensive hardening.',
    badgeColor: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
    systemDirective:
      'Provide defensive cybersecurity guidance, vulnerability remediation, and zero-trust architecture best practices.',
    quickPrompts: [
      'Audit JWT session storage vs HttpOnly cookies against XSS and CSRF attacks.',
      'Design a Zero-Trust IAM architecture for a multi-region cloud deployment.',
      'Explain post-quantum cryptography standards (ML-KEM / CRYSTALS-Kyber).',
    ],
  },
  {
    id: 'legal',
    name: 'Legal & Regulatory Analyst',
    shortName: 'Legal & Policy',
    category: 'Law',
    description:
      'Contract structure, intellectual property, compliance frameworks, and statutory analysis.',
    badgeColor: 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10',
    systemDirective:
      'Break down contract clauses, compliance obligations, and legal concepts clearly.',
    disclaimer:
      'Legal Analysis Mode: Educational regulatory and contract breakdown; consult qualified counsel for formal advice.',
    quickPrompts: [
      'Explain key clauses to audit in a SaaS Master Services Agreement (MSA).',
      'Compare patent, copyright, and trade secret protection for AI software.',
      'Outline GDPR and global data privacy compliance obligations for web apps.',
    ],
  },
  {
    id: 'finance',
    name: 'Quantitative Finance & Macro Strategist',
    shortName: 'Finance & Markets',
    category: 'Economics',
    description:
      'Corporate valuation, DCF modeling, macroeconomics, portfolio risk, and financial statements.',
    badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    systemDirective:
      'Provide clear financial analysis, valuation frameworks, and macroeconomic insights.',
    quickPrompts: [
      'Build a step-by-step Discounted Cash Flow (DCF) valuation framework.',
      'Analyze how central bank interest rate shifts impact tech equities and bonds.',
      'Explain EBITDA, Free Cash Flow conversion, and working capital dynamics.',
    ],
  },
  {
    id: 'science',
    name: 'Scientific Research & Physics Fellow',
    shortName: 'Physics & Science',
    category: 'Research',
    description:
      'Quantum mechanics, astrophysics, molecular biology, chemistry, and experimental methodology.',
    badgeColor: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
    systemDirective:
      'Explain scientific concepts across physics, chemistry, and biology clearly and rigorously.',
    quickPrompts: [
      'Explain CRISPR-Cas9 base editing versus prime editing mechanisms.',
      'Summarize recent advances in magnetic confinement nuclear fusion.',
      'Derive the relativistic energy-momentum relation clearly.',
    ],
  },
  {
    id: 'architecture',
    name: 'Architectural & Structural Designer',
    shortName: 'Architecture & CAD',
    category: 'Design',
    description:
      'Sustainable building design, structural loads, urban planning, acoustics, and HVAC systems.',
    badgeColor: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
    systemDirective:
      'Address architectural design, spatial planning, materials, and sustainable building systems clearly.',
    quickPrompts: [
      'Design a passive-house residential floorplan optimized for hot climates.',
      'Compare mass timber (CLT) vs reinforced concrete for mid-rise structures.',
      'Calculate thermal envelope R-values and HVAC tonnage requirements.',
    ],
  },
  {
    id: 'business',
    name: 'Executive Strategy & Operations COO',
    shortName: 'Business & Ops',
    category: 'Leadership',
    description:
      'Go-to-market strategy, unit economics, OKRs, supply chain optimization, and negotiations.',
    badgeColor: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
    systemDirective:
      'Deliver practical business strategy, unit economics, and operational recommendations.',
    quickPrompts: [
      'Draft a 90-day Go-To-Market launch plan for an AI SaaS product.',
      'Analyze SaaS unit economics: CAC payback period, Net Dollar Retention, and churn.',
      'Prepare a structured negotiation playbook for enterprise vendor contracts.',
    ],
  },
  {
    id: 'education',
    name: 'Master Educator & Socratic Tutor',
    shortName: 'Education & Tutor',
    category: 'Learning',
    description:
      'Step-by-step intuitive explanations, exam prep, flashcards, and mental models for any subject.',
    badgeColor: 'text-lime-300 border-lime-500/40 bg-lime-500/10',
    systemDirective:
      'Teach concepts step-by-step from beginner intuition to deeper mastery with clear examples.',
    quickPrompts: [
      'Teach me Linear Algebra eigenvalues and eigenvectors visually from scratch.',
      'Create a 7-day intensive study syllabus for mastering organic chemistry.',
      'Quiz me on world history geopolitics with increasing difficulty.',
    ],
  },
  {
    id: 'creative',
    name: 'Creative Director & Narrative Studio',
    shortName: 'Creative & Media',
    category: 'Arts',
    description:
      'Screenwriting, visual storytelling, brand identity, world-building, and art direction.',
    badgeColor: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10',
    systemDirective:
      'Craft vivid, natural prose, stories, letters, scripts, and creative concepts.',
    quickPrompts: [
      'Write an opening sci-fi scene set aboard an orbital shipyard at dawn.',
      'Generate 5 hyper-detailed cinematic image prompts for a futuristic laboratory.',
      'Develop a complete brand voice and visual identity manifesto.',
    ],
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
  {
    id: 'breaking',
    label: 'Top World & Breaking News',
    prompt:
      'Give me a briefing from Google grounding of the biggest breaking world news and headlines today.',
  },
  {
    id: 'ai-tech',
    label: 'AI, Robotics & Tech',
    prompt:
      'Give me today’s latest AI, robotics, and technology news from Google grounding.',
  },
  {
    id: 'markets',
    label: 'Global Markets & Economy',
    prompt:
      'Give me today’s stock market and global economy headlines from Google grounding.',
  },
  {
    id: 'science-space',
    label: 'Science, Space & Energy',
    prompt:
      'Give me the latest science, space, and energy discoveries from Google grounding.',
  },
  {
    id: 'medical-news',
    label: 'Medicine & Biotech Updates',
    prompt:
      'Give me today’s latest medical and biotech news from Google grounding.',
  },
  {
    id: 'sports',
    label: 'Live Sports & Tournaments',
    prompt:
      'Give me today’s major sports scores and headlines from Google grounding.',
  },
];

const IMAGE_STYLE_PRESETS = [
  {
    id: 'cinematic',
    label: 'Cinematic Photoreal 8K',
    suffix:
      'photorealistic, 8k ultra-detailed, dramatic volumetric lighting, shot on 35mm lens, masterwork photography',
  },
  {
    id: 'blueprint',
    label: 'JARVIS Holographic Blueprint',
    suffix:
      'futuristic cyan and gold holographic CAD schematic blueprint on dark obsidian background, crisp technical vector lines',
  },
  {
    id: 'medical-3d',
    label: '3D Medical Illustration',
    suffix:
      'high-precision 3D anatomical and cellular scientific visualization, studio lighting, clean medical textbook render',
  },
  {
    id: 'concept-art',
    label: 'Sci-Fi Concept Art',
    suffix:
      'epic futuristic concept art, atmospheric perspective, intricate mechanical detail, Unreal Engine 5 cinematic render',
  },
  {
    id: 'architecture',
    label: 'Architectural Render',
    suffix:
      'modern luxury architectural visualization, golden hour sunlight, glass and concrete textures, V-Ray photorealistic render',
  },
  {
    id: 'anime',
    label: 'Studio Anime Illustration',
    suffix:
      'high-budget theatrical anime key visual, vibrant lighting, expressive linework, cinematic sky and reflections',
  },
];

const ACRONYM_KNOWLEDGE_BASE: Record<
  string,
  Array<{ expansion: string; domain: string; details: string }>
> = {
  DHA: [
    {
      expansion: 'Defence Housing Authority',
      domain: 'housing real estate property pakistan',
      details:
        'A major residential real estate and housing authority in Pakistan (with phases in Lahore, Karachi, Islamabad/Rawalpindi, Multan, Bahawalpur, Gujranwala, Peshawar, and Quetta) administered for armed forces personnel and civilians.',
    },
    {
      expansion: 'Docosahexaenoic Acid',
      domain: 'biology nutrition medicine chemistry omega 3',
      details:
        'An essential omega-3 fatty acid that is a primary structural component of the human brain, cerebral cortex, skin, and retina.',
    },
    {
      expansion: 'Dubai Health Authority',
      domain: 'healthcare medical dubai uae',
      details:
        'The government body responsible for overseeing healthcare services, hospitals, and medical licensing in Dubai, United Arab Emirates.',
    },
    {
      expansion: 'District Health Authority',
      domain: 'health government hospital punjab',
      details:
        'Regional public health administrative bodies responsible for district-level hospitals, immunization, and public healthcare delivery.',
    },
    {
      expansion: 'Department of Home Affairs',
      domain: 'government immigration australia south africa',
      details:
        'Government ministry responsible for immigration, border protection, citizenship, and internal security in countries such as Australia and South Africa.',
    },
    {
      expansion: 'Dihydroxyacetone',
      domain: 'chemistry cosmetics biochemistry',
      details:
        'A simple carbohydrate (triose) used in metabolic glycolysis pathways and as the active ingredient in sunless tanning products.',
    },
  ],
  ATM: [
    {
      expansion: 'Automated Teller Machine',
      domain: 'banking finance cash machine',
      details:
        'An electronic banking outlet that allows customers to complete basic financial transactions without the aid of a branch representative.',
    },
    {
      expansion: 'Asynchronous Transfer Mode',
      domain: 'networking telecommunications computer',
      details:
        'A high-speed telecommunications switching technique that uses fixed-size 53-byte cells to transmit voice, video, and data.',
    },
    {
      expansion: 'Standard Atmosphere (unit)',
      domain: 'physics chemistry pressure unit',
      details:
        'A unit of pressure defined as 101,325 pascals (Pa), approximately equal to Earth’s average atmospheric pressure at sea level.',
    },
    {
      expansion: 'Ataxia Telangiectasia Mutated',
      domain: 'genetics biology medicine dna',
      details:
        'A serine/threonine protein kinase gene involved in repairing DNA double-strand breaks and regulating cell cycle checkpoints.',
    },
  ],
  SIM: [
    {
      expansion: 'Subscriber Identity Module',
      domain: 'mobile telecom phone network',
      details:
        'An integrated circuit smart card that securely stores the International Mobile Subscriber Identity (IMSI) and cryptographic keys on mobile phones.',
    },
    {
      expansion: 'Structured Illumination Microscopy',
      domain: 'optics physics biology imaging',
      details:
        'A super-resolution fluorescence microscopy technique that bypasses the classical optical diffraction limit.',
    },
    {
      expansion: 'Society for Information Management',
      domain: 'business technology leadership',
      details:
        'A professional organization of senior IT executives, CIOs, and technology leaders.',
    },
  ],
  PIN: [
    {
      expansion: 'Personal Identification Number',
      domain: 'banking security password card',
      details:
        'A secret numeric passcode used to authenticate a user to an ATM, debit/credit card, or mobile device.',
    },
    {
      expansion: 'Postal Index Number',
      domain: 'postal mail address india',
      details:
        'A 6-digit postal code numbering system used by India Post to identify delivery post offices.',
    },
    {
      expansion: 'Positive-Intrinsic-Negative (Diode)',
      domain: 'electronics physics semiconductor',
      details:
        'A semiconductor diode with a wide undoped intrinsic region between p-type and n-type layers, used in RF switches and photodetectors.',
    },
  ],
  CSS: [
    {
      expansion: 'Cascading Style Sheets',
      domain: 'web development html design programming',
      details:
        'A stylesheet language used for describing the presentation, layout, colors, and typography of HTML web documents.',
    },
    {
      expansion: 'Central Superior Services',
      domain: 'pakistan civil service exam government',
      details:
        'A premier competitive examination conducted by the Federal Public Service Commission (FPSC) in Pakistan for recruitment into federal bureaucratic services.',
    },
    {
      expansion: 'Content Scramble System',
      domain: 'dvd encryption media drm',
      details:
        'A digital rights management (DRM) and encryption system used on commercial DVD-Video discs.',
    },
  ],
  RAM: [
    {
      expansion: 'Random Access Memory',
      domain: 'computer hardware memory electronics',
      details:
        'Volatile high-speed computer memory that temporarily stores active operating system data, applications, and variables for fast CPU access.',
    },
    {
      expansion: 'Reliability, Availability, and Maintainability',
      domain: 'engineering systems reliability',
      details:
        'An engineering discipline used to measure and optimize the operational uptime and dependability of complex industrial systems.',
    },
  ],
  API: [
    {
      expansion: 'Application Programming Interface',
      domain: 'software programming web development',
      details:
        'A set of protocols and definitions that allows different software applications to communicate and exchange data.',
    },
    {
      expansion: 'Active Pharmaceutical Ingredient',
      domain: 'pharmacology medicine drugs',
      details:
        'The biologically active chemical substance in a pharmaceutical drug that produces the intended therapeutic effect.',
    },
    {
      expansion: 'American Petroleum Institute',
      domain: 'oil gas energy engineering',
      details:
        'The largest U.S. trade association for the oil and natural gas industry, known for engineering and motor oil standards.',
    },
  ],
  ICU: [
    {
      expansion: 'Intensive Care Unit',
      domain: 'hospital medicine healthcare',
      details:
        'A specialized hospital department providing continuous monitoring and life-support care for critically ill or injured patients.',
    },
    {
      expansion: 'International Components for Unicode',
      domain: 'software programming localization',
      details:
        'An open-source set of C/C++ and Java libraries providing Unicode and globalization support for software applications.',
    },
  ],
};

// ============================================================================
// NOTEBOOK STYLE TEXT FORMATTER (ELIMINATES $$, //, **, ^, #, @ SYMBOLS)
// ============================================================================

const SUPERSCRIPT_CHAR_MAP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '(': '⁽',
  ')': '⁾',
  n: 'ⁿ',
};

function toUnicodeSuperscript(exp: string): string {
  return exp
    .split('')
    .map((ch) => SUPERSCRIPT_CHAR_MAP[ch] ?? ch)
    .join('');
}

function formatAsCleanNotebookText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?p>/gi, '\n');

  // Protect valid URLs (http:// or https://) before removing //
  const preservedUrls: string[] = [];
  text = text.replace(/https?:\/\/[^\s)\]]+/g, (url) => {
    const token = `JARVISURLTOKEN${preservedUrls.length}END`;
    preservedUrls.push(url);
    return token;
  });

  // Convert LaTeX \frac{a}{b} (repeatedly for nested braces) into clean notebook fractions
  for (let pass = 0; pass < 3; pass++) {
    text = text.replace(
      /\\(?:d|t)?frac\{([^{}]+)\}\{([^{}]+)\}/g,
      (_match, num: string, den: string) => {
        const cleanNum = num.trim();
        const cleanDen = den.trim();
        const simpleNum = /^[+-]?[a-zA-Z0-9.]+$/.test(cleanNum);
        const simpleDen = /^[+-]?[a-zA-Z0-9.]+$/.test(cleanDen);
        if (simpleNum && simpleDen) {
          return `${cleanNum}/${cleanDen}`;
        }
        return `(${cleanNum})/(${cleanDen})`;
      }
    );
  }

  // Convert common LaTeX commands into plain notebook notation
  text = text
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname)\{([^{}]+)\}/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\\pi\b/g, 'π')
    .replace(/\\theta\b/g, 'θ')
    .replace(/\\alpha\b/g, 'α')
    .replace(/\\beta\b/g, 'β')
    .replace(/\\gamma\b/g, 'γ')
    .replace(/\\delta\b/g, 'δ')
    .replace(/\\Delta\b/g, 'Δ')
    .replace(/\\Omega\b/g, 'Ω')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '');

  // Remove $$ and $ math delimiters
  text = text.replace(/\$\$/g, '').replace(/\$/g, '');

  // Convert exponents x^{2} or x^2 into Unicode superscripts and remove ^
  text = text
    .replace(/\^\{([^{}]+)\}/g, (_m, exp: string) => toUnicodeSuperscript(exp))
    .replace(/\^([0-9+-]+)/g, (_m, exp: string) => toUnicodeSuperscript(exp))
    .replace(/\^/g, '');

  // Remove remaining curly braces from LaTeX grouping
  text = text.replace(/[{}]/g, '');

  // Remove Markdown heading hashes (#, ##, ###), bold/italic asterisks (*, **), backticks (`), //, and @
  text = text
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/#/g, '')
    .replace(/\*{1,3}/g, '')
    .replace(/`+/g, '')
    .replace(/\/\//g, ' ')
    .replace(/@/g, '');

  // Restore protected URLs
  text = text.replace(/JARVISURLTOKEN(\d+)END/g, (_m, idxStr: string) => {
    const index = Number(idxStr);
    return preservedUrls[index] || '';
  });

  // Clean extra spaces and blank lines
  text = text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

// ============================================================================
// EXACT RATIONAL ARITHMETIC & NOTEBOOK MATH / EQUATION SOLVER
// ============================================================================

interface FractionValue {
  n: number;
  d: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function makeFraction(numerator: number, denominator = 1): FractionValue {
  if (denominator === 0) {
    return { n: NaN, d: 1 };
  }
  if (!Number.isInteger(numerator) || !Number.isInteger(denominator)) {
    const scale = 1000000;
    const nScaled = Math.round(numerator * scale);
    const dScaled = Math.round(denominator * scale);
    const g = gcd(nScaled, dScaled);
    const sign = dScaled < 0 ? -1 : 1;
    return { n: (sign * nScaled) / g, d: Math.abs(dScaled) / g };
  }
  if (numerator === 0) return { n: 0, d: 1 };
  const sign = denominator < 0 ? -1 : 1;
  const g = gcd(numerator, denominator);
  return {
    n: (sign * numerator) / g,
    d: Math.abs(denominator) / g,
  };
}

function addFractions(a: FractionValue, b: FractionValue): FractionValue {
  return makeFraction(a.n * b.d + b.n * a.d, a.d * b.d);
}

function subFractions(a: FractionValue, b: FractionValue): FractionValue {
  return makeFraction(a.n * b.d - b.n * a.d, a.d * b.d);
}

function divFractions(a: FractionValue, b: FractionValue): FractionValue {
  return makeFraction(a.n * b.d, a.d * b.n);
}

function formatFractionNotebook(f: FractionValue): string {
  if (!Number.isFinite(f.n) || !Number.isFinite(f.d) || f.d === 0) return 'undefined';
  if (f.n === 0) return '0';
  if (f.d === 1) return String(f.n);
  const decimal = f.n / f.d;
  const cleanDec = Number(decimal.toPrecision(6)).toString();
  if (cleanDec.length <= 6 && !cleanDec.includes('e')) {
    return `${f.n}/${f.d} (or ${cleanDec})`;
  }
  return `${f.n}/${f.d}`;
}

function formatFractionShort(f: FractionValue): string {
  if (f.n === 0) return '0';
  if (f.d === 1) return String(f.n);
  return `${f.n}/${f.d}`;
}

function normalizeImplicitMultiplication(expr: string): string {
  return expr
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−/g, '-')
    .replace(/(\d)\s*\(/g, '$1*(')
    .replace(/\)\s*(\d)/g, ')*$1')
    .replace(/\)\s*\(/g, ')*(')
    .replace(/(\d)\s*(pi|e|sin|cos|tan|sqrt|log|ln|abs)\b/gi, '$1*$2');
}

function evaluateSafeMathExpression(rawExpr: string): number {
  const sanitized = normalizeImplicitMultiplication(rawExpr)
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
      const exponent = parsePower();
      base = Math.pow(base, exponent);
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
      while (/[a-z]/.test(peek())) {
        ident += consume();
      }
      if (ident === 'pi') return Math.PI;
      if (ident === 'e') return Math.E;

      if (peek() !== '(') throw new Error(`Expected '(' after function ${ident}.`);
      consume();
      const arg = parseExpression();
      if (peek() !== ')') throw new Error(`Expected ')' after ${ident}(...).`);
      consume();

      switch (ident) {
        case 'sin':
          return Math.sin(arg);
        case 'cos':
          return Math.cos(arg);
        case 'tan':
          return Math.tan(arg);
        case 'sqrt':
          if (arg < 0) throw new Error('Square root of negative number.');
          return Math.sqrt(arg);
        case 'log':
          if (arg <= 0) throw new Error('Logarithm requires positive input.');
          return Math.log10(arg);
        case 'ln':
          if (arg <= 0) throw new Error('Natural log requires positive input.');
          return Math.log(arg);
        case 'abs':
          return Math.abs(arg);
        default:
          throw new Error(`Unknown function: ${ident}`);
      }
    }

    let numStr = '';
    while (/[0-9.]/.test(peek())) {
      numStr += consume();
    }
    if (!numStr) throw new Error(`Unexpected token near "${peek()}"`);
    const parsed = Number(numStr);
    if (!Number.isFinite(parsed)) throw new Error('Invalid numeric value.');
    return parsed;
  };

  const result = parseExpression();
  if (pos !== sanitized.length) {
    throw new Error(`Unexpected trailing character "${peek()}"`);
  }
  if (!Number.isFinite(result)) {
    throw new Error('Calculation overflow or undefined result.');
  }
  return result;
}

function formatCleanNumber(num: number): string {
  if (Math.abs(num) < 1e-12) return '0';
  if (Number.isInteger(num)) return String(num);
  return Number(num.toPrecision(10)).toString();
}

function parseNumericOrFractionToken(token: string): FractionValue | null {
  const fracMatch = token.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
    return makeFraction(num, den);
  }
  const numVal = Number(token);
  if (!Number.isFinite(numVal)) return null;
  return makeFraction(numVal, 1);
}

function parseLinearSide(sideExpr: string): {
  vars: Record<string, FractionValue>;
  constant: FractionValue;
  hadReducibleFraction: boolean;
} | null {
  const compact = sideExpr.replace(/−/g, '-').replace(/÷/g, '/').replace(/\s+/g, '');
  if (!compact || /[()*^]/.test(compact)) return null;

  const withPlus = compact.replace(/(?<!^)-/g, '+-');
  const terms = withPlus.split('+').filter(Boolean);
  if (terms.length === 0) return null;

  const vars: Record<string, FractionValue> = {};
  let constant: FractionValue = { n: 0, d: 1 };
  let hadReducibleFraction = false;

  for (const term of terms) {
    const varMatch = term.match(/^([+-]?(?:\d+(?:\/\d+|\.\d+)?)?)([a-zA-Z])$/);
    if (varMatch) {
      const coeffStr = varMatch[1];
      const varName = varMatch[2].toLowerCase();
      let coeff: FractionValue | null;
      if (coeffStr === '' || coeffStr === '+') {
        coeff = { n: 1, d: 1 };
      } else if (coeffStr === '-') {
        coeff = { n: -1, d: 1 };
      } else {
        coeff = parseNumericOrFractionToken(coeffStr);
        if (coeff && coeffStr.includes('/') && coeff.d !== Number(coeffStr.split('/')[1])) {
          hadReducibleFraction = true;
        }
      }
      if (!coeff) return null;
      vars[varName] = addFractions(vars[varName] || { n: 0, d: 1 }, coeff);
      continue;
    }

    const parsedConst = parseNumericOrFractionToken(term);
    if (!parsedConst) return null;
    if (term.includes('/') && parsedConst.d !== Number(term.split('/')[1])) {
      hadReducibleFraction = true;
    }
    constant = addFractions(constant, parsedConst);
  }

  return { vars, constant, hadReducibleFraction };
}

function solveMathOrEquation(rawInput: string): string | null {
  const cleaned = rawInput
    .trim()
    .replace(/^(?:what\s+is|calculate|compute|solve|evaluate|simplify|check(?:\s+if)?)\s+/i, '')
    .replace(/[?]+$/g, '')
    .trim();

  if (!cleaned) return null;

  // 1. Equations containing '=' (e.g., 2+10-7=12-9 or 2x-9y+4=3y+6x+4/8)
  if (cleaned.includes('=')) {
    const parts = cleaned.split('=').map((p) => p.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [lhsRaw, rhsRaw] = parts;

    // 1A. Purely numeric equation verification (e.g., 2+10-7=12-9)
    try {
      const lhsVal = evaluateSafeMathExpression(lhsRaw);
      const rhsVal = evaluateSafeMathExpression(rhsRaw);
      const isEqual = Math.abs(lhsVal - rhsVal) < 1e-9;
      const lhsStr = formatCleanNumber(lhsVal);
      const rhsStr = formatCleanNumber(rhsVal);

      return [
        `Given equation: ${lhsRaw} = ${rhsRaw}`,
        `Left side: ${lhsRaw} = ${lhsStr}`,
        `Right side: ${rhsRaw} = ${rhsStr}`,
        isEqual
          ? `Result: Correct (True), because both sides equal ${lhsStr}.`
          : `Result: Incorrect (False), because ${lhsStr} is not equal to ${rhsStr}.`,
      ].join('\n');
    } catch {
      // Fall through to algebraic linear equation solver
    }

    // 1B. Linear algebraic equation (1 or 2 variables, including fractions like 4/8)
    const lhsParsed = parseLinearSide(lhsRaw);
    const rhsParsed = parseLinearSide(rhsRaw);
    if (lhsParsed && rhsParsed) {
      const allVars = Array.from(
        new Set([...Object.keys(lhsParsed.vars), ...Object.keys(rhsParsed.vars)])
      ).sort();

      if (allVars.length === 1) {
        const v = allVars[0];
        const netVar = subFractions(
          lhsParsed.vars[v] || { n: 0, d: 1 },
          rhsParsed.vars[v] || { n: 0, d: 1 }
        );
        const netConst = subFractions(rhsParsed.constant, lhsParsed.constant);

        if (netVar.n === 0) {
          return netConst.n === 0
            ? `Given equation: ${cleaned}\nResult: Infinite solutions (this equation is true for every value of ${v}).`
            : `Given equation: ${cleaned}\nResult: No solution (it simplifies to 0 = ${formatFractionNotebook(netConst)}, which is false).`;
        }

        const solution = divFractions(netConst, netVar);
        return [
          `Given equation: ${cleaned}`,
          `Step 1: Move ${v} terms to the left side and numbers to the right side:`,
          `${formatFractionShort(netVar)}${v} = ${formatFractionShort(netConst)}`,
          `Step 2: Divide both sides by ${formatFractionShort(netVar)}:`,
          `${v} = ${formatFractionNotebook(solution)}`,
        ].join('\n');
      }

      if (allVars.length === 2) {
        const [v1, v2] = allVars;
        let c1 = subFractions(
          lhsParsed.vars[v1] || { n: 0, d: 1 },
          rhsParsed.vars[v1] || { n: 0, d: 1 }
        );
        let c2 = subFractions(
          lhsParsed.vars[v2] || { n: 0, d: 1 },
          rhsParsed.vars[v2] || { n: 0, d: 1 }
        );
        let rhsC = subFractions(rhsParsed.constant, lhsParsed.constant);

        if (c1.n < 0) {
          c1 = { n: -c1.n, d: c1.d };
          c2 = { n: -c2.n, d: c2.d };
          rhsC = { n: -rhsC.n, d: rhsC.d };
        }

        const formatVarTerm = (coeff: FractionValue, varName: string, isFirst: boolean): string => {
          const absNum = Math.abs(coeff.n);
          const magStr =
            coeff.d === 1
              ? absNum === 1
                ? ''
                : String(absNum)
              : `(${absNum}/${coeff.d})`;
          if (isFirst) {
            return `${coeff.n < 0 ? '-' : ''}${magStr}${varName}`;
          }
          return `${coeff.n < 0 ? ' - ' : ' + '}${magStr}${varName}`;
        };

        const standardEquation = `${formatVarTerm(c1, v1, true)}${formatVarTerm(
          c2,
          v2,
          false
        )} = ${formatFractionShort(rhsC)}`;

        // Solve for v2 (e.g., y)
        const v2RhsConst = divFractions(rhsC, c2);
        const v2Slope = divFractions({ n: -c1.n, d: c1.d }, c2);
        const v2SlopeStr =
          v2Slope.n === 0
            ? ''
            : `${v2Slope.n < 0 ? '-' : ''}${
                v2Slope.d === 1
                  ? Math.abs(v2Slope.n) === 1
                    ? ''
                    : Math.abs(v2Slope.n)
                  : `(${Math.abs(v2Slope.n)}/${v2Slope.d})`
              }${v1}`;
        const v2ConstStr =
          v2RhsConst.n === 0
            ? ''
            : v2SlopeStr
              ? `${v2RhsConst.n < 0 ? ' - ' : ' + '}${formatFractionShort({
                  n: Math.abs(v2RhsConst.n),
                  d: v2RhsConst.d,
                })}`
              : formatFractionShort(v2RhsConst);
        const solvedForV2 = `${v2} = ${v2SlopeStr}${v2ConstStr || '0'}`;

        // Solve for v1 (e.g., x)
        const v1RhsConst = divFractions(rhsC, c1);
        const v1Slope = divFractions({ n: -c2.n, d: c2.d }, c1);
        const v1SlopeStr =
          v1Slope.n === 0
            ? ''
            : `${v1Slope.n < 0 ? '-' : ''}${
                v1Slope.d === 1
                  ? Math.abs(v1Slope.n) === 1
                    ? ''
                    : Math.abs(v1Slope.n)
                  : `(${Math.abs(v1Slope.n)}/${v1Slope.d})`
              }${v2}`;
        const v1ConstStr =
          v1RhsConst.n === 0
            ? ''
            : v1SlopeStr
              ? `${v1RhsConst.n < 0 ? ' - ' : ' + '}${formatFractionShort({
                  n: Math.abs(v1RhsConst.n),
                  d: v1RhsConst.d,
                })}`
              : formatFractionShort(v1RhsConst);
        const solvedForV1 = `${v1} = ${v1SlopeStr}${v1ConstStr || '0'}`;

        const steps: string[] = [`Given equation: ${cleaned}`];
        let stepNum = 1;

        if (lhsParsed.hadReducibleFraction || rhsParsed.hadReducibleFraction) {
          steps.push(
            `Step ${stepNum++}: Simplify the fractions first (for example, 4/8 simplifies to 1/2).`
          );
        }

        steps.push(
          `Step ${stepNum++}: Move variable terms to the left side and numbers to the right side, then combine like terms:`,
          standardEquation,
          `Step ${stepNum++}: Solved for ${v2}:`,
          solvedForV2,
          `Step ${stepNum++}: Solved for ${v1}:`,
          solvedForV1
        );

        return steps.join('\n');
      }
    }

    return null;
  }

  // 2. Standalone arithmetic / math expression (e.g., 8/2+56(2), sqrt(144)+25)
  const strippedMathWords = cleaned
    .replace(/\b(?:pi|e|sin|cos|tan|sqrt|log|ln|abs)\b/gi, '')
    .trim();
  const hasDigit = /\d/.test(strippedMathWords);
  const hasMathOperator = /[+\-*/^()]/.test(strippedMathWords);
  const hasOnlyMathChars = /^[0-9+\-*/^().\s]+$/.test(strippedMathWords);

  if (hasDigit && hasMathOperator && hasOnlyMathChars) {
    try {
      const value = evaluateSafeMathExpression(cleaned);
      return `${cleaned} = ${formatCleanNumber(value)}`;
    } catch {
      return null;
    }
  }

  return null;
}

function isLikelyMathExpression(text: string): boolean {
  return (
    /[=+\-*/^]/.test(text) &&
    /\d/.test(text) &&
    !/\b(?:full\s*form|letter|application|news|who|what\s+is\s+[a-z]{3,})\b/i.test(text)
  );
}

// ============================================================================
// CONTEXT-AWARE INTELLIGENCE, FORMAL DEFAULT & MULTI-ANSWER CONTROL
// ============================================================================

function getInstantGreetingReply(text: string): string | null {
  const cleaned = text.trim().toLowerCase().replace(/[!?.]+$/g, '');
  if (/^(?:hi|hello|hey|yo|greetings)$/.test(cleaned)) {
    return 'Hello! How can I help you today?';
  }
  if (/^(?:assalam\s*o?\s*alaikum|salam|as-salamu alaykum)$/.test(cleaned)) {
    return 'Wa Alaikum Assalam! How can I help you today?';
  }
  if (/^(?:good morning|good afternoon|good evening)$/.test(cleaned)) {
    return `${text.trim().replace(/[!?.]+$/g, '')}! How can I help you today?`;
  }
  if (/^(?:how are you|how r u|how are you doing)$/.test(cleaned)) {
    return "I'm doing great, thank you! What can I help you with today?";
  }
  if (/^(?:thanks|thank you|thx)$/.test(cleaned)) {
    return "You're welcome! Let me know if you need anything else.";
  }
  return null;
}

function isMultiAnswerCategoryQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;

  if (
    /^(?:write|draft|compose|create|generate|make|rewrite|change|turn)\s+(?:a|an|the|it|this)?\s*(?:letter|application|email|essay|story|poem|message|note|paragraph)\b/i.test(
      lower
    )
  ) {
    return false;
  }

  return (
    /\b(?:full\s*forms?|fully\s*forms?|stands?\s+for|acronyms?|abbreviations?|meanings?\s+of)\b/i.test(
      lower
    ) ||
    /\b(?:types?|kinds?|categories|forms?|branches|parts|classifications|examples)\s+of\b/i.test(
      lower
    )
  );
}

function detectAnswerQuantityPreference(text: string): {
  wantsOnlyOne: boolean;
  wantsMoreOrAll: boolean;
  wantsOnlyRemaining: boolean;
} {
  const lower = text.toLowerCase().trim();

  const wantsOnlyOne =
    /\b(?:only\s+(?:say|give|tell|show|provide|write)?\s*(?:one|1)|(?:just|strictly)\s+(?:say|give|tell|show|provide|write)?\s*(?:one|1)|(?:one|1)\s+(?:answer|meaning|full\s*form|type|kind|option|result)\s+only|single\s+(?:answer|meaning|full\s*form|type)|only\s+1\b|just\s+1\b)\b/i.test(
      lower
    );

  const wantsOnlyRemaining =
    /\b(?:more|other|remaining|rest\s+of(?:\s+the)?|additional|extra)\s+(?:answers?|meanings?|full\s*forms?|types?|kinds?|options?|ones?)\b/i.test(
      lower
    ) ||
    /^(?:more|tell\s+(?:me\s+)?more|give\s+(?:me\s+)?more|say\s+more|what\s+else|any\s+other|others?)$/i.test(
      lower.replace(/[!?.]+$/g, '')
    );

  const wantsAll =
    /\b(?:all\s+(?:possible\s+)?(?:answers?|meanings?|full\s*forms?|types?|kinds?|options?|results?)|show\s+(?:me\s+)?all|list\s+all|all\s+of\s+them)\b/i.test(
      lower
    );

  return {
    wantsOnlyOne,
    wantsMoreOrAll: wantsOnlyRemaining || wantsAll,
    wantsOnlyRemaining: wantsOnlyRemaining && !wantsAll,
  };
}

function detectStyleChangeRequest(text: string): string | null {
  const lower = text.toLowerCase().trim();
  if (
    /\b(?:make\s+it|do\s+it|write\s+it|change\s+(?:it\s+)?to|rewrite\s+(?:it\s+)?(?:as|in)|turn\s+it\s+into|in\s+a)?\s*(?:friendly|casual|informal|humorous|funny|cute|short|shorter|brief|simple|simpler|polite|emotional|text\s*message|sms|email)\b/i.test(
      lower
    )
  ) {
    return text.trim();
  }
  return null;
}

function explicitGoogleGroundingRequested(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  return (
    /\bgoogle\s+grounding\b/.test(lower) ||
    /\bfrom\s+google\b/.test(lower) ||
    /\b(?:breaking|latest|today(?:'s|s)?)\s+(?:world\s+)?(?:news|headlines)\b/.test(lower)
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
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(id);
  }
}

function raceToFirstSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let rejectedCount = 0;
    const total = promises.length;
    if (total === 0) {
      reject(new Error('No requests provided'));
      return;
    }
    promises.forEach((p) => {
      p.then(resolve).catch(() => {
        rejectedCount += 1;
        if (rejectedCount === total) {
          reject(new Error('All parallel AI endpoints failed'));
        }
      });
    });
  });
}

function analyzeConversationContext(
  conversationHistory: Array<{ role: string; content: string }>
): {
  isFollowUp: boolean;
  latestMessage: string;
  previousUserMessages: string[];
  previousAssistantMessages: string[];
  combinedTopicContext: string;
  lastMeaningfulUserQuestion: string;
} {
  const userMessages = conversationHistory
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter(Boolean);

  const assistantMessages = conversationHistory
    .filter((m) => m.role === 'assistant')
    .map((m) => m.content.trim())
    .filter(Boolean);

  const latestMessage = userMessages[userMessages.length - 1] || '';
  const previousUserMessages = userMessages.slice(0, -1);

  if (previousUserMessages.length === 0) {
    return {
      isFollowUp: false,
      latestMessage,
      previousUserMessages: [],
      previousAssistantMessages: assistantMessages,
      combinedTopicContext: latestMessage,
      lastMeaningfulUserQuestion: latestMessage,
    };
  }

  const lower = latestMessage.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const qtyPref = detectAnswerQuantityPreference(latestMessage);
  const styleChange = detectStyleChangeRequest(latestMessage);

  const isStandaloneRequest =
    !qtyPref.wantsMoreOrAll &&
    !styleChange &&
    (/^(?:write\s+(?:a|an)\b|draft\b|compose\b|create\b|generate\b|calculate\b|solve\b|translate\b|hi\b|hello\b)/i.test(
      lower
    ) ||
      /\b(?:full\s*form|fully\s*form|stand\s*for|stands\s*for|meaning)\s+(?:of\s+)?[a-z0-9]{2,}\b/i.test(
        lower
      ) ||
      /\b(?:types?|kinds?|categories|forms?)\s+of\s+[a-z0-9]{2,}/i.test(lower) ||
      /^(?:what|who|when|where|define)\s+(?:is|are|was|were)\s+(?!it\b|this\b|that\b|these\b|those\b)[a-z0-9]{2,}/i.test(
        lower
      ));

  const hasFollowUpCue =
    qtyPref.wantsMoreOrAll ||
    Boolean(styleChange) ||
    /^(?:about|regarding|for|in|on|with|and|or|also|what about|how about|i mean|i means|specifically|especially|only|more|explain|elaborate|shorten|shorter|longer|brief|summarize|rewrite|change|update|modify|make it|do it|all possible|why|how|what else)\b/i.test(
      lower
    ) ||
    /\b(?:it|this|that|these|those|above|previous|first one|second one|third one|last one|possible answers|more answers|other answers|remaining answers)\b/i.test(
      lower
    ) ||
    (wordCount <= 2 && !isStandaloneRequest);

  const isFollowUp = !isStandaloneRequest && hasFollowUpCue;
  const lastMeaningfulPrev =
    [...previousUserMessages]
      .reverse()
      .find((m) => !getInstantGreetingReply(m)) ||
    previousUserMessages[previousUserMessages.length - 1];

  const combinedTopicContext = isFollowUp
    ? `${lastMeaningfulPrev} — ${latestMessage}`
    : latestMessage;

  return {
    isFollowUp,
    latestMessage,
    previousUserMessages,
    previousAssistantMessages: assistantMessages,
    combinedTopicContext,
    lastMeaningfulUserQuestion: isFollowUp ? lastMeaningfulPrev : latestMessage,
  };
}

function generateContextAwareLetterOrApplication(
  conversationHistory: Array<{ role: string; content: string }>
): string | null {
  const ctx = analyzeConversationContext(conversationHistory);
  const latestLower = ctx.latestMessage.toLowerCase();
  const combinedLower = ctx.combinedTopicContext.toLowerCase();

  const latestIsLetterOrApp =
    /\b(?:write|draft|compose)\s+(?:a|an)?\s*(?:letter|application)\b|\bletter\s+to\b|\bapplication\s+to\b/.test(
      latestLower
    );

  if (!latestIsLetterOrApp && !ctx.isFollowUp) {
    return null;
  }

  const isLetter = /\bwrite\s+(?:a\s+)?letter\b|\bletter\s+to\b/.test(combinedLower);
  const isApplication = /\bwrite\s+(?:an?\s+)?application\b|\bapplication\s+to\b|\bleave\s+application\b/.test(
    combinedLower
  );

  if (!isLetter && !isApplication) return null;

  const isFriendly = /\bfriendly\b|\bcasual\b|\binformal\b/.test(combinedLower);
  const isShorter = /\bshort(?:er)?\b|\bbrief\b|\bsmall\b/.test(latestLower);

  const reasonMatch = ctx.combinedTopicContext.match(
    /(?:that|saying|telling(?:\s+him|\s+her|\s+them)?|regarding|about|for\s+(?:asking\s+to)?|to\s+(?:ask|inform|tell|request))\s+(.+)$/i
  );
  let extractedReason = reasonMatch ? reasonMatch[1].trim() : '';
  extractedReason = extractedReason
    .replace(/\bcomming\b/gi, 'coming')
    .replace(/\bhometoday\b/gi, 'home today')
    .replace(/\bstuding\b/gi, 'studying')
    .replace(/\btommorow\b/gi, 'tomorrow')
    .replace(/[.?!]+$/g, '')
    .trim();

  const amountMatch = ctx.combinedTopicContext.match(
    /(?:rs\.?|rupees?|pkr|\$|usd|inr)?\s*(\d[\d,]*\s*(?:thousand|hundred|lakh|lac)?\s*(?:rupees?|rs\.?|pkr|dollars?)?)/i
  );
  const requestedAmount = amountMatch ? amountMatch[0].trim() : '';

  if (isApplication) {
    const isLeave = /\bleave\b|\bsick\b|\bill\b|\babsent\b|\burgent\b/.test(combinedLower);
    const subjectLine = isLeave
      ? 'Application for Leave'
      : extractedReason
        ? `Application Regarding ${extractedReason.charAt(0).toUpperCase() + extractedReason.slice(1)}`
        : 'Application for Kind Consideration';

    const bodyText = isLeave
      ? 'Most respectfully, I state that I am a regular student of class [Your Class and Section] in your institution. Due to an urgent matter at home, I am unable to attend classes today.'
      : extractedReason
        ? `Most respectfully, I state that I am a regular student of class [Your Class and Section] in your institution. I am writing to kindly request your consideration regarding ${extractedReason}.`
        : 'Most respectfully, I state that I am a regular student of class [Your Class and Section] in your institution. I am writing to kindly request your support regarding my academic matter.';

    return [
      'To,',
      'The Principal,',
      '[Your School or College Name],',
      '[City Name]',
      '',
      `Subject: ${subjectLine}`,
      '',
      'Respected Sir / Madam,',
      '',
      bodyText,
      '',
      'Kindly grant my request for [Date / Number of Days]. I shall be very grateful to you for this kindness.',
      '',
      'Yours obediently,',
      '[Your Name]',
      'Class: [Your Class] | Roll No: [Your Roll Number]',
      'Date: [Date]',
    ].join('\n');
  }

  const toFather = /\bdad\b|\bfather\b|\bpapa\b|\babbu\b/.test(combinedLower);
  const toMother = /\bmom\b|\bmother\b|\bmama\b|\bammi\b/.test(combinedLower);
  const toFriend = /\bfriend\b/.test(combinedLower);

  const salutation = toFather
    ? isFriendly
      ? 'Dear Dad,'
      : 'Respected Father,'
    : toMother
      ? isFriendly
        ? 'Dear Mom,'
        : 'Respected Mother,'
      : toFriend
        ? 'Dear [Friend’s Name],'
        : 'Dear [Recipient’s Name],';

  const signOff = toFather || toMother
    ? isFriendly
      ? 'With love,'
      : 'Your loving son / daughter,'
    : 'Yours sincerely,';

  const isComingHome = /\bcoming\s+home\b|\bcomming\s+home\b|\bhometoday\b|\breturn(?:ing)?\s+home\b|\bvisit(?:ing)?\s+home\b/.test(
    combinedLower
  );
  const isSchoolFee = /\bschool\s*fee\b|\bcollege\s*fee\b|\btuition\s*fee\b|\bfee\b/.test(
    combinedLower
  );

  let bodyParagraphs: string[];

  if (isComingHome) {
    const whenText = /\btomorrow\b/.test(combinedLower)
      ? 'tomorrow'
      : /\btonight\b/.test(combinedLower)
        ? 'tonight'
        : 'today';

    if (isFriendly) {
      bodyParagraphs = isShorter
        ? [
            `Hope you're doing great! Just wanted to let you know that I am coming home ${whenText}.`,
            `I'll leave right after my classes and should reach home by [Arrival Time]. See you soon!`,
          ]
        : [
            `I hope you're doing great and everything at home is going smoothly!`,
            `I'm excited to let you know that I am coming home ${whenText}. As soon as my classes finish, I'll head out and expect to reach home around [Arrival Time].`,
            `Can't wait to catch up with you and everyone at home. Let me know if you'd like me to bring anything along!`,
          ];
    } else {
      bodyParagraphs = isShorter
        ? [
            `I hope this letter finds you in the best of health and spirits. I am writing to inform you that I am coming home ${whenText}.`,
            `I will depart after my classes conclude and expect to arrive by [Arrival Time].`,
          ]
        : [
            'I hope this letter finds you in the best of health and spirits. Everything here is progressing well with my studies.',
            `I am writing to inform you that I am coming home ${whenText}. After completing my classes, I will depart by [Transport / Bus / Train] at [Departure Time] and expect to arrive home around [Arrival Time].`,
            'Please convey my warm regards to everyone at home. I look forward to seeing you soon.',
          ];
    }
  } else if (isSchoolFee) {
    const feeDetail = requestedAmount
      ? `The total fee amount due is ${requestedAmount}, and the due date is approaching soon.`
      : 'The due date for submitting my school fee is approaching soon.';
    bodyParagraphs = [
      'I hope this letter finds you in good health and high spirits. Everything is going well here, and I am working diligently on my studies.',
      `I am writing to inform you that our institution has announced the schedule for this term's fee submission. ${feeDetail} I kindly request you to send the required amount at your earliest convenience so that I may deposit it on time.`,
      'Please convey my warm regards to everyone at home.',
    ];
  } else if (extractedReason) {
    const normalizedReason = extractedReason.replace(/^i\s+am\b/i, 'I am').replace(/^i\b/i, 'I');
    bodyParagraphs = [
      'I hope this letter finds you in good health and spirits. Everything is going well on my end.',
      `I am writing to inform you that ${normalizedReason}. I wanted to let you know in advance so that everything may be arranged smoothly.`,
      'Please convey my warm regards to everyone at home.',
    ];
  } else {
    bodyParagraphs = [
      'I hope this letter finds you in the best of health and spirits. Everything here is going well, and I remain focused on my studies and responsibilities.',
      'Please convey my warm regards to everyone at home.',
    ];
  }

  return [
    '[Your Address / Hostel Name]',
    '[City Name]',
    '[Date]',
    '',
    salutation,
    '',
    ...bodyParagraphs.flatMap((p) => [p, '']),
    signOff,
    '[Your Name]',
  ].join('\n');
}

function resolveCuratedMultiAnswerKnowledge(
  conversationHistory: Array<{ role: string; content: string }>
): string | null {
  const ctx = analyzeConversationContext(conversationHistory);
  const fullContext = ctx.combinedTopicContext;
  const fullLower = fullContext.toLowerCase();
  const qtyPref = detectAnswerQuantityPreference(ctx.latestMessage);

  const isFullFormOrMeaningQuery =
    /\b(?:full\s*form|fully\s*form|stand\s*for|stands\s*for|acronym|abbreviation|meaning|answers?)\b/i.test(
      fullLower
    );

  const acronymMatch =
    ctx.lastMeaningfulUserQuestion.match(/\b([A-Z]{2,8})\b/) ||
    fullContext.match(/\b([A-Z]{2,8})\b/) ||
    fullContext.match(
      /(?:full\s*form|fully\s*form|meaning)\s+(?:of\s+)?([a-zA-Z]{2,8})\b/i
    );

  const acronym = acronymMatch ? acronymMatch[1].toUpperCase() : '';
  if (!isFullFormOrMeaningQuery || !acronym) return null;

  const curatedEntries = ACRONYM_KNOWLEDGE_BASE[acronym];
  if (!curatedEntries || curatedEntries.length === 0) return null;

  const filterWords = fullLower
    .replace(
      /\b(?:what|is|the|give|me|all|possible|full|fully|forms?|of|stand|for|i|mean|means|about|regarding|in|on|only|say|just|one|single|more|answers?|other|remaining|rest|tell|show)\b/g,
      ' '
    )
    .replace(new RegExp(`\\b${acronym.toLowerCase()}\\b`, 'g'), ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  let candidateEntries = curatedEntries;
  if (filterWords.length > 0) {
    const matched = curatedEntries.filter((entry) =>
      filterWords.some(
        (fw) =>
          entry.domain.toLowerCase().includes(fw) ||
          entry.expansion.toLowerCase().includes(fw) ||
          entry.details.toLowerCase().includes(fw)
      )
    );
    if (matched.length > 0) {
      candidateEntries = matched;
    }
  }

  if (qtyPref.wantsOnlyOne) {
    const chosen = candidateEntries[0];
    return `${acronym} stands for ${chosen.expansion} — ${chosen.details}`;
  }

  if (ctx.isFollowUp && qtyPref.wantsMoreOrAll) {
    const prevAssistantText = (
      ctx.previousAssistantMessages[ctx.previousAssistantMessages.length - 1] || ''
    ).toLowerCase();

    if (qtyPref.wantsOnlyRemaining && prevAssistantText) {
      const remaining = candidateEntries.filter(
        (entry) => !prevAssistantText.includes(entry.expansion.toLowerCase())
      );
      if (remaining.length > 0 && remaining.length < candidateEntries.length) {
        const listText = remaining
          .map(
            (entry, idx) =>
              `${idx + 1}. ${entry.expansion} — ${entry.details}`
          )
          .join('\n');
        return `Here are the other full forms of ${acronym}:\n\n${listText}`;
      }
    }
  }

  if (candidateEntries.length === 1) {
    const only = candidateEntries[0];
    return `${acronym} stands for ${only.expansion}.\n\n${only.details}`;
  }

  const listText = candidateEntries
    .map(
      (entry, idx) =>
        `${idx + 1}. ${entry.expansion} — ${entry.details}`
    )
    .join('\n');
  return `Here are all the major full forms of ${acronym}:\n\n${listText}`;
}

async function fetchContextAwareKnowledgeFallback(
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string | null> {
  const ctx = analyzeConversationContext(conversationHistory);

  if (isLikelyMathExpression(ctx.latestMessage)) {
    return solveMathOrEquation(ctx.latestMessage);
  }

  const curatedDirect = resolveCuratedMultiAnswerKnowledge(conversationHistory);
  if (curatedDirect) return curatedDirect;

  const fullContext = ctx.combinedTopicContext;
  const fullLower = fullContext.toLowerCase();
  const qtyPref = detectAnswerQuantityPreference(ctx.latestMessage);

  const isFullFormQuery =
    /\b(?:full\s*form|fully\s*form|stand\s*for|stands\s*for|acronym|abbreviation)\b/i.test(
      fullLower
    );

  const acronymMatch =
    ctx.lastMeaningfulUserQuestion.match(/\b([A-Z]{2,8})\b/) ||
    fullContext.match(/\b([A-Z]{2,8})\b/) ||
    fullContext.match(/(?:full\s*form|fully\s*form)\s+(?:of\s+)?([a-zA-Z]{2,8})\b/i);

  const acronym = acronymMatch ? acronymMatch[1].toUpperCase() : '';

  if (isFullFormQuery && acronym) {
    const filterWords = fullLower
      .replace(
        /\b(?:what|is|the|give|me|all|possible|full|fully|forms?|of|stand|for|i|mean|means|about|regarding|in|on|only|say|just|one|single|more|answers?|other|remaining|rest|tell|show)\b/g,
        ' '
      )
      .replace(new RegExp(`\\b${acronym.toLowerCase()}\\b`, 'g'), ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    try {
      const searchQuery =
        filterWords.length > 0
          ? `${acronym} ${filterWords.join(' ')}`
          : `${acronym} acronym`;
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        searchQuery
      )}&srlimit=6&format=json&origin=*`;
      const searchRes = await fetchWithTimeout(searchUrl, {}, 3000);
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          query?: { search?: Array<{ title?: string; snippet?: string }> };
        };
        const hits = (searchData.query?.search || []).filter((h) => Boolean(h.title));
        if (hits.length > 0) {
          if (qtyPref.wantsOnlyOne) {
            const topTitle = hits[0].title!;
            const summaryRes = await fetchWithTimeout(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`,
              {},
              3000
            );
            if (summaryRes.ok) {
              const summary = (await summaryRes.json()) as {
                title?: string;
                extract?: string;
              };
              if (summary.extract) {
                return `${acronym} stands for ${summary.title || topTitle} — ${summary.extract}`;
              }
            }
          }

          const formattedHits = hits
            .slice(0, 6)
            .map((h, idx) => {
              const cleanSnippet = (h.snippet || '')
                .replace(/<[^>]+>/g, '')
                .replace(/"/g, '"')
                .replace(/&/g, '&')
                .trim();
              return `${idx + 1}. ${h.title}${cleanSnippet ? ` — ${cleanSnippet}` : ''}`;
            })
            .join('\n');

          return `Here are the possible meanings and expansions for ${acronym}:\n\n${formattedHits}`;
        }
      }
    } catch {
      // Fall through
    }
  }

  const cleanedTopic = ctx.lastMeaningfulUserQuestion
    .replace(
      /\b(?:what\s+is|who\s+is|define|explain|tell\s+me\s+about|give\s+me|all\s+possible|answers?|more|only\s+say\s+one\s+answer|just\s+one|i\s+mean|i\s+means)\b/gi,
      ' '
    )
    .replace(/[?!.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !cleanedTopic ||
    cleanedTopic.length > 90 ||
    isLikelyMathExpression(cleanedTopic) ||
    /^(?:answer|answers|more|possible|all|one)$/i.test(cleanedTopic)
  ) {
    return null;
  }

  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      cleanedTopic
    )}&srlimit=4&format=json&origin=*`;
    const searchRes = await fetchWithTimeout(searchUrl, {}, 3000);
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as {
        query?: { search?: Array<{ title?: string; snippet?: string }> };
      };
      const hits = (searchData.query?.search || []).filter((h) => Boolean(h.title));
      if (hits.length > 0) {
        const topTitle = hits[0].title!;
        const summaryRes = await fetchWithTimeout(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`,
          {},
          3000
        );
        if (summaryRes.ok) {
          const summaryData = (await summaryRes.json()) as {
            title?: string;
            extract?: string;
          };
          if (summaryData.extract) {
            return `${summaryData.title || topTitle}: ${summaryData.extract}`;
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

async function fetchFreeLiveGoogleGrounding(
  userQuery: string
): Promise<{ contextText: string; sources: Array<{ uri: string; title: string }> }> {
  const sources: Array<{ uri: string; title: string }> = [];
  const snippets: string[] = [];
  const seenUrls = new Set<string>();

  const addSource = (uri: string, title: string, snippetLine: string) => {
    if (!uri || seenUrls.has(uri) || sources.length >= 6) return;
    seenUrls.add(uri);
    sources.push({ uri, title });
    snippets.push(snippetLine);
  };

  const isTopHeadlines =
    /breaking world news|top world|major headlines/i.test(userQuery);

  const cleanTopic = userQuery
    .replace(
      /give me (?:a briefing from google grounding of|results? from google grounding (?:about|on|for)|today['’]s|the)|search (?:google|the web|online) (?:for|about)?|from google grounding/gi,
      ''
    )
    .trim()
    .slice(0, 90);

  const googleNewsRssUrl =
    isTopHeadlines || !cleanTopic
      ? 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'
      : `https://news.google.com/rss/search?q=${encodeURIComponent(cleanTopic)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetchWithTimeout(
      `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(googleNewsRssUrl)}`,
      {},
      3500
    );
    if (res.ok) {
      const data = (await res.json()) as {
        items?: Array<{ title?: string; pubDate?: string; link?: string }>;
      };
      if (Array.isArray(data.items)) {
        for (const item of data.items.slice(0, 6)) {
          if (item.title && item.link) {
            addSource(
              item.link,
              item.title,
              `- [${item.pubDate || 'Today'}] ${item.title}`
            );
          }
        }
      }
    }
  } catch {
    // Fast timeout
  }

  if (snippets.length === 0) {
    return { contextText: '', sources: [] };
  }

  return {
    contextText: `Latest News Headlines (${new Date().toLocaleDateString()}):\n${snippets.join(
      '\n'
    )}`,
    sources,
  };
}

function buildQuantityDirectiveForTurn(
  conversationHistory: Array<{ role: string; content: string }>
): string {
  const ctx = analyzeConversationContext(conversationHistory);
  const qtyPref = detectAnswerQuantityPreference(ctx.latestMessage);
  const styleChange = detectStyleChangeRequest(ctx.latestMessage);
  const isMultiCat = isMultiAnswerCategoryQuestion(ctx.latestMessage);

  const notebookStyleRule =
    'Write in clean notebook style just like a person writes by hand. Do NOT use $, $$, \\frac, **, *, #, ^, //, @, or backticks.';

  if (qtyPref.wantsOnlyOne) {
    return `${notebookStyleRule} The user explicitly requested ONLY ONE answer. Provide strictly ONE single clear, direct answer.`;
  }

  if (ctx.isFollowUp && qtyPref.wantsMoreOrAll) {
    return `${notebookStyleRule} The user is asking for MORE / ALL possible answers to their previous question ("${ctx.lastMeaningfulUserQuestion}"). List ALL remaining and possible answers or types clearly as a numbered list.`;
  }

  if (isMultiCat) {
    return `${notebookStyleRule} This question asks for full forms, meanings, or types/kinds. List ALL major full forms, meanings, or types clearly in a numbered list.`;
  }

  if (ctx.isFollowUp && styleChange) {
    return `${notebookStyleRule} Update your previous answer ("${ctx.lastMeaningfulUserQuestion}") according to the user's style request ("${styleChange}"). Provide ONLY ONE single updated version.`;
  }

  return `${notebookStyleRule} Provide ONLY ONE single, clean, direct answer in a standard, formal tone unless the user explicitly asks to change the style.`;
}

async function synthesizeWithFreeFallbackEngine(
  conversationHistory: Array<{ role: string; content: string }>,
  systemInstructions: string,
  liveGroundingContext: string,
  liveSources: Array<{ uri: string; title: string }>
): Promise<string> {
  const ctx = analyzeConversationContext(conversationHistory);

  if (!liveGroundingContext) {
    const mathSolution = solveMathOrEquation(ctx.latestMessage);
    if (mathSolution) return formatAsCleanNotebookText(mathSolution);
  }

  const curatedMatch = resolveCuratedMultiAnswerKnowledge(conversationHistory);
  if (curatedMatch && !liveGroundingContext) {
    return formatAsCleanNotebookText(curatedMatch);
  }

  const quantityDirective = buildQuantityDirectiveForTurn(conversationHistory);

  const recentTurns = conversationHistory.slice(-10).map((msg, idx, arr) => {
    const isLast = idx === arr.length - 1 && msg.role === 'user';
    if (isLast && liveGroundingContext) {
      return {
        role: 'user',
        content: `${liveGroundingContext}\n\nSummarize these news headlines clearly: ${msg.content}`,
      };
    }
    if (isLast && ctx.isFollowUp) {
      return {
        role: 'user',
        content: `Follow-up to "${ctx.lastMeaningfulUserQuestion}": ${msg.content}\n(${quantityDirective})`,
      };
    }
    return {
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    };
  });

  const messagesPayload: Array<{ role: string; content: string }> = [
    {
      role: 'system',
      content: `${systemInstructions}\n\n${quantityDirective}`.slice(0, 1900),
    },
    ...recentTurns,
  ];

  const queryOpenAiEndpoint = async (modelName: string): Promise<string> => {
    const res = await fetchWithTimeout(
      'https://text.pollinations.ai/openai',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: messagesPayload,
          private: true,
        }),
      },
      10000
    );
    if (!res.ok) throw new Error(`${modelName} failed`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    if (
      !content ||
      content.startsWith('<html') ||
      content.startsWith('<!DOCTYPE') ||
      /answer commonly refers to a response/i.test(content)
    ) {
      throw new Error(`Invalid ${modelName} response`);
    }
    return formatAsCleanNotebookText(content);
  };

  const queryDirectGetWithContext = async (): Promise<string> => {
    const contextAwarePrompt = liveGroundingContext
      ? `${liveGroundingContext}\n\nSummarize clearly: ${ctx.latestMessage}`
      : ctx.isFollowUp
        ? `Original request: "${ctx.lastMeaningfulUserQuestion}"\nPrevious answer given: "${
            ctx.previousAssistantMessages[ctx.previousAssistantMessages.length - 1] || 'None'
          }"\nUser follow-up: "${ctx.latestMessage}"\n${quantityDirective}`
        : `Request: "${ctx.latestMessage}"\n${quantityDirective}`;

    const res = await fetchWithTimeout(
      `https://text.pollinations.ai/${encodeURIComponent(contextAwarePrompt.slice(0, 750))}?model=openai`,
      {},
      10000
    );
    if (!res.ok) throw new Error('GET endpoint failed');
    const text = (await res.text()).trim();
    if (
      !text ||
      text.startsWith('<html') ||
      text.startsWith('<!DOCTYPE') ||
      /answer commonly refers to a response/i.test(text)
    ) {
      throw new Error('Invalid GET response');
    }
    return formatAsCleanNotebookText(text);
  };

  try {
    return await raceToFirstSuccess([
      queryOpenAiEndpoint('openai'),
      queryOpenAiEndpoint('mistral'),
      queryOpenAiEndpoint('llama'),
      queryDirectGetWithContext(),
    ]);
  } catch {
    const composedLetter = generateContextAwareLetterOrApplication(conversationHistory);
    if (composedLetter) {
      return formatAsCleanNotebookText(composedLetter);
    }

    const smartKnowledge = await fetchContextAwareKnowledgeFallback(conversationHistory);
    if (smartKnowledge) {
      return formatAsCleanNotebookText(smartKnowledge);
    }

    if (liveSources.length > 0) {
      return liveSources
        .map((src, index) => `${index + 1}. ${src.title} (${src.uri})`)
        .join('\n');
    }

    return "I'm ready to help! Could you please share a few more details about what you'd like to know?";
  }
}

async function generateFreePollinationsImage(
  prompt: string,
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' = '1:1'
): Promise<string> {
  const dimensions: Record<'1:1' | '16:9' | '9:16' | '4:3', { w: number; h: number }> = {
    '1:1': { w: 768, h: 768 },
    '16:9': { w: 1024, h: 576 },
    '9:16': { w: 576, h: 1024 },
    '4:3': { w: 896, h: 672 },
  };
  const { w, h } = dimensions[aspectRatio];
  const seed = Math.floor(Math.random() * 999999);
  const encoded = encodeURIComponent(prompt.slice(0, 450));
  const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${w}&height=${h}&nologo=true&seed=${seed}`;

  return await new Promise<string>((resolve) => {
    const img = new window.Image();
    const timeout = window.setTimeout(() => {
      resolve(imageUrl);
    }, 12000);
    img.onload = () => {
      window.clearTimeout(timeout);
      resolve(imageUrl);
    };
    img.onerror = () => {
      window.clearTimeout(timeout);
      resolve(imageUrl);
    };
    img.src = imageUrl;
  });
}

function buildSystemInstructions(
  profession: ProfessionProfile,
  memories: MemoryEntry[]
): string {
  const parts: string[] = [NATURAL_CHAT_SYSTEM_PROMPT];

  if (profession.id !== 'general') {
    parts.push(`Active Specialist Mode (${profession.name}): ${profession.systemDirective}`);
  }

  if (memories.length > 0) {
    const memorySummary = memories
      .slice(0, 6)
      .map((m) => `- (${m.category}) ${m.content}`)
      .join('\n');
    parts.push(`User Memory:\n${memorySummary}`);
  }

  return parts.join('\n\n');
}

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
    if (response.status === 405 || trimmed.includes('405 Not Allowed')) {
      throw new Error('BACKEND_UNAVAILABLE_405');
    }

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
    throw new Error('BACKEND_UNAVAILABLE_405');
  }

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error('BACKEND_UNAVAILABLE_405');
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

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const checkViewport = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
    };
  }, []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...loadSettings(),
    webSearchEnabled: false,
  }));
  const [directSignInUrl, setDirectSignInUrl] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState('');

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

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(() => earlyDeferredInstallPrompt);

  const [mobileInput, setMobileInput] = useState('');
  const [mobileAttachments, setMobileAttachments] = useState<Attachment[]>([]);
  const [mobileDictating, setMobileDictating] = useState(false);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);

  const [activeProfessionId, setActiveProfessionId] = useState<ProfessionId>(() => {
    try {
      const saved = localStorage.getItem(JARVIS_PROFESSION_STORAGE_KEY) as ProfessionId | null;
      if (saved && PROFESSION_PROFILES.some((p) => p.id === saved)) return saved;
    } catch {
      // Ignore
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

  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [professionsModalOpen, setProfessionsModalOpen] = useState(false);
  const [imageStudioOpen, setImageStudioOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  const [liveClock, setLiveClock] = useState(() => new Date());

  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceThinking, setVoiceThinking] = useState(false);
  const [voiceInterimTranscript, setVoiceInterimTranscript] = useState('');
  const [voiceTypedInput, setVoiceTypedInput] = useState('');
  const [voiceTurns, setVoiceTurns] = useState<VoiceTurn[]>([]);
  const [voiceError, setVoiceError] = useState('');
  const [voiceAutoLoop, setVoiceAutoLoop] = useState(true);
  const [voiceRate, setVoiceRate] = useState(1.05);
  const [voiceLang, setVoiceLang] = useState('en-US');

  const [studioPrompt, setStudioPrompt] = useState('');
  const [studioStyle, setStudioStyle] = useState(IMAGE_STYLE_PRESETS[0].id);
  const [studioAspectRatio, setStudioAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [studioError, setStudioError] = useState('');

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

  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryEntry['category']>('Profession');
  const [newMemoryText, setNewMemoryText] = useState('');
  const [professionSearch, setProfessionSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const accountSaveQueue = useRef(Promise.resolve());
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const liveVoiceOpenRef = useRef(false);
  const voiceAutoLoopRef = useRef(true);

  useEffect(() => {
    if (earlyDeferredInstallPrompt && !deferredInstallPrompt) {
      setDeferredInstallPrompt(earlyDeferredInstallPrompt);
    }
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      earlyDeferredInstallPrompt = promptEvent;
      setDeferredInstallPrompt(promptEvent);
    };
    const handleAppInstalled = () => {
      earlyDeferredInstallPrompt = null;
      setDeferredInstallPrompt(null);
      setAccountNotice('JARVIS AI has been installed on your device!');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredInstallPrompt]);

  useEffect(() => {
    liveVoiceOpenRef.current = liveVoiceOpen;
  }, [liveVoiceOpen]);

  useEffect(() => {
    voiceAutoLoopRef.current = voiceAutoLoop;
  }, [voiceAutoLoop]);

  useEffect(() => {
    try {
      localStorage.setItem(JARVIS_PROFESSION_STORAGE_KEY, activeProfessionId);
    } catch {
      // Ignore
    }
  }, [activeProfessionId]);

  useEffect(() => {
    try {
      localStorage.setItem(JARVIS_MEMORY_STORAGE_KEY, JSON.stringify(memories));
    } catch {
      // Ignore
    }
  }, [memories]);

  useEffect(() => {
    try {
      localStorage.setItem(JARVIS_GALLERY_STORAGE_KEY, JSON.stringify(artGallery.slice(0, 24)));
    } catch {
      // Ignore
    }
  }, [artGallery]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveClock(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeConversation =
    conversations.find((c) => c.id === activeChatId) || null;
  const isWelcomeScreen = !activeConversation || activeConversation.messages.length === 0;

  const activeProfession = useMemo(
    () =>
      PROFESSION_PROFILES.find((p) => p.id === activeProfessionId) ||
      PROFESSION_PROFILES[0],
    [activeProfessionId]
  );

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
    fetchWithTimeout('/api/health', {}, 2500)
      .then((response) =>
        readJsonResponse<{ aiConfigured?: boolean }>(response, 'The health check response was invalid.')
      )
      .then((health) => {
        if (active) {
          const configured = Boolean(health.aiConfigured);
          setAiConfigured(configured);
          cachedBackendAvailable = configured;
        }
      })
      .catch(() => {
        if (active) {
          setAiConfigured(false);
          cachedBackendAvailable = false;
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
      setAccountNotice('Reusable account link copied.');
    } catch {
      setAccountNotice('Could not copy the sign-in link.');
    }
  };

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages]);

  const handleScroll = () => {
    if (!chatScrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      chatScrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 160;
    setShowScrollBottom(isUp);
  };

  const handleNewChat = () => {
    stopSpeaking();
    setActiveChatId(null);
    if (isMobileView) {
      setSidebarOpen(false);
    }
  };

  const handleSelectChat = (id: string) => {
    stopSpeaking();
    setActiveChatId(id);
    if (isMobileView) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) {
      setActiveChatId(null);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all conversation history?')) {
      stopSpeaking();
      setConversations([]);
      setActiveChatId(null);
    }
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c))
    );
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      setVoiceSpeaking(false);
    }
  };

  const pickPreferredJarvisVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find(
        (v) =>
          v.lang.startsWith('en') &&
          (v.name.includes('Natural') ||
            v.name.includes('Google') ||
            v.name.includes('Daniel') ||
            v.name.includes('Male'))
      ) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      null
    );
  };

  const handleToggleSpeakMessage = (messageId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    const cleanText = formatAsCleanNotebookText(text)
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = voiceRate;
    utterance.pitch = 0.95;

    const jarvisVoice = pickPreferredJarvisVoice();
    if (jarvisVoice) {
      utterance.voice = jarvisVoice;
    }

    utterance.onstart = () => setSpeakingMessageId(messageId);
    utterance.onend = () => setSpeakingMessageId(null);
    utterance.onerror = () => setSpeakingMessageId(null);

    activeUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // ==========================================================================
  // CORE SEND MESSAGE ENGINE
  // ==========================================================================

  const handleSendMessage = async (
    text: string,
    attachments: Attachment[] = [],
    options?: { forceGoogleGrounding?: boolean }
  ) => {
    if (!text.trim() && attachments.length === 0) return;

    if (isMobileView && sidebarOpen) {
      setSidebarOpen(false);
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

    if (attachments.length === 0) {
      // 1. Instant Greeting Reply
      const instantGreeting = getInstantGreetingReply(text);
      if (instantGreeting) {
        const instantMessage: Message = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: instantGreeting,
          sources: [],
          timestamp: Date.now(),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? { ...c, updatedAt: Date.now(), messages: [...c.messages, instantMessage] }
              : c
          )
        );
        if (settings.voiceEnabled) {
          handleToggleSpeakMessage(instantMessage.id, instantMessage.content);
        }
        return;
      }

      // 2. Instant Deterministic Notebook Math & Equation Solver
      const instantMath = solveMathOrEquation(text);
      if (instantMath) {
        const mathMessage: Message = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: formatAsCleanNotebookText(instantMath),
          sources: [],
          timestamp: Date.now(),
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConvId
              ? { ...c, updatedAt: Date.now(), messages: [...c.messages, mathMessage] }
              : c
          )
        );
        if (settings.voiceEnabled) {
          handleToggleSpeakMessage(mathMessage.id, mathMessage.content);
        }
        return;
      }
    }

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

    const shouldUseGoogleGrounding =
      Boolean(options?.forceGoogleGrounding) ||
      Boolean(settings.webSearchEnabled) ||
      explicitGoogleGroundingRequested(text);

    setIsLoading(true);

    try {
      const activeMessages =
        updatedConversations.find((c) => c.id === currentConvId)?.messages || [
          userMessage,
        ];

      let assistantMessage: Message;

      if (weatherRequest) {
        const parameters = new URLSearchParams({
          location: weatherRequest.location,
          temperatureUnit: weatherRequest.temperatureUnit,
        });
        const res = await fetchWithTimeout(`/api/weather?${parameters.toString()}`, {}, 4500);
        const data = await readJsonResponse<{
          location?: string;
          temperature?: number;
          temperatureUnit?: string;
          feelsLike?: number;
          humidity?: number;
          windSpeed?: number;
          windSpeedUnit?: string;
          conditions?: string;
        }>(res, 'Weather lookup failed.');

        if (typeof data.temperature !== 'number' || !data.location) {
          throw new Error('The weather service returned an incomplete response.');
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
        assistantMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `Current weather in ${data.location}: ${data.temperature}${unit}, ${data.conditions || 'conditions unavailable'}.${feelsLike}${humidity}${wind}`,
          sources: [],
          timestamp: Date.now(),
        };
      } else if (isImageReq) {
        const cleanArtPrompt =
          text.trim() || 'Futuristic arc reactor core glowing in dark laboratory, 8k';
        const imageUrl = await generateFreePollinationsImage(cleanArtPrompt, '1:1');

        setArtGallery((prev) => [
          {
            id: Math.random().toString(36).substring(2, 9),
            prompt: cleanArtPrompt,
            style: 'Free Neural Studio',
            aspectRatio: '1:1',
            imageUrl,
            createdAt: Date.now(),
          },
          ...prev,
        ]);

        assistantMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: `Here is the image generated for "${cleanArtPrompt}":`,
          imageUrl,
          sources: [],
          timestamp: Date.now(),
        };
      } else {
        const liveWeb = shouldUseGoogleGrounding
          ? await fetchFreeLiveGoogleGrounding(text)
          : { contextText: '', sources: [] };

        const systemInstructions = buildSystemInstructions(activeProfession, memories);

        const cleanHistory = activeMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const quantityDirective = buildQuantityDirectiveForTurn(cleanHistory);
        const fullSystemInstructions = `${systemInstructions}\n\n${quantityDirective}`;

        const curatedDirect =
          attachments.length === 0 && !liveWeb.contextText
            ? resolveCuratedMultiAnswerKnowledge(cleanHistory)
            : null;

        let replyText = '';
        let replyImageUrl: string | undefined;

        if (curatedDirect) {
          replyText = formatAsCleanNotebookText(curatedDirect);
        } else if (cachedBackendAvailable !== false) {
          try {
            const backendMessages = cleanHistory.map((m, index) => {
              const isLastUserTurn = index === cleanHistory.length - 1 && m.role === 'user';
              if (!isLastUserTurn) return m;
              if (liveWeb.contextText) {
                return {
                  role: 'user',
                  content: `${liveWeb.contextText}\n\nUser Question: ${m.content}`,
                };
              }
              return m;
            });

            const res = await fetchWithTimeout(
              '/api/chat',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messages: backendMessages,
                  systemInstruction: fullSystemInstructions,
                  webSearch: Boolean(settings.webSearchEnabled),
                  model: settings.dualEngineEnabled ? 'jarvis-deep' : settings.selectedModel,
                  attachments: attachments.map((a) => ({
                    name: a.name,
                    type: a.type,
                    data: a.data,
                  })),
                }),
              },
              8000
            );

            const data = await readJsonResponse<{
              content?: string;
              imageUrl?: string;
            }>(res, 'BACKEND_UNAVAILABLE_405');

            cachedBackendAvailable = true;
            replyText = formatAsCleanNotebookText(data.content || 'How can I help you?');
            replyImageUrl = data.imageUrl;
          } catch {
            cachedBackendAvailable = false;
            replyText = await synthesizeWithFreeFallbackEngine(
              cleanHistory,
              systemInstructions,
              liveWeb.contextText,
              liveWeb.sources
            );
          }
        } else {
          replyText = await synthesizeWithFreeFallbackEngine(
            cleanHistory,
            systemInstructions,
            liveWeb.contextText,
            liveWeb.sources
          );
        }

        assistantMessage = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          content: formatAsCleanNotebookText(replyText),
          sources: shouldUseGoogleGrounding ? liveWeb.sources : [],
          imageUrl: replyImageUrl,
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
      console.error('Error contacting JARVIS:', err);
      const errorText = err instanceof Error ? err.message : 'The request failed.';
      const errorMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'assistant',
        content: `JARVIS notice: ${errorText}`,
        sources: [],
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

  const handleSelectPrompt = (prompt: string) => {
    handleSendMessage(prompt, []);
  };

  // ==========================================================================
  // MOBILE PROMPT & PWA INSTALL HANDLERS
  // ==========================================================================

  const handleMobileFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10 - mobileAttachments.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setMobileAttachments((prev) =>
            prev.length >= 10
              ? prev
              : [
                  ...prev,
                  {
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    data: reader.result as string,
                  },
                ]
          );
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleMobileMicDictate = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      openLiveVoiceSession();
      return;
    }

    if (mobileDictating) {
      stopVoiceRecognition();
      setMobileDictating(false);
      return;
    }

    const rec = new SpeechRecCtor();
    rec.lang = voiceLang;
    rec.interimResults = false;
    rec.onstart = () => setMobileDictating(true);
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || '';
      if (transcript) {
        setMobileInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };
    rec.onerror = () => setMobileDictating(false);
    rec.onend = () => setMobileDictating(false);
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setMobileDictating(false);
    }
  };

  const handleMobileSubmit = () => {
    if ((!mobileInput.trim() && mobileAttachments.length === 0) || isLoading) return;
    const textToSend = mobileInput;
    const filesToSend = [...mobileAttachments];
    setMobileInput('');
    setMobileAttachments([]);
    void handleSendMessage(textToSend, filesToSend);
  };

  const handleInstallApp = async () => {
    setSidebarOpen(false);
    const promptToUse = deferredInstallPrompt || earlyDeferredInstallPrompt;
    if (promptToUse) {
      await promptToUse.prompt();
      await promptToUse.userChoice;
      earlyDeferredInstallPrompt = null;
      setDeferredInstallPrompt(null);
      return;
    }
    setAccountNotice(
      'To install JARVIS AI on your phone: tap your browser menu (⋮ or Share) and select "Install app" or "Add to Home Screen".'
    );
  };

  // ==========================================================================
  // LIVE TWO-WAY VOICE CONVERSATION ENGINE
  // ==========================================================================

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

  const speakVoiceTurnReply = useCallback(
    (replyText: string, onFinished?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onFinished?.();
        return;
      }
      window.speechSynthesis.cancel();

      const cleanText = formatAsCleanNotebookText(replyText)
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        onFinished?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = voiceRate;
      utterance.pitch = 0.96;
      utterance.lang = voiceLang;

      const jarvisVoice = pickPreferredJarvisVoice();
      if (jarvisVoice) utterance.voice = jarvisVoice;

      utterance.onstart = () => setVoiceSpeaking(true);
      utterance.onend = () => {
        setVoiceSpeaking(false);
        onFinished?.();
      };
      utterance.onerror = () => {
        setVoiceSpeaking(false);
        onFinished?.();
      };

      activeUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [voiceRate, voiceLang]
  );

  const processLiveVoiceTurn = useCallback(
    async (spokenText: string) => {
      const trimmed = spokenText.trim();
      if (!trimmed) return;

      setVoiceThinking(true);
      setVoiceError('');
      const userTurn: VoiceTurn = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'user',
        text: trimmed,
        timestamp: Date.now(),
      };
      setVoiceTurns((prev) => [...prev.slice(-14), userTurn]);

      try {
        const instantGreeting = getInstantGreetingReply(trimmed);
        const instantMath = instantGreeting ? null : solveMathOrEquation(trimmed);
        let reply = instantGreeting || instantMath || '';

        if (!reply) {
          const shouldSearch = explicitGoogleGroundingRequested(trimmed);
          const liveWeb = shouldSearch
            ? await fetchFreeLiveGoogleGrounding(trimmed)
            : { contextText: '', sources: [] };

          const historyPayload = voiceTurns.slice(-8).map((t) => ({
            role: t.role,
            content: t.text,
          }));
          historyPayload.push({
            role: 'user',
            content: trimmed,
          });

          const quantityDirective = buildQuantityDirectiveForTurn(historyPayload);
          const systemInstructions = `${buildSystemInstructions(
            activeProfession,
            memories
          )}\n${quantityDirective}\nRespond clearly as if speaking out loud.`;

          const curatedDirect = !liveWeb.contextText
            ? resolveCuratedMultiAnswerKnowledge(historyPayload)
            : null;

          if (curatedDirect) {
            reply = formatAsCleanNotebookText(curatedDirect);
          } else if (cachedBackendAvailable !== false) {
            try {
              const backendPayload = historyPayload.map((m, idx) =>
                idx === historyPayload.length - 1 && liveWeb.contextText
                  ? { role: 'user', content: `${liveWeb.contextText}\n\nUser Question: ${m.content}` }
                  : m
              );
              const res = await fetchWithTimeout(
                '/api/chat',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    messages: backendPayload,
                    systemInstruction: systemInstructions,
                    webSearch: false,
                    model: 'jarvis-turbo',
                    attachments: [],
                  }),
                },
                8000
              );

              const data = await readJsonResponse<{ content?: string }>(
                res,
                'BACKEND_UNAVAILABLE_405'
              );
              cachedBackendAvailable = true;
              reply = formatAsCleanNotebookText(data.content || 'Processed.');
            } catch {
              cachedBackendAvailable = false;
              reply = await synthesizeWithFreeFallbackEngine(
                historyPayload,
                systemInstructions,
                liveWeb.contextText,
                liveWeb.sources
              );
            }
          } else {
            reply = await synthesizeWithFreeFallbackEngine(
              historyPayload,
              systemInstructions,
              liveWeb.contextText,
              liveWeb.sources
            );
          }
        }

        const cleanReply = formatAsCleanNotebookText(reply);
        const assistantTurn: VoiceTurn = {
          id: Math.random().toString(36).substring(2, 9),
          role: 'assistant',
          text: cleanReply,
          timestamp: Date.now(),
        };
        setVoiceTurns((prev) => [...prev.slice(-14), assistantTurn]);
        setVoiceThinking(false);

        speakVoiceTurnReply(cleanReply, () => {
          if (liveVoiceOpenRef.current && voiceAutoLoopRef.current) {
            startVoiceRecognition();
          }
        });
      } catch (err) {
        setVoiceThinking(false);
        setVoiceError(
          err instanceof Error ? err.message : 'Live voice processing failed.'
        );
      }
    },
    [activeProfession, memories, voiceTurns, speakVoiceTurnReply]
  );

  const startVoiceRecognition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      setVoiceError(
        'Speech Recognition is not supported in this browser. Type below to talk with JARVIS aloud.'
      );
      return;
    }

    stopVoiceRecognition();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setVoiceSpeaking(false);
    }

    const recognition = new SpeechRecCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = voiceLang;

    let finalTranscriptBuffer = '';

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
          finalTranscriptBuffer += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      setVoiceInterimTranscript((finalTranscriptBuffer + interim).trim());
    };

    recognition.onerror = (event: { error?: string }) => {
      setVoiceListening(false);
      if (event.error && event.error !== 'aborted' && event.error !== 'no-speech') {
        setVoiceError(`Microphone notice: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
      const captured = finalTranscriptBuffer.trim();
      setVoiceInterimTranscript('');
      if (captured) {
        void processLiveVoiceTurn(captured);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setVoiceError('Unable to access microphone. Check browser mic permissions.');
    }
  }, [voiceLang, stopVoiceRecognition, processLiveVoiceTurn]);

  const openLiveVoiceSession = () => {
    stopSpeaking();
    setLiveVoiceOpen(true);
    setVoiceError('');
    window.setTimeout(() => {
      startVoiceRecognition();
    }, 250);
  };

  const closeLiveVoiceSession = () => {
    setLiveVoiceOpen(false);
    stopVoiceRecognition();
    stopSpeaking();
    setVoiceThinking(false);
    setVoiceInterimTranscript('');
  };

  const handleSaveVoiceTranscriptToChat = () => {
    if (voiceTurns.length === 0) return;
    const importedMessages: Message[] = voiceTurns.map((turn) => ({
      id: turn.id,
      role: turn.role,
      content: turn.text,
      timestamp: turn.timestamp,
      sources: [],
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
      const firstUser = voiceTurns.find((t) => t.role === 'user');
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
    closeLiveVoiceSession();
  };

  // ==========================================================================
  // IMAGE STUDIO & SCREEN VISION HANDLERS
  // ==========================================================================

  const handleGenerateStudioImage = async () => {
    const cleanPrompt = studioPrompt.trim();
    if (!cleanPrompt || studioGenerating) return;

    const preset =
      IMAGE_STYLE_PRESETS.find((p) => p.id === studioStyle) || IMAGE_STYLE_PRESETS[0];
    const fullPrompt = `${cleanPrompt}, ${preset.suffix}`;

    setStudioGenerating(true);
    setStudioError('');

    try {
      const imageUrl = await generateFreePollinationsImage(fullPrompt, studioAspectRatio);

      const newArt: GeneratedArtItem = {
        id: Math.random().toString(36).substring(2, 9),
        prompt: cleanPrompt,
        style: preset.label,
        aspectRatio: studioAspectRatio,
        imageUrl,
        createdAt: Date.now(),
      };

      setArtGallery((prev) => [newArt, ...prev]);
    } catch (err) {
      setStudioError(err instanceof Error ? err.message : 'Could not synthesize image.');
    } finally {
      setStudioGenerating(false);
    }
  };

  const handleCaptureScreenVision = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        setAccountNotice(
          'Screen sharing is unavailable in this mobile browser. Tap the paperclip icon to upload a screenshot for JARVIS Vision.'
        );
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

  const handleRunScientificCalc = () => {
    try {
      const value = evaluateSafeMathExpression(calcInput);
      setCalcResult(formatCleanNumber(value));
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
        label: 'Start Live Two-Way Voice Conversation',
        shortcut: 'VOICE',
        action: () => openLiveVoiceSession(),
      },
      {
        id: 'news',
        label: 'Open Live World News & Real-Time Briefing Hub',
        shortcut: 'NEWS',
        action: () => setNewsModalOpen(true),
      },
      {
        id: 'professions',
        label: 'Switch Specialist Profession (16 Domains)',
        shortcut: 'PRO',
        action: () => setProfessionsModalOpen(true),
      },
      {
        id: 'image-studio',
        label: 'Open JARVIS Free Neural Image Studio',
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
        label: 'Manage JARVIS Persistent Neural Memory',
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

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="flex h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-[#060b13] text-slate-100 antialiased font-sans">
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

      {/* MOBILE SIDE DRAWER: ONLY INSTALL BUTTON MOVED HERE */}
      {isMobileView && sidebarOpen && (
        <div className="fixed left-3 bottom-[118px] w-[256px] z-[60] pointer-events-auto">
          <button
            type="button"
            onClick={() => void handleInstallApp()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-500/25 to-blue-600/25 hover:from-cyan-500/35 hover:to-blue-600/35 border border-cyan-400/60 text-cyan-200 text-xs font-semibold shadow-[0_0_16px_rgba(34,211,238,0.25)] active:scale-95 transition"
          >
            <Download className="w-4 h-4 text-cyan-300 shrink-0" />
            <span>Install JARVIS App</span>
          </button>
        </div>
      )}

      {isMobileView ? (
        /* ====================================================================
           CLEAN MOBILE BROWSER VIEW
           ==================================================================== */
        <div className="flex-1 flex flex-col h-[100dvh] w-full max-w-full overflow-hidden relative bg-[#060b13]">
          <header className="px-3.5 py-2.5 bg-[#08101d]/95 border-b border-cyan-500/25 flex items-center justify-between gap-2 shrink-0 z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open side drawer"
                className="w-9 h-9 rounded-xl bg-slate-900 border border-cyan-500/40 flex items-center justify-center text-cyan-300 active:scale-95 transition shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>

              <ArcReactorLogo glow={true} size="sm" />

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-extrabold tracking-wide text-white truncate">
                    JARVIS AI
                  </span>
                  <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider rounded border border-cyan-400/50 bg-cyan-500/15 text-cyan-300">
                    PRO
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5 truncate">
                  AI workspace
                </p>
              </div>
            </div>
          </header>

          {!isOnline && (
            <div className="bg-amber-500/20 border-b border-amber-500/30 px-3.5 py-1.5 text-[11px] text-amber-200 flex items-center gap-1.5 shrink-0">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span>Offline: AI replies require an internet connection.</span>
            </div>
          )}

          {accountNotice && (
            <div className="bg-slate-900 border-b border-cyan-500/35 px-3.5 py-2 text-xs text-cyan-100 flex items-center justify-between gap-2 shrink-0">
              <span className="leading-snug">{accountNotice}</span>
              <button
                type="button"
                onClick={() => setAccountNotice('')}
                className="text-cyan-400 font-semibold shrink-0"
              >
                OK
              </button>
            </div>
          )}

          <div
            ref={chatScrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col"
            style={
              isWelcomeScreen
                ? {
                    backgroundImage:
                      "linear-gradient(rgba(6, 11, 19, 0.38), rgba(6, 11, 19, 0.72)), url('./jarvis-welcome-bg.png')",
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
              <div className="flex-1 py-3 space-y-1 w-full max-w-full overflow-x-hidden">
                {activeConversation.messages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    onSpeak={handleToggleSpeakMessage}
                    isSpeaking={speakingMessageId === msg.id}
                  />
                ))}

                {isLoading && (
                  <div className="py-3 px-4 bg-slate-900/50 border-y border-cyan-500/20">
                    <div className="flex gap-3 items-center">
                      <ArcReactorLogo glow={true} size="sm" />
                      <div className="flex items-center gap-2 text-xs text-cyan-300">
                        <Sparkles className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                        <span className="font-mono">JARVIS is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-3" />
              </div>
            )}
          </div>

          <div className="px-3 py-2.5 bg-[#060b13] border-t border-slate-800/80 shrink-0 jarvis-mobile-safe-bottom">
            <div className="rounded-2xl bg-[#081326] border border-cyan-500/45 p-2.5 space-y-2">
              {mobileAttachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {mobileAttachments.map((att, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-[10px] text-cyan-200"
                    >
                      <span className="truncate max-w-[110px]">{att.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setMobileAttachments((prev) =>
                            prev.filter((_, idx) => idx !== i)
                          )
                        }
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={mobileInput}
                  onChange={(e) => setMobileInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleMobileSubmit();
                    }
                  }}
                  placeholder="Ask JARVIS anything..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none min-w-0"
                />

                <button
                  type="button"
                  onClick={handleMobileSubmit}
                  disabled={
                    isLoading ||
                    (!mobileInput.trim() && mobileAttachments.length === 0)
                  }
                  aria-label="Send message"
                  className="w-9 h-9 rounded-full bg-cyan-500 disabled:opacity-45 text-slate-950 flex items-center justify-center active:scale-95 transition shrink-0"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <input
                  ref={mobileFileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleMobileFileSelect}
                />
                <button
                  type="button"
                  onClick={() => mobileFileInputRef.current?.click()}
                  aria-label="Attach files"
                  className="p-1 rounded-lg text-slate-300 hover:text-cyan-300"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleMobileMicDictate}
                  aria-label="Voice dictation"
                  className={`p-1 rounded-lg ${
                    mobileDictating
                      ? 'text-rose-400 animate-pulse'
                      : 'text-slate-300 hover:text-cyan-300'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>

                <div className="h-3.5 w-px bg-slate-700" />

                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      webSearchEnabled: !prev.webSearchEnabled,
                    }))
                  }
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition ${
                    settings.webSearchEnabled
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
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
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition truncate ${
                    settings.dualEngineEnabled
                      ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                      : 'bg-slate-900 border-slate-700 text-slate-300'
                  }`}
                >
                  <Cpu className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="truncate">Dual Engine</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ====================================================================
           DESKTOP / LAPTOP WORKSPACE
           ==================================================================== */
        <div className="flex-1 flex flex-col h-[100dvh] min-w-0 max-w-full overflow-hidden relative bg-[#060b13]">
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

          <div className="flex bg-[#08101d]/95 border-b border-cyan-500/20 px-4 py-1.5 items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={openLiveVoiceSession}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-400/40 text-cyan-200 text-xs font-medium transition shadow-sm"
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>Live Voice</span>
              </button>

              <button
                type="button"
                onClick={() => setNewsModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              >
                <Newspaper className="w-3.5 h-3.5 text-amber-400" />
                <span>Today's News</span>
              </button>

              <button
                type="button"
                onClick={() => setProfessionsModalOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${activeProfession.badgeColor}`}
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
              >
                <ImageIcon className="w-3.5 h-3.5 text-fuchsia-400" />
                <span>Image Studio</span>
              </button>

              <button
                type="button"
                onClick={() => setWorkbenchOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                <span>Eng & Med Lab</span>
              </button>

              <button
                type="button"
                onClick={() => void handleCaptureScreenVision()}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              >
                <Monitor className="w-3.5 h-3.5 text-sky-400" />
                <span>Screen Vision</span>
              </button>

              <button
                type="button"
                onClick={() => setMemoryModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs transition"
              >
                <Brain className="w-3.5 h-3.5 text-violet-400" />
                <span>Memory ({memories.length})</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-slate-400">
              <span className="hidden xl:flex items-center gap-1 text-cyan-300/80">
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
              >
                <Command className="w-3 h-3 text-cyan-400" />
                <span>Ctrl+P</span>
              </button>
            </div>
          </div>

          {activeProfession.disclaimer && (
            <div className="bg-emerald-950/50 border-b border-emerald-500/25 px-4 py-1 flex items-center justify-between text-[11px] text-emerald-200/90 shrink-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{activeProfession.disclaimer}</span>
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

          {!isOnline && (
            <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300 shrink-0">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>Offline: AI replies require an internet connection.</span>
              </div>
            </div>
          )}

          {accountNotice && (
            <div
              role="status"
              className="bg-slate-900 border-b border-slate-700 px-4 py-2 flex items-center justify-between gap-3 text-xs text-slate-300 shrink-0"
            >
              <span>{accountNotice}</span>
              <button
                type="button"
                onClick={() => setAccountNotice('')}
                className="text-slate-400 hover:text-white shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {!user.isGuest && (
            <div className="bg-cyan-950/80 border-b border-cyan-500/30 px-4 py-1.5 flex items-center justify-between gap-2 text-xs text-cyan-300 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Link className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <p className="truncate">
                  Signed in: conversations are saved to your account.
                </p>
              </div>
            </div>
          )}

          <div
            ref={chatScrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col relative"
            style={
              isWelcomeScreen
                ? {
                    backgroundImage:
                      "linear-gradient(rgba(6, 11, 19, 0.28), rgba(6, 11, 19, 0.55)), url('./jarvis-welcome-bg.png')",
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
              <div className="flex-1 py-4 space-y-1 w-full max-w-full overflow-x-hidden">
                {activeConversation.messages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    onSpeak={handleToggleSpeakMessage}
                    isSpeaking={speakingMessageId === msg.id}
                  />
                ))}

                {isLoading && (
                  <div className="py-4 px-6 bg-slate-900/30 border-y border-slate-800/40">
                    <div className="max-w-4xl mx-auto flex gap-4 items-center">
                      <ArcReactorLogo glow={true} size="sm" />
                      <div className="flex items-center gap-2 text-sm text-cyan-300">
                        <Sparkles className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                        <span className="font-mono">JARVIS is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>

          <div className="shrink-0 w-full max-w-full bg-[#060b13]">
            <PromptBar
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              webSearchEnabled={Boolean(settings.webSearchEnabled)}
              onToggleWebSearch={() =>
                setSettings((prev) => ({
                  ...prev,
                  webSearchEnabled: !prev.webSearchEnabled,
                }))
              }
              dualEngineEnabled={Boolean(settings.dualEngineEnabled)}
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
        </div>
      )}

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

      {/* LIVE TWO-WAY VOICE CONVERSATION OVERLAY */}
      {liveVoiceOpen && (
        <div className="fixed inset-0 z-50 h-[100dvh] w-full bg-[#040811]/95 backdrop-blur-xl flex flex-col justify-between p-4 md:p-6 text-slate-100 jarvis-mobile-safe-bottom">
          <div className="flex flex-wrap items-center justify-between gap-2 max-w-4xl w-full mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-xs font-mono text-cyan-300">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              JARVIS LIVE VOICE • {activeProfession.shortName.toUpperCase()}
            </span>
            <div className="flex items-center gap-2">
              {voiceTurns.length > 0 && (
                <button
                  type="button"
                  onClick={handleSaveVoiceTranscriptToChat}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-medium"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              )}
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="ur-PK">Urdu</option>
                <option value="hi-IN">Hindi</option>
                <option value="ar-SA">Arabic</option>
                <option value="es-ES">Spanish</option>
                <option value="fr-FR">French</option>
              </select>
              <button
                type="button"
                onClick={closeLiveVoiceSession}
                className="p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl w-full mx-auto text-center gap-4 my-3 overflow-y-auto">
            <div
              className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center transition-all duration-500 ${
                voiceListening
                  ? 'scale-105 shadow-[0_0_80px_rgba(34,211,238,0.55)] bg-cyan-500/15 border-2 border-cyan-400'
                  : voiceSpeaking
                    ? 'scale-105 shadow-[0_0_80px_rgba(59,130,246,0.6)] bg-blue-500/20 border-2 border-blue-400'
                    : voiceThinking
                      ? 'animate-pulse bg-violet-500/15 border-2 border-violet-400'
                      : 'bg-slate-900/80 border border-slate-700'
              }`}
            >
              <ArcReactorLogo glow={voiceListening || voiceSpeaking || voiceThinking} size="lg" />
            </div>

            <div className="space-y-1.5 px-2">
              <h2 className="text-base sm:text-xl font-semibold text-cyan-200 flex items-center justify-center gap-2">
                {voiceSpeaking && <Volume2 className="w-5 h-5 text-blue-400 animate-pulse" />}
                <span>
                  {voiceListening
                    ? 'Listening — Speak naturally...'
                    : voiceThinking
                      ? 'JARVIS is analyzing...'
                      : voiceSpeaking
                        ? 'JARVIS is speaking...'
                        : 'Tap microphone or type below'}
                </span>
              </h2>
              {voiceInterimTranscript && (
                <p className="text-sm text-cyan-300 italic max-w-lg mx-auto">
                  “{voiceInterimTranscript}”
                </p>
              )}
              {voiceError && (
                <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 inline-block">
                  {voiceError}
                </p>
              )}
            </div>

            {voiceTurns.length > 0 && (
              <div className="w-full max-h-40 overflow-y-auto bg-slate-900/75 border border-slate-800 rounded-xl p-3 text-left space-y-2">
                {voiceTurns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`text-xs leading-relaxed ${
                      turn.role === 'user' ? 'text-cyan-300' : 'text-slate-200'
                    }`}
                  >
                    <strong className="uppercase font-mono mr-1.5">
                      {turn.role === 'user' ? 'You:' : 'JARVIS:'}
                    </strong>
                    <span>{turn.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="max-w-xl w-full mx-auto flex flex-col items-center gap-3">
            <div className="w-full flex gap-2">
              <input
                type="text"
                value={voiceTypedInput}
                onChange={(e) => setVoiceTypedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && voiceTypedInput.trim()) {
                    const msg = voiceTypedInput;
                    setVoiceTypedInput('');
                    void processLiveVoiceTurn(msg);
                  }
                }}
                placeholder="Type a message for JARVIS to answer aloud..."
                className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (!voiceTypedInput.trim()) return;
                  const msg = voiceTypedInput;
                  setVoiceTypedInput('');
                  void processLiveVoiceTurn(msg);
                }}
                className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  if (voiceListening) {
                    stopVoiceRecognition();
                  } else {
                    startVoiceRecognition();
                  }
                }}
                className={`p-4 rounded-full transition shadow-lg ${
                  voiceListening
                    ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                    : 'bg-slate-800 text-cyan-300 hover:bg-slate-700 border border-cyan-500/40'
                }`}
              >
                {voiceListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </button>

              {voiceSpeaking && (
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    if (voiceAutoLoop) startVoiceRecognition();
                  }}
                  className="px-4 py-2.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-xs font-medium hover:bg-amber-500/30"
                >
                  Interrupt & Speak
                </button>
              )}

              <button
                type="button"
                onClick={closeLiveVoiceSession}
                className="p-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceAutoLoop}
                  onChange={(e) => setVoiceAutoLoop(e.target.checked)}
                  className="accent-cyan-400"
                />
                <span>Hands-free loop</span>
              </label>
              <label className="flex items-center gap-1.5">
                <span>Speed: {voiceRate.toFixed(2)}x</span>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.05"
                  value={voiceRate}
                  onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                  className="w-20 accent-cyan-400"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* REAL-TIME NEWS MODAL */}
      {newsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0b1322] border-0 sm:border border-cyan-500/30 rounded-none sm:rounded-2xl w-full h-[100dvh] sm:h-auto sm:max-w-2xl p-5 sm:p-6 shadow-2xl flex flex-col justify-between sm:block space-y-5 overflow-y-auto jarvis-mobile-safe-bottom">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Newspaper className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    JARVIS Real-Time News & Briefings
                  </h3>
                  <p className="text-xs text-slate-400">
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
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-auto">
              {NEWS_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setNewsModalOpen(false);
                    void handleSendMessage(cat.prompt, [], { forceGoogleGrounding: true });
                  }}
                  className="flex items-center justify-between p-4 sm:p-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-left transition group"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-100 group-hover:text-cyan-300">
                      {cat.label}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      Live Google News + verified headlines
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ALL-PROFESSIONS SPECIALIST MODAL */}
      {professionsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0b1322] border-0 sm:border border-cyan-500/30 rounded-none sm:rounded-2xl w-full h-[100dvh] sm:h-auto sm:max-w-4xl sm:max-h-[88vh] flex flex-col p-4 sm:p-6 shadow-2xl jarvis-mobile-safe-bottom">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-cyan-400 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Specialist Matrix ({PROFESSION_PROFILES.length} Domains)
                  </h3>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Equip JARVIS with domain-specific reasoning across medicine, engineering, law,
                    finance, and science
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfessionsModalOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={professionSearch}
                onChange={(e) => setProfessionSearch(e.target.value)}
                placeholder="Search Medical, Pharmacology, Mechanical, Electrical, Civil, Law..."
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
                          className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${prof.badgeColor}`}
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
                        className={`w-full py-2 rounded-lg text-xs font-medium transition ${
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

      {/* 100% FREE IMAGE CREATION STUDIO MODAL */}
      {imageStudioOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0b1322] border-0 sm:border border-fuchsia-500/30 rounded-none sm:rounded-2xl w-full h-[100dvh] sm:h-auto sm:max-w-4xl sm:max-h-[90vh] flex flex-col p-4 sm:p-6 shadow-2xl jarvis-mobile-safe-bottom">
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Palette className="w-5 h-5 text-fuchsia-400 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    JARVIS Neural Image Studio (Free Unlimited)
                  </h3>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Synthesize photorealistic artwork, engineering schematics, and medical renders
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImageStudioOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-3 sm:py-4 space-y-3 border-b border-slate-800">
              <textarea
                rows={2}
                value={studioPrompt}
                onChange={(e) => setStudioPrompt(e.target.value)}
                placeholder="Describe the image, car, medical diagram, architectural render, or sci-fi concept..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-fuchsia-400"
              />

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={studioStyle}
                  onChange={(e) => setStudioStyle(e.target.value)}
                  className="flex-1 sm:flex-none bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
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
                  onClick={() => void handleGenerateStudioImage()}
                  className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
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
                            target="_blank"
                            rel="noopener noreferrer"
                            download={`jarvis-art-${item.id}.png`}
                            className="flex items-center gap-1 text-cyan-400 hover:underline"
                          >
                            <Download className="w-3 h-3" />
                            <span>Open / Save</span>
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

      {/* ENGINEERING & MEDICAL WORKBENCH MODAL */}
      {workbenchOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0b1322] border-0 sm:border border-emerald-500/30 rounded-none sm:rounded-2xl w-full h-[100dvh] sm:h-auto sm:max-w-3xl sm:max-h-[88vh] flex flex-col p-4 sm:p-6 shadow-2xl space-y-4 jarvis-mobile-safe-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Engineering & Clinical Workbench
                  </h3>
                  <p className="text-xs text-slate-400 hidden sm:block">
                    Scientific evaluator, Ohm's law, unit conversions, materials database &
                    clinical lab ranges
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWorkbenchOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'calc', label: 'Scientific Calc' },
                  { id: 'ohms', label: "Ohm's Law" },
                  { id: 'units', label: 'Eng Units' },
                  { id: 'materials', label: 'Materials DB' },
                  { id: 'clinical', label: 'BMI / BMR' },
                  { id: 'labs', label: 'Lab Ranges' },
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
                  <div className="flex flex-col sm:flex-row gap-2">
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                  <div className="flex flex-col sm:flex-row gap-2">
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
                        <th className="py-2 px-2">Density</th>
                        <th className="py-2 px-2">Young's (GPa)</th>
                        <th className="py-2 px-2">Yield (MPa)</th>
                        <th className="py-2 pl-2">Thermal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {ENGINEERING_MATERIALS_DB.map((mat) => (
                        <tr key={mat.name} className="hover:bg-slate-900/70">
                          <td className="py-2 pr-3 font-medium text-slate-200">{mat.name}</td>
                          <td className="py-2 px-2 font-mono text-cyan-300">{mat.density}</td>
                          <td className="py-2 px-2 font-mono text-emerald-300">
                            {mat.youngsGPa}
                          </td>
                          <td className="py-2 px-2 font-mono text-amber-300">{mat.yieldMPa}</td>
                          <td className="py-2 pl-2 font-mono text-slate-300">{mat.thermalWmK}</td>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                      key={lab.test}
                      className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="text-xs font-semibold text-slate-100">{lab.test}</div>
                        <div className="text-[11px] text-slate-400">{lab.note}</div>
                      </div>
                      <div className="text-xs font-mono text-cyan-300 shrink-0">{lab.range}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JARVIS PERSISTENT NEURAL MEMORY MODAL */}
      {memoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
          <div className="bg-[#0b1322] border-0 sm:border border-violet-500/30 rounded-none sm:rounded-2xl w-full h-[100dvh] sm:h-auto sm:max-w-xl p-4 sm:p-6 shadow-2xl flex flex-col space-y-4 jarvis-mobile-safe-bottom">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-violet-400 shrink-0" />
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
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
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
                placeholder="e.g., I am a student in Narowal; use simple English."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleAddMemory}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium"
              >
                Save
              </button>
            </div>

            <div className="flex-1 sm:max-h-60 overflow-y-auto space-y-2">
              {memories.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No neural memories saved yet. Add your role, city, or preferences above.
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-12 sm:pt-20 p-3 sm:p-4">
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
