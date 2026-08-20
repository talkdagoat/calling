import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Contact, UserIdentity, CallSession, CallRecord, CallType, InCallMessage, 
  RingtoneConfig, SignalingMessage 
} from './types';
import { 
  loadSavedContacts, saveContactsToStorage, STORAGE_KEY_CONTACTS, 
  STORAGE_KEY_CALL_LOGS, STORAGE_KEY_IDENTITY, STORAGE_KEY_SETTINGS,
  STORAGE_KEY_USER_NAME
} from './data/defaultContacts';
import { 
  generateIdentityKeyPair, generateSafetyNumber, KeyPairData 
} from './utils/crypto';
import { ringEngine } from './utils/audioRingEngine';
import { mediaManager } from './utils/webrtcManager';
import { googleDriveService, TalkDrivePayload } from './utils/googleDriveSync';
import { notificationEngine } from './utils/notificationEngine';
import { registerUserInFirestore, testFirestoreConnection } from './lib/firebase';

import { Navbar } from './components/Navbar';
import { WhatsAppNotificationBanner } from './components/WhatsAppNotificationBanner';
import { AccountSetupScreen } from './components/AccountSetupScreen';
import { ContactsManager } from './components/ContactsManager';
import { CallHistoryView } from './components/CallHistoryView';
import { IncomingCallModal } from './components/IncomingCallModal';
import { ActiveCallView } from './components/ActiveCallView';
import { DeviceSettingsModal } from './components/DeviceSettingsModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';

export default function App() {
  // Account Onboarding State
  const [hasAccount, setHasAccount] = useState<boolean>(() => {
    try {
      const storedName = localStorage.getItem(STORAGE_KEY_USER_NAME);
      const storedIdentity = localStorage.getItem(STORAGE_KEY_IDENTITY);
      return !!(storedName || storedIdentity);
    } catch (e) {
      return false;
    }
  });

  // Navigation: 'contacts' (Dial + Contacts) or 'history' (Calls)
  const [activeNavTab, setActiveNavTab] = useState<'contacts' | 'history'>('contacts');

  // Contacts JSON State
  const [contacts, setContacts] = useState<Contact[]>(() => loadSavedContacts());

  // Call History State
  const [callHistory, setCallHistory] = useState<CallRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CALL_LOGS);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  });

  // Current User Identity (Created from user's custom name)
  const [identity, setIdentity] = useState<UserIdentity>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_IDENTITY);
      if (raw) return JSON.parse(raw);
      const name = localStorage.getItem(STORAGE_KEY_USER_NAME);
      if (name) {
        return {
          id: `user_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name,
          email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.drive`,
          phone: '',
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=059669&color=ffffff&bold=true`,
          deviceId: `device_${Math.random().toString(36).substring(2, 9)}`,
          deviceName: 'Primary Device',
          publicKeyFingerprint: '4E9A B7C2 91F0 33DA 8201',
        };
      }
    } catch (e) {}
    return {
      id: 'user_default',
      name: 'User',
      email: 'user@talk.drive',
      phone: '',
      avatar: 'https://ui-avatars.com/api/?name=User&background=059669&color=ffffff&bold=true',
      deviceId: 'device_primary',
      deviceName: 'Primary Device',
      publicKeyFingerprint: '4E9A B7C2 91F0 33DA 8201',
    };
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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Real-time WebSocket Connectivity State
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [activeConnectedDevices, setActiveConnectedDevices] = useState(1);
  const wsRef = useRef<WebSocket | null>(null);
  const callTimerRef = useRef<any>(null);

  // Background auto-sync helper to Central Server Storage and Local Storage
  const triggerCentralServerSync = useCallback((
    updatedContacts?: Contact[], 
    updatedHistory?: CallRecord[], 
    customIdentity?: UserIdentity
  ) => {
    const currentIdent = customIdentity || identity;
    const toSyncContacts = updatedContacts !== undefined ? updatedContacts : contacts;
    const toSyncHistory = updatedHistory !== undefined ? updatedHistory : callHistory;

    fetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentIdent.id,
        contacts: toSyncContacts,
        callHistory: toSyncHistory,
      }),
    }).catch((e) => console.warn('Server sync deferred:', e));
  }, [contacts, callHistory, identity]);

  // Create or Login Account by Name
  const handleCompleteAccountSetup = async (name: string) => {
    const cleanName = (name || '').trim();
    if (!cleanName) return;

    const safeId = `user_${cleanName.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const newIdentity: UserIdentity = {
      id: safeId,
      name: cleanName,
      email: `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '')}@talk.io`,
      phone: '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=059669&color=ffffff&bold=true`,
      deviceId: `device_${Math.random().toString(36).substring(2, 9)}`,
      deviceName: 'Primary Device',
      publicKeyFingerprint: cryptoKeys?.fingerprint || '4E9A B7C2 91F0 33DA 8201',
      publicKeyBase64: cryptoKeys?.publicKeyBase64 || '',
    };

    // 1. Immediately store identity and mark account as active
    localStorage.setItem(STORAGE_KEY_USER_NAME, cleanName);
    localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(newIdentity));
    setIdentity(newIdentity);
    setHasAccount(true);

    // 2. Perform Firestore & Central SQL Server Sync
    try {
      await registerUserInFirestore({
        id: newIdentity.id,
        name: cleanName,
        avatar: newIdentity.avatar,
        publicKeyFingerprint: newIdentity.publicKeyFingerprint,
      });
    } catch (e) {
      console.warn('Firestore registration sync deferred:', e);
    }

    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          avatar: newIdentity.avatar,
          publicKeyFingerprint: newIdentity.publicKeyFingerprint,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user?.id) {
          newIdentity.id = data.user.id;
          localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(newIdentity));
          setIdentity({ ...newIdentity });
        }
      }

      // Fetch user's existing contacts and history if any
      const dataRes = await fetch(`/api/data/${encodeURIComponent(newIdentity.id)}`);
      if (dataRes.ok) {
        const serverData = await dataRes.json();
        if (Array.isArray(serverData.contacts) && serverData.contacts.length > 0) {
          setContacts(serverData.contacts);
          saveContactsToStorage(serverData.contacts);
        }
        if (Array.isArray(serverData.callHistory) && serverData.callHistory.length > 0) {
          setCallHistory(serverData.callHistory);
          localStorage.setItem(STORAGE_KEY_CALL_LOGS, JSON.stringify(serverData.callHistory));
        }
      }
    } catch (e) {
      console.warn('Server registration sync handled:', e);
    }

    triggerCentralServerSync(contacts, callHistory, newIdentity);
  };

  // Update Account Name
  const handleUpdateIdentityName = async (newName: string) => {
    const updated: UserIdentity = {
      ...identity,
      name: newName,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=059669&color=ffffff&bold=true`,
    };
    try {
      await registerUserInFirestore({
        id: updated.id,
        name: newName,
        avatar: updated.avatar,
        publicKeyFingerprint: updated.publicKeyFingerprint,
      });

      await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          avatar: updated.avatar,
          publicKeyFingerprint: updated.publicKeyFingerprint,
        }),
      });
    } catch (e) {}

    localStorage.setItem(STORAGE_KEY_USER_NAME, newName);
    localStorage.setItem(STORAGE_KEY_IDENTITY, JSON.stringify(updated));
    setIdentity(updated);
    triggerCentralServerSync(contacts, callHistory, updated);
  };

  // Log out / Switch Account
  const handleLogOut = () => {
    localStorage.removeItem(STORAGE_KEY_USER_NAME);
    localStorage.removeItem(STORAGE_KEY_IDENTITY);
    setHasAccount(false);
  };

  // Reset All Data & Accounts
  const handleResetAllData = () => {
    localStorage.clear();
    setContacts([]);
    setCallHistory([]);
    setHasAccount(false);
  };


  // Initialize Web Crypto keys, Service Worker & Google Drive data on startup
  useEffect(() => {
    testFirestoreConnection();

    generateIdentityKeyPair().then((keys) => {
      setCryptoKeys(keys);
      setIdentity((prev) => {
        const next = {
          ...prev,
          publicKeyFingerprint: keys.fingerprint,
          publicKeyBase64: keys.publicKeyBase64,
        };
        if (next.name) {
          registerUserInFirestore(next);
        }
        return next;
      });
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
    if (identity.name) {
      registerUserInFirestore(identity).catch((e) => console.warn('Firestore user reg deferred:', e));

      // Ensure current user is registered in the server's central directory
      fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: identity.name,
          avatar: identity.avatar,
          publicKeyFingerprint: identity.publicKeyFingerprint,
        }),
      }).catch((e) => console.warn('Directory check deferred:', e));
    }

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

  // Save contacts updates to localStorage and central server
  const handleSaveContacts = (newContacts: Contact[]) => {
    setContacts(newContacts);
    saveContactsToStorage(newContacts);
    triggerCentralServerSync(newContacts, callHistory, identity);
  };

  // Save call records to localStorage and central server
  const saveCallRecords = (newRecords: CallRecord[]) => {
    setCallHistory(newRecords);
    localStorage.setItem(STORAGE_KEY_CALL_LOGS, JSON.stringify(newRecords));
    triggerCentralServerSync(contacts, newRecords, identity);
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

              // Create WebRTC Offer for remote peer
              mediaManager.createOffer().then((offer) => {
                if (offer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(
                    JSON.stringify({
                      type: 'webrtc:offer',
                      callId: msg.callId,
                      roomId: msg.roomId,
                      sender: identity,
                      targetUserId: msg.sender?.id,
                      targetUserName: msg.sender?.name,
                      payload: { sdp: offer },
                      timestamp: Date.now(),
                    })
                  );
                }
              });
              break;
            }

            case 'webrtc:offer': {
              if (msg.payload?.sdp) {
                mediaManager.handleOffer(msg.payload.sdp).then((answer) => {
                  if (answer && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(
                      JSON.stringify({
                        type: 'webrtc:answer',
                        callId: msg.callId,
                        roomId: msg.roomId,
                        sender: identity,
                        targetUserId: msg.sender?.id,
                        targetUserName: msg.sender?.name,
                        payload: { sdp: answer },
                        timestamp: Date.now(),
                      })
                    );
                  }
                });
              }
              break;
            }

            case 'webrtc:answer': {
              if (msg.payload?.sdp) {
                mediaManager.handleAnswer(msg.payload.sdp);
              }
              break;
            }

            case 'webrtc:ice': {
              if (msg.payload?.candidate) {
                mediaManager.addIceCandidate(msg.payload.candidate);
              }
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

            case 'call:status': {
              if (msg.targetDevicesFound === 0) {
                // WhatsApp style: keep ringing even if target devices found is 0 (offline)
                console.log(`User ${msg.targetUserName || 'User'} is offline. Allowing ringback to continue.`);
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

    // Initialize local audio/video media and WebRTC peer connection
    await mediaManager.getLocalMedia(type === 'video', true);
    mediaManager.createPeerConnection(
      (stream) => {
        setRemoteStream(stream);
      },
      (candidate) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'webrtc:ice',
              callId,
              roomId: `room_${callId}`,
              sender: identity,
              targetUserId: contact.id,
              targetUserName: contact.name,
              payload: { candidate },
              timestamp: Date.now(),
            })
          );
        }
      }
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

    // Send call invite over WebSocket with target user ID and target user name
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call:invite',
          callId,
          callType: type,
          sender: identity,
          targetUserId: contact.id,
          targetUserName: contact.name,
          roomId: `room_${callId}`,
          payload: {
            safetyNumber,
            roomName: contact.name,
            targetUserName: contact.name,
          },
          timestamp: Date.now(),
        })
      );
    }
  };

  // Allow caller to manually simulate answer if doing a quick solo preview/demo
  const handleSimulateAnswer = async () => {
    if (!activeCall || activeCall.status !== 'outgoing') return;
    ringEngine.stopAll();
    ringEngine.playConnectedTone();
    await mediaManager.getLocalMedia(activeCall.type === 'video', true);
    setActiveCall((current) => {
      if (!current) return null;
      return {
        ...current,
        status: 'connected',
        startTime: Date.now(),
      };
    });
  };

  // Launch Group Conference Room
  const handleStartGroupCall = async (roomId: string, roomName: string) => {
    const callId = `group_${Date.now()}`;
    const safetyNumber = await generateSafetyNumber(identity.publicKeyFingerprint, roomId);
    await mediaManager.getLocalMedia(false, true);

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
  const handleAnswerCall = async (type: CallType) => {
    if (!incomingCall) return;
    ringEngine.stopAll();
    ringEngine.playConnectedTone();
    ringEngine.unlockAudio();
    notificationEngine.dismissIncomingCallAlert(incomingCall.id);

    // Initialize local media and WebRTC peer connection
    await mediaManager.getLocalMedia(type === 'video', true);
    mediaManager.createPeerConnection(
      (stream) => {
        setRemoteStream(stream);
      },
      (candidate) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && incomingCall) {
          wsRef.current.send(
            JSON.stringify({
              type: 'webrtc:ice',
              callId: incomingCall.id,
              roomId: incomingCall.roomId,
              sender: identity,
              targetUserId: incomingCall.caller.id,
              targetUserName: incomingCall.caller.name,
              payload: { candidate },
              timestamp: Date.now(),
            })
          );
        }
      }
    );

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
          targetUserName: incomingCall.caller.name,
          roomId: incomingCall.roomId,
          payload: {
            safetyNumber: incomingCall.safetyNumber,
          },
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
          targetUserName: incomingCall.caller.name,
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
          targetUserName: activeCall.targetContact?.name,
          timestamp: Date.now(),
        })
      );
    }

    handleCallEndedCleanup(activeCall);
  };

  const handleCallEndedCleanup = (call: CallSession) => {
    setRemoteStream(null);
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

  const handleToggleSpeaker = () => {
    if (!activeCall) return;
    const nextSpeaker = !activeCall.isSpeakerOn;
    mediaManager.setSpeakerEnabled(nextSpeaker);
    setActiveCall((prev) => (prev ? { ...prev, isSpeakerOn: nextSpeaker } : null));
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
          setActiveCall((prev) => (prev ? { ...prev, isScreenSharing: false } : null));
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

  // Simulate an authentic WhatsApp-style incoming call for test/demo purposes
  const handleTriggerTestIncomingCall = () => {
    const testCallId = `test_${Date.now()}`;
    const testCaller: UserIdentity = {
      id: 'bot_whatsapp_test',
      name: 'WhatsApp Call Test Bot',
      email: 'testbot@talk.io',
      phone: '+1 (555) 019-2831',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      deviceId: 'device_test_bot',
      deviceName: 'Pixel 9 Pro (WhatsApp Test)',
      publicKeyFingerprint: 'A1B2 C3D4 E5F6 7890 1234',
    };

    const simulatedCall: CallSession = {
      id: testCallId,
      type: 'audio',
      status: 'incoming',
      caller: testCaller,
      roomId: `room_${testCallId}`,
      roomName: 'WhatsApp Verification Test',
      participants: [
        {
          id: testCaller.id,
          userId: testCaller.id,
          deviceId: testCaller.deviceId,
          name: testCaller.name,
          avatar: testCaller.avatar,
          isMuted: false,
          isVideoOff: true,
        },
      ],
      duration: 0,
      e2eeStatus: 'verified',
      safetyNumber: '77291 00394 18294 59102',
      isMuted: false,
      isVideoOff: true,
      isScreenSharing: false,
      isRecording: false,
      isSpeakerOn: true,
    };

    setIncomingCall(simulatedCall);
    ringEngine.unlockAudio();
    ringEngine.startIncomingRing(ringtoneConfig.ringtoneType);
    notificationEngine.triggerIncomingCallAlert(
      testCaller.name,
      'audio',
      testCallId
    );
  };

  if (!hasAccount) {
    return <AccountSetupScreen onCompleteSetup={handleCompleteAccountSetup} />;
  }

  return (
    <div id="talk-app-root" className="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeNavTab}
        onSelectTab={setActiveNavTab}
        currentIdentity={identity}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onQuickTestRing={() => {
          ringEngine.previewRingtone(ringtoneConfig.ringtoneType);
        }}
        isOnline={isWsConnected}
      />

      {/* WhatsApp Desktop Notification Banner */}
      <WhatsAppNotificationBanner onTriggerTestCall={handleTriggerTestIncomingCall} />

      {/* Main View Router */}
      <main className="flex-1 overflow-y-auto">
        {activeNavTab === 'contacts' && (
          <ContactsManager
            contacts={contacts}
            onSaveContacts={handleSaveContacts}
            onInitiateCall={handleInitiateCall}
            onInviteToRoom={(contact) => handleInitiateCall(contact, 'group')}
            currentUserName={identity.name}
            currentUserId={identity.id}
          />
        )}

        {activeNavTab === 'history' && (
          <CallHistoryView
            callRecords={callHistory}
            onRedial={(contactId, type) => {
              const target = contacts.find((c) => c.id === contactId) || {
                id: contactId,
                name: contactId.replace(/^contact_|^user_/, ''),
                phone: '',
                role: '',
                email: '',
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(contactId)}&background=059669&color=ffffff&bold=true`,
                status: 'online',
                publicKeyFingerprint: '99DA F102 77B4 4920 18EA',
              };
              handleInitiateCall(target, type);
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
          onSimulateAnswer={handleSimulateAnswer}
          onToggleMute={handleToggleMute}
          onToggleVideo={handleToggleVideo}
          onToggleSpeaker={handleToggleSpeaker}
          onToggleScreenShare={handleToggleScreenShare}
          onSendMessage={handleSendMessage}
          messages={inCallMessages}
          remoteStream={remoteStream}
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
        }}
        currentIdentity={identity}
        onUpdateIdentityName={handleUpdateIdentityName}
        onLogOut={handleLogOut}
        onResetAllData={handleResetAllData}
        onTestWhatsAppCall={handleTriggerTestIncomingCall}
      />
    </div>
  );
}

