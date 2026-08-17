import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Volume2, ShieldCheck, X, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { notificationEngine } from '../utils/notificationEngine';
import { ringEngine } from '../utils/audioRingEngine';

interface WhatsAppNotificationBannerProps {
  onTriggerTestCall?: () => void;
}

export const WhatsAppNotificationBanner: React.FC<WhatsAppNotificationBannerProps> = ({
  onTriggerTestCall,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDismissed, setIsDismissed] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    const res = await notificationEngine.requestNotificationPermission();
    setPermission(res);
  };

  const handleTestRing = () => {
    setIsTesting(true);
    ringEngine.unlockAudio();
    if (onTriggerTestCall) {
      onTriggerTestCall();
    } else {
      ringEngine.previewRingtone('modern');
    }
    setTimeout(() => setIsTesting(false), 3000);
  };

  // If dismissed and permission is granted, we can hide the big banner and keep a subtle badge
  if (isDismissed && permission === 'granted') {
    return null;
  }

  // 1. Granted Banner (Compact status & quick test ring button)
  if (permission === 'granted') {
    return (
      <div 
        id="whatsapp-notification-granted-bar"
        className="w-full bg-[#0a1f18] border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between gap-3 text-xs text-emerald-300 animate-fade-in"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 bg-emerald-500/20 rounded-lg text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-emerald-200">
            WhatsApp-Style Telephony Ringing & Notifications are Active
          </span>
          <span className="hidden md:inline text-emerald-400/80 text-[11px]">
            — Your device will ring with sound even if Talk is in background
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="whatsapp-banner-test-btn"
            onClick={handleTestRing}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Simulate incoming call to test ringtone and notification"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isTesting ? 'Ringing...' : 'Test WhatsApp Ring'}</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="text-emerald-400/60 hover:text-emerald-300 p-1 cursor-pointer"
            title="Hide banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Denied Banner (Helper on how to unblock)
  if (permission === 'denied') {
    if (isDismissed) return null;
    return (
      <div 
        id="whatsapp-notification-denied-bar"
        className="w-full bg-[#201012] border-b border-red-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-red-200 animate-fade-in"
      >
        <div className="flex items-center gap-2">
          <div className="p-1 bg-red-500/20 rounded-lg text-red-400">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-red-300">Desktop Notifications Blocked</span>
            <p className="text-[11px] text-red-300/80 hidden sm:block">
              Click the site settings/tune icon in your browser address bar to allow notifications so you hear incoming calls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleTestRing}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px] font-medium transition-all cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test In-App Audio</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="text-red-400 hover:text-red-200 p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 3. Default / Prompting Banner (Classic WhatsApp Web Style Teal Banner)
  if (isDismissed) return null;

  return (
    <div 
      id="whatsapp-notification-prompt-bar"
      className="w-full bg-gradient-to-r from-[#005c4b] via-[#0b6555] to-[#128c7e] border-b border-teal-400/30 px-4 py-3 text-white shadow-lg relative z-20 animate-fade-in"
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-md text-teal-100 shadow-inner ring-1 ring-white/20 animate-bounce shrink-0">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-tight">
                Turn on WhatsApp-style Desktop Notifications & Audio Ringing
              </h4>
              <span className="px-1.5 py-0.2 bg-teal-900/60 text-teal-200 text-[10px] font-mono rounded font-medium">
                Recommended
              </span>
            </div>
            <p className="text-xs text-teal-100/90 leading-snug mt-0.5">
              Allow notification permission so your browser rings with audio and alerts you when someone calls you on Talk.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            id="enable-whatsapp-notifications-btn"
            onClick={handleRequestPermission}
            className="px-4 py-2 bg-white hover:bg-teal-50 text-teal-900 rounded-xl text-xs font-extrabold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-teal-700" />
            <span>Enable Notifications</span>
          </button>

          <button
            id="test-whatsapp-ring-prompt-btn"
            onClick={handleTestRing}
            className="px-3 py-2 bg-teal-900/40 hover:bg-teal-900/60 border border-teal-300/30 text-white rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
            title="Preview ringtone sound"
          >
            <Play className="w-3 h-3 text-teal-200" />
            <span>Test Sound</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="text-teal-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
