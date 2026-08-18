import { Rarity } from './species';

export type Biome = 'tropik' | 'lagun' | 'derin' | 'magara' | 'kutup' | 'gunbatimi' | 'mistik';

/** The shape of the sand strip's top edge. There are no objects on the sand;
 *  tanks are distinguished from each other by color, light, and the sand's own shape. */
export type FloorShape = 'flat' | 'mound' | 'dip' | 'wave';

export interface TankDef {
  id: string;
  name: string;
  biome: Biome;
  rarity: Rarity;
  /** Flat backdrop color behind the water; the water gradient layers on top of it translucently. */
  backdrop: number;
  /** water gradient: surface, mid, bottom */
  water: [number, number, number];
  sand: number;
  sandDots: number;
  floor: FloorShape;
  rayCount: number;       // number of light rays
  rayAlpha: number;       // ray intensity (0..1)
  bubbles: number;        // bubble frequency multiplier (0.4 sparse — 1.6 dense)
  price: number;          // 0 => starter tank
  currency: 'coins' | 'pearls';
  unlockLevel: number;
  growthBonus: number;    // % growth bonus
  desc: string;
}

/** Bonus the tank's rarity tier adds to fish capacity. */
export const TANK_CAP_BONUS: Record<Rarity, number> = {
  common: 0, uncommon: 2, rare: 4, epic: 7, legendary: 10,
};

export const BIOME_INFO: Record<Biome, { name: string; emoji: string }> = {
  tropik:    { name: 'Tropical',     emoji: '🏝️' },
  lagun:     { name: 'Lagoon',      emoji: '🌺' },
  derin:     { name: 'Deep Sea', emoji: '🌌' },
  magara:    { name: 'Cave',     emoji: '🪨' },
  kutup:     { name: 'Polar',      emoji: '❄️' },
  gunbatimi: { name: 'Sunset', emoji: '🌅' },
  mistik:    { name: 'Mystic',     emoji: '🔮' },
};

export const TANKS: TankDef[] = [
  // ---- Starter ----
  { id: 'tank-mercan-koyu', name: 'Coral Cove', biome: 'tropik', rarity: 'common',
    backdrop: 0x8bd2da, water: [0x9ad0cf, 0x5cbcb9, 0x358288],
    sand: 0xe6d5a8, sandDots: 0xddba74,
    floor: 'mound', rayCount: 4, rayAlpha: 0.070, bubbles: 1.0,
    price: 0, currency: 'coins', unlockLevel: 1, growthBonus: 0,
    desc: 'The warm, safe cove where it all begins.' },
  // ---- Common ----
  { id: 'tank-kumsal', name: 'Golden Sands', biome: 'tropik', rarity: 'common',
    backdrop: 0xaeeacc, water: [0xbfe4d6, 0x80d0b3, 0x3fb696],
    sand: 0xf3e7ba, sandDots: 0xefd181,
    floor: 'flat', rayCount: 5, rayAlpha: 0.095, bubbles: 0.7,
    price: 2500, currency: 'coins', unlockLevel: 3, growthBonus: 1,
    desc: 'Shallow waters where the sun warms the sand.' },
  { id: 'tank-yosunluk', name: 'Kelp Garden', biome: 'lagun', rarity: 'common',
    backdrop: 0x83c270, water: [0x83bb81, 0x509d4d, 0x2e6131],
    sand: 0xc6c68b, sandDots: 0xb6b05e,
    floor: 'wave', rayCount: 3, rayAlpha: 0.055, bubbles: 0.9,
    price: 4000, currency: 'coins', unlockLevel: 4, growthBonus: 1,
    desc: 'A lush, thriving underwater garden.' },
  { id: 'tank-sig-resif', name: 'Shallow Reef', biome: 'tropik', rarity: 'common',
    backdrop: 0xa4d0ea, water: [0xacd4e2, 0x69b7d3, 0x2f81b1],
    sand: 0xe4d3b4, sandDots: 0xd8b382,
    floor: 'wave', rayCount: 4, rayAlpha: 0.080, bubbles: 1.3,
    price: 6000, currency: 'coins', unlockLevel: 5, growthBonus: 1,
    desc: 'The busiest neighborhood of colorful corals.' },
  { id: 'tank-koy-agzi', name: 'Cove Mouth', biome: 'lagun', rarity: 'common',
    backdrop: 0x7da3d4, water: [0x87abca, 0x4783b8, 0x2c4d77],
    sand: 0xd4c39b, sandDots: 0xc6a56c,
    floor: 'flat', rayCount: 4, rayAlpha: 0.065, bubbles: 1.2,
    price: 8500, currency: 'coins', unlockLevel: 6, growthBonus: 1,
    desc: 'The gateway to the open sea.' },
  // ---- Uncommon ----
  { id: 'tank-lagun', name: 'Turquoise Lagoon', biome: 'lagun', rarity: 'uncommon',
    backdrop: 0xa0eeec, water: [0xa8e6dd, 0x62daca, 0x27b9b4],
    sand: 0xf0e6c7, sandDots: 0xe7ce92,
    floor: 'dip', rayCount: 5, rayAlpha: 0.100, bubbles: 0.8,
    price: 12000, currency: 'coins', unlockLevel: 7, growthBonus: 2,
    desc: 'A paradise straight off a postcard.' },
  { id: 'tank-mangrov', name: 'Mangrove Shore', biome: 'lagun', rarity: 'uncommon',
    backdrop: 0x96a960, water: [0x91a875, 0x68814b, 0x364729],
    sand: 0xae936f, sandDots: 0x93704e,
    floor: 'mound', rayCount: 2, rayAlpha: 0.045, bubbles: 0.6,
    price: 16000, currency: 'coins', unlockLevel: 8, growthBonus: 2,
    desc: 'Fish playing hide-and-seek among the roots.' },
  { id: 'tank-gelgit', name: 'Tide Pool', biome: 'tropik', rarity: 'uncommon',
    backdrop: 0xa0daad, water: [0xa7d3b7, 0x6bbd89, 0x3d8f63],
    sand: 0xd9d1a1, sandDots: 0xcbb971,
    floor: 'dip', rayCount: 3, rayAlpha: 0.060, bubbles: 1.5,
    price: 20000, currency: 'coins', unlockLevel: 9, growthBonus: 2,
    desc: 'A tiny world renewed with every tide.' },
  { id: 'tank-inci-yataklari', name: 'Pearl Beds', biome: 'lagun', rarity: 'uncommon',
    backdrop: 0xe8e1d4, water: [0xe7e3da, 0xc9c0a6, 0xa79d6c],
    sand: 0xece6df, sandDots: 0xd7c7b7,
    floor: 'wave', rayCount: 4, rayAlpha: 0.085, bubbles: 1.0,
    price: 26000, currency: 'coins', unlockLevel: 10, growthBonus: 2,
    desc: 'Pearly waters where oysters whisper.' },
  { id: 'tank-firtina', name: 'Storm Point', biome: 'derin', rarity: 'uncommon',
    backdrop: 0x697db5, water: [0x7e92b4, 0x4f6792, 0x2d3957],
    sand: 0xae9c7a, sandDots: 0x947b56,
    floor: 'wave', rayCount: 2, rayAlpha: 0.040, bubbles: 1.6,
    price: 33000, currency: 'coins', unlockLevel: 11, growthBonus: 2,
    desc: 'Choppy waters that test the boldest fish.' },
  // ---- Rare ----
  { id: 'tank-batik-koyu', name: 'Shipwreck Cove', biome: 'derin', rarity: 'rare',
    backdrop: 0x4c4fa9, water: [0x606aa9, 0x3d457b, 0x1e1f3e],
    sand: 0x9c8563, sandDots: 0x786249,
    floor: 'mound', rayCount: 2, rayAlpha: 0.035, bubbles: 0.7,
    price: 45000, currency: 'coins', unlockLevel: 12, growthBonus: 3,
    desc: 'A cove that keeps the stories of old ships.' },
  { id: 'tank-magara', name: 'Crystal Cave', biome: 'magara', rarity: 'rare',
    backdrop: 0x7d5dac, water: [0x8473aa, 0x5b4983, 0x352849],
    sand: 0x887693, sandDots: 0x675973,
    floor: 'mound', rayCount: 1, rayAlpha: 0.055, bubbles: 0.5,
    price: 60000, currency: 'coins', unlockLevel: 13, growthBonus: 3,
    desc: 'A hidden cave with crystals hanging from its ceiling.' },
  { id: 'tank-kanyon', name: 'Underwater Canyon', biome: 'derin', rarity: 'rare',
    backdrop: 0x34648d, water: [0x497b98, 0x2b4f64, 0x0f1a24],
    sand: 0x87725a, sandDots: 0x645040,
    floor: 'dip', rayCount: 1, rayAlpha: 0.030, bubbles: 0.5,
    price: 80000, currency: 'coins', unlockLevel: 14, growthBonus: 3,
    desc: 'A deep rift whose walls echo endlessly.' },
  { id: 'tank-buzul', name: 'Glacier Shore', biome: 'kutup', rarity: 'rare',
    backdrop: 0xcfe5f2, water: [0xdbebf0, 0x9dccdd, 0x569ec7],
    sand: 0xe1e6ea, sandDots: 0xbccad2,
    floor: 'flat', rayCount: 5, rayAlpha: 0.105, bubbles: 0.9,
    price: 105000, currency: 'coins', unlockLevel: 15, growthBonus: 3,
    desc: 'A silent world of ice-blue waters.' },
  { id: 'tank-gunbatimi', name: 'Sunset Reef', biome: 'gunbatimi', rarity: 'rare',
    backdrop: 0xc25b7e, water: [0xe6bfa8, 0xda8e62, 0xb96b27],
    sand: 0xe7c5a6, sandDots: 0xe09d71,
    floor: 'wave', rayCount: 4, rayAlpha: 0.095, bubbles: 0.8,
    price: 135000, currency: 'coins', unlockLevel: 16, growthBonus: 3,
    desc: 'Sunset happens even beneath the waves.' },
  // ---- Epic ----
  { id: 'tank-abis', name: 'Abyss Gate', biome: 'derin', rarity: 'epic',
    backdrop: 0x182059, water: [0x4059ab, 0x253774, 0x0e122f],
    sand: 0x4f4b63, sandDots: 0x312f41,
    floor: 'flat', rayCount: 1, rayAlpha: 0.022, bubbles: 0.4,
    price: 175000, currency: 'coins', unlockLevel: 17, growthBonus: 5,
    desc: 'The border where light fades and mystery grows.' },
  { id: 'tank-volkanik', name: 'Volcanic Bed', biome: 'magara', rarity: 'epic',
    backdrop: 0x8b4b41, water: [0x946756, 0x634236, 0x281c15],
    sand: 0x7a5a48, sandDots: 0x553b2f,
    floor: 'dip', rayCount: 1, rayAlpha: 0.038, bubbles: 1.4,
    price: 220000, currency: 'coins', unlockLevel: 18, growthBonus: 5,
    desc: 'A mineral paradise fed by hot vents.' },
  { id: 'tank-aysberg', name: 'Under the Iceberg', biome: 'kutup', rarity: 'epic',
    backdrop: 0x97add8, water: [0xa5bad4, 0x698ebf, 0x3b5891],
    sand: 0xb9c0ca, sandDots: 0x95a1b1,
    floor: 'mound', rayCount: 3, rayAlpha: 0.075, bubbles: 1.3,
    price: 270000, currency: 'coins', unlockLevel: 19, growthBonus: 5,
    desc: 'In the blue shadow of a towering iceberg.' },
  { id: 'tank-antik-sehir', name: 'Ancient City', biome: 'mistik', rarity: 'epic',
    backdrop: 0x81b1a1, water: [0x93b3ad, 0x629389, 0x3c5d59],
    sand: 0xbfb69b, sandDots: 0xaa9874,
    floor: 'flat', rayCount: 3, rayAlpha: 0.058, bubbles: 0.7,
    price: 330000, currency: 'coins', unlockLevel: 20, growthBonus: 5,
    desc: 'A lost city whose pillars still stand.' },
  { id: 'tank-biyolumin', name: 'Glowing Valley', biome: 'mistik', rarity: 'epic',
    backdrop: 0x602a84, water: [0x684096, 0x402461, 0x160b1e],
    sand: 0x7f5889, sandDots: 0x5b3e65,
    floor: 'wave', rayCount: 2, rayAlpha: 0.068, bubbles: 1.5,
    price: 400000, currency: 'coins', unlockLevel: 21, growthBonus: 5,
    desc: 'A valley where every creature carries its own light.' },
  // ---- Legendary ----
  { id: 'tank-ay-lagunu', name: 'Moon Lagoon', biome: 'mistik', rarity: 'legendary',
    backdrop: 0xbcb9e9, water: [0xc6c7e6, 0x898cd1, 0x4c45ba],
    sand: 0xced0de, sandDots: 0xa8aec7,
    floor: 'dip', rayCount: 4, rayAlpha: 0.100, bubbles: 0.9,
    price: 120, currency: 'pearls', unlockLevel: 22, growthBonus: 8,
    desc: 'A legendary lagoon where moonlight never fades.' },
  { id: 'tank-altin-saray', name: 'Golden Palace', biome: 'mistik', rarity: 'legendary',
    backdrop: 0xe2b46f, water: [0xd7be84, 0xcca13e, 0x8c7622],
    sand: 0xeedeaa, sandDots: 0xe9c572,
    floor: 'mound', rayCount: 5, rayAlpha: 0.110, bubbles: 0.8,
    price: 160, currency: 'pearls', unlockLevel: 24, growthBonus: 8,
    desc: 'The golden throne of a sunken empire.' },
  { id: 'tank-hayalet-gemisi', name: 'Ghost Ship', biome: 'derin', rarity: 'legendary',
    backdrop: 0x658086, water: [0x728a8d, 0x4c5f61, 0x242c2e],
    sand: 0x73816a, sandDots: 0x56604d,
    floor: 'wave', rayCount: 2, rayAlpha: 0.042, bubbles: 0.6,
    price: 200, currency: 'pearls', unlockLevel: 26, growthBonus: 8,
    desc: 'A ship that never sinks, seen through the mist.' },
  { id: 'tank-mercan-tahti', name: 'Coral Throne', biome: 'tropik', rarity: 'legendary',
    backdrop: 0xeeaac5, water: [0xe9bac3, 0xdb768a, 0xc5303f],
    sand: 0xeed1b5, sandDots: 0xe7ac7e,
    floor: 'mound', rayCount: 5, rayAlpha: 0.090, bubbles: 1.1,
    price: 250, currency: 'pearls', unlockLevel: 28, growthBonus: 8,
    desc: "The reef kingdom's heart. Open only to legends." },
  { id: 'tank-sonsuzluk', name: 'Infinity Pool', biome: 'mistik', rarity: 'legendary',
    backdrop: 0xd49bcd, water: [0xcda2cd, 0xb569b5, 0x833e7d],
    sand: 0xd7bfd9, sandDots: 0xbf96c5,
    floor: 'flat', rayCount: 3, rayAlpha: 0.082, bubbles: 1.2,
    price: 320, currency: 'pearls', unlockLevel: 30, growthBonus: 10,
    desc: "Water with no horizon. Reefy's greatest secret." },
];

export function tankById(id: string): TankDef {
  const t = TANKS.find((x) => x.id === id);
  if (!t) throw new Error('unknown tank: ' + id);
  return t;
}
