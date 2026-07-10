// Tüm sesler WebAudio ile sentezlenir — harici dosya/lisans yok.
import type { Rarity } from './species';
import type { Biome } from './tanks';

// Her biyomun kendi akor atmosferi var
const BIOME_CHORDS: Record<Biome, number[][]> = {
  tropik: [
    [261.6, 329.6, 392.0], [220.0, 277.2, 329.6], [246.9, 311.1, 370.0], [196.0, 246.9, 293.7],
  ],
  lagun: [
    [293.7, 370.0, 440.0], [261.6, 329.6, 392.0], [220.0, 293.7, 370.0], [246.9, 293.7, 392.0],
  ],
  derin: [
    [130.8, 155.6, 196.0], [110.0, 130.8, 164.8], [123.5, 146.8, 185.0], [98.0, 123.5, 146.8],
  ],
  magara: [
    [146.8, 174.6, 220.0], [130.8, 164.8, 196.0], [110.0, 146.8, 174.6], [123.5, 155.6, 185.0],
  ],
  kutup: [
    [329.6, 415.3, 493.9], [293.7, 370.0, 440.0], [349.2, 440.0, 523.3], [311.1, 392.0, 466.2],
  ],
  gunbatimi: [
    [233.1, 293.7, 349.2, 415.3], [207.7, 261.6, 311.1, 370.0], [196.0, 246.9, 293.7, 349.2], [220.0, 277.2, 329.6, 392.0],
  ],
  mistik: [
    [261.6, 329.6, 370.0, 493.9], [293.7, 370.0, 415.3], [246.9, 311.1, 370.0, 466.2], [220.0, 277.2, 329.6, 415.3],
  ],
};

class AudioMan {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private ambientOn = false;
  private chordTimer: number | null = null;
  private biome: Biome = 'tropik';
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
  place(): void { this.ensure(); this.tone(180, 0.14, 'sine', 0.16, 0, 90); this.tone(420, 0.08, 'triangle', 0.07, 0.05); }
  quest(): void {
    this.ensure();
    [659, 830, 988].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.12, i * 0.08));
  }

  /** Aktif akvaryum biyomuna göre müzik atmosferini değiştirir. */
  setBiome(b: Biome): void {
    if (this.biome === b) return;
    this.biome = b;
    if (this.ambientOn) {
      this.stopAmbient();
      this.startAmbient();
    }
  }

  /** Müzik kanalına tek nota (mutlak zamanlı). */
  private mnote(freq: number, dur: number, type: OscillatorType, vol: number, when: number, detune = 0): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  /** Pizzicato tını: hızlı sönümlü tatlı vuruş. */
  private pluck(freq: number, when: number, vol = 0.055): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(freq * 4, when);
    lp.frequency.exponentialRampToValueAtTime(freq * 1.5, when + 0.25);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    osc.connect(lp); lp.connect(g); g.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.4);
  }

  startAmbient(): void {
    if (!this.music || this.ambientOn) return;
    const ctx = this.ensure();
    this.ambientOn = true;

    // Hafif okyanus uğultusu (arka dokuda)
    const len = 2 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 240;
    const ng = ctx.createGain();
    ng.gain.value = 0.028;
    noise.connect(lp); lp.connect(ng); ng.connect(this.musicGain);
    noise.start();

    // Neşeli su altı ezgisi: bas + hafif pad + pizzicato arpej, biyoma göre tonalite
    const chords = BIOME_CHORDS[this.biome];
    const BAR = 3.2; // saniye — bir akorluk ölçü
    let bar = 0;
    const playBar = () => {
      if (!this.ctx || !this.ambientOn) return;
      const t0 = this.ctx.currentTime + 0.06;
      const chord = chords[bar % chords.length];
      const root = chord[0];

      // Yumuşak bas
      this.mnote(root / 2, BAR * 0.85, 'sine', 0.06, t0);
      this.mnote(root / 2, BAR * 0.35, 'sine', 0.045, t0 + BAR * 0.5);

      // İnce pad
      for (const f of chord) this.mnote(f, BAR, 'triangle', 0.02, t0, (Math.random() - 0.5) * 7);

      // Pizzicato arpej (8'lik, hafif aksak — su damlası hissi)
      const seq = [0, 1, 2, 1, 3, 2, 1, 2];
      for (let i = 0; i < 8; i++) {
        if ((bar * 3 + i) % 11 === 10) continue; // ara sıra nefes payı
        const when = t0 + i * (BAR / 8) + (i % 2 === 1 ? 0.055 : 0);
        const tone = chord[seq[i] % chord.length];
        const oct = i >= 4 ? 2 : 1;
        this.pluck(tone * oct, when, i % 4 === 0 ? 0.06 : 0.045);
      }

      // Dört ölçüde bir tepede parıltı
      if (bar % 4 === 3) this.pluck(chord[chord.length - 1] * 4, t0 + BAR * 0.5, 0.028);
      bar++;
    };
    playBar();
    this.chordTimer = window.setInterval(playBar, BAR * 1000);
    this.musicGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 1.2);
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
