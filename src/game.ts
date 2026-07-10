import { Application, Container, FillGradient, Graphics } from 'pixi.js';
import { audio } from './audio';
import { DECOR, DECOR_BOOST, DECOR_BOOST_CAP, DecorDef, MAX_PLACED, decorById } from './decor';
import { Bounds, Fish, HUNGER_RATE, SAD_THRESHOLD } from './fish';
import { ACHIEVEMENTS, QuestDef, QuestEvent, questsForDay } from './quests';
import { FishSave, SaveData, loadSave, persist, wipeSave } from './save';
import { Services, createServices } from './services';
import {
  EGGS, EggTier, FISH_NAMES, PITY_LIMIT, RARITY_INCOME, RARITY_INFO, Rarity, SPECIES, Species, speciesById,
} from './species';
import { FISH_BONUS_CAP, FeedDef, feedById } from './feeds';
import { Biome, TANKS, TANK_CAP_BONUS, TankDef, tankById } from './tanks';
import type { UI } from './ui';

interface Pellet { x: number; y: number; vy: number; sway: number; age: number; feed: string }
interface Particle { x: number; y: number; vy: number; life: number; color: number; r: number }

const OFFLINE_CAP_MS = 8 * 3600_000;
const OFFLINE_SPEED = 0.5;
const HUNGER_RATE_MS = HUNGER_RATE / 1000; // fish.ts ile aynı kural, ms cinsinden

export interface OfflineSummary { minutes: number; grown: number; dailyGift: boolean; giftCoins: number; giftPearls: number; income: number }

export const INCOME_CAP_HOURS = 4; // biriken gelir en fazla bu kadar saatlik üretim olabilir

export class Game {
  app = new Application();
  ui!: UI;
  save: SaveData;
  services: Services;
  fishes: Fish[] = [];          // aktif akvaryumdaki balıklar
  private dormant: FishSave[] = []; // diğer akvaryumlardaki balıklar

  private world = new Container();
  private bgG = new Graphics();
  private sandG = new Graphics();
  private ambientG = new Graphics();
  private biomeG = new Graphics();
  private biomeAnimG = new Graphics();
  private moodG = new Graphics();
  /** Biyoma özgü hareketli sahne öğeleri (kar, küre, buzdağı, kristal, saz...) */
  private animItems: { kind: string; x: number; y: number; r: number; phase: number; s: number }[] = [];
  private decorAnimG = new Graphics();
  private rays: Graphics[] = [];
  private rayLayer = new Container();
  private fishLayer = new Container();
  private pelletG = new Graphics();
  private fxG = new Graphics();
  private bubbleG = new Graphics();

  private pellets: Pellet[] = [];
  private particles: Particle[] = [];

  /** Giriş modları: seçili yem varsa dokunuşlar yem atar; düzenleme modunda dekor sürüklenir. */
  feedType: FeedDef | null = null;
  editMode = false;
  private dragIndex = -1;
  get inputMode(): 'feed' | 'edit' | 'normal' {
    return this.editMode ? 'edit' : this.feedType ? 'feed' : 'normal';
  }
  private bubbles: { x: number; y: number; r: number; vy: number; phase: number }[] = [];
  private time = 0;
  offline: OfflineSummary = { minutes: 0, grown: 0, dailyGift: false, giftCoins: 0, giftPearls: 0, income: 0 };

  constructor() {
    this.save = loadSave();
    this.services = createServices(this.save);
  }

  get bounds(): Bounds {
    return { w: this.app.screen.width, h: this.app.screen.height };
  }
  get activeTank(): TankDef { return tankById(this.save.activeTank); }

  /** Belirli bir akvaryumun kapasitesi: seviye tabanı + akvaryum kademesi bonusu. */
  capacityFor(tankId: string): number {
    return Math.min(6 + this.save.level, 24) + TANK_CAP_BONUS[tankById(tankId).rarity];
  }
  /** Aktif akvaryumun kapasitesi. */
  get capacity(): number { return this.capacityFor(this.save.activeTank); }

  get sellMult(): number { return 1 + 0.05 * this.completedSets().length; }

  /** Akvaryumun toplam bonusu (%): tema bonusu + yerleştirilmiş dekorlar. Büyümeye VE pasif gelire işler. */
  tankBoostPct(tankId: string): number {
    const t = tankById(tankId);
    const placed = this.save.decorPlaced[tankId] ?? [];
    let pct = t.growthBonus;
    for (const p of placed) pct += DECOR_BOOST[decorById(p.def).rarity];
    return Math.min(DECOR_BOOST_CAP, pct);
  }

  /** Aktif akvaryumun büyüme çarpanı. */
  get growthMult(): number {
    return 1 + this.tankBoostPct(this.save.activeTank) / 100;
  }

  /**
   * Seviye eğrisi: erken hızlı (Sv1 = 50 XP ≈ 2 satış), geç oyunda dikleşir (üs 2.2).
   * Satış XP'si fiyatın 0.75 kuvveti olduğundan geç seviyeler saatler alır — hedeflenen yapı.
   */
  xpNeed(level: number): number { return Math.round(50 * Math.pow(level, 2.2)); }

  /** Satıştan gelen XP: azalan getiri — pahalı balık çok XP verir ama fiyatla doğrusal büyümez. */
  saleXp(sellPrice: number): number { return Math.max(5, Math.round(Math.pow(sellPrice, 0.75))); }

  /** Tüm akvaryumlardaki yetişkin balıkların toplam saatlik üretimi (akvaryum+dekor bonuslu). */
  get incomePerHour(): number {
    let rate = 0;
    const cache: Record<string, number> = {};
    const mult = (tid: string) => (cache[tid] ??= 1 + this.tankBoostPct(tid) / 100);
    for (const f of this.fishes) if (f.isAdult) rate += RARITY_INCOME[f.sp.rarity] * mult(f.tank);
    for (const d of this.dormant) if (d.progress >= 1) rate += RARITY_INCOME[speciesById(d.sp).rarity] * mult(d.tank);
    return Math.round(rate);
  }

  /** Biriken geliri kasaya aktarır. */
  collectIncome(): { ok: boolean; msg: string } {
    const amount = Math.floor(this.save.incomePot);
    if (amount < 1) return { ok: false, msg: 'Henüz birikmiş gelir yok' };
    this.save.incomePot -= amount;
    this.save.coins += amount;
    this.save.stats.totalEarned += amount;
    this.questEvent('earn', amount);
    this.addXp(Math.max(1, Math.round(amount * 0.05)));
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: `+${amount} altın toplandı! 🪙` };
  }

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
      this.bgG, this.rayLayer, this.biomeG, this.biomeAnimG, this.ambientG, this.decorAnimG, this.sandG,
      this.pelletG, this.fishLayer, this.bubbleG, this.fxG, this.moodG,
    );
    this.app.stage.addChild(this.world);

    // Kayıttaki bilinmeyen dekor kimliklerini ayıkla (sürüm değişikliklerine karşı koruma)
    const known = new Set(DECOR.map((d) => d.id));
    for (const t of Object.keys(this.save.decorPlaced)) {
      this.save.decorPlaced[t] = (this.save.decorPlaced[t] ?? []).filter((p) => known.has(p.def));
    }
    for (const id of Object.keys(this.save.decorOwned)) {
      if (!known.has(id)) delete this.save.decorOwned[id];
    }

    // Kayıttaki bilinmeyen akvaryum/tür kimliklerini ayıkla (katalog değişirse çökmeyi önler)
    const knownTanks = new Set(TANKS.map((t) => t.id));
    this.save.tanksOwned = this.save.tanksOwned.filter((id) => knownTanks.has(id));
    if (!this.save.tanksOwned.length) this.save.tanksOwned = [TANKS[0].id];
    if (!this.save.tanksOwned.includes(this.save.activeTank)) this.save.activeTank = this.save.tanksOwned[0];
    if (!this.save.decorPlaced[this.save.activeTank]) this.save.decorPlaced[this.save.activeTank] = [];
    for (const t of Object.keys(this.save.decorPlaced)) {
      if (!knownTanks.has(t)) delete this.save.decorPlaced[t];
    }

    const knownSpecies = new Set(SPECIES.map((s) => s.id));
    this.save.fishes = this.save.fishes.filter((f) => knownSpecies.has(f.sp));
    for (const f of this.save.fishes) {
      if (!this.save.tanksOwned.includes(f.tank)) f.tank = this.save.activeTank;
    }
    this.save.collection = this.save.collection.filter((id) => knownSpecies.has(id));

    this.applyOffline();
    this.applyDailyGift();
    this.ensureQuestDay();

    for (let i = 0; i < 22; i++) {
      this.bubbles.push({
        x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 3.5,
        vy: 14 + Math.random() * 26, phase: Math.random() * Math.PI * 2,
      });
    }

    this.buildStatic();
    this.app.renderer.on('resize', () => this.buildStatic());

    // Balıkları aktif/dormant olarak ayır
    for (const fs of this.save.fishes) {
      if (fs.tank === this.save.activeTank) this.spawnFish(fs);
      else this.dormant.push(fs);
    }

    audio.setBiome(this.activeTank.biome);

    // Sahne dokunuşları: yem modu tek tıkla yem atar, düzenleme modu dekor sürükler
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on('pointerdown', (e) => this.onPointerDown(e.global.x, e.global.y));
    this.app.stage.on('pointermove', (e) => this.onPointerMove(e.global.x));
    this.app.stage.on('pointerup', () => this.onPointerUp());
    this.app.stage.on('pointerupoutside', () => this.onPointerUp());

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
    const tank = this.activeTank;

    this.bgG.clear();
    const grad = new FillGradient(0, 0, 0, h);
    grad.addColorStop(0, tank.water[0]);
    grad.addColorStop(0.55, tank.water[1]);
    grad.addColorStop(1, tank.water[2]);
    this.bgG.rect(0, 0, w, h).fill(grad);

    this.sandG.clear();
    this.sandG.rect(0, h - 64, w, 64).fill(tank.sand);
    this.sandG.ellipse(w * 0.5, h - 64, w * 0.6, 14).fill(tank.sand);
    for (let i = 0; i < 70; i++) {
      this.sandG.circle(Math.random() * w, h - 58 + Math.random() * 52, 1 + Math.random() * 2).fill(tank.sandDots);
    }

    // Arka plan silüet bitkileri (derinlik hissi)
    this.ambientG.clear();
    for (let i = 0; i < 4; i++) {
      const bx = w * (0.1 + i * 0.26);
      const bh = 60 + (i % 2) * 40;
      this.ambientG
        .moveTo(bx, h - 60)
        .quadraticCurveTo(bx - 14, h - 60 - bh * 0.6, bx - 4, h - 60 - bh)
        .quadraticCurveTo(bx + 10, h - 60 - bh * 0.5, bx, h - 60)
        .fill({ color: tank.water[2], alpha: 0.5 });
    }

    this.drawBiomeScenery(w, h);

    // Işık huzmeleri — biyoma göre renk, yoğunluk ve sayı
    const RAY_CFG: Record<Biome, { color: number; alpha: number; count: number }> = {
      tropik:    { color: 0xffffff, alpha: 0.07, count: 4 },
      lagun:     { color: 0xfff8d0, alpha: 0.09, count: 5 },
      derin:     { color: 0x9fc8ff, alpha: 0.025, count: 2 },
      magara:    { color: 0xcfe8ff, alpha: 0.1, count: 1 },
      kutup:     { color: 0xffffff, alpha: 0.11, count: 5 },
      gunbatimi: { color: 0xffb060, alpha: 0.12, count: 4 },
      mistik:    { color: 0xc9a0ff, alpha: 0.06, count: 3 },
    };
    const rc = RAY_CFG[tank.biome];
    this.rayLayer.removeChildren();
    this.rays = [];
    for (let i = 0; i < rc.count; i++) {
      const g = new Graphics();
      const rx = w * ((i + 0.5) / rc.count) - 20;
      g.moveTo(rx, -20)
        .lineTo(rx + 34, -20)
        .lineTo(rx + 150, h * 0.85)
        .lineTo(rx - 60, h * 0.85)
        .closePath()
        .fill({ color: rc.color, alpha: rc.alpha });
      g.blendMode = 'add';
      this.rays.push(g);
      this.rayLayer.addChild(g);
    }

    // Atmosfer tonu — tüm sahnenin üzerine biyom rengi
    const MOOD: Record<Biome, { color: number; alpha: number }> = {
      tropik:    { color: 0x000000, alpha: 0 },
      lagun:     { color: 0x8affe0, alpha: 0.05 },
      derin:     { color: 0x0a1430, alpha: 0.24 },
      magara:    { color: 0x141024, alpha: 0.22 },
      kutup:     { color: 0xdff2ff, alpha: 0.1 },
      gunbatimi: { color: 0xff8a40, alpha: 0.12 },
      mistik:    { color: 0x3a2a6e, alpha: 0.16 },
    };
    const mood = MOOD[tank.biome];
    this.moodG.clear();
    if (mood.alpha > 0) this.moodG.rect(0, 0, w, h).fill({ color: mood.color, alpha: mood.alpha });
    this.moodG.eventMode = 'none';
  }

  /** Her biyomun kendine özgü, BELİRGİN sahnesi; yerleşim akvaryum kimliğinden türetilen tohumla değişir. */
  private drawBiomeScenery(w: number, h: number): void {
    const tank = this.activeTank;
    const g = this.biomeG;
    g.clear();
    this.animItems = [];

    // Akvaryum kimliğinden deterministik rastgelelik
    let seed = 0;
    for (const ch of tank.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return (seed >>> 8) / 16777216;
    };
    const floor = h - 60;

    switch (tank.biome) {
      case 'tropik': {
        // Sağda büyük resif duvarı + önde iri mercan kümeleri
        g.moveTo(w, h).lineTo(w, h * 0.45)
          .quadraticCurveTo(w * 0.86, h * 0.5, w * 0.84, h * 0.68)
          .quadraticCurveTo(w * 0.9, h * 0.85, w * 0.86, h).closePath()
          .fill({ color: 0xd97a72, alpha: 0.5 });
        for (let i = 0; i < 3; i++) {
          const cx = w * (0.12 + rnd() * 0.6);
          const col = [0xf4756a, 0xe86a92, 0xf09048][i % 3];
          for (let k = 0; k < 7; k++) {
            g.circle(cx - 34 + k * 12, floor - 10 - Math.sin(k * 1.9) * 12, 13 + (k % 3) * 5)
              .fill({ color: col, alpha: 0.85 });
          }
          // mercan üstünde anemon püskülleri
          for (let a = 0; a < 5; a++) {
            g.moveTo(cx - 10 + a * 5, floor - 34)
              .lineTo(cx - 12 + a * 6, floor - 52 - rnd() * 8)
              .stroke({ width: 4, color: 0xffc0b0, alpha: 0.9, cap: 'round' });
          }
        }
        for (let i = 0; i < 6; i++) {
          const sx = w * rnd();
          g.moveTo(sx - 8, floor + 16).quadraticCurveTo(sx, floor - 2, sx + 8, floor + 16)
            .closePath().fill({ color: 0xfff2e0, alpha: 0.9 });
        }
        break;
      }
      case 'lagun': {
        // Yüzeyde büyük nilüfer yaprakları + uzun sazlar (hareketli) + iri yuvarlak kayalar
        for (let i = 0; i < 4; i++) {
          const lx = w * (0.1 + rnd() * 0.8);
          g.ellipse(lx, 22, 42 + rnd() * 20, 12).fill({ color: 0x3f9764, alpha: 0.85 });
          g.moveTo(lx, 22).lineTo(lx + 34, 14).lineTo(lx + 30, 26).closePath()
            .fill({ color: tank.water[0], alpha: 0.9 });
        }
        for (let i = 0; i < 8; i++) {
          this.animItems.push({ kind: 'reed', x: w * rnd(), y: floor, r: 60 + rnd() * 70, phase: rnd() * 6, s: 1 });
        }
        for (let i = 0; i < 3; i++) {
          const bx = w * (0.1 + rnd() * 0.8);
          g.ellipse(bx, floor - 12, 34 + rnd() * 18, 22).fill({ color: 0x8fa78f, alpha: 0.8 });
          g.ellipse(bx - 10, floor - 26, 16, 9).fill({ color: 0xa8c0a0, alpha: 0.8 });
        }
        break;
      }
      case 'derin': {
        // Dev yarık duvarları (koyu, opak) + hareketli deniz karı + parlayan derin canlı gözleri
        g.moveTo(0, h).lineTo(0, h * 0.1).lineTo(w * 0.08, h * 0.3).lineTo(w * 0.05, h * 0.45)
          .lineTo(w * 0.17, h * 0.62).lineTo(w * 0.12, h * 0.8).lineTo(w * 0.2, h).closePath()
          .fill({ color: 0x0a1322, alpha: 0.9 });
        g.moveTo(w, h).lineTo(w, h * 0.05).lineTo(w * 0.9, h * 0.28).lineTo(w * 0.94, h * 0.42)
          .lineTo(w * 0.82, h * 0.6).lineTo(w * 0.88, h * 0.78).lineTo(w * 0.8, h).closePath()
          .fill({ color: 0x0a1322, alpha: 0.9 });
        for (let i = 0; i < 3; i++) {
          const ex = i % 2 === 0 ? w * 0.08 : w * 0.9;
          const ey = h * (0.3 + rnd() * 0.4);
          g.circle(ex, ey, 3).fill({ color: 0x7fe8c9, alpha: 0.9 });
          g.circle(ex + 10, ey + 2, 3).fill({ color: 0x7fe8c9, alpha: 0.9 });
        }
        for (let i = 0; i < 30; i++) {
          this.animItems.push({ kind: 'snow', x: w * rnd(), y: h * rnd(), r: 1 + rnd() * 1.6, phase: rnd() * 6, s: 6 + rnd() * 10 });
        }
        break;
      }
      case 'magara': {
        // Kalın sarkıt/dikit kümeleri + nabız atan kristal kümeleri
        for (let i = 0; i < 8; i++) {
          const sx = w * (0.04 + rnd() * 0.92);
          const sl = 60 + rnd() * 110;
          g.moveTo(sx - 20 - rnd() * 8, 0).lineTo(sx, sl).lineTo(sx + 20 + rnd() * 8, 0).closePath()
            .fill({ color: 0x131022, alpha: 0.92 });
        }
        for (let i = 0; i < 4; i++) {
          const sx = w * (0.08 + rnd() * 0.84);
          const sl = 40 + rnd() * 50;
          g.moveTo(sx - 18, floor + 4).lineTo(sx, floor - sl).lineTo(sx + 18, floor + 4).closePath()
            .fill({ color: 0x131022, alpha: 0.9 });
        }
        for (let i = 0; i < 5; i++) {
          const cx = w * (0.06 + rnd() * 0.88);
          const cy = floor - 4 - rnd() * 26;
          this.animItems.push({ kind: 'crystal', x: cx, y: cy, r: 10 + rnd() * 8, phase: rnd() * 6, s: 1 });
        }
        break;
      }
      case 'kutup': {
        // Kalın buz tavanı + sallanan büyük buzdağı + buz kırığı zemin
        g.rect(0, 0, w, 34).fill({ color: 0xf4fbff, alpha: 0.85 });
        for (let i = 0; i < 6; i++) {
          const ix = (w / 6) * i + rnd() * 20;
          const iw2 = 70 + rnd() * 70;
          g.moveTo(ix, 32).lineTo(ix + iw2, 32).lineTo(ix + iw2 * 0.7, 66 + rnd() * 40)
            .lineTo(ix + iw2 * 0.25, 56 + rnd() * 30).closePath()
            .fill({ color: 0xe8f6ff, alpha: 0.75 });
        }
        this.animItems.push({ kind: 'iceberg', x: w * (0.25 + rnd() * 0.5), y: 90, r: 70 + rnd() * 40, phase: rnd() * 6, s: 1 });
        for (let i = 0; i < 7; i++) {
          const cx = w * rnd();
          g.moveTo(cx - 14, floor + 4).lineTo(cx, floor - 22 - rnd() * 18).lineTo(cx + 14, floor + 4).closePath()
            .fill({ color: 0xffffff, alpha: 0.85 });
        }
        break;
      }
      case 'gunbatimi': {
        // Kocaman güneş + ufuk çizgisi + siluet martılar + koyu mor bitki siluetleri
        const sx = w * 0.65;
        g.circle(sx, 74, 110).fill({ color: 0xffc070, alpha: 0.25 });
        g.circle(sx, 74, 66).fill({ color: 0xffb860, alpha: 0.4 });
        g.circle(sx, 74, 38).fill({ color: 0xfff0c8, alpha: 0.9 });
        for (let i = 0; i < 5; i++) {
          g.rect(0, 110 + i * 22, w, 6 - i).fill({ color: 0xff9a50, alpha: 0.22 - i * 0.03 });
        }
        for (let i = 0; i < 3; i++) {
          const mx = w * (0.1 + rnd() * 0.5);
          const my = 40 + rnd() * 40;
          g.moveTo(mx - 10, my).quadraticCurveTo(mx - 4, my - 7, mx, my)
            .quadraticCurveTo(mx + 4, my - 7, mx + 10, my)
            .stroke({ width: 2.5, color: 0x6e3a52, alpha: 0.8 });
        }
        for (let i = 0; i < 6; i++) {
          const px = w * rnd();
          const ph = 40 + rnd() * 60;
          g.moveTo(px, floor).quadraticCurveTo(px - 8, floor - ph * 0.6, px + 4, floor - ph)
            .stroke({ width: 5, color: 0x5c2e46, alpha: 0.85, cap: 'round' });
        }
        break;
      }
      case 'mistik': {
        // Opak antik tapınak kapısı + yıkık sütunlar + gezinen büyük ışık küreleri
        const ax = w * (0.3 + rnd() * 0.4);
        g.rect(ax - 70, floor - 130, 22, 130).fill({ color: 0x232a4e, alpha: 0.95 });
        g.rect(ax + 48, floor - 130, 22, 130).fill({ color: 0x232a4e, alpha: 0.95 });
        g.rect(ax - 84, floor - 148, 168, 22).fill({ color: 0x2a3258, alpha: 0.95 });
        g.circle(ax, floor - 96, 15).fill({ color: 0x9fe8ff, alpha: 0.35 });
        for (let i = 0; i < 3; i++) {
          const cx = w * (0.06 + rnd() * 0.88);
          const ch2 = 34 + rnd() * 44;
          g.rect(cx - 9, floor - ch2, 18, ch2).fill({ color: 0x232a4e, alpha: 0.85 });
          g.rect(cx - 13, floor - ch2 - 7, 26, 7).fill({ color: 0x2a3258, alpha: 0.85 });
        }
        for (let i = 0; i < 6; i++) {
          this.animItems.push({ kind: 'orb', x: w * rnd(), y: h * (0.15 + rnd() * 0.55), r: 5 + rnd() * 6, phase: rnd() * 6, s: 10 + rnd() * 14 });
        }
        break;
      }
    }
  }

  /** Hareketli biyom öğeleri — her karede çizilir. */
  private drawBiomeAnim(dt: number, w: number, h: number): void {
    const g = this.biomeAnimG;
    g.clear();
    const t = this.time;
    for (const it of this.animItems) {
      switch (it.kind) {
        case 'snow': {
          it.y += it.s * dt;
          if (it.y > h) { it.y = -4; it.x = w * Math.random(); }
          const dx = Math.sin(t * 0.6 + it.phase) * 10;
          g.circle(it.x + dx, it.y, it.r).fill({ color: 0xdfe8f0, alpha: 0.3 });
          break;
        }
        case 'orb': {
          const ox = it.x + Math.sin(t * 0.4 + it.phase) * it.s * 2;
          const oy = it.y + Math.cos(t * 0.3 + it.phase) * it.s;
          const pulse = 0.5 + 0.3 * Math.sin(t * 1.5 + it.phase);
          g.circle(ox, oy, it.r * 2.2).fill({ color: 0x9fe8ff, alpha: 0.12 * pulse });
          g.circle(ox, oy, it.r).fill({ color: 0xd8f6ff, alpha: 0.55 * pulse + 0.25 });
          break;
        }
        case 'crystal': {
          const pulse = 0.6 + 0.4 * Math.sin(t * 1.8 + it.phase);
          g.circle(it.x, it.y - 4, it.r * 2).fill({ color: 0x9fd8ff, alpha: 0.14 * pulse });
          g.moveTo(it.x, it.y - it.r * 1.6).lineTo(it.x + it.r * 0.7, it.y)
            .lineTo(it.x, it.y + it.r * 0.5).lineTo(it.x - it.r * 0.7, it.y).closePath()
            .fill({ color: 0xa8e0ff, alpha: 0.55 + 0.35 * pulse });
          break;
        }
        case 'iceberg': {
          const by = it.y + Math.sin(t * 0.5 + it.phase) * 6;
          g.moveTo(it.x - it.r, by).lineTo(it.x - it.r * 0.4, by - 34)
            .lineTo(it.x + it.r * 0.25, by - 46).lineTo(it.x + it.r, by - 8)
            .lineTo(it.x + it.r * 0.7, by + 30).lineTo(it.x - it.r * 0.6, by + 24).closePath()
            .fill({ color: 0xf0faff, alpha: 0.85 });
          g.moveTo(it.x - it.r * 0.4, by - 34).lineTo(it.x + it.r * 0.25, by - 46)
            .lineTo(it.x + it.r * 0.15, by).lineTo(it.x - it.r * 0.3, by).closePath()
            .fill({ color: 0xcfe8f8, alpha: 0.7 });
          break;
        }
        case 'reed': {
          const sway = Math.sin(t * 0.9 + it.phase) * 10;
          g.moveTo(it.x, it.y)
            .quadraticCurveTo(it.x + sway * 0.4, it.y - it.r * 0.6, it.x + sway, it.y - it.r)
            .stroke({ width: 4, color: 0x2f7a52, alpha: 0.85, cap: 'round' });
          g.ellipse(it.x + sway, it.y - it.r, 4, 12).fill({ color: 0x3f9764, alpha: 0.9 });
          break;
        }
      }
    }
  }

  // ---------- dekor çizimi ----------

  private drawDecor(): void {
    const { w, h } = this.bounds;
    const g = this.decorAnimG;
    g.clear();
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const d = decorById(p.def);
      const cx = p.fx * w;
      const baseY = h - 58;
      // Düzenleme modu: sürüklenebilir parçaları vurgula
      if (this.editMode) {
        const half = 46 * d.scale;
        const active = i === this.dragIndex;
        g.roundRect(cx - half, baseY - 110 * d.scale, half * 2, 110 * d.scale + 12, 10)
          .fill({ color: active ? 0xffd23e : 0xffffff, alpha: active ? 0.18 : 0.08 })
          .stroke({ width: 2, color: active ? 0xffd23e : 0xffffff, alpha: active ? 0.9 : 0.4 });
      }
      this.drawDecorItem(g, d, cx, h - 58);
    }
  }

  private drawDecorItem(g: Graphics, d: DecorDef, x: number, baseY: number): void {
    const s = d.scale;
    const t = this.time;
    switch (d.kind) {
      case 'kelp': {
        const segs = 6;
        const segLen = 22 * s;
        let px = x, py = baseY;
        for (let i = 0; i < segs; i++) {
          const ang = Math.sin(t * 0.8 + x * 0.05 + i * 0.55) * 0.14 * (i / segs + 0.4);
          const nx = px + Math.sin(ang) * segLen;
          const ny = py - Math.cos(ang) * segLen;
          g.moveTo(px, py).lineTo(nx, ny).stroke({ width: (7 - i * 0.7) * s, color: d.color, cap: 'round' });
          if (i > 0) {
            const side = i % 2 === 0 ? 1 : -1;
            g.ellipse(px + side * 8 * s, py, 9 * s, 4 * s).fill({ color: d.color2, alpha: 0.85 });
          }
          px = nx; py = ny;
        }
        break;
      }
      case 'sword': {
        for (let i = -2; i <= 2; i++) {
          const lh = (55 - Math.abs(i) * 12) * s;
          const sway = Math.sin(t * 0.9 + i) * 4;
          g.moveTo(x, baseY)
            .quadraticCurveTo(x + i * 10 + sway, baseY - lh * 0.6, x + i * 14 + sway, baseY - lh)
            .quadraticCurveTo(x + i * 8 + sway, baseY - lh * 0.5, x, baseY)
            .fill({ color: i % 2 === 0 ? d.color : d.color2, alpha: 0.95 });
        }
        break;
      }
      case 'coral-mound': {
        for (let i = 0; i < 7; i++) {
          g.circle(x - 34 * s + i * 11 * s, baseY - (10 + Math.sin(i * 2.1) * 8) * s, (11 + (i % 3) * 3) * s)
            .fill(i % 2 === 0 ? d.color : d.color2);
        }
        break;
      }
      case 'tube-coral': {
        for (let i = 0; i < 4; i++) {
          const tx = x - 20 * s + i * 13 * s;
          const th = (26 + (i % 2) * 14) * s;
          g.roundRect(tx, baseY - th, 9 * s, th, 4).fill(d.color);
          g.circle(tx + 4.5 * s, baseY - th, 5 * s).fill(d.color2);
        }
        break;
      }
      case 'fan-coral': {
        const sway = Math.sin(t * 0.7 + x * 0.03) * 0.05;
        for (let i = -3; i <= 3; i++) {
          const ang = i * 0.22 + sway - Math.PI / 2;
          const len = (44 - Math.abs(i) * 5) * s;
          g.moveTo(x, baseY)
            .lineTo(x + Math.cos(ang) * len, baseY + Math.sin(ang) * len)
            .stroke({ width: 3.5 * s, color: i % 2 === 0 ? d.color : d.color2, cap: 'round' });
        }
        g.circle(x, baseY, 5 * s).fill(d.color);
        break;
      }
      case 'anemone': {
        for (let i = 0; i < 9; i++) {
          const ang = -Math.PI / 2 + (i - 4) * 0.28 + Math.sin(t * 1.4 + i) * 0.08;
          const len = (26 + (i % 3) * 6) * s;
          g.moveTo(x, baseY - 6)
            .lineTo(x + Math.cos(ang) * len, baseY - 6 + Math.sin(ang) * len)
            .stroke({ width: 5 * s, color: i % 2 === 0 ? d.color : d.color2, cap: 'round' });
        }
        g.ellipse(x, baseY - 4, 16 * s, 8 * s).fill(d.color);
        break;
      }
      case 'rock': {
        g.ellipse(x, baseY - 10 * s, 26 * s, 16 * s).fill(d.color);
        g.ellipse(x - 10 * s, baseY - 20 * s, 14 * s, 9 * s).fill(d.color2);
        break;
      }
      case 'arch': {
        g.moveTo(x - 30 * s, baseY)
          .quadraticCurveTo(x, baseY - 64 * s, x + 30 * s, baseY)
          .stroke({ width: 14 * s, color: d.color, cap: 'round' });
        g.circle(x - 28 * s, baseY - 6 * s, 8 * s).fill(d.color2);
        g.circle(x + 26 * s, baseY - 4 * s, 6 * s).fill(d.color2);
        break;
      }
      case 'shell': {
        g.moveTo(x - 18 * s, baseY)
          .quadraticCurveTo(x, baseY - 34 * s, x + 18 * s, baseY)
          .closePath()
          .fill(d.color);
        for (let i = -2; i <= 2; i++) {
          g.moveTo(x, baseY - 2).lineTo(x + i * 8 * s, baseY - 26 * s)
            .stroke({ width: 2, color: d.color2, alpha: 0.8 });
        }
        break;
      }
      case 'starfish': {
        for (let i = 0; i < 5; i++) {
          const ang = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          g.moveTo(x, baseY - 8 * s)
            .lineTo(x + Math.cos(ang) * 16 * s, baseY - 8 * s + Math.sin(ang) * 16 * s)
            .stroke({ width: 7 * s, color: d.color, cap: 'round' });
        }
        g.circle(x, baseY - 8 * s, 6 * s).fill(d.color2);
        break;
      }
      case 'chest': {
        g.roundRect(x - 20 * s, baseY - 24 * s, 40 * s, 24 * s, 4).fill(d.color);
        g.roundRect(x - 22 * s, baseY - 32 * s, 44 * s, 12 * s, 5).fill(d.color);
        g.rect(x - 3 * s, baseY - 26 * s, 6 * s, 10 * s).fill(d.color2);
        if (Math.sin(t * 2 + x) > 0.6) {
          g.circle(x, baseY - 40 * s - (t % 1) * 16, 3).stroke({ width: 1.2, color: 0xffffff, alpha: 0.4 });
        }
        break;
      }
      case 'wreck': {
        g.moveTo(x - 46 * s, baseY)
          .quadraticCurveTo(x, baseY - 30 * s, x + 46 * s, baseY - 6 * s)
          .lineTo(x + 40 * s, baseY)
          .closePath()
          .fill(d.color);
        g.rect(x - 4 * s, baseY - 58 * s, 5 * s, 34 * s).fill(d.color2);
        g.moveTo(x + 1 * s, baseY - 58 * s).lineTo(x + 26 * s, baseY - 40 * s).lineTo(x + 1 * s, baseY - 34 * s)
          .closePath().fill({ color: d.color2, alpha: 0.7 });
        break;
      }
      case 'column': {
        g.rect(x - 8 * s, baseY - 60 * s, 16 * s, 60 * s).fill(d.color);
        g.rect(x - 12 * s, baseY - 66 * s, 24 * s, 8 * s).fill(d.color2);
        g.rect(x - 12 * s, baseY - 4 * s, 24 * s, 6 * s).fill(d.color2);
        for (let i = -1; i <= 1; i++) {
          g.moveTo(x + i * 5 * s, baseY - 60 * s).lineTo(x + i * 5 * s, baseY)
            .stroke({ width: 1.5, color: d.color2, alpha: 0.5 });
        }
        break;
      }
      case 'statue': {
        g.roundRect(x - 14 * s, baseY - 8 * s, 28 * s, 8 * s, 2).fill(d.color2);
        g.moveTo(x - 8 * s, baseY - 8 * s)
          .quadraticCurveTo(x - 10 * s, baseY - 40 * s, x, baseY - 46 * s)
          .quadraticCurveTo(x + 10 * s, baseY - 40 * s, x + 8 * s, baseY - 8 * s)
          .closePath()
          .fill(d.color);
        g.circle(x, baseY - 52 * s, 8 * s).fill(d.color);
        break;
      }
      case 'castle': {
        g.rect(x - 26 * s, baseY - 40 * s, 52 * s, 40 * s).fill(d.color);
        g.rect(x - 34 * s, baseY - 56 * s, 16 * s, 56 * s).fill(d.color2);
        g.rect(x + 18 * s, baseY - 56 * s, 16 * s, 56 * s).fill(d.color2);
        g.moveTo(x - 34 * s, baseY - 56 * s).lineTo(x - 26 * s, baseY - 70 * s).lineTo(x - 18 * s, baseY - 56 * s).closePath().fill(d.color);
        g.moveTo(x + 18 * s, baseY - 56 * s).lineTo(x + 26 * s, baseY - 70 * s).lineTo(x + 34 * s, baseY - 56 * s).closePath().fill(d.color);
        g.roundRect(x - 6 * s, baseY - 22 * s, 12 * s, 22 * s, 6).fill(d.color2);
        break;
      }
      case 'skull': {
        g.ellipse(x, baseY - 22 * s, 24 * s, 20 * s).fill(d.color);
        g.rect(x - 12 * s, baseY - 10 * s, 24 * s, 10 * s).fill(d.color);
        g.ellipse(x - 9 * s, baseY - 24 * s, 6 * s, 7 * s).fill(0x2e3440);
        g.ellipse(x + 9 * s, baseY - 24 * s, 6 * s, 7 * s).fill(0x2e3440);
        g.moveTo(x - 3 * s, baseY - 16 * s).lineTo(x, baseY - 10 * s).lineTo(x + 3 * s, baseY - 16 * s)
          .closePath().fill(0x2e3440);
        break;
      }
      case 'amphora': {
        g.moveTo(x - 4 * s, baseY - 40 * s)
          .quadraticCurveTo(x - 20 * s, baseY - 26 * s, x - 10 * s, baseY)
          .lineTo(x + 10 * s, baseY)
          .quadraticCurveTo(x + 20 * s, baseY - 26 * s, x + 4 * s, baseY - 40 * s)
          .closePath()
          .fill(d.color);
        g.rect(x - 6 * s, baseY - 46 * s, 12 * s, 7 * s).fill(d.color2);
        break;
      }
      case 'lamp': {
        g.rect(x - 2.5 * s, baseY - 44 * s, 5 * s, 44 * s).fill(d.color);
        g.circle(x, baseY - 50 * s, 9 * s).fill(d.color2);
        const pulse = 0.18 + 0.08 * Math.sin(t * 1.6 + x);
        g.moveTo(x, baseY - 50 * s)
          .lineTo(x - 26 * s, baseY)
          .lineTo(x + 26 * s, baseY)
          .closePath()
          .fill({ color: d.color2, alpha: pulse });
        break;
      }
      case 'bubbler': {
        g.ellipse(x, baseY - 5 * s, 14 * s, 8 * s).fill(d.color);
        const bt = (t * 0.7 + x * 0.01) % 1;
        for (let i = 0; i < 3; i++) {
          const by = baseY - 14 - ((bt + i * 0.33) % 1) * 70;
          g.circle(x + Math.sin(t * 2 + i * 2) * 5, by, 2.5 + i * 0.5)
            .stroke({ width: 1.2, color: d.color2, alpha: 0.6 });
        }
        break;
      }
      case 'sign': {
        g.rect(x - 2 * s, baseY - 34 * s, 4 * s, 34 * s).fill(d.color);
        g.roundRect(x - 24 * s, baseY - 48 * s, 48 * s, 18 * s, 4).fill(d.color2);
        g.moveTo(x - 16 * s, baseY - 39 * s).lineTo(x + 16 * s, baseY - 39 * s)
          .stroke({ width: 2, color: d.color, alpha: 0.7 });
        break;
      }
    }
  }

  // ---------- döngü ----------

  private incomeUiTimer = 0;

  private update(dt: number): void {
    this.time += dt;
    const { w, h } = this.bounds;

    // Pasif gelir birikimi (yetişkin balıklar, tavan: INCOME_CAP_HOURS saatlik üretim)
    const rate = this.incomePerHour;
    if (rate > 0) {
      this.save.incomePot = Math.min(rate * INCOME_CAP_HOURS, this.save.incomePot + (rate / 3600) * dt);
    }
    this.incomeUiTimer += dt;
    if (this.incomeUiTimer > 0.5) {
      this.incomeUiTimer = 0;
      this.ui.updateIncome(Math.floor(this.save.incomePot), rate);
    }

    for (let i = 0; i < this.rays.length; i++) {
      this.rays[i].alpha = 0.7 + 0.3 * Math.sin(this.time * 0.5 + i * 1.7);
      this.rays[i].skew.x = Math.sin(this.time * 0.22 + i) * 0.03;
    }

    this.drawDecor();
    this.drawBiomeAnim(dt, w, h);

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
      const fd = feedById(p.feed);
      this.pelletG.circle(p.x, p.y, 3.6).fill(fd.color);
      this.pelletG.circle(p.x - 1, p.y - 1, 1.3).fill(fd.color2);
    }

    // Balıklar
    const gm = this.growthMult;
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

      const grown = f.update(dt, this.time, this.bounds, target, gm);

      if (target && ti >= 0 && ti < this.pellets.length) {
        if (Math.hypot(this.pellets[ti].x - f.x, this.pellets[ti].y - f.y) < 16) {
          const fd = feedById(this.pellets[ti].feed);
          this.pellets.splice(ti, 1);
          f.hunger = Math.min(1, f.hunger + fd.hunger);
          audio.plop();
          this.addXp(1);
          this.save.stats.totalFed++;
          this.questEvent('feed', 1);
          // Kaliteli yem: satış fiyatı bonusu şansı
          let procced = false;
          if (fd.bonusChance > 0 && f.bonus < FISH_BONUS_CAP && Math.random() < fd.bonusChance) {
            f.bonus = Math.min(FISH_BONUS_CAP, f.bonus + fd.bonusAmount);
            procced = true;
            audio.coin();
          }
          for (let k = 0; k < (procced ? 7 : 3); k++) {
            this.particles.push({
              x: f.x + (Math.random() - 0.5) * 24, y: f.y - 14,
              vy: -22 - Math.random() * 16, life: 1,
              color: procced ? 0xffd23e : 0xff8fa8, r: procced ? 4 : 3,
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
    this.questEvent('collect', 1);
    this.ui.toast(`📖 Koleksiyona eklendi: ${sp.name}`);
    const all = SPECIES.filter((s) => s.rarity === sp.rarity);
    if (all.every((s) => this.save.collection.includes(s.id))) {
      this.save.pearls += 15;
      audio.levelup();
      this.ui.toast(`✨ ${RARITY_INFO[sp.rarity].name} seti tamamlandı! +15 inci, satışlara kalıcı +%5`);
    }
  }

  // ---------- offline / günlük / seri ----------

  private applyOffline(): void {
    const elapsed = Math.min(OFFLINE_CAP_MS, Date.now() - this.save.lastSeen);
    if (elapsed < 60_000) return;
    let grown = 0;
    // Offline pasif gelir: yetişkinler yarım hızda üretir (bonuslar dahil)
    let rate = 0;
    const cache: Record<string, number> = {};
    const mult = (tid: string) => (cache[tid] ??= 1 + this.tankBoostPct(tid) / 100);
    for (const fs of this.save.fishes) {
      if (fs.progress >= 1) rate += RARITY_INCOME[speciesById(fs.sp).rarity] * mult(fs.tank);
    }
    if (rate > 0) {
      const gained = (rate / 3600_000) * elapsed * OFFLINE_SPEED;
      const before = this.save.incomePot;
      this.save.incomePot = Math.min(rate * INCOME_CAP_HOURS, this.save.incomePot + gained);
      this.offline.income = Math.floor(this.save.incomePot - before);
    }
    for (const fs of this.save.fishes) {
      const tillSad = Math.max(0, (fs.hunger - SAD_THRESHOLD) / HUNGER_RATE_MS);
      const growMs = Math.min(elapsed, tillSad);
      const before = fs.progress;
      if (fs.progress < 1) {
        fs.progress = Math.min(1, fs.progress + (growMs * OFFLINE_SPEED * mult(fs.tank)) / speciesById(fs.sp).growthMs);
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
      this.save.lastDaily = today;
      this.save.streak = 1;
      return;
    }
    if (this.save.lastDaily !== today) {
      const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
      this.save.streak = this.save.lastDaily === yesterday ? this.save.streak + 1 : 1;
      this.save.lastDaily = today;
      const giftCoins = 200 + 50 * Math.min(7, this.save.streak);
      const giftPearls = this.save.streak % 7 === 0 ? 3 : 1;
      this.save.coins += giftCoins;
      this.save.pearls += giftPearls;
      this.offline.dailyGift = true;
      this.offline.giftCoins = giftCoins;
      this.offline.giftPearls = giftPearls;
    }
  }

  // ---------- görevler ----------

  ensureQuestDay(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.quests.day !== today) {
      this.save.quests = { day: today, progress: {}, claimed: [] };
    }
  }

  dailyQuests(): QuestDef[] {
    this.ensureQuestDay();
    return questsForDay(this.save.quests.day);
  }

  questEvent(ev: QuestEvent, n: number): void {
    this.ensureQuestDay();
    for (const q of this.dailyQuests()) {
      if (q.event !== ev || this.save.quests.claimed.includes(q.id)) continue;
      const cur = this.save.quests.progress[q.id] ?? 0;
      if (cur >= q.target) continue;
      const next = Math.min(q.target, cur + n);
      this.save.quests.progress[q.id] = next;
      if (next >= q.target) {
        audio.quest();
        this.ui.toast(`✅ Görev tamamlandı: ${q.name} — ödülünü Görevler'den al!`);
      }
    }
  }

  claimQuest(q: QuestDef): { ok: boolean; msg: string } {
    this.ensureQuestDay();
    const cur = this.save.quests.progress[q.id] ?? 0;
    if (cur < q.target) return { ok: false, msg: 'Görev henüz tamamlanmadı.' };
    if (this.save.quests.claimed.includes(q.id)) return { ok: false, msg: 'Ödül zaten alındı.' };
    this.save.quests.claimed.push(q.id);
    const coins = Math.round(q.rewardCoins * (1 + this.save.level * 0.1));
    this.save.coins += coins;
    this.save.pearls += q.rewardPearls;
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: `+${coins} altın${q.rewardPearls ? `, +${q.rewardPearls} inci` : ''}` };
  }

  claimAchievement(id: string): { ok: boolean; msg: string } {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return { ok: false, msg: 'Bilinmeyen başarım' };
    if (this.save.achievementsClaimed.includes(id)) return { ok: false, msg: 'Ödül zaten alındı.' };
    if (a.check(this.save) < a.target) return { ok: false, msg: 'Başarım henüz tamamlanmadı.' };
    this.save.achievementsClaimed.push(id);
    this.save.coins += a.rewardCoins;
    this.save.pearls += a.rewardPearls;
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: `${a.name}: +${a.rewardCoins} altın, +${a.rewardPearls} inci` };
  }

  // ---------- oyuncu eylemleri ----------

  private spawnFish(fs: FishSave): Fish {
    const f = new Fish(fs, speciesById(fs.sp), this.bounds);
    f.root.on('pointertap', () => {
      if (this.inputMode !== 'normal') return; // yem/düzenleme modunda balık kartı açılmaz
      this.ui.showFishInfo(f);
    });
    this.fishLayer.addChild(f.root);
    this.fishes.push(f);
    return f;
  }

  // ---------- giriş modları ----------

  setFeedType(f: FeedDef | null): void {
    this.feedType = f;
    if (f) this.editMode = false;
  }

  setEditMode(on: boolean): void {
    this.editMode = on;
    if (on) this.feedType = null;
    this.dragIndex = -1;
  }

  private onPointerDown(x: number, y: number): void {
    if (this.inputMode === 'feed') {
      this.dropPellet(x, y);
    } else if (this.inputMode === 'edit') {
      this.dragIndex = this.decorAt(x, y);
    }
  }

  private onPointerMove(x: number): void {
    if (this.inputMode !== 'edit' || this.dragIndex < 0) return;
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    const p = placed[this.dragIndex];
    if (p) p.fx = Math.min(0.97, Math.max(0.03, x / this.bounds.w));
  }

  private onPointerUp(): void {
    if (this.inputMode !== 'edit' || this.dragIndex < 0) return;
    // Bırakılan parça en öne gelir (dizinin sonu = en üst katman)
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    const [p] = placed.splice(this.dragIndex, 1);
    if (p) placed.push(p);
    this.dragIndex = -1;
    audio.place();
    this.syncSave();
  }

  /** Verilen noktadaki en üstteki dekorun dizinini döndürür (yoksa -1). */
  private decorAt(x: number, y: number): number {
    const { w, h } = this.bounds;
    const baseY = h - 58;
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    for (let i = placed.length - 1; i >= 0; i--) {
      const d = decorById(placed[i].def);
      const cx = placed[i].fx * w;
      const half = 46 * d.scale;
      if (x >= cx - half && x <= cx + half && y >= baseY - 110 * d.scale && y <= baseY + 14) return i;
    }
    return -1;
  }

  /** Tek yem tanesi at (dokunulan noktadan batar). Yem ücretliyse altın düşer. */
  dropPellet(x: number, y: number): void {
    const f = this.feedType;
    if (!f) return;
    if (this.pellets.length >= 25) return;
    if (f.cost > 0) {
      if (this.save.coins < f.cost) {
        audio.error();
        this.ui.toast(`Yeterli altın yok (${f.name}: ${f.cost} 🪙/tane)`);
        return;
      }
      this.save.coins -= f.cost;
      this.ui.refreshHUD();
    }
    const { h } = this.bounds;
    this.pellets.push({
      x,
      y: Math.min(y, h - 90),
      vy: 30 + Math.random() * 20,
      sway: Math.random() * Math.PI * 2,
      age: 0,
      feed: f.id,
    });
    audio.bubble();
  }

  buyFish(spId: string): { ok: boolean; msg: string } {
    const sp = speciesById(spId);
    if (this.fishes.length >= this.capacity) return { ok: false, msg: `Bu akvaryum dolu (${this.capacity} balık)` };
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
    this.questEvent('buyFish', 1);
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
      tank: this.save.activeTank,
    };
  }

  sellFish(f: Fish): { ok: boolean; msg: string } {
    if (!f.isAdult) return { ok: false, msg: 'Henüz yavru — büyümesini bekle' };
    const gain = Math.round(f.sp.sellPrice * this.sellMult * (1 + f.bonus));
    this.save.coins += gain;
    if (f.sp.rarity === 'legendary') this.save.pearls += 2;
    this.addXp(this.saleXp(f.sp.sellPrice));
    this.save.stats.totalSold++;
    this.save.stats.totalEarned += gain;
    this.questEvent('sell', 1);
    this.questEvent('earn', gain);
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
    if (this.fishes.length >= this.capacity) return { ok: false, msg: `Bu akvaryum dolu (${this.capacity} balık)` };
    if (tier.currency === 'coins') {
      if (this.save.coins < tier.cost) return { ok: false, msg: 'Yeterli altın yok' };
      this.save.coins -= tier.cost;
    } else {
      if (this.save.pearls < tier.cost) return { ok: false, msg: 'Yeterli inci yok' };
      this.save.pearls -= tier.cost;
    }

    let rarity: Rarity = 'common';
    if (tier.id === 'altin' && this.save.pityCounter >= PITY_LIMIT - 1) {
      rarity = 'legendary'; // garanti
    } else {
      const roll = Math.random() * 100;
      let acc = 0;
      for (const [r, pct] of Object.entries(tier.odds) as [Rarity, number][]) {
        acc += pct;
        if (roll < acc) { rarity = r; break; }
        rarity = r;
      }
    }
    if (tier.id === 'altin') {
      this.save.pityCounter = rarity === 'legendary' ? 0 : this.save.pityCounter + 1;
    }

    const pool = SPECIES.filter((s) => s.rarity === rarity);
    const sp = pool[Math.floor(Math.random() * pool.length)];
    this.spawnFish(this.newFishSave(sp));
    this.save.stats.eggsHatched++;
    this.questEvent('hatch', 1);
    audio.hatch(sp.rarity);
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: '', species: sp };
  }

  // ---------- dekor ----------

  buyDecor(defId: string): { ok: boolean; msg: string } {
    const d = decorById(defId);
    if (d.currency === 'coins') {
      if (this.save.coins < d.price) return { ok: false, msg: 'Yeterli altın yok' };
      this.save.coins -= d.price;
    } else {
      if (this.save.pearls < d.price) return { ok: false, msg: 'Yeterli inci yok' };
      this.save.pearls -= d.price;
    }
    this.save.decorOwned[defId] = (this.save.decorOwned[defId] ?? 0) + 1;
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: `${d.name} envanterine eklendi! 🎒 Envanterden yerleştir.` };
  }

  placeDecor(defId: string): { ok: boolean; msg: string } {
    const owned = this.save.decorOwned[defId] ?? 0;
    if (owned <= 0) return { ok: false, msg: 'Envanterinde bu dekordan yok' };
    const placed = this.save.decorPlaced[this.save.activeTank] ?? (this.save.decorPlaced[this.save.activeTank] = []);
    if (placed.length >= MAX_PLACED) return { ok: false, msg: `Bu akvaryumda en fazla ${MAX_PLACED} dekor olabilir` };
    // Diğerlerinden uzak bir yatay konum seç
    let fx = 0.1 + Math.random() * 0.8;
    for (let tries = 0; tries < 12; tries++) {
      const cand = 0.08 + Math.random() * 0.84;
      if (placed.every((p) => Math.abs(p.fx - cand) > 0.07)) { fx = cand; break; }
    }
    placed.push({ def: defId, fx });
    this.save.decorOwned[defId] = owned - 1;
    this.save.stats.decorPlacedCount++;
    this.questEvent('placeDecor', 1);
    audio.place();
    this.syncSave();
    this.ui.refreshHUD();
    const d = decorById(defId);
    return { ok: true, msg: `${d.name} yerleştirildi (+%${DECOR_BOOST[d.rarity]} büyüme & gelir)` };
  }

  removeDecor(index: number): { ok: boolean; msg: string } {
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    const p = placed[index];
    if (!p) return { ok: false, msg: 'Dekor bulunamadı' };
    placed.splice(index, 1);
    this.save.decorOwned[p.def] = (this.save.decorOwned[p.def] ?? 0) + 1;
    audio.click();
    this.syncSave();
    return { ok: true, msg: `${decorById(p.def).name} envantere geri alındı` };
  }

  // ---------- akvaryumlar ----------

  buyTank(tankId: string): { ok: boolean; msg: string } {
    const t = tankById(tankId);
    if (this.save.tanksOwned.includes(tankId)) return { ok: false, msg: 'Bu akvaryuma zaten sahipsin' };
    if (this.save.level < t.unlockLevel) return { ok: false, msg: `Seviye ${t.unlockLevel} gerekli` };
    if (t.currency === 'coins') {
      if (this.save.coins < t.price) return { ok: false, msg: 'Yeterli altın yok' };
      this.save.coins -= t.price;
    } else {
      if (this.save.pearls < t.price) return { ok: false, msg: 'Yeterli inci yok' };
      this.save.pearls -= t.price;
    }
    this.save.tanksOwned.push(tankId);
    this.save.decorPlaced[tankId] = this.save.decorPlaced[tankId] ?? [];
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: `${t.name} artık senin! 🏝️ Envanterden geçiş yapabilirsin.` };
  }

  switchTank(tankId: string): { ok: boolean; msg: string } {
    if (!this.save.tanksOwned.includes(tankId)) return { ok: false, msg: 'Önce bu akvaryumu satın almalısın' };
    if (tankId === this.save.activeTank) return { ok: false, msg: 'Zaten bu akvaryumdasın' };
    // Aktif balıkları uyut, yenilerini uyandır
    for (const f of this.fishes) {
      this.dormant.push(f.toSave());
      f.root.destroy({ children: true });
    }
    this.fishes = [];
    this.save.activeTank = tankId;
    const wake = this.dormant.filter((d) => d.tank === tankId);
    this.dormant = this.dormant.filter((d) => d.tank !== tankId);
    for (const fs of wake) this.spawnFish(fs);
    this.pellets = [];
    this.buildStatic();
    audio.setBiome(this.activeTank.biome);
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: `${this.activeTank.name} 🌊` };
  }

  tankFishCount(tankId: string): number {
    if (tankId === this.save.activeTank) return this.fishes.length;
    return this.dormant.filter((d) => d.tank === tankId).length;
  }

  // ---------- ortak ----------

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

  shopFish(): Species[] {
    return SPECIES.filter((s) => s.buyPrice > 0 || s.pearlPrice);
  }
  eggList(): EggTier[] { return EGGS; }
  tankList(): TankDef[] { return TANKS; }

  syncSave(): void {
    this.save.fishes = [...this.dormant, ...this.fishes.map((f) => f.toSave())];
    persist(this.save);
  }

  resetAll(): void {
    wipeSave();
    location.reload();
  }
}
