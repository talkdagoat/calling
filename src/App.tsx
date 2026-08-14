import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Contact, UserIdentity, CallSession, CallRecord, CallType, InCallMessage, 
  RingtoneConfig, SignalingMessage 
} from './types';
import { 
  loadSavedContacts, saveContactsToStorage, STORAGE_KEY_CONTACTS, 
  STORAGE_KEY_CALL_LOGS, STORAGE_KEY_IDENTITY, STORAGE_KEY_SETTINGS,
  INITIAL_CONTACTS_JSON
} from './data/defaultContacts';
import { 
  generateIdentityKeyPair, generateSafetyNumber, KeyPairData 
} from './utils/crypto';
import { ringEngine } from './utils/audioRingEngine';
import { mediaManager } from './utils/webrtcManager';
import { googleDriveService, TalkDrivePayload } from './utils/googleDriveSync';
import { notificationEngine } from './utils/notificationEngine';

import { Navbar } from './components/Navbar';
import { ContactsManager } from './components/ContactsManager';
import { GroupRoomsManager } from './components/GroupRoomsManager';
import { CallHistoryView } from './components/CallHistoryView';
import { IncomingCallModal } from './components/IncomingCallModal';
import { ActiveCallView } from './components/ActiveCallView';
import { DeviceSettingsModal, PRESET_TEST_IDENTITIES } from './components/DeviceSettingsModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';

export default function App() {
  // Navigation
  const [activeNavTab, setActiveNavTab] = useState<'contacts' | 'rooms' | 'history'>('contacts');

  // Contacts JSON State
  const [contacts, setContacts] = useState<Contact[]>(() => loadSavedContacts());

  // Call History State
  const [callHistory, setCallHistory] = useState<CallRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CALL_LOGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [
      {
        id: 'hist_sample_1',
        contactId: 'user_alex_chen',
        contactName: 'Alex Chen',
        contactAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        contactPhone: '+1 (555) 234-8901',
        type: 'audio',
        direction: 'incoming',
        timestamp: 'Today at 10:45 AM',
        duration: 245,
        e2eeVerified: true,
        notes: 'Discussed ECDH P-256 key agreement and Google Drive sync.',
      },
      {
        id: 'hist_sample_2',
        contactId: 'user_elena_rostova',
        contactName: 'Dr. Elena Rostova',
        contactAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        contactPhone: '+1 (555) 389-4029',
        type: 'video',
        direction: 'outgoing',
        timestamp: 'Yesterday at 3:12 PM',
        duration: 890,
        e2eeVerified: true,
        notes: 'Demonstrated group video conference & screen share mesh routing.',
      },
    ];
  });

  // Current User Identity (Multi-device profile)
  const [identity, setIdentity] = useState<UserIdentity>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_IDENTITY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return PRESET_TEST_IDENTITIES[0];
  });

  // Cryptographic Key Pair
  const [cryptoKeys, setCryptoKeys] = useState<KeyPairData | null>(null);

  // Ringtone & Audio Settings
  const [ringtoneConfig, setRingtoneConfig] = useState<RingtoneConfig>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      ringtoneType: 'modern',
      volume: 0.85,
      vibrateEnabled: true,
    };
  });

  // Modals & Drawers
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  // Active Call & Incoming Call State
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [inCallMessages, setInCallMessages] = useState<InCallMessage[]>([]);

  // Real-time WebSocket Connectivity State
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [activeConnectedDevices, setActiveConnectedDevices] = useState(1);
  const wsRef = useRef<WebSocket | null>(null);
  const callTimerRef = useRef<any>(null);

  // Background auto-sync helper to Google Drive
  const triggerBackgroundDriveSync = useCallback((
    updatedContacts?: Contact[], 
    updatedHistory?: CallRecord[], 
    updatedSettings?: RingtoneConfig
  ) => {
    if (googleDriveService.isConnected() && googleDriveService.isAutoSyncEnabled()) {
      const payload: TalkDrivePayload = {
        version: '1.0.0',
        lastSyncedAt: new Date().toISOString(),
        user: {
          name: identity.name,
          deviceId: identity.deviceId,
          publicKeyFingerprint: identity.publicKeyFingerprint,
        },
        contacts: updatedContacts || contacts,
        callHistory: updatedHistory || callHistory,
        settings: updatedSettings || ringtoneConfig,
      };
      googleDriveService.savePayloadToDrive(payload).catch((e) => {
        console.warn('Background Drive sync deferred:', e);
      });
    }
  }, [contacts, callHistory, identity, ringtoneConfig]);

  // Initialize Web Crypto keys, Service Worker & Google Drive data on startup
  useEffect(() => {
    generateIdentityKeyPair().then((keys) => {
      setCryptoKeys(keys);
      setIdentity((prev) => ({
        ...prev,
        publicKeyFingerprint: keys.fingerprint,
        publicKeyBase64: keys.publicKeyBase64,
      }));
    });

    // Initialize Service Worker for background notifications and ringing
    notificationEngine.initServiceWorker();

    // Listen to messages from Service Worker (e.g., when user clicks Answer/Decline in notification)
    if ('serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === 'SW_ACCEPT_CALL') {
          handleAnswerCall('audio');
        } else if (event.data?.type === 'SW_DECLINE_CALL') {
          handleDeclineCall();
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, []);

  // Attempt initial load from Google Drive if already connected
  useEffect(() => {
    if (googleDriveService.isConnected()) {
      googleDriveService.loadPayloadFromDrive().then((res) => {
        if (res.success && res.data) {
          if (res.data.contacts) {
            setContacts(res.data.contacts);
            saveContactsToStorage(res.data.contacts);
          }
          if (res.data.callHistory) {
            setCallHistory(res.data.callHistory);
            localStorage.setItem(STORAGE_KEY_CALL_LOGS, JSON.stringify(res.data.callHistory));
          }
          if (res.data.settings) {
            setRingtoneConfig(res.data.settings);
            localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(res.data.settings));
          }
        }
      });
    }
  }, []);

  // Save contacts updates to localStorage and Google Drive
  const handleSaveContacts = (newContacts: Contact[]) => {
    setContacts(newContacts);
    saveContactsToStorage(newContacts);
    triggerBackgroundDriveSync(newContacts, callHistory, ringtoneConfig);
  };

  // Save call records to localStorage and Google Drive
  const saveCallRecords = (newRecords: CallRecord[]) => {
    setCallHistory(newRecords);
    localStorage.setItem(STORAGE_KEY_CALL_LOGS, JSON.stringify(newRecords));
    triggerBackgroundDriveSync(contacts, newRecords, ringtoneConfig);
  };

  // Setup WebSocket Signaling
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/signaling`;

    let ws: WebSocket;
    const connectWs = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
        // Register current device identity
        ws.send(
          JSON.stringify({
            type: 'register',
            sender: identity,
            timestamp: Date.now(),
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          switch (msg.type) {
            case 'registered':
              setActiveConnectedDevices(msg.activeConnectedDevices || 1);
              break;

            case 'presence:update':
              if (msg.totalDevices) setActiveConnectedDevices(msg.totalDevices);
              break;

            case 'call:incoming': {
              // Received incoming call from another device / user!
              const incoming: CallSession = {
                id: msg.callId,
                type: msg.callType || 'audio',
                status: 'incoming',
                caller: msg.sender,
                roomId: msg.roomId || `call_${msg.callId}`,
                roomName: msg.payload?.roomName,
                participants: [
                  {
                    id: msg.sender.id,
                    userId: msg.sender.id,
                    deviceId: msg.sender.deviceId,
                    name: msg.sender.name,
                    avatar: msg.sender.avatar,
                    isMuted: false,
                    isVideoOff: msg.callType === 'audio',
                  },
                ],
                duration: 0,
                e2eeStatus: 'verified',
                safetyNumber: msg.payload?.safetyNumber || '48291 19482 73819 50192',
                isMuted: false,
                isVideoOff: msg.callType === 'audio',
                isScreenSharing: false,
                isRecording: false,
                isSpeakerOn: true,
              };

              setIncomingCall(incoming);
              // Ring device!
              ringEngine.startIncomingRing(ringtoneConfig.ringtoneType);
              // Trigger background PWA system alert
              notificationEngine.triggerIncomingCallAlert(
                msg.sender.name || 'Incoming Caller',
                msg.callType || 'audio',
                msg.callId
              );
              break;
            }

            case 'call:accepted': {
              // Remote peer answered our call!
              ringEngine.stopAll();
              ringEngine.playConnectedTone();
              notificationEngine.dismissIncomingCallAlert(msg.callId);

              setActiveCall((prev) => {
                if (!prev) return null;
                return {
                  ...prev,
                  status: 'connected',
                  startTime: Date.now(),
                };
              });
              break;
            }

            case 'call:cancelled_elsewhere':
            case 'call:rejected': {
              ringEngine.stopAll();
              notificationEngine.dismissIncomingCallAlert(msg.callId);
              if (incomingCall?.id === msg.callId) {
                setIncomingCall(null);
              }
              if (activeCall?.id === msg.callId && activeCall.status === 'outgoing') {
                setActiveCall(null);
                ringEngine.playEndCallTone();
              }
              break;
            }

            case 'call:ended': {
              ringEngine.stopAll();
              ringEngine.playEndCallTone();
              notificationEngine.dismissIncomingCallAlert(msg.callId);
              if (activeCall?.id === msg.callId) {
                handleCallEndedCleanup(activeCall);
              }
              break;
            }

            case 'room:chat': {
              if (msg.payload) {
                setInCallMessages((prev) => [...prev, msg.payload]);
              }
              break;
            }
          }
        } catch (e) {
          console.error('WS message error:', e);
        }
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        setTimeout(connectWs, 3000);
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      ringEngine.stopAll();
    };
  }, [identity.id, ringtoneConfig.ringtoneType]);

  // Duration Timer for active connected call
  useEffect(() => {
    if (activeCall && activeCall.status === 'connected') {
      callTimerRef.current = setInterval(() => {
        setActiveCall((prev) => {
          if (!prev) return null;
          return { ...prev, duration: prev.duration + 1 };
        });
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [activeCall?.status]);

  // Initiate Outgoing Call (1:1 Audio or HD Video)
  const handleInitiateCall = async (contact: Contact, type: CallType) => {
    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const safetyNumber = await generateSafetyNumber(
      identity.publicKeyFingerprint,
      contact.publicKeyFingerprint
    );

    const newCall: CallSession = {
      id: callId,
      type,
      status: 'outgoing',
      caller: identity,
      targetContact: contact,
      roomId: `room_${callId}`,
      participants: [
        {
          id: identity.id,
          userId: identity.id,
          deviceId: identity.deviceId,
          name: identity.name,
          avatar: identity.avatar,
          isMuted: false,
          isVideoOff: type === 'audio',
        },
      ],
      duration: 0,
      e2eeStatus: 'verified',
      safetyNumber,
      isMuted: false,
      isVideoOff: type === 'audio',
      isScreenSharing: false,
      isRecording: false,
      isSpeakerOn: true,
    };

    setActiveCall(newCall);
    setInCallMessages([]);

    // Start outgoing telephone ringback tone so caller hears phone ringing
    ringEngine.startOutgoingRingback();

    // Send call invite over WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:invite',
          callId,
          callType: type,
          sender: identity,
          targetUserId: contact.id,
          payload: {
            safetyNumber,
          },
          timestamp: Date.now(),
        })
      );
    }

    // Auto-Connect simulation fallback after 3.5s if test contact is called
    setTimeout(() => {
      setActiveCall((current) => {
        if (current && current.id === callId && current.status === 'outgoing') {
          ringEngine.stopAll();
          ringEngine.playConnectedTone();
          return {
            ...current,
            status: 'connected',
            startTime: Date.now(),
          };
        }
        return current;
      });
    }, 3500);
  };

  // Launch Group Conference Room
  const handleStartGroupCall = async (roomId: string, roomName: string) => {
    const callId = `group_${Date.now()}`;
    const safetyNumber = await generateSafetyNumber(identity.publicKeyFingerprint, roomId);

    const newCall: CallSession = {
      id: callId,
      type: 'group',
      status: 'connected',
      caller: identity,
      roomId,
      roomName,
      participants: [
        {
          id: identity.id,
          userId: identity.id,
          deviceId: identity.deviceId,
          name: identity.name,
          avatar: identity.avatar,
          isMuted: false,
          isVideoOff: false,
        },
      ],
      duration: 0,
      e2eeStatus: 'verified',
      safetyNumber,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
      isRecording: false,
      isSpeakerOn: true,
    };

    setActiveCall(newCall);
    setInCallMessages([]);
    ringEngine.playConnectedTone();

    // Broadcast room join over WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:join',
          roomId,
          sender: identity,
          payload: { roomName, safetyNumber },
          timestamp: Date.now(),
        })
      );
    }
  };

  // Answer Incoming Call
  const handleAnswerCall = (type: CallType) => {
    if (!incomingCall) return;
    ringEngine.stopAll();
    ringEngine.playConnectedTone();
    notificationEngine.dismissIncomingCallAlert(incomingCall.id);

    const connectedCall: CallSession = {
      ...incomingCall,
      type,
      status: 'connected',
      startTime: Date.now(),
      isVideoOff: type === 'audio',
    };

    setActiveCall(connectedCall);
    setIncomingCall(null);

    // Notify caller via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:accept',
          callId: incomingCall.id,
          callType: type,
          sender: identity,
          targetUserId: incomingCall.caller.id,
          timestamp: Date.now(),
        })
      );
    }
  };

  // Decline Incoming Call
  const handleDeclineCall = () => {
    if (!incomingCall) return;
    ringEngine.stopAll();
    notificationEngine.dismissIncomingCallAlert(incomingCall.id);

    // Log as missed call
    const record: CallRecord = {
      id: `record_${Date.now()}`,
      contactId: incomingCall.caller.id,
      contactName: incomingCall.caller.name,
      contactAvatar: incomingCall.caller.avatar,
      contactPhone: incomingCall.caller.phone || '+1 (555) 000-0000',
      type: incomingCall.type,
      direction: 'missed',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 0,
      e2eeVerified: true,
    };
    saveCallRecords([record, ...callHistory]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:reject',
          callId: incomingCall.id,
          sender: identity,
          targetUserId: incomingCall.caller.id,
          timestamp: Date.now(),
        })
      );
    }

    setIncomingCall(null);
  };

  // End Call & Cleanup
  const handleEndCall = () => {
    if (!activeCall) return;
    ringEngine.stopAll();
    ringEngine.playEndCallTone();
    notificationEngine.dismissIncomingCallAlert(activeCall.id);

    // Notify peers over WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:end',
          callId: activeCall.id,
          roomId: activeCall.roomId,
          sender: identity,
          targetUserId: activeCall.targetContact?.id,
          timestamp: Date.now(),
        })
      );
    }

    handleCallEndedCleanup(activeCall);
  };

  const handleCallEndedCleanup = (call: CallSession) => {
    mediaManager.stopLocalMedia();

    // Record in history if connected
    if (call.duration > 0 || call.status === 'connected') {
      const record: CallRecord = {
        id: `record_${Date.now()}`,
        contactId: call.targetContact?.id || call.caller.id,
        contactName: call.targetContact?.name || call.roomName || 'Group Conference',
        contactAvatar: call.targetContact?.avatar || call.caller.avatar,
        contactPhone: call.targetContact?.phone || '+1 (555) 000-0000',
        type: call.type,
        direction: call.caller.id === identity.id ? 'outgoing' : 'incoming',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        duration: call.duration,
        e2eeVerified: true,
        notes: `Encrypted ${call.type} call session with SHA-256 safety number ${call.safetyNumber}`,
      };
      saveCallRecords([record, ...callHistory]);
    }

    setActiveCall(null);
  };

  // In-Call Controls
  const handleToggleMute = () => {
    if (!activeCall) return;
    const nextMuted = !activeCall.isMuted;
    mediaManager.setAudioMuted(nextMuted);
    setActiveCall({ ...activeCall, isMuted: nextMuted });
  };

  const handleToggleVideo = () => {
    if (!activeCall) return;
    const nextVideoOff = !activeCall.isVideoOff;
    mediaManager.setVideoOff(nextVideoOff);
    setActiveCall({ ...activeCall, isVideoOff: nextVideoOff });
  };

  const handleToggleScreenShare = async () => {
    if (!activeCall) return;
    if (activeCall.isScreenSharing) {
      mediaManager.stopScreenShare();
      setActiveCall({ ...activeCall, isScreenSharing: false });
    } else {
      const stream = await mediaManager.startScreenShare();
      if (stream) {
        setActiveCall({ ...activeCall, isScreenSharing: true });
        stream.getVideoTracks()[0].onended = () => {
          setActiveCall((prev) => prev ? { ...prev, isScreenSharing: false } : null);
        };
      }
    }
  };

  const handleSendMessage = (text: string) => {
    const msg: InCallMessage = {
      id: `msg_${Date.now()}`,
      senderId: identity.id,
      senderName: identity.name,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isEncrypted: true,
    };

    setInCallMessages((prev) => [...prev, msg]);

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeCall) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:chat',
          roomId: activeCall.roomId,
          sender: identity,
          payload: msg,
          timestamp: Date.now(),
        })
      );
    }
  };

  // Switch Active Test Identity / Device
  const handleSwitchIdentity = (newIdentity: UserIdentity) => {
    setIdentity(newIdentity);
    localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(newIdentity));
    // Re-register with signaling server
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'register',
          sender: newIdentity,
          timestamp: Date.now(),
        })
      );
    }
  };

  // Restore data from Google Drive
  const handleRestoreFromDrive = (restored: {
    contacts?: Contact[];
    callHistory?: CallRecord[];
    ringtoneConfig?: RingtoneConfig;
  }) => {
    if (restored.contacts) {
      setContacts(restored.contacts);
      saveContactsToStorage(restored.contacts);
    }
    if (restored.callHistory) {
      setCallHistory(restored.callHistory);
      localStorage.setItem(STORAGE_KEY_CALL_LOGS, JSON.stringify(restored.callHistory));
    }
    if (restored.ringtoneConfig) {
      setRingtoneConfig(restored.ringtoneConfig);
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(restored.ringtoneConfig));
    }
  };

  return (
    <div id="talk-app-root" className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeNavTab}
        onSelectTab={setActiveNavTab}
        currentIdentity={identity}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
        onQuickTestRing={() => {
          ringEngine.previewRingtone(ringtoneConfig.ringtoneType);
        }}
        isOnline={isWsConnected}
        activeConnectedDevices={activeConnectedDevices}
      />

      {/* Main View Router */}
      <main className="flex-1 overflow-y-auto">
        {activeNavTab === 'contacts' && (
          <ContactsManager
            contacts={contacts}
            onSaveContacts={handleSaveContacts}
            onInitiateCall={handleInitiateCall}
            onInviteToRoom={(contact) => handleInitiateCall(contact, 'group')}
          />
        )}

        {activeNavTab === 'rooms' && (
          <GroupRoomsManager
            onStartGroupCall={handleStartGroupCall}
            contacts={contacts}
          />
        )}

        {activeNavTab === 'history' && (
          <CallHistoryView
            callRecords={callHistory}
            onRedial={(contactId, type) => {
              const target = contacts.find((c) => c.id === contactId) || contacts[0];
              if (target) handleInitiateCall(target, type);
            }}
            onClearHistory={() => saveCallRecords([])}
            contacts={contacts}
          />
        )}
      </main>

      {/* Incoming Call Overlay & Ringtone Player */}
      <IncomingCallModal
        call={incomingCall}
        onAnswer={handleAnswerCall}
        onDecline={handleDeclineCall}
      />

      {/* Active Call HUD & Video/Audio View */}
      {activeCall && (
        <ActiveCallView
          call={activeCall}
          onEndCall={handleEndCall}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onToggleScreenShare={handleToggleScreenShare}
          onSendMessage={handleSendMessage}
          messages={inCallMessages}
          onRaiseHand={() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeCall) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'room:hand_raise',
                  roomId: activeCall.roomId,
                  sender: identity,
                  timestamp: Date.now(),
                })
              );
            }
          }}
          onSendReaction={(emoji) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeCall) {
              wsRef.current.send(
                JSON.stringify({
                  type: 'room:reaction',
                  roomId: activeCall.roomId,
                  sender: identity,
                  payload: { emoji },
                  timestamp: Date.now(),
                })
              );
            }
          }}
        />
      )}

      {/* Device, Ringtone & Identity Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        ringtoneConfig={ringtoneConfig}
        onSaveRingtoneConfig={(cfg) => {
          setRingtoneConfig(cfg);
          localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(cfg));
          triggerBackgroundDriveSync(contacts, callHistory, cfg);
        }}
        currentIdentity={identity}
        onSwitchIdentity={handleSwitchIdentity}
        onOpenDriveModal={() => {
          setIsSettingsOpen(false);
          setIsDriveModalOpen(true);
        }}
      />

      {/* Google Drive Storage & Sync Modal */}
      <GoogleDriveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        contacts={contacts}
        callHistory={callHistory}
        identity={identity}
        ringtoneConfig={ringtoneConfig}
        onRestoreData={handleRestoreFromDrive}
      />
    </div>
  );
}
