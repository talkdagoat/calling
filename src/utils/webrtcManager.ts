/**
 * WebRTC & Media Stream Manager
 * Manages Camera, Microphone, Screen Sharing, Audio Analysis,
 * Peer Connections, Remote Stream playback and Speaker output routing.
 */

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private remoteAudioElement: HTMLAudioElement | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private isSpeakerActive: boolean = true;
  private speakerVolume: number = 1.0;

  // Initialize or get local camera/mic stream
  public async getLocalMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      if (this.localStream) {
        const hasVideo = this.localStream.getVideoTracks().length > 0;
        const hasAudio = this.localStream.getAudioTracks().length > 0;
        if (hasVideo === video && hasAudio === audio) {
          return this.localStream;
        }
        this.stopLocalMedia();
      }

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
    } catch (err) {
      console.warn('getUserMedia fallback (synthetic stream created):', err);
      return this.createSyntheticStream(video, audio);
    }
  }

  // Create clean synthetic fallback stream for headless/restricted preview environments
  private createSyntheticStream(video: boolean, audio: boolean): MediaStream {
    const stream = new MediaStream();

    if (video) {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      let hue = 210;

      const draw = () => {
        ctx.fillStyle = `hsl(${hue}, 40%, 18%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = `hsl(${hue}, 60%, 45%)`;
        ctx.beginPath();
        ctx.arc(320, 200, 70, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(320, 420, 140, Math.PI, 0);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Encrypted HD Feed (Simulated / Preview)', 320, 290);

        hue = (hue + 0.2) % 360;
        requestAnimationFrame(draw);
      };
      draw();

      const canvasStream = canvas.captureStream(30);
      canvasStream.getVideoTracks().forEach(track => stream.addTrack(track));
    }

    if (audio) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const dst = ctx.createMediaStreamDestination();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001; // subtle
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        dst.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      } catch (e) {
        console.warn('Audio synthesis fallback notice:', e);
      }
    }

    this.localStream = stream;
    return stream;
  }

  // Setup Web Audio Analyser for mic volume level metering
  private setupAudioAnalyser(stream: MediaStream) {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
    } catch (e) {
      console.warn('Audio analyser setup notice:', e);
    }
  }

  // Get current speaking volume level (0 to 100)
  public getAudioVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const avg = sum / dataArray.length;
    return Math.min(100, Math.round((avg / 128) * 100));
  }

  // Toggle local microphone mute
  public setAudioMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  // Toggle local camera on/off
  public setVideoOff(off: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = !off;
      });
    }
  }

  // Start Screen Sharing
  public async startScreenShare(): Promise<MediaStream | null> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      this.screenStream = screenStream;
      return screenStream;
    } catch (e) {
      console.warn('Screen share cancelled or not allowed', e);
      return null;
    }
  }

  // Stop Screen Sharing
  public stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(track => track.stop());
      this.screenStream = null;
    }
  }

  // WebRTC Peer Connection Lifecycle
  public createPeerConnection(
    onRemoteStream: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): RTCPeerConnection {
    this.closePeerConnection();

    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peerConnection = pc;

    this.remoteStream = new MediaStream();
    onRemoteStream(this.remoteStream);

    if (this.remoteAudioElement) {
      this.remoteAudioElement.srcObject = this.remoteStream;
      this.remoteAudioElement.play().catch(e => console.warn('Remote audio autoplay waiting for user gesture:', e));
    }

    // Attach local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (this.remoteStream) {
        this.remoteStream.addTrack(event.track);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
    };

    return pc;
  }

  // Create WebRTC SDP Offer
  public async createOffer(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;
    try {
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this.peerConnection.setLocalDescription(offer);
      return offer;
    } catch (e) {
      console.error('[WebRTC] Create offer error:', e);
      return null;
    }
  }

  // Handle incoming WebRTC SDP Offer and generate SDP Answer
  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) return null;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      // Flush pending ICE candidates
      while (this.pendingIceCandidates.length > 0) {
        const candidate = this.pendingIceCandidates.shift()!;
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      return answer;
    } catch (e) {
      console.error('[WebRTC] Handle offer error:', e);
      return null;
    }
  }

  // Handle incoming WebRTC SDP Answer
  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      // Flush pending ICE candidates
      while (this.pendingIceCandidates.length > 0) {
        const candidate = this.pendingIceCandidates.shift()!;
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      }
    } catch (e) {
      console.error('[WebRTC] Handle answer error:', e);
    }
  }

  // Add ICE Candidate
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.peerConnection && this.peerConnection.remoteDescription) {
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Add ICE candidate error:', e);
      }
    } else {
      this.pendingIceCandidates.push(candidate);
    }
  }

  // Bind Remote Audio Output Element
  public attachRemoteAudioSink(audioElement: HTMLAudioElement) {
    this.remoteAudioElement = audioElement;
    audioElement.volume = this.isSpeakerActive ? this.speakerVolume : 0.0;
    if (this.remoteStream) {
      audioElement.srcObject = this.remoteStream;
      audioElement.play().catch(() => {});
    }
  }

  // Toggle or Set Speaker Output (Loudspeaker vs Earphone / Mute)
  public setSpeakerEnabled(enabled: boolean, volume: number = 1.0) {
    this.isSpeakerActive = enabled;
    this.speakerVolume = volume;
    if (this.remoteAudioElement) {
      this.remoteAudioElement.volume = enabled ? volume : 0.0;
      this.remoteAudioElement.muted = !enabled;
      if (enabled && this.remoteAudioElement.paused) {
        this.remoteAudioElement.play().catch(() => {});
      }
    }
  }

  public isSpeakerOn(): boolean {
    return this.isSpeakerActive;
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public closePeerConnection() {
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
    this.pendingIceCandidates = [];
    this.remoteStream = null;
  }

  // Stop all media & peer connections
  public stopLocalMedia() {
    this.closePeerConnection();
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.stopScreenShare();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }
}

export const mediaManager = new WebRTCManager();

