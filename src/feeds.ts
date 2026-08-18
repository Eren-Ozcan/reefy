// Feed types: dispensed by hand (one per tap); higher-quality feeds
// carry a chance to add a permanent bonus to the fish's adult sale price.

export interface FeedDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;         // gold per piece (0 = free)
  hunger: number;       // hunger increase
  bonusChance: number;  // chance to earn a sale bonus per feeding (0..1)
  bonusAmount: number;  // bonus earned (as a fraction of sale price)
  color: number;        // feed particle color
  color2: number;       // glow color
  desc: string;
}

export const FEEDS: FeedDef[] = [
  {
    id: 'standart', name: 'Basic Feed', emoji: '🍤', cost: 0,
    hunger: 0.35, bonusChance: 0, bonusAmount: 0,
    color: 0xc98a4b, color2: 0xe8b078,
    desc: 'Free and filling. No bonus.',
  },
  {
    id: 'lezzet', name: 'Tasty Feed', emoji: '🦐', cost: 8,
    hunger: 0.4, bonusChance: 0.15, bonusAmount: 0.03,
    color: 0xe86a5e, color2: 0xffb0a0,
    desc: '15% chance to add +3% to sale price.',
  },
  {
    id: 'altin', name: 'Golden Feed', emoji: '✨', cost: 40,
    hunger: 0.45, bonusChance: 0.3, bonusAmount: 0.06,
    color: 0xf0c040, color2: 0xffe9a0,
    desc: '30% chance to add +6% to sale price.',
  },
];

export function feedById(id: string): FeedDef {
  return FEEDS.find((f) => f.id === id) ?? FEEDS[0];
}

/** Bulk feed packs: added to the bag as stock; once stock runs out, the normal per-unit price applies. */
export interface FeedPack {
  id: string;
  feed: string;   // FeedDef id
  qty: number;
  price: number;  // gold — cheaper per unit than normal
}

export const FEED_PACKS: FeedPack[] = [
  { id: 'pack-lezzet-10', feed: 'lezzet', qty: 10, price: 70 },    // 7/unit (normal 8)
  { id: 'pack-lezzet-50', feed: 'lezzet', qty: 50, price: 320 },   // 6.4/unit
  { id: 'pack-altin-10',  feed: 'altin',  qty: 10, price: 350 },   // 35/unit (normal 40)
  { id: 'pack-altin-50',  feed: 'altin',  qty: 50, price: 1600 },  // 32/unit
];

export function feedPackById(id: string): FeedPack | undefined {
  return FEED_PACKS.find((p) => p.id === id);
}

/** The highest sale bonus a fish can accumulate through feeding. */
export const FISH_BONUS_CAP = 0.6;
