import express, { type NextFunction, type Request, type Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import postgres from 'postgres';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.set('trust proxy', 1);

// Body parsers with increased limits for multi-file attachments (up to 10 files)
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Initialize GoogleGenAI SDK with server-side API key
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey: apiKey || 'AIzaSyPlaceholderKeyForBuild',
});

const databaseUrlEnvironmentVariable = [
  'SUPABASE_DB_URL',
  'SUPABASE_DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL',
  'POSTGRES_URL_NON_POOLING',
].find((name) => process.env[name]);
const databaseUrl = databaseUrlEnvironmentVariable
  ? process.env[databaseUrlEnvironmentVariable]
  : undefined;
const postgresDatabase = databaseUrl
  ? postgres(databaseUrl, { ssl: 'require', max: 1, idle_timeout: 20, prepare: false })
  : undefined;
let sqliteDatabase: DatabaseSync | undefined;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS direct_sign_in_links (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL,
    used_at BIGINT
  )`,
  `CREATE TABLE IF NOT EXISTS conversations (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,
    updated_at BIGINT NOT NULL,
    payload TEXT NOT NULL,
    PRIMARY KEY (user_id, conversation_id)
  )`,
];

type DatabaseParameter = SQLInputValue;

function postgresStatement(statement: string): string {
  let parameterIndex = 0;
  return statement.replace(/\?/g, () => `$${++parameterIndex}`);
}

async function databaseGet<T>(
  statement: string,
  ...parameters: DatabaseParameter[]
): Promise<T | undefined> {
  if (postgresDatabase) {
    const rows = await postgresDatabase.unsafe(postgresStatement(statement), parameters);
    return rows[0] as T | undefined;
  }
  if (!sqliteDatabase) throw new Error('SUPABASE_DB_URL or DATABASE_URL is required for Vercel deployments.');
  return sqliteDatabase.prepare(statement).get(...parameters) as T | undefined;
}

async function databaseAll<T>(
  statement: string,
  ...parameters: DatabaseParameter[]
): Promise<T[]> {
  if (postgresDatabase) {
    const rows = await postgresDatabase.unsafe(postgresStatement(statement), parameters);
    return rows as unknown as T[];
  }
  if (!sqliteDatabase) throw new Error('SUPABASE_DB_URL or DATABASE_URL is required for Vercel deployments.');
  return sqliteDatabase.prepare(statement).all(...parameters) as T[];
}

async function databaseRun(
  statement: string,
  ...parameters: DatabaseParameter[]
): Promise<void> {
  if (postgresDatabase) {
    await postgresDatabase.unsafe(postgresStatement(statement), parameters);
    return;
  }
  if (!sqliteDatabase) throw new Error('SUPABASE_DB_URL or DATABASE_URL is required for Vercel deployments.');
  sqliteDatabase.prepare(statement).run(...parameters);
}

async function databaseTransaction(
  action: (run: typeof databaseRun) => Promise<void>,
): Promise<void> {
  if (postgresDatabase) {
    await postgresDatabase.begin(async (transaction) => {
      await action(async (statement, ...parameters) => {
        await transaction.unsafe(postgresStatement(statement), parameters);
      });
    });
    return;
  }
  if (!sqliteDatabase) throw new Error('SUPABASE_DB_URL or DATABASE_URL is required for Vercel deployments.');

  sqliteDatabase.exec('BEGIN');
  try {
    await action(databaseRun);
    sqliteDatabase.exec('COMMIT');
  } catch (error) {
    sqliteDatabase.exec('ROLLBACK');
    throw error;
  }
}

async function initializeDatabase(): Promise<void> {
  if (postgresDatabase) {
    for (const statement of schemaStatements) {
      await postgresDatabase.unsafe(statement);
    }
  } else if (!process.env.VERCEL) {
    const { DatabaseSync: SQLiteDatabase } = await import('node:sqlite');
    const databasePath = process.env.JARVIS_DATABASE_PATH || path.resolve('data/jarvis.sqlite');
    mkdirSync(path.dirname(databasePath), { recursive: true });
    sqliteDatabase = new SQLiteDatabase(databasePath);
    sqliteDatabase.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    for (const statement of schemaStatements) sqliteDatabase.exec(statement);
  }
}

const databaseReady = initializeDatabase();

interface AccountRecord {
  id: string;
  name: string;
  email: string;
  password_salt: string;
  password_hash: string;
}

interface PublicAccount {
  id: string;
  name: string;
  email: string;
  isGuest: false;
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const DIRECT_LINK_EXPIRY = Number.MAX_SAFE_INTEGER;
const authAttempts = new Map<string, { count: number; resetAt: number }>();

app.use(['/api/auth', '/api/conversations'], async (_req, res, next) => {
  try {
    if (!postgresDatabase && !sqliteDatabase) {
      throw new Error('A supported Postgres connection string is required for Vercel account storage.');
    }
    await databaseReady;
    next();
  } catch (error) {
    console.error('Database initialization failed:', (error as Error).message);
    const message = databaseUrl
      ? 'The configured database could not be reached or initialized. Check the Supabase connection string, password, and database permissions.'
      : 'No database connection variable was found. Set SUPABASE_DB_URL in Vercel Production and redeploy.';
    res.status(503).json({ error: message });
  }
});

function publicAccount(account: AccountRecord): PublicAccount {
  return { id: account.id, name: account.name, email: account.email, isGuest: false };
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function createAccountSession(account: AccountRecord): Promise<{ user: PublicAccount; token: string }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  await databaseRun(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    hashToken(token),
    account.id,
    expiresAt,
  );
  return { user: publicAccount(account), token };
}

async function accountFromRequest(req: Request): Promise<AccountRecord | undefined> {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return undefined;

  const session = await databaseGet<{ user_id: string }>(
    'SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?',
    hashToken(token),
    Date.now(),
  );
  if (!session) return undefined;

  return databaseGet<AccountRecord>(
    'SELECT id, name, email, password_salt, password_hash FROM users WHERE id = ?',
    session.user_id,
  );
}

async function requireAccount(req: Request, res: Response): Promise<AccountRecord | undefined> {
  const account = await accountFromRequest(req);
  if (!account) res.status(401).json({ error: 'Please sign in to access this account.' });
  return account;
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<unknown>): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

function limitAuthAttempts(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const attempt = authAttempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 10) {
    return res.status(429).json({ error: 'Too many account attempts. Please wait and try again.' });
  }
  authAttempts.set(key, {
    count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1,
    resetAt: attempt && attempt.resetAt > now ? attempt.resetAt : now + 15 * 60 * 1000,
  });
  next();
}

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  const databaseConfigured = Boolean(postgresDatabase || sqliteDatabase);
  let databaseIsReady = Boolean(sqliteDatabase);
  if (postgresDatabase) {
    try {
      await databaseReady;
      databaseIsReady = true;
    } catch (error) {
      console.error('Database health check failed:', (error as Error).message);
    }
  }

  res.json({
    status: databaseConfigured && databaseIsReady ? 'ok' : 'degraded',
    service: 'JARVIS AI Engine',
    aiConfigured: Boolean(apiKey && !apiKey.includes('Placeholder')),
    databaseConfigured,
    databaseReady: databaseIsReady,
    databaseVariable: databaseUrlEnvironmentVariable || null,
    time: new Date().toISOString(),
  });
});

app.post('/api/auth/register', limitAuthAttempts, asyncRoute(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!name || name.length > 80) {
    return res.status(400).json({ error: 'Name must be between 1 and 80 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  if (password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 12 and 128 characters.' });
  }

  const id = randomUUID();
  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(password, salt, 64).toString('hex');
  try {
    await databaseRun(
      'INSERT INTO users (id, name, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      name,
      email,
      salt,
      passwordHash,
      Date.now(),
    );
    const account = await databaseGet<AccountRecord>(
      'SELECT id, name, email, password_salt, password_hash FROM users WHERE id = ?',
      id,
    );
    if (!account) throw new Error('Registered account could not be loaded.');
    return res.status(201).json(await createAccountSession(account));
  } catch (error) {
    if (
      `${(error as Error).message}`.includes('UNIQUE constraint failed') ||
      (error as { code?: string }).code === '23505'
    ) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('Account registration failed:', (error as Error).message);
    return res.status(500).json({ error: 'Account registration failed. Please try again.' });
  }
}));

app.post('/api/auth/login', limitAuthAttempts, asyncRoute(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const account = await databaseGet<AccountRecord>(
    'SELECT id, name, email, password_salt, password_hash FROM users WHERE email = ?',
    email,
  );
  const candidateHash = scryptSync(password, account?.password_salt || 'jarvis-invalid-account-salt', 64);
  const expectedHash = account ? Buffer.from(account.password_hash, 'hex') : Buffer.alloc(64);

  if (!account || !timingSafeEqual(candidateHash, expectedHash)) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }

  return res.json(await createAccountSession(account));
}));

app.post('/api/auth/direct-link', asyncRoute(async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;

  const token = randomBytes(32).toString('hex');
  const now = Date.now();
  await databaseRun(
    'DELETE FROM direct_sign_in_links WHERE user_id = ? OR expires_at <= ? OR used_at IS NOT NULL',
    account.id,
    now,
  );
  await databaseRun(
    'INSERT INTO direct_sign_in_links (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    hashToken(token),
    account.id,
    DIRECT_LINK_EXPIRY,
  );
  return res.json({ token });
}));

app.post('/api/auth/redeem-link', asyncRoute(async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(401).json({ error: 'This sign-in link is invalid, expired, or already used.' });
  }

  const now = Date.now();
  const link = await databaseGet<{ user_id: string }>(
    'SELECT user_id FROM direct_sign_in_links WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?',
    hashToken(token),
    now,
  );
  if (!link) {
    return res.status(401).json({ error: 'This sign-in link is invalid, expired, or already used.' });
  }

  const account = await databaseGet<AccountRecord>(
    'SELECT id, name, email, password_salt, password_hash FROM users WHERE id = ?',
    link.user_id,
  );
  if (!account) return res.status(401).json({ error: 'This sign-in link is invalid, expired, or already used.' });
  return res.json(await createAccountSession(account));
}));

app.get('/api/auth/me', asyncRoute(async (req, res) => {
  const account = await accountFromRequest(req);
  return res.json({ user: account ? publicAccount(account) : null });
}));

app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (token) {
    const account = await accountFromRequest(req);
    await databaseRun('DELETE FROM sessions WHERE token_hash = ?', hashToken(token));
    if (account) {
      await databaseRun('DELETE FROM direct_sign_in_links WHERE user_id = ?', account.id);
    }
  }
  return res.json({ success: true });
}));

app.get('/api/conversations', asyncRoute(async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const rows = await databaseAll<{ payload: string }>(
    'SELECT payload FROM conversations WHERE user_id = ? ORDER BY updated_at DESC',
    account.id,
  );
  return res.json({ conversations: rows.map((row) => JSON.parse(row.payload)) });
}));

app.put('/api/conversations', asyncRoute(async (req, res) => {
  const account = await requireAccount(req, res);
  if (!account) return;
  const conversations = req.body?.conversations;
  if (!Array.isArray(conversations) || conversations.length > 500) {
    return res.status(400).json({ error: 'Conversation data is invalid or exceeds the account limit.' });
  }

  const serializedConversations: Array<{ id: string; updatedAt: number; payload: string }> = [];
  for (const conversation of conversations) {
    if (!conversation || typeof conversation.id !== 'string' || conversation.id.length > 200) {
      return res.status(400).json({ error: 'Conversation data contains an invalid entry.' });
    }
    serializedConversations.push({
      id: conversation.id,
      updatedAt: Number.isFinite(conversation.updatedAt) ? conversation.updatedAt : Date.now(),
      payload: JSON.stringify(conversation),
    });
  }

  if (serializedConversations.reduce((total, item) => total + item.payload.length, 0) > 50_000_000) {
    return res.status(413).json({ error: 'Conversation history exceeds the account storage limit.' });
  }

  await databaseTransaction(async (run) => {
    await run('DELETE FROM conversations WHERE user_id = ?', account.id);
    for (const conversation of serializedConversations) {
      await run(
        'INSERT INTO conversations (user_id, conversation_id, updated_at, payload) VALUES (?, ?, ?, ?)',
        account.id,
        conversation.id,
        conversation.updatedAt,
        conversation.payload,
      );
    }
  });
  return res.json({ success: true });
}));

// Helper to determine if a prompt is an image generation request
function isImagePrompt(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return (
    lower.startsWith('generate image') ||
    lower.startsWith('create image') ||
    lower.startsWith('generate artwork') ||
    lower.startsWith('draw ') ||
    lower.startsWith('paint ') ||
    lower.startsWith('/image') ||
    lower.startsWith('make an image of')
  );
}

// Generate AI artwork endpoint
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1' } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!apiKey || apiKey.includes('Placeholder')) {
      return res.status(503).json({
        error: 'AI image generation is not configured. Set GEMINI_API_KEY in the server environment.',
      });
    }

    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: (aspectRatio as '1:1' | '3:4' | '4:3' | '9:16' | '16:9') || '1:1',
      },
    });

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      return res.status(502).json({ error: 'The image provider returned no image. Please try again.' });
    }

    return res.json({
      success: true,
      imageUrl: `data:image/jpeg;base64,${imageBytes}`,
      prompt,
      engine: 'Imagen 3',
    });
  } catch (error) {
    const message = `${(error as Error).message || ''}`;
    const isQuotaError = message.includes('429') || message.includes('quota');
    const isTimeout = message.toLowerCase().includes('timeout') || message.toLowerCase().includes('aborted');
    console.error('JARVIS image request failed:', message.slice(0, 300));
    return res.status(isQuotaError ? 429 : isTimeout ? 504 : 502).json({
      error: isQuotaError
        ? 'The AI provider quota is temporarily unavailable. Please try again later.'
        : isTimeout
          ? 'The image provider timed out. Check provider availability and try again.'
        : 'The AI provider could not generate this image. Please try again.',
    });
  }
});

// Chat completion with Google Search Grounding and Multi-file attachments
app.post('/api/chat', async (req, res) => {
  let latestText = '';
  let currentAttachments: unknown[] = [];
  let reqMessages: Array<{ role: string; content: string }> = [];
  let isWebSearch = true;

  try {
    const {
      messages = [],
      webSearch = true,
      model = 'gemini-3.8-flash',
      attachments = [],
    } = req.body;

    reqMessages = messages;
    isWebSearch = webSearch;
    currentAttachments = attachments;

    if (!messages.length) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const latestMessage = messages[messages.length - 1];
    latestText = latestMessage?.content || '';

    // If latest message is a pure image generation request, auto-route to image synthesis
    if (isImagePrompt(latestText)) {
      const promptClean = latestText
        .replace(/^(generate image of|create image of|generate artwork of|draw|paint|\/image|make an image of)\s*/i, '')
        .trim();

      if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('Placeholder')) {
        try {
          const imageRes = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: promptClean || latestText,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/jpeg',
              aspectRatio: '1:1',
            },
          });

          const imageBytes = imageRes.generatedImages?.[0]?.image?.imageBytes;
          if (imageBytes) {
            const imageUrl = `data:image/jpeg;base64,${imageBytes}`;
            return res.json({
              role: 'assistant',
              content: `Here is the artwork generated for **"${promptClean || latestText}"**:\n\n![${promptClean || 'Generated Artwork'}](${imageUrl})\n\n*Artwork synthesized using JARVIS AI Creative Studio (Imagen 3).*`,
              imageUrl,
              grounding: [],
            });
          }
        } catch (imgError) {
          const message = `${(imgError as Error).message || ''}`;
          const isQuotaError = message.includes('429') || message.includes('quota');
          console.error('JARVIS image request failed:', message.slice(0, 300));
          return res.status(isQuotaError ? 429 : 502).json({
            error: isQuotaError
              ? 'The AI provider quota is temporarily unavailable. Please try again later.'
              : 'The AI provider could not generate this image. Please try again.',
          });
        }
      } else {
        return res.status(503).json({
          error: 'AI image generation is not configured. Set GEMINI_API_KEY in the server environment.',
        });
      }

      return res.status(502).json({ error: 'The image provider returned no image. Please try again.' });
    }

    // Prepare system instruction
    const systemInstruction = `You are JARVIS, a helpful general-purpose AI assistant. Answer the user's actual question directly and accurately. Be clear about uncertainty and never invent facts, sources, or actions. Use concise explanations by default, with structured steps or examples when useful. Analyze any attached files or images in the context of the user's request. If live search is unavailable or the answer may be out of date, say so.`;

    // Map conversation history
    const contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = [];

    // Prior turns (excluding latest)
    for (let i = 0; i < messages.length - 1; i++) {
      const msg = messages[i];
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content || '' }],
      });
    }

    // Latest turn parts: include text + up to 10 attached files
    const latestParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

    // Attach files if any
    if (attachments && Array.isArray(attachments)) {
      for (const file of attachments.slice(0, 10)) {
        if (file.data && file.type) {
          const base64Data = file.data.includes(',')
            ? file.data.split(',')[1]
            : file.data;

          if (file.type.startsWith('image/')) {
            latestParts.push({
              inlineData: {
                mimeType: file.type,
                data: base64Data,
              },
            });
          } else {
            try {
              const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');
              latestParts.push({
                text: `[Attached Document: "${file.name}" (${file.type})]:\n${textContent.slice(0, 15000)}`,
              });
            } catch {
              latestParts.push({
                inlineData: {
                  mimeType: file.type,
                  data: base64Data,
                },
              });
            }
          }
        }
      }
    }

    // Add user's question / instruction
    latestParts.push({
      text: latestText || 'Please review the attached files and provide a detailed breakdown.',
    });

    contents.push({
      role: 'user',
      parts: latestParts,
    });

    // Enable Google Search grounding if webSearch is enabled
    const tools = webSearch ? [{ googleSearch: {} }] : [];

    // Model selection mapping to currently available Gemini API models.
    const selectedModel = model === 'jarvis-pro'
      ? 'gemini-3.1-flash-lite'
      : 'gemini-flash-lite-latest';
    let responseText = '';
    let sources: Array<{ uri: string; title: string }> = [];
    let webSearchQueries: string[] = [];

    if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('Placeholder')) {
      const primaryTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Primary request timeout (10s)')), 10000)
      );

      try {
        const response = await Promise.race([
          ai.models.generateContent({
            model: selectedModel,
            contents,
            config: {
              systemInstruction,
              tools,
            },
          }),
          primaryTimeout,
        ]);

        responseText = response.text || 'I have processed your request, sir.';

        // Extract grounding sources from Google Search
        const groundingChunks =
          response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        webSearchQueries =
          response.candidates?.[0]?.groundingMetadata?.webSearchQueries || [];

        sources = groundingChunks
          .map((chunk: { web?: { uri?: string; title?: string } }) => {
            if (chunk.web?.uri) {
              try {
                const urlHost = new URL(chunk.web.uri).hostname;
                return {
                  uri: chunk.web.uri,
                  title: chunk.web.title || urlHost,
                };
              } catch {
                return {
                  uri: chunk.web.uri,
                  title: chunk.web.title || chunk.web.uri,
                };
              }
            }
            return null;
          })
          .filter(Boolean) as Array<{ uri: string; title: string }>;
      } catch (firstErr) {
        const firstErrStr = `${(firstErr as Error)?.message || ''}`;
        const isQuotaOrTimeout =
          firstErrStr.includes('429') ||
          firstErrStr.includes('RESOURCE_EXHAUSTED') ||
          firstErrStr.includes('quota') ||
          firstErrStr.includes('timeout');

        if (isQuotaOrTimeout && (tools.length > 0 || selectedModel !== 'gemini-flash-lite-latest')) {
          console.log('Search tool or model timeout/quota limit. Retrying with the available flash model without search tools...');
          try {
            const retryTimeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Retry timeout (8s)')), 8000)
            );
            const retryResponse = await Promise.race([
              ai.models.generateContent({
                model: 'gemini-flash-lite-latest',
                contents,
                config: {
                  systemInstruction,
                },
              }),
              retryTimeout,
            ]);
            responseText = retryResponse.text || '';
          } catch {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }
    } else {
      throw new Error('AI service is not configured. Set GEMINI_API_KEY in the server environment.');
    }

    return res.json({
      role: 'assistant',
      content: responseText,
      sources,
      queries: webSearchQueries,
      modelUsed: selectedModel,
      timestamp: Date.now(),
    });
  } catch (error) {
    const errStr =
      typeof error === 'string'
        ? error
        : `${(error as Error)?.message || ''} ${JSON.stringify(error) || ''}`;

    const isQuotaError =
      errStr.includes('429') ||
      errStr.includes('RESOURCE_EXHAUSTED') ||
      errStr.includes('quota');
    const isTimeout = errStr.toLowerCase().includes('timeout') || errStr.toLowerCase().includes('aborted');

    const status = !apiKey || apiKey.includes('Placeholder')
      ? 503
      : isQuotaError
        ? 429
        : isTimeout
          ? 504
          : 502;
    const message = !apiKey || apiKey.includes('Placeholder')
      ? 'AI service is not configured. Set GEMINI_API_KEY in the server environment.'
      : isQuotaError
        ? 'The AI provider reports that this key has no available quota. Enable billing or quota for the selected model, then retry.'
        : isTimeout
          ? 'The AI provider did not respond in time. Check model availability and try again.'
          : 'The AI provider could not complete this request. Please try again.';

    console.error('JARVIS request failed:', errStr.slice(0, 300));
    return res.status(status).json({ error: message });
  }
});

// Serve frontend in production or mount Vite middleware in development
async function startServer() {
  const http = await import('node:http');
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    const staticDirectory = path.basename(__dirname) === 'dist'
      ? __dirname
      : path.resolve(__dirname, 'dist');
    app.use(express.static(staticDirectory));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(staticDirectory, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS AI running on http://0.0.0.0:${PORT}`);
  });
}

app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  console.error('Unhandled request error:', error.message);
  return res.status(500).json({ error: 'Request failed. Please try again.' });
});

export default app;

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  void startServer();
}
