/**
 * WebRTC media/signaling manager.
 * The call protocol follows the working Talk5 pattern: media is peer-to-peer,
 * while the server only forwards SDP and ICE signaling messages.
 */

function validIceUrl(value: unknown): value is string {
  return typeof value === 'string' && /^(stun|turn|turns):[^\s]+$/i.test(value.trim());
}

function getIceServers(): RTCIceServer[] {
  const fallback: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ];

  const configured = import.meta.env.VITE_ICE_SERVERS;
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed)) {
        const configuredServers = parsed.flatMap((entry: any) => {
          if (!entry || typeof entry !== 'object') return [];
          const urls = Array.isArray(entry.urls) ? entry.urls.filter(validIceUrl) : validIceUrl(entry.urls) ? [entry.urls] : [];
          if (!urls.length) return [];
          return [{
            urls,
            ...(entry.username ? { username: String(entry.username) } : {}),
            ...(entry.credential ? { credential: String(entry.credential) } : {}),
          } as RTCIceServer];
        });
        if (configuredServers.length) return [...configuredServers, ...fallback.filter(server => !configuredServers.some(item => JSON.stringify(item.urls) === JSON.stringify(server.urls)))];
      }
    } catch (error) {
      console.warn('[WebRTC] Ignoring invalid VITE_ICE_SERVERS:', error);
    }
  }

  const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
  const turnUsername = import.meta.env.VITE_TURN_USERNAME?.trim();
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();
  if (validIceUrl(turnUrl) && turnUsername && turnCredential) {
    return [{ urls: turnUrl, username: turnUsername, credential: turnCredential }, ...fallback];
  }
  return fallback;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: getIceServers(),
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

export type WebRTCConnectionState = RTCPeerConnectionState;

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private remoteAudioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speakerActive = true;
  private speakerVolume = 1;
  private connectionHandler: ((state: WebRTCConnectionState) => void) | null = null;

  public async getLocalMedia(video = true, audio = true): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support microphone/camera access.');
    if (this.localStream) {
      if (this.localStream.getVideoTracks().length === Number(video) && this.localStream.getAudioTracks().length === Number(audio)) return this.localStream;
      this.stopLocalMedia();
    }

    const advanced: MediaStreamConstraints = {
      audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
      video: video ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user', frameRate: { ideal: 30 } } : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(advanced);
    } catch (firstError) {
      const name = firstError instanceof DOMException ? firstError.name : '';
      const message = firstError instanceof Error ? firstError.message : String(firstError);
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') throw new Error('Microphone/camera permission was denied. Allow access and try the call again.');
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') throw new Error('No microphone/camera was found for this call.');
      if (/expected pattern|overconstrained|syntaxerror/i.test(message)) {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: Boolean(audio), video: Boolean(video) });
        } catch (fallbackError) {
          throw new Error(fallbackError instanceof Error ? fallbackError.message : 'Unable to access your microphone/camera.');
        }
      } else {
        throw new Error(message || 'Unable to access your microphone/camera.');
      }
    }

    this.setupAudioAnalyser(this.localStream);
    return this.localStream;
  }

  private setupAudioAnalyser(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const tracks = stream.getAudioTracks();
      if (!AudioCtx || !tracks.length) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
    } catch (error) {
      console.warn('[WebRTC] Audio analyser unavailable:', error);
    }
  }

  public getAudioVolume() {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const average = data.length ? data.reduce((sum, value) => sum + value, 0) / data.length : 0;
    return Math.min(100, Math.round((average / 128) * 100));
  }

  public setAudioMuted(muted: boolean) { this.localStream?.getAudioTracks().forEach(track => { track.enabled = !muted; }); }
  public setVideoOff(off: boolean) { this.localStream?.getVideoTracks().forEach(track => { track.enabled = !off; }); }

  public async startScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) return null;
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      return this.screenStream;
    } catch { return null; }
  }

  public stopScreenShare() {
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.screenStream = null;
  }

  public createPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionStateChange?: (state: WebRTCConnectionState) => void,
  ) {
    this.closePeerConnection();
    this.pendingIceCandidates = [];
    this.connectionHandler = onConnectionStateChange || null;

    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection(RTC_CONFIG);
    } catch (error) {
      console.warn('[WebRTC] Retrying peer connection with STUN-only configuration:', error);
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }], iceCandidatePoolSize: 10 });
    }
    this.peerConnection = pc;
    this.remoteStream = new MediaStream();
    onRemoteStream(this.remoteStream);

    this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream!));

    pc.ontrack = event => {
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      const tracks = event.streams?.[0]?.getTracks() || [event.track];
      for (const track of tracks) if (!this.remoteStream.getTracks().some(existing => existing.id === track.id)) this.remoteStream.addTrack(track);
      onRemoteStream(this.remoteStream);
      if (this.remoteAudioElement) {
        this.remoteAudioElement.srcObject = this.remoteStream;
        this.remoteAudioElement.play().catch(() => undefined);
      }
    };

    pc.onicecandidate = event => { if (event.candidate) onIceCandidate(event.candidate); };
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState:', pc.connectionState);
      this.connectionHandler?.(pc.connectionState);
      if (pc.connectionState === 'failed') {
        try { pc.restartIce(); } catch {}
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        try { pc.restartIce(); } catch {}
      }
    };
    return pc;
  }

  public async createOffer() {
    if (!this.peerConnection) throw new Error('Call connection has not been initialized.');
    const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await this.peerConnection.setLocalDescription(offer);
    return this.peerConnection.localDescription || offer;
  }

  public async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) throw new Error('Call connection has not been initialized.');
    await this.peerConnection.setRemoteDescription(offer);
    await this.flushPendingIceCandidates();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return this.peerConnection.localDescription || answer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peerConnection) throw new Error('Call connection has not been initialized.');
    await this.peerConnection.setRemoteDescription(answer);
    await this.flushPendingIceCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate?.candidate) return;
    if (!this.peerConnection?.remoteDescription) {
      this.pendingIceCandidates.push(candidate);
      return;
    }
    try { await this.peerConnection.addIceCandidate(candidate); } catch (error) { console.warn('[WebRTC] ICE candidate rejected:', error); }
  }

  private async flushPendingIceCandidates() {
    if (!this.peerConnection?.remoteDescription) return;
    const pending = this.pendingIceCandidates.splice(0);
    for (const candidate of pending) {
      try { await this.peerConnection.addIceCandidate(candidate); } catch {}
    }
  }

  public attachRemoteAudioSink(audioElement: HTMLAudioElement) {
    this.remoteAudioElement = audioElement;
    audioElement.autoplay = true;
    audioElement.playsInline = true;
    audioElement.volume = this.speakerActive ? this.speakerVolume : 0;
    if (this.remoteStream) {
      audioElement.srcObject = this.remoteStream;
      audioElement.play().catch(() => undefined);
    }
  }

  public setSpeakerEnabled(enabled: boolean, volume = 1) {
    this.speakerActive = enabled;
    this.speakerVolume = volume;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.volume = enabled ? volume : 0;
      this.remoteAudioElement.muted = !enabled;
      if (enabled) this.remoteAudioElement.play().catch(() => undefined);
    }
  }

  public isSpeakerOn() { return this.speakerActive; }
  public getLocalStream() { return this.localStream; }
  public getRemoteStream() { return this.remoteStream; }

  public closePeerConnection() {
    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }
    this.pendingIceCandidates = [];
    this.connectionHandler = null;
    this.remoteStream?.getTracks().forEach(track => track.stop());
    this.remoteStream = null;
  }

  public stopLocalMedia() {
    this.closePeerConnection();
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.stopScreenShare();
    if (this.audioContext && this.audioContext.state !== 'closed') this.audioContext.close().catch(() => undefined);
    this.audioContext = null;
    this.analyser = null;
  }
}

export const mediaManager = new WebRTCManager();
