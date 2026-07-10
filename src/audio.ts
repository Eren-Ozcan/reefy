// Tüm sesler WebAudio ile sentezlenir — harici dosya/lisans yok.
import type { Rarity } from './species';

class AudioMan {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private ambientOn = false;
  private chordTimer: number | null = null;
  music = true;
  sfx = true;

  ensure(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number, dur: number, type: OscillatorType = 'sine',
    vol = 0.15, when = 0, slideTo = 0,
  ): void {
    if (!this.sfx || !this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  click(): void { this.ensure(); this.tone(660, 0.07, 'triangle', 0.1); }
  plop(): void { this.ensure(); this.tone(340, 0.12, 'sine', 0.18, 0, 120); }
  bubble(): void { this.ensure(); this.tone(500 + Math.random() * 500, 0.08, 'sine', 0.05, 0, 900); }
  coin(): void {
    this.ensure();
    this.tone(880, 0.09, 'square', 0.07);
    this.tone(1318, 0.14, 'square', 0.07, 0.08);
  }
  grown(): void {
    this.ensure();
    this.tone(523, 0.12, 'triangle', 0.12);
    this.tone(784, 0.18, 'triangle', 0.12, 0.1);
  }
  levelup(): void {
    this.ensure();
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.13, i * 0.09));
  }
  hatch(rarity: Rarity): void {
    this.ensure();
    const base = rarity === 'legendary' ? 700 : rarity === 'epic' ? 620 : 540;
    for (let i = 0; i < 6; i++) {
      this.tone(base + Math.random() * 500, 0.14, 'sine', 0.08, i * 0.06);
    }
    if (rarity === 'legendary' || rarity === 'epic') {
      [659, 830, 988, 1318].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.11, 0.4 + i * 0.1));
    }
  }
  error(): void { this.ensure(); this.tone(220, 0.15, 'sawtooth', 0.06); }

  startAmbient(): void {
    if (!this.music || this.ambientOn) return;
    const ctx = this.ensure();
    this.ambientOn = true;

    // Okyanus uğultusu: filtrelenmiş gürültü döngüsü
    const len = 2 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    noise.connect(lp); lp.connect(ng); ng.connect(this.musicGain);
    noise.start();

    // Lo-fi akor pedi
    const chords = [
      [261.6, 329.6, 392.0],
      [220.0, 277.2, 329.6],
      [246.9, 311.1, 370.0],
      [196.0, 246.9, 293.7],
    ];
    let ci = 0;
    const playChord = () => {
      if (!this.ctx || !this.ambientOn) return;
      const t0 = this.ctx.currentTime;
      for (const f of chords[ci % chords.length]) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.detune.value = (Math.random() - 0.5) * 8;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.045, t0 + 2.4);
        g.gain.linearRampToValueAtTime(0.0001, t0 + 7.6);
        osc.connect(g); g.connect(this.musicGain);
        osc.start(t0);
        osc.stop(t0 + 8);
      }
      ci++;
    };
    playChord();
    this.chordTimer = window.setInterval(playChord, 8000);
    this.musicGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 2);
  }

  stopAmbient(): void {
    this.ambientOn = false;
    if (this.chordTimer !== null) { clearInterval(this.chordTimer); this.chordTimer = null; }
    if (this.ctx) this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
  }

  setMusic(on: boolean): void {
    this.music = on;
    if (on) this.startAmbient();
    else this.stopAmbient();
  }
  setSfx(on: boolean): void { this.sfx = on; }
}

export const audio = new AudioMan();
