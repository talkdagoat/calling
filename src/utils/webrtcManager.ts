type StateHandler = (state: RTCPeerConnectionState) => void;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private peer: RTCPeerConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteAudio: HTMLAudioElement | null = null;

  async getLocalMedia(video = true, audio = true): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Your browser does not provide microphone/camera access.');
    if (!video && !audio) throw new Error('The call needs a microphone or camera.');

    // IMPORTANT: use only boolean media constraints first. Safari can throw
    // "The string did not match the expected pattern" for advanced constraints.
    try {
      this.localStream?.getTracks().forEach(track => track.stop());
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: !!video, audio: !!audio });
      return this.localStream;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') throw new Error('Microphone/camera permission was denied. Allow access in the browser and try again.');
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') throw new Error('No microphone or camera was found.');
      throw new Error(error instanceof Error ? error.message : 'Could not access the microphone/camera.');
    }
  }

  createPeerConnection(onRemoteStream: (stream: MediaStream) => void, onIceCandidate: (candidate: RTCIceCandidate) => void, onState?: StateHandler) {
    this.closePeerConnection();
    this.pendingCandidates = [];
    try { this.peer = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 }); }
    catch { this.peer = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }); }

    const pc = this.peer;
    this.remoteStream = new MediaStream();
    onRemoteStream(this.remoteStream);
    this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream!));

    pc.ontrack = event => {
      const stream = this.remoteStream || new MediaStream();
      const tracks = event.streams?.[0]?.getTracks() || [event.track];
      tracks.forEach(track => { if (!stream.getTracks().some(existing => existing.id === track.id)) stream.addTrack(track); });
      this.remoteStream = stream;
      onRemoteStream(stream);
      if (this.remoteAudio) { this.remoteAudio.srcObject = stream; this.remoteAudio.play().catch(() => undefined); }
    };
    pc.onicecandidate = event => { if (event.candidate) onIceCandidate(event.candidate); };
    pc.onconnectionstatechange = () => {
      onState?.(pc.connectionState);
      if (pc.connectionState === 'failed') { try { pc.restartIce(); } catch {} }
    };
    return pc;
  }

  async createOffer() {
    if (!this.peer) throw new Error('Call connection has not started.');
    const offer = await this.peer.createOffer();
    await this.peer.setLocalDescription(offer);
    return this.peer.localDescription || offer;
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peer) throw new Error('Call connection has not started.');
    await this.peer.setRemoteDescription(offer);
    await this.flushCandidates();
    const answer = await this.peer.createAnswer();
    await this.peer.setLocalDescription(answer);
    return this.peer.localDescription || answer;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peer) throw new Error('Call connection has not started.');
    await this.peer.setRemoteDescription(answer);
    await this.flushCandidates();
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate?.candidate) return;
    if (!this.peer?.remoteDescription) { this.pendingCandidates.push(candidate); return; }
    try { await this.peer.addIceCandidate(candidate); } catch (error) { console.warn('[WebRTC] ICE candidate rejected', error); }
  }

  private async flushCandidates() {
    if (!this.peer?.remoteDescription) return;
    const candidates = this.pendingCandidates.splice(0);
    for (const candidate of candidates) { try { await this.peer.addIceCandidate(candidate); } catch {} }
  }

  setAudioMuted(muted: boolean) { this.localStream?.getAudioTracks().forEach(track => { track.enabled = !muted; }); }
  setVideoOff(off: boolean) { this.localStream?.getVideoTracks().forEach(track => { track.enabled = !off; }); }

  async startScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) return null;
    try { return await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); } catch { return null; }
  }
  stopScreenShare() {}

  attachRemoteAudioSink(element: HTMLAudioElement) {
    this.remoteAudio = element;
    element.autoplay = true;
    element.playsInline = true;
    if (this.remoteStream) { element.srcObject = this.remoteStream; element.play().catch(() => undefined); }
  }
  setSpeakerEnabled(enabled: boolean, volume = 1) { if (this.remoteAudio) { this.remoteAudio.muted = !enabled; this.remoteAudio.volume = enabled ? volume : 0; if (enabled) this.remoteAudio.play().catch(() => undefined); } }
  isSpeakerOn() { return !(this.remoteAudio?.muted ?? false); }
  getLocalStream() { return this.localStream; }
  getRemoteStream() { return this.remoteStream; }

  closePeerConnection() {
    if (this.peer) { try { this.peer.close(); } catch {} this.peer = null; }
    this.pendingCandidates = [];
    this.remoteStream?.getTracks().forEach(track => track.stop());
    this.remoteStream = null;
  }

  stopLocalMedia() {
    this.closePeerConnection();
    this.localStream?.getTracks().forEach(track => track.stop());
    this.localStream = null;
  }
}

export const mediaManager = new WebRTCManager();
