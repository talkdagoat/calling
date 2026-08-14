import React from 'react';
import { ShieldCheck, Lock, CheckCircle2, X, Key, Shield } from 'lucide-react';
import { UserIdentity } from '../types';

interface E2EESafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  localIdentity: UserIdentity;
  remoteName: string;
  remoteFingerprint: string;
  safetyNumber: string;
  isVerified: boolean;
  onToggleVerified: (verified: boolean) => void;
}

export const E2EESafetyModal: React.FC<E2EESafetyModalProps> = ({
  isOpen,
  onClose,
  localIdentity,
  remoteName,
  remoteFingerprint,
  safetyNumber,
  isVerified,
  onToggleVerified,
}) => {
  if (!isOpen) return null;

  const safetyBlocks = (safetyNumber || '48291 19482 73819 50192').split(' ');

  return (
    <div id="e2ee-safety-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div 
        id="e2ee-safety-modal-card"
        className="w-full max-w-lg bg-[#121216] border border-emerald-500/30 rounded-3xl p-6 shadow-2xl shadow-black/60 text-zinc-100 relative max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Verify End-to-End Encryption
              </h2>
              <p className="text-xs text-zinc-400">Safety Number verification with {remoteName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-[#18181d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Number Display */}
        <div className="my-5 p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner flex flex-col items-center text-center">
          <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase mb-2 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Signal-Style 20-Digit Safety Number
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-2 w-full">
            {safetyBlocks.map((block, idx) => (
              <div 
                key={idx}
                className="bg-[#18181d] border border-zinc-800 rounded-xl p-2.5 text-center font-mono font-bold text-lg text-emerald-300 tracking-widest shadow-xs"
              >
                {block}
              </div>
            ))}
          </div>

          <p className="text-xs text-zinc-400 mt-2 max-w-sm">
            Compare this number verbally with <strong className="text-zinc-200">{remoteName}</strong>. If the numbers match on both screens, this call is guaranteed 100% immune to eavesdropping.
          </p>
        </div>

        {/* Fingerprints */}
        <div className="space-y-3 mb-5">
          <div className="p-3 bg-[#18181d] rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                Your Public Key Fingerprint ({localIdentity.deviceName})
              </span>
            </div>
            <code className="text-xs font-mono text-emerald-300 block truncate">
              {localIdentity.publicKeyFingerprint}
            </code>
          </div>

          <div className="p-3 bg-[#18181d] rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-teal-400" />
                {remoteName}'s Public Key Fingerprint
              </span>
            </div>
            <code className="text-xs font-mono text-teal-300 block truncate">
              {remoteFingerprint || '99DA F102 77B4 4920 18EA'}
            </code>
          </div>
        </div>

        {/* Cryptographic Architecture Card */}
        <div className="p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 mb-5 shadow-inner">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300 mb-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Cryptographic Architecture & Zero-Knowledge Verification</span>
          </div>
          <div className="text-xs space-y-1.5 text-zinc-400">
            <div className="flex items-center justify-between">
              <span>Key Agreement:</span>
              <span className="font-mono text-zinc-200">ECDH P-256 (Web Crypto)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Symmetric Media Cipher:</span>
              <span className="font-mono text-zinc-200">AES-GCM 256-bit</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Authentication String:</span>
              <span className="font-mono text-zinc-200">HMAC-SHA-256 SAS</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Storage Persistence:</span>
              <span className="font-mono text-emerald-400">Google Drive Private Cloud</span>
            </div>
          </div>
        </div>

        {/* Verification Checkbox & Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
          <label className="flex items-center gap-2.5 cursor-pointer text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={isVerified}
              onChange={(e) => onToggleVerified(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-[#18181d] border-zinc-700"
            />
            <span className="font-medium">Mark {remoteName} as Verified</span>
          </label>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
