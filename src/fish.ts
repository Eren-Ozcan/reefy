import { BlurFilter, Container, Graphics, Rectangle } from 'pixi.js';
import { RARITY_INFO, Species } from './species';
import type { FishSave } from './save';

export const HUNGER_RATE = 1 / (90 * 60); // per second — full -> hungry in 90 min
export const SAD_THRESHOLD = 0.25;
/** Hunger never fully stops growth: full speed at 100% fed, still continues at this rate even at 0% fed. */
export const HUNGER_GROWTH_FLOOR = 0.3;

/** Growth speed multiplier based on hunger: 0 fed -> HUNGER_GROWTH_FLOOR, 1 fed -> 1. */
export function hungerGrowthMult(hunger: number): number {
  return HUNGER_GROWTH_FLOOR + (1 - HUNGER_GROWTH_FLOOR) * hunger;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Produces a deterministic deviation in the -1..1 range from the species' id. Ensures that even species in the same family (same tailShape/dorsalStyle) don't share the exact same geometry. */
function idJitter(id: string, salt: number): number {
  let h = 0;
  const s = id + ':' + salt;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return ((h >>> 0) % 2001) / 1000 - 1;
}

export interface Bounds { w: number; h: number }

export class Fish {
  root = new Container();
  private tail = new Graphics();
  private body = new Container();
  private sad = new Graphics();
  private glow: Graphics | null = null;
  /** The tap target at full width, before the turn animation squashes scale.x. */
  private baseHit: Rectangle | null = null;

  sp: Species;
  progress: number;
  hunger: number;
  name: string;
  seed: number;
  tank: string;
  bonus: number; // feed-derived sale price bonus

  x: number; y: number;
  private tx = 0; private ty = 0;
  private wanderTimer = 0;
  private dir = 1; // smoothed direction, -1..1
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
    return this.progress >= 1 ? 'Adult' : this.progress >= 0.5 ? 'Young' : 'Baby';
  }
  get scaleFactor(): number { return 0.4 + 0.6 * Math.min(1, this.progress); }

  toSave(): FishSave {
    return {
      sp: this.sp.id, progress: this.progress, hunger: this.hunger,
      name: this.name, seed: this.seed, tank: this.tank, bonus: this.bonus,
    };
  }

  private drawTail(L: number, H: number, FS: number, color: number, shape: Species['tailShape']): void {
    const ext = L * 0.34 * FS;
    const t = this.tail;
    switch (shape) {
      case 'forked': {
        const notch = ext * 0.35;
        t.moveTo(0, 0)
          .lineTo(-ext, -H * 0.55 * FS)
          .lineTo(-ext + notch, -H * 0.1 * FS)
          .lineTo(-ext, 0)
          .lineTo(-ext + notch, H * 0.1 * FS)
          .lineTo(-ext, H * 0.55 * FS)
          .closePath()
          .fill(color);
        break;
      }
      case 'lunate': {
        t.moveTo(0, 0)
          .quadraticCurveTo(-ext * 0.55, -H * 0.3 * FS, -ext * 1.15, -H * 0.62 * FS)
          .quadraticCurveTo(-ext * 0.62, -H * 0.14 * FS, -ext * 0.5, 0)
          .quadraticCurveTo(-ext * 0.62, H * 0.14 * FS, -ext * 1.15, H * 0.62 * FS)
          .quadraticCurveTo(-ext * 0.55, H * 0.3 * FS, 0, 0)
          .closePath()
          .fill(color);
        break;
      }
      case 'round': {
        t.moveTo(0, -H * 0.03)
          .quadraticCurveTo(-ext * 1.1, -H * 0.55 * FS, -ext * 0.6, 0)
          .quadraticCurveTo(-ext * 1.1, H * 0.55 * FS, 0, H * 0.03)
          .closePath()
          .fill(color);
        break;
      }
      case 'lyre': {
        t.moveTo(0, 0)
          .quadraticCurveTo(-ext * 0.5, -H * 0.2 * FS, -ext * 1.5, -H * 0.7 * FS)
          .quadraticCurveTo(-ext * 0.85, -H * 0.12 * FS, -ext * 0.3, 0)
          .quadraticCurveTo(-ext * 0.85, H * 0.12 * FS, -ext * 1.5, H * 0.7 * FS)
          .quadraticCurveTo(-ext * 0.5, H * 0.2 * FS, 0, 0)
          .closePath()
          .fill(color);
        break;
      }
      case 'ribbon': {
        t.moveTo(0, -H * 0.08)
          .lineTo(-ext * 1.8, -H * 0.09)
          .lineTo(-ext * 1.95, 0)
          .lineTo(-ext * 1.8, H * 0.09)
          .lineTo(0, H * 0.08)
          .closePath()
          .fill(color);
        break;
      }
      default: // 'lens'
        t.moveTo(0, 0)
          .lineTo(-ext, -H * 0.45 * FS)
          .quadraticCurveTo(-ext * 0.6, 0, -ext, H * 0.45 * FS)
          .closePath()
          .fill(color);
    }
  }

  private buildSprite(): void {
    const sp = this.sp;
    const L = sp.size;
    // Species-specific fixed deviations derived from the id: keeps species sharing the same family visually distinct.
    const jTail = 1 + 0.09 * idJitter(sp.id, 1);
    const jDorsal = 1 + 0.14 * idJitter(sp.id, 2);
    const jEye = 1 + 0.09 * idJitter(sp.id, 3);
    const jDetail = 1 + 0.08 * idJitter(sp.id, 5);
    const H = L * ((sp.bodyH ?? 0.48) + 0.025 * idJitter(sp.id, 4));
    const FS = sp.finScale ?? 1;
    const c = sp.colors;
    const rnd = mulberry32(this.seed + 7);

    // Rarity glow (epic/legendary)
    if (sp.rarity === 'epic' || sp.rarity === 'legendary') {
      this.glow = new Graphics();
      this.glow.circle(0, 0, L * 0.72).fill({
        color: RARITY_INFO[sp.rarity].glow,
        alpha: sp.rarity === 'legendary' ? 0.45 : 0.28,
      });
      this.glow.filters = [new BlurFilter({ strength: 14 })];
      this.root.addChild(this.glow);
    }

    // Tail (rotation center is the joint with the body)
    this.tail.position.set(-L / 2 + 2, 0);
    this.drawTail(L, H, FS * jTail, c.fin, sp.tailShape);
    this.root.addChild(this.tail);

    // Body
    const bodyG = new Graphics();
    bodyG.ellipse(0, 0, L / 2, H / 2).fill(c.body);
    switch (sp.snout) {
      case 'long':
        bodyG.moveTo(L * 0.42, -H * 0.05).lineTo(L * 0.66, -H * 0.02).lineTo(L * 0.42, H * 0.09).closePath().fill(c.body);
        break;
      case 'hump':
        bodyG.circle(L * 0.2, -H * 0.44, L * 0.1).fill(c.body);
        break;
      case 'blunt':
        bodyG.roundRect(L * 0.4, -H * 0.14, L * 0.1, H * 0.28, L * 0.03).fill(c.body);
        break;
    }
    this.body.addChild(bodyG);

    // Pattern layer (masked by the body ellipse)
    const maskG = new Graphics();
    maskG.ellipse(0, 0, L / 2, H / 2).fill(0xffffff);
    const patG = new Graphics();
    patG.ellipse(L * 0.02, H * 0.16, L * 0.4 * jDetail, H * 0.32).fill(c.belly);
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

    // Fins
    const finsG = new Graphics();
    const DFS = FS * jDorsal;
    switch (sp.dorsalStyle) {
      case 'flowing':
        finsG
          .moveTo(-L * 0.22, -H / 2 + 2)
          .quadraticCurveTo(-L * 0.02, -H / 2 - H * 0.55 * DFS, L * 0.18, -H / 2 - H * 0.78 * DFS)
          .quadraticCurveTo(L * 0.3, -H / 2 - H * 0.3 * DFS, L * 0.26, -H / 2 + 2)
          .closePath()
          .fill({ color: c.fin, alpha: 0.9 });
        break;
      case 'sail':
        finsG
          .moveTo(-L * 0.26, -H / 2 + 2)
          .lineTo(L * 0.0, -H / 2 - H * 0.85 * DFS)
          .lineTo(L * 0.3, -H / 2 + 2)
          .closePath()
          .fill({ color: c.fin, alpha: 0.95 });
        break;
      default:
        finsG
          .moveTo(-L * 0.15, -H / 2 + 2)
          .lineTo(L * 0.05, -H / 2 - H * 0.45 * DFS)
          .lineTo(L * 0.22, -H / 2 + 2)
          .closePath()
          .fill({ color: c.fin, alpha: 0.95 });
    }
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
      .lineTo(-L * 0.14 * jDetail, H * 0.34 * jDetail)
      .lineTo(L * 0.12, H * 0.22)
      .closePath()
      .fill({ color: c.fin, alpha: 0.8 });
    this.body.addChild(finsG);

    // Eye
    const eyeG = new Graphics();
    eyeG.circle(L * 0.3, -H * 0.08, L * 0.052 * jEye).fill(0xffffff);
    eyeG.circle(L * 0.315, -H * 0.08, L * 0.026 * jEye).fill(0x26262e);
    eyeG.circle(L * 0.3, -H * 0.1, L * 0.011 * jEye).fill(0xffffff);
    this.body.addChild(eyeG);

    this.root.addChild(this.body);

    // Padded rectangular tap target: the precise silhouette (thin tail/fins,
    // gaps between shapes) is unreliable to tap on mobile, so use a generous
    // bounding box instead of exact hit-testing.
    const hb = this.root.getLocalBounds();
    const padX = L * 0.22, padY = H * 0.5;
    this.baseHit = new Rectangle(hb.x - padX, hb.y - padY, hb.width + padX * 2, hb.height + padY * 2);
    this.root.hitArea = this.baseHit.clone();

    // Hunger indicator
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

  /**
   * Keeps the tap target the width the fish LOOKS, not the width it is scaled to.
   *
   * Turning is animated by sliding scale.x through zero, clamped to a twelfth, so
   * mid-turn a fish is squashed to a sliver — and the hit area, being in local
   * space, was squashed with it. Fish wander constantly, so they are turning much
   * of the time: that is why tapping one worked only sometimes. Dividing the local
   * rectangle by the same factor holds its on-screen size constant through the
   * turn. Deliberately generous at the extreme: a fish seen edge-on is nearly
   * invisible but still worth a full-size target, since the player aims where it
   * appears to be.
   */
  private syncHitArea(dirX: number): void {
    const base = this.baseHit;
    if (!base) return;
    const k = 1 / Math.max(0.12, Math.abs(dirX));
    const r = this.root.hitArea as Rectangle;
    r.x = base.x * k;
    r.y = base.y;
    r.width = base.width * k;
    r.height = base.height;
  }

  /** dt: seconds. target: feed target (if any). growthMult: tank+decor bonus. Returns: whether it became an adult this frame. */
  update(dt: number, time: number, bounds: Bounds, target: { x: number; y: number } | null, growthMult = 1): boolean {
    this.hunger = Math.max(0, this.hunger - dt * HUNGER_RATE);

    let justGrown = false;
    if (this.progress < 1) {
      this.progress += (dt * 1000 * growthMult * hungerGrowthMult(this.hunger)) / this.sp.growthMs;
      if (this.progress >= 1 && !this.wasAdult) {
        this.progress = 1;
        this.wasAdult = true;
        justGrown = true;
      }
    }

    // Target selection: toward feed if any, otherwise toward the wander point
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

    // Smooth direction turn
    if (Math.abs(vx) > 2) {
      const want = Math.sign(vx);
      this.dir += (want - this.dir) * Math.min(1, dt * 5);
    }
    const sf = this.scaleFactor;
    const dirX = Math.abs(this.dir) < 0.12 ? 0.12 * (this.dir >= 0 ? 1 : -1) : this.dir;
    this.root.scale.set(sf * dirX, sf);
    this.syncHitArea(dirX);
    this.root.position.set(this.x, this.y + Math.sin(time * 1.6 + this.phase) * 3);

    this.tail.rotation = Math.sin(time * (target ? 10 : 6) + this.phase) * 0.4;
    this.sad.visible = this.isSad;
    if (this.glow && this.sp.rarity === 'legendary') {
      this.glow.alpha = 0.75 + 0.25 * Math.sin(time * 2 + this.phase);
    }
    return justGrown;
  }
}
