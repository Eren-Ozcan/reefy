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
  quests: QuestState;
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
  streak: number;        // ardışık gün serisi
  incomePot: number;     // biriken, henüz toplanmamış pasif gelir
  cleanRewardDay: string;   // günün ilk birkaç temizliği ödüllü — bu alan günü takip eder
  cleanRewardCount: number; // bugün ödüllü temizlenen leke sayısı
  petDay: string;           // günde bir kez bir balığı okşayabilirsin — son okşama günü
  music: boolean;
  sfx: boolean;
  lastSeen: number;
  lastDaily: string;
  tutorialDone: boolean;
}

const KEY = 'reefy-save-v1';
const START_TANK = 'tank-mercan-koyu';

function makeFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVYZ23456789';
  let c = 'REEF-';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

export function defaultSave(): SaveData {
  return {
    v: 2,
    coins: 300,
    pearls: 5,
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
    quests: { day: '', progress: {}, claimed: [] },
    achievementsClaimed: [],
    stats: { totalSold: 0, totalEarned: 0, totalFed: 0, eggsHatched: 0, decorPlacedCount: 0, totalCleaned: 0 },
    pityCounter: 0,
    streak: 0,
    incomePot: 0,
    cleanRewardDay: '',
    cleanRewardCount: 0,
    petDay: '',
    music: true,
    sfx: true,
    lastSeen: Date.now(),
    lastDaily: '',
    tutorialDone: false,
  };
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
