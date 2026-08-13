import type { Lang } from './i18n';
import { detectLang } from './i18n';

export interface FishSave {
  sp: string;
  progress: number; // 0..1
  hunger: number;   // 0..1
  name: string;
  seed: number;
  tank: string;     // which aquarium it lives in
  bonus?: number;   // sale price bonus accumulated from quality feed (0..0.6)
}

export interface PlacedDecor {
  def: string;  // DecorDef id
  fx: number;   // 0..1 horizontal position
}

export interface DirtSpot {
  id: number;
  fx: number;   // 0..1 horizontal position
  fy: number;   // 0..1 vertical position
  r: number;    // size multiplier
  kind: 0 | 1;  // visual variant
}

export interface QuestState {
  day: string;                       // day the quests were generated
  progress: Record<string, number>;  // questId -> progress
  claimed: string[];                 // rewards claimed today
}

export interface SaveData {
  v: number;
  coins: number;
  pearls: number;
  xp: number;
  level: number;
  playerName: string;
  friendCode: string;
  fishes: FishSave[];
  collection: string[];                       // ids of species that have reached adulthood
  feedOwned: Record<string, number>;          // feedId -> stock (feed portions bought from packs)
  decorOwned: Record<string, number>;         // defId -> count (not placed)
  decorPlaced: Record<string, PlacedDecor[]>; // tankId -> placed items
  dirtSpots: Record<string, DirtSpot[]>;      // tankId -> uncleaned dirt spots
  tanksOwned: string[];
  activeTank: string;
  friends: { code: string; name: string }[];
  friendVisits: { day: string; visited: string[]; count: number }; // friend codes visited today
  friendGifts: { day: string; gifted: string[] };                  // friend codes gifted today
  quests: QuestState;
  weeklyQuest: QuestState; // here the "day" field holds this week's Monday date (week key)
  achievementsClaimed: string[];
  stats: {
    totalSold: number;
    totalEarned: number;
    totalFed: number;
    eggsHatched: number;
    decorPlacedCount: number;
    totalCleaned: number;
  };
  pityCounter: number;   // golden egg legendary pity counter
  streak: number;        // consecutive day streak (resets if a day is missed)
  bestStreak: number;    // highest streak reached so far — achievements use this, it never resets
  incomePot: number;     // accumulated, not-yet-collected passive income
  cleanRewardDay: string;   // the first few cleanups of the day are rewarded — this field tracks the day
  cleanRewardCount: number; // number of spots cleaned with a reward today
  petDay: string;           // you can pet one fish once a day — last petting day
  music: boolean;
  sfx: boolean;
  lastSeen: number;
  lastDaily: string;
  tutorialDone: boolean;
  feedHintSeen: boolean; // whether the feed mode hint ("touch the water to feed") has been shown once
  editHintSeen: boolean; // whether the decor edit hint has been shown once
  adsRemoved: boolean; // whether the "Remove ads" IAP has been purchased
  lang: Lang;
}

const KEY = 'reefy-save-v1';
const START_TANK = 'tank-mercan-koyu';

/** Starting values for a new save — hasProgress() compares against these. */
export const START_COINS = 300;
export const START_PEARLS = 5;
export const START_FISH_COUNT = 2;

/**
 * Save schema version. If the cloud save is NEWER than this, it is not
 * downloaded: this prevents an older client from treating fields it doesn't
 * yet recognize as "missing" via migrate(), stripping them, and then
 * restoring that corrupted state (see cloud-save.ts).
 */
export const SAVE_SCHEMA_VERSION = 2;

function makeFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  let c = 'REEF-';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export function defaultSave(): SaveData {
  return {
    v: SAVE_SCHEMA_VERSION,
    coins: START_COINS,
    pearls: START_PEARLS,
    xp: 0,
    level: 1,
    playerName: 'Misafir-' + Math.floor(1000 + Math.random() * 9000),
    friendCode: makeFriendCode(),
    fishes: [
      // The first fish starts 60% grown: the first sale (the first win) happens within the game's first ~1 minute
      { sp: 'lepistes', progress: 0.6, hunger: 0.9, name: 'Baloncuk', seed: 11, tank: START_TANK },
      { sp: 'neon-tetra', progress: 0.3, hunger: 0.85, name: 'Mercan', seed: 42, tank: START_TANK },
    ],
    collection: [],
    feedOwned: {},
    decorOwned: {},
    decorPlaced: { [START_TANK]: [] },
    dirtSpots: {},
    tanksOwned: [START_TANK],
    activeTank: START_TANK,
    friends: [],
    friendVisits: { day: '', visited: [], count: 0 },
    friendGifts: { day: '', gifted: [] },
    quests: { day: '', progress: {}, claimed: [] },
    weeklyQuest: { day: '', progress: {}, claimed: [] },
    achievementsClaimed: [],
    stats: { totalSold: 0, totalEarned: 0, totalFed: 0, eggsHatched: 0, decorPlacedCount: 0, totalCleaned: 0 },
    pityCounter: 0,
    streak: 0,
    bestStreak: 0,
    incomePot: 0,
    cleanRewardDay: '',
    cleanRewardCount: 0,
    petDay: '',
    music: true,
    sfx: true,
    lastSeen: Date.now(),
    lastDaily: '',
    tutorialDone: false,
    feedHintSeen: false,
    editHintSeen: false,
    adsRemoved: false,
    lang: detectLang(),
  };
}

/**
 * Does this save have the player's EFFORT in it — the single answer to "is it
 * safe to sacrifice the local side" in a cloud conflict (see cloud-save.ts
 * fast path).
 *
 * Why not a `dirty` flag or a deep comparison with the default: a save is
 * considered "changed" within seconds of entering the game even if the
 * player does nothing (lastSeen, accumulated income, dirt spots appearing on
 * their own, the day counter set up on first launch). Because of this, a
 * freshly set up device linking its account was shown a "which progress?"
 * screen with one side completely empty.
 *
 * DIRECTION MATTERS: mistakenly saying "no progress" silently deletes the
 * player's game; mistakenly saying "has progress" only falls back to today's
 * behavior — the conflict screen that asks the user. So any field left in
 * doubt COUNTS as progress.
 *
 * Deliberately left OUT (they change even without player action, or losing
 * them on restore doesn't matter):
 * - `lastSeen`, `incomePot`, `dirtSpots`, fish `progress`/`hunger` values
 *   — all of these advance on their own over time
 * - `tutorialDone` — the intro carousel is BLOCKING: everyone who enters the
 *   game has to dismiss it, and settings can only be reached that way. If it
 *   counted as progress, the fast path would never work in the exact
 *   situation it exists for (a new device linking its account) — this
 *   happened exactly this way on the emulator
 * - `collection` consisting only of the starting fish — see the note below
 * - `lastDaily` and `streak`/`bestStreak` when equal to 1 — these are set up
 *   on first launch WITHOUT giving the gift (see game.ts applyDailyGift);
 *   anything greater than 1 shows a real return, and that counts
 * - `quests.day` / `weeklyQuest.day` — the quest day is set up on its own at launch
 * - `music`/`sfx`/`lang` settings and the `feedHintSeen`/`editHintSeen` hints —
 *   not progress, just UI state
 * - `friendCode`, default `playerName` — randomly generated
 * - `adsRemoved` — never restored from the cloud anyway, the on-device value is kept
 */
export function hasProgress(s: SaveData): boolean {
  const st = s.stats;
  if (st.totalSold > 0 || st.totalEarned > 0 || st.totalFed > 0) return true;
  if (st.eggsHatched > 0 || st.decorPlacedCount > 0 || st.totalCleaned > 0) return true;

  if (s.level > 1 || s.xp > 0) return true;
  if (s.coins !== START_COINS || s.pearls !== START_PEARLS) return true;
  if (s.fishes.length !== START_FISH_COUNT) return true;

  // Collection: only species OUTSIDE THE STARTING FISH count. Both of them
  // start half-grown and reach adulthood, entering the collection, within a
  // few minutes even if the player does nothing (observed exactly this way
  // on the emulator) — the collection being non-empty alone doesn't show effort.
  const starting = new Set(defaultSave().fishes.map((f) => f.sp));
  if (s.collection.some((id) => !starting.has(id))) return true;

  if (s.achievementsClaimed.length > 0) return true;
  if (s.tanksOwned.length > 1) return true;
  if (Object.keys(s.feedOwned).length > 0) return true;
  if (Object.keys(s.decorOwned).length > 0) return true;
  if (Object.values(s.decorPlaced).some((list) => list.length > 0)) return true;

  if (s.friends.length > 0) return true;
  if (s.friendVisits.count > 0 || s.friendVisits.visited.length > 0) return true;
  if (s.friendGifts.gifted.length > 0) return true;

  for (const q of [s.quests, s.weeklyQuest]) {
    if (q.claimed.length > 0) return true;
    if (Object.values(q.progress).some((n) => n > 0)) return true;
  }

  if (s.pityCounter > 0) return true;
  if (s.streak > 1 || s.bestStreak > 1) return true;
  if (s.cleanRewardCount > 0) return true;
  if (s.petDay !== '') return true;
  if (!isDefaultPlayerName(s.playerName)) return true;

  return false;
}

/** The default name has the form `Misafir-1234`; any other name is the player's own choice. */
function isDefaultPlayerName(name: string): boolean {
  return /^Misafir-\d{4}$/.test(name);
}

/**
 * Parmak izine GİRMEYEN alanlar. İkiye ayrılırlar ve ikisi de aynı kapıya
 * çıkar — bu alanlar farklı diye oyuncuya "hangi ilerleme?" diye sorulamaz:
 * - kendiliğinden değişenler (`lastSeen`, biriken gelir, kir lekeleri)
 * - cihaza ait arayüz durumu ve ayarlar (dil, ses, görülmüş ipuçları)
 * `adsRemoved` zaten buluta hiç gitmez (bkz. cloud-save.ts ENTITLEMENT_KEYS),
 * bu yüzden karşılaştırmada da yok sayılır.
 */
const FINGERPRINT_IGNORED = [
  'lastSeen', 'incomePot', 'dirtSpots',
  'music', 'sfx', 'lang', 'tutorialDone', 'feedHintSeen', 'editHintSeen',
  'adsRemoved',
] as const satisfies readonly (keyof SaveData)[];

/** Kanonik biçimde "hiç yok" ile eşdeğer sayılan değerler — aşağıdaki nota bak. */
const BLANK_FORMS = new Set(['{}', '[]', '0', 'false', '""', 'null']);

/**
 * Değeri sırası ve "boşluğu" normalleştirilmiş bir metne çevirir:
 * - nesne anahtarları sıralanır (aynı içerik, farklı yazma sırası aynı metin)
 * - diziler de sıralanır: bu şemadaki hiçbir dizinin sırası oyuncu için anlam
 *   taşımaz, üstelik `fishes` her syncSave'de SAHNEDEN yeniden kurulduğu için
 *   sıra cihazdan cihaza zaten değişir
 * - sıfır/boş değerli alanlar hiç yokmuş gibi elenir: bir yemi bitirince
 *   `{yem: 0}` kalır, öteki cihazda o anahtar hiç yoktur — aynı kayıttır
 */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).sort().join(',') + ']';
  if (v && typeof v === 'object') {
    const parts = Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => [k, canonical(x)] as const)
      .filter(([, c]) => !BLANK_FORMS.has(c))
      .map(([k, c]) => k + ':' + c)
      .sort();
    return '{' + parts.join(',') + '}';
  }
  return JSON.stringify(v) ?? 'null';
}

/**
 * Kaydın oyuncu için ANLAMLI olan kısmının parmak izi: iki kaydın "aslında
 * aynı ilerleme" olup olmadığı buradan anlaşılır (bkz. cloud-save.ts). İki
 * cihaz sırayla senkron olunca çakışma ekranının iki sütunu birebir aynı
 * veriyi gösterebiliyordu; oyuncuya aynı şeyi seçtirmek hatadır.
 *
 * Ham JSON karşılaştırması İŞE YARAMAZ: kayıt oyuncu hiçbir şey yapmasa bile
 * saniyeler içinde değişir — hasProgress()'teki listenin aynısı.
 *
 * YÖN ÖNEMLİ ve burada hasProgress()'in TERSİdir: "aynı" demek soruyu tümden
 * atlatır, bu yüzden kuşkuda kalınan her alan FARK sayılmalıdır. Bu yüzden
 * aşağısı bir izin listesi değil: SaveData'ya yarın eklenecek bir alan
 * kendiliğinden karşılaştırmaya girer, dışarıda kalanlar tek tek sayılıdır.
 */
export function progressFingerprint(s: SaveData): string {
  const cmp: Record<string, unknown> = { ...s };
  for (const k of FINGERPRINT_IGNORED) delete cmp[k];
  // Balığın büyümesi ve açlığı zamanla kendiliğinden ilerler; balığı oyuncu
  // gözünde tanımlayan şey türü, adı, hangi akvaryumda olduğu ve yem bonusudur.
  cmp.fishes = s.fishes.map((f) => ({ sp: f.sp, name: f.name, seed: f.seed, tank: f.tank, bonus: f.bonus ?? 0 }));
  return canonical(cmp);
}

/** v1 -> v2 geçişi: eski kayıtlar balıklarını ve parasını korur. */
function migrate(parsed: Record<string, unknown>): SaveData {
  const base = defaultSave();
  const merged = { ...base, ...parsed } as SaveData;
  if ((parsed.v as number) < 2 || parsed.v === undefined) {
    merged.v = 2;
    merged.playerName = base.playerName;
    merged.friendCode = base.friendCode;
    merged.decorOwned = {};
    merged.decorPlaced = { [START_TANK]: [] };
    merged.tanksOwned = [START_TANK];
    merged.activeTank = START_TANK;
    merged.friends = [];
    merged.quests = { day: '', progress: {}, claimed: [] };
    merged.achievementsClaimed = [];
    merged.stats = { totalSold: 0, totalEarned: 0, totalFed: 0, eggsHatched: 0, decorPlacedCount: 0, totalCleaned: 0 };
    merged.pityCounter = 0;
    merged.streak = 0;
    merged.fishes = (merged.fishes || []).map((f) => ({ ...f, tank: f.tank ?? START_TANK }));
  }
  // Zorunlu alanları güvenceye al
  if (!merged.feedOwned) merged.feedOwned = {};
  if (!merged.tanksOwned?.length) merged.tanksOwned = [START_TANK];
  if (!merged.tanksOwned.includes(merged.activeTank)) merged.activeTank = merged.tanksOwned[0];
  if (!merged.decorPlaced) merged.decorPlaced = {};
  for (const t of merged.tanksOwned) if (!merged.decorPlaced[t]) merged.decorPlaced[t] = [];
  if (!merged.dirtSpots) merged.dirtSpots = {};
  // Field-by-field merge: `{ ...base, ...parsed }` above FULLY replaces
  // base.stats when parsed.stats is present; a hand-edited or partially
  // corrupted save missing a field like stats.totalFed would leave it
  // undefined++ -> NaN, which JSON.stringify silently turns into null on the
  // next persist().
  merged.stats = { ...base.stats, ...merged.stats };
  if (merged.cleanRewardDay === undefined) merged.cleanRewardDay = '';
  if (merged.cleanRewardCount === undefined) merged.cleanRewardCount = 0;
  if (!merged.friendVisits) merged.friendVisits = { day: '', visited: [], count: 0 };
  if (merged.petDay === undefined) merged.petDay = '';
  if (!merged.friendGifts) merged.friendGifts = { day: '', gifted: [] };
  if (!merged.weeklyQuest) merged.weeklyQuest = { day: '', progress: {}, claimed: [] };
  if (merged.lang !== 'tr' && merged.lang !== 'en') merged.lang = detectLang();
  // Kaydedilmiş serbest metin alanları (localStorage doğrudan düzenlenebilir; UI'daki
  // giriş temizliğine güvenmeyip burada da temizle — HTML injection'a karşı savunma).
  const stripHtml = (v: string) => v.replace(/[<>&"']/g, '').trim();
  merged.playerName = stripHtml(merged.playerName) || base.playerName;
  merged.fishes = merged.fishes.map((f) => ({ ...f, name: stripHtml(f.name) || 'Balık' }));
  if (merged.bestStreak === undefined) merged.bestStreak = merged.streak ?? 0;
  return merged;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    return migrate(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return defaultSave();
  }
}

/**
 * Cihaz dışından (bulut kaydından) gelen ham JSON'u yerel kayıtla AYNI
 * kapıdan geçirir: migrate() eksik alanları tamamlar, bilinmeyen kalıntıları
 * güvenli varsayılanlara oturtur ve serbest metin alanlarını temizler. Bozuk
 * veride null döner — çağıran o zaman yerel kaydı korur.
 */
export function parseSave(raw: string): SaveData | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    return migrate(parsed);
  } catch {
    return null;
  }
}

export function persist(s: SaveData): void {
  s.lastSeen = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* depolama dolu/engelli — sessizce geç */
  }
}

export function wipeSave(): void {
  localStorage.removeItem(KEY);
}
