import type { JobState } from './types';

type CueKind = 'success' | 'warning' | 'inlet';

/** Optional, local-only synthesized feedback. Every audio failure is nonfatal. */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private pump: OscillatorNode | null = null;
  private pumpGain: GainNode | null = null;
  private muted = true;
  private disposed = false;
  private cues = new Set<OscillatorNode>();

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setValueAtTime(muted ? 0 : 0.2, this.context.currentTime);
    }
    if (muted) {
      this.cancelSpeech();
      for (const oscillator of this.cues) {
        try { oscillator.stop(); } catch { /* Already stopped. */ }
      }
      this.cues.clear();
    }
  }

  async unlock(): Promise<void> {
    if (this.disposed || this.muted) return;
    try {
      if (!this.context) {
        const AudioCtor = globalThis.AudioContext;
        if (!AudioCtor) return;
        this.context = new AudioCtor();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.2;
        this.master.connect(this.context.destination);
        this.pumpGain = this.context.createGain();
        this.pumpGain.gain.value = 0;
        this.pumpGain.connect(this.master);
        this.pump = this.context.createOscillator();
        this.pump.type = 'triangle';
        this.pump.frequency.value = 66;
        this.pump.connect(this.pumpGain);
        this.pump.start();
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      // Captioned gameplay continues when the browser blocks or lacks audio.
    }
  }

  update(state: JobState): void {
    if (state.paused) this.cancelSpeech();
    if (!this.context || !this.pump || !this.pumpGain || this.context.state === 'closed') return;
    try {
      const pumping = state.started && !state.paused && state.active && state.tool === 'vacuum' && state.flow > 0;
      const targetGain = pumping && !this.muted ? 0.19 : 0;
      this.pumpGain.gain.setTargetAtTime(targetGain, this.context.currentTime, 0.045);
      const pitch = state.bogged ? 43 : 62 + state.throttle * 48 - state.heat * 0.15;
      this.pump.frequency.setTargetAtTime(pitch, this.context.currentTime, 0.06);
    } catch { /* An audio device can disappear without interrupting the job. */ }
  }

  cue(kind: CueKind): void {
    if (this.muted || !this.context || !this.master || this.context.state !== 'running') return;
    try {
      const oscillator = this.context.createOscillator();
      const envelope = this.context.createGain();
      const now = this.context.currentTime;
      const duration = kind === 'inlet' ? 0.45 : 0.22;
      oscillator.type = kind === 'warning' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(kind === 'warning' ? 240 : kind === 'inlet' ? 120 : 440, now);
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'warning' ? 180 : kind === 'inlet' ? 350 : 660, now + duration);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(0.22, now + 0.02);
      envelope.gain.linearRampToValueAtTime(0, now + duration);
      oscillator.connect(envelope);
      envelope.connect(this.master);
      this.cues.add(oscillator);
      oscillator.onended = () => { this.cues.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
      oscillator.start(now);
      oscillator.stop(now + duration + 0.01);
    } catch { /* Captions carry the same information. */ }
  }

  sayPhrase(): void {
    if (this.muted || this.disposed) return;
    try {
      if (!('speechSynthesis' in globalThis) || !('SpeechSynthesisUtterance' in globalThis)) return;
      // Only an installed local voice; never select a remote speech service.
      const voice = globalThis.speechSynthesis.getVoices().find(candidate => candidate.localService && candidate.lang.startsWith('en'));
      if (!voice) return;
      this.cancelSpeech();
      const utterance = new SpeechSynthesisUtterance('Smells like money!');
      utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.volume = 0.65;
      utterance.onerror = () => { /* Caption remains visible. */ };
      globalThis.speechSynthesis.speak(utterance);
    } catch { /* Installed speech is optional. */ }
  }

  private cancelSpeech(): void {
    try {
      if ('speechSynthesis' in globalThis && (globalThis.speechSynthesis.speaking || globalThis.speechSynthesis.pending)) {
        globalThis.speechSynthesis.cancel();
      }
    } catch { /* No available speech service. */ }
  }

  dispose(): void {
    this.setMuted(true);
    this.disposed = true;
    try { this.pump?.stop(); } catch { /* Already stopped. */ }
    if (this.context) void this.context.close().catch(() => undefined);
    this.context = null;
  }
}
