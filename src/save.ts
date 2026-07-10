export interface FishSave {
  sp: string;
  progress: number; // 0..1
  hunger: number;   // 0..1
  name: string;
  seed: number;
}

export interface SaveData {
  v: number;
  coins: number;
  pearls: number;
  xp: number;
  level: number;
  fishes: FishSave[];
  collection: string[]; // yetişkinliğe ulaşmış tür id'leri
  music: boolean;
  sfx: boolean;
  lastSeen: number;
  lastDaily: string;
  tutorialDone: boolean;
}

const KEY = 'reefy-save-v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    coins: 300,
    pearls: 5,
    xp: 0,
    level: 1,
    fishes: [
      { sp: 'lepistes', progress: 0.35, hunger: 0.9, name: 'Baloncuk', seed: 11 },
      { sp: 'neon-tetra', progress: 0.15, hunger: 0.85, name: 'Mercan', seed: 42 },
    ],
    collection: [],
    music: true,
    sfx: true,
    lastSeen: Date.now(),
    lastDaily: '',
    tutorialDone: false,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return { ...defaultSave(), ...parsed };
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
