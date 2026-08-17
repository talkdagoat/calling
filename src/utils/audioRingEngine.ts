/**
 * Web Audio API synthesized telephony ringtone engine.
 * Generates pristine, instant audio alerts on all devices without external MP3 dependencies.
 */

class AudioRingEngine {
  private ctx: AudioContext | null = null;
  private isRingingIncoming: boolean = false;
  private isRingingOutgoing: boolean = false;
  private incomingIntervalId: any = null;
  private outgoingIntervalId: any = null;
  private ringtoneType: 'modern' | 'classic' | 'cyber' | 'executive' | 'radar' = 'modern';
  private volume: number = 0.85;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setRingtone(type: 'modern' | 'classic' | 'cyber' | 'executive' | 'radar') {
    this.ringtoneType = type;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  // Play a short preview of the ringtone
  public previewRingtone(type: 'modern' | 'classic' | 'cyber' | 'executive' | 'radar') {
    this.stopAll();
    const prevType = this.ringtoneType;
    this.ringtoneType = type;
    this.playIncomingPattern();
    setTimeout(() => {
      this.ringtoneType = prevType;
    }, 2800);
  }

  // Start continuous incoming call ring
  public startIncomingRing(ringtoneOverride?: 'modern' | 'classic' | 'cyber' | 'executive' | 'radar') {
    if (this.isRingingIncoming) return;
    this.stopAll();
    this.isRingingIncoming = true;

    if (ringtoneOverride) {
      this.ringtoneType = ringtoneOverride;
    }

    // Trigger physical device vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([500, 250, 500, 250, 1000]);
      } catch (e) {}
    }

    this.playIncomingPattern();

    // Repeat ring pattern every 3.2 seconds
    this.incomingIntervalId = setInterval(() => {
      if (!this.isRingingIncoming) {
        clearInterval(this.incomingIntervalId);
        return;
      }
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([500, 250, 500, 250, 1000]);
        } catch (e) {}
      }
      this.playIncomingPattern();
    }, 3200);
  }

  // Start outgoing call ringback tone (so caller hears standard ringback)
  public startOutgoingRingback() {
    if (this.isRingingOutgoing) return;
    this.stopAll();
    this.isRingingOutgoing = true;

    this.playOutgoingRingbackTone();
    this.outgoingIntervalId = setInterval(() => {
      if (!this.isRingingOutgoing) {
        clearInterval(this.outgoingIntervalId);
        return;
      }
      this.playOutgoingRingbackTone();
    }, 3500);
  }

  // Stop all ringing immediately
  public stopAll() {
    this.isRingingIncoming = false;
    this.isRingingOutgoing = false;
    if (this.incomingIntervalId) {
      clearInterval(this.incomingIntervalId);
      this.incomingIntervalId = null;
    }
    if (this.outgoingIntervalId) {
      clearInterval(this.outgoingIntervalId);
      this.outgoingIntervalId = null;
    }
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  }

  // 1. Modern Melodic Marimba Chime
  private playModernChime(ctx: AudioContext, now: number) {
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.35 }, // C5
      { freq: 659.25, time: 0.18, dur: 0.35 }, // E5
      { freq: 783.99, time: 0.36, dur: 0.40 }, // G5
      { freq: 1046.50, time: 0.54, dur: 0.70 }, // C6
      { freq: 880.00, time: 1.10, dur: 0.35 }, // A5
      { freq: 1046.50, time: 1.28, dur: 0.70 }, // C6
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, now + note.time);

      gain.gain.setValueAtTime(0, now + note.time);
      gain.gain.linearRampToValueAtTime(0.35 * this.volume, now + note.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.time + note.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + note.time);
      osc.stop(now + note.time + note.dur + 0.05);
    });
  }

  // 2. Classic Dual-Tone Telephony Ring (440Hz + 480Hz)
  private playClassicRing(ctx: AudioContext, now: number) {
    [0, 0.9].forEach(offset => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now + offset);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now + offset);

      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.28 * this.volume, now + offset + 0.04);
      gain.gain.setValueAtTime(0.28 * this.volume, now + offset + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.75);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now + offset);
      osc2.start(now + offset);
      osc1.stop(now + offset + 0.8);
      osc2.stop(now + offset + 0.8);
    });
  }

  // 3. Cyber Electronic FM Synth
  private playCyberSynth(ctx: AudioContext, now: number) {
    const freqs = [330, 440, 587, 880, 1174];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + idx * 0.12);

      gain.gain.setValueAtTime(0, now + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.22 * this.volume, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.3);
    });
  }

  // 4. Executive Soft Bell Chime
  private playExecutiveChime(ctx: AudioContext, now: number) {
    const chord = [440, 554.37, 659.25, 830.61]; // A major 7th
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.25 * this.volume, now + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.3);
    });
  }

  // 5. Radar Alert Beeps
  private playRadarBeep(ctx: AudioContext, now: number) {
    [0, 0.35, 0.7].forEach(t => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now + t);
      osc.frequency.exponentialRampToValueAtTime(1400, now + t + 0.15);

      gain.gain.setValueAtTime(0, now + t);
      gain.gain.linearRampToValueAtTime(0.3 * this.volume, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + t);
      osc.stop(now + t + 0.2);
    });
  }

  private playIncomingPattern() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      switch (this.ringtoneType) {
        case 'modern':
          this.playModernChime(ctx, now);
          break;
        case 'classic':
          this.playClassicRing(ctx, now);
          break;
        case 'cyber':
          this.playCyberSynth(ctx, now);
          break;
        case 'executive':
          this.playExecutiveChime(ctx, now);
          break;
        case 'radar':
          this.playRadarBeep(ctx, now);
          break;
      }
    } catch (e) {
      console.warn('Audio ring engine error:', e);
    }
  }

  private playOutgoingRingbackTone() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12 * this.volume, now + 0.05);
      gain.gain.setValueAtTime(0.12 * this.volume, now + 1.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.8);
      osc2.stop(now + 1.8);
    } catch (e) {}
  }

  // Play crisp positive connection tone
  public playConnectedTone() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25 * this.volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } catch (e) {}
  }

  // Play soft descending call ended tone
  public playEndCallTone() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.35);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22 * this.volume, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.42);
    } catch (e) {}
  }

  // Play security verified chime
  public playVerifiedChime() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      [587.33, 880, 1174.66].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.2 * this.volume, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.55);
      });
    } catch (e) {}
  }

  public unlockAudio() {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
  }
}

export const ringEngine = new AudioRingEngine();

if (typeof window !== 'undefined') {
  const unlock = () => {
    ringEngine.unlockAudio();
  };
  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

