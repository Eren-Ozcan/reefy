import { Application, Container, FillGradient, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { audio } from './audio';
import { DECOR, DECOR_BOOST, DECOR_BOOST_CAP, DecorDef, MAX_PLACED, decorById } from './decor';
import { Bounds, Fish, HUNGER_RATE, SAD_THRESHOLD, hungerGrowthMult } from './fish';
import { EventDef, EventTier, activeEvent, claimableEvent, tierReached } from './events';
import { ACHIEVEMENTS, QuestDef, QuestEvent, questsForDay, weekKeyFor, weeklyQuestForWeek } from './quests';
import { REWARDED_ADS_PER_DAY } from './ads';
import { DirtSpot, FishSave, PendingEgg, SaveData, loadSave, persist, wipeSave } from './save';
import { CloudSave, type CloudSyncResult } from './cloud-save';
import { Services, createServices } from './services';
import {
  EGGS, EggTier, FISH_NAMES, PITY_LIMIT, RARITY_INCOME, RARITY_INFO, Rarity, SPECIES, SPEEDUP_MS_PER_PEARL,
  Species, speciesById,
} from './species';
import { FEEDS, FISH_BONUS_CAP, FeedDef, feedById, feedPackById } from './feeds';
import { Biome, TANKS, TANK_CAP_BONUS, TankDef, tankById } from './tanks';
import type { UI } from './ui';
import { t } from './i18n';

interface Pellet { x: number; y: number; vy: number; sway: number; age: number; feed: string }
interface Particle { x: number; y: number; vy: number; life: number; color: number; r: number }

const OFFLINE_CAP_MS = 8 * 3600_000;
const OFFLINE_SPEED = 0.5;
const HUNGER_RATE_MS = HUNGER_RATE / 1000; // same rule as fish.ts, in ms

const MAX_DIRT_SPOTS = 6;              // max unclean dirt spots per tank
const DIRT_PENALTY_MAX = 0.35;         // production/growth is reduced by 35% in a fully dirty tank
// Delay ranges (ms) for the first spot / second spot / later spots: dirtying slows down
// for later spots so the player has a reasonable window to clean up.
const DIRT_DELAY_1: [number, number] = [120_000, 150_000];
const DIRT_DELAY_2: [number, number] = [150_000, 180_000];
const DIRT_DELAY_3: [number, number] = [400_000, 500_000];

/** Blends two colors (a=0 -> base, a=1 -> over). For precomputing semi-transparent layers:
 *  as long as the background is a flat color, the result matches a real alpha blend. */
function blend(base: number, over: number, a: number): number {
  const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255;
  const or = (over >> 16) & 255, og = (over >> 8) & 255, ob = over & 255;
  return (Math.round(br + (or - br) * a) << 16)
    | (Math.round(bg + (og - bg) * a) << 8)
    | Math.round(bb + (ob - bb) * a);
}

export interface OfflineSummary { minutes: number; grown: number; dailyGift: boolean; giftCoins: number; giftPearls: number; income: number }

/** Earnings report row: per-fish hourly production (with tank+decor bonuses) and sell value. */
export interface FishEarning {
  name: string;
  sp: Species;
  adult: boolean;
  sad: boolean;
  perHour: number;
  sellValue: number;
  /** Live reference for selling: the fish in the active scene, or a dormant save record. */
  live?: Fish;
  saved?: FishSave;
}
export interface TankEarnings { tank: TankDef; boostPct: number; dirtPct: number; count: number; perHour: number; fishes: FishEarning[] }

export const INCOME_CAP_HOURS = 4; // accumulated income can be at most this many hours of production

export class Game {
  app = new Application();
  ui!: UI;
  save: SaveData;
  services: Services;
  fishes: Fish[] = [];          // fish in the active tank
  private dormant: FishSave[] = []; // fish in other tanks

  private world = new Container();
  private bgG = new Graphics();
  private sandG = new Graphics();
  /** Sand grain and light-pool effects — masked to the sand shape so they don't spill into the water. */
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
  /** The dirty-glass texture is drawn offscreen into this Graphics, then "baked" into a single sprite
   *  (one texture draw instead of re-rasterizing many semi-transparent shapes every frame). */
  private grimeScratch = new Graphics();
  private grimeSprite = new Sprite();
  private grimeTex: Texture | null = null;
  private grimeCacheKey = '';
  private dirtTimer = 0;

  private pellets: Pellet[] = [];
  private particles: Particle[] = [];

  /** Input modes: taps drop feed when a feed type is selected; decor is dragged in edit mode. */
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
  /** Result of the startup cloud sync — read by the UI for informational display. */
  cloudSync: CloudSyncResult = 'disabled';
  /**
   * How many ms the startup sync is allowed to hold up boot. This is NOT the sync's own
   * budget (that's much longer, see cloud-save.ts): it only answers "how long do we make
   * the player wait." If exceeded, the game opens and handleLateCloudSync() handles the
   * result once it arrives.
   */
  static readonly CLOUD_STARTUP_GRACE_MS = 3000;
  /** For the UI to open the conflict screen if a sync that exceeded the grace period returns 'conflict'. */
  onLateConflict?: () => void;
  /** A reload is pending after a cloud restore — see freezeForRestore(). */
  private frozen = false;

  constructor() {
    this.save = loadSave();
    this.services = createServices(this.save);
  }

  get bounds(): Bounds {
    return { w: this.app.screen.width, h: this.app.screen.height };
  }

  /** Height (CSS px) taken up by persistent UI like the bottom bar / mode bar. Measured and provided by the UI on mount. */
  private uiBottomInset = 0;

  /** Floor (above-sand) line: decor sits here. Raised by the inset so it stays above the bottom UI. */
  get floorY(): number {
    return this.app.screen.height - this.uiBottomInset;
  }

  /** Baseline of the sand band's top edge. The actual surface curves relative to this (see sandSurfaceY). */
  get sandTopY(): number {
    return this.floorY - 96;
  }

  /** The actual height of the sand surface at a given x. The analytic counterpart of the
   *  quadratic curves in buildStatic — decor sits on the sand's own shape, not a flat line. */
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

  /** The area fish can swim in: height is capped at the sand line so they don't swim into the sand. */
  private get swimBounds(): Bounds {
    return { w: this.app.screen.width, h: this.sandTopY };
  }

  /**
   * Rectangles, in the same 0..1 scene coordinates the dirt uses, where a DOM
   * control stands over the water. Dirt is never spawned inside one.
   *
   * The rule this enforces is simple and was previously violated by every
   * button that floated on the scene: dirt is TAPPED to clean it, so a spot
   * underneath a button can never be tapped. It does not merely look untidy —
   * the spot counts toward the tank's dirt percentage and toward the cap, so
   * an unreachable one permanently soils the tank and starves the cleaning
   * reward. Reported by the UI, which is the only side that knows where its
   * elements ended up after layout.
   */
  private uiKeepOut: { x0: number; y0: number; x1: number; y1: number }[] = [];

  setUiKeepOut(rects: { x0: number; y0: number; x1: number; y1: number }[]): void {
    this.uiKeepOut = rects;
  }

  /** Is this scene-normalised point under a control? */
  private isUnderUi(fx: number, fy: number): boolean {
    return this.uiKeepOut.some((r) => fx >= r.x0 && fx <= r.x1 && fy >= r.y0 && fy <= r.y1);
  }

  /**
   * A dirt position clear of the controls. Rejection sampling rather than
   * geometry: the blocked area is small and the attempt count is bounded, and
   * an occasional fallback to a blocked spot is far cheaper than the maths to
   * carve rectangles out of the spawn area. The fallback is deliberate — never
   * spawning at all would silently stop dirt if the UI ever covered everything.
   */
  private dirtSpot(idSalt = 0): DirtSpot {
    let fx = 0;
    let fy = 0;
    for (let i = 0; i < 12; i++) {
      fx = 0.08 + Math.random() * 0.84;
      fy = 0.14 + Math.random() * 0.62;
      if (!this.isUnderUi(fx, fy)) break;
    }
    return {
      id: Date.now() + Math.floor(Math.random() * 1000) + idSalt,
      fx,
      fy,
      r: 0.7 + Math.random() * 0.6,
      kind: Math.random() < 0.5 ? 0 : 1,
    };
  }

  /** Rebuilds the scene with the new floor line when the bottom UI height changes (mount, screen rotation). */
  setUiBottomInset(px: number): void {
    const next = Math.max(0, Math.round(px));
    if (next === this.uiBottomInset) return;
    this.uiBottomInset = next;
    if (this.app.renderer) this.buildStatic();
  }
  get activeTank(): TankDef { return tankById(this.save.activeTank); }

  /** Capacity of a given tank: level baseline + tank-tier bonus. */
  capacityFor(tankId: string): number {
    return Math.min(6 + this.save.level, 24) + TANK_CAP_BONUS[tankById(tankId).rarity];
  }
  /** Active tank's capacity. */
  get capacity(): number { return this.capacityFor(this.save.activeTank); }

  get sellMult(): number { return 1 + 0.05 * this.completedSets().length; }

  /** Tank's total bonus (%): theme bonus + placed decor. Affects BOTH growth and passive income. */
  tankBoostPct(tankId: string): number {
    const t = tankById(tankId);
    const placed = this.save.decorPlaced[tankId] ?? [];
    let pct = t.growthBonus;
    for (const p of placed) pct += DECOR_BOOST[decorById(p.def).rarity];
    return Math.min(DECOR_BOOST_CAP, pct);
  }

  /** Tank's dirt level (0..1), based on the number of unclean spots. */
  dirtLevel(tankId: string): number {
    return Math.min(1, (this.save.dirtSpots[tankId]?.length ?? 0) / MAX_DIRT_SPOTS);
  }
  /** Dirt percentage (0..100), corresponds to production/growth loss. */
  dirtPct(tankId: string): number {
    return Math.round(this.dirtLevel(tankId) * DIRT_PENALTY_MAX * 100);
  }

  /** Tank's net multiplier: decor/theme bonus minus dirt penalty. Affects both growth and income. */
  tankNetMult(tankId: string): number {
    return (1 + this.tankBoostPct(tankId) / 100) * (1 - this.dirtLevel(tankId) * DIRT_PENALTY_MAX);
  }

  /** Active tank's growth multiplier. */
  get growthMult(): number {
    return this.tankNetMult(this.save.activeTank);
  }

  /**
   * Level curve: fast early on (Lv1 = 50 XP ≈ 2 sales), steepens late-game (exponent 2.2).
   * Since sale XP is price to the power of 0.75, late levels take hours — this is intentional.
   */
  xpNeed(level: number): number { return Math.round(50 * Math.pow(level, 2.2)); }

  /** XP from a sale: diminishing returns — expensive fish give a lot of XP but not linearly with price. */
  saleXp(sellPrice: number): number { return Math.max(5, Math.round(Math.pow(sellPrice, 0.75))); }

  /** Total hourly production of adult fish across all tanks (with tank+decor bonuses). */
  get incomePerHour(): number {
    let rate = 0;
    const cache: Record<string, number> = {};
    const mult = (tid: string) => (cache[tid] ??= this.tankNetMult(tid));
    for (const f of this.fishes) if (f.isAdult) rate += RARITY_INCOME[f.sp.rarity] * mult(f.tank);
    for (const d of this.dormant) if (d.progress >= 1) rate += RARITY_INCOME[speciesById(d.sp).rarity] * mult(d.tank);
    return Math.round(rate);
  }

  /** Transfers accumulated income into the coin balance. */
  collectIncome(): { ok: boolean; msg: string } {
    const amount = Math.floor(this.save.incomePot);
    if (amount < 1) return { ok: false, msg: t('No income collected yet') };
    this.save.incomePot -= amount;
    this.save.coins += amount;
    this.save.stats.totalEarned += amount;
    this.questEvent('earn', amount);
    this.addXp(Math.max(1, Math.round(amount * 0.05)));
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('+{n} coins collected! 🪙', { n: amount }) };
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
    // OVERLAP the cloud sync with pixi's init so network latency isn't added to
    // startup time. We await the result below, before starting save cleanup and
    // the offline accounting: a save restored from the cloud must go through the
    // same sanitation/validation steps as the local save.
    const cloudSyncPromise = this.cloud.sync(this.save);

    await this.app.init({ resizeTo: host, antialias: true, background: 0x2f7f96 });
    host.appendChild(this.app.canvas);

    this.world.addChild(
      this.bgG, this.rayLayer, this.decorAnimG, this.sandG, this.sandFxG, this.sandMaskG,
      this.pelletG, this.fishLayer, this.bubbleG, this.fxG, this.dirtG, this.grimeSprite,
    );
    this.sandFxG.mask = this.sandMaskG;
    this.app.stage.addChild(this.world);

    // SHORT grace period for the startup sync. The sync's own budget is much more
    // generous (see cloud-save.ts AUTH_TIMEOUT_MS): making the player wait and
    // killing the sync are not the same thing. Previously a single 3s duration did
    // both jobs at once, and exceeding it permanently canceled the sync — in
    // measurements ensureUid took 2946 ms, right under the limit.
    const PENDING = Symbol('pending');
    const raced = await Promise.race([
      cloudSyncPromise,
      new Promise<typeof PENDING>((r) => setTimeout(() => r(PENDING), Game.CLOUD_STARTUP_GRACE_MS)),
    ]);
    if (raced === PENDING) void cloudSyncPromise.then((res) => this.handleLateCloudSync(res));
    else this.cloudSync = raced;

    // The player document is only published AFTER THE SYNC: a save restored from the
    // cloud brings its own friendCode; publishing before that would make the code
    // friends see diverge from the player's actual code (see services.ts publishPlayer).
    //
    // If the sync exceeds the grace period and arrives late, the OLD code gets published
    // here; but since a late-arriving restore reloads the page, the next startup
    // republishes with the correct code — the drift is temporary and self-corrects.
    void this.services.social.publishPlayer?.();

    // Strip unknown decor ids from the save (protects against version changes)
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

    // Strip unknown tank/species ids from the save (prevents crashes if the catalog changes)
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

    // Split fish into active/dormant
    for (const fs of this.save.fishes) {
      if (fs.tank === this.save.activeTank) this.spawnFish(fs);
      else this.dormant.push(fs);
    }

    audio.setBiome(this.activeTank.biome);

    // Scene taps: feed mode drops feed with a single tap, edit mode drags decor
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
        // FORCE-write to the cloud when backgrounded: beforeunload may not fire when
        // Android/iOS kills the app, but visibilitychange does.
        this.cloud.flush(this.save);
      }
    });
    window.addEventListener('beforeunload', () => this.syncSave());

    // DELIBERATELY no launch ad here: AdMob prohibits showing an interstitial ad
    // on app launch, and this falls under the "disallowed app" category. Ads only
    // appear at natural breaks within the game (switching tanks, fully cleaning a tank).
  }

  // ---------- scene ----------

  private buildStatic(): void {
    const { w, h } = this.bounds;
    const tank = this.activeTank;
    const sandTop = this.sandTopY;

    // Water: a semi-transparent water gradient sits over the background layer. Since the
    // background is a flat color, the blend is precomputed here — the result is identical, no alpha gradient needed.
    this.bgG.clear();
    const grad = new FillGradient(0, 0, 0, h);
    grad.addColorStop(0, blend(tank.backdrop, tank.water[0], 0.42));
    grad.addColorStop(0.55, blend(tank.backdrop, tank.water[1], 0.80));
    grad.addColorStop(1, blend(tank.backdrop, tank.water[2], 0.96));
    this.bgG.rect(0, 0, w, h).fill(grad);

    // Fixed seed derived from the tank id: the same tank looks the same every time it opens.
    let seed = 0;
    for (const ch of tank.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return (seed >>> 8) / 16777216;
    };

    // ---------- light rays ----------
    // Fans out from a virtual source above the frame and fades out WITHOUT touching the sand.
    // Important that it leave no hard cutoff line: that line used to show when the sand shape dipped lower.
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
      // Vertical falloff is built from thin fixed-alpha slices (instead of a gradient alpha —
      // behaves the same across every Pixi version, and banding isn't visible at this slice count).
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

    // ---------- sand ----------
    // The top edge's shape varies per tank; nothing sits ABOVE the sand.
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

    // Bright at top, dark at the bottom: gives the feeling of light hitting the sand.
    const sandGrad = new FillGradient(0, sandTop - 40, 0, h);
    sandGrad.addColorStop(0, blend(tank.sand, 0xffffff, 0.13));
    sandGrad.addColorStop(0.4, tank.sand);
    sandGrad.addColorStop(1, blend(tank.sand, 0x000000, 0.14));
    this.sandG.clear();
    drawSandPath(this.sandG);
    this.sandG.fill(sandGrad);

    // Grain and light-pool effects are masked to the sand shape so they don't spill into the water.
    this.sandMaskG.clear();
    drawSandPath(this.sandMaskG);
    this.sandMaskG.fill(0xffffff);

    this.sandFxG.clear();
    for (let i = 0; i < 70; i++) {
      this.sandFxG.circle(rnd() * w, sandTop - 30 + rnd() * (h - sandTop + 30), 0.8 + rnd() * 1.3)
        .fill({ color: tank.sandDots, alpha: 0.75 });
    }
    // Soft light pools the rays cast onto the sand — faded out with nested ellipses.
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

  // ---------- decor drawing ----------

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
      // Edit mode: highlight draggable pieces
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

  // ---------- loop ----------

  private incomeUiTimer = 0;

  private update(dt: number): void {
    this.time += dt;
    const { w, h } = this.bounds;

    // Passive income accumulation (adult fish, capped at INCOME_CAP_HOURS of production)
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

    // Bubbles
    this.bubbleG.clear();
    for (const b of this.bubbles) {
      b.y -= (b.vy * dt) / h;
      if (b.y < 0.02) { b.y = 1.02; b.x = Math.random(); }
      const bx = b.x * w + Math.sin(this.time * 1.4 + b.phase) * 6;
      this.bubbleG.circle(bx, b.y * h, b.r).stroke({ width: 1.2, color: 0xffffff, alpha: 0.35 });
    }

    // Feed pellets
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

    // Fish
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
          // Quality feed: chance of a sell-price bonus
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

    // Fish in other tanks live too: they get hungry, grow while fed (still progress slowly while hungry)
    const boostCache: Record<string, number> = {};
    const tmult = (tid: string) => (boostCache[tid] ??= this.tankNetMult(tid));
    for (const d of this.dormant) {
      d.hunger = Math.max(0, d.hunger - dt * HUNGER_RATE);
      if (d.progress < 1) {
        d.progress = Math.min(1, d.progress + (dt * 1000 * tmult(d.tank) * hungerGrowthMult(d.hunger)) / speciesById(d.sp).growthMs);
        if (d.progress >= 1) this.onDormantGrown(d);
      }
    }

    // Particles
    for (const p of this.particles) {
      p.y += p.vy * dt;
      p.life -= dt * 1.1;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.fxG.clear();
    for (const p of this.particles) {
      this.fxG.circle(p.x, p.y, p.r * p.life).fill({ color: p.color, alpha: p.life });
    }

    // Dirt spots: form over time, cloud the glass unless cleaned
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
    this.ui.toast(t('🎉 {name} grew up! Tap it to sell.', { name: f.name }));
    this.addToCollection(f.sp);
    this.syncSave();
    this.ui.refreshHUD();
  }

  private onDormantGrown(d: FishSave): void {
    audio.grown();
    this.ui.toast(t('🎉 {name} grew up in {tank}!', { name: d.name, tank: t(tankById(d.tank).name) }));
    this.addToCollection(speciesById(d.sp));
    this.syncSave();
    this.ui.refreshHUD();
  }

  private addToCollection(sp: Species): void {
    if (this.save.collection.includes(sp.id)) return;
    this.save.collection.push(sp.id);
    this.questEvent('collect', 1);
    this.ui.toast(t('📖 Added to collection: {name}', { name: t(sp.name) }));
    const all = SPECIES.filter((s) => s.rarity === sp.rarity);
    if (all.every((s) => this.save.collection.includes(s.id))) {
      this.save.pearls += 15;
      audio.levelup();
      this.ui.toast(t('✨ {rarity} set complete! +15 pearls, permanent +5% to sales', { rarity: t(RARITY_INFO[sp.rarity].name) }));
    }
  }

  // ---------- offline / daily / streak ----------

  private applyOffline(): void {
    const elapsed = Math.min(OFFLINE_CAP_MS, Date.now() - this.save.lastSeen);
    if (elapsed < 60_000) return;
    this.applyOfflineDirt(elapsed);
    let grown = 0;
    // Offline passive income: adults produce at half rate (including bonuses + dirt penalty)
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
      // Hunger drops linearly over time (down to a 0.05 floor); growth scales with the period's average hunger
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

  /** Adds dirt spots, with the same tiered delays, to every owned tank for time spent away. */
  private applyOfflineDirt(elapsed: number): void {
    for (const tid of this.save.tanksOwned) {
      const spots = this.save.dirtSpots[tid] ?? (this.save.dirtSpots[tid] = []);
      let remaining = elapsed;
      while (spots.length < MAX_DIRT_SPOTS) {
        const delay = this.nextDirtDelay(spots.length);
        if (delay > remaining) break;
        remaining -= delay;
        spots.push(this.dirtSpot(spots.length));
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
      const gift = Game.dailyGiftFor(this.save.streak);
      this.save.coins += gift.coins;
      this.save.pearls += gift.pearls;
      this.offline.dailyGift = true;
      this.offline.giftCoins = gift.coins;
      this.offline.giftPearls = gift.pearls;
    }
  }

  /** The daily gift for a given streak length. Kept in one place so the streak sheet
   *  can show what the next days pay without restating the formula. */
  static dailyGiftFor(streak: number): { coins: number; pearls: number } {
    return {
      coins: 200 + 50 * Math.min(7, streak),
      pearls: streak % 7 === 0 ? 3 : 1,
    };
  }

  /** The seven days of the current streak cycle, so the reward ladder is visible
   *  rather than something the player has to infer from a number that keeps rising. */
  streakCycle(): { day: number; coins: number; pearls: number; state: 'done' | 'today' | 'ahead' }[] {
    const streak = Math.max(1, this.save.streak);
    const pos = ((streak - 1) % 7) + 1;
    const cycleStart = streak - pos + 1;
    return Array.from({ length: 7 }, (_, i) => {
      const day = i + 1;
      const gift = Game.dailyGiftFor(cycleStart + i);
      return {
        day,
        coins: gift.coins,
        pearls: gift.pearls,
        state: day < pos ? 'done' : day === pos ? 'today' : 'ahead',
      };
    });
  }

  // ---------- quests ----------

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

  /** Quests finished but not yet claimed — the dock shows this so a waiting reward
   *  never sits behind a closed panel. */
  claimableQuests(): number {
    let n = 0;
    for (const q of this.dailyQuests()) {
      if (this.save.quests.claimed.includes(q.id)) continue;
      if ((this.save.quests.progress[q.id] ?? 0) >= q.target) n++;
    }
    const wq = this.weeklyQuest();
    if (!this.save.weeklyQuest.claimed.includes(wq.id) && (this.save.weeklyQuest.progress[wq.id] ?? 0) >= wq.target) n++;
    const ev = this.visibleEvent();
    if (ev) n += this.eventClaimable(ev);
    return n;
  }

  /** The one goal worth surfacing on the scene: the nearest daily quest still in play,
   *  preferring one already claimable so the reward is never left sitting unnoticed. */
  nextGoal(): { name: string; progress: number; target: number; coins: number; pearls: number } | null {
    const open = this.dailyQuests().filter((q) => !this.save.quests.claimed.includes(q.id));
    if (!open.length) return null;
    const withProgress = open.map((q) => ({
      q,
      p: Math.min(q.target, this.save.quests.progress[q.id] ?? 0),
    }));
    const done = withProgress.filter((x) => x.p >= x.q.target);
    // Closest to finishing, so the strip tracks something the player is actually near.
    const pick = (done.length ? done : withProgress).sort(
      (a, b) => b.p / b.q.target - a.p / a.q.target,
    )[0];
    return {
      name: pick.q.name,
      progress: pick.p,
      target: pick.q.target,
      coins: pick.q.rewardCoins,
      pearls: pick.q.rewardPearls,
    };
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
        this.ui.toast(t('✅ Quest complete: {name} — claim your reward from Quests!', { name: t(q.name) }));
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
          this.ui.toast(t('🏅 Weekly quest complete: {name} — claim your reward from Quests!', { name: t(wq.name) }));
        }
      }
    }

    this.eventProgress(ev, n);
  }

  // ---------- timed event ----------

  /** Today's day key, in the same UTC form ensureQuestDay() uses. */
  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  // ---------- rewarded ad daily cap ----------

  /**
   * Rewarded ads still available today. The count is kept in the SAVE rather
   * than beside the interstitial timer in localStorage: the interstitial's
   * cooldown is a pacing detail that may harmlessly reset, while this one
   * guards the pearl economy, and a counter that a relaunch clears is not a
   * cap at all.
   */
  adRewardsLeftToday(): number {
    const today = this.todayKey();
    if (this.save.adRewardDay !== today) return REWARDED_ADS_PER_DAY;
    return Math.max(0, REWARDED_ADS_PER_DAY - this.save.adRewardCount);
  }

  /**
   * Records one watched ad against today's cap. Called only after the ad
   * actually paid out — an ad the player exited early costs them nothing.
   */
  noteAdRewardWatched(): void {
    const today = this.todayKey();
    if (this.save.adRewardDay !== today) {
      this.save.adRewardDay = today;
      this.save.adRewardCount = 0;
    }
    this.save.adRewardCount++;
  }

  /** The event scoring right now, or null when none is running. */
  activeEvent(): EventDef | null {
    return activeEvent(this.todayKey());
  }

  /**
   * The event whose panel is worth showing: the running one, or one that ended
   * within the grace window and still has an unclaimed tier. A finished event
   * with nothing left to collect disappears rather than lingering as a row
   * that does nothing.
   */
  visibleEvent(): EventDef | null {
    const def = claimableEvent(this.todayKey());
    if (!def) return null;
    if (this.activeEvent()) return def;
    if (this.save.event.id !== def.id) return null;
    return this.eventClaimable(def) > 0 ? def : null;
  }

  /**
   * Points and claims start over when a DIFFERENT event becomes active. Note
   * what this deliberately does not do: it never resets just because no event
   * is running, or the grace window would have nothing left to pay out.
   */
  private ensureEventState(def: EventDef): void {
    if (this.save.event.id !== def.id) {
      this.save.event = { id: def.id, points: 0, claimed: [] };
    }
  }

  eventPoints(): number {
    return this.save.event.points;
  }

  /** Tiers reached but not yet claimed — what the dock badge counts. */
  eventClaimable(def: EventDef): number {
    if (this.save.event.id !== def.id) return 0;
    const reached = tierReached(def, this.save.event.points);
    let n = 0;
    for (let i = 0; i <= reached; i++) if (!this.save.event.claimed.includes(i)) n++;
    return n;
  }

  /** The next tier still ahead of the player, or null once all are reached. */
  nextEventTier(def: EventDef): EventTier | null {
    const pts = this.save.event.id === def.id ? this.save.event.points : 0;
    return def.tiers.find((tr) => pts < tr.points) ?? null;
  }

  claimEventTier(index: number): { ok: boolean; msg: string } {
    const def = claimableEvent(this.todayKey());
    if (!def) return { ok: false, msg: t('This festival has ended.') };
    if (this.save.event.id !== def.id) return { ok: false, msg: t('This festival has ended.') };
    const tier = def.tiers[index];
    if (!tier) return { ok: false, msg: t('Unknown reward') };
    if (this.save.event.points < tier.points) return { ok: false, msg: t('Not enough festival points yet.') };
    if (this.save.event.claimed.includes(index)) return { ok: false, msg: t('Reward already claimed.') };
    this.save.event.claimed.push(index);
    // Event rewards are FLAT, unlike quests, which scale with level. The tiers
    // are sized against the whole event rather than against one task, so
    // multiplying them again would make a late-game festival dwarf everything.
    this.save.coins += tier.coins;
    this.save.pearls += tier.pearls;
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return {
      ok: true,
      msg: t('+{coins} coins', { coins: tier.coins }) + (tier.pearls ? t(', +{n} pearls', { n: tier.pearls }) : ''),
    };
  }

  /**
   * Scores one gameplay event toward the running festival. Called from
   * questEvent(), so every existing call site feeds the festival for free and
   * no action can be scored by the quests but missed by the event.
   */
  private eventProgress(ev: QuestEvent, n: number): void {
    const def = this.activeEvent();
    if (!def) return;
    const per = def.points[ev];
    if (!per) return;
    this.ensureEventState(def);
    const before = tierReached(def, this.save.event.points);
    this.save.event.points += per * n;
    const after = tierReached(def, this.save.event.points);
    if (after > before) {
      audio.quest();
      this.ui.toast(t('{emoji} Festival tier reached — claim it from Quests!', { emoji: def.emoji }));
    }
  }

  claimQuest(q: QuestDef): { ok: boolean; msg: string } {
    this.ensureQuestDay();
    const cur = this.save.quests.progress[q.id] ?? 0;
    if (cur < q.target) return { ok: false, msg: t('Quest not completed yet.') };
    if (this.save.quests.claimed.includes(q.id)) return { ok: false, msg: t('Reward already claimed.') };
    this.save.quests.claimed.push(q.id);
    const coins = Math.round(q.rewardCoins * (1 + this.save.level * 0.1));
    this.save.coins += coins;
    this.save.pearls += q.rewardPearls;
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('+{coins} coins', { coins }) + (q.rewardPearls ? t(', +{n} pearls', { n: q.rewardPearls }) : '') };
  }

  claimWeeklyQuest(): { ok: boolean; msg: string } {
    this.ensureQuestWeek();
    const q = this.weeklyQuest();
    const cur = this.save.weeklyQuest.progress[q.id] ?? 0;
    if (cur < q.target) return { ok: false, msg: t('Weekly quest not completed yet.') };
    if (this.save.weeklyQuest.claimed.includes(q.id)) return { ok: false, msg: t('Reward already claimed.') };
    this.save.weeklyQuest.claimed.push(q.id);
    const coins = Math.round(q.rewardCoins * (1 + this.save.level * 0.1));
    this.save.coins += coins;
    this.save.pearls += q.rewardPearls;
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('Weekly reward: +{coins} coins', { coins }) + (q.rewardPearls ? t(', +{n} pearls', { n: q.rewardPearls }) : '') };
  }

  claimAchievement(id: string): { ok: boolean; msg: string } {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) return { ok: false, msg: t('Unknown achievement') };
    if (this.save.achievementsClaimed.includes(id)) return { ok: false, msg: t('Reward already claimed.') };
    if (a.check(this.save) < a.target) return { ok: false, msg: t('Achievement not completed yet.') };
    this.save.achievementsClaimed.push(id);
    this.save.coins += a.rewardCoins;
    this.save.pearls += a.rewardPearls;
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name}: +{coins} coins, +{pearls} pearls', { name: t(a.name), coins: a.rewardCoins, pearls: a.rewardPearls }) };
  }

  // ---------- player actions ----------

  private spawnFish(fs: FishSave): Fish {
    const f = new Fish(fs, speciesById(fs.sp), this.swimBounds);
    f.root.on('pointertap', () => {
      if (this.inputMode !== 'normal') return; // fish card doesn't open in feed/edit mode
      this.ui.showFishInfo(f);
    });
    this.fishLayer.addChild(f.root);
    this.fishes.push(f);
    return f;
  }

  // ---------- input modes ----------

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
    // The dropped piece comes to the front (end of array = top layer)
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    const [p] = placed.splice(this.dragIndex, 1);
    if (p) placed.push(p);
    this.dragIndex = -1;
    audio.place();
    this.syncSave();
  }

  /** Returns the index of the topmost decor at the given point (-1 if none). */
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

  // ---------- dirt / cleaning ----------

  /** Adds a new dirt spot to the active tank, if there's room. */
  /** Randomly picks the time (ms) remaining until the next spot, based on the tank's current spot count. */
  private nextDirtDelay(spotCount: number): number {
    const [min, max] = spotCount <= 0 ? DIRT_DELAY_1 : spotCount === 1 ? DIRT_DELAY_2 : DIRT_DELAY_3;
    return min + Math.random() * (max - min);
  }

  private maybeSpawnDirt(tankId: string): void {
    const spots = this.save.dirtSpots[tankId] ?? (this.save.dirtSpots[tankId] = []);
    if (spots.length >= MAX_DIRT_SPOTS) return;
    spots.push(this.dirtSpot());
    this.syncSave();
    this.ui.refreshHUD();
  }

  /** Returns the index of the topmost dirt spot at the given point (-1 if none). */
  private dirtAt(x: number, y: number): number {
    const { w, h } = this.bounds;
    const spots = this.save.dirtSpots[this.save.activeTank] ?? [];
    for (let i = spots.length - 1; i >= 0; i--) {
      const s = spots[i];
      const cx = s.fx * w, cy = s.fy * h;
      const hit = 20 * s.r + 24; // tap tolerance
      if (Math.hypot(x - cx, y - cy) <= hit) return i;
    }
    return -1;
  }

  /** The first few cleanups each day are rewarded (like FishVille's daily first-5-spots rule). */
  private static readonly CLEAN_REWARD_DAILY_CAP = 5;
  private static readonly CLEAN_REWARD_COINS = 5;
  private static readonly CLEAN_REWARD_XP = 1;

  // ---------- Cleaning ad (once per session) ----------
  //
  // The cleaning ad only appears when a TANK IS FULLY CLEANED: that's the natural
  // break point where the player finishes the task they started. The previous version
  // triggered at a random spot count, which meant showing an ad WHILE THE PLAYER WAS
  // STILL MID-CLEANUP — something Google Play's "Better Ads Experiences" policy
  // directly prohibits.
  //
  // The field is deliberately not persisted to the save: keeping it in memory
  // structurally guarantees the "only once per fresh launch" rule — returning from
  // the background doesn't count as a new session. Without this boundary, since dirt
  // keeps regenerating, it would trigger repeatedly within a single session.

  /** Whether the "fully cleaned" ad can still be shown this session. */
  private cleanAdArmed = false;

  /** Once at startup: if there's dirt on screen, arm the right for this session. */
  private armCleanAd(): void {
    const spots = this.save.dirtSpots[this.save.activeTank]?.length ?? 0;
    // If there's no dirt at startup, there's nothing to clean either; skip this session.
    this.cleanAdArmed = spots > 0;
  }

  /** Called AFTER every successful cleanup; tries if no dirt remains in the tank. */
  private countCleanForAd(): void {
    if (!this.cleanAdArmed) return;
    if ((this.save.dirtSpots[this.save.activeTank]?.length ?? 0) > 0) return;
    this.cleanAdArmed = false; // once per session
    this.services.ads.maybeShowInterstitial();
  }

  /** A single notification for spots cleaned back-to-back: instead of a toast per spot,
   *  they're batched over a short window and shown together (prevents toast stacking). */
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
        ? t('🧹 Dirt cleaned! +{n} coins', { n: coins })
        : t('🧹 {spots} dirt spots cleaned! +{n} coins', { spots: n, n: coins }));
    }, Game.CLEAN_TOAST_WINDOW_MS);
  }

  /** Cleans the dirt spot at the tapped point (if any); plays a particle effect and sound. */
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
    // The ad attempt is at the VERY END of this function: particles, sound, coins, and
    // HUD update apply first so the ad doesn't step on top of the player's reward.
    this.countCleanForAd();
  }

  /** Draws the dirt spots in the active tank. */
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
   * As dirt increases, draws a vignette that makes the glass itself look dirty: a single
   * algae/limescale-colored gradient spreading softly from the four corners toward the
   * center. Doesn't blur the scene, just adds a "dirty" filter on top of the glass.
   */
  private drawGrime(w: number, h: number, dl: number): void {
    // No need to redraw as long as dirtLevel and dimensions haven't changed (regenerating
    // vector geometry every frame is needlessly costly; dirt level changes rarely).
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

    // A soft "dirty glass" vignette from the corners toward the center — not lines/drops,
    // a single gradient fill spreading from four corners (the same gradient object is reused for all four).
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

    // Instead of re-rasterizing semi-transparent shapes every frame, we "bake" them into
    // a single texture and show it as a sprite: the GPU only draws one quad per frame.
    const oldTex = this.grimeTex;
    this.grimeTex = this.app.renderer.generateTexture({ target: g, frame: new Rectangle(0, 0, w, h) });
    this.grimeSprite.texture = this.grimeTex;
    this.grimeSprite.position.set(0, 0);
    if (oldTex) oldTex.destroy(true);
  }

  /** Drops a single feed pellet (sinks from the tapped point). Paid feed is drawn from stock first, coins if stock is out. */
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
          this.ui.toast(t('Not enough coins ({name}: {cost} 🪙 each)', { name: t(f.name), cost: f.cost }));
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

  /** Buys a feed pack: stock is added to the bag. */
  buyFeedPack(packId: string): { ok: boolean; msg: string } {
    const p = feedPackById(packId);
    if (!p) return { ok: false, msg: t('Unknown pack') };
    if (this.save.coins < p.price) return { ok: false, msg: t('Not enough coins') };
    this.save.coins -= p.price;
    this.save.feedOwned[p.feed] = (this.save.feedOwned[p.feed] ?? 0) + p.qty;
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{qty} × {name} added to your bag! 🎒', { qty: p.qty, name: t(feedById(p.feed).name) }) };
  }

  /**
   * Fish already swimming PLUS eggs incubating: an incubating egg has been
   * paid for and has to land somewhere, so it holds its slot. Without this a
   * player could buy an egg and then fill the tank while it hatches, and the
   * egg would have nowhere to go through no fault of their own.
   */
  private get reservedSlots(): number {
    return this.fishes.length + this.save.pendingEggs.length;
  }

  buyFish(spId: string): { ok: boolean; msg: string } {
    const sp = speciesById(spId);
    if (this.reservedSlots >= this.capacity) return { ok: false, msg: t('This tank is full ({cap} fish)', { cap: this.capacity }) };
    if (sp.pearlPrice) {
      if (this.save.pearls < sp.pearlPrice) return { ok: false, msg: t('Not enough pearls') };
      this.save.pearls -= sp.pearlPrice;
    } else {
      if (this.save.level < sp.unlockLevel) return { ok: false, msg: t('Level {n} required', { n: sp.unlockLevel }) };
      if (this.save.coins < sp.buyPrice) return { ok: false, msg: t('Not enough coins') };
      this.save.coins -= sp.buyPrice;
    }
    const f = this.spawnFish(this.newFishSave(sp));
    audio.coin();
    this.questEvent('buyFish', 1);
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} joined the tank! 🐟', { name: f.name }) };
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
    if (!f.isAdult) return { ok: false, msg: t('Still a baby — wait for it to grow') };
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
    return { ok: true, msg: t('{name} sold: +{n} coins', { name: f.name, n: gain }) };
  }

  /** Sells a dormant (other-tank) adult fish — no need to switch tanks. */
  sellDormant(fs: FishSave): { ok: boolean; msg: string } {
    if (fs.progress < 1) return { ok: false, msg: t('Still a baby — wait for it to grow') };
    const idx = this.dormant.indexOf(fs);
    if (idx < 0) return { ok: false, msg: t('Fish not found') };
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
    return { ok: true, msg: t('{name} sold: +{n} coins', { name: fs.name, n: gain }) };
  }

  /** Sale from an earnings/inventory row: routes to either the active fish or a dormant record. */
  sellEarning(fe: FishEarning): { ok: boolean; msg: string } {
    if (fe.live) return this.sellFish(fe.live);
    if (fe.saved) return this.sellDormant(fe.saved);
    return { ok: false, msg: t('Fish not found') };
  }

  /**
   * Buys an egg. A tier WITHOUT `hatchMs` behaves exactly as it always has —
   * pay, roll, fish in the tank, one tap. A tier WITH one only takes payment
   * here and queues the egg; nothing is rolled until it is collected.
   */
  hatchEgg(tier: EggTier): { ok: boolean; msg: string; species?: Species; pending?: PendingEgg } {
    if (this.reservedSlots >= this.capacity) return { ok: false, msg: t('This tank is full ({cap} fish)', { cap: this.capacity }) };
    if (tier.currency === 'coins') {
      if (this.save.coins < tier.cost) return { ok: false, msg: t('Not enough coins') };
      this.save.coins -= tier.cost;
    } else {
      if (this.save.pearls < tier.cost) return { ok: false, msg: t('Not enough pearls') };
      this.save.pearls -= tier.cost;
    }

    if (tier.hatchMs) {
      const egg: PendingEgg = { id: this.nextEggId(), tier: tier.id, readyAt: Date.now() + tier.hatchMs };
      this.save.pendingEggs.push(egg);
      this.syncSave();
      this.ui.refreshHUD();
      return { ok: true, msg: t('{name} is incubating.', { name: t(tier.name) }), pending: egg };
    }

    const sp = this.rollEggSpecies(tier);
    return this.deliverEgg(sp);
  }

  /** Ids only need to be unique within one save; the largest in use plus one is enough. */
  private nextEggId(): number {
    return this.save.pendingEggs.reduce((n, e) => Math.max(n, e.id), 0) + 1;
  }

  /** Rolls a tier's odds. The golden egg's pity counter advances here, at the
   *  moment the roll actually happens — i.e. at collect time for a timed egg. */
  private rollEggSpecies(tier: EggTier): Species {
    let rarity: Rarity = 'common';
    if (tier.id === 'altin' && this.save.pityCounter >= PITY_LIMIT - 1) {
      rarity = 'legendary'; // guaranteed
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
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** The shared tail of both hatch paths: fish into the tank, stats, quests, sound. */
  private deliverEgg(sp: Species): { ok: boolean; msg: string; species: Species } {
    this.spawnFish(this.newFishSave(sp));
    this.save.stats.eggsHatched++;
    this.questEvent('hatch', 1);
    audio.hatch(sp.rarity);
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: '', species: sp };
  }

  /** Eggs currently incubating, soonest first. */
  pendingEggs(): PendingEgg[] {
    return [...this.save.pendingEggs].sort((a, b) => a.readyAt - b.readyAt);
  }

  /** How many incubating eggs are ready to be collected right now. */
  readyEggs(): number {
    const now = Date.now();
    return this.save.pendingEggs.filter((e) => e.readyAt <= now).length;
  }

  /**
   * Pearls to finish an egg immediately — one per SPEEDUP_MS_PER_PEARL of
   * remaining wait, rounded up, minimum one so the button is never free.
   */
  eggSpeedUpCost(egg: PendingEgg): number {
    const left = egg.readyAt - Date.now();
    if (left <= 0) return 0;
    return Math.max(1, Math.ceil(left / SPEEDUP_MS_PER_PEARL));
  }

  speedUpEgg(id: number): { ok: boolean; msg: string } {
    const egg = this.save.pendingEggs.find((e) => e.id === id);
    if (!egg) return { ok: false, msg: t('That egg is gone.') };
    const cost = this.eggSpeedUpCost(egg);
    if (cost === 0) return { ok: true, msg: '' };
    if (this.save.pearls < cost) return { ok: false, msg: t('Not enough pearls') };
    this.save.pearls -= cost;
    egg.readyAt = Date.now();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: '' };
  }

  /**
   * Collects a ready egg into the active tank. The tank being full does NOT
   * consume the egg — it stays queued until there is room.
   *
   * Readiness is a wall-clock comparison, so moving the device clock forward
   * skips the wait. That is accepted, and it is why the speed-up is priced
   * off remaining time rather than being the egg's real cost: the egg is paid
   * for in full at purchase, and the only thing the clock can steal is the
   * impatience surcharge.
   */
  collectEgg(id: number): { ok: boolean; msg: string; species?: Species } {
    const idx = this.save.pendingEggs.findIndex((e) => e.id === id);
    if (idx < 0) return { ok: false, msg: t('That egg is gone.') };
    const egg = this.save.pendingEggs[idx];
    if (egg.readyAt > Date.now()) return { ok: false, msg: t('This egg is still incubating.') };
    if (this.fishes.length >= this.capacity) {
      return { ok: false, msg: t('This tank is full ({cap} fish)', { cap: this.capacity }) };
    }
    const tier = EGGS.find((e) => e.id === egg.tier);
    if (!tier) { this.save.pendingEggs.splice(idx, 1); return { ok: false, msg: t('That egg is gone.') }; }
    const sp = this.rollEggSpecies(tier);
    this.save.pendingEggs.splice(idx, 1);
    return this.deliverEgg(sp);
  }

  // ---------- decor ----------

  buyDecor(defId: string): { ok: boolean; msg: string } {
    const d = decorById(defId);
    if (d.currency === 'coins') {
      if (this.save.coins < d.price) return { ok: false, msg: t('Not enough coins') };
      this.save.coins -= d.price;
    } else {
      if (this.save.pearls < d.price) return { ok: false, msg: t('Not enough pearls') };
      this.save.pearls -= d.price;
    }
    this.save.decorOwned[defId] = (this.save.decorOwned[defId] ?? 0) + 1;
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} added to your inventory! 🎒 Place it from your Inventory.', { name: t(d.name) }) };
  }

  placeDecor(defId: string): { ok: boolean; msg: string } {
    const owned = this.save.decorOwned[defId] ?? 0;
    if (owned <= 0) return { ok: false, msg: t("You don't have this decoration in your inventory") };
    const placed = this.save.decorPlaced[this.save.activeTank] ?? (this.save.decorPlaced[this.save.activeTank] = []);
    if (placed.length >= MAX_PLACED) return { ok: false, msg: t('This tank can hold at most {n} decorations', { n: MAX_PLACED }) };
    // Pick a horizontal position away from the others
    let fx = 0.1 + Math.random() * 0.8;
    for (let tries = 0; tries < 12; tries++) {
      const cand = 0.08 + Math.random() * 0.84;
      if (placed.every((p) => Math.abs(p.fx - cand) > 0.07)) { fx = cand; break; }
    }
    placed.push({ def: defId, fx });
    this.save.decorOwned[defId] = owned - 1;
    // Tracks the highest number of concurrently placed decor — a simple counter could be
    // inflated infinitely for free via a place/remove loop (removal returns decor to the
    // inventory for free). The cap stays bounded by decor actually owned.
    const totalPlacedNow = this.save.tanksOwned.reduce((sum, t) => sum + (this.save.decorPlaced[t]?.length ?? 0), 0);
    this.save.stats.decorPlacedCount = Math.max(this.save.stats.decorPlacedCount, totalPlacedNow);
    this.questEvent('placeDecor', 1);
    audio.place();
    this.syncSave();
    this.ui.refreshHUD();
    const d = decorById(defId);
    return { ok: true, msg: t('{name} placed (+{n}% growth & income)', { name: t(d.name), n: DECOR_BOOST[d.rarity] }) };
  }

  removeDecor(index: number): { ok: boolean; msg: string } {
    const placed = this.save.decorPlaced[this.save.activeTank] ?? [];
    const p = placed[index];
    if (!p) return { ok: false, msg: t('Decoration not found') };
    placed.splice(index, 1);
    this.save.decorOwned[p.def] = (this.save.decorOwned[p.def] ?? 0) + 1;
    audio.click();
    this.syncSave();
    return { ok: true, msg: t('{name} returned to your bag', { name: t(decorById(p.def).name) }) };
  }

  // ---------- tanks ----------

  buyTank(tankId: string): { ok: boolean; msg: string } {
    const tank = tankById(tankId);
    if (this.save.tanksOwned.includes(tankId)) return { ok: false, msg: t('You already own this tank') };
    if (this.save.level < tank.unlockLevel) return { ok: false, msg: t('Level {n} required', { n: tank.unlockLevel }) };
    if (tank.currency === 'coins') {
      if (this.save.coins < tank.price) return { ok: false, msg: t('Not enough coins') };
      this.save.coins -= tank.price;
    } else {
      if (this.save.pearls < tank.price) return { ok: false, msg: t('Not enough pearls') };
      this.save.pearls -= tank.price;
    }
    this.save.tanksOwned.push(tankId);
    this.save.decorPlaced[tankId] = this.save.decorPlaced[tankId] ?? [];
    audio.levelup();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} is now yours! 🏝️ Switch to it from your Inventory.', { name: t(tank.name) }) };
  }

  switchTank(tankId: string): { ok: boolean; msg: string } {
    if (!this.save.tanksOwned.includes(tankId)) return { ok: false, msg: t('You need to buy this tank first') };
    if (tankId === this.save.activeTank) return { ok: false, msg: t("You're already in this tank") };
    // Put active fish to sleep, wake up the new ones
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

  /** Earnings breakdown: per-fish hourly production for each tank (juveniles marked as potential). */
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

  /** Moves a fish from the active tank to another owned tank. */
  moveFish(f: Fish, tankId: string): { ok: boolean; msg: string } {
    if (!this.save.tanksOwned.includes(tankId)) return { ok: false, msg: t('You need to buy this tank first') };
    if (tankId === this.save.activeTank) return { ok: false, msg: t('Fish is already in this tank') };
    const cap = this.capacityFor(tankId);
    if (this.tankFishCount(tankId) >= cap) return { ok: false, msg: t('{name} is full ({cap} fish)', { name: t(tankById(tankId).name), cap }) };
    const idx = this.fishes.indexOf(f);
    if (idx < 0) return { ok: false, msg: t('Fish not found') };
    this.fishes.splice(idx, 1);
    const fs = f.toSave();
    fs.tank = tankId;
    this.dormant.push(fs);
    f.root.destroy({ children: true });
    audio.place();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} moved to {tank} 🌊', { name: f.name, tank: t(tankById(tankId).name) }) };
  }

  // ---------- shared ----------

  private addXp(n: number): void {
    this.save.xp += n;
    while (this.save.xp >= this.xpNeed(this.save.level)) {
      this.save.xp -= this.xpNeed(this.save.level);
      this.save.level++;
      this.save.pearls += 3;
      audio.levelup();
      this.ui.toast(t('⭐ Level {n}! +3 pearls, capacity {cap} fish', { n: this.save.level, cap: this.capacity }));
    }
  }

  /** The first 10 friend visits each day give a higher reward, later ones a lower one (like FishVille's neighbor visits). */
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
    if (!this.save.friends.some((f) => f.code === code)) return { ok: false, msg: t('Friend not found') };
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.friendVisits.day !== today) {
      this.save.friendVisits = { day: today, visited: [], count: 0 };
    }
    if (this.save.friendVisits.visited.includes(code)) {
      return { ok: false, msg: t("You've already visited this friend today.") };
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
    return { ok: true, msg: t('You visited the tank: +{coins} coins, +{xp} XP 🤝', { coins, xp }) };
  }

  /** You can pet any fish once a day: earns a small XP and sell bonus. */
  private static readonly PET_REWARD_XP = 5;
  private static readonly PET_REWARD_BONUS = 0.05;

  get canPetToday(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    return this.save.petDay !== today;
  }

  petFish(f: Fish): { ok: boolean; msg: string } {
    if (!this.canPetToday) return { ok: false, msg: t("You've already petted a fish today. Come back tomorrow! 💕") };
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
    return { ok: true, msg: t('{name} is happy! +{n} XP, sale value increased 💕', { name: f.name, n: Game.PET_REWARD_XP }) };
  }

  /** Pets a fish in another (dormant) tank — no particle effect since it's off-scene. */
  petDormant(fs: FishSave): { ok: boolean; msg: string } {
    if (!this.canPetToday) return { ok: false, msg: t("You've already petted a fish today. Come back tomorrow! 💕") };
    this.save.petDay = new Date().toISOString().slice(0, 10);
    fs.hunger = Math.min(1, fs.hunger + 0.15);
    fs.bonus = Math.min(FISH_BONUS_CAP, (fs.bonus ?? 0) + Game.PET_REWARD_BONUS);
    this.addXp(Game.PET_REWARD_XP);
    audio.plop();
    this.syncSave();
    this.ui.refreshHUD();
    return { ok: true, msg: t('{name} is happy! +{n} XP, sale value increased 💕', { name: fs.name, n: Game.PET_REWARD_XP }) };
  }

  /** You can send a friend a small feed gift once a day; in return you also earn some feed. */
  private static readonly GIFT_FEED_ID = 'lezzet';
  private static readonly GIFT_FEED_QTY = 3;
  private static readonly GIFT_REWARD_XP = 2;

  hasGiftedFriendToday(code: string): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.friendGifts.day !== today) return false;
    return this.save.friendGifts.gifted.includes(code);
  }

  giftFriend(code: string): { ok: boolean; msg: string } {
    if (!this.save.friends.some((f) => f.code === code)) return { ok: false, msg: t('Friend not found') };
    const today = new Date().toISOString().slice(0, 10);
    if (this.save.friendGifts.day !== today) {
      this.save.friendGifts = { day: today, gifted: [] };
    }
    if (this.save.friendGifts.gifted.includes(code)) {
      return { ok: false, msg: t("You've already sent this friend a gift today.") };
    }
    this.save.friendGifts.gifted.push(code);
    this.save.feedOwned[Game.GIFT_FEED_ID] = (this.save.feedOwned[Game.GIFT_FEED_ID] ?? 0) + Game.GIFT_FEED_QTY;
    this.addXp(Game.GIFT_REWARD_XP);
    audio.coin();
    this.syncSave();
    this.ui.refreshHUD();
    return {
      ok: true,
      msg: t('Gift sent! You received +{qty} {feed} in return 🎁', { qty: Game.GIFT_FEED_QTY, feed: t(feedById(Game.GIFT_FEED_ID).name) }),
    };
  }

  shopFish(): Species[] {
    return SPECIES.filter((s) => s.buyPrice > 0 || s.pearlPrice);
  }

  /** How many shop entries the player could buy right now. Drives the dock's Shop
   *  status, so "you can afford something" does not require opening the panel. */
  affordableShopItems(): number {
    const { coins, pearls, level } = this.save;
    let n = 0;
    for (const s of this.shopFish()) {
      if (s.unlockLevel !== undefined && level < s.unlockLevel) continue;
      if (s.buyPrice > 0 && coins >= s.buyPrice) n++;
      else if (s.pearlPrice && pearls >= s.pearlPrice) n++;
    }
    for (const e of EGGS) {
      if (e.currency === 'coins' ? coins >= e.cost : pearls >= e.cost) n++;
    }
    for (const t of TANKS) {
      if (this.save.tanksOwned.includes(t.id) || level < t.unlockLevel) continue;
      if (t.currency === 'coins' ? coins >= t.price : pearls >= t.price) n++;
    }
    return n;
  }
  eggList(): EggTier[] { return EGGS; }
  tankList(): TankDef[] { return TANKS; }

  /**
   * After switching accounts (see firebase-app.ts linkWithGoogle -> switched),
   * re-compares the cloud save from scratch for the new account.
   *
   * The rev counter is reset first because it's kept on-device and belonged to
   * the old account; otherwise the new account's cloud progress could be
   * mistaken for "stale" and silently overwritten.
   */
  /**
   * After a save is applied from the cloud, STOPS LOCAL WRITES until the page
   * reloads.
   *
   * The reason is syncSave()'s first line: the fish list is rebuilt from the
   * SCENE, not the save. In a mid-session restore, the scene still holds the
   * OLD save's fish; a single syncSave() call would overwrite the newly
   * downloaded fish with the old ones. This call is UNAVOIDABLE because
   * location.reload() triggers beforeunload — this happened exactly this way
   * on an emulator: coins and collection dropped, 5 fish became 2. Worse, since
   * the same function calls markDirty()+maybeUpload(), the overwritten list
   * would also get written to the cloud, deleting the other device's fish.
   */
  freezeForRestore(): void {
    this.frozen = true;
    // Write the downloaded save to disk IMMEDIATELY: applyCloud only changes the
    // in-memory object, and reload reads from disk — without this write the restore
    // would silently vanish (happened exactly this way on an emulator).
    persist(this.save);
  }

  /**
   * Handles a sync result that arrives AFTER the startup grace period
   * (CLOUD_STARTUP_GRACE_MS) has been EXCEEDED. The game is already playable by this point.
   *
   * There used to be no such path: once the grace period was exceeded, the
   * result was treated as 'disabled' and discarded, and since the startup sync
   * only runs once per session, the player would NEVER see their progress again.
   */
  private handleLateCloudSync(res: CloudSyncResult): void {
    this.cloudSync = res;
    if (res === 'restored') {
      // The scene was built from the old save. Reloading both rebuilds the correct
      // scene and applies init()'s sanitation/validation steps to the downloaded
      // save — data that arrives late shouldn't skip those steps.
      this.freezeForRestore();
      location.reload();
      return;
    }
    if (res === 'conflict') this.onLateConflict?.();
  }

  /**
   * Re-syncs after another device's write left this one behind. Runs at most
   * once at a time; the sync itself either settles silently (both devices hold
   * the same progress) or raises the conflict screen through the same late
   * hook the startup path uses.
   */
  private recoveringStale = false;

  private async recoverFromStaleRev(): Promise<void> {
    if (this.recoveringStale) return;
    this.recoveringStale = true;
    try {
      const res = await this.cloud.sync(this.save);
      this.cloudSync = res;
      if (res === 'restored') {
        // The scene still holds the old save's fish (see freezeForRestore).
        this.freezeForRestore();
        location.reload();
        return;
      }
      if (res === 'conflict') this.onLateConflict?.();
    } finally {
      this.recoveringStale = false;
    }
  }

  async resyncCloudForNewAccount(): Promise<CloudSyncResult> {
    this.cloud.resetForNewAccount();
    this.cloudSync = await this.cloud.sync(this.save);
    // A restore was applied: the scene is now stale, nothing should be written.
    if (this.cloudSync === 'restored') this.freezeForRestore();
    return this.cloudSync;
  }

  syncSave(): void {
    // After a restore, the scene is STALE (still holds the old save's fish), so
    // the fish list isn't rebuilt from it. persist() still runs though: this is
    // the ONE place that writes the downloaded save to disk, which the reload reads back.
    if (!this.frozen) {
      this.save.fishes = [...this.dormant, ...this.fishes.map((f) => f.toSave())];
    }
    persist(this.save);
    this.services.social.updateScore?.(this.save);
    // Don't write to the cloud while frozen: the data already came from the cloud,
    // needlessly advancing rev would make the other device look "behind" for no reason.
    if (this.frozen) return;
    // A player who just deleted their cloud data would otherwise see it
    // reappear within the minute, because the delete leaves the device looking
    // like a first launch. Uploads stay off for the rest of the session; a
    // relaunch is an explicit enough act to count as opting back in.
    if (this.cloudDeleted) return;
    // The local save is always written instantly; cloud writes are throttled to
    // conserve quota (see cloud-save.ts UPLOAD_THROTTLE_MS).
    this.cloud.markDirty();
    // Another device wrote while this one was live, so the rev is behind and
    // every further upload can only be rejected. Re-syncing is what resolves
    // it; uploading again first would just burn a write.
    if (this.cloud.isStale) { void this.recoverFromStaleRev(); return; }
    this.cloud.maybeUpload(this.save);
  }

  resetAll(): void {
    wipeSave();
    location.reload();
  }

  /**
   * Deletes everything this account has in the cloud: the save document and
   * the published `players/{code}` record. Play requires an account-deletion
   * path, and until now that path was an email to support and a human doing it
   * from the Firestore console.
   *
   * It deliberately does NOT touch the local game. Removing the backup and
   * wiping the player's aquarium are different intentions, and "Delete all
   * progress" already covers the second one.
   *
   * Both halves are attempted even if the first fails, so a partial outcome
   * cannot leave the public record standing while the save is gone — that is
   * the half a player would care most about.
   */
  async deleteCloudData(): Promise<{ ok: boolean; msg: string }> {
    const saveGone = await this.cloud.deleteRemote();
    const social = this.services.social;
    const playerGone = social.deletePlayer ? await social.deletePlayer() : true;
    if (saveGone && playerGone) {
      // The device now looks like a first launch to the cloud, so it would
      // happily upload again on the next sync. Marking it stops that until
      // the player opts back in by linking again.
      this.cloudDeleted = true;
      return { ok: true, msg: t('Your cloud data has been deleted.') };
    }
    return { ok: false, msg: t('Could not reach the cloud. Try again later.') };
  }

  /** Set once the player deletes their cloud data — suppresses further uploads
   *  for the rest of the session (see syncSave). */
  private cloudDeleted = false;
}
