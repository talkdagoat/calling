import React, { useState, useEffect } from 'react';
import { 
  HardDrive, CheckCircle2, RefreshCw, Download, Upload, AlertCircle, X, Shield, Lock, ExternalLink, Cloud 
} from 'lucide-react';
import { googleDriveService, GoogleDriveUser, TalkDrivePayload } from '../utils/googleDriveSync';
import { Contact, CallRecord, UserIdentity, RingtoneConfig } from '../types';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  callHistory: CallRecord[];
  identity: UserIdentity;
  ringtoneConfig: RingtoneConfig;
  onRestoreData: (restored: { contacts?: Contact[]; callHistory?: CallRecord[]; ringtoneConfig?: RingtoneConfig }) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  contacts,
  callHistory,
  identity,
  ringtoneConfig,
  onRestoreData,
}) => {
  const [isConnected, setIsConnected] = useState(googleDriveService.isConnected());
  const [userInfo, setUserInfo] = useState<GoogleDriveUser | null>(googleDriveService.getUserInfo());
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [autoSync, setAutoSync] = useState(googleDriveService.isAutoSyncEnabled());
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(googleDriveService.getLastSyncTime());

  useEffect(() => {
    setIsConnected(googleDriveService.isConnected());
    setUserInfo(googleDriveService.getUserInfo());
    setLastSyncTime(googleDriveService.getLastSyncTime());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsSyncing(true);
    setSyncStatusMsg({ type: 'info', text: 'Connecting to Google Drive...' });
    const result = await googleDriveService.connectGoogleDrive();
    setIsSyncing(false);

    if (result.success) {
      setIsConnected(true);
      setUserInfo(result.user || null);
      setSyncStatusMsg({ type: 'success', text: 'Google Drive connected successfully!' });
      // Perform initial backup
      handleBackupToDrive();
    } else {
      setSyncStatusMsg({ type: 'error', text: result.error || 'Failed to authenticate Google Drive.' });
    }
  };

  const handleDisconnect = () => {
    googleDriveService.disconnectGoogleDrive();
    setIsConnected(false);
    setUserInfo(null);
    setSyncStatusMsg({ type: 'info', text: 'Google Drive disconnected.' });
  };

  const handleBackupToDrive = async () => {
    setIsSyncing(true);
    setSyncStatusMsg({ type: 'info', text: 'Encrypting and saving data to Google Drive...' });

    const payload: TalkDrivePayload = {
      version: '1.0.0',
      lastSyncedAt: new Date().toISOString(),
      user: {
        name: identity.name,
        deviceId: identity.deviceId,
        publicKeyFingerprint: identity.publicKeyFingerprint,
      },
      contacts,
      callHistory,
      settings: ringtoneConfig,
    };

    const res = await googleDriveService.savePayloadToDrive(payload);
    setIsSyncing(false);

    if (res.success) {
      setLastSyncTime(new Date().toISOString());
      setSyncStatusMsg({ 
        type: 'success', 
        text: `Data successfully synced to Google Drive (File ID: ${res.fileId?.slice(0, 10)}...)` 
      });
    } else {
      setSyncStatusMsg({ type: 'error', text: res.error || 'Failed to sync to Drive.' });
    }
  };

  const handleRestoreFromDrive = async () => {
    setIsRestoring(true);
    setSyncStatusMsg({ type: 'info', text: 'Fetching latest backup from Google Drive...' });

    const res = await googleDriveService.loadPayloadFromDrive();
    setIsRestoring(false);

    if (res.success && res.data) {
      const data = res.data;
      onRestoreData({
        contacts: data.contacts,
        callHistory: data.callHistory,
        ringtoneConfig: data.settings,
      });
      setSyncStatusMsg({
        type: 'success',
        text: `Restored ${data.contacts?.length || 0} contacts and ${data.callHistory?.length || 0} call logs from Google Drive!`,
      });
    } else {
      setSyncStatusMsg({ type: 'error', text: res.error || 'No backup found on Google Drive.' });
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setAutoSync(enabled);
    googleDriveService.setAutoSync(enabled);
  };

  const handleExportLocalJson = () => {
    const payload = {
      app: 'Talk',
      exportedAt: new Date().toISOString(),
      identity,
      contacts,
      callHistory,
      ringtoneConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talk_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="google-drive-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div 
        id="google-drive-modal-card"
        className="w-full max-w-xl bg-[#121216] border border-zinc-800 rounded-3xl p-6 shadow-2xl shadow-black/70 text-zinc-100 relative max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shadow-xs">
              <HardDrive className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Drive Storage & Sync
              </h2>
              <p className="text-xs text-zinc-400">
                Store and synchronize your contacts, call history, and keys in your personal Google Drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-[#18181d] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alert Banner if any */}
        {syncStatusMsg && (
          <div
            className={`my-4 p-3 rounded-2xl text-xs flex items-center gap-2.5 border ${
              syncStatusMsg.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : syncStatusMsg.type === 'error'
                ? 'bg-red-950/60 border-red-500/40 text-red-300'
                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
            }`}
          >
            {syncStatusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : syncStatusMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <RefreshCw className="w-4 h-4 text-zinc-400 animate-spin shrink-0" />
            )}
            <span className="flex-1">{syncStatusMsg.text}</span>
          </div>
        )}

        {/* Connection Status Card */}
        <div className="my-5 p-4 bg-[#0c0c0e] rounded-2xl border border-zinc-800/90 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {userInfo?.picture ? (
                <img
                  src={userInfo.picture}
                  alt={userInfo.name}
                  className="w-10 h-10 rounded-full border border-emerald-500/40 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#18181d] border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <Cloud className="w-5 h-5 text-emerald-400" />
                </div>
              )}
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{userInfo?.name || 'Google Drive Cloud Storage'}</span>
                  {isConnected ? (
                    <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Connected
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-mono rounded-full">
                      Disconnected
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  {userInfo?.email || 'talk_encrypted_data.json in user Drive'}
                </div>
              </div>
            </div>

            {isConnected ? (
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-[#18181d] hover:bg-red-950/50 hover:text-red-300 border border-zinc-800 hover:border-red-500/40 rounded-xl text-xs text-zinc-400 transition-colors shadow-xs"
              >
                Disconnect
              </button>
            ) : (
              <button
                id="connect-google-drive-btn"
                onClick={handleConnect}
                disabled={isSyncing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-md shadow-emerald-950/50"
              >
                <Cloud className="w-4 h-4" />
                <span>Connect Google Drive</span>
              </button>
            )}
          </div>

          {lastSyncTime && (
            <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span>Last Synced to Drive:</span>
              <span className="text-emerald-400">{new Date(lastSyncTime).toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Sync Summary & Controls */}
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-[#18181d] rounded-2xl border border-zinc-800 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Stored Talk Application Data
            </h3>
            
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-[#0c0c0e] rounded-xl border border-zinc-800/90 shadow-inner">
                <div className="text-lg font-mono font-bold text-emerald-300">{contacts.length}</div>
                <div className="text-[11px] text-zinc-400">Contacts</div>
              </div>
              <div className="p-2.5 bg-[#0c0c0e] rounded-xl border border-zinc-800/90 shadow-inner">
                <div className="text-lg font-mono font-bold text-teal-300">{callHistory.length}</div>
                <div className="text-[11px] text-zinc-400">Call Logs</div>
              </div>
              <div className="p-2.5 bg-[#0c0c0e] rounded-xl border border-zinc-800/90 shadow-inner">
                <div className="text-lg font-mono font-bold text-indigo-300">256-Bit</div>
                <div className="text-[11px] text-zinc-400">E2EE Keys</div>
              </div>
            </div>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <div>
                <div className="text-xs font-semibold text-zinc-200">Automatic Background Sync</div>
                <div className="text-[11px] text-zinc-400">Automatically sync changes whenever you edit contacts or end a call</div>
              </div>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => handleToggleAutoSync(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-[#0c0c0e] border-zinc-700"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              id="sync-to-drive-btn"
              onClick={handleBackupToDrive}
              disabled={isSyncing}
              className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-950/50"
            >
              <Upload className="w-4 h-4" />
              <span>{isSyncing ? 'Syncing to Drive...' : 'Save & Sync to Drive'}</span>
            </button>

            <button
              id="restore-from-drive-btn"
              onClick={handleRestoreFromDrive}
              disabled={isRestoring}
              className="p-3 bg-[#18181d] hover:bg-[#222228] disabled:opacity-50 border border-zinc-800 hover:border-zinc-700 text-zinc-200 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              <Download className="w-4 h-4 text-teal-400" />
              <span>{isRestoring ? 'Restoring...' : 'Restore from Drive'}</span>
            </button>
          </div>
        </div>

        {/* Security & Privacy Notice */}
        <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-zinc-400 mb-5">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-zinc-200">Zero-Server Persistence:</strong> Your contacts and call logs are saved directly in your personal Google Drive storage using restricted application file scope (`https://www.googleapis.com/auth/drive.file`). No intermediary server has access to your private database.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <button
            onClick={handleExportLocalJson}
            className="px-3.5 py-1.5 text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download JSON File</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#18181d] hover:bg-[#222228] border border-zinc-800 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
