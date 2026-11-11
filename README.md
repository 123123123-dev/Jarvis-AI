# JARVIS AI

A general-purpose AI assistant with Gemini chat, optional Google Search grounding, AI image generation, voice input and playback, file attachments, conversation history, export, and share tools.

## Run locally

1. Install Node.js 24 or newer.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` to a Google AI Studio API key.
4. Start the app with `npm run dev` and open `http://localhost:3000`.

Keep `GEMINI_API_KEY` on the server. Do not add it to a `VITE_` variable or commit `.env`.

Deploy this app to a Node.js host. GitHub Pages is static-only and cannot run the Gemini, registration, or account-history APIs.

Accounts use a local SQLite database. Set `JARVIS_DATABASE_PATH` to a persistent writable path for deployment; without persistent storage, accounts and conversations will not survive server replacement. Password reset and email verification are not configured.

## Build and checks

- `npm run lint` runs the TypeScript check.
- `npm run build` builds the frontend and server.
- `npm start` starts the production server after building.

Every full app reload and ordinary new tab starts as a fresh guest session. Guest conversations are kept only in memory and are never saved; refresh or close the tab to discard them. Signed-in conversations are saved to the account and can be restored by signing in again.

Each successful sign-in creates a random reusable direct sign-in URL, shown in the signed-in banner. Opening it signs in directly and restores the account conversations; ordinary new tabs remain guests. The link contains no account ID or email, but anyone with the URL can access the account and its chats until the account signs out or signs in again, which rotates the link. Treat it like a password and share it only with people you trust. Refreshing a signed-in tab returns it to guest mode. The app needs an internet connection and a valid server-side AI key for responses. Without a configured key, chat returns a setup error instead of presenting generated placeholder text as an AI answer.