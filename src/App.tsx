Math.round(b));
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

  const terms: string[] = [];
  let current = '';
  for (let i = 0; i < compact.length; i++) {
    const ch = compact[i];
    if ((ch === '+' || ch === '-') && i > 0) {
      if (current) terms.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) terms.push(current);
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

  if (cleaned.includes('=')) {
    const parts = cleaned.split('=').map((p) => p.trim());
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [lhsRaw, rhsRaw] = parts;

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
// MAIN HUD WORKSPACE COMPONENT
// ============================================================================

function JarvisWorkspace() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const loaded = loadSettings();
    return {
      selectedModel: loaded?.selectedModel || 'jarvis-turbo',
      voiceEnabled: Boolean(loaded?.voiceEnabled),
      webSearchEnabled: false,
      dualEngineEnabled: Boolean(loaded?.dualEngineEnabled),
    };
  });
  const [directSignInUrl, setDirectSignInUrl] = useState<string | null>(null);
  const [accountNotice, setAccountNotice] = useState('');

  // History Sidebar Drawer (collapsed by default so the 3-column HUD matches Image 2)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [aiConfigured, setAiConfigured] = useState(false);

  // Mobile HUD drawer tabs ('center' | 'left' | 'right')
  const [mobileHudTab, setMobileHudTab] = useState<'center' | 'left' | 'right'>('center');

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [toolsModalOpen, setToolsModalOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(() => earlyDeferredInstallPrompt);

  // Bottom-Center Capsule State: Question Writing Mode vs Voice Conversation Allowed Mode
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

  // Specialist Role, Memory & Gallery
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

  // Feature Modals
  const [newsModalOpen, setNewsModalOpen] = useState(false);
  const [professionsModalOpen, setProfessionsModalOpen] = useState(false);
  const [imageStudioOpen, setImageStudioOpen] = useState(false);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [memoryModalOpen, setMemoryModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  const [liveClock, setLiveClock] = useState(() => new Date());

  // Image Studio State
  const [studioPrompt, setStudioPrompt] = useState('');
  const [studioStyle, setStudioStyle] = useState(IMAGE_STYLE_PRESETS[0].id);
  const [studioAspectRatio, setStudioAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [studioError, setStudioError] = useState('');

  // Workbench State
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
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const accountSaveQueue = useRef(Promise.resolve());
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceAllowedRef = useRef(false);
  const voiceAutoLoopRef = useRef(true);

  useEffect(() => {
    voiceAllowedRef.current = voiceConversationAllowed;
  }, [voiceConversationAllowed]);

  useEffect(() => {
    voiceAutoLoopRef.current = voiceAutoLoop;
  }, [voiceAutoLoop]);

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
      setAccountNotice('JARVIS AI HUD installed on your device!');
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [deferredInstallPrompt]);

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

  // Calendar grid for Top-Left HUD Calendar widget
  const calendarData = useMemo(() => {
    const year = liveClock.getFullYear();
    const month = liveClock.getMonth();
    const today = liveClock.getDate();
    const monthLabel = liveClock.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; isToday: boolean }> = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: null, isToday: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, isToday: d === today });
    }
    return { monthLabel, cells };
  }, [liveClock]);

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
        'Conversation imported in a signed-out guest session.'
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

  const speakTextAloud = useCallback(
    (text: string, messageId?: string, onDone?: () => void) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        onDone?.();
        return;
      }
      window.speechSynthesis.cancel();

      const cleanText = formatAsCleanNotebookText(text)
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        onDone?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.04;
      utterance.pitch = 0.96;
      utterance.lang = voiceLang;

      const jarvisVoice = pickPreferredJarvisVoice();
      if (jarvisVoice) {
        utterance.voice = jarvisVoice;
      }

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

      activeUtteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [voiceLang]
  );

  const handleToggleSpeakMessage = (messageId: string, text: string) => {
    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }
    speakTextAloud(text, messageId);
  };

  // ==========================================================================
  // CORE SEND MESSAGE ENGINE
  // ==========================================================================

  const handleSendMessage = useCallback(
    async (
      text: string,
      incomingAttachments: Attachment[] = [],
      options?: { forceGoogleGrounding?: boolean; onVoiceReplyComplete?: () => void }
    ) => {
      if (!text.trim() && incomingAttachments.length === 0) return;

      setMobileHudTab('center');

      const userMessage: Message = {
        id: Math.random().toString(36).substring(2, 9),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        attachments: incomingAttachments.length > 0 ? incomingAttachments : undefined,
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

      const shouldSpeakAfter =
        Boolean(settings.voiceEnabled) || Boolean(voiceAllowedRef.current);

      if (incomingAttachments.length === 0) {
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
          if (shouldSpeakAfter) {
            speakTextAloud(
              instantMessage.content,
              instantMessage.id,
              options?.onVoiceReplyComplete
            );
          }
          return;
        }

        const instantMath = solveMathOrEquation(text);
        if (instantMath) {
          const cleanMath = formatAsCleanNotebookText(instantMath);
          const mathMessage: Message = {
            id: Math.random().toString(36).substring(2, 9),
            role: 'assistant',
            content: cleanMath,
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
          if (shouldSpeakAfter) {
            speakTextAloud(
              mathMessage.content,
              mathMessage.id,
              options?.onVoiceReplyComplete
            );
          }
          return;
        }
      }

      const hasImageReference = incomingAttachments.some((attachment) =>
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
            incomingAttachments.length === 0 && !liveWeb.contextText
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
                    attachments: incomingAttachments.map((a) => ({
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

        if (shouldSpeakAfter && assistantMessage.content) {
          speakTextAloud(
            assistantMessage.content,
            assistantMessage.id,
            options?.onVoiceReplyComplete
          );
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
    },
    [
      activeChatId,
      conversations,
      settings.voiceEnabled,
      settings.selectedModel,
      settings.webSearchEnabled,
      settings.dualEngineEnabled,
      activeProfession,
      memories,
      speakTextAloud,
    ]
  );

  // ==========================================================================
  // BOTTOM-CENTER INLINE VOICE CONVERSATION CAPSULE ENGINE
  // ==========================================================================

  const startInlineVoiceListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
        .webkitSpeechRecognition;

    if (!SpeechRecCtor) {
      setVoiceError('Voice recognition not supported in this browser.');
      return;
    }

    stopVoiceRecognition();
    stopSpeaking();

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
        setVoiceError(`Mic notice: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setVoiceListening(false);
      const captured = finalTranscriptBuffer.trim();
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
      setVoiceError('Unable to access microphone. Allow mic permissions.');
    }
  }, [voiceLang, stopVoiceRecognition, stopSpeaking, handleSendMessage]);

  const handleAllowVoiceConversation = () => {
    setVoiceConversationAllowed(true);
    setVoiceError('');
    window.setTimeout(() => {
      startInlineVoiceListening();
    }, 150);
  };

  const handleSwitchBackToTextInput = () => {
    setVoiceConversationAllowed(false);
    stopVoiceRecognition();
    stopSpeaking();
    setVoiceInterimTranscript('');
    setVoiceError('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10 - attachments.length);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAttachments((prev) =>
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

  const handleQuestionSubmit = () => {
    if ((!questionInput.trim() && attachments.length === 0) || isLoading) return;
    const textToSend = questionInput;
    const filesToSend = [...attachments];
    setQuestionInput('');
    setAttachments([]);
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
      'To install JARVIS AI: open your browser menu and choose "Install app" or "Add to Home Screen".'
    );
  };

  // ==========================================================================
  // IMAGE STUDIO, SCREEN VISION & WORKBENCH HANDLERS
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
          'Screen sharing is unavailable in this mobile browser. Tap the paperclip icon to attach a screenshot for JARVIS Vision.'
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

  // Top-Left Radial Wheel Nodes (Inspired by Image 1)
  const radialNodes = useMemo(
    () => [
      {
        id: 'voice',
        label: 'Voice AI',
        angleDeg: -90,
        icon: Mic,
        accent: 'text-cyan-300 border-cyan-400/70',
        onClick: () => handleAllowVoiceConversation(),
      },
      {
        id: 'specialists',
        label: 'Specialists',
        angleDeg: -45,
        icon: Stethoscope,
        accent: 'text-emerald-300 border-emerald-400/60',
        onClick: () => setProfessionsModalOpen(true),
      },
      {
        id: 'image',
        label: 'Image Studio',
        angleDeg: 0,
        icon: Palette,
        accent: 'text-fuchsia-300 border-fuchsia-400/60',
        onClick: () => setImageStudioOpen(true),
      },
      {
        id: 'news',
        label: 'Live News',
        angleDeg: 45,
        icon: Newspaper,
        accent: 'text-amber-300 border-amber-400/60',
        onClick: () => setNewsModalOpen(true),
      },
      {
        id: 'workbench',
        label: 'Eng & Med',
        angleDeg: 90,
        icon: Calculator,
        accent: 'text-sky-300 border-sky-400/60',
        onClick: () => setWorkbenchOpen(true),
      },
      {
        id: 'vision',
        label: 'Screen Vision',
        angleDeg: 135,
        icon: Monitor,
        accent: 'text-blue-300 border-blue-400/60',
        onClick: () => void handleCaptureScreenVision(),
      },
      {
        id: 'memory',
        label: 'Memory',
        angleDeg: 180,
        icon: Brain,
        accent: 'text-violet-300 border-violet-400/60',
        onClick: () => setMemoryModalOpen(true),
      },
      {
        id: 'tools',
        label: 'Prompt Tools',
        angleDeg: -135,
        icon: Wrench,
        accent: 'text-amber-200 border-amber-400/60',
        onClick: () => setToolsModalOpen(true),
      },
    ],
    []
  );

  // Right-Side JARVIS Feature Cards
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
          voiceConversationAllowed
            ? handleSwitchBackToTextInput()
            : handleAllowVoiceConversation(),
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
        subtitle: `Free 8K art & schematics (${artGallery.length} saved)`,
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
        subtitle: `${memories.length} personal facts stored`,
        badge: 'MEM',
        active: memories.length > 0,
        icon: Brain,
        onClick: () => setMemoryModalOpen(true),
      },
    ],
    [
      voiceConversationAllowed,
      activeProfession,
      artGallery.length,
      memories.length,
    ]
  );

  const commandActions = useMemo(
    () => [
      {
        id: 'voice',
        label: 'Allow Voice Conversation (Show Waveform Mic Sign)',
        shortcut: 'VOICE',
        action: () => handleAllowVoiceConversation(),
      },
      {
        id: 'text',
        label: 'Switch to Question Typing Box',
        shortcut: 'TYPE',
        action: () => handleSwitchBackToTextInput(),
      },
      {
        id: 'news',
        label: 'Open Live World News & Briefing Hub',
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
        label: 'Open JARVIS Neural Image Studio',
        shortcut: 'ART',
        action: () => setImageStudioOpen(true),
      },
      {
        id: 'workbench',
        label: 'Open Engineering & Medical Workbench',
        shortcut: 'CALC',
        action: () => setWorkbenchOpen(true),
      },
      {
        id: 'memory',
        label: 'Manage JARVIS Neural Memory',
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

  // ==========================================================================
  // RENDER HUD WORKSPACE (IMAGE 2 LAYOUT + IMAGE 1 TOP-LEFT RADIAL HUB)
  // ==========================================================================

  return (
    <div className="flex flex-col h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-[#020813] text-slate-100 antialiased font-sans relative select-none sm:select-auto">
      {/* Holographic Ambient Radial Grid Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 50% 44%, rgba(14, 165, 233, 0.16) 0%, rgba(3, 13, 30, 0.92) 52%, #02060f 100%)',
        }}
      />

      {/* History Slide-Over Drawer */}
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

      {/* ======================================================================
          TOP HUD BAR (WITH SIGN-IN OPTIONS & STATUS TELEMETRY)
          ====================================================================== */}
      <header className="relative z-20 px-3 sm:px-5 py-2 bg-[#040d1d]/90 backdrop-blur-md border-b border-cyan-500/30 flex items-center justify-between gap-2 shrink-0 shadow-[0_4px_24px_rgba(6,182,212,0.12)]">
        {/* Left: History Menu + JARVIS Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title="Chat History & Sessions"
            className="w-9 h-9 rounded-xl bg-cyan-950/60 hover:bg-cyan-900/70 border border-cyan-500/40 flex items-center justify-center text-cyan-300 transition shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          <ArcReactorLogo glow={true} size="sm" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold tracking-[0.18em] text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.65)]">
                JARVIS
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-mono text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {aiConfigured ? 'CORE ONLINE' : 'NEURAL READY'}
              </span>
            </div>
            <p className="text-[9px] font-mono tracking-[0.16em] text-cyan-400/75 uppercase truncate">
              INTELLIGENCE FOR A BETTER YOU
            </p>
          </div>
        </div>

        {/* Center HUD Micro-Telemetry (Desktop) */}
        <div className="hidden xl:flex items-center gap-4 text-[10px] font-mono tracking-[0.16em] text-cyan-300/75 uppercase">
          <span>CONNECTED • ANYTIME ANYWHERE</span>
          <span className="text-cyan-500/50">|</span>
          <span className="flex items-center gap-1.5 text-cyan-200">
            <Clock className="w-3 h-3 text-cyan-400" />
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
        </div>

        {/* Right: Model Selector, Voice Speaker & Sign-In Options in Top Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <select
            aria-label="Select JARVIS Model"
            value={settings.selectedModel}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                selectedModel: e.target.value as AIModelId,
              }))
            }
            className="hidden md:block bg-[#07152b] border border-cyan-500/35 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
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
            title={settings.voiceEnabled ? 'Auto-Speak Replies: ON' : 'Auto-Speak Replies: OFF'}
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

          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            title="Command Palette (Ctrl+P)"
            className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#07152b] hover:bg-cyan-950/60 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 transition"
          >
            <Command className="w-3.5 h-3.5" />
          </button>

          {/* SIGN-IN OPTIONS IN TOP BAR */}
          {user.isGuest ? (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-[0_0_16px_rgba(34,211,238,0.45)] transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 text-xs font-medium transition max-w-[130px]"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{user.name || 'Account'}</span>
              </button>
              {directSignInUrl && (
                <button
                  type="button"
                  onClick={() => void handleCopyDirectSignInUrl()}
                  title="Copy Direct Sign-In Link"
                  className="hidden sm:flex p-1.5 rounded-lg bg-[#07152b] border border-cyan-500/35 text-cyan-300 hover:bg-cyan-950"
                >
                  <Link className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                title="Sign Out"
                className="p-1.5 rounded-lg bg-[#07152b] border border-rose-500/40 text-rose-300 hover:bg-rose-950/50"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile HUD Switcher Tabs (Only visible on < lg screens) */}
      <div className="lg:hidden relative z-20 flex items-center justify-around bg-[#040d1d]/95 border-b border-cyan-500/25 px-2 py-1.5 text-[11px] font-mono shrink-0">
        <button
          type="button"
          onClick={() => setMobileHudTab('left')}
          className={`px-3 py-1 rounded-lg transition ${
            mobileHudTab === 'left'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
              : 'text-slate-400'
          }`}
        >
          Radial Hub & Status
        </button>
        <button
          type="button"
          onClick={() => setMobileHudTab('center')}
          className={`px-3 py-1 rounded-lg transition ${
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
          className={`px-3 py-1 rounded-lg transition ${
            mobileHudTab === 'right'
              ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
              : 'text-slate-400'
          }`}
        >
          JARVIS Features
        </button>
      </div>

      {/* Notices */}
      {!isOnline && (
        <div className="relative z-20 bg-amber-500/20 border-b border-amber-500/30 px-4 py-1 text-xs text-amber-200 flex items-center gap-2 shrink-0">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Offline: AI responses require an active internet connection.</span>
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

      {/* ======================================================================
          MAIN 3-COLUMN FUTURISTIC HUD BODY (IMAGE 2 LAYOUT)
          ====================================================================== */}
      <main className="relative z-10 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)_290px] xl:grid-cols-[315px_minmax(0,1fr)_315px] gap-3 p-2.5 sm:p-4 overflow-hidden">
        {/* ====================================================================
            LEFT HUD COLUMN: IMAGE 1 RADIAL WHEEL + CALENDAR + SYSTEM STATUS
            ==================================================================== */}
        <aside
          className={`${
            mobileHudTab === 'left' ? 'flex' : 'hidden'
          } lg:flex flex-col gap-3 min-h-0 overflow-y-auto pr-0.5`}
        >
          {/* TOP-LEFT CARD: IMAGE 1 INTERACTIVE JARVIS RADIAL CORE WHEEL */}
          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3 shadow-[0_0_25px_rgba(6,182,212,0.14)] relative overflow-hidden shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono tracking-[0.16em] text-cyan-300 uppercase">
                JARVIS COMMAND WHEEL
              </span>
              <span className="text-[9px] font-mono text-amber-300/90">
                8 MODULES
              </span>
            </div>

            {/* Radial Circular Wheel (Inspired by Image 1) */}
            <div className="relative w-[236px] h-[236px] mx-auto my-1 flex items-center justify-center">
              {/* Outer Glowing Cyan & Gold Ring */}
              <div className="absolute inset-1 rounded-full border-2 border-cyan-400/45 shadow-[0_0_25px_rgba(34,211,238,0.28),inset_0_0_20px_rgba(34,211,238,0.18)]" />
              <div className="absolute inset-5 rounded-full border border-amber-400/35 border-dashed" />
              <div className="absolute inset-12 rounded-full border border-cyan-400/40" />

              {/* Center JARVIS Core Button */}
              <button
                type="button"
                onClick={() => handleNewChat()}
                className="relative z-10 w-[76px] h-[76px] rounded-full bg-gradient-to-b from-[#071e3d] to-[#030d1f] border-2 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.65)] flex flex-col items-center justify-center text-center hover:scale-105 transition"
              >
                <span className="text-[11px] font-extrabold tracking-[0.14em] text-cyan-200">
                  JARVIS
                </span>
                <span className="text-[8px] font-mono text-cyan-400 mt-0.5">
                  CORE
                </span>
              </button>

              {/* 8 Radial Feature Wedges Around the Ring */}
              {radialNodes.map((node) => {
                const IconComponent = node.icon;
                const rad = (node.angleDeg * Math.PI) / 180;
                const radiusPx = 88;
                const x = Math.cos(rad) * radiusPx;
                const y = Math.sin(rad) * radiusPx;

                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={node.onClick}
                    title={node.label}
                    style={{
                      transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`,
                    }}
                    className={`absolute z-10 w-[54px] h-[54px] rounded-2xl bg-[#061830]/95 hover:bg-cyan-500/25 border ${node.accent} shadow-[0_0_12px_rgba(6,182,212,0.25)] flex flex-col items-center justify-center gap-0.5 px-1 transition hover:scale-110`}
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

          {/* MIDDLE-LEFT CARD: CALENDAR (IMAGE 2 TOP-LEFT) */}
          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3 shadow-[0_0_20px_rgba(6,182,212,0.1)] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-cyan-200 text-xs font-semibold">
                <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>Calendar</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-300">
                {calendarData.monthLabel}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-mono text-slate-400 mb-1">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
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

          {/* BOTTOM-LEFT CARD: SYSTEM STATUS GAUGES (IMAGE 2 BOTTOM-LEFT) */}
          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3 shadow-[0_0_20px_rgba(6,182,212,0.1)] shrink-0">
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
                        <circle
                          cx="20"
                          cy="20"
                          r={r}
                          fill="none"
                          stroke="rgba(30,41,59,0.85)"
                          strokeWidth="3.5"
                        />
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
                    <span className="text-[8px] font-mono text-slate-400 mt-1">
                      {gauge.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                All Systems Operational
              </span>
              <button
                type="button"
                onClick={() => void handleInstallApp()}
                className="text-cyan-300 hover:underline flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                <span>Install</span>
              </button>
            </div>
          </section>
        </aside>

        {/* ====================================================================
            CENTER HUD STAGE: GLOWING JARVIS RING / CHAT + BOTTOM QUESTION/VOICE BAR
            ==================================================================== */}
        <section
          className={`${
            mobileHudTab === 'center' ? 'flex' : 'hidden'
          } lg:flex flex-col min-h-0 rounded-2xl bg-[#030c1b]/75 backdrop-blur-sm border border-cyan-500/30 relative overflow-hidden shadow-[0_0_40px_rgba(6,182,212,0.12)]`}
        >
          {/* Subtle HUD Corner Brackets */}
          <div className="pointer-events-none absolute top-2 left-2 w-5 h-5 border-t-2 border-l-2 border-cyan-400/70 rounded-tl-md" />
          <div className="pointer-events-none absolute top-2 right-2 w-5 h-5 border-t-2 border-r-2 border-cyan-400/70 rounded-tr-md" />

          {/* Active Chat Top Strip (When in a conversation) */}
          {!isWelcomeScreen && (
            <div className="px-4 py-2 bg-[#051226]/90 border-b border-cyan-500/25 flex items-center justify-between gap-2 shrink-0 z-10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-cyan-200 truncate">
                  {activeConversation.title}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 shrink-0">
                  {activeProfession.shortName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-[11px] text-cyan-200 transition"
                >
                  <Home className="w-3 h-3" />
                  <span>Core HUD</span>
                </button>
              </div>
            </div>
          )}

          {/* Center Viewport: Either Image 2 Glowing JARVIS Holographic Core OR Conversation Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
            {isWelcomeScreen ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4 text-center relative">
                {/* Luminous Circular Holographic Ring (Image 2 Centerpiece) */}
                <div className="relative w-60 h-60 sm:w-72 sm:h-72 flex items-center justify-center my-auto">
                  {/* Outer Pulsing Cyan Halo */}
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-400/40 shadow-[0_0_70px_rgba(34,211,238,0.32),inset_0_0_45px_rgba(34,211,238,0.22)] animate-pulse" />
                  {/* Segmented Tech Ring */}
                  <div className="absolute inset-3 rounded-full border-[3px] border-dashed border-cyan-300/55" />
                  {/* Inner Bright Core Ring */}
                  <div className="absolute inset-7 rounded-full border-2 border-sky-400/75 bg-gradient-to-b from-cyan-500/15 via-blue-600/10 to-slate-950/80 shadow-[inset_0_0_35px_rgba(56,189,248,0.35)]" />

                  {/* Central JARVIS Typography */}
                  <div className="relative z-10 px-4">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-[0.22em] text-white drop-shadow-[0_0_18px_rgba(34,211,238,0.9)]">
                      JARVIS
                    </h1>
                    <p className="text-xs sm:text-sm font-medium text-cyan-200/95 mt-1.5 tracking-wide">
                      Your Personal AI Assistant
                    </p>
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/40 text-[10px] font-mono text-cyan-300">
                      <span>{activeProfession.shortName}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Starter Chips */}
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
                  <div className="py-3 px-5 bg-cyan-950/25 border-y border-cyan-500/20">
                    <div className="max-w-3xl mx-auto flex gap-3 items-center">
                      <ArcReactorLogo glow={true} size="sm" />
                      <div className="flex items-center gap-2 text-xs text-cyan-300 font-mono">
                        <Sparkles className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                        <span>JARVIS is processing...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} className="h-3" />
              </div>
            )}
          </div>

          {/* ==================================================================
              BOTTOM-CENTER CAPSULE:
              - DEFAULT: WRITE YOUR QUESTIONS BOX
              - WHEN VOICE CONVERSATION IS ALLOWED: GLOWING WAVEFORM + MIC SIGN
              ================================================================== */}
          <div className="px-3 sm:px-6 pb-3 pt-2 bg-gradient-to-t from-[#020813] via-[#030c1b]/95 to-transparent shrink-0 z-10 jarvis-mobile-safe-bottom">
            {voiceConversationAllowed ? (
              /* MODE B: VOICE CONVERSATION ALLOWED -> GLOWING WAVEFORM + MIC SIGN (IMAGE 2) */
              <div className="max-w-xl mx-auto flex flex-col items-center gap-2">
                <div className="w-full rounded-full bg-[#05142b]/95 border border-cyan-400/70 shadow-[0_0_30px_rgba(34,211,238,0.3)] px-4 py-2 flex items-center justify-between gap-3">
                  {/* Switch Back to Writing Questions Button */}
                  <button
                    type="button"
                    onClick={handleSwitchBackToTextInput}
                    title="Switch back to writing questions"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-[11px] text-cyan-200 shrink-0 transition"
                  >
                    <Keyboard className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Write</span>
                  </button>

                  {/* Left Animated Cyan Audio Waveform Bars */}
                  <div className="flex-1 flex items-center justify-end gap-1 h-8 overflow-hidden">
                    {[14, 24, 18, 30, 22, 12, 26, 16, 28, 20].map((barH, idx) => (
                      <span
                        key={idx}
                        style={{
                          height:
                            voiceListening || voiceSpeaking
                              ? `${barH}px`
                              : '6px',
                          animationDelay: `${idx * 90}ms`,
                        }}
                        className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${
                          voiceListening || voiceSpeaking ? 'animate-pulse' : 'opacity-45'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Central Glowing Microphone Sign (Exact Image 2 Style) */}
                  <button
                    type="button"
                    onClick={() => {
                      if (voiceListening) {
                        stopVoiceRecognition();
                      } else {
                        startInlineVoiceListening();
                      }
                    }}
                    title={voiceListening ? 'Stop listening' : 'Tap to speak'}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition shrink-0 ${
                      voiceListening
                        ? 'bg-cyan-400 border-white text-slate-950 shadow-[0_0_28px_rgba(34,211,238,0.95)] scale-105'
                        : voiceSpeaking
                          ? 'bg-blue-500 border-cyan-200 text-white shadow-[0_0_28px_rgba(59,130,246,0.9)]'
                          : 'bg-[#071d3b] border-cyan-400 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.55)] hover:bg-cyan-500/25'
                    }`}
                  >
                    {voiceListening ? (
                      <Mic className="w-5 h-5 animate-bounce" />
                    ) : (
                      <MicOff className="w-5 h-5" />
                    )}
                  </button>

                  {/* Right Animated Cyan Audio Waveform Bars */}
                  <div className="flex-1 flex items-center justify-start gap-1 h-8 overflow-hidden">
                    {[20, 28, 16, 26, 12, 22, 30, 18, 24, 14].map((barH, idx) => (
                      <span
                        key={idx}
                        style={{
                          height:
                            voiceListening || voiceSpeaking
                              ? `${barH}px`
                              : '6px',
                          animationDelay: `${idx * 90}ms`,
                        }}
                        className={`w-1 rounded-full bg-cyan-400 transition-all duration-300 ${
                          voiceListening || voiceSpeaking ? 'animate-pulse' : 'opacity-45'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Language Selector */}
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

                {/* Live Voice Status Caption */}
                <div className="flex items-center justify-center gap-3 text-[11px] font-mono text-cyan-300/90 text-center">
                  <span>
                    {voiceInterimTranscript
                      ? `"${voiceInterimTranscript}"`
                      : voiceListening
                        ? 'Listening... Speak your question to JARVIS'
                        : voiceSpeaking
                          ? 'JARVIS is speaking...'
                          : 'Voice Conversation Active • Tap mic to speak'}
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
                {voiceError && (
                  <p className="text-[11px] text-amber-300">{voiceError}</p>
                )}
              </div>
            ) : (
              /* MODE A: DEFAULT QUESTION WRITING CAPSULE */
              <div className="max-w-2xl mx-auto">
                <div className="rounded-2xl bg-[#05142b]/95 border border-cyan-500/55 shadow-[0_0_25px_rgba(6,182,212,0.2)] p-2.5 space-y-2">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {attachments.map((att, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-[10px] text-cyan-200"
                        >
                          <span className="truncate max-w-[120px]">{att.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                            }
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
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
                      placeholder="Write your question to JARVIS..."
                      className="flex-1 bg-transparent text-sm text-white placeholder-cyan-200/45 focus:outline-none min-w-0"
                    />

                    {/* Allow Voice Conversation Button (Brings back the Voice Waveform Sign) */}
                    <button
                      type="button"
                      onClick={handleAllowVoiceConversation}
                      title="Allow Voice Conversation"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/50 text-cyan-200 text-xs font-medium transition shrink-0"
                    >
                      <Mic className="w-3.5 h-3.5 text-cyan-300" />
                      <span className="hidden sm:inline">Voice</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleQuestionSubmit}
                      disabled={
                        isLoading ||
                        (!questionInput.trim() && attachments.length === 0)
                      }
                      aria-label="Send question"
                      className="w-9 h-9 rounded-full bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 text-slate-950 flex items-center justify-center shadow-[0_0_14px_rgba(34,211,238,0.6)] transition shrink-0"
                    >
                      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Compact Bottom Controls Row */}
                  <div className="flex items-center justify-between gap-2 px-1 pt-0.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-slate-300 hover:text-cyan-300 transition"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Attach</span>
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
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition ${
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
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition ${
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

        {/* ====================================================================
            RIGHT HUD COLUMN: JARVIS FEATURES PANEL + RECENT SESSIONS (IMAGE 2)
            ==================================================================== */}
        <aside
          className={`${
            mobileHudTab === 'right' ? 'flex' : 'hidden'
          } lg:flex flex-col gap-3 min-h-0 overflow-y-auto pl-0.5`}
        >
          {/* TOP-RIGHT CARD: JARVIS FEATURES LIST */}
          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3.5 shadow-[0_0_25px_rgba(6,182,212,0.14)] flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-cyan-500/25 shrink-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h2 className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
                  JARVIS Features
                </h2>
              </div>
              <span className="text-[10px] font-mono text-cyan-300/80">
                All Active
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
              {rightSideFeatures.map((feat) => {
                const IconComp = feat.icon;
                return (
                  <button
                    key={feat.id}
                    type="button"
                    onClick={feat.onClick}
                    className={`w-full flex items-center justify-between gap-2.5 p-2.5 rounded-xl border text-left transition group ${
                      feat.active
                        ? 'bg-cyan-500/20 border-cyan-400/60 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                        : 'bg-[#06162d]/85 hover:bg-cyan-950/60 border-cyan-500/20 hover:border-cyan-400/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center text-cyan-300 shrink-0">
                        <IconComp className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-100 group-hover:text-cyan-200 truncate">
                          {feat.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {feat.subtitle}
                        </div>
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

          {/* BOTTOM-RIGHT CARD: RECENT SESSIONS & QUICK ACTIONS (IMAGE 2) */}
          <section className="rounded-2xl bg-[#041022]/85 backdrop-blur-md border border-cyan-500/35 p-3.5 shadow-[0_0_25px_rgba(6,182,212,0.14)] shrink-0">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/25">
              <span className="text-xs font-bold tracking-wide text-cyan-200 uppercase">
                Sessions & Quick Tasks
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

            {conversations.length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {conversations.slice(0, 4).map((conv) => (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => handleSelectChat(conv.id)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border text-left transition ${
                      conv.id === activeChatId
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                        : 'bg-[#06162d]/80 hover:bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="text-[11px] truncate">{conv.title}</span>
                    <span className="text-[9px] font-mono text-slate-400 shrink-0">
                      {conv.messages.length} msg
                    </span>
                  </button>
                ))}
              </div>
            ) : (
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
                    <span className="text-[11px] text-slate-200 truncate">
                      {item.label}
                    </span>
                    <span className="text-[9px] font-mono text-cyan-300 shrink-0">
                      {item.tag}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </main>

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
                placeholder="e.g., I am a student in Lahore; use simple English."
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

export default function App() {
  return (
    <JarvisErrorBoundary>
      <JarvisWorkspace />
    </JarvisErrorBoundary>
  );
}
