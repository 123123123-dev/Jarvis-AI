# JARVIS AI

A general-purpose AI assistant with Gemini chat, optional Google Search grounding, Gemini image generation and image edits, voice input and playback, file attachments, conversation history, export, and share tools.

The installable app is branded **JARVIS AI** and uses the supplied launcher icon. New, empty chats show the JARVIS welcome artwork; the regular chat background returns when the conversation starts.

Attach screenshots or files with the paperclip, or paste a copied screenshot with `Ctrl+V`/`⌘+V`. Image and PDF attachments can be previewed in the chat; PDF content is sent to Gemini as a document. Voice dictation requires a supported browser, microphone permission, and a secure HTTPS connection. Image and document analysis requires available Gemini API quota.

## Run locally

1. Install Node.js 24 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to a Google AI Studio API key.
4. For local SQLite storage, leave `SUPABASE_DB_URL` and `DATABASE_URL` empty. For Supabase Postgres, set `SUPABASE_DB_URL` to the database connection URI from the Supabase dashboard.
5. Start the app with `npm run dev` and open `http://localhost:3000`.

Keep `GEMINI_API_KEY`, `SUPABASE_DB_URL`, and `DATABASE_URL` on the server. Do not add them to `VITE_` variables or commit `.env`.

## Deploy to Vercel

The included Vercel configuration serves the Vite frontend and routes `/api/*` to the Express API. Vercel's function filesystem is temporary, so account registration and saved conversations require a persistent Supabase Postgres database; the database tables are created automatically on first request. Guest AI chat and the health check do not require the database.

For current weather, ask for the temperature or weather in a city or place (for example, “What is the temperature in Tokyo?”). JARVIS looks up the place globally and retrieves current conditions from Open-Meteo, with Celsius by default and Fahrenheit when requested. General questions use Gemini's optional Google Search grounding. The app does not automatically access every third-party app; each app integration requires a specific supported service and the user's authorization.

Image generation uses Gemini's `gemini-nano-banana-2.1` image model through the Gemini API. Use the **JARVIS Art** model, or start a prompt with a specific request such as “create image of a red Civic”, “generate a photorealistic picture of a car”, “draw a comic-style robot”, or “paint a watercolor landscape”. Attach a reference image and ask for a safe edit (for example, “make this a watercolor illustration”) to generate an edited image. Image generation has a separate Google AI quota from text chat; if Google reports zero image-model quota on the Free Tier, enable billing or upgrade the Google AI plan for the project behind `GEMINI_API_KEY`. Google model availability and safety filters still apply; the app does not bypass provider safeguards or support explicit sexual imagery or sexualized edits of people. For image generation, the Vercel function is configured for up to 60 seconds; actual maximum duration depends on the Vercel plan.

1. In Supabase, open **Project Settings → Database → Connection string → URI** and copy the connection URI. For Vercel, use Supabase's **Transaction pooler** URI when available. Put your database password in the URI; URL-encode special characters in the password.
2. In Vercel, open the project **Settings → Environment Variables** and add `SUPABASE_DB_URL` with the URI as its value for **Production** (and Preview if desired). Do not use a `VITE_` prefix. The server also recognizes `SUPABASE_DATABASE_URL`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `DATABASE_URL`, and `POSTGRES_URL_NON_POOLING`.
3. Set `GEMINI_API_KEY` to a Google AI Studio API key in Vercel's environment variables.
4. Save the variables and redeploy the latest `main` commit. The app uses Supabase Postgres directly (not Supabase Auth) for its existing account/password/session system and saved chats; it creates the required tables on first database request.
5. Verify `https://your-domain/api/health` reports `"databaseConfigured":true`, `"databaseReady":true`, and a non-null `"databaseVariable"` (this reports only the variable name, never its secret value). Then test account registration and sign-in. If the variable is null, add it to the correct Vercel project and Production environment, save, and redeploy. If configured but not ready, check Supabase's connection string/password, pooler selection, database permissions, and Vercel function logs.
6. For Google Search indexing, add the deployed URL as a URL-prefix property in Google Search Console and submit `/sitemap.xml`. Indexing and ranking are controlled by Google and are not guaranteed.

Never commit database URLs, API keys, or `.env` files.

Local accounts use SQLite by default. Set `JARVIS_DATABASE_PATH` to a persistent writable path when using SQLite on a host with persistent storage. On Vercel, use `SUPABASE_DB_URL` or the generic `DATABASE_URL` fallback so accounts and conversations survive server replacement. Password reset and email verification are not configured.

## Build and checks

- `npm run lint` runs the TypeScript check.
- `npm run build` builds the frontend and server.
- `npm start` starts the production server after building.

Every full app reload and ordinary new tab starts as a fresh guest session. Guest conversations are kept only in memory and are never saved; refresh or close the tab to discard them. Signed-in conversations are saved to the account and can be restored by signing in again.

Each successful sign-in creates a random reusable direct sign-in URL, shown in the sidebar. Opening it signs in directly and restores the account conversations; ordinary new tabs remain guests. The link contains no account ID or email, but anyone with the URL can access the account and its chats until the account signs out or signs in again, which rotates the link. Treat it like a password and share it only with people you trust. Refreshing a signed-in tab returns to guest mode. Opening an HTML export loads JARVIS in a signed-out session and imports that conversation so you can continue chatting; use the new-tab fallback if the browser blocks the embedded app. The archive also includes an offline transcript. Guest conversations are not saved after closing or refreshing the app. The app needs an internet connection and a valid server-side AI key for responses. Without a configured key, chat returns a setup error instead of presenting generated placeholder text as an AI answer.