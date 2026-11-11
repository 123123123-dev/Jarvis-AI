import React, { useEffect, useState } from 'react';
import { LogOut, X, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthResponse {
  user: UserProfile;
  token: string;
}

function isAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  const user = response.user;
  if (!user || typeof user !== 'object') return false;
  const account = user as Record<string, unknown>;

  return (
    typeof response.token === 'string' &&
    Boolean(response.token) &&
    typeof account.id === 'string' &&
    typeof account.name === 'string' &&
    typeof account.email === 'string' &&
    account.isGuest === false
  );
}

async function readAuthResponse(response: Response): Promise<AuthResponse> {
  const body = await response.text();
  let data: unknown;

  if (body.trim()) {
    try {
      data = JSON.parse(body);
    } catch {
      if (!response.ok) throw new Error(`Account request failed (${response.status}).`);
      throw new Error('The server returned an invalid account response. Please try again.');
    }
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `Account request failed (${response.status}).`;
    throw new Error(errorMessage);
  }

  if (!isAuthResponse(data)) {
    throw new Error('The server returned an incomplete account response. Please try again.');
  }
  return data;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onAuthenticated: (user: UserProfile, token: string) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthenticated,
  onSignOut,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode('login');
    setName('');
    setEmail('');
    setPassword('');
    setError('');
  }, [isOpen]);

  if (!isOpen) return null;

  const clearForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setError('');
  };

  const handleClose = () => {
    clearForm();
    setMode('login');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode === 'register' ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await readAuthResponse(response);
      clearForm();
      await onAuthenticated(data.user, data.token);
      handleClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Account request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      await onSignOut();
      handleClose();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Sign out failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#09101d] border border-cyan-500/30 p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Your Account
            </h3>
            <p className="text-xs text-slate-400">
              {currentUser.isGuest ? 'Sign in or create an account' : 'Signed in securely'}
            </p>
          </div>
        </div>

        {!currentUser.isGuest && (
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/70 p-3 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-300">Your conversations are saved to this account.</span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        )}

        <div className="flex gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => { setMode('login'); clearForm(); }}
            className={`flex-1 rounded-md py-2 text-xs font-semibold ${mode === 'login' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); clearForm(); }}
            className={`flex-1 rounded-md py-2 text-xs font-semibold ${mode === 'register' ? 'bg-cyan-950 text-cyan-300' : 'text-slate-400 hover:text-white'}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3">
          {mode === 'register' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={80}
                autoComplete="off"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                placeholder="Your name"
              />
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="jarvis-account-email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onFocus={(event) => event.currentTarget.removeAttribute('readonly')}
              required
              maxLength={254}
              readOnly
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              name="jarvis-account-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={(event) => event.currentTarget.removeAttribute('readonly')}
              required
              minLength={mode === 'register' ? 12 : undefined}
              maxLength={128}
              readOnly
              autoComplete="new-password"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              placeholder={mode === 'register' ? 'At least 12 characters' : 'Your password'}
            />
          </div>

          {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
          >
            {isSubmitting ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
          {mode === 'register' && (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Passwords must be at least 12 characters. Email verification and password recovery are not configured.
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
