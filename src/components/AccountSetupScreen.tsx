import React, { useState } from 'react';
import { ShieldCheck, HardDrive, User, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';
import { UserIdentity } from '../types';
import { googleDriveService } from '../utils/googleDriveSync';

interface AccountSetupScreenProps {
  onCompleteSetup: (name: string) => void;
}

export const AccountSetupScreen: React.FC<AccountSetupScreenProps> = ({ onCompleteSetup }) => {
  const [nameInput, setNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setIsSubmitting(true);
    onCompleteSetup(nameInput.trim());
  };

  return (
    <div id="account-setup-view" className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#121216] border border-zinc-800/90 rounded-3xl p-8 shadow-2xl shadow-black/80 relative z-10">
        {/* App Logo & Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-3.5 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl text-zinc-950 shadow-xl shadow-emerald-950/60 ring-1 ring-emerald-400/30 mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Talk</h1>
            <span className="px-2 py-0.5 bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-mono rounded-md shadow-xs">
              E2EE
            </span>
          </div>
          <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
            Encrypted voice and video calling. Call anyone simply by their name.
          </p>
        </div>

        {/* Name Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="user-name-input" className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              What is your name?
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
              <input
                id="user-name-input"
                type="text"
                required
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name or handle..."
                className="w-full bg-[#0c0c0e] border border-zinc-700/80 focus:border-emerald-500 rounded-2xl pl-12 pr-4 py-3.5 text-base text-white placeholder-zinc-500 focus:outline-none transition-colors shadow-inner font-medium"
              />
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
              People will see this name when you call them or add them as a contact.
            </p>
          </div>

          {/* Drive info card */}
          <div className="p-3.5 bg-[#0c0c0e] border border-zinc-800 rounded-2xl flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-400 leading-snug">
              <span className="text-zinc-200 font-semibold block mb-0.5">Stored in Google Drive JSON</span>
              Your account profile, contacts list, and call logs are saved in a private JSON file in your Google Drive.
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="submit-name-account-btn"
            type="submit"
            disabled={!nameInput.trim() || isSubmitting}
            className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 transition-all duration-200 active:scale-98 cursor-pointer"
          >
            <span>Start Using Talk</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Feature Tags */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>End-to-End Encrypted</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Call by Name</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span>Drive Auto-Sync</span>
          </div>
        </div>
      </div>
    </div>
  );
};
