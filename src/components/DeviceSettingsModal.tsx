import React, { useState, useEffect } from 'react';
import { 
  Settings, Volume2, Bell, Shield, User, 
  Mic, Video, Check, X, LogOut, Edit3, Trash2, RefreshCw
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
  onUpdateIdentityName: (newName: string) => void;
  onLogOut: () => void;
  onResetAllData?: () => void;
}

export const DeviceSettingsModal: React.FC<DeviceSettingsModalProps> = ({
  isOpen,
  onClose,
  ringtoneConfig,
  onSaveRingtoneConfig,
  currentIdentity,
  onUpdateIdentityName,
  onLogOut,
  onResetAllData,
}) => {
  const [activeRingtone, setActiveRingtone] = useState(ringtoneConfig.ringtoneType);
  const [volume, setVolume] = useState(ringtoneConfig.volume * 100);
  const [micLevel, setMicLevel] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentIdentity.name);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    let animId: number;
    if (isOpen) {
      setNameInput(currentIdentity.name);
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
  }, [isOpen, currentIdentity.name]);

  if (!isOpen) return null;

  const handleTestRingtone = (type: RingtoneConfig['ringtoneType']) => {
    ringEngine.setVolume(volume / 100);
    ringEngine.previewRingtone(type);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateIdentityName(nameInput.trim());
      setEditingName(false);
    }
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

  const handleTriggerResetAll = async () => {
    setIsResetting(true);
    try {
      await fetch('/api/reset-all', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    if (onResetAllData) {
      onResetAllData();
    } else {
      onLogOut();
    }
    onClose();
  };

  return (
    <div id="device-settings-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div 
        id="device-settings-modal-card"
        className="w-full max-w-lg bg-[#121216] border border-zinc-750/80 rounded-3xl p-6 shadow-2xl shadow-black/60 text-zinc-100 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Settings</h2>
              <p className="text-xs text-zinc-400">Manage your profile, ringtone & audio levels</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#18181d] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. User Account Card */}
        <div className="my-5 p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-emerald-400" />
              Your Account
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
              Synced & Active
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={currentIdentity.avatar}
                alt={currentIdentity.name}
                className="w-12 h-12 rounded-2xl object-cover border border-zinc-700 shadow-md"
              />
              <div>
                {editingName ? (
                  <form onSubmit={handleSaveName} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="bg-[#18181d] border border-emerald-500 rounded-xl px-2.5 py-1 text-sm text-white focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(false)}
                      className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      {currentIdentity.name}
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-zinc-500 hover:text-emerald-400 p-1 cursor-pointer"
                        title="Edit Name"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </h3>
                    <p className="text-xs text-zinc-400">Caller ID: {currentIdentity.name}</p>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                onLogOut();
                onClose();
              }}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch User</span>
            </button>
          </div>
        </div>

        {/* 2. Ringtone Synthesizer Selection */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2">
            Incoming Call Ringtone
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['modern', 'classic', 'cyber'] as RingtoneConfig['ringtoneType'][]).map((rType) => (
              <button
                key={rType}
                onClick={() => {
                  setActiveRingtone(rType);
                  handleTestRingtone(rType);
                }}
                className={`p-3 rounded-2xl border text-xs font-bold capitalize flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  activeRingtone === rType
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-950/50'
                    : 'bg-[#18181d] border-zinc-800 text-zinc-300 hover:bg-[#222228]'
                }`}
              >
                <Bell className="w-4 h-4 text-emerald-400" />
                <span>{rType}</span>
              </button>
            ))}
          </div>

          {/* Volume Slider */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="text-xs text-zinc-400 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-zinc-500" />
              Ringer Volume
            </span>
            <input
              type="range"
              min="10"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-44 accent-emerald-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-zinc-300">{Math.round(volume)}%</span>
          </div>
        </div>

        {/* 3. Audio & Mic Sensor Meter */}
        <div className="mb-5 p-3.5 bg-[#0c0c0e] rounded-2xl border border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-emerald-400" />
              Microphone Sensor Test
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">Live Input</span>
          </div>
          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.min(100, micLevel * 2)}%` }}
            />
          </div>
        </div>

        {/* 4. Reset All Accounts & Data Option */}
        <div className="mb-5 p-3.5 bg-red-950/20 border border-red-500/20 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-red-300 block">Reset All Accounts & History</span>
            <span className="text-[11px] text-zinc-400">Wipe all registered users, contacts & call records</span>
          </div>
          <button
            onClick={handleTriggerResetAll}
            disabled={isResetting}
            className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isResetting ? 'Resetting...' : 'Reset All'}</span>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] text-zinc-300 border border-zinc-800 rounded-xl text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSettings}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/50 cursor-pointer"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
