import React, { useState, useEffect } from 'react';
import { 
  Settings, Volume2, Bell, Smartphone, Laptop, Shield, User, Play, Square, 
  Mic, Video, Check, Sparkles, X, RefreshCw 
} from 'lucide-react';
import { RingtoneConfig, UserIdentity } from '../types';
import { ringEngine } from '../utils/audioRingEngine';
import { mediaManager } from '../utils/webrtcManager';

interface DeviceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ringtoneConfig: RingtoneConfig;
  onSaveRingtoneConfig: (config: RingtoneConfig) => void;
  currentIdentity: UserIdentity;
  onSwitchIdentity: (newIdentity: UserIdentity) => void;
}

export const PRESET_TEST_IDENTITIES: UserIdentity[] = [
  {
    id: 'user_alice_dev',
    name: 'Alice Chen (You)',
    email: 'alice.chen@ciphercall.io',
    phone: '+1 (555) 234-8901',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    deviceId: 'device_macbook_pro',
    deviceName: 'MacBook Pro 16" (Desk)',
    publicKeyFingerprint: '4E9A B7C2 91F0 33DA 8201',
  },
  {
    id: 'user_marcus_vance',
    name: 'Marcus Vance (Tab 2 Test)',
    email: 'marcus.v@hyperstream.dev',
    phone: '+1 (555) 712-9903',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    deviceId: 'device_iphone_15',
    deviceName: 'iPhone 15 Pro (Mobile)',
    publicKeyFingerprint: '18FB 99C4 D21A 7731 44B9',
  },
  {
    id: 'user_elena_rostova',
    name: 'Dr. Elena Rostova (Test Profile)',
    email: 'elena.r@quantumsecure.org',
    phone: '+1 (555) 389-4029',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    deviceId: 'device_ipad_pro',
    deviceName: 'iPad Pro 13" (Tablet)',
    publicKeyFingerprint: '99DA F102 77B4 4920 18EA',
  },
];

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  isOpen,
  onClose,
  ringtoneConfig,
  onSaveRingtoneConfig,
  currentIdentity,
  onSwitchIdentity,
}) => {
  const [activeRingtone, setActiveRingtone] = useState(ringtoneConfig.ringtoneType);
  const [volume, setVolume] = useState(ringtoneConfig.volume * 100);
  const [isPlayingTestRing, setIsPlayingTestRing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  useEffect(() => {
    let animId: number;
    if (isOpen) {
      const pollVolume = () => {
        const vol = mediaManager.getAudioVolume();
        setMicLevel(vol);
        animId = requestAnimationFrame(pollVolume);
      };
      animId = requestAnimationFrame(pollVolume);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
      ringEngine.stopAll();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestRingtone = (type: RingtoneConfig['ringtoneType']) => {
    setIsPlayingTestRing(true);
    ringEngine.setVolume(volume / 100);
    ringEngine.previewRingtone(type);
    setTimeout(() => {
      setIsPlayingTestRing(false);
    }, 2800);
  };

  const handleStopRingtone = () => {
    ringEngine.stopAll();
    setIsPlayingTestRing(false);
  };

  const handleSaveSettings = () => {
    ringEngine.setRingtone(activeRingtone);
    ringEngine.setVolume(volume / 100);
    onSaveRingtoneConfig({
      ...ringtoneConfig,
      ringtoneType: activeRingtone,
      volume: volume / 100,
    });
    onClose();
  };

  return (
    <div id="device-settings-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div 
        id="device-settings-modal-card"
        className="w-full max-w-xl bg-[#121216] border border-zinc-750/80 rounded-3xl p-6 shadow-2xl shadow-black/60 text-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Device, Ringtone & Identity Settings</h2>
              <p className="text-xs text-zinc-400">Configure telephony tones, multi-device routing & profiles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#18181d]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Multi-Device Active Profile Switcher */}
        <div className="my-5 p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-emerald-400" />
              Active Device Profile (For Multi-Tab Calling Simulation)
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">ID: {currentIdentity.deviceId}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PRESET_TEST_IDENTITIES.map((identity) => {
              const isSelected = currentIdentity.id === identity.id;
              return (
                <button
                  key={identity.id}
                  onClick={() => onSwitchIdentity(identity)}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    isSelected
                      ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-md'
                      : 'bg-[#18181d] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <img
                      src={identity.avatar}
                      alt={identity.name}
                      className="w-7 h-7 rounded-full object-cover border border-zinc-700/80"
                    />
                    <div className="truncate">
                      <div className="text-xs font-bold truncate text-white">{identity.name.split(' ')[0]}</div>
                      <div className="text-[10px] text-zinc-400 truncate">{identity.deviceName}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active Here
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            💡 <strong>Multi-tab testing tip:</strong> Open this app in two tabs, select "Alice" in Tab 1 and "Marcus" in Tab 2. Call Marcus from Tab 1 to hear Tab 2 ring with real WebSockets & E2EE!
          </p>
        </div>

        {/* 2. Ringtone Synthesizer Settings */}
        <div className="mb-5 p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-emerald-400" />
              Incoming Call Ringtone Synthesizer
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">Web Audio API (Zero Latency)</span>
          </div>

          {/* Ringtone Flavors */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {[
              { id: 'modern', name: 'Modern Chime', desc: 'Melodic marimba' },
              { id: 'classic', name: 'Classic Bell', desc: '440+480Hz dual-tone' },
              { id: 'cyber', name: 'Cyber Synth', desc: 'FM electronic pulse' },
              { id: 'executive', name: 'Executive Soft', desc: 'Minor 9th chord bell' },
              { id: 'radar', name: 'Radar Alert', desc: 'High priority ping' },
            ].map((rt) => (
              <div
                key={rt.id}
                onClick={() => {
                  setActiveRingtone(rt.id as any);
                  handleTestRingtone(rt.id as any);
                }}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  activeRingtone === rt.id
                    ? 'bg-emerald-950/70 border-emerald-500 text-white'
                    : 'bg-[#18181d] border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{rt.name}</span>
                  <Play className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{rt.desc}</div>
              </div>
            ))}
          </div>

          {/* Volume Slider & Test Button */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5" /> Ringtone Volume
              </span>
              <span className="font-mono text-emerald-400">{Math.round(volume)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => {
                const val = Number(e.target.value);
                setVolume(val);
                ringEngine.setVolume(val / 100);
              }}
              className="w-full h-1.5 bg-[#18181d] rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/80">
            <button
              onClick={() => handleTestRingtone(activeRingtone)}
              className="px-3 py-1.5 bg-[#18181d] hover:bg-[#222228] text-zinc-200 border border-zinc-800 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-xs"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400" />
              <span>Test Ringtone</span>
            </button>
            {isPlayingTestRing && (
              <button
                onClick={handleStopRingtone}
                className="px-3 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 shadow-xs"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Ringing</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. Audio & Mic Meter */}
        <div className="mb-5 p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner">
          <div className="flex items-center justify-between text-xs text-zinc-300 mb-2">
            <span className="flex items-center gap-1.5 font-bold text-white">
              <Mic className="w-4 h-4 text-emerald-400" />
              Microphone Audio Level Meter
            </span>
            <span className="text-[10px] font-mono text-emerald-400">{micLevel}%</span>
          </div>

          <div className="w-full h-2.5 bg-[#18181d] rounded-full overflow-hidden border border-zinc-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400 transition-all duration-75"
              style={{ width: `${Math.max(5, micLevel)}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-zinc-300 rounded-xl text-xs font-medium"
          >
            Cancel
          </button>
          <button
            id="save-device-settings-btn"
            onClick={handleSaveSettings}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50"
          >
            Apply Settings
          </button>
        </div>
      </div>
    </div>
  );
};
