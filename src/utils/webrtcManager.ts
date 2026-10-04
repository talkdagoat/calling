type StateHandler = (state: RTCPeerConnectionState) => void;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function errorText(stage: string, error: unknown): Error {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : 'UnknownError';
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`[${stage}] ${name}: ${message}`);
}

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private peer: RTCPeerConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteAudio: HTMLAudioElement | null = null;
  private screenStream: MediaStream | null = null;
  private cameraVideoTrack: MediaStreamTrack | null = null;
  private lastOfferSdp = '';
  private answerInProgress = false;
  private offerInProgress = false;

  async getLocalMedia(video = true, audio = true): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('[getUserMedia] This browser does not provide microphone/camera access.');
    if (!video && !audio) throw new Error('[getUserMedia] The call needs a microphone or camera.');

    const existingAudio = this.localStream?.getAudioTracks().length > 0;
    const existingVideo = this.localStream?.getVideoTracks().length > 0;
    if (this.localStream && (!video || existingVideo) && (!audio || existingAudio)) return this.localStream;

    try {
      this.localStream?.getTracks().forEach(track => track.stop());
      this.localStream = await navigator.mediaDevices.getUserMedia({ video: !!video, audio: !!audio });
      this.cameraVideoTrack = this.localStream.getVideoTracks()[0] || null;
      return this.localStream;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') throw new Error('[getUserMedia] Microphone/camera permission was denied. Allow access in Safari/Android and try again.');
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') throw new Error('[getUserMedia] No microphone or camera was found.');
      throw errorText('getUserMedia', error);
    }
  }

  createPeerConnection(onRemoteStream: (stream: MediaStream) => void, onIceCandidate: (candidate: RTCIceCandidate) => void, onState?: StateHandler) {
    this.closePeerConnection();
    this.pendingCandidates = [];
    this.lastOfferSdp = '';
    this.answerInProgress = false;
    this.offerInProgress = false;

    try { this.peer = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 0 }); }
    catch (firstError) {
      console.warn('[WebRTC] ICE configuration rejected; retrying without ICE servers.', firstError);
      try { this.peer = new RTCPeerConnection(); }
      catch (secondError) { throw errorText('RTCPeerConnection', secondError); }
    }

    const pc = this.peer;
    this.remoteStream = new MediaStream();
    onRemoteStream(this.remoteStream);

    try { this.localStream?.getTracks().forEach(track => pc.addTrack(track, this.localStream!)); }
    catch (error) { throw errorText('addTrack', error); }

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
    if (!this.peer) throw new Error('[createOffer] Call connection has not started.');
    if (this.offerInProgress) return this.peer.localDescription;
    if (this.peer.signalingState !== 'stable') {
      if (this.peer.signalingState === 'have-local-offer') return this.peer.localDescription;
      throw new Error(`[createOffer] Cannot create an offer while signaling state is ${this.peer.signalingState}.`);
    }
    this.offerInProgress = true;
    try {
      const offer = await this.peer.createOffer();
      if (this.peer.signalingState !== 'stable') return this.peer.localDescription;
      await this.peer.setLocalDescription(offer);
      return this.peer.localDescription || offer;
    } catch (error) { throw errorText('createOffer', error); }
    finally { this.offerInProgress = false; }
  }

  async handleOffer(offer: RTCSessionDescriptionInit) {
    if (!this.peer) throw new Error('[handleOffer] Call connection has not started.');
    if (!offer || offer.type !== 'offer' || !offer.sdp) throw new Error('[handleOffer] Received an invalid WebRTC offer.');

    // A signaling server can deliver the same offer more than once. Once an SDP has
    // been answered, that exact offer must never be processed again. Re-processing it
    // is what can make Safari reach setLocalDescription(answer) in the stable state.
    if (this.lastOfferSdp === offer.sdp) return null;
    if (this.answerInProgress) return null;

    try {
      if (this.peer.signalingState === 'have-local-offer') {
        await this.peer.setRemoteDescription({ type: 'rollback' });
      }
      if (this.peer.signalingState !== 'stable') {
        if (this.peer.signalingState === 'have-remote-offer') return null;
        throw new Error(`Cannot accept an offer while signaling state is ${this.peer.signalingState}.`);
      }

      this.answerInProgress = true;
      await this.peer.setRemoteDescription(offer);
      this.lastOfferSdp = offer.sdp;
      await this.flushCandidates();
      const answer = await this.peer.createAnswer();
      if (this.peer.signalingState !== 'have-remote-offer') return null;
      await this.peer.setLocalDescription(answer);
      return this.peer.localDescription || answer;
    } catch (error) { throw errorText('handleOffer', error); }
    finally { this.answerInProgress = false; }
  }

  async handleAnswer(answer: RTCSessionDescriptionInit) {
    if (!this.peer) throw new Error('[handleAnswer] Call connection has not started.');
    if (!answer || answer.type !== 'answer' || !answer.sdp) throw new Error('[handleAnswer] Received an invalid WebRTC answer.');
    if (this.peer.signalingState !== 'have-local-offer') return;
    try { await this.peer.setRemoteDescription(answer); await this.flushCandidates(); }
    catch (error) { throw errorText('handleAnswer', error); }
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    if (!candidate?.candidate) return;
    if (!this.peer?.remoteDescription) { this.pendingCandidates.push(candidate); return; }
    try { await this.peer.addIceCandidate(candidate); }
    catch (error) { console.warn('[WebRTC][addIceCandidate] Ignoring late ICE candidate:', error); }
  }

  private async flushCandidates() {
    if (!this.peer?.remoteDescription) return;
    const candidates = this.pendingCandidates.splice(0);
    for (const candidate of candidates) {
      try { await this.peer.addIceCandidate(candidate); }
      catch (error) { console.warn('[WebRTC][flushCandidates] Ignoring late ICE candidate:', error); }
    }
  }

  setAudioMuted(muted: boolean) { this.localStream?.getAudioTracks().forEach(track => { track.enabled = !muted; }); }
  setVideoOff(off: boolean) { this.localStream?.getVideoTracks().forEach(track => { track.enabled = !off; }); }

  async startScreenShare() {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('[screenShare] This browser does not provide screen sharing.');
    if (!this.peer) throw new Error('[screenShare] The call connection has not started.');
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = this.screenStream.getVideoTracks()[0];
      if (!screenTrack) throw new Error('No screen video track was returned.');
      const sender = this.peer.getSenders().find(item => item.track?.kind === 'video');
      if (!sender) throw new Error('This call does not have a video track to replace.');
      this.cameraVideoTrack = this.cameraVideoTrack || this.localStream?.getVideoTracks()[0] || null;
      await sender.replaceTrack(screenTrack);
      screenTrack.onended = () => { this.stopScreenShare().catch(() => undefined); };
      return this.screenStream;
    } catch (error) {
      this.screenStream?.getTracks().forEach(track => track.stop()); this.screenStream = null;
      if (error instanceof Error && error.message.startsWith('[screenShare]')) throw error;
      throw errorText('screenShare', error);
    }
  }

  async stopScreenShare() {
    const cameraTrack = this.cameraVideoTrack || this.localStream?.getVideoTracks()[0] || null;
    const sender = this.peer?.getSenders().find(item => item.track?.kind === 'video' || !item.track);
    if (sender && cameraTrack) await sender.replaceTrack(cameraTrack);
    this.screenStream?.getTracks().forEach(track => track.stop()); this.screenStream = null;
  }

  attachRemoteAudioSink(element: HTMLAudioElement) {
    this.remoteAudio = element; element.autoplay = true; element.playsInline = true;
    if (this.remoteStream) { element.srcObject = this.remoteStream; element.play().catch(() => undefined); }
  }
  setSpeakerEnabled(enabled: boolean, volume = 1) {
    if (this.remoteAudio) { this.remoteAudio.muted = !enabled; this.remoteAudio.volume = enabled ? volume : 0; if (enabled) this.remoteAudio.play().catch(() => undefined); }
  }
  isSpeakerOn() { return !(this.remoteAudio?.muted ?? false); }
  getLocalStream() { return this.localStream; }
  getRemoteStream() { return this.remoteStream; }
  getAudioVolume() { return 0; }

  closePeerConnection() {
    if (this.peer) { try { this.peer.close(); } catch {} this.peer = null; }
    this.pendingCandidates = [];
    this.remoteStream?.getTracks().forEach(track => track.stop()); this.remoteStream = null;
    this.screenStream?.getTracks().forEach(track => track.stop()); this.screenStream = null;
    this.lastOfferSdp = ''; this.answerInProgress = false; this.offerInProgress = false;
  }

  stopLocalMedia() { this.closePeerConnection(); this.localStream?.getTracks().forEach(track => track.stop()); this.localStream = null; this.cameraVideoTrack = null; }
}

export const mediaManager = new WebRTCManager();