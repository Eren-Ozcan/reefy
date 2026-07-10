export interface FishSave {
  sp: string;
  progress: number; // 0..1
  hunger: number;   // 0..1
  name: string;
  seed: number;
  tank: string;     // hangi akvaryumda yaşıyor
}

export interface PlacedDecor {
  def: string;  // DecorDef id
  fx: number;   // 0..1 yatay konum
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
  decorOwned: Record<string, number>;         // defId -> adet (yerleştirilmemiş)
  decorPlaced: Record<string, PlacedDecor[]>; // tankId -> yerleştirilenler
  tanksOwned: string[];
  activeTank: string;
  friends: { code: string; name: string }[];
  quests: QuestState;
  achievementsClaimed: string[];
  stats: {
    totalSold: number;
    totalEarned: number;
    totalFed: number;
    eggsHatched: number;
    decorPlacedCount: number;
  };
  pityCounter: number;   // altın yumurta efsanevi garanti sayacı
  streak: number;        // ardışık gün serisi
  incomePot: number;     // biriken, henüz toplanmamış pasif gelir
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
      { sp: 'lepistes', progress: 0.35, hunger: 0.9, name: 'Baloncuk', seed: 11, tank: START_TANK },
      { sp: 'neon-tetra', progress: 0.15, hunger: 0.85, name: 'Mercan', seed: 42, tank: START_TANK },
    ],
    collection: [],
    decorOwned: {},
    decorPlaced: { [START_TANK]: [] },
    tanksOwned: [START_TANK],
    activeTank: START_TANK,
    friends: [],
    quests: { day: '', progress: {}, claimed: [] },
    achievementsClaimed: [],
    stats: { totalSold: 0, totalEarned: 0, totalFed: 0, eggsHatched: 0, decorPlacedCount: 0 },
    pityCounter: 0,
    streak: 0,
    incomePot: 0,
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
    merged.stats = { totalSold: 0, totalEarned: 0, totalFed: 0, eggsHatched: 0, decorPlacedCount: 0 };
    merged.pityCounter = 0;
    merged.streak = 0;
    merged.fishes = (merged.fishes || []).map((f) => ({ ...f, tank: f.tank ?? START_TANK }));
  }
  // Zorunlu alanları güvenceye al
  if (!merged.tanksOwned?.length) merged.tanksOwned = [START_TANK];
  if (!merged.tanksOwned.includes(merged.activeTank)) merged.activeTank = merged.tanksOwned[0];
  if (!merged.decorPlaced) merged.decorPlaced = {};
  for (const t of merged.tanksOwned) if (!merged.decorPlaced[t]) merged.decorPlaced[t] = [];
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
