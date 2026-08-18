import { Rarity } from './species';

export type DecorKind =
  | 'kelp' | 'sword' | 'coral-mound' | 'tube-coral' | 'fan-coral' | 'anemone'
  | 'rock' | 'arch' | 'shell' | 'starfish' | 'chest' | 'wreck' | 'column'
  | 'statue' | 'castle' | 'skull' | 'amphora' | 'lamp' | 'bubbler' | 'sign';

export interface DecorDef {
  id: string;
  name: string;
  kind: DecorKind;
  rarity: Rarity;
  price: number;
  currency: 'coins' | 'pearls';
  color: number;
  color2: number;
  scale: number;
  desc: string;
}

/** Placed decor growth bonus per rarity (%) */
export const DECOR_BOOST: Record<Rarity, number> = {
  common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 8,
};
export const DECOR_BOOST_CAP = 35; // total % upper limit
export const MAX_PLACED = 10;      // placement limit per aquarium

interface KindPlan {
  kind: DecorKind;
  base: string;
  desc: string;
  variants: { adj: string; color: number; color2: number; rarity: Rarity; scale?: number }[];
}

const PLANS: KindPlan[] = [
  {
    kind: 'kelp', base: 'Kelp', desc: 'A living plant that dances with the water.',
    variants: [
      { adj: 'Green', color: 0x4da674, color2: 0x66bb8a, rarity: 'common' },
      { adj: 'Dark', color: 0x2f7a52, color2: 0x3f9764, rarity: 'common' },
      { adj: 'Red', color: 0xa85c48, color2: 0xc47a5e, rarity: 'uncommon' },
      { adj: 'Golden', color: 0xc9a53c, color2: 0xe0c25e, rarity: 'rare' },
      { adj: 'Purple', color: 0x8a5cb8, color2: 0xa87ad0, rarity: 'rare' },
      { adj: 'Neon', color: 0x3fd9a5, color2: 0x6ff0c4, rarity: 'epic', scale: 1.15 },
      { adj: 'Glowing', color: 0x7fe8e0, color2: 0xc8fff8, rarity: 'legendary', scale: 1.2 },
    ],
  },
  {
    kind: 'sword', base: 'Sword Plant', desc: 'An elegant aquarium plant with upright leaves.',
    variants: [
      { adj: 'Green', color: 0x5c9e4a, color2: 0x7dbb66, rarity: 'common' },
      { adj: 'Lemon', color: 0x9ec44a, color2: 0xbcd876, rarity: 'common' },
      { adj: 'Burgundy', color: 0x8e4a52, color2: 0xac6a70, rarity: 'uncommon' },
      { adj: 'Mottled', color: 0x6aa84f, color2: 0xd8e8a0, rarity: 'rare' },
      { adj: 'Crystal', color: 0x8fd8e8, color2: 0xd8f6ff, rarity: 'epic' },
    ],
  },
  {
    kind: 'coral-mound', base: 'Coral Cluster', desc: 'A colorful bed of soft coral.',
    variants: [
      { adj: 'Pink', color: 0xf4a09a, color2: 0xf7bcb8, rarity: 'common' },
      { adj: 'Rose', color: 0xe88c9d, color2: 0xf0aab8, rarity: 'common' },
      { adj: 'Orange', color: 0xf0975e, color2: 0xf7b585, rarity: 'uncommon' },
      { adj: 'Lilac', color: 0xb08ad0, color2: 0xc8aae0, rarity: 'uncommon' },
      { adj: 'Turquoise', color: 0x4ac4bc, color2: 0x7fdcd5, rarity: 'rare' },
      { adj: 'Rainbow', color: 0xe86a8a, color2: 0x6ab8e8, rarity: 'epic', scale: 1.1 },
      { adj: 'Crystal', color: 0xa8e0f0, color2: 0xe8faff, rarity: 'legendary', scale: 1.15 },
    ],
  },
  {
    kind: 'tube-coral', base: 'Tube Coral', desc: 'A colony formed of upright tubes.',
    variants: [
      { adj: 'Orange', color: 0xf0a35e, color2: 0xf7bd80, rarity: 'common' },
      { adj: 'Yellow', color: 0xe8c94a, color2: 0xf2dd7f, rarity: 'common' },
      { adj: 'Red', color: 0xd95f4f, color2: 0xe8877a, rarity: 'uncommon' },
      { adj: 'Blue', color: 0x5a8fd0, color2: 0x85aede, rarity: 'rare' },
      { adj: 'Midnight', color: 0x4a4a72, color2: 0x8a8ac9, rarity: 'epic' },
    ],
  },
  {
    kind: 'fan-coral', base: 'Fan Coral', desc: 'An elegant fan swaying in the current.',
    variants: [
      { adj: 'Red', color: 0xc9564a, color2: 0xe07a6e, rarity: 'uncommon' },
      { adj: 'Purple', color: 0x9a5cc4, color2: 0xb87fd9, rarity: 'uncommon' },
      { adj: 'Amber', color: 0xd9a03c, color2: 0xecc06a, rarity: 'rare' },
      { adj: 'Pearl', color: 0xd8e8f0, color2: 0xf0f8fc, rarity: 'epic' },
    ],
  },
  {
    kind: 'anemone', base: 'Anemone', desc: "A clownfish's home.",
    variants: [
      { adj: 'Pink', color: 0xe89ab8, color2: 0xf2bcd0, rarity: 'common' },
      { adj: 'Green', color: 0x7fc46a, color2: 0xa5d894, rarity: 'uncommon' },
      { adj: 'Purple', color: 0x9a6ac4, color2: 0xbc94d9, rarity: 'rare' },
      { adj: 'Fire', color: 0xe8703c, color2: 0xf59d5e, rarity: 'epic' },
      { adj: 'Royal', color: 0xc9a02e, color2: 0xf0d060, rarity: 'legendary', scale: 1.1 },
    ],
  },
  {
    kind: 'rock', base: 'Rock', desc: 'A natural-looking decorative rock.',
    variants: [
      { adj: 'Gray', color: 0x8a94a0, color2: 0xaab4c0, rarity: 'common' },
      { adj: 'Sandstone', color: 0xc4a878, color2: 0xdcc49a, rarity: 'common' },
      { adj: 'Basalt', color: 0x5a5f6e, color2: 0x777d8f, rarity: 'common' },
      { adj: 'Mossy', color: 0x7a8a6a, color2: 0x5c9e4a, rarity: 'uncommon' },
      { adj: 'Lava', color: 0x6e4a4a, color2: 0xd0603c, rarity: 'rare' },
      { adj: 'Amethyst', color: 0x7a5cb0, color2: 0xb894e8, rarity: 'epic' },
    ],
  },
  {
    kind: 'arch', base: 'Rock Arch', desc: 'An arch fish love swimming through.',
    variants: [
      { adj: 'Gray', color: 0x8a94a0, color2: 0xa5aeba, rarity: 'uncommon' },
      { adj: 'Sandstone', color: 0xc4a878, color2: 0xd8c096, rarity: 'uncommon' },
      { adj: 'Coral-Crusted', color: 0xb08a80, color2: 0xf4a09a, rarity: 'rare' },
    ],
  },
  {
    kind: 'shell', base: 'Sea Shell', desc: 'A giant oyster shell.',
    variants: [
      { adj: 'Beige', color: 0xe0cba8, color2: 0xf0e2c8, rarity: 'common' },
      { adj: 'Pink', color: 0xecb4b8, color2: 0xf7d4d6, rarity: 'uncommon' },
      { adj: 'Mother-of-Pearl', color: 0xd0dce8, color2: 0xf0f5fa, rarity: 'rare' },
      { adj: 'Pearled', color: 0xc8d8e8, color2: 0xffffff, rarity: 'legendary', scale: 1.1 },
      { adj: 'Golden', color: 0xd9b23c, color2: 0xf0dc8a, rarity: 'epic' },
    ],
  },
  {
    kind: 'starfish', base: 'Starfish', desc: 'A cute star resting on the sand.',
    variants: [
      { adj: 'Orange', color: 0xf09a4a, color2: 0xf7b878, rarity: 'common' },
      { adj: 'Red', color: 0xd9584a, color2: 0xe8827a, rarity: 'common' },
      { adj: 'Blue', color: 0x5a8fd0, color2: 0x88b0de, rarity: 'uncommon' },
      { adj: 'Purple', color: 0x9a6ac4, color2: 0xbc94d9, rarity: 'rare' },
      { adj: 'Golden', color: 0xe0b23c, color2: 0xf0cf6e, rarity: 'epic' },
    ],
  },
  {
    kind: 'chest', base: 'Treasure Chest', desc: 'A mysterious chest that bubbles from within.',
    variants: [
      { adj: 'Wooden', color: 0x9a6a42, color2: 0xd9b23c, rarity: 'rare' },
      { adj: 'Iron', color: 0x6e7684, color2: 0x9aa5b4, rarity: 'rare' },
      { adj: 'Golden', color: 0xc9a02e, color2: 0xf0d060, rarity: 'legendary', scale: 1.1 },
    ],
  },
  {
    kind: 'wreck', base: 'Shipwreck', desc: 'The remains of a legendary ship.',
    variants: [
      { adj: 'Fishing Boat', color: 0x8a6a4a, color2: 0xa88a64, rarity: 'epic', scale: 1.2 },
      { adj: 'Galleon', color: 0x6a5240, color2: 0x8a7058, rarity: 'legendary', scale: 1.4 },
    ],
  },
  {
    kind: 'column', base: 'Ancient Column', desc: 'A column left behind by a lost civilization.',
    variants: [
      { adj: 'Marble', color: 0xd8dce4, color2: 0xf0f2f6, rarity: 'uncommon' },
      { adj: 'Ruined', color: 0xb8bcc4, color2: 0xd4d8de, rarity: 'uncommon' },
      { adj: 'Mossy', color: 0xa8b49a, color2: 0x7a9a6a, rarity: 'rare' },
    ],
  },
  {
    kind: 'statue', base: 'Statue', desc: 'A work of art on the seafloor.',
    variants: [
      { adj: 'Mermaid', color: 0xc8d0da, color2: 0xe4eaf0, rarity: 'rare' },
      { adj: 'Poseidon', color: 0xb0bac6, color2: 0xd8e0e8, rarity: 'epic', scale: 1.15 },
      { adj: 'Golden Fish', color: 0xd0aa32, color2: 0xf0d060, rarity: 'legendary' },
    ],
  },
  {
    kind: 'castle', base: 'Castle', desc: 'A classic aquarium castle.',
    variants: [
      { adj: 'Stone', color: 0xa8b0bc, color2: 0xc8d0da, rarity: 'rare', scale: 1.1 },
      { adj: 'Coral', color: 0xe0908a, color2: 0xf4b4b0, rarity: 'epic', scale: 1.15 },
    ],
  },
  {
    kind: 'skull', base: 'Giant Skull', desc: "A pirate's favorite haunt.",
    variants: [
      { adj: 'Ancient', color: 0xd8d4c8, color2: 0xf0ece0, rarity: 'epic' },
    ],
  },
  {
    kind: 'amphora', base: 'Amphora', desc: 'A jar left behind by ancient trading ships.',
    variants: [
      { adj: 'Clay', color: 0xb07a4a, color2: 0xcc9a6a, rarity: 'common' },
      { adj: 'Tipped', color: 0x9a6a42, color2: 0xb8885e, rarity: 'uncommon' },
      { adj: 'Patterned', color: 0xa06a3c, color2: 0x5a8fd0, rarity: 'rare' },
      { adj: 'Royal', color: 0x8a6a9e, color2: 0xd9b23c, rarity: 'epic' },
    ],
  },
  {
    kind: 'lamp', base: 'Lantern', desc: 'Adds a warm beam of light to the water.',
    variants: [
      { adj: 'Copper', color: 0xb87a4a, color2: 0xffe9a8, rarity: 'uncommon' },
      { adj: 'Lighthouse', color: 0xd95f4f, color2: 0xfff2c8, rarity: 'rare' },
      { adj: 'Moonlight', color: 0x8a9ac4, color2: 0xdce8ff, rarity: 'epic' },
      { adj: 'Sun', color: 0xd9a83c, color2: 0xfff0b0, rarity: 'legendary' },
    ],
  },
  {
    kind: 'bubbler', base: 'Bubble Stone', desc: 'Continuously produces bubbles, bringing life to the water.',
    variants: [
      { adj: 'Mini', color: 0x8a94a0, color2: 0xcfe8f0, rarity: 'common' },
      { adj: 'Volcano', color: 0x7a5a52, color2: 0xe87a5e, rarity: 'rare' },
      { adj: 'Crystal', color: 0xa8d0e8, color2: 0xe8f6ff, rarity: 'epic' },
    ],
  },
  {
    kind: 'sign', base: 'Sign', desc: 'A tiny sign that adds personality to your reef.',
    variants: [
      { adj: '"Fish Crossing"', color: 0x9a7a52, color2: 0xe8d5a8, rarity: 'common' },
      { adj: '"No Diving"', color: 0x9a5252, color2: 0xf0d8d8, rarity: 'uncommon' },
      { adj: '"Reefy"', color: 0x2f9e8f, color2: 0xa5ece4, rarity: 'rare' },
    ],
  },
];

const PRICE_BY_RARITY: Record<Rarity, { price: number; currency: 'coins' | 'pearls' }> = {
  common:    { price: 150,   currency: 'coins' },
  uncommon:  { price: 600,   currency: 'coins' },
  rare:      { price: 2200,  currency: 'coins' },
  epic:      { price: 7500,  currency: 'coins' },
  legendary: { price: 45,    currency: 'pearls' },
};

function buildDecor(): DecorDef[] {
  const out: DecorDef[] = [];
  let n = 0;
  for (const plan of PLANS) {
    for (const v of plan.variants) {
      n++;
      const p = PRICE_BY_RARITY[v.rarity];
      // Slightly vary prices within the same rarity
      const jitter = 1 + ((n * 7) % 5) * 0.06;
      out.push({
        id: `dec-${plan.kind}-${n}`,
        name: `${v.adj} ${plan.base}`,
        kind: plan.kind,
        rarity: v.rarity,
        price: p.currency === 'coins' ? Math.round((p.price * jitter) / 10) * 10 : Math.round(p.price * jitter),
        currency: p.currency,
        color: v.color,
        color2: v.color2,
        scale: v.scale ?? 1,
        desc: plan.desc,
      });
    }
  }
  return out;
}

export const DECOR: DecorDef[] = buildDecor();

export function decorById(id: string): DecorDef {
  const d = DECOR.find((x) => x.id === id);
  if (!d) throw new Error('unknown decor: ' + id);
  return d;
}
