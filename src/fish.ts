import { BlurFilter, Container, Graphics } from 'pixi.js';
import { RARITY_INFO, Species } from './species';
import type { FishSave } from './save';

export const HUNGER_RATE = 1 / (90 * 60); // saniyede — 90 dk'da tok -> aç
export const SAD_THRESHOLD = 0.25;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Bounds { w: number; h: number }

export class Fish {
  root = new Container();
  private tail = new Graphics();
  private body = new Container();
  private sad = new Graphics();
  private glow: Graphics | null = null;

  sp: Species;
  progress: number;
  hunger: number;
  name: string;
  seed: number;
  tank: string;
  bonus: number; // yem kaynaklı satış fiyatı bonusu

  x: number; y: number;
  private tx = 0; private ty = 0;
  private wanderTimer = 0;
  private dir = 1; // -1..1 arasında yumuşatılmış yön
  private phase = Math.random() * Math.PI * 2;
  private speedMul: number;
  private wasAdult: boolean;

  constructor(fs: FishSave, sp: Species, bounds: Bounds) {
    this.sp = sp;
    this.progress = fs.progress;
    this.hunger = fs.hunger;
    this.name = fs.name;
    this.seed = fs.seed;
    this.tank = fs.tank;
    this.bonus = fs.bonus ?? 0;
    this.wasAdult = fs.progress >= 1;

    const rnd = mulberry32(fs.seed);
    this.speedMul = 0.8 + rnd() * 0.5;
    this.x = 60 + rnd() * Math.max(60, bounds.w - 120);
    this.y = 90 + rnd() * Math.max(60, bounds.h - 220);
    this.pickWander(bounds);

    this.buildSprite();
    this.root.eventMode = 'static';
    this.root.cursor = 'pointer';
  }

  get isAdult(): boolean { return this.progress >= 1; }
  get isSad(): boolean { return this.hunger < SAD_THRESHOLD; }
  get stageName(): string {
    return this.progress >= 1 ? 'Yetişkin' : this.progress >= 0.5 ? 'Genç' : 'Yavru';
  }
  get scaleFactor(): number { return 0.4 + 0.6 * Math.min(1, this.progress); }

  toSave(): FishSave {
    return {
      sp: this.sp.id, progress: this.progress, hunger: this.hunger,
      name: this.name, seed: this.seed, tank: this.tank, bonus: this.bonus,
    };
  }

  private buildSprite(): void {
    const sp = this.sp;
    const L = sp.size;
    const H = L * (sp.bodyH ?? 0.48);
    const FS = sp.finScale ?? 1;
    const c = sp.colors;
    const rnd = mulberry32(this.seed + 7);

    // Nadirlik parıltısı (epik/efsanevi)
    if (sp.rarity === 'epic' || sp.rarity === 'legendary') {
      this.glow = new Graphics();
      this.glow.circle(0, 0, L * 0.72).fill({
        color: RARITY_INFO[sp.rarity].glow,
        alpha: sp.rarity === 'legendary' ? 0.45 : 0.28,
      });
      this.glow.filters = [new BlurFilter({ strength: 14 })];
      this.root.addChild(this.glow);
    }

    // Kuyruk (rotasyon merkezi gövdeye bağlantı noktası)
    this.tail.position.set(-L / 2 + 2, 0);
    this.tail
      .moveTo(0, 0)
      .lineTo(-L * 0.34 * FS, -H * 0.45 * FS)
      .quadraticCurveTo(-L * 0.2 * FS, 0, -L * 0.34 * FS, H * 0.45 * FS)
      .closePath()
      .fill(c.fin);
    this.root.addChild(this.tail);

    // Gövde
    const bodyG = new Graphics();
    bodyG.ellipse(0, 0, L / 2, H / 2).fill(c.body);
    this.body.addChild(bodyG);

    // Desen katmanı (gövde elipsi ile maskelenir)
    const maskG = new Graphics();
    maskG.ellipse(0, 0, L / 2, H / 2).fill(0xffffff);
    const patG = new Graphics();
    patG.ellipse(L * 0.02, H * 0.16, L * 0.4, H * 0.32).fill(c.belly);
    switch (sp.pattern) {
      case 'stripes': {
        const xs = sp.id === 'palyaco' ? [-0.28, 0, 0.28] : [-0.22, 0, 0.22];
        for (const fx of xs) {
          patG.rect(fx * L - L * 0.055, -H / 2, L * 0.11, H).fill(c.accent);
        }
        break;
      }
      case 'hstripe':
        patG.rect(-L / 2, -H * 0.12, L, H * 0.16).fill(c.accent);
        break;
      case 'spots':
        for (let i = 0; i < 7; i++) {
          patG.circle((rnd() - 0.5) * L * 0.68, (rnd() - 0.5) * H * 0.6, L * (0.035 + rnd() * 0.03)).fill(c.accent);
        }
        break;
      case 'gradient':
        patG.rect(-L * 0.05, -H / 2, L * 0.55, H).fill(c.accent);
        break;
    }
    patG.mask = maskG;
    this.body.addChild(maskG, patG);

    // Yüzgeçler
    const finsG = new Graphics();
    finsG
      .moveTo(-L * 0.15, -H / 2 + 2)
      .lineTo(L * 0.05, -H / 2 - H * 0.45 * FS)
      .lineTo(L * 0.22, -H / 2 + 2)
      .closePath()
      .fill({ color: c.fin, alpha: 0.95 });
    if (sp.spiky) {
      for (let i = 0; i < 5; i++) {
        const sx = -L * 0.3 + i * L * 0.14;
        finsG
          .moveTo(sx, -H / 2 + 3)
          .lineTo(sx + L * 0.03, -H / 2 - H * 0.55)
          .lineTo(sx + L * 0.07, -H / 2 + 3)
          .closePath()
          .fill({ color: c.fin, alpha: 0.85 });
      }
    }
    finsG
      .moveTo(L * 0.02, H * 0.08)
      .lineTo(-L * 0.14, H * 0.34)
      .lineTo(L * 0.12, H * 0.22)
      .closePath()
      .fill({ color: c.fin, alpha: 0.8 });
    this.body.addChild(finsG);

    // Göz
    const eyeG = new Graphics();
    eyeG.circle(L * 0.3, -H * 0.08, L * 0.052).fill(0xffffff);
    eyeG.circle(L * 0.315, -H * 0.08, L * 0.026).fill(0x26262e);
    eyeG.circle(L * 0.3, -H * 0.1, L * 0.011).fill(0xffffff);
    this.body.addChild(eyeG);

    this.root.addChild(this.body);

    // Açlık göstergesi
    this.sad.circle(0, 0, 9).fill({ color: 0xffffff, alpha: 0.9 });
    for (let i = 0; i < 3; i++) this.sad.circle(-4 + i * 4, 0, 1.4).fill(0x8a94a0);
    this.sad.position.set(0, -H * 0.9 - 14);
    this.sad.visible = false;
    this.root.addChild(this.sad);
  }

  private pickWander(bounds: Bounds): void {
    this.tx = 50 + Math.random() * Math.max(60, bounds.w - 100);
    this.ty = 80 + Math.random() * Math.max(60, bounds.h - 200);
    this.wanderTimer = 3 + Math.random() * 4;
  }

  /** dt: saniye. target: yem hedefi (varsa). growthMult: akvaryum+dekor bonusu. Dönüş: bu karede yetişkin oldu mu. */
  update(dt: number, time: number, bounds: Bounds, target: { x: number; y: number } | null, growthMult = 1): boolean {
    this.hunger = Math.max(0, this.hunger - dt * HUNGER_RATE);

    let justGrown = false;
    if (!this.isSad && this.progress < 1) {
      this.progress += (dt * 1000 * growthMult) / this.sp.growthMs;
      if (this.progress >= 1 && !this.wasAdult) {
        this.progress = 1;
        this.wasAdult = true;
        justGrown = true;
      }
    }

    // Hedef seçimi: yem varsa ona, yoksa gezinti noktasına
    let dx: number, dy: number, speed: number;
    if (target) {
      dx = target.x - this.x; dy = target.y - this.y;
      speed = 75 * this.speedMul;
    } else {
      this.wanderTimer -= dt;
      dx = this.tx - this.x; dy = this.ty - this.y;
      if (this.wanderTimer <= 0 || Math.hypot(dx, dy) < 8) this.pickWander(bounds);
      speed = 26 * this.speedMul;
    }
    if (this.isSad) speed *= 0.45;

    const dist = Math.hypot(dx, dy) || 1;
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    this.x = Math.min(bounds.w - 40, Math.max(40, this.x + vx * dt));
    this.y = Math.min(bounds.h - 100, Math.max(64, this.y + vy * dt));

    // Yumuşak yön dönüşü
    if (Math.abs(vx) > 2) {
      const want = Math.sign(vx);
      this.dir += (want - this.dir) * Math.min(1, dt * 5);
    }
    const sf = this.scaleFactor;
    const dirX = Math.abs(this.dir) < 0.12 ? 0.12 * (this.dir >= 0 ? 1 : -1) : this.dir;
    this.root.scale.set(sf * dirX, sf);
    this.root.position.set(this.x, this.y + Math.sin(time * 1.6 + this.phase) * 3);

    this.tail.rotation = Math.sin(time * (target ? 10 : 6) + this.phase) * 0.4;
    this.sad.visible = this.isSad;
    if (this.glow && this.sp.rarity === 'legendary') {
      this.glow.alpha = 0.75 + 0.25 * Math.sin(time * 2 + this.phase);
    }
    return justGrown;
  }
}
