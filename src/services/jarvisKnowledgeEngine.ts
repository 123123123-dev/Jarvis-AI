/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * JARVIS Omniscient Knowledge, Engineering, Medical & Temporal Grounding Engine
 */

export type ProfessionId =
  | 'general'
  | 'medical'
  | 'pharmacology'
  | 'mechanical-eng'
  | 'electrical-eng'
  | 'civil-eng'
  | 'aerospace-eng'
  | 'software'
  | 'cybersecurity'
  | 'ai-ml'
  | 'legal'
  | 'finance'
  | 'physics-chem'
  | 'architecture'
  | 'business-ops'
  | 'education'
  | 'creative'
  | 'data-science';

export interface ProfessionProfile {
  id: ProfessionId;
  name: string;
  shortName: string;
  category:
    | 'Core'
    | 'Healthcare'
    | 'Engineering'
    | 'Computing'
    | 'Law & Finance'
    | 'Science & Design'
    | 'Strategy & Arts';
  description: string;
  badgeColor: string;
  systemDirective: string;
  disclaimer?: string;
  quickPrompts: string[];
}

export interface EngineeringMaterial {
  name: string;
  category: 'Metal' | 'Alloy' | 'Composite' | 'Construction' | 'Semiconductor';
  densityKgM3: number;
  youngsModulusGPa: number;
  yieldStrengthMPa: number;
  thermalConductivityWmK: number;
  meltingPointC: number;
}

export interface ClinicalLabReference {
  testName: string;
  abbreviation: string;
  normalRange: string;
  unit: string;
  clinicalNote: string;
}

export interface MemoryEntry {
  id: string;
  category: 'Identity' | 'Profession' | 'Preference' | 'Project';
  content: string;
  createdAt: number;
}

// ============================================================================
// 1. ALL-PROFESSIONS SPECIALIST MATRIX (18 EXPERT DOMAINS)
// ============================================================================

export const PROFESSION_PROFILES: ProfessionProfile[] = [
  {
    id: 'general',
    name: 'JARVIS Omniscient Core',
    shortName: 'All-Domain Core',
    category: 'Core',
    description:
      'Universal intelligence across live current events, science, coding, daily productivity, and reasoning.',
    badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    systemDirective:
      'Operate as JARVIS, an omniscient, articulate, real-time AI assistant capable of answering across all human professions with live temporal awareness, factual rigor, and structured clarity.',
    quickPrompts: [
      'Give me a complete briefing on today’s top global and technology headlines.',
      'Compare the newest breakthroughs in AI models, robotics, and clean energy.',
      'Build a structured daily execution schedule for maximum deep-work output.',
    ],
  },
  {
    id: 'medical',
    name: 'Medical & Clinical Intelligence',
    shortName: 'Medical & Clinical',
    category: 'Healthcare',
    description:
      'Pathophysiology, differential diagnosis frameworks, diagnostic lab interpretation, and clinical guidelines.',
    badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    systemDirective:
      'Operate as a Senior Medical & Clinical Intelligence specialist. Explain pathophysiology, differential considerations, diagnostic criteria, and lab markers using clear clinical structure. Always include a concise reminder to consult a licensed physician for personal diagnosis or treatment.',
    disclaimer:
      'Clinical Reference Mode: Educational medical information only — not a substitute for professional medical diagnosis or emergency care.',
    quickPrompts: [
      'Explain how to interpret a Complete Blood Count (CBC) and Comprehensive Metabolic Panel.',
      'Outline differential considerations and red-flag symptoms for acute dyspnea.',
      'Compare diagnostic criteria and first-line management of Type 2 Diabetes.',
    ],
  },
  {
    id: 'pharmacology',
    name: 'Clinical Pharmacology & Toxicology',
    shortName: 'Pharmacology',
    category: 'Healthcare',
    description:
      'Pharmacokinetics (ADME), receptor mechanisms, CYP450 drug-drug interactions, and therapeutic monitoring.',
    badgeColor: 'text-teal-300 border-teal-500/40 bg-teal-500/10',
    systemDirective:
      'Operate as a Board-Certified Clinical Pharmacologist. Detail mechanisms of action, ADME pharmacokinetics, CYP450 enzyme interactions, contraindications, and adverse effect profiles clearly. Remind users to verify dosing with a licensed prescriber or pharmacist.',
    disclaimer:
      'Pharmacology Reference Mode: Always verify dosing and drug interactions with a licensed pharmacist or physician.',
    quickPrompts: [
      'Explain CYP3A4 and CYP2D6 metabolic pathways and major clinically significant drug interactions.',
      'Compare beta-blockers by cardioselectivity, lipophilicity, and half-life.',
      'Explain therapeutic drug monitoring for vancomycin and narrow-therapeutic-index drugs.',
    ],
  },
  {
    id: 'mechanical-eng',
    name: 'Mechanical & Thermodynamics Engineer',
    shortName: 'Mechanical Eng',
    category: 'Engineering',
    description:
      'Statics, dynamics, FEA stress/strain, fluid mechanics, heat transfer, HVAC, and CAD/CAM manufacturing.',
    badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    systemDirective:
      'Operate as a Principal Mechanical & Thermal Systems Engineer. Provide first-principles equations, free-body force breakdowns, material selection tables, safety factors, and SI/imperial unit conversions.',
    quickPrompts: [
      'Calculate maximum bending stress and deflection for a cantilevered steel beam under point load.',
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
      'Analog/digital circuits, PCB layout, power electronics, microcontrollers, RF, and control theory.',
    badgeColor: 'text-yellow-300 border-yellow-500/40 bg-yellow-500/10',
    systemDirective:
      'Operate as a Principal Electrical & Embedded Systems Engineer. Provide circuit analysis, component sizing formulas, buck/boost converter calculations, signal integrity practices, and microcontroller firmware guidance.',
    quickPrompts: [
      'Calculate inductor and capacitor values for a 12V to 3.3V synchronous buck converter at 500kHz.',
      'Explain PCB impedance control, ground plane stitching, and EMI mitigation.',
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
      'Operate as a Principal Civil & Structural Engineer. Analyze dead/live/seismic loads, reinforced concrete moment capacities, soil bearing capacity, and hydrological drainage design with clear engineering assumptions.',
    quickPrompts: [
      'Explain ACI 318 flexural strength design steps for a singly reinforced concrete beam.',
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
      'Aerodynamics, orbital mechanics, rocket propulsion (Isp, delta-v), avionics, and composite airframes.',
    badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
    systemDirective:
      'Operate as a Senior Aerospace & Orbital Mechanics Engineer. Use Tsiolkovsky rocket equations, lift/drag polar relationships, Hohmann transfer calculations, and aerospace composite trade-offs.',
    quickPrompts: [
      'Calculate delta-v using the Tsiolkovsky rocket equation for a two-stage orbital launch vehicle.',
      'Compare LOX/Methane (methalox) vs LOX/RP-1 rocket engine performance and reusability.',
      'Explain transonic wave drag and supercritical airfoil geometry.',
    ],
  },
  {
    id: 'software',
    name: 'Principal Full-Stack & Distributed Architect',
    shortName: 'Software Architect',
    category: 'Computing',
    description:
      'TypeScript, React, Node.js, system design, distributed databases, APIs, and high-scale algorithms.',
    badgeColor: 'text-blue-300 border-blue-500/40 bg-blue-500/10',
    systemDirective:
      'Operate as a Principal Software & Distributed Systems Architect. Deliver clean, strongly-typed production code, Big-O complexity breakdowns, caching strategies, and fault-tolerant architectures.',
    quickPrompts: [
      'Design a horizontally scalable real-time chat & notification architecture using WebSockets and Redis.',
      'Write a clean TypeScript implementation of an LRU Cache with O(1) get and put.',
      'Compare PostgreSQL indexing strategies (B-Tree, GIN, BRIN, HNSW) for hybrid workloads.',
    ],
  },
  {
    id: 'cybersecurity',
    name: 'Cybersecurity & Zero-Trust Architect',
    shortName: 'Cybersecurity',
    category: 'Computing',
    description:
      'Defensive threat modeling, OWASP Top 10, applied cryptography, OAuth2/OIDC, and cloud hardening.',
    badgeColor: 'text-rose-300 border-rose-500/40 bg-rose-500/10',
    systemDirective:
      'Operate as a Principal Defensive Cybersecurity Architect. Focus on threat modeling, OWASP vulnerability mitigation, cryptographic standards, OAuth2 PKCE flows, and Zero-Trust network segmentation.',
    quickPrompts: [
      'Design a secure OAuth 2.1 + PKCE authentication flow with refresh token rotation.',
      'Explain post-quantum cryptography standards (ML-KEM / CRYSTALS-Kyber and ML-DSA).',
      'Audit common API security vulnerabilities (BOLA/IDOR, SSRF, JWT misconfigurations).',
    ],
  },
  {
    id: 'ai-ml',
    name: 'AI Research & Machine Learning Engineer',
    shortName: 'AI & ML Research',
    category: 'Computing',
    description:
      'Transformers, RAG pipelines, fine-tuning (LoRA/QLoRA), multimodal embeddings, and inference optimization.',
    badgeColor: 'text-purple-300 border-purple-500/40 bg-purple-500/10',
    systemDirective:
      'Operate as a Staff AI Research & Machine Learning Engineer. Explain transformer attention mechanisms, hybrid vector + lexical RAG architectures, quantization, and evaluation benchmarks.',
    quickPrompts: [
      'Architect a low-latency hybrid RAG pipeline with semantic chunking and cross-encoder reranking.',
      'Explain FlashAttention, KV-cache memory optimization, and speculative decoding.',
      'Compare LoRA, QLoRA, and DPO post-training alignment workflows.',
    ],
  },
  {
    id: 'legal',
    name: 'Legal & Regulatory Compliance Analyst',
    shortName: 'Legal & Policy',
    category: 'Law & Finance',
    description:
      'Commercial contracts, IP protection, SaaS licensing, privacy compliance (GDPR/CCPA), and corporate law.',
    badgeColor: 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10',
    systemDirective:
      'Operate as a Senior Legal & Regulatory Analyst. Analyze contract risk allocation, indemnification, limitation of liability, IP ownership, and global data privacy rules. Clarify that insights are educational analysis rather than formal legal representation.',
    disclaimer:
      'Legal Analysis Mode: Educational contract and regulatory analysis; consult licensed legal counsel for formal advice.',
    quickPrompts: [
      'Break down critical red flags in SaaS Master Services Agreements and Data Processing Addendums.',
      'Compare copyright, patent, and trade secret protections for AI-generated software and datasets.',
      'Summarize global AI regulatory compliance obligations across the EU, US, and Asia.',
    ],
  },
  {
    id: 'finance',
    name: 'Quantitative Finance & Macro Strategist',
    shortName: 'Finance & Markets',
    category: 'Law & Finance',
    description:
      'DCF valuation, financial statement modeling, fixed income, options Greeks, and global macroeconomics.',
    badgeColor: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    systemDirective:
      'Operate as a Quantitative Financial Analyst & Macroeconomic Strategist. Provide rigorous DCF valuation steps, WACC calculations, working capital analysis, and macro risk assessments.',
    quickPrompts: [
      'Walk through a full Discounted Cash Flow (DCF) and WACC valuation model step-by-step.',
      'Explain how yield curve inversions, inflation expectations, and central bank rates affect asset classes.',
      'Analyze SaaS financial metrics: Rule of 40, Net Dollar Retention, and Free Cash Flow margin.',
    ],
  },
  {
    id: 'physics-chem',
    name: 'Theoretical Physics & Chemistry Fellow',
    shortName: 'Physics & Chem',
    category: 'Science & Design',
    description:
      'Quantum mechanics, electromagnetism, thermodynamics, organic synthesis, and materials chemistry.',
    badgeColor: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
    systemDirective:
      'Operate as a Senior Physics & Chemistry Research Fellow. Derive physical equations cleanly, balance chemical reactions, explain molecular orbital theory, and connect theory to real experiments.',
    quickPrompts: [
      'Explain Maxwell’s equations in differential and integral forms with physical intuition.',
      'Compare solid-state electrolyte chemistries (sulfide, oxide, polymer) for next-gen batteries.',
      'Explain quantum entanglement, Bell’s theorem, and quantum error correction.',
    ],
  },
  {
    id: 'architecture',
    name: 'Architectural & Sustainable Urban Designer',
    shortName: 'Architecture',
    category: 'Science & Design',
    description:
      'Bioclimatic passive design, spatial planning, mass timber, acoustics, lighting, and urban systems.',
    badgeColor: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    systemDirective:
      'Operate as a Principal Architect & Sustainable Building Consultant. Address spatial flow, daylighting, passive cooling/heating strategies, structural grids, and sustainable material palettes.',
    quickPrompts: [
      'Design a passive-cooling courtyard residence tailored for hot, arid climates.',
      'Compare Cross-Laminated Timber (CLT) vs structural steel embodied carbon and span limits.',
      'Outline architectural acoustic isolation strategies for mixed-use buildings.',
    ],
  },
  {
    id: 'business-ops',
    name: 'Executive Strategy & Operations COO',
    shortName: 'Business Strategy',
    category: 'Strategy & Arts',
    description:
      'Go-to-market execution, pricing strategy, supply chain resilience, OKRs, and competitive positioning.',
    badgeColor: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    systemDirective:
      'Operate as an Executive Strategy & Operations COO. Deliver actionable 90-day GTM plans, pricing tier architectures, unit economics frameworks, and crisp executive memos.',
    quickPrompts: [
      'Build a 90-day Go-To-Market launch roadmap for a new B2B AI platform.',
      'Design a value-based SaaS pricing and packaging matrix (Free, Pro, Enterprise).',
      'Create a supply chain risk mitigation matrix for global hardware manufacturing.',
    ],
  },
  {
    id: 'data-science',
    name: 'Principal Data Scientist & Statistician',
    shortName: 'Data Science',
    category: 'Computing',
    description:
      'Bayesian inference, A/B experimentation, causal inference, time-series forecasting, and SQL analytics.',
    badgeColor: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
    systemDirective:
      'Operate as a Principal Data Scientist & Statistician. Provide rigorous experimental design, statistical power calculations, causal inference methods, and clean SQL/Python data pipelines.',
    quickPrompts: [
      'Explain how to calculate sample size, statistical power, and MDE for an A/B experiment.',
      'Compare Difference-in-Differences, Synthetic Control, and Instrumental Variables for causal inference.',
      'Design a multi-seasonality time-series forecasting pipeline.',
    ],
  },
  {
    id: 'education',
    name: 'Master Educator & Socratic Tutor',
    shortName: 'Master Tutor',
    category: 'Strategy & Arts',
    description:
      'First-principles intuitive teaching, structured syllabi, worked examples, and active recall quizzes.',
    badgeColor: 'text-lime-300 border-lime-500/40 bg-lime-500/10',
    systemDirective:
      'Operate as a Master Educator. Explain any topic from intuitive first principles up to advanced mastery using clear analogies, step-by-step worked problems, and active recall questions.',
    quickPrompts: [
      'Teach me Calculus derivatives and integrals intuitively with real-world physics examples.',
      'Create a structured 14-day mastery roadmap for learning full-stack TypeScript.',
      'Give me an adaptive 5-question quiz on global economics and geopolitics.',
    ],
  },
  {
    id: 'creative',
    name: 'Creative Director & Narrative Architect',
    shortName: 'Creative Studio',
    category: 'Strategy & Arts',
    description:
      'Cinematic storytelling, world-building, brand identity, copywriting, and visual art direction.',
    badgeColor: 'text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10',
    systemDirective:
      'Operate as an award-winning Creative Director and Storyteller. Craft vivid prose, compelling scripts, brand manifestos, and rich visual art prompts.',
    quickPrompts: [
      'Write a gripping sci-fi opening scene set inside an orbital AI command center.',
      'Craft 5 ultra-detailed prompts for photorealistic futuristic architectural renders.',
      'Develop a complete brand positioning manifesto and tagline suite.',
    ],
  },
];

// ============================================================================
// 2. ENGINEERING MATERIALS & CLINICAL LAB REFERENCE DATABASES
// ============================================================================

export const ENGINEERING_MATERIALS_DB: EngineeringMaterial[] = [
  {
    name: 'Structural Steel (ASTM A36)',
    category: 'Metal',
    densityKgM3: 7850,
    youngsModulusGPa: 200,
    yieldStrengthMPa: 250,
    thermalConductivityWmK: 50,
    meltingPointC: 1510,
  },
  {
    name: 'Aerospace Aluminum (7075-T6)',
    category: 'Alloy',
    densityKgM3: 2810,
    youngsModulusGPa: 71.7,
    yieldStrengthMPa: 503,
    thermalConductivityWmK: 130,
    meltingPointC: 477,
  },
  {
    name: 'Titanium Alloy (Ti-6Al-4V)',
    category: 'Alloy',
    densityKgM3: 4430,
    youngsModulusGPa: 113.8,
    yieldStrengthMPa: 880,
    thermalConductivityWmK: 6.7,
    meltingPointC: 1660,
  },
  {
    name: 'Carbon Fiber Epoxy (Unidirectional)',
    category: 'Composite',
    densityKgM3: 1600,
    youngsModulusGPa: 135,
    yieldStrengthMPa: 1500,
    thermalConductivityWmK: 5.0,
    meltingPointC: 250,
  },
  {
    name: 'Reinforced Concrete (High-Strength)',
    category: 'Construction',
    densityKgM3: 2400,
    youngsModulusGPa: 30,
    yieldStrengthMPa: 40,
    thermalConductivityWmK: 1.7,
    meltingPointC: 1200,
  },
  {
    name: 'Pure Copper (C11000 ETP)',
    category: 'Metal',
    densityKgM3: 8940,
    youngsModulusGPa: 117,
    yieldStrengthMPa: 69,
    thermalConductivityWmK: 398,
    meltingPointC: 1085,
  },
  {
    name: 'Monocrystalline Silicon (Wafer)',
    category: 'Semiconductor',
    densityKgM3: 2329,
    youngsModulusGPa: 130,
    yieldStrengthMPa: 170,
    thermalConductivityWmK: 149,
    meltingPointC: 1414,
  },
];

export const CLINICAL_LAB_REFERENCES: ClinicalLabReference[] = [
  {
    testName: 'Hemoglobin (Adult Male / Female)',
    abbreviation: 'Hgb',
    normalRange: '13.5–17.5 (M) / 12.0–15.5 (F)',
    unit: 'g/dL',
    clinicalNote: 'Evaluates oxygen-carrying capacity and anemia.',
  },
  {
    testName: 'White Blood Cell Count',
    abbreviation: 'WBC',
    normalRange: '4.5–11.0',
    unit: '×10³/µL',
    clinicalNote: 'Elevated in infection/inflammation; reduced in bone marrow suppression.',
  },
  {
    testName: 'Platelet Count',
    abbreviation: 'PLT',
    normalRange: '150–450',
    unit: '×10³/µL',
    clinicalNote: 'Essential for primary hemostasis and blood clotting.',
  },
  {
    testName: 'Fasting Blood Glucose',
    abbreviation: 'FBG',
    normalRange: '70–99',
    unit: 'mg/dL',
    clinicalNote: '100–125 mg/dL indicates impaired fasting glucose; ≥126 mg/dL diabetic threshold.',
  },
  {
    testName: 'Glycated Hemoglobin',
    abbreviation: 'HbA1c',
    normalRange: '< 5.7%',
    unit: '%',
    clinicalNote: 'Reflects 2–3 month average glycemic control; ≥6.5% diagnostic for diabetes.',
  },
  {
    testName: 'Serum Creatinine',
    abbreviation: 'Cr',
    normalRange: '0.7–1.3 (M) / 0.6–1.1 (F)',
    unit: 'mg/dL',
    clinicalNote: 'Key renal filtration biomarker used to estimate eGFR.',
  },
  {
    testName: 'Thyroid-Stimulating Hormone',
    abbreviation: 'TSH',
    normalRange: '0.4–4.0',
    unit: 'mIU/L',
    clinicalNote: 'Primary screening marker for hypothyroidism and hyperthyroidism.',
  },
  {
    testName: 'C-Reactive Protein (High-Sensitivity)',
    abbreviation: 'hs-CRP',
    normalRange: '< 1.0 (Low risk)',
    unit: 'mg/L',
    clinicalNote: 'Systemic inflammatory marker and cardiovascular risk indicator.',
  },
];

// ============================================================================
// 3. REAL-TIME NEWS INTENT DETECTOR & TEMPORAL GROUNDING BUILDER
// ============================================================================

export function detectLiveNewsOrCurrentEventIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  const patterns = [
    /\btoday(?:'s|s)?\b/,
    /\bright now\b/,
    /\bhappening now\b/,
    /\bcurrent(?:ly)?\b/,
    /\blatest\b/,
    /\bbreaking\b/,
    /\bnews\b/,
    /\bheadlines?\b/,
    /\bupdate(?:s)?\b/,
    /\bthis week\b/,
    /\bthis month\b/,
    /\byesterday\b/,
    /\blive\s+(?:score|scores|match|game|price|market|update)/,
    /\bstock price\b/,
    /\bbitcoin price\b/,
    /\bcrypto price\b/,
    /\bexchange rate\b/,
    /\bwho won\b/,
    /\bwhat happened\b/,
    /\bweather\b/,
    /\b2025\b/,
    /\b2026\b/,
  ];
  return patterns.some((pattern) => pattern.test(lower));
}

export function buildTemporalGroundingPrefix(
  profession: ProfessionProfile,
  memories: MemoryEntry[],
  isLiveNewsQuery: boolean
): string {
  const now = new Date();
  const timeZone =
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local Time'
      : 'UTC';
  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const sections: string[] = [
    `[JARVIS REAL-TIME CONTEXT: Current Date = ${formattedDate} | Local Time = ${formattedTime} (${timeZone})]`,
    `[ACTIVE SPECIALIST MODE: ${profession.name} —${profession.systemDirective}]`,
  ];

  if (isLiveNewsQuery) {
    sections.push(
      '[REAL-TIME GROUNDING DIRECTIVE: The user is asking about current events, today’s news, or live real-world information. Prioritize up-to-date live web search results, cite verifiable facts clearly, and explicitly include dates when reporting news.]'
    );
  }

  if (memories.length > 0) {
    const memorySummary = memories
      .slice(0, 14)
      .map((m) => `- (${m.category})${m.content}`)
      .join('\n');
    sections.push(`[USER PERSISTENT MEMORY & PREFERENCES:\n${memorySummary}]`);
  }

  return sections.join('\n');
}

// ============================================================================
// 4. SAFE RECURSIVE-DESCENT SCIENTIFIC MATH EVALUATOR (NO EVAL)
// ============================================================================

export function evaluateSafeMathExpression(rawExpr: string): number {
  const sanitized = rawExpr
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

      if (peek() !== '(') throw new Error(`Expected '(' after function ${ident}.`); consume(); const arg = parseExpression(); if (peek() !== ')') throw new Error(`Expected ')' after ${ident}(...).`);
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
