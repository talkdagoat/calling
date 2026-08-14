export type CallType = 'audio' | 'video' | 'group';
export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'connected' | 'ended' | 'declined' | 'busy';
export type E2EEStatus = 'negotiating' | 'verified' | 'unverified';
export type UserStatus = 'online' | 'in-call' | 'offline' | 'busy';

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar: string;
  status: UserStatus;
  lastSeen?: string;
  publicKeyFingerprint: string;
  deviceList?: string[];
  notes?: string;
  isFavorite?: boolean;
  tags?: string[];
}

export interface UserIdentity {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  deviceId: string;
  deviceName: string;
  publicKeyFingerprint: string;
  publicKeyBase64?: string;
}

export interface Participant {
  id: string;
  userId: string;
  deviceId: string;
  name: string;
  avatar: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
  audioLevel?: number;
  stream?: MediaStream;
  e2eeVerified?: boolean;
  role?: 'host' | 'participant';
}

export interface CallSession {
  id: string;
  type: CallType;
  status: CallStatus;
  caller: UserIdentity;
  targetContact?: Contact;
  roomId: string;
  roomName?: string;
  participants: Participant[];
  startTime?: number;
  duration: number; // in seconds
  e2eeStatus: E2EEStatus;
  safetyNumber: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRecording: boolean;
  isSpeakerOn: boolean;
  activeSpeakerId?: string;
  virtualBackground?: 'none' | 'blur' | 'office' | 'neon';
}

export interface CallRecord {
  id: string;
  contactId: string;
  contactName: string;
  contactAvatar: string;
  contactPhone: string;
  type: CallType;
  direction: 'incoming' | 'outgoing' | 'missed';
  timestamp: string;
  duration: number;
  e2eeVerified: boolean;
  notes?: string;
  aiSummary?: string;
  actionItems?: string[];
}

export interface InCallMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isEncrypted: boolean;
}

export interface AICallAssistantState {
  isActive: boolean;
  liveTranscripts: Array<{
    id: string;
    speaker: string;
    text: string;
    timestamp: string;
  }>;
  keyPoints: string[];
  actionItems: string[];
  summary: string;
  securityVerdict?: string;
  isThinking: boolean;
}

export interface RingtoneConfig {
  ringtoneType: 'modern' | 'classic' | 'cyber' | 'executive' | 'radar';
  volume: number; // 0 to 1
  vibrateEnabled: boolean;
  autoAnswerDelay?: number; // 0 for disabled
}

// WebSocket Signaling Messages
export interface SignalingMessage {
  type: 
    | 'register'
    | 'presence:update'
    | 'call:invite'
    | 'call:incoming'
    | 'call:accept'
    | 'call:accepted'
    | 'call:reject'
    | 'call:rejected'
    | 'call:cancelled_elsewhere'
    | 'call:end'
    | 'call:ended'
    | 'webrtc:offer'
    | 'webrtc:answer'
    | 'webrtc:ice'
    | 'room:join'
    | 'room:user_joined'
    | 'room:user_left'
    | 'room:state_update'
    | 'room:chat'
    | 'room:reaction'
    | 'room:hand_raise';
  sender: UserIdentity;
  targetUserId?: string;
  targetDeviceId?: string;
  roomId?: string;
  callId?: string;
  callType?: CallType;
  payload?: any;
  timestamp: number;
}
