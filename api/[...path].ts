import type { Express, Request, Response } from 'express';

let appPromise: Promise<Express> | undefined;

function loadApp(): Promise<Express> {
  appPromise ??= import('../server')
    .then(({ default: app }) => app)
    .catch((error: unknown) => {
      appPromise = undefined;
      throw error;
    });
  return appPromise;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  try {
    const app = await loadApp();
    app(req, res);
  } catch (error) {
    console.error('JARVIS API function failed to initialize:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'The JARVIS API failed to initialize. Check Vercel Runtime Logs.',
        code: 'API_INITIALIZATION_FAILED',
      });
    }
  }
}
