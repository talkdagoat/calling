/**
 * Production WebRTC & Media Stream Manager.
 *
 * Media is peer-to-peer. Signaling is handled by the app's WebSocket server.
 * ICE servers are configurable through VITE_ICE_SERVERS or the individual
 * VITE_TURN_* variables so deployments can use a real TURN relay when a
 * network cannot establish a direct peer connection.
 */

function getIceServers(): RTCIceServer[] {
  const configured = import.meta.env.VITE_ICE_SERVERS;
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (error) {
      console.warn('[WebRTC] Invalid VITE_ICE_SERVERS JSON:', error);
    }
  }

  const servers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
  const turnUsername = import.meta.env.VITE_TURN_USERNAME?.trim();
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return servers;
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
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private isSpeakerActive = true;
  private speakerVolume = 1;
  private connectionStateHandler: ((state: WebRTCConnectionState) => void) | null = null;

  public async getLocalMedia(video = true, audio = true): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support microphone/camera access.');
    }

    if (this.localStream) {
      const hasVideo = this.localStream.getVideoTracks().length > 0;
      const hasAudio = this.localStream.getAudioTracks().length > 0;
      if (hasVideo === video && hasAudio === audio) return this.localStream;
      this.stopLocalMedia();
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 },
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      });

      this.localStream = stream;
      this.setupAudioAnalyser(stream);
      return stream;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        throw new Error('Microphone/camera permission was denied. Allow access and try the call again.');
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        throw new Error('No microphone/camera was found for this call.');
      }
      throw new Error(error instanceof Error ? error.message : 'Unable to access your microphone/camera.');
    }
  }

  private setupAudioAnalyser(stream: MediaStream) {
    try {
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
    } catch (error) {
      console.warn('[WebRTC] Audio analyser unavailable:', error);
    }
  }

  public getAudioVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.length
      ? dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
      : 0;
    return Math.min(100, Math.round((avg / 128) * 100));
  }

  public setAudioMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
  }

  public setVideoOff(off: boolean) {
    this.localStream?.getVideoTracks().forEach(track => { track.enabled = !off; });
  }

  public async startScreenShare(): Promise<MediaStream | null> {
    if (!navigator.mediaDevices?.getDisplayMedia) return null;
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      return this.screenStream;
    } catch {
      return null;
    }
  }

  public stopScreenShare() {
    this.screenStream?.getTracks().forEach(track => track.stop());
    this.screenStream = null;
  }

  public createPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onConnectionStateChange?: (state: WebRTCConnectionState) => void,
  ): RTCPeerConnection {
    this.closePeerConnection();
    this.pendingIceCandidates = [];
    this.connectionStateHandler = onConnectionStateChange || null;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnection = pc;
    this.remoteStream = new MediaStream();
    onRemoteStream(this.remoteStream);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.ontrack = event => {
      if (!this.remoteStream) this.remoteStream = new MediaStream();
      for (const track of event.streams[0]?.getTracks() || [event.track]) {
        if (!this.remoteStream.getTracks().some(existing => existing.id === track.id)) {
          this.remoteStream.addTrack(track);
        }
      }
      onRemoteStream(this.remoteStream);
      if (this.remoteAudioElement) {
        this.remoteAudioElement.srcObject = this.remoteStream;
        this.remoteAudioElement.play().catch(() => undefined);
      }
    };

    pc.onicecandidate = event => {
      if (event.candidate) onIceCandidate(event.candidate);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] connectionState:', state);
      this.connectionStateHandler?.(state);
      if (state === 'failed') {
        // Give the other peer a chance to gather a fresh route.
        pc.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        pc.restartIce();
      }
    };

    return pc;
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Call connection has not been initialized.');
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    return this.peerConnection.localDescription || offer;
  }

  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) throw new Error('Call connection has not been initialized.');
    await this.peerConnection.setRemoteDescription(offer);
    await this.flushPendingIceCandidates();
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return this.peerConnection.localDescription || answer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) throw new Error('Call connection has not been initialized.');
    await this.peerConnection.setRemoteDescription(answer);
    await this.flushPendingIceCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!candidate || !candidate.candidate) return;
    if (!this.peerConnection?.remoteDescription) {
      this.pendingIceCandidates.push(candidate);
      return;
    }
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.warn('[WebRTC] Failed to add ICE candidate:', error);
    }
  }

  private async flushPendingIceCandidates() {
    if (!this.peerConnection?.remoteDescription) return;
    const pending = this.pendingIceCandidates.splice(0);
    for (const candidate of pending) {
      try {
        await this.peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.warn('[WebRTC] Failed to flush ICE candidate:', error);
      }
    }
  }

  public attachRemoteAudioSink(audioElement: HTMLAudioElement) {
    this.remoteAudioElement = audioElement;
    audioElement.autoplay = true;
    audioElement.playsInline = true;
    audioElement.volume = this.isSpeakerActive ? this.speakerVolume : 0;
    if (this.remoteStream) {
      audioElement.srcObject = this.remoteStream;
      audioElement.play().catch(() => undefined);
    }
  }

  public setSpeakerEnabled(enabled: boolean, volume = 1) {
    this.isSpeakerActive = enabled;
    this.speakerVolume = volume;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.volume = enabled ? volume : 0;
      this.remoteAudioElement.muted = !enabled;
      if (enabled && this.remoteAudioElement.paused) {
        this.remoteAudioElement.play().catch(() => undefined);
      }
    }
  }

  public isSpeakerOn() { return this.isSpeakerActive; }
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
    this.connectionStateHandler = null;
    this.pendingIceCandidates = [];
    this.remoteStream?.getTracks().forEach(track => track.stop());
    this.remoteStream = null;
  }

  public stopLocalMedia() {
    this.closePeerConnection();
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
    this.stopScreenShare();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => undefined);
    }
    this.audioContext = null;
    this.analyser = null;
  }
}

export const mediaManager = new WebRTCManager();
