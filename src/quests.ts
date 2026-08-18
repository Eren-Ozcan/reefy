import type { SaveData } from './save';

export interface QuestDef {
  id: string;
  name: string;
  emoji: string;
  target: number;
  event: QuestEvent;
  rewardCoins: number;   // scales with level
  rewardPearls: number;
}

export type QuestEvent = 'feed' | 'sell' | 'hatch' | 'buyFish' | 'placeDecor' | 'earn' | 'collect' | 'clean';

/** Daily quest pool — 3 are picked each day based on the date. */
export const QUEST_POOL: QuestDef[] = [
  { id: 'q-feed20',   name: 'Feed your fish 20 times', emoji: '🍤', target: 20, event: 'feed',       rewardCoins: 150, rewardPearls: 0 },
  { id: 'q-feed50',   name: 'Feed your fish 50 times', emoji: '🍤', target: 50, event: 'feed',       rewardCoins: 320, rewardPearls: 0 },
  { id: 'q-sell3',    name: 'Sell 3 fish',              emoji: '🪙', target: 3,  event: 'sell',       rewardCoins: 250, rewardPearls: 0 },
  { id: 'q-sell6',    name: 'Sell 6 fish',              emoji: '🪙', target: 6,  event: 'sell',       rewardCoins: 450, rewardPearls: 1 },
  { id: 'q-hatch1',   name: 'Hatch 1 egg',             emoji: '🥚', target: 1,  event: 'hatch',      rewardCoins: 200, rewardPearls: 0 },
  { id: 'q-hatch2',   name: 'Hatch 2 eggs',             emoji: '🥚', target: 2,  event: 'hatch',      rewardCoins: 380, rewardPearls: 1 },
  { id: 'q-buy2',     name: 'Buy 2 new fish',    emoji: '🐟', target: 2,  event: 'buyFish',    rewardCoins: 200, rewardPearls: 0 },
  { id: 'q-decor1',   name: 'Place 1 decoration',        emoji: '🪸', target: 1,  event: 'placeDecor', rewardCoins: 180, rewardPearls: 0 },
  { id: 'q-earn2k',   name: 'Earn 2,000 coins',        emoji: '💰', target: 2000, event: 'earn',     rewardCoins: 300, rewardPearls: 0 },
  { id: 'q-collect1', name: 'Add 1 species to your collection',   emoji: '📖', target: 1,  event: 'collect',    rewardCoins: 260, rewardPearls: 1 },
  { id: 'q-clean3',   name: 'Clean 3 dirt spots',     emoji: '🧹', target: 3,  event: 'clean',      rewardCoins: 200, rewardPearls: 0 },
  { id: 'q-feed80',   name: 'Feed your fish 80 times', emoji: '🍤', target: 80, event: 'feed',       rewardCoins: 520, rewardPearls: 1 },
  { id: 'q-sell10',   name: 'Sell 10 fish',             emoji: '🪙', target: 10, event: 'sell',       rewardCoins: 680, rewardPearls: 1 },
  { id: 'q-hatch3',   name: 'Hatch 3 eggs',             emoji: '🥚', target: 3,  event: 'hatch',      rewardCoins: 560, rewardPearls: 1 },
  { id: 'q-buy4',     name: 'Buy 4 new fish',    emoji: '🐟', target: 4,  event: 'buyFish',    rewardCoins: 380, rewardPearls: 1 },
  { id: 'q-decor2',   name: 'Place 2 decorations',        emoji: '🪸', target: 2,  event: 'placeDecor', rewardCoins: 340, rewardPearls: 0 },
  { id: 'q-earn5k',   name: 'Earn 5,000 coins',        emoji: '💰', target: 5000, event: 'earn',     rewardCoins: 620, rewardPearls: 1 },
  { id: 'q-collect2', name: 'Add 2 species to your collection',   emoji: '📖', target: 2,  event: 'collect',    rewardCoins: 480, rewardPearls: 2 },
  { id: 'q-clean6',   name: 'Clean 6 dirt spots',     emoji: '🧹', target: 6,  event: 'clean',      rewardCoins: 380, rewardPearls: 0 },
];

/** Deterministic daily quest selection from the date */
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

/** Weekly quest pool — much larger targets and rewards than dailies. */
export const WEEKLY_QUEST_POOL: QuestDef[] = [
  { id: 'w-feed200',  name: 'Feed 200 times this week',        emoji: '🍤', target: 200,   event: 'feed',    rewardCoins: 1500, rewardPearls: 4 },
  { id: 'w-sell20',   name: 'Sell 20 fish this week',          emoji: '🪙', target: 20,    event: 'sell',    rewardCoins: 2500, rewardPearls: 5 },
  { id: 'w-earn20k',  name: 'Earn 20,000 coins this week',    emoji: '💰', target: 20000, event: 'earn',    rewardCoins: 2000, rewardPearls: 4 },
  { id: 'w-hatch10',  name: 'Hatch 10 eggs this week',         emoji: '🥚', target: 10,    event: 'hatch',   rewardCoins: 1800, rewardPearls: 4 },
  { id: 'w-clean15',  name: 'Clean 15 dirt spots this week', emoji: '🧹', target: 15,    event: 'clean',   rewardCoins: 1200, rewardPearls: 3 },
  { id: 'w-collect5', name: 'Add 5 species to your collection this week', emoji: '📖', target: 5,    event: 'collect', rewardCoins: 2200, rewardPearls: 6 },
  { id: 'w-buy12',    name: 'Buy 12 new fish this week', emoji: '🐟', target: 12,   event: 'buyFish', rewardCoins: 1900, rewardPearls: 4 },
  { id: 'w-decor8',   name: 'Place 8 decorations this week',      emoji: '🪸', target: 8,    event: 'placeDecor', rewardCoins: 1600, rewardPearls: 3 },
];

/** Returns the Monday of the week containing the given date, in YYYY-MM-DD format. */
export function weekKeyFor(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7; // Monday=1 .. Sunday=7
  dt.setUTCDate(dt.getUTCDate() - day + 1);
  return dt.toISOString().slice(0, 10);
}

/** Deterministic weekly quest selection from the week key */
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
  check: (s: SaveData) => number;  // progress
  target: number;
  rewardCoins: number;
  rewardPearls: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'a-sold1',    name: 'First Sale',        emoji: '🤝', desc: 'Sell your first fish',                   check: (s) => s.stats.totalSold, target: 1,   rewardCoins: 100,  rewardPearls: 0 },
  { id: 'a-sold10',   name: 'Shopkeeper',            emoji: '🏪', desc: 'Sell 10 fish',                       check: (s) => s.stats.totalSold, target: 10,  rewardCoins: 400,  rewardPearls: 1 },
  { id: 'a-sold50',   name: 'Fish Trader',    emoji: '⚖️', desc: 'Sell 50 fish',                       check: (s) => s.stats.totalSold, target: 50,  rewardCoins: 1500, rewardPearls: 3 },
  { id: 'a-sold200',  name: 'Reef Baron',     emoji: '👑', desc: 'Sell 200 fish',                      check: (s) => s.stats.totalSold, target: 200, rewardCoins: 6000, rewardPearls: 10 },
  // Total-earnings milestones: spans balanced intervals from early game to late game.
  // The reward/target ratio shrinks as the target grows (~3% -> ~0.75%) so it doesn't
  // break the late-game economy; claimAchievement() doesn't add these rewards back into
  // totalEarned, so it isn't self-feeding.
  { id: 'a-earn1k',   name: 'First Earnings',         emoji: '🪙', desc: 'Earn 1,000 coins total',         check: (s) => s.stats.totalEarned, target: 1000,     rewardCoins: 30,     rewardPearls: 0 },
  { id: 'a-earn5k',   name: 'First Savings',        emoji: '💵', desc: 'Earn 5,000 coins total',         check: (s) => s.stats.totalEarned, target: 5000,     rewardCoins: 150,    rewardPearls: 0 },
  { id: 'a-earn20k',  name: 'Small Fortune',       emoji: '🏦', desc: 'Earn 20,000 coins total',        check: (s) => s.stats.totalEarned, target: 20000,    rewardCoins: 500,    rewardPearls: 1 },
  { id: 'a-earn75k',  name: 'Rich Waters',       emoji: '💰', desc: 'Earn 75,000 coins total',        check: (s) => s.stats.totalEarned, target: 75000,    rewardCoins: 1800,   rewardPearls: 2 },
  { id: 'a-earn250k', name: 'Coral Treasure',    emoji: '💎', desc: 'Earn 250,000 coins total',       check: (s) => s.stats.totalEarned, target: 250000,   rewardCoins: 5000,   rewardPearls: 4 },
  { id: 'a-earn750k', name: 'Reef Tycoon',      emoji: '🏆', desc: 'Earn 750,000 coins total',       check: (s) => s.stats.totalEarned, target: 750000,   rewardCoins: 12000,  rewardPearls: 6 },
  { id: 'a-earn2m',   name: 'Deep Pockets',       emoji: '🌌', desc: 'Earn 2,000,000 coins total',     check: (s) => s.stats.totalEarned, target: 2000000,  rewardCoins: 30000,  rewardPearls: 10 },
  { id: 'a-earn6m',   name: 'Ocean Treasure',   emoji: '🐋', desc: 'Earn 6,000,000 coins total',     check: (s) => s.stats.totalEarned, target: 6000000,  rewardCoins: 70000,  rewardPearls: 14 },
  { id: 'a-earn20m',  name: 'Legendary Fortune',    emoji: '🌠', desc: 'Earn 20,000,000 coins total',    check: (s) => s.stats.totalEarned, target: 20000000, rewardCoins: 180000, rewardPearls: 20 },
  { id: 'a-earn60m',  name: 'Treasure of Eternity', emoji: '🔱', desc: 'Earn 60,000,000 coins total',    check: (s) => s.stats.totalEarned, target: 60000000, rewardCoins: 450000, rewardPearls: 28 },
  { id: 'a-lvl5',     name: 'Apprentice Keeper',     emoji: '⭐', desc: 'Reach level 5',                   check: (s) => s.level, target: 5,   rewardCoins: 300,  rewardPearls: 1 },
  { id: 'a-lvl10',    name: 'Master Keeper',      emoji: '🌟', desc: 'Reach level 10',                  check: (s) => s.level, target: 10,  rewardCoins: 1000, rewardPearls: 3 },
  { id: 'a-lvl20',    name: 'Reef Legend',   emoji: '💫', desc: 'Reach level 20',                 check: (s) => s.level, target: 20,  rewardCoins: 5000, rewardPearls: 8 },
  { id: 'a-col10',    name: 'Curious',          emoji: '🔍', desc: 'Add 10 species to your collection',            check: (s) => s.collection.length, target: 10,  rewardCoins: 500,  rewardPearls: 1 },
  { id: 'a-col30',    name: 'Naturalist',     emoji: '🧭', desc: 'Add 30 species to your collection',            check: (s) => s.collection.length, target: 30,  rewardCoins: 2000, rewardPearls: 4 },
  { id: 'a-col60',    name: 'Encyclopedist',    emoji: '📚', desc: 'Add 60 species to your collection',            check: (s) => s.collection.length, target: 60,  rewardCoins: 6000, rewardPearls: 8 },
  { id: 'a-col100',   name: 'Heart of the Ocean',  emoji: '💙', desc: 'Collect all 100 species',                 check: (s) => s.collection.length, target: 100, rewardCoins: 20000, rewardPearls: 30 },
  { id: 'a-egg10',    name: 'Lucky Hand',        emoji: '🥚', desc: 'Hatch 10 eggs',                      check: (s) => s.stats.eggsHatched, target: 10,  rewardCoins: 800,  rewardPearls: 2 },
  { id: 'a-decor5',   name: 'Decorator',        emoji: '🪸', desc: 'Place 5 decorations',                  check: (s) => s.stats.decorPlacedCount, target: 5,  rewardCoins: 400,  rewardPearls: 1 },
  { id: 'a-decor20',  name: 'Interior Designer',         emoji: '🏛️', desc: 'Place 20 decorations',                 check: (s) => s.stats.decorPlacedCount, target: 20, rewardCoins: 1800, rewardPearls: 4 },
  { id: 'a-tank3',    name: 'Traveler',           emoji: '🗺️', desc: 'Own 3 tanks',               check: (s) => s.tanksOwned.length, target: 3,  rewardCoins: 1000, rewardPearls: 2 },
  { id: 'a-tank10',   name: 'Ocean Emperor', emoji: '🌊', desc: 'Own 10 tanks',            check: (s) => s.tanksOwned.length, target: 10, rewardCoins: 5000, rewardPearls: 10 },
  // bestStreak is used (not streak): streak resets when a day is missed, so if a player
  // reaches 7 days without claiming the reward and then misses a day, without bestStreak
  // the achievement would stay permanently locked.
  { id: 'a-streak7',  name: 'Loyal Friend',       emoji: '🔥', desc: 'Play 7 days in a row',                check: (s) => s.bestStreak, target: 7, rewardCoins: 1200, rewardPearls: 3 },
  { id: 'a-clean25',  name: 'Cleaner',       emoji: '🧽', desc: 'Clean 25 dirt spots',              check: (s) => s.stats.totalCleaned, target: 25, rewardCoins: 900, rewardPearls: 2 },
  { id: 'a-feed500',  name: 'Devoted Feeder',  emoji: '🍤', desc: 'Feed a total of 500 times',                 check: (s) => s.stats.totalFed, target: 500,  rewardCoins: 700,  rewardPearls: 2 },
  { id: 'a-feed2000', name: 'Feeding Master',       emoji: '🍽️', desc: 'Feed a total of 2,000 times',               check: (s) => s.stats.totalFed, target: 2000, rewardCoins: 3000, rewardPearls: 5 },
  { id: 'a-decor50',  name: 'Palace Architect',     emoji: '🏰', desc: 'Place 50 decorations',                 check: (s) => s.stats.decorPlacedCount, target: 50, rewardCoins: 4000, rewardPearls: 6 },
  // friends.length: number of codes in the friends list (capped at 50, see services.ts MAX_FRIENDS).
  { id: 'a-friend5',  name: 'Social Butterfly',   emoji: '🦋', desc: 'Add 5 friends',                     check: (s) => s.friends.length, target: 5,  rewardCoins: 600,  rewardPearls: 1 },
  { id: 'a-friend25', name: 'Reef Community',  emoji: '🐬', desc: 'Add 25 friends',                    check: (s) => s.friends.length, target: 25, rewardCoins: 3500, rewardPearls: 5 },
  { id: 'a-streak30', name: 'Monthly Friend',       emoji: '🌙', desc: 'Play 30 days in a row',               check: (s) => s.bestStreak, target: 30, rewardCoins: 6000, rewardPearls: 8 },
];
