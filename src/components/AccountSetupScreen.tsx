import React, { useState } from 'react';
import { ShieldCheck, User, ArrowRight, Lock, CheckCircle2, BellRing } from 'lucide-react';
import { notificationEngine } from '../utils/notificationEngine';
import { ringEngine } from '../utils/audioRingEngine';

interface AccountSetupScreenProps { onCompleteSetup: (name: string) => void; }

export const AccountSetupScreen: React.FC<AccountSetupScreenProps> = ({ onCompleteSetup }) => {
  const [nameInput, setNameInput] = useState('');
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    setIsSubmitting(true);
    ringEngine.unlockAudio();
    if (enableNotifications) {
      try { await notificationEngine.requestNotificationPermission(); }
      catch (err) { console.warn('Notification permission error:', err); }
    }
    onCompleteSetup(nameInput.trim());
  };

  return <div id="account-setup-view" className="min-h-screen bg-[#09090b] text-zinc-100 flex items-center justify-center p-4 relative overflow-hidden">
    <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
    <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-600/15 rounded-full blur-3xl pointer-events-none" />
    <div className="w-full max-w-md bg-[#121216] border border-zinc-800/90 rounded-3xl p-8 shadow-2xl shadow-black/80 relative z-10">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="p-3.5 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-2xl mb-4"><ShieldCheck className="w-8 h-8 text-white" /></div>
        <div className="flex items-center gap-2 mb-2"><h1 className="text-2xl font-extrabold text-white">Talk</h1><span className="px-2 py-0.5 bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-xs font-mono rounded-md">E2EE</span></div>
        <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">Temporary voice, video and chat testing. No permanent Talk account is created.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="user-name-input" className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">What is your name?</label>
          <div className="relative"><User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400"/><input id="user-name-input" type="text" required autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Enter a temporary name..." className="w-full bg-[#0c0c0e] border border-zinc-700/80 focus:border-emerald-500 rounded-2xl pl-12 pr-4 py-3.5 text-base text-white placeholder-zinc-500 focus:outline-none"/></div>
          <p className="text-[11px] text-zinc-500 mt-2">People who are online right now will see this name.</p>
        </div>
        <label className="flex items-start gap-3 p-3.5 bg-[#0c0c0e] border border-teal-500/30 rounded-2xl cursor-pointer">
          <input type="checkbox" checked={enableNotifications} onChange={e => setEnableNotifications(e.target.checked)} className="mt-1 w-4 h-4 rounded accent-emerald-500"/>
          <div className="text-xs text-zinc-300"><span className="font-bold text-emerald-300 flex items-center gap-1.5 mb-0.5"><BellRing className="w-3.5 h-3.5"/>Allow call ringing</span><span className="text-[11px] text-zinc-400">Lets the browser play an incoming-call alert.</span></div>
        </label>
        <div className="p-3.5 bg-[#0c0c0e] border border-zinc-800 rounded-2xl text-xs text-zinc-400"><span className="text-zinc-200 font-semibold block mb-0.5">Temporary session</span>Your name is kept only for this test session and is removed when you leave the page. There are no saved contacts.</div>
        <button id="submit-name-account-btn" type="submit" disabled={!nameInput.trim() || isSubmitting} className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2"><span>Start Testing</span><ArrowRight className="w-4 h-4"/></button>
      </form>
      <div className="mt-8 pt-6 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500"><span className="flex items-center gap-1"><Lock className="w-3.5 h-3.5 text-emerald-400"/>WebRTC</span><span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400"/>Temporary</span><span>Slack Chat</span></div>
    </div>
  </div>;
};
