import { Application, Container, FillGradient, Graphics } from 'pixi.js';
import { audio } from './audio';
import { Bounds, Fish } from './fish';
import { FishSave, SaveData, loadSave, persist, wipeSave } from './save';
import {
  EGGS, EggTier, FISH_NAMES, RARITY_INFO, Rarity, SPECIES, Species, speciesById,
} from './species';
import type { UI } from './ui';

interface Pellet { x: number; y: number; vy: number; sway: number; age: number }
interface Particle { x: number; y: number; vy: number; life: number; color: number; r: number }
interface Kelp { fx: number; h: number; phase: number; color: number }

const OFFLINE_CAP_MS = 8 * 3600_000;
const OFFLINE_SPEED = 0.5;
const HUNGER_RATE_MS = 1 / (90 * 60_000);

export interface OfflineSummary { minutes: number; grown: number; dailyGift: boolean }

export class Game {
  app = new Application();
  ui!: UI;
  save: SaveData;
  fishes: Fish[] = [];

  private world = new Container();
  private bgG = new Graphics();
  private sandG = new Graphics();
  private decorG = new Graphics();
  private kelpG = new Graphics();
  private rays: Graphics[] = [];
  private rayLayer = new Container();
  private fishLayer = new Container();
  private pelletG = new Graphics();
  private fxG = new Graphics();
  private bubbleG = new Graphics();

  private pellets: Pellet[] = [];
  private particles: Particle[] = [];
  private bubbles: { x: number; y: number; r: number; vy: number; phase: number }[] = [];
  private kelps: Kelp[] = [];
  private time = 0;
  offline: OfflineSummary = { minutes: 0, grown: 0, dailyGift: false };

  constructor() {
    this.save = loadSave();
  }

  get bounds(): Bounds {
    return { w: this.app.screen.width, h: this.app.screen.height };
  }
  get capacity(): number { return Math.min(6 + this.save.level, 24); }
  get sellMult(): number { return 1 + 0.05 * this.completedSets().length; }

  xpNeed(level: number): number { return Math.round(120 * Math.pow(level, 1.35)); }

  completedSets(): Rarity[] {
    const out: Rarity[] = [];
    for (const r of Object.keys(RARITY_INFO) as Rarity[]) {
      const all = SPECIES.filter((s) => s.rarity === r);
      if (all.length && all.every((s) => this.save.collection.includes(s.id))) out.push(r);
    }
    return out;
  }

  async init(host: HTMLElement): Promise<void> {
    await this.app.init({ resizeTo: host, antialias: true, background: 0x2f7f96 });
    host.appendChild(this.app.canvas);

    this.world.addChild(
      this.bgG, this.rayLayer, this.kelpG, this.decorG, this.sandG,
      this.pelletG, this.fishLayer, this.bubbleG, this.fxG,
    );
    this.app.stage.addChild(this.world);

    this.applyOffline();
    this.applyDailyGift();

    // Kelp/kabarcık yerleşimi (yüzde bazlı — resize'da korunur)
    const kelpColors = [0x4da674, 0x66bb8a, 0x3f9764, 0x5cb07e];
    for (let i = 0; i < 5; i++) {
      this.kelps.push({
        fx: [0.08, 0.2, 0.55, 0.78, 0.93][i],
        h: 0.22 + Math.random() * 0.16,
        phase: Math.random() * Math.PI * 2,
        color: kelpColors[i % kelpColors.length],
      });
    }
    for (let i = 0; i < 22; i++) {
      this.bubbles.push({
        x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 3.5,
        vy: 14 + Math.random() * 26, phase: Math.random() * Math.PI * 2,
      });
    }

    this.buildStatic();
    this.app.renderer.on('resize', () => this.buildStatic());

    for (const fs of this.save.fishes) this.spawnFish(fs);

    this.app.ticker.add((t) => this.update(t.deltaMS / 1000));

    window.setInterval(() => this.syncSave(), 6000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.syncSave();
    });
    window.addEventListener('beforeunload', () => this.syncSave());
  }

  // ---------- sahne ----------

  private buildStatic(): void {
    const { w, h } = this.bounds;

    this.bgG.clear();
    const grad = new FillGradient(0, 0, 0, h);
    grad.addColorStop(0, 0x9fe0da);
    grad.addColorStop(0.55, 0x58aab4);
    grad.addColorStop(1, 0x2f7f96);
    this.bgG.rect(0, 0, w, h).fill(grad);

    this.sandG.clear();
    this.sandG.rect(0, h - 64, w, 64).fill(0xe8d5a8);
    this.sandG.ellipse(w * 0.5, h - 64, w * 0.6, 14).fill(0xe8d5a8);
    for (let i = 0; i < 70; i++) {
      this.sandG.circle(Math.random() * w, h - 58 + Math.random() * 52, 1 + Math.random() * 2).fill(0xd9bf8c);
    }
    for (let i = 0; i < 6; i++) {
      const px = Math.random() * w;
      this.sandG.ellipse(px, h - 20 - Math.random() * 20, 8 + Math.random() * 10, 5 + Math.random() * 5).fill(0xc9b08a);
    }

    // Mercanlar
    this.decorG.clear();
    const coral = (cx: number, color: number) => {
      for (let i = 0; i < 7; i++) {
        this.decorG.circle(cx - 34 + i * 11, h - 62 - Math.abs(3 - i) * -2 - (10 + Math.sin(i * 2.1) * 8), 11 + (i % 3) * 3).fill(color);
      }
    };
    coral(w * 0.3, 0xf4a09a);
    coral(w * 0.85, 0xe88c9d);
    for (let i = 0; i < 4; i++) {
      const tx = w * 0.62 + i * 13;
      const th = 26 + (i % 2) * 14;
      this.decorG.roundRect(tx, h - 60 - th, 9, th, 4).fill(0xf0a35e);
      this.decorG.circle(tx + 4.5, h - 60 - th, 5).fill(0xf7bd80);
    }

    // Işık huzmeleri
    this.rayLayer.removeChildren();
    this.rays = [];
    for (let i = 0; i < 4; i++) {
      const g = new Graphics();
      const rx = w * (0.15 + i * 0.22);
      g.moveTo(rx, -20)
        .lineTo(rx + 34, -20)
        .lineTo(rx + 150, h * 0.85)
        .lineTo(rx - 60, h * 0.85)
        .closePath()
        .fill({ color: 0xffffff, alpha: 0.06 });
      g.blendMode = 'add';
      this.rays.push(g);
      this.rayLayer.addChild(g);
    }
  }

  private drawKelp(): void {
    const { w, h } = this.bounds;
    this.kelpG.clear();
    for (const k of this.kelps) {
      const baseX = k.fx * w;
      const segs = 6;
      const segLen = (k.h * h) / segs;
      let px = baseX;
      let py = h - 58;
      for (let i = 0; i < segs; i++) {
        const ang = Math.sin(this.time * 0.8 + k.phase + i * 0.55) * 0.14 * (i / segs + 0.4);
        const nx = px + Math.sin(ang) * segLen;
        const ny = py - Math.cos(ang) * segLen;
        this.kelpG.moveTo(px, py);
        this.kelpG.lineTo(nx, ny);
        this.kelpG.stroke({ width: 7 - i * 0.7, color: k.color, cap: 'round' });
        if (i > 0) {
          const side = i % 2 === 0 ? 1 : -1;
          this.kelpG.ellipse(px + side * 8, py, 9, 4).fill({ color: k.color, alpha: 0.85 });
        }
        px = nx; py = ny;
      }
    }
  }

  // ---------- döngü ----------

  private update(dt: number): void {
    this.time += dt;
    const { w, h } = this.bounds;

    for (let i = 0; i < this.rays.length; i++) {
      this.rays[i].alpha = 0.7 + 0.3 * Math.sin(this.time * 0.5 + i * 1.7);
      this.rays[i].skew.x = Math.sin(this.time * 0.22 + i) * 0.03;
    }

    this.drawKelp();

    // Kabarcıklar
    this.bubbleG.clear();
    for (const b of this.bubbles) {
      b.y -= (b.vy * dt) / h;
      if (b.y < 0.02) { b.y = 1.02; b.x = Math.random(); }
      const bx = b.x * w + Math.sin(this.time * 1.4 + b.phase) * 6;
      this.bubbleG.circle(bx, b.y * h, b.r).stroke({ width: 1.2, color: 0xffffff, alpha: 0.35 });
    }

    // Yem taneleri
    for (const p of this.pellets) {
      p.age += dt;
      const floorY = h - 70;
      if (p.y < floorY) {
        p.y = Math.min(floorY, p.y + p.vy * dt);
        p.x += Math.sin(this.time * 2 + p.sway) * 12 * dt;
      }
    }
    this.pellets = this.pellets.filter((p) => p.age < 30);
    this.pelletG.clear();
    for (const p of this.pellets) {
      this.pelletG.circle(p.x, p.y, 3.6).fill(0xc98a4b);
      this.pelletG.circle(p.x - 1, p.y - 1, 1.3).fill(0xe8b078);
    }

    // Balıklar
    for (const f of this.fishes) {
      let target: { x: number; y: number } | null = null;
      let ti = -1;
      if (f.hunger < 0.92 && this.pellets.length) {
        let best = Infinity;
        for (let i = 0; i < this.pellets.length; i++) {
          const d = Math.hypot(this.pellets[i].x - f.x, this.pellets[i].y - f.y);
          if (d < best) { best = d; ti = i; }
        }
        if (ti >= 0) target = { x: this.pellets[ti].x, y: this.pellets[ti].y };
      }

      const grown = f.update(dt, this.time, this.bounds, target);

      if (target && ti >= 0 && ti < this.pellets.length) {
        if (Math.hypot(this.pellets[ti].x - f.x, this.pellets[ti].y - f.y) < 16) {
          this.pellets.splice(ti, 1);
          f.hunger = Math.min(1, f.hunger + 0.35);
          audio.plop();
          this.addXp(1);
          for (let k = 0; k < 3; k++) {
            this.particles.push({
              x: f.x + (Math.random() - 0.5) * 20, y: f.y - 14,
              vy: -22 - Math.random() * 16, life: 1, color: 0xff8fa8, r: 3,
            });
          }
        }
      }

      if (grown) this.onGrown(f);
    }

    // Parçacıklar
    for (const p of this.particles) {
      p.y += p.vy * dt;
      p.life -= dt * 1.1;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.fxG.clear();
    for (const p of this.particles) {
      this.fxG.circle(p.x, p.y, p.r * p.life).fill({ color: p.color, alpha: p.life });
    }
  }

  private onGrown(f: Fish): void {
    audio.grown();
    this.ui.toast(`🎉 ${f.name} yetişkin oldu! Satmak için üzerine dokun.`);
    this.addToCollection(f.sp);
    this.syncSave();
    this.ui.refreshHUD();
  }

  private addToCollection(sp: Species): void {
    if (this.save.collection.includes(sp.id)) return;
    this.save.collection.push(sp.id);
    this.ui.toast(`📖 Koleksiyona eklendi: ${sp.name}`);
    const all = SPECIES.filter((s) => s.rarity === sp.rarity);
    if (all.every((s) => this.save.collection.includes(s.id))) {
      this.save.pearls += 15;
      audio.levelup();
      this.ui.toast(`✨ ${RARITY_INFO[sp.rarity].name} seti tamamlandı! +15 inci, satışlara kalıcı +%5`);
    }
  }

  // ---------- offline / günlük ----------

  private applyOffline(): void {
    const elapsed = Math.min(OFFLINE_CAP_MS, Date.now() - this.save.lastSeen);
    if (elapsed < 60_000) return;
    let grown = 0;
    for (const fs of this.save.fishes) {
      const tillSad = Math.max(0, (fs.hunger - 0.25) / HUNGER_RATE_MS);
      const growMs = Math.min(elapsed, tillSad);
      const before = fs.progress;
      if (fs.progress < 1) {
        fs.progress = Math.min(1, fs.progress + (growMs * OFFLINE_SPEED) / speciesById(fs.sp).growthMs);
        if (before < 1 && fs.progress >= 1) grown++;
      }
      fs.hunger = Math.max(0.05, fs.hunger - elapsed * HUNGER_RATE_MS);
    }
    this.offline.minutes = Math.round(elapsed / 60_000);
    this.offline.grown = grown;
  }

  private applyDailyGift(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.lastDaily === '') {
      // İlk açılış: hediye modalı gösterme, sadece günü işaretle
      this.save.lastDaily = today;
      return;
    }
    if (this.save.lastDaily !== today) {
      this.save.lastDaily = today;
      this.save.coins += 200;
      this.save.pearls += 1;
      this.offline.dailyGift = true;
    }
  }

  // ---------- oyuncu eylemleri ----------

  private spawnFish(fs: FishSave): Fish {
    const f = new Fish(fs, speciesById(fs.sp), this.bounds);
    f.root.on('pointertap', () => this.ui.showFishInfo(f));
    this.fishLayer.addChild(f.root);
    this.fishes.push(f);
    return f;
  }

  feed(): void {
    if (this.pellets.length >= 20) {
      this.ui.toast('Suda yeterince yem var! 🍤');
      return;
    }
    const { w } = this.bounds;
    for (let i = 0; i < 8; i++) {
      this.pellets.push({
        x: 40 + Math.random() * (w - 80),
        y: -6 - Math.random() * 30,
        vy: 34 + Math.random() * 26,
        sway: Math.random() * Math.PI * 2,
        age: 0,
      });
    }
    audio.bubble();
  }

  buyFish(spId: string): { ok: boolean; msg: string } {
    const sp = speciesById(spId);
    if (this.fishes.length >= this.capacity) return { ok: false, msg: `Akvaryum dolu (${this.capacity} balık)` };
    if (sp.pearlPrice) {
      if (this.save.pearls < sp.pearlPrice) return { ok: false, msg: 'Yeterli inci yok' };
      this.save.pearls -= sp.pearlPrice;
    } else {
      if (this.save.level < sp.unlockLevel) return { ok: false, msg: `Seviye ${sp.unlockLevel} gerekli` };
      if (this.save.coins < sp.buyPrice) return { ok: false, msg: 'Yeterli altın yok' };
      this.save.coins -= sp.buyPrice;
    }
    const f = this.spawnFish(this.newFishSave(sp));
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: `${f.name} akvaryuma katıldı! 🐟` };
  }

  private newFishSave(sp: Species): FishSave {
    return {
      sp: sp.id,
      progress: 0,
      hunger: 0.95,
      name: FISH_NAMES[Math.floor(Math.random() * FISH_NAMES.length)],
      seed: Math.floor(Math.random() * 1e9),
    };
  }

  sellFish(f: Fish): { ok: boolean; msg: string } {
    if (!f.isAdult) return { ok: false, msg: 'Henüz yavru — büyümesini bekle' };
    const gain = Math.round(f.sp.sellPrice * this.sellMult);
    this.save.coins += gain;
    if (f.sp.rarity === 'legendary') this.save.pearls += 2;
    this.addXp(Math.round(f.sp.sellPrice * 0.35));
    const idx = this.fishes.indexOf(f);
    if (idx >= 0) this.fishes.splice(idx, 1);
    f.root.destroy({ children: true });
    for (let k = 0; k < 6; k++) {
      this.particles.push({
        x: f.x + (Math.random() - 0.5) * 30, y: f.y,
        vy: -30 - Math.random() * 24, life: 1, color: 0xffd23e, r: 4,
      });
    }
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: `${f.name} satıldı: +${gain} altın` };
  }

  hatchEgg(tier: EggTier): { ok: boolean; msg: string; species?: Species } {
    if (this.fishes.length >= this.capacity) return { ok: false, msg: `Akvaryum dolu (${this.capacity} balık)` };
    if (tier.currency === 'coins') {
      if (this.save.coins < tier.cost) return { ok: false, msg: 'Yeterli altın yok' };
      this.save.coins -= tier.cost;
    } else {
      if (this.save.pearls < tier.cost) return { ok: false, msg: 'Yeterli inci yok' };
      this.save.pearls -= tier.cost;
    }
    const roll = Math.random() * 100;
    let acc = 0;
    let rarity: Rarity = 'common';
    for (const [r, pct] of Object.entries(tier.odds) as [Rarity, number][]) {
      acc += pct;
      if (roll < acc) { rarity = r; break; }
      rarity = r;
    }
    const pool = SPECIES.filter((s) => s.rarity === rarity);
    const sp = pool[Math.floor(Math.random() * pool.length)];
    this.spawnFish(this.newFishSave(sp));
    audio.hatch(sp.rarity);
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: '', species: sp };
  }

  private addXp(n: number): void {
    this.save.xp += n;
    while (this.save.xp >= this.xpNeed(this.save.level)) {
      this.save.xp -= this.xpNeed(this.save.level);
      this.save.level++;
      this.save.pearls += 3;
      audio.levelup();
      this.ui.toast(`⭐ Seviye ${this.save.level}! +3 inci, kapasite ${this.capacity} balık`);
    }
  }

  shopList(): Species[] {
    return SPECIES.filter((s) => s.buyPrice > 0 || s.pearlPrice);
  }
  eggList(): EggTier[] { return EGGS; }

  syncSave(): void {
    this.save.fishes = this.fishes.map((f) => f.toSave());
    persist(this.save);
  }

  resetAll(): void {
    wipeSave();
    location.reload();
  }
}
