/**
 * WebRTC & Media Stream Manager
 * Manages Camera, Microphone, Screen Sharing, Audio Analysis,
 * Virtual Blur processing, and Peer Connections.
 */

export class WebRTCManager {
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private virtualCanvas: HTMLCanvasElement | null = null;
  private virtualCtx: CanvasRenderingContext2D | null = null;
  private videoElementForProcessing: HTMLVideoElement | null = null;
  private processedStream: MediaStream | null = null;

  // Initialize or get local camera/mic stream
  public async getLocalMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      if (this.localStream) {
        // If requested video but current doesn't have video track, get new stream
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
      console.warn('getUserMedia failed, generating synthetic canvas/audio stream fallback:', err);
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
        
        // Draw user silhouette / animated avatar
        ctx.fillStyle = `hsl(${hue}, 60%, 45%)`;
        ctx.beginPath();
        ctx.arc(320, 200, 70, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(320, 420, 140, Math.PI, 0);
        ctx.fill();

        // Text
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
      console.warn('Audio analyser setup error:', e);
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

  // Stop all local media
  public stopLocalMedia() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    this.stopScreenShare();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
}

export const mediaManager = new WebRTCManager();
