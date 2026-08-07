import { Application, Container, FillGradient, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { audio } from './audio';
import { DECOR, DECOR_BOOST, DECOR_BOOST_CAP, DecorDef, MAX_PLACED, decorById } from './decor';
import { Bounds, Fish, HUNGER_RATE, SAD_THRESHOLD, hungerGrowthMult } from './fish';
import { ACHIEVEMENTS, QuestDef, QuestEvent, questsForDay, weekKeyFor, weeklyQuestForWeek } from './quests';
import { FishSave, SaveData, loadSave, persist, wipeSave } from './save';
import { CloudSave, type CloudSyncResult } from './cloud-save';
import { Services, createServices } from './services';
import {
  EGGS, EggTier, FISH_NAMES, PITY_LIMIT, RARITY_INCOME, RARITY_INFO, Rarity, SPECIES, Species, speciesById,
} from './species';
import { FEEDS, FISH_BONUS_CAP, FeedDef, feedById, feedPackById } from './feeds';
import { Biome, TANKS, TANK_CAP_BONUS, TankDef, tankById } from './tanks';
import type { UI } from './ui';
import { t } from './i18n';

interface Pellet { x: number; y: number; vy: number; sway: number; age: number; feed: string }
interface Particle { x: number; y: number; vy: number; life: number; color: number; r: number }

const OFFLINE_CAP_MS = 8 * 3600_000;
const OFFLINE_SPEED = 0.5;
const HUNGER_RATE_MS = HUNGER_RATE / 1000; // fish.ts ile aynı kural, ms cinsinden

const MAX_DIRT_SPOTS = 6;              // akvaryum başına en fazla temizlenmemiş kir lekesi
const DIRT_PENALTY_MAX = 0.35;         // tamamen kirli akvaryumda üretim/büyüme %35 azalır
// İlk leke / ikinci leke / sonraki lekeler için gecikme aralıkları (ms): kirlenme sonraki
// lekelerde yavaşlar ki oyuncuya temizlemek için makul bir pencere kalsın.
const DIRT_DELAY_1: [number, number] = [120_000, 150_000];
const DIRT_DELAY_2: [number, number] = [150_000, 180_000];
const DIRT_DELAY_3: [number, number] = [400_000, 500_000];

/** İki rengi karıştırır (a=0 -> base, a=1 -> over). Yarı saydam katmanları önceden
 *  hesaplamak için: arkaplan düz renk olduğu sürece sonuç gerçek alfa karışımıyla aynıdır. */
function blend(base: number, over: number, a: number): number {
  const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255;
  const or = (over >> 16) & 255, og = (over >> 8) & 255, ob = over & 255;
  return (Math.round(br + (or - br) * a) << 16)
    | (Math.round(bg + (og - bg) * a) << 8)
    | Math.round(bb + (ob - bb) * a);
}

export interface OfflineSummary { minutes: number; grown: number; dailyGift: boolean; giftCoins: number; giftPearls: number; income: number }

/** Kazanç raporu satırı: balık başına saatlik üretim (akvaryum+dekor bonuslu) ve satış değeri. */
export interface FishEarning {
  name: string;
  sp: Species;
  adult: boolean;
  sad: boolean;
  perHour: number;
  sellValue: number;
  /** Satış için canlı referans: aktif sahnedeki balık ya da uyuyan kayıt. */
  live?: Fish;
  saved?: FishSave;
}
export interface TankEarnings { tank: TankDef; boostPct: number; dirtPct: number; count: number; perHour: number; fishes: FishEarning[] }

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
  /** Kum taneciği ve ışık havuzları — kum şekline maskelenir, suya taşmaz. */
  private sandFxG = new Graphics();
  private sandMaskG = new Graphics();
  private decorAnimG = new Graphics();
  private rays: Graphics[] = [];
  private rayLayer = new Container();
  private fishLayer = new Container();
  private pelletG = new Graphics();
  private fxG = new Graphics();
  private bubbleG = new Graphics();
  private dirtG = new Graphics();
  /** Kirli cam dokusu ekrandışı bu Graphics'e çizilir, ardından tek bir sprite'a "baked" edilir
   *  (her karede birçok yarı saydam şekli yeniden rasterize etmek yerine tek doku çizimi). */
  private grimeScratch = new Graphics();
  private grimeSprite = new Sprite();
  private grimeTex: Texture | null = null;
  private grimeCacheKey = '';
  private dirtTimer = 0;

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

  readonly cloud = new CloudSave();
  /** Açılıştaki bulut senkronunun sonucu — UI bilgilendirme için okur. */
  cloudSync: CloudSyncResult = 'disabled';

  constructor() {
    this.save = loadSave();
    this.services = createServices(this.save);
  }

  get bounds(): Bounds {
    return { w: this.app.screen.width, h: this.app.screen.height };
  }

  /** Alt bar / mod çubuğu gibi kalıcı UI'ın kapladığı yükseklik (CSS px). UI mount olurken ölçüp verir. */
  private uiBottomInset = 0;

  /** Zemin (kum üstü) çizgisi: dekorlar buraya oturur. Alt UI'ın üstünde kalması için inset kadar yukarıda. */
  get floorY(): number {
    return this.app.screen.height - this.uiBottomInset;
  }

  /** Kum bandının üst kenarının taban çizgisi. Gerçek yüzey buna göre eğrilir (bkz. sandSurfaceY). */
  get sandTopY(): number {
    return this.floorY - 96;
  }

  /** Kum yüzeyinin verilen x'teki gerçek yüksekliği. buildStatic'teki quadratic eğrilerin
   *  analitik karşılığıdır — dekorlar düz bir çizgiye değil, kumun kendi formuna oturur. */
  sandSurfaceY(x: number): number {
    const w = this.app.screen.width || 1;
    const top = this.sandTopY;
    const u = Math.min(1, Math.max(0, x / w));
    switch (this.activeTank.floor) {
      case 'mound': return top - 76 * u * (1 - u);
      case 'dip': return top + 52 * u * (1 - u);
      case 'wave': {
        if (u <= 0.5) {
          const t = u * 2;
          return top - 56 * t * (1 - t) - 4 * t * t;
        }
        const t = u * 2 - 1;
        return top - 4 * (1 - t) * (1 - t) + 40 * t * (1 - t) - 11 * t * t;
      }
      default: return top;
    }
  }

  /** Balıkların yüzebileceği alan: kuma girmemeleri için yükseklik kum çizgisiyle sınırlanır. */
  private get swimBounds(): Bounds {
    return { w: this.app.screen.width, h: this.sandTopY };
  }

  /** Alt UI yüksekliği değiştiğinde (mount, ekran döndürme) sahneyi yeni zemin çizgisiyle yeniden kurar. */
  setUiBottomInset(px: number): void {
    const next = Math.max(0, Math.round(px));
    if (next === this.uiBottomInset) return;
    this.uiBottomInset = next;
    if (this.app.renderer) this.buildStatic();
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

  /** Akvaryumun kirlilik seviyesi (0..1): temizlenmemiş leke sayısına göre. */
  dirtLevel(tankId: string): number {
    return Math.min(1, (this.save.dirtSpots[tankId]?.length ?? 0) / MAX_DIRT_SPOTS);
  }
  /** Kirlilik yüzdesi (0..100), üretim/büyüme kaybına karşılık gelir. */
  dirtPct(tankId: string): number {
    return Math.round(this.dirtLevel(tankId) * DIRT_PENALTY_MAX * 100);
  }

  /** Akvaryumun net çarpanı: dekor/tema bonusu eksi kirlilik cezası. Büyüme VE gelire işler. */
  tankNetMult(tankId: string): number {
    return (1 + this.tankBoostPct(tankId) / 100) * (1 - this.dirtLevel(tankId) * DIRT_PENALTY_MAX);
  }

  /** Aktif akvaryumun büyüme çarpanı. */
  get growthMult(): number {
    return this.tankNetMult(this.save.activeTank);
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
    const mult = (tid: string) => (cache[tid] ??= this.tankNetMult(tid));
    for (const f of this.fishes) if (f.isAdult) rate += RARITY_INCOME[f.sp.rarity] * mult(f.tank);
    for (const d of this.dormant) if (d.progress >= 1) rate += RARITY_INCOME[speciesById(d.sp).rarity] * mult(d.tank);
    return Math.round(rate);
  }

  /** Biriken geliri kasaya aktarır. */
  collectIncome(): { ok: boolean; msg: string } {
    const amount = Math.floor(this.save.incomePot);
    if (amount < 1) return { ok: false, msg: t('Henüz birikmiş gelir yok') };
    this.save.incomePot -= amount;
    this.save.coins += amount;
    this.save.stats.totalEarned += amount;
    this.questEvent('earn', amount);
    this.addXp(Math.max(1, Math.round(amount * 0.05)));
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('+{n} altın toplandı! 🪙', { n: amount }) };
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
    // Bulut senkronunu pixi başlatmasıyla ÇAKIŞTIR ki ağ gecikmesi açılış
    // süresine eklenmesin. Sonucu aşağıda, kayıt temizliği ve çevrimdışı
    // hesabı BAŞLAMADAN önce bekliyoruz: buluttan geri yüklenen kayıt da
    // yerel kayıtla aynı ayıklama/doğrulama adımlarından geçmeli.
    const cloudSyncPromise = this.cloud.sync(this.save);

    await this.app.init({ resizeTo: host, antialias: true, background: 0x2f7f96 });
    host.appendChild(this.app.canvas);

    this.world.addChild(
      this.bgG, this.rayLayer, this.decorAnimG, this.sandG, this.sandFxG, this.sandMaskG,
      this.pelletG, this.fishLayer, this.bubbleG, this.fxG, this.dirtG, this.grimeSprite,
    );
    this.sandFxG.mask = this.sandMaskG;
    this.app.stage.addChild(this.world);

    this.cloudSync = await cloudSyncPromise;
    // Oyuncu dokümanı ancak SENKRON SONRASI yayımlanır: buluttan geri yüklenen
    // kayıt kendi friendCode'unu getirir; önce yazılsaydı arkadaşların gördüğü
    // kod ile oyuncunun kodu ayrışırdı (bkz. services.ts publishPlayer).
    void this.services.social.publishPlayer?.();

    // Kayıttaki bilinmeyen dekor kimliklerini ayıkla (sürüm değişikliklerine karşı koruma)
    const known = new Set(DECOR.map((d) => d.id));
    for (const t of Object.keys(this.save.decorPlaced)) {
      this.save.decorPlaced[t] = (this.save.decorPlaced[t] ?? []).filter((p) => known.has(p.def));
    }
    for (const id of Object.keys(this.save.decorOwned)) {
      if (!known.has(id)) delete this.save.decorOwned[id];
    }
    for (const id of Object.keys(this.save.feedOwned)) {
      if (!FEEDS.some((f) => f.id === id)) delete this.save.feedOwned[id];
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
    for (const t of Object.keys(this.save.dirtSpots)) {
      if (!knownTanks.has(t)) delete this.save.dirtSpots[t];
    }

    const knownSpecies = new Set(SPECIES.map((s) => s.id));
    this.save.fishes = this.save.fishes.filter((f) => knownSpecies.has(f.sp));
    for (const f of this.save.fishes) {
      if (!this.save.tanksOwned.includes(f.tank)) f.tank = this.save.activeTank;
    }
    this.save.collection = this.save.collection.filter((id) => knownSpecies.has(id));

    this.applyOffline();
    this.dirtTimer = this.nextDirtDelay(this.save.dirtSpots[this.save.activeTank]?.length ?? 0);
    this.armCleanAd();
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
      if (document.hidden) {
        this.syncSave();
        // Arka plana alınırken buluta ZORLA yaz: Android/iOS uygulamayı
        // öldürdüğünde beforeunload çalışmayabilir, visibilitychange çalışır.
        this.cloud.flush(this.save);
      }
    });
    window.addEventListener('beforeunload', () => this.syncSave());

    // Burada BİLEREK açılış reklamı yok: AdMob uygulama açılışında geçiş
    // (interstitial) reklamı göstermeyi yasaklıyor ve bu "izin verilmeyen
    // uygulama" kategorisinde. Reklam yalnızca oyunun içindeki doğal molalarda
    // çıkar (akvaryum değişimi, akvaryumun tamamen temizlenmesi).
  }

  // ---------- sahne ----------

  private buildStatic(): void {
    const { w, h } = this.bounds;
    const tank = this.activeTank;
    const sandTop = this.sandTopY;

    // Su: arkaplan katmanının üzerine yarı saydam su gradyanı biner. Arkaplan düz bir renk
    // olduğu için karışım burada önceden hesaplanır — sonuç birebir aynı, alfa gradyanına gerek kalmaz.
    this.bgG.clear();
    const grad = new FillGradient(0, 0, 0, h);
    grad.addColorStop(0, blend(tank.backdrop, tank.water[0], 0.42));
    grad.addColorStop(0.55, blend(tank.backdrop, tank.water[1], 0.80));
    grad.addColorStop(1, blend(tank.backdrop, tank.water[2], 0.96));
    this.bgG.rect(0, 0, w, h).fill(grad);

    // Akvaryum kimliğinden türetilen sabit tohum: aynı akvaryum her açılışta aynı görünür.
    let seed = 0;
    for (const ch of tank.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return (seed >>> 8) / 16777216;
    };

    // ---------- ışık huzmeleri ----------
    // Karenin üstündeki sanal bir kaynaktan yelpaze gibi açılır ve kuma DEĞMEDEN söner.
    // Sert bir kesim çizgisi bırakmaması önemli: kum formu aşağı indiğinde o çizgi açıkta kalıyordu.
    const originX = w * (0.40 + rnd() * 0.20);
    const originY = -h * 0.6;
    const hits: { x: number; r: number; a: number }[] = [];
    this.rayLayer.removeChildren();
    this.rays = [];
    for (let i = 0; i < tank.rayCount; i++) {
      const spread = (i + 0.5) / tank.rayCount - 0.5;
      const ang = spread * 0.30 + (rnd() - 0.5) * 0.05;
      const tan = Math.tan(ang);
      const halfTop = w * (0.008 + rnd() * 0.009);
      const halfBot = halfTop * (2.1 + rnd() * 1.5);
      const endY = sandTop - 10 - rnd() * 26;
      const xTop = originX + (0 - originY) * tan;
      const xBot = originX + (endY - originY) * tan;
      const a = tank.rayAlpha * (1.05 + rnd() * 0.5);

      const g = new Graphics();
      // Dikey sönüm, sabit alfalı ince dilimlerle kurulur (gradyan alfası yerine —
      // her Pixi sürümünde aynı davranır ve bantlaşma bu dilim sayısında görünmez).
      const SEG = 18;
      for (const [wm, am] of [[1.75, 0.30], [1.0, 1.0]]) {
        for (let s = 0; s < SEG; s++) {
          const t0 = s / SEG, t1 = (s + 1) / SEG, tm = (t0 + t1) / 2;
          const fade = tm < 0.45 ? 1 - tm * 0.84 : Math.max(0, (1 - tm) / 0.55) * 0.62;
          if (fade <= 0.001) continue;
          const y0 = t0 * endY, y1 = t1 * endY;
          const x0 = xTop + (xBot - xTop) * t0, x1 = xTop + (xBot - xTop) * t1;
          const h0 = (halfTop + (halfBot - halfTop) * t0) * wm;
          const h1 = (halfTop + (halfBot - halfTop) * t1) * wm;
          g.moveTo(x0 - h0, y0).lineTo(x0 + h0, y0).lineTo(x1 + h1, y1).lineTo(x1 - h1, y1)
            .closePath().fill({ color: 0xffffff, alpha: a * am * fade });
        }
      }
      g.blendMode = 'add';
      this.rays.push(g);
      this.rayLayer.addChild(g);
      hits.push({ x: originX + (sandTop - originY) * tan, r: halfBot * 7, a });
    }

    // ---------- kum ----------
    // Üst kenarın formu akvaryuma göre değişir; kumun ÜSTÜNDE hiçbir nesne yoktur.
    const drawSandPath = (g: Graphics) => {
      g.moveTo(0, sandTop);
      if (tank.floor === 'mound') {
        g.quadraticCurveTo(w * 0.5, sandTop - 38, w, sandTop);
      } else if (tank.floor === 'dip') {
        g.quadraticCurveTo(w * 0.5, sandTop + 26, w, sandTop);
      } else if (tank.floor === 'wave') {
        g.quadraticCurveTo(w * 0.25, sandTop - 28, w * 0.5, sandTop - 4);
        g.quadraticCurveTo(w * 0.75, sandTop + 20, w, sandTop - 11);
      } else {
        g.lineTo(w, sandTop);
      }
      g.lineTo(w, h).lineTo(0, h).closePath();
    };

    // Kendi içinde üstten aydınlık, dipte koyu: ışığın kuma vurduğu hissini verir.
    const sandGrad = new FillGradient(0, sandTop - 40, 0, h);
    sandGrad.addColorStop(0, blend(tank.sand, 0xffffff, 0.13));
    sandGrad.addColorStop(0.4, tank.sand);
    sandGrad.addColorStop(1, blend(tank.sand, 0x000000, 0.14));
    this.sandG.clear();
    drawSandPath(this.sandG);
    this.sandG.fill(sandGrad);

    // Tanecik ve ışık havuzları kum şekline maskelenir ki suya taşmasınlar.
    this.sandMaskG.clear();
    drawSandPath(this.sandMaskG);
    this.sandMaskG.fill(0xffffff);

    this.sandFxG.clear();
    for (let i = 0; i < 70; i++) {
      this.sandFxG.circle(rnd() * w, sandTop - 30 + rnd() * (h - sandTop + 30), 0.8 + rnd() * 1.3)
        .fill({ color: tank.sandDots, alpha: 0.75 });
    }
    // Huzmelerin kuma düşürdüğü yumuşak ışık havuzları — iç içe elipslerle sönümlenir.
    const RINGS = 8;
    for (const p of hits) {
      const pa = Math.min(0.30, p.a * 3.4);
      for (let k = RINGS; k >= 1; k--) {
        const f = k / RINGS;
        this.sandFxG.ellipse(p.x, sandTop + 14, p.r * f, 40 * f)
          .fill({ color: 0xffffff, alpha: pa / RINGS });
      }
    }
  }

  // ---------- dekor çizimi ----------

  private drawDecor(): void {
    const { w } = this.bounds;
    const g = this.decorAnimG;
    g.clear();
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    for (let i = 0; i < placed.length; i++) {
      const p = placed[i];
      const d = decorById(p.def);
      const cx = p.fx * w;
      const baseY = this.sandSurfaceY(cx) + 6;
      // Düzenleme modu: sürüklenebilir parçaları vurgula
      if (this.editMode) {
        const half = 46 * d.scale;
        const active = i === this.dragIndex;
        g.roundRect(cx - half, baseY - 110 * d.scale, half * 2, 110 * d.scale + 12, 10)
          .fill({ color: active ? 0xffd23e : 0xffffff, alpha: active ? 0.18 : 0.08 })
          .stroke({ width: 2, color: active ? 0xffd23e : 0xffffff, alpha: active ? 0.9 : 0.4 });
      }
      this.drawDecorItem(g, d, cx, baseY);
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
      const floorY = this.sandTopY - 6;
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

      const grown = f.update(dt, this.time, this.swimBounds, target, gm);

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

    // Diğer akvaryumlardaki balıklar da yaşar: acıkır, tok oldukça büyür (aç iken de yavaş devam eder)
    const boostCache: Record<string, number> = {};
    const tmult = (tid: string) => (boostCache[tid] ??= this.tankNetMult(tid));
    for (const d of this.dormant) {
      d.hunger = Math.max(0, d.hunger - dt * HUNGER_RATE);
      if (d.progress < 1) {
        d.progress = Math.min(1, d.progress + (dt * 1000 * tmult(d.tank) * hungerGrowthMult(d.hunger)) / speciesById(d.sp).growthMs);
        if (d.progress >= 1) this.onDormantGrown(d);
      }
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

    // Kir lekeleri: zamanla oluşur, temizlenmedikçe camı bulanıklaştırır
    this.dirtTimer -= dt * 1000;
    if (this.dirtTimer <= 0) {
      this.maybeSpawnDirt(this.save.activeTank);
      this.dirtTimer = this.nextDirtDelay(this.save.dirtSpots[this.save.activeTank]?.length ?? 0);
    }
    this.drawDirt(w, h);
    this.drawGrime(w, h, this.dirtLevel(this.save.activeTank));
  }

  private onGrown(f: Fish): void {
    audio.grown();
    this.ui.toast(t('🎉 {name} yetişkin oldu! Satmak için üzerine dokun.', { name: f.name }));
    this.addToCollection(f.sp);
    this.syncSave();
    this.ui.refreshHUD();
  }

  private onDormantGrown(d: FishSave): void {
    audio.grown();
    this.ui.toast(t('🎉 {name}, {tank} akvaryumunda yetişkin oldu!', { name: d.name, tank: t(tankById(d.tank).name) }));
    this.addToCollection(speciesById(d.sp));
    this.syncSave();
    this.ui.refreshHUD();
  }

  private addToCollection(sp: Species): void {
    if (this.save.collection.includes(sp.id)) return;
    this.save.collection.push(sp.id);
    this.questEvent('collect', 1);
    this.ui.toast(t('📖 Koleksiyona eklendi: {name}', { name: t(sp.name) }));
    const all = SPECIES.filter((s) => s.rarity === sp.rarity);
    if (all.every((s) => this.save.collection.includes(s.id))) {
      this.save.pearls += 15;
      audio.levelup();
      this.ui.toast(t('✨ {rarity} seti tamamlandı! +15 inci, satışlara kalıcı +%5', { rarity: t(RARITY_INFO[sp.rarity].name) }));
    }
  }

  // ---------- offline / günlük / seri ----------

  private applyOffline(): void {
    const elapsed = Math.min(OFFLINE_CAP_MS, Date.now() - this.save.lastSeen);
    if (elapsed < 60_000) return;
    this.applyOfflineDirt(elapsed);
    let grown = 0;
    // Offline pasif gelir: yetişkinler yarım hızda üretir (bonuslar + kirlilik cezası dahil)
    let rate = 0;
    const cache: Record<string, number> = {};
    const mult = (tid: string) => (cache[tid] ??= this.tankNetMult(tid));
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
      // Açlık zamanla lineer düşer (0.05 tabanına kadar); büyüme, dönemin ortalama açlığına göre ölçeklenir
      const hunger1 = Math.max(0.05, fs.hunger - elapsed * HUNGER_RATE_MS);
      const avgHungerMult = hungerGrowthMult((fs.hunger + hunger1) / 2);
      const before = fs.progress;
      if (fs.progress < 1) {
        fs.progress = Math.min(1, fs.progress + (elapsed * avgHungerMult * OFFLINE_SPEED * mult(fs.tank)) / speciesById(fs.sp).growthMs);
        if (before < 1 && fs.progress >= 1) grown++;
      }
      fs.hunger = hunger1;
    }
    this.offline.minutes = Math.round(elapsed / 60_000);
    this.offline.grown = grown;
  }

  /** Uzakta geçen sürede sahip olunan tüm akvaryumlara, aynı kademeli gecikmelerle kir lekesi ekler. */
  private applyOfflineDirt(elapsed: number): void {
    for (const tid of this.save.tanksOwned) {
      const spots = this.save.dirtSpots[tid] ?? (this.save.dirtSpots[tid] = []);
      let remaining = elapsed;
      while (spots.length < MAX_DIRT_SPOTS) {
        const delay = this.nextDirtDelay(spots.length);
        if (delay > remaining) break;
        remaining -= delay;
        spots.push({
          id: Date.now() + Math.floor(Math.random() * 1000) + spots.length,
          fx: 0.08 + Math.random() * 0.84,
          fy: 0.14 + Math.random() * 0.62,
          r: 0.7 + Math.random() * 0.6,
          kind: Math.random() < 0.5 ? 0 : 1,
        });
      }
    }
  }

  private applyDailyGift(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.lastDaily === '') {
      this.save.lastDaily = today;
      this.save.streak = 1;
      this.save.bestStreak = Math.max(this.save.bestStreak, 1);
      return;
    }
    if (this.save.lastDaily !== today) {
      const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
      this.save.streak = this.save.lastDaily === yesterday ? this.save.streak + 1 : 1;
      this.save.bestStreak = Math.max(this.save.bestStreak, this.save.streak);
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

  ensureQuestWeek(): void {
    const week = weekKeyFor(new Date());
    if (this.save.weeklyQuest.day !== week) {
      this.save.weeklyQuest = { day: week, progress: {}, claimed: [] };
    }
  }

  weeklyQuest(): QuestDef {
    this.ensureQuestWeek();
    return weeklyQuestForWeek(this.save.weeklyQuest.day);
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
        this.ui.toast(t('✅ Görev tamamlandı: {name} — ödülünü Görevler\'den al!', { name: t(q.name) }));
      }
    }

    this.ensureQuestWeek();
    const wq = this.weeklyQuest();
    if (wq.event === ev && !this.save.weeklyQuest.claimed.includes(wq.id)) {
      const cur = this.save.weeklyQuest.progress[wq.id] ?? 0;
      if (cur < wq.target) {
        const next = Math.min(wq.target, cur + n);
        this.save.weeklyQuest.progress[wq.id] = next;
        if (next >= wq.target) {
          audio.quest();
          this.ui.toast(t('🏅 Haftalık görev tamamlandı: {name} — ödülünü Görevler\'den al!', { name: t(wq.name) }));
        }
      }
    }
  }

  claimQuest(q: QuestDef): { ok: boolean; msg: string } {
    this.ensureQuestDay();
    const cur = this.save.quests.progress[q.id] ?? 0;
    if (cur < q.target) return { ok: false, msg: t('Görev henüz tamamlanmadı.') };
    if (this.save.quests.claimed.includes(q.id)) return { ok: false, msg: t('Ödül zaten alındı.') };
    this.save.quests.claimed.push(q.id);
    const coins = Math.round(q.rewardCoins * (1 + this.save.level * 0.1));
    this.save.coins += coins;
    this.save.pearls += q.rewardPearls;
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('+{coins} altın', { coins }) + (q.rewardPearls ? t(', +{n} inci', { n: q.rewardPearls }) : '') };
  }

  claimWeeklyQuest(): { ok: boolean; msg: string } {
    this.ensureQuestWeek();
    const q = this.weeklyQuest();
    const cur = this.save.weeklyQuest.progress[q.id] ?? 0;
    if (cur < q.target) return { ok: false, msg: t('Haftalık görev henüz tamamlanmadı.') };
    if (this.save.weeklyQuest.claimed.includes(q.id)) return { ok: false, msg: t('Ödül zaten alındı.') };
    this.save.weeklyQuest.claimed.push(q.id);
    const coins = Math.round(q.rewardCoins * (1 + this.save.level * 0.1));
    this.save.coins += coins;
    this.save.pearls += q.rewardPearls;
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('Haftalık ödül: +{coins} altın', { coins }) + (q.rewardPearls ? t(', +{n} inci', { n: q.rewardPearls }) : '') };
  }

  claimAchievement(id: string): { ok: boolean; msg: string } {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return { ok: false, msg: t('Bilinmeyen başarım') };
    if (this.save.achievementsClaimed.includes(id)) return { ok: false, msg: t('Ödül zaten alındı.') };
    if (a.check(this.save) < a.target) return { ok: false, msg: t('Başarım henüz tamamlanmadı.') };
    this.save.achievementsClaimed.push(id);
    this.save.coins += a.rewardCoins;
    this.save.pearls += a.rewardPearls;
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name}: +{coins} altın, +{pearls} inci', { name: t(a.name), coins: a.rewardCoins, pearls: a.rewardPearls }) };
  }

  // ---------- oyuncu eylemleri ----------

  private spawnFish(fs: FishSave): Fish {
    const f = new Fish(fs, speciesById(fs.sp), this.swimBounds);
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
    } else {
      this.cleanDirtAt(x, y);
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
    const { w } = this.bounds;
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    for (let i = placed.length - 1; i >= 0; i--) {
      const d = decorById(placed[i].def);
      const cx = placed[i].fx * w;
      const baseY = this.sandSurfaceY(cx) + 6;
      const half = 46 * d.scale;
      if (x >= cx - half && x <= cx + half && y >= baseY - 110 * d.scale && y <= baseY + 14) return i;
    }
    return -1;
  }

  // ---------- kir / temizlik ----------

  /** Aktif akvaryuma, yer varsa yeni bir kir lekesi ekler. */
  /** Akvaryumdaki mevcut leke sayısına göre bir sonraki lekeye kalan süreyi (ms) rastgele seçer. */
  private nextDirtDelay(spotCount: number): number {
    const [min, max] = spotCount <= 0 ? DIRT_DELAY_1 : spotCount === 1 ? DIRT_DELAY_2 : DIRT_DELAY_3;
    return min + Math.random() * (max - min);
  }

  private maybeSpawnDirt(tankId: string): void {
    const spots = this.save.dirtSpots[tankId] ?? (this.save.dirtSpots[tankId] = []);
    if (spots.length >= MAX_DIRT_SPOTS) return;
    spots.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      fx: 0.08 + Math.random() * 0.84,
      fy: 0.14 + Math.random() * 0.62,
      r: 0.7 + Math.random() * 0.6,
      kind: Math.random() < 0.5 ? 0 : 1,
    });
    this.syncSave();
    this.ui.refreshHUD();
  }

  /** Verilen noktadaki en üstteki kir lekesinin dizinini döndürür (yoksa -1). */
  private dirtAt(x: number, y: number): number {
    const { w, h } = this.bounds;
    const spots = this.save.dirtSpots[this.save.activeTank] ?? [];
    for (let i = spots.length - 1; i >= 0; i--) {
      const s = spots[i];
      const cx = s.fx * w, cy = s.fy * h;
      const hit = 15 * s.r + 12; // tıklama toleransı
      if (Math.hypot(x - cx, y - cy) <= hit) return i;
    }
    return -1;
  }

  /** Günün ilk birkaç temizliğine ödül verilir (FishVille'deki günlük ilk 5 leke kuralı gibi). */
  private static readonly CLEAN_REWARD_DAILY_CAP = 5;
  private static readonly CLEAN_REWARD_COINS = 5;
  private static readonly CLEAN_REWARD_XP = 1;

  // ---------- Temizlik reklamı (oturum başına bir kez) ----------
  //
  // Temizlik reklamı yalnızca AKVARYUM TAMAMEN TEMİZLENDİĞİNDE çıkar: bu,
  // oyuncunun başladığı işi bitirdiği doğal mola noktasıdır. Önceki sürüm
  // rastgele bir leke sayısında tetikliyordu; bu, oyuncu daha temizliğin
  // ORTASINDAYKEN reklam basmak demekti ve Google Play'in "Better Ads
  // Experiences" politikasının doğrudan yasakladığı durum bu.
  //
  // Alan bilerek kayda yazılmaz: bellekte olması "yalnızca taze açılışta bir
  // kez" kuralını yapısal olarak garanti eder — arka plandan dönmek yeni bir
  // oturum saymaz. Bu sınır olmadan, kir sürekli yeniden oluştuğu için tek bir
  // oturumda defalarca tetiklenirdi.

  /** Bu oturumda "tamamen temizlendi" reklamı hâlâ gösterilebilir mi. */
  private cleanAdArmed = false;

  /** Açılışta bir kez: ekranda leke varsa bu oturum için hakkı açar. */
  private armCleanAd(): void {
    const spots = this.save.dirtSpots[this.save.activeTank]?.length ?? 0;
    // Açılışta hiç leke yoksa temizlenecek bir şey de yok; bu oturum atlanır.
    this.cleanAdArmed = spots > 0;
  }

  /** Her başarılı temizlikten SONRA çağrılır; akvaryumda leke kalmadıysa dener. */
  private countCleanForAd(): void {
    if (!this.cleanAdArmed) return;
    if ((this.save.dirtSpots[this.save.activeTank]?.length ?? 0) > 0) return;
    this.cleanAdArmed = false; // oturum başına tek sefer
    this.services.ads.maybeShowInterstitial();
  }

  /** Arka arkaya temizlenen lekeler için tek bildirim: her leke ayrı toast basmak yerine
   *  kısa bir pencerede biriktirilip toplu gösterilir (üst üste yığılmayı önler). */
  private cleanToastCount = 0;
  private cleanToastTimer: number | null = null;
  private static readonly CLEAN_TOAST_WINDOW_MS = 700;

  private queueCleanToast(): void {
    this.cleanToastCount++;
    if (this.cleanToastTimer !== null) clearTimeout(this.cleanToastTimer);
    this.cleanToastTimer = window.setTimeout(() => {
      const n = this.cleanToastCount;
      const coins = n * Game.CLEAN_REWARD_COINS;
      this.cleanToastCount = 0;
      this.cleanToastTimer = null;
      this.ui.toast(n === 1
        ? t('🧹 Leke temizlendi! +{n} altın', { n: coins })
        : t('🧹 {spots} leke temizlendi! +{n} altın', { spots: n, n: coins }));
    }, Game.CLEAN_TOAST_WINDOW_MS);
  }

  /** Dokunulan noktadaki kir lekesini temizler (varsa); parçacık efekti ve ses çalar. */
  private cleanDirtAt(x: number, y: number): void {
    const idx = this.dirtAt(x, y);
    if (idx < 0) return;
    const spots = this.save.dirtSpots[this.save.activeTank]!;
    const s = spots[idx];
    spots.splice(idx, 1);
    const { w, h } = this.bounds;
    const cx = s.fx * w, cy = s.fy * h;
    for (let k = 0; k < 9; k++) {
      this.particles.push({
        x: cx + (Math.random() - 0.5) * 22, y: cy + (Math.random() - 0.5) * 22,
        vy: -26 - Math.random() * 18, life: 1,
        color: 0xcdf5ff, r: 2 + Math.random() * 2,
      });
    }
    audio.clean();
    this.save.stats.totalCleaned++;
    this.questEvent('clean', 1);

    const today = new Date().toISOString().slice(0, 10);
    if (this.save.cleanRewardDay !== today) {
      this.save.cleanRewardDay = today;
      this.save.cleanRewardCount = 0;
    }
    if (this.save.cleanRewardCount < Game.CLEAN_REWARD_DAILY_CAP) {
      this.save.cleanRewardCount++;
      this.save.coins += Game.CLEAN_REWARD_COINS;
      this.addXp(Game.CLEAN_REWARD_XP);
      this.queueCleanToast();
    }

    this.syncSave();
    this.ui.refreshHUD();
    // Reklam denemesi bu fonksiyonun EN SONUNDA: parçacık, ses, altın ve HUD
    // güncellemesi önce uygulanır, reklam oyuncunun ödülünün üstüne binmesin.
    this.countCleanForAd();
  }

  /** Aktif akvaryumdaki kir lekelerini çizer. */
  private drawDirt(w: number, h: number): void {
    const g = this.dirtG;
    g.clear();
    const spots = this.save.dirtSpots[this.save.activeTank] ?? [];
    for (const s of spots) {
      const cx = s.fx * w, cy = s.fy * h;
      const r = 15 * s.r;
      const c1 = s.kind === 0 ? 0x4a5c34 : 0x5c4a34;
      const c2 = s.kind === 0 ? 0x39481f : 0x483519;
      g.circle(cx, cy, r).fill({ color: c1, alpha: 0.32 });
      g.circle(cx + r * 0.35, cy - r * 0.25, r * 0.55).fill({ color: c2, alpha: 0.3 });
      g.circle(cx - r * 0.3, cy + r * 0.2, r * 0.4).fill({ color: c2, alpha: 0.22 });
    }
  }

  /**
   * Kirlilik arttıkça camın kendisini kirli gösteren bir vinyet çizer: dört köşeden merkeze
   * doğru yumuşakça yayılan tek bir yosun/kireç rengi gradyanı. Sahneyi bulanıklaştırmaz,
   * sadece camın üstüne "kirli" bir filtre ekler.
   */
  private drawGrime(w: number, h: number, dl: number): void {
    // dirtLevel ve boyutlar değişmediği sürece yeniden çizmeye gerek yok (her frame vektör
    // geometrisini yeniden üretmek gereksiz maliyetli; kirlilik seviyesi seyrek değişir).
    const key = `${w}x${h}x${dl.toFixed(3)}`;
    if (key === this.grimeCacheKey) return;
    this.grimeCacheKey = key;

    const g = this.grimeScratch;
    g.clear();
    if (dl <= 0.02) {
      this.grimeSprite.visible = false;
      return;
    }
    this.grimeSprite.visible = true;

    // Köşelerden merkeze doğru yumuşak bir "kirli cam" vinyeti — çizgi/damla değil, dört köşeden
    // yayılan tek bir gradyan dolgu (aynı gradyan nesnesi dört köşede yeniden kullanılır).
    const cornerAlpha = 0.18 + dl * 0.42;
    const cornerGrad = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 }, innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 }, outerRadius: 0.5,
      colorStops: [
        { offset: 0, color: [0.24, 0.29, 0.15, cornerAlpha] },
        { offset: 1, color: [0.24, 0.29, 0.15, 0] },
      ],
    });
    const rad = (0.3 + dl * 0.4) * Math.min(w, h);
    const corners: [number, number][] = [[0, 0], [w, 0], [0, h], [w, h]];
    for (const [cx, cy] of corners) {
      g.circle(cx, cy, rad).fill(cornerGrad);
    }

    // Yarı saydam şekilleri her karede yeniden rasterize etmek yerine tek bir dokuya
    // "pişirip" sprite olarak gösteriyoruz: GPU her karede sadece bir quad çizer.
    const oldTex = this.grimeTex;
    this.grimeTex = this.app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, w, h) });
    this.grimeSprite.texture = this.grimeTex;
    this.grimeSprite.position.set(0, 0);
    if (oldTex) oldTex.destroy(true);
  }

  /** Tek yem tanesi at (dokunulan noktadan batar). Ücretli yem önce stoktan, stok yoksa altından düşer. */
  dropPellet(x: number, y: number): void {
    const f = this.feedType;
    if (!f) return;
    if (this.pellets.length >= 25) return;
    if (f.cost > 0) {
      const stock = this.save.feedOwned[f.id] ?? 0;
      if (stock > 0) {
        this.save.feedOwned[f.id] = stock - 1;
        this.ui.updateFeedChip(f);
      } else {
        if (this.save.coins < f.cost) {
          audio.error();
          this.ui.toast(t('Yeterli altın yok ({name}: {cost} 🪙/tane)', { name: t(f.name), cost: f.cost }));
          return;
        }
        this.save.coins -= f.cost;
        this.ui.refreshHUD();
      }
    }
    this.pellets.push({
      x,
      y: Math.min(y, this.sandTopY - 26),
      vy: 30 + Math.random() * 20,
      sway: Math.random() * Math.PI * 2,
      age: 0,
      feed: f.id,
    });
    audio.bubble();
  }

  /** Yem paketi satın al: stok çantaya eklenir. */
  buyFeedPack(packId: string): { ok: boolean; msg: string } {
    const p = feedPackById(packId);
    if (!p) return { ok: false, msg: t('Bilinmeyen paket') };
    if (this.save.coins < p.price) return { ok: false, msg: t('Yeterli altın yok') };
    this.save.coins -= p.price;
    this.save.feedOwned[p.feed] = (this.save.feedOwned[p.feed] ?? 0) + p.qty;
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{qty} × {name} çantana eklendi! 🎒', { qty: p.qty, name: t(feedById(p.feed).name) }) };
  }

  buyFish(spId: string): { ok: boolean; msg: string } {
    const sp = speciesById(spId);
    if (this.fishes.length >= this.capacity) return { ok: false, msg: t('Bu akvaryum dolu ({cap} balık)', { cap: this.capacity }) };
    if (sp.pearlPrice) {
      if (this.save.pearls < sp.pearlPrice) return { ok: false, msg: t('Yeterli inci yok') };
      this.save.pearls -= sp.pearlPrice;
    } else {
      if (this.save.level < sp.unlockLevel) return { ok: false, msg: t('Seviye {n} gerekli', { n: sp.unlockLevel }) };
      if (this.save.coins < sp.buyPrice) return { ok: false, msg: t('Yeterli altın yok') };
      this.save.coins -= sp.buyPrice;
    }
    const f = this.spawnFish(this.newFishSave(sp));
    audio.coin();
    this.questEvent('buyFish', 1);
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} akvaryuma katıldı! 🐟', { name: f.name }) };
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
    if (!f.isAdult) return { ok: false, msg: t('Henüz yavru — büyümesini bekle') };
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
    return { ok: true, msg: t('{name} satıldı: +{n} altın', { name: f.name, n: gain }) };
  }

  /** Uyuyan (başka akvaryumdaki) yetişkin balığı satar — akvaryum değiştirmeye gerek kalmaz. */
  sellDormant(fs: FishSave): { ok: boolean; msg: string } {
    if (fs.progress < 1) return { ok: false, msg: t('Henüz yavru — büyümesini bekle') };
    const idx = this.dormant.indexOf(fs);
    if (idx < 0) return { ok: false, msg: t('Balık bulunamadı') };
    const sp = speciesById(fs.sp);
    const gain = Math.round(sp.sellPrice * this.sellMult * (1 + (fs.bonus ?? 0)));
    this.dormant.splice(idx, 1);
    this.save.coins += gain;
    if (sp.rarity === 'legendary') this.save.pearls += 2;
    this.addXp(this.saleXp(sp.sellPrice));
    this.save.stats.totalSold++;
    this.save.stats.totalEarned += gain;
    this.questEvent('sell', 1);
    this.questEvent('earn', gain);
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} satıldı: +{n} altın', { name: fs.name, n: gain }) };
  }

  /** Kazanç/envanter satırından satış: aktif balığa ya da uyuyan kayda yönlenir. */
  sellEarning(fe: FishEarning): { ok: boolean; msg: string } {
    if (fe.live) return this.sellFish(fe.live);
    if (fe.saved) return this.sellDormant(fe.saved);
    return { ok: false, msg: t('Balık bulunamadı') };
  }

  hatchEgg(tier: EggTier): { ok: boolean; msg: string; species?: Species } {
    if (this.fishes.length >= this.capacity) return { ok: false, msg: t('Bu akvaryum dolu ({cap} balık)', { cap: this.capacity }) };
    if (tier.currency === 'coins') {
      if (this.save.coins < tier.cost) return { ok: false, msg: t('Yeterli altın yok') };
      this.save.coins -= tier.cost;
    } else {
      if (this.save.pearls < tier.cost) return { ok: false, msg: t('Yeterli inci yok') };
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
      if (this.save.coins < d.price) return { ok: false, msg: t('Yeterli altın yok') };
      this.save.coins -= d.price;
    } else {
      if (this.save.pearls < d.price) return { ok: false, msg: t('Yeterli inci yok') };
      this.save.pearls -= d.price;
    }
    this.save.decorOwned[defId] = (this.save.decorOwned[defId] ?? 0) + 1;
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} envanterine eklendi! 🎒 Envanterden yerleştir.', { name: t(d.name) }) };
  }

  placeDecor(defId: string): { ok: boolean; msg: string } {
    const owned = this.save.decorOwned[defId] ?? 0;
    if (owned <= 0) return { ok: false, msg: t('Envanterinde bu dekordan yok') };
    const placed = this.save.decorPlaced[this.save.activeTank] ?? (this.save.decorPlaced[this.save.activeTank] = []);
    if (placed.length >= MAX_PLACED) return { ok: false, msg: t('Bu akvaryumda en fazla {n} dekor olabilir', { n: MAX_PLACED }) };
    // Diğerlerinden uzak bir yatay konum seç
    let fx = 0.1 + Math.random() * 0.8;
    for (let tries = 0; tries < 12; tries++) {
      const cand = 0.08 + Math.random() * 0.84;
      if (placed.every((p) => Math.abs(p.fx - cand) > 0.07)) { fx = cand; break; }
    }
    placed.push({ def: defId, fx });
    this.save.decorOwned[defId] = owned - 1;
    // En yüksek eş zamanlı yerleştirilmiş dekor sayısını takip eder — basit bir sayaç olsaydı
    // yerleştir/kaldır döngüsüyle bedavaya sonsuz artırılabilirdi (kaldırma dekoru ücretsiz
    // envantere geri veriyor). Tavan, gerçekten sahip olunan dekorla sınırlı kalır.
    const totalPlacedNow = this.save.tanksOwned.reduce((sum, t) => sum + (this.save.decorPlaced[t]?.length ?? 0), 0);
    this.save.stats.decorPlacedCount = Math.max(this.save.stats.decorPlacedCount, totalPlacedNow);
    this.questEvent('placeDecor', 1);
    audio.place();
    this.syncSave();
    this.ui.refreshHUD();
    const d = decorById(defId);
    return { ok: true, msg: t('{name} yerleştirildi (+%{n} büyüme & gelir)', { name: t(d.name), n: DECOR_BOOST[d.rarity] }) };
  }

  removeDecor(index: number): { ok: boolean; msg: string } {
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    const p = placed[index];
    if (!p) return { ok: false, msg: t('Dekor bulunamadı') };
    placed.splice(index, 1);
    this.save.decorOwned[p.def] = (this.save.decorOwned[p.def] ?? 0) + 1;
    audio.click();
    this.syncSave();
    return { ok: true, msg: t('{name} envantere geri alındı', { name: t(decorById(p.def).name) }) };
  }

  // ---------- akvaryumlar ----------

  buyTank(tankId: string): { ok: boolean; msg: string } {
    const tank = tankById(tankId);
    if (this.save.tanksOwned.includes(tankId)) return { ok: false, msg: t('Bu akvaryuma zaten sahipsin') };
    if (this.save.level < tank.unlockLevel) return { ok: false, msg: t('Seviye {n} gerekli', { n: tank.unlockLevel }) };
    if (tank.currency === 'coins') {
      if (this.save.coins < tank.price) return { ok: false, msg: t('Yeterli altın yok') };
      this.save.coins -= tank.price;
    } else {
      if (this.save.pearls < tank.price) return { ok: false, msg: t('Yeterli inci yok') };
      this.save.pearls -= tank.price;
    }
    this.save.tanksOwned.push(tankId);
    this.save.decorPlaced[tankId] = this.save.decorPlaced[tankId] ?? [];
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} artık senin! 🏝️ Envanterden geçiş yapabilirsin.', { name: t(tank.name) }) };
  }

  switchTank(tankId: string): { ok: boolean; msg: string } {
    if (!this.save.tanksOwned.includes(tankId)) return { ok: false, msg: t('Önce bu akvaryumu satın almalısın') };
    if (tankId === this.save.activeTank) return { ok: false, msg: t('Zaten bu akvaryumdasın') };
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
    this.services.ads.maybeShowInterstitial();
    return { ok: true, msg: `${t(this.activeTank.name)} 🌊` };
  }

  tankFishCount(tankId: string): number {
    if (tankId === this.save.activeTank) return this.fishes.length;
    return this.dormant.filter((d) => d.tank === tankId).length;
  }

  /** Kazanç dökümü: her akvaryum için balık balık saatlik üretim (yavrular potansiyel olarak işaretli). */
  earningsByTank(): TankEarnings[] {
    const byTank: Record<string, FishEarning[]> = {};
    const push = (tankId: string, fe: Omit<FishEarning, 'perHour' | 'sellValue'>, bonus: number) => {
      const mult = this.tankNetMult(tankId);
      (byTank[tankId] ??= []).push({
        ...fe,
        perHour: Math.round(RARITY_INCOME[fe.sp.rarity] * mult),
        sellValue: Math.round(fe.sp.sellPrice * this.sellMult * (1 + bonus)),
      });
    };
    for (const f of this.fishes) {
      push(this.save.activeTank, { name: f.name, sp: f.sp, adult: f.isAdult, sad: f.isSad, live: f }, f.bonus);
    }
    for (const d of this.dormant) {
      push(d.tank, { name: d.name, sp: speciesById(d.sp), adult: d.progress >= 1, sad: d.hunger < SAD_THRESHOLD, saved: d }, d.bonus ?? 0);
    }
    return this.save.tanksOwned
      .map((tid) => {
        const fishes = (byTank[tid] ?? []).sort((a, b) => Number(b.adult) - Number(a.adult) || b.perHour - a.perHour);
        return {
          tank: tankById(tid),
          boostPct: this.tankBoostPct(tid),
          dirtPct: this.dirtPct(tid),
          count: fishes.length,
          perHour: fishes.reduce((sum, x) => sum + (x.adult ? x.perHour : 0), 0),
          fishes,
        };
      })
      .sort((a, b) => b.perHour - a.perHour);
  }

  /** Aktif akvaryumdaki bir balığı sahip olunan başka bir akvaryuma taşır. */
  moveFish(f: Fish, tankId: string): { ok: boolean; msg: string } {
    if (!this.save.tanksOwned.includes(tankId)) return { ok: false, msg: t('Önce bu akvaryumu satın almalısın') };
    if (tankId === this.save.activeTank) return { ok: false, msg: t('Balık zaten bu akvaryumda') };
    const cap = this.capacityFor(tankId);
    if (this.tankFishCount(tankId) >= cap) return { ok: false, msg: t('{name} dolu ({cap} balık)', { name: t(tankById(tankId).name), cap }) };
    const idx = this.fishes.indexOf(f);
    if (idx < 0) return { ok: false, msg: t('Balık bulunamadı') };
    this.fishes.splice(idx, 1);
    const fs = f.toSave();
    fs.tank = tankId;
    this.dormant.push(fs);
    f.root.destroy({ children: true });
    audio.place();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name}, {tank} akvaryumuna taşındı 🌊', { name: f.name, tank: t(tankById(tankId).name) }) };
  }

  // ---------- ortak ----------

  private addXp(n: number): void {
    this.save.xp += n;
    while (this.save.xp >= this.xpNeed(this.save.level)) {
      this.save.xp -= this.xpNeed(this.save.level);
      this.save.level++;
      this.save.pearls += 3;
      audio.levelup();
      this.ui.toast(t('⭐ Seviye {n}! +3 inci, kapasite {cap} balık', { n: this.save.level, cap: this.capacity }));
    }
  }

  /** Günün ilk 10 arkadaş ziyareti daha yüksek, sonrakiler düşük ödül verir (FishVille'deki komşu ziyareti gibi). */
  private static readonly VISIT_REWARD_HIGH_CAP = 10;
  private static readonly VISIT_REWARD_HIGH_COINS = 30;
  private static readonly VISIT_REWARD_HIGH_XP = 13;
  private static readonly VISIT_REWARD_LOW_COINS = 6;
  private static readonly VISIT_REWARD_LOW_XP = 2;

  hasVisitedFriendToday(code: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.friendVisits.day !== today) return false;
    return this.save.friendVisits.visited.includes(code);
  }

  visitFriend(code: string): { ok: boolean; msg: string } {
    if (!this.save.friends.some((f) => f.code === code)) return { ok: false, msg: t('Arkadaş bulunamadı') };
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.friendVisits.day !== today) {
      this.save.friendVisits = { day: today, visited: [], count: 0 };
    }
    if (this.save.friendVisits.visited.includes(code)) {
      return { ok: false, msg: t('Bu arkadaşı bugün zaten ziyaret ettin.') };
    }
    this.save.friendVisits.visited.push(code);
    this.save.friendVisits.count++;
    const high = this.save.friendVisits.count <= Game.VISIT_REWARD_HIGH_CAP;
    const coins = high ? Game.VISIT_REWARD_HIGH_COINS : Game.VISIT_REWARD_LOW_COINS;
    const xp = high ? Game.VISIT_REWARD_HIGH_XP : Game.VISIT_REWARD_LOW_XP;
    this.save.coins += coins;
    this.addXp(xp);
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('Akvaryumu ziyaret ettin: +{coins} altın, +{xp} XP 🤝', { coins, xp }) };
  }

  /** Günde bir kez herhangi bir balığı okşayabilirsin: küçük XP ve satış bonusu kazandırır. */
  private static readonly PET_REWARD_XP = 5;
  private static readonly PET_REWARD_BONUS = 0.05;

  get canPetToday(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return this.save.petDay !== today;
  }

  petFish(f: Fish): { ok: boolean; msg: string } {
    if (!this.canPetToday) return { ok: false, msg: t('Bugün zaten bir balığını okşadın. Yarın tekrar gel! 💕') };
    this.save.petDay = new Date().toISOString().slice(0, 10);
    f.hunger = Math.min(1, f.hunger + 0.15);
    f.bonus = Math.min(FISH_BONUS_CAP, f.bonus + Game.PET_REWARD_BONUS);
    this.addXp(Game.PET_REWARD_XP);
    audio.plop();
    for (let k = 0; k < 8; k++) {
      this.particles.push({
        x: f.x + (Math.random() - 0.5) * 26, y: f.y - 16,
        vy: -24 - Math.random() * 16, life: 1, color: 0xff8fc0, r: 3,
      });
    }
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} mutlu oldu! +{n} XP, satış değeri arttı 💕', { name: f.name, n: Game.PET_REWARD_XP }) };
  }

  /** Başka bir akvaryumdaki (uyuyan) balığı okşar — sahne dışı olduğu için parçacık efekti yok. */
  petDormant(fs: FishSave): { ok: boolean; msg: string } {
    if (!this.canPetToday) return { ok: false, msg: t('Bugün zaten bir balığını okşadın. Yarın tekrar gel! 💕') };
    this.save.petDay = new Date().toISOString().slice(0, 10);
    fs.hunger = Math.min(1, fs.hunger + 0.15);
    fs.bonus = Math.min(FISH_BONUS_CAP, (fs.bonus ?? 0) + Game.PET_REWARD_BONUS);
    this.addXp(Game.PET_REWARD_XP);
    audio.plop();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} mutlu oldu! +{n} XP, satış değeri arttı 💕', { name: fs.name, n: Game.PET_REWARD_XP }) };
  }

  /** Arkadaşa günde bir kez küçük bir yem hediyesi gönderilebilir; karşılığında sen de birkaç yem kazanırsın. */
  private static readonly GIFT_FEED_ID = 'lezzet';
  private static readonly GIFT_FEED_QTY = 3;
  private static readonly GIFT_REWARD_XP = 2;

  hasGiftedFriendToday(code: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.friendGifts.day !== today) return false;
    return this.save.friendGifts.gifted.includes(code);
  }

  giftFriend(code: string): { ok: boolean; msg: string } {
    if (!this.save.friends.some((f) => f.code === code)) return { ok: false, msg: t('Arkadaş bulunamadı') };
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.friendGifts.day !== today) {
      this.save.friendGifts = { day: today, gifted: [] };
    }
    if (this.save.friendGifts.gifted.includes(code)) {
      return { ok: false, msg: t('Bu arkadaşına bugün zaten hediye gönderdin.') };
    }
    this.save.friendGifts.gifted.push(code);
    this.save.feedOwned[Game.GIFT_FEED_ID] = (this.save.feedOwned[Game.GIFT_FEED_ID] ?? 0) + Game.GIFT_FEED_QTY;
    this.addXp(Game.GIFT_REWARD_XP);
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return {
      ok: true,
      msg: t('Hediye gönderildi! Karşılığında +{qty} {feed} kazandın 🎁', { qty: Game.GIFT_FEED_QTY, feed: t(feedById(Game.GIFT_FEED_ID).name) }),
    };
  }

  shopFish(): Species[] {
    return SPECIES.filter((s) => s.buyPrice > 0 || s.pearlPrice);
  }
  eggList(): EggTier[] { return EGGS; }
  tankList(): TankDef[] { return TANKS; }

  /**
   * Hesap değiştikten sonra (bkz. firebase-app.ts linkWithGoogle -> switched)
   * bulut kaydını yeni hesap için baştan karşılaştırır.
   *
   * rev sayacı cihazda tutulduğu ve eski hesaba ait olduğu için önce
   * sıfırlanır; aksi halde yeni hesabın buluttaki ilerlemesi "eski" sanılıp
   * sessizce ezilebilirdi.
   */
  async resyncCloudForNewAccount(): Promise<CloudSyncResult> {
    this.cloud.resetForNewAccount();
    this.cloudSync = await this.cloud.sync(this.save);
    return this.cloudSync;
  }

  syncSave(): void {
    this.save.fishes = [...this.dormant, ...this.fishes.map((f) => f.toSave())];
    persist(this.save);
    this.services.social.updateScore?.(this.save);
    // Yerel kayıt her zaman anında yazılır; buluta yazma kotayı korumak için
    // kısıtlıdır (bkz. cloud-save.ts UPLOAD_THROTTLE_MS).
    this.cloud.markDirty();
    this.cloud.maybeUpload(this.save);
  }

  resetAll(): void {
    wipeSave();
    location.reload();
  }
}
