import type { Lang } from './i18n';
import { detectLang } from './i18n';

export interface FishSave {
  sp: string;
  progress: number; // 0..1
  hunger: number;   // 0..1
  name: string;
  seed: number;
  tank: string;     // hangi akvaryumda yaşıyor
  bonus?: number;   // kaliteli yemlerle biriken satış fiyatı bonusu (0..0.6)
}

export interface PlacedDecor {
  def: string;  // DecorDef id
  fx: number;   // 0..1 yatay konum
}

export interface DirtSpot {
  id: number;
  fx: number;   // 0..1 yatay konum
  fy: number;   // 0..1 dikey konum
  r: number;    // boyut çarpanı
  kind: 0 | 1;  // görsel çeşit
}

export interface QuestState {
  day: string;                       // görevlerin üretildiği gün
  progress: Record<string, number>;  // questId -> ilerleme
  claimed: string[];                 // bugün ödülü alınanlar
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
  collection: string[];                       // yetişkinliğe ulaşmış tür id'leri
  feedOwned: Record<string, number>;          // feedId -> stok (paketten alınan yem taneleri)
  decorOwned: Record<string, number>;         // defId -> adet (yerleştirilmemiş)
  decorPlaced: Record<string, PlacedDecor[]>; // tankId -> yerleştirilenler
  dirtSpots: Record<string, DirtSpot[]>;      // tankId -> temizlenmemiş kir lekeleri
  tanksOwned: string[];
  activeTank: string;
  friends: { code: string; name: string }[];
  friendVisits: { day: string; visited: string[]; count: number }; // gün içinde ziyaret edilen arkadaş kodları
  friendGifts: { day: string; gifted: string[] };                  // gün içinde hediye gönderilen arkadaş kodları
  quests: QuestState;
  weeklyQuest: QuestState; // "day" alanı burada haftanın pazartesi tarihini (hafta anahtarı) tutar
  achievementsClaimed: string[];
  stats: {
    totalSold: number;
    totalEarned: number;
    totalFed: number;
    eggsHatched: number;
    decorPlacedCount: number;
    totalCleaned: number;
  };
  pityCounter: number;   // altın yumurta efsanevi garanti sayacı
  streak: number;        // ardışık gün serisi (gün kaçırılırsa sıfırlanır)
  bestStreak: number;    // şimdiye dek ulaşılan en yüksek seri — başarımlar bunu kullanır, sıfırlanmaz
  incomePot: number;     // biriken, henüz toplanmamış pasif gelir
  cleanRewardDay: string;   // günün ilk birkaç temizliği ödüllü — bu alan günü takip eder
  cleanRewardCount: number; // bugün ödüllü temizlenen leke sayısı
  petDay: string;           // günde bir kez bir balığı okşayabilirsin — son okşama günü
  music: boolean;
  sfx: boolean;
  lastSeen: number;
  lastDaily: string;
  tutorialDone: boolean;
  feedHintSeen: boolean; // yem modu ipucu ("suya dokunarak yemle") bir kez gösterildi mi
  editHintSeen: boolean; // dekor düzenleme ipucu bir kez gösterildi mi
  adsRemoved: boolean; // "Reklamları kaldır" IAP'i satın alındı mı
  lang: Lang;
}

const KEY = 'reefy-save-v1';
const START_TANK = 'tank-mercan-koyu';

/** Yeni kaydın başlangıç değerleri — hasProgress() bunlarla karşılaştırır. */
export const START_COINS = 300;
export const START_PEARLS = 5;
export const START_FISH_COUNT = 2;

/**
 * Kayıt şeması sürümü. Buluttaki kayıt bundan YENİ ise indirilmez: daha eski
 * bir istemcinin, henüz tanımadığı alanları migrate() ile "eksik" sayıp
 * silmesini ve sonra bu bozulmuş hali geri yüklemesini engeller (bkz.
 * cloud-save.ts).
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
      // İlk balık %60 büyümüş başlar: ilk satış (ilk zafer) oyunun ilk ~1 dakikasında yaşanır
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
 * Bu kayıtta oyuncunun EMEĞİ var mı — bulut çakışmasında "yerel tarafı feda
 * etmek güvenli mi" sorusunun tek yanıtı (bkz. cloud-save.ts hızlı yol).
 *
 * Neden `dirty` bayrağı ya da varsayılanla derin karşılaştırma değil: kayıt,
 * oyuncu hiçbir şey yapmasa bile oyuna girdikten saniyeler sonra "değişmiş"
 * sayılır (lastSeen, biriken gelir, kendiliğinden çıkan kir lekeleri, ilk
 * açılışta kurulan gün sayacı). Bu yüzden yeni kurulmuş bir cihaz, hesabını
 * bağladığında bir tarafı bomboş olan "hangi ilerleme?" ekranını görüyordu.
 *
 * YÖN ÖNEMLİ: yanlışlıkla "ilerleme yok" demek oyuncunun oyununu sessizce
 * siler; yanlışlıkla "ilerleme var" demek yalnızca bugünkü davranışa —
 * kullanıcıya soran çakışma ekranına — düşürür. Bu yüzden kuşkuda kalınan her
 * alan ilerleme SAYILIR.
 *
 * Bilerek DIŞARIDA bırakılanlar (oyuncunun eylemi olmadan da değişirler ya da
 * geri yüklenirken kaybı önemsizdir):
 * - `lastSeen`, `incomePot`, `dirtSpots`, balıkların `progress`/`hunger` değeri
 *   — hepsi zamanla kendiliğinden ilerler
 * - `tutorialDone` — giriş karuseli ENGELLEYİCİDİR: oyuna giren herkes onu
 *   kapatmak zorunda, ayarlara ancak öyle ulaşılıyor. İlerleme sayılsaydı hızlı
 *   yol tam da var olma sebebi olan durumda (yeni cihaz, hesabını bağlıyor)
 *   hiç çalışmazdı — emülatörde birebir böyle oldu
 * - Yalnızca açılış balıklarından oluşan `collection` — aşağıdaki nota bak
 * - `lastDaily` ve 1 değerindeki `streak`/`bestStreak` — ilk açılışta hediye
 *   VERİLMEDEN kurulur (bkz. game.ts applyDailyGift); 1'den büyüğü gerçek
 *   dönüşü gösterir, o sayılır
 * - `quests.day` / `weeklyQuest.day` — görev günü açılışta kendiliğinden kurulur
 * - `music`/`sfx`/`lang` ayarları ve `feedHintSeen`/`editHintSeen` ipuçları —
 *   ilerleme değil, arayüz durumu
 * - `friendCode`, varsayılan `playerName` — rastgele üretilirler
 * - `adsRemoved` — zaten buluttan hiç geri yüklenmez, cihazdaki değer korunur
 */
export function hasProgress(s: SaveData): boolean {
  const st = s.stats;
  if (st.totalSold > 0 || st.totalEarned > 0 || st.totalFed > 0) return true;
  if (st.eggsHatched > 0 || st.decorPlacedCount > 0 || st.totalCleaned > 0) return true;

  if (s.level > 1 || s.xp > 0) return true;
  if (s.coins !== START_COINS || s.pearls !== START_PEARLS) return true;
  if (s.fishes.length !== START_FISH_COUNT) return true;

  // Koleksiyon: yalnızca AÇILIŞ BALIKLARININ DIŞINDAKİ türler sayılır. İkisi de
  // yarı büyümüş başlar ve oyuncu hiçbir şey yapmasa bile birkaç dakika içinde
  // yetişkinliğe ulaşıp koleksiyona girer (emülatörde birebir gözlendi) —
  // koleksiyonun dolu olması tek başına emek göstermez.
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

/** Varsayılan ad `Misafir-1234` biçimindedir; başka her ad oyuncunun seçimidir. */
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
  if (merged.stats.totalCleaned === undefined) merged.stats.totalCleaned = 0;
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
