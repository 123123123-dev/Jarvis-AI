# JARVIS AI

A general-purpose AI assistant with Gemini chat, optional Google Search grounding, AI image generation, voice input and playback, file attachments, conversation history, export, and share tools.

## Run locally

1. Install Node.js 24 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to a Google AI Studio API key.
4. For local SQLite storage, leave `DATABASE_URL` empty. To use Neon locally, set it to your Neon connection string.
5. Start the app with `npm run dev` and open `http://localhost:3000`.

Keep `GEMINI_API_KEY` and `DATABASE_URL` on the server. Do not add them to `VITE_` variables or commit `.env`.

## Deploy to Vercel

The included Vercel configuration serves the Vite frontend and routes `/api/*` to the Express API. Vercel's function filesystem is temporary, so Vercel deployments require a Neon Postgres database; the database tables are created automatically on first request.

1. Import this GitHub repository into Vercel and use the repository root.
2. Connect a Neon database to the Vercel project and set `DATABASE_URL` to its pooled connection string.
3. Set `GEMINI_API_KEY` to a Google AI Studio API key in Vercel's environment variables.
4. Redeploy after setting both secrets, then verify `https://your-domain/api/health` reports `"status":"ok"` and `"aiConfigured":true`.
5. For Google Search indexing, add the deployed URL as a URL-prefix property in Google Search Console and submit `/sitemap.xml`. Indexing and ranking are controlled by Google and are not guaranteed.

Never commit database URLs, API keys, or `.env` files.

Local accounts use SQLite by default. Set `JARVIS_DATABASE_PATH` to a persistent writable path when using SQLite on a host with persistent storage. Vercel requires Neon so accounts and conversations survive server replacement. Password reset and email verification are not configured.

## Build and checks

- `npm run lint` runs the TypeScript check.
- `npm run build` builds the frontend and server.
- `npm start` starts the production server after building.

Every full app reload and ordinary new tab starts as a fresh guest session. Guest conversations are kept only in memory and are never saved; refresh or close the tab to discard them. Signed-in conversations are saved to the account and can be restored by signing in again.

Each successful sign-in creates a random reusable direct sign-in URL, shown in the signed-in banner. Opening it signs in directly and restores the account conversations; ordinary new tabs remain guests. The link contains no account ID or email, but anyone with the URL can access the account and its chats until the account signs out or signs in again, which rotates the link. Treat it like a password and share it only with people you trust. Refreshing a signed-in tab returns it to guest mode. The app needs an internet connection and a valid server-side AI key for responses. Without a configured key, chat returns a setup error instead of presenting generated placeholder text as an AI answer.