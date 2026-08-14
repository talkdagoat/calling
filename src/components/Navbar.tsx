import React from 'react';
import { 
  ShieldCheck, Users, Video, Clock, Settings, Bell, Lock, Smartphone, Laptop, Sparkles, Phone 
} from 'lucide-react';
import { UserIdentity } from '../types';

interface NavbarProps {
  activeTab: 'contacts' | 'rooms' | 'history';
  onSelectTab: (tab: 'contacts' | 'rooms' | 'history') => void;
  currentIdentity: UserIdentity;
  onOpenSettings: () => void;
  onQuickTestRing: () => void;
  isOnline: boolean;
  activeConnectedDevices: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  currentIdentity,
  onOpenSettings,
  onQuickTestRing,
  isOnline,
  activeConnectedDevices,
}) => {
  return (
    <header className="h-16 bg-[#121216]/90 border-b border-zinc-800/80 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 backdrop-blur-xl shadow-lg shadow-black/20">
      {/* Left: Brand Logo & E2EE Verified Indicator */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl text-zinc-950 shadow-md shadow-emerald-950/60 ring-1 ring-emerald-400/30">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold tracking-tight text-zinc-100">CipherCall</span>
              <span className="px-1.5 py-0.5 bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono rounded-md shadow-xs">
                E2EE
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 hidden sm:block tracking-wide">Zero-Knowledge Encrypted Calling</p>
          </div>
        </div>

        {/* Center Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#0c0c0e] p-1 rounded-2xl border border-zinc-800/90 shadow-inner">
          <button
            id="nav-tab-contacts"
            onClick={() => onSelectTab('contacts')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'contacts'
                ? 'bg-[#1e1e24] text-white shadow-md border border-zinc-700/80'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Contacts (JSON)</span>
          </button>

          <button
            id="nav-tab-rooms"
            onClick={() => onSelectTab('rooms')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'rooms'
                ? 'bg-[#1e1e24] text-white shadow-md border border-zinc-700/80'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-teal-400" />
            <span>Group Video Rooms</span>
          </button>

          <button
            id="nav-tab-history"
            onClick={() => onSelectTab('history')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-[#1e1e24] text-white shadow-md border border-zinc-700/80'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Call History & AI Minutes</span>
          </button>
        </nav>
      </div>

      {/* Right: Active Device Identity & Quick Ring Test */}
      <div className="flex items-center gap-3">
        {/* Quick Ring Test */}
        <button
          id="quick-test-ring-btn"
          onClick={onQuickTestRing}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#18181d] hover:bg-[#222228] text-zinc-300 hover:text-white rounded-xl text-xs font-medium border border-zinc-800 transition-colors shadow-xs"
          title="Test synthesized incoming call ringtone on this device"
        >
          <Bell className="w-3.5 h-3.5 text-emerald-400" />
          <span>Test Ring</span>
        </button>

        {/* User Identity Profile Card */}
        <button
          id="open-device-settings-btn"
          onClick={onOpenSettings}
          className="flex items-center gap-2.5 p-1.5 pr-3 bg-[#0c0c0e] hover:bg-[#18181d] border border-zinc-800/90 rounded-2xl transition-colors group shadow-xs"
        >
          <div className="relative">
            <img
              src={currentIdentity.avatar}
              alt={currentIdentity.name}
              className="w-8 h-8 rounded-xl object-cover border border-zinc-700/80"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0c0c0e] ${
                isOnline ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50' : 'bg-zinc-500'
              }`}
            />
          </div>

          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-zinc-200 group-hover:text-emerald-300 transition-colors leading-tight">
              {currentIdentity.name.split(' ')[0]}
            </div>
            <div className="text-[10px] text-zinc-400 font-mono truncate max-w-[120px]">
              {currentIdentity.deviceName}
            </div>
          </div>

          <Settings className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white ml-1" />
        </button>
      </div>
    </header>
  );
};
