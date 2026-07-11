import type { SaveData } from './save';

export interface QuestDef {
  id: string;
  name: string;
  emoji: string;
  target: number;
  event: QuestEvent;
  rewardCoins: number;   // seviye ile ölçeklenir
  rewardPearls: number;
}

export type QuestEvent = 'feed' | 'sell' | 'hatch' | 'buyFish' | 'placeDecor' | 'earn' | 'collect' | 'clean';

/** Günlük görev havuzu — her gün tarihe göre 3'ü seçilir. */
export const QUEST_POOL: QuestDef[] = [
  { id: 'q-feed20',   name: 'Balıklarına 20 yem yedir', emoji: '🍤', target: 20, event: 'feed',       rewardCoins: 150, rewardPearls: 0 },
  { id: 'q-feed50',   name: 'Balıklarına 50 yem yedir', emoji: '🍤', target: 50, event: 'feed',       rewardCoins: 320, rewardPearls: 0 },
  { id: 'q-sell3',    name: '3 balık sat',              emoji: '🪙', target: 3,  event: 'sell',       rewardCoins: 250, rewardPearls: 0 },
  { id: 'q-sell6',    name: '6 balık sat',              emoji: '🪙', target: 6,  event: 'sell',       rewardCoins: 450, rewardPearls: 1 },
  { id: 'q-hatch1',   name: '1 yumurta aç',             emoji: '🥚', target: 1,  event: 'hatch',      rewardCoins: 200, rewardPearls: 0 },
  { id: 'q-hatch2',   name: '2 yumurta aç',             emoji: '🥚', target: 2,  event: 'hatch',      rewardCoins: 380, rewardPearls: 1 },
  { id: 'q-buy2',     name: '2 yeni balık satın al',    emoji: '🐟', target: 2,  event: 'buyFish',    rewardCoins: 200, rewardPearls: 0 },
  { id: 'q-decor1',   name: '1 dekor yerleştir',        emoji: '🪸', target: 1,  event: 'placeDecor', rewardCoins: 180, rewardPearls: 0 },
  { id: 'q-earn2k',   name: '2.000 altın kazan',        emoji: '💰', target: 2000, event: 'earn',     rewardCoins: 300, rewardPearls: 0 },
  { id: 'q-collect1', name: 'Koleksiyona 1 tür ekle',   emoji: '📖', target: 1,  event: 'collect',    rewardCoins: 260, rewardPearls: 1 },
  { id: 'q-clean3',   name: '3 kir lekesi temizle',     emoji: '🧹', target: 3,  event: 'clean',      rewardCoins: 200, rewardPearls: 0 },
];

/** Tarihten deterministik günlük görev seçimi */
export function questsForDay(day: string): QuestDef[] {
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const picked: QuestDef[] = [];
  const pool = [...QUEST_POOL];
  for (let i = 0; i < 3 && pool.length; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    picked.push(pool.splice(h % pool.length, 1)[0]);
  }
  return picked;
}

/** Haftalık görev havuzu — günlüklerden çok daha büyük hedef ve ödül. */
export const WEEKLY_QUEST_POOL: QuestDef[] = [
  { id: 'w-feed200',  name: 'Bu hafta 200 yem yedir',        emoji: '🍤', target: 200,   event: 'feed',    rewardCoins: 1500, rewardPearls: 4 },
  { id: 'w-sell20',   name: 'Bu hafta 20 balık sat',          emoji: '🪙', target: 20,    event: 'sell',    rewardCoins: 2500, rewardPearls: 5 },
  { id: 'w-earn20k',  name: 'Bu hafta 20.000 altın kazan',    emoji: '💰', target: 20000, event: 'earn',    rewardCoins: 2000, rewardPearls: 4 },
  { id: 'w-hatch10',  name: 'Bu hafta 10 yumurta aç',         emoji: '🥚', target: 10,    event: 'hatch',   rewardCoins: 1800, rewardPearls: 4 },
  { id: 'w-clean15',  name: 'Bu hafta 15 kir lekesi temizle', emoji: '🧹', target: 15,    event: 'clean',   rewardCoins: 1200, rewardPearls: 3 },
  { id: 'w-collect5', name: 'Bu hafta koleksiyona 5 tür ekle', emoji: '📖', target: 5,    event: 'collect', rewardCoins: 2200, rewardPearls: 6 },
];

/** Verilen tarihin içinde bulunduğu haftanın pazartesi gününü YYYY-MM-DD biçiminde döndürür. */
export function weekKeyFor(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7; // Pazartesi=1 .. Pazar=7
  dt.setUTCDate(dt.getUTCDate() - day + 1);
  return dt.toISOString().slice(0, 10);
}

/** Hafta anahtarından deterministik haftalık görev seçimi */
export function weeklyQuestForWeek(week: string): QuestDef {
  let h = 0;
  for (const ch of week) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h = (h * 1103515245 + 12345) >>> 0;
  return WEEKLY_QUEST_POOL[h % WEEKLY_QUEST_POOL.length];
}

export interface AchievementDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  check: (s: SaveData) => number;  // ilerleme
  target: number;
  rewardCoins: number;
  rewardPearls: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a-sold1',    name: 'İlk Satış',        emoji: '🤝', desc: 'İlk balığını sat',                   check: (s) => s.stats.totalSold, target: 1,   rewardCoins: 100,  rewardPearls: 0 },
  { id: 'a-sold10',   name: 'Esnaf',            emoji: '🏪', desc: '10 balık sat',                       check: (s) => s.stats.totalSold, target: 10,  rewardCoins: 400,  rewardPearls: 1 },
  { id: 'a-sold50',   name: 'Balık Tüccarı',    emoji: '⚖️', desc: '50 balık sat',                       check: (s) => s.stats.totalSold, target: 50,  rewardCoins: 1500, rewardPearls: 3 },
  { id: 'a-sold200',  name: 'Resif Baronu',     emoji: '👑', desc: '200 balık sat',                      check: (s) => s.stats.totalSold, target: 200, rewardCoins: 6000, rewardPearls: 10 },
  { id: 'a-lvl5',     name: 'Çırak Bakıcı',     emoji: '⭐', desc: 'Seviye 5\'e ulaş',                   check: (s) => s.level, target: 5,   rewardCoins: 300,  rewardPearls: 1 },
  { id: 'a-lvl10',    name: 'Usta Bakıcı',      emoji: '🌟', desc: 'Seviye 10\'a ulaş',                  check: (s) => s.level, target: 10,  rewardCoins: 1000, rewardPearls: 3 },
  { id: 'a-lvl20',    name: 'Resif Efsanesi',   emoji: '💫', desc: 'Seviye 20\'ye ulaş',                 check: (s) => s.level, target: 20,  rewardCoins: 5000, rewardPearls: 8 },
  { id: 'a-col10',    name: 'Meraklı',          emoji: '🔍', desc: 'Koleksiyona 10 tür ekle',            check: (s) => s.collection.length, target: 10,  rewardCoins: 500,  rewardPearls: 1 },
  { id: 'a-col30',    name: 'Doğa Bilimci',     emoji: '🧭', desc: 'Koleksiyona 30 tür ekle',            check: (s) => s.collection.length, target: 30,  rewardCoins: 2000, rewardPearls: 4 },
  { id: 'a-col60',    name: 'Ansiklopedist',    emoji: '📚', desc: 'Koleksiyona 60 tür ekle',            check: (s) => s.collection.length, target: 60,  rewardCoins: 6000, rewardPearls: 8 },
  { id: 'a-col100',   name: 'Okyanusun Kalbi',  emoji: '💙', desc: 'Tüm 100 türü topla',                 check: (s) => s.collection.length, target: 100, rewardCoins: 20000, rewardPearls: 30 },
  { id: 'a-egg10',    name: 'Şanslı El',        emoji: '🥚', desc: '10 yumurta aç',                      check: (s) => s.stats.eggsHatched, target: 10,  rewardCoins: 800,  rewardPearls: 2 },
  { id: 'a-decor5',   name: 'Dekoratör',        emoji: '🪸', desc: '5 dekor yerleştir',                  check: (s) => s.stats.decorPlacedCount, target: 5,  rewardCoins: 400,  rewardPearls: 1 },
  { id: 'a-decor20',  name: 'İç Mimar',         emoji: '🏛️', desc: '20 dekor yerleştir',                 check: (s) => s.stats.decorPlacedCount, target: 20, rewardCoins: 1800, rewardPearls: 4 },
  { id: 'a-tank3',    name: 'Gezgin',           emoji: '🗺️', desc: '3 akvaryuma sahip ol',               check: (s) => s.tanksOwned.length, target: 3,  rewardCoins: 1000, rewardPearls: 2 },
  { id: 'a-tank10',   name: 'Okyanus İmparatoru', emoji: '🌊', desc: '10 akvaryuma sahip ol',            check: (s) => s.tanksOwned.length, target: 10, rewardCoins: 5000, rewardPearls: 10 },
  { id: 'a-streak7',  name: 'Sadık Dost',       emoji: '🔥', desc: '7 gün üst üste oyna',                check: (s) => s.streak, target: 7, rewardCoins: 1200, rewardPearls: 3 },
  { id: 'a-clean25',  name: 'Temizlikçi',       emoji: '🧽', desc: '25 kir lekesi temizle',              check: (s) => s.stats.totalCleaned, target: 25, rewardCoins: 900, rewardPearls: 2 },
];
