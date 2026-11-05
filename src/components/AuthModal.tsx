import React, { useState } from 'react';
import { X, User, Check, ShieldCheck, Cloud, Laptop, RefreshCw } from 'lucide-react';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  onSaveUser: (user: UserProfile) => void;
  onTriggerSync: () => void;
  isSyncing: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSaveUser,
  onTriggerSync,
  isSyncing,
}) => {
  const [name, setName] = useState(currentUser.isGuest ? 'Abdullah Waheed' : currentUser.name);
  const [email, setEmail] = useState(currentUser.isGuest ? 'abdullah@lgsparagon.edu.pk' : currentUser.email);
  const [school, setSchool] = useState(currentUser.school || 'LGS Paragon, Lahore');

  if (!isOpen) return null;

  const handleSignInAsAbdullah = () => {
    onSaveUser({
      id: 'abdullah_waheed_lgs',
      name: 'Abdullah Waheed',
      email: 'abdullah@lgsparagon.edu.pk',
      school: 'LGS Paragon, Lahore',
      isGuest: false,
    });
    onClose();
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSaveUser({
      id: `user_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      email: email.trim() || 'user@jarvis.ai',
      school: school.trim(),
      isGuest: false,
    });
    onClose();
  };

  const handleSwitchToGuest = () => {
    onSaveUser({
      id: 'guest_user',
      name: 'Guest User',
      email: 'guest@jarvis.local',
      school: 'LGS Paragon, Lahore',
      isGuest: true,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#09101d] border border-cyan-500/30 p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
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
            <h3 className="text-base font-bold text-white">JARVIS AI Account & Cloud Sync</h3>
            <p className="text-xs text-slate-400">
              Developed by Abdullah Waheed (LGS Paragon, Lahore)
            </p>
          </div>
        </div>

        {/* One-click quick login button as Creator */}
        <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/70 to-slate-900 border border-cyan-500/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-cyan-300">Fast Verified Login</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono">
              Creator Account
            </span>
          </div>
          <p className="text-xs text-slate-300 mb-3">
            Sign in instantly as developer <strong>Abdullah Waheed</strong> to activate full real-time
            cloud synchronization and unlimited multi-device session history.
          </p>
          <button
            type="button"
            onClick={handleSignInAsAbdullah}
            className="w-full py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
          >
            <User className="w-4 h-4" />
            <span>Sign In as Abdullah Waheed (LGS Paragon)</span>
          </button>
        </div>

        <div className="relative my-4 flex items-center justify-center">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-[#09101d] px-3 text-[11px] text-slate-500 uppercase tracking-wider">
            or custom profile
          </span>
        </div>

        {/* Custom Sign In Form */}
        <form onSubmit={handleCustomSubmit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              placeholder="e.g. Abdullah Waheed"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              placeholder="e.g. user@lgsparagon.edu.pk"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Institution / School
            </label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
              placeholder="LGS Paragon, Lahore"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition border border-slate-700 cursor-pointer"
            >
              Save Profile & Enable Sync
            </button>
            {!currentUser.isGuest && (
              <button
                type="button"
                onClick={handleSwitchToGuest}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-300 text-xs transition border border-slate-800 cursor-pointer"
              >
                Guest Mode
              </button>
            )}
          </div>
        </form>

        {/* Sync trigger button if already signed in */}
        {!currentUser.isGuest && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Cloud className="w-4 h-4" />
              <span>Real-Time Cloud Sync Active</span>
            </div>
            <button
              type="button"
              onClick={onTriggerSync}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-300 text-xs cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
