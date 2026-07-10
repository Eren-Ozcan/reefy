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

/** Nadirlik başına yerleştirilmiş dekor büyüme bonusu (%) */
export const DECOR_BOOST: Record<Rarity, number> = {
  common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 8,
};
export const DECOR_BOOST_CAP = 35; // toplam % üst sınırı
export const MAX_PLACED = 10;      // akvaryum başına yerleştirme limiti

interface KindPlan {
  kind: DecorKind;
  base: string;
  desc: string;
  variants: { adj: string; color: number; color2: number; rarity: Rarity; scale?: number }[];
}

const PLANS: KindPlan[] = [
  {
    kind: 'kelp', base: 'Yosun', desc: 'Suyla dans eden canlı bitki.',
    variants: [
      { adj: 'Yeşil', color: 0x4da674, color2: 0x66bb8a, rarity: 'common' },
      { adj: 'Koyu', color: 0x2f7a52, color2: 0x3f9764, rarity: 'common' },
      { adj: 'Kızıl', color: 0xa85c48, color2: 0xc47a5e, rarity: 'uncommon' },
      { adj: 'Altın', color: 0xc9a53c, color2: 0xe0c25e, rarity: 'rare' },
      { adj: 'Mor', color: 0x8a5cb8, color2: 0xa87ad0, rarity: 'rare' },
      { adj: 'Neon', color: 0x3fd9a5, color2: 0x6ff0c4, rarity: 'epic', scale: 1.15 },
      { adj: 'Işıl', color: 0x7fe8e0, color2: 0xc8fff8, rarity: 'legendary', scale: 1.2 },
    ],
  },
  {
    kind: 'sword', base: 'Kılıç Bitkisi', desc: 'Dik yapraklı zarif akvaryum bitkisi.',
    variants: [
      { adj: 'Yeşil', color: 0x5c9e4a, color2: 0x7dbb66, rarity: 'common' },
      { adj: 'Limon', color: 0x9ec44a, color2: 0xbcd876, rarity: 'common' },
      { adj: 'Bordo', color: 0x8e4a52, color2: 0xac6a70, rarity: 'uncommon' },
      { adj: 'Alacalı', color: 0x6aa84f, color2: 0xd8e8a0, rarity: 'rare' },
      { adj: 'Kristal', color: 0x8fd8e8, color2: 0xd8f6ff, rarity: 'epic' },
    ],
  },
  {
    kind: 'coral-mound', base: 'Mercan Kümesi', desc: 'Rengarenk yumuşak mercan yatağı.',
    variants: [
      { adj: 'Pembe', color: 0xf4a09a, color2: 0xf7bcb8, rarity: 'common' },
      { adj: 'Gül', color: 0xe88c9d, color2: 0xf0aab8, rarity: 'common' },
      { adj: 'Turuncu', color: 0xf0975e, color2: 0xf7b585, rarity: 'uncommon' },
      { adj: 'Lila', color: 0xb08ad0, color2: 0xc8aae0, rarity: 'uncommon' },
      { adj: 'Turkuaz', color: 0x4ac4bc, color2: 0x7fdcd5, rarity: 'rare' },
      { adj: 'Gökkuşağı', color: 0xe86a8a, color2: 0x6ab8e8, rarity: 'epic', scale: 1.1 },
      { adj: 'Kristal', color: 0xa8e0f0, color2: 0xe8faff, rarity: 'legendary', scale: 1.15 },
    ],
  },
  {
    kind: 'tube-coral', base: 'Boru Mercanı', desc: 'Dik boruların oluşturduğu koloni.',
    variants: [
      { adj: 'Turuncu', color: 0xf0a35e, color2: 0xf7bd80, rarity: 'common' },
      { adj: 'Sarı', color: 0xe8c94a, color2: 0xf2dd7f, rarity: 'common' },
      { adj: 'Kırmızı', color: 0xd95f4f, color2: 0xe8877a, rarity: 'uncommon' },
      { adj: 'Mavi', color: 0x5a8fd0, color2: 0x85aede, rarity: 'rare' },
      { adj: 'Gece', color: 0x4a4a72, color2: 0x8a8ac9, rarity: 'epic' },
    ],
  },
  {
    kind: 'fan-coral', base: 'Yelpaze Mercanı', desc: 'Akıntıda sallanan zarif yelpaze.',
    variants: [
      { adj: 'Kızıl', color: 0xc9564a, color2: 0xe07a6e, rarity: 'uncommon' },
      { adj: 'Mor', color: 0x9a5cc4, color2: 0xb87fd9, rarity: 'uncommon' },
      { adj: 'Amber', color: 0xd9a03c, color2: 0xecc06a, rarity: 'rare' },
      { adj: 'İnci', color: 0xd8e8f0, color2: 0xf0f8fc, rarity: 'epic' },
    ],
  },
  {
    kind: 'anemone', base: 'Anemon', desc: 'Palyaço balıklarının yuvası.',
    variants: [
      { adj: 'Pembe', color: 0xe89ab8, color2: 0xf2bcd0, rarity: 'common' },
      { adj: 'Yeşil', color: 0x7fc46a, color2: 0xa5d894, rarity: 'uncommon' },
      { adj: 'Mor', color: 0x9a6ac4, color2: 0xbc94d9, rarity: 'rare' },
      { adj: 'Ateş', color: 0xe8703c, color2: 0xf59d5e, rarity: 'epic' },
      { adj: 'Kraliyet', color: 0xc9a02e, color2: 0xf0d060, rarity: 'legendary', scale: 1.1 },
    ],
  },
  {
    kind: 'rock', base: 'Kaya', desc: 'Doğal görünümlü dekoratif kaya.',
    variants: [
      { adj: 'Gri', color: 0x8a94a0, color2: 0xaab4c0, rarity: 'common' },
      { adj: 'Kumtaşı', color: 0xc4a878, color2: 0xdcc49a, rarity: 'common' },
      { adj: 'Bazalt', color: 0x5a5f6e, color2: 0x777d8f, rarity: 'common' },
      { adj: 'Yosunlu', color: 0x7a8a6a, color2: 0x5c9e4a, rarity: 'uncommon' },
      { adj: 'Lav', color: 0x6e4a4a, color2: 0xd0603c, rarity: 'rare' },
      { adj: 'Ametist', color: 0x7a5cb0, color2: 0xb894e8, rarity: 'epic' },
    ],
  },
  {
    kind: 'arch', base: 'Kaya Kemeri', desc: 'Balıkların içinden geçmeyi sevdiği kemer.',
    variants: [
      { adj: 'Gri', color: 0x8a94a0, color2: 0xa5aeba, rarity: 'uncommon' },
      { adj: 'Kumtaşı', color: 0xc4a878, color2: 0xd8c096, rarity: 'uncommon' },
      { adj: 'Mercanlı', color: 0xb08a80, color2: 0xf4a09a, rarity: 'rare' },
    ],
  },
  {
    kind: 'shell', base: 'Deniz Kabuğu', desc: 'Dev istiridye kabuğu.',
    variants: [
      { adj: 'Bej', color: 0xe0cba8, color2: 0xf0e2c8, rarity: 'common' },
      { adj: 'Pembe', color: 0xecb4b8, color2: 0xf7d4d6, rarity: 'uncommon' },
      { adj: 'Sedef', color: 0xd0dce8, color2: 0xf0f5fa, rarity: 'rare' },
      { adj: 'İncili', color: 0xc8d8e8, color2: 0xffffff, rarity: 'legendary', scale: 1.1 },
      { adj: 'Altın', color: 0xd9b23c, color2: 0xf0dc8a, rarity: 'epic' },
    ],
  },
  {
    kind: 'starfish', base: 'Denizyıldızı', desc: 'Kumda dinlenen sevimli yıldız.',
    variants: [
      { adj: 'Turuncu', color: 0xf09a4a, color2: 0xf7b878, rarity: 'common' },
      { adj: 'Kırmızı', color: 0xd9584a, color2: 0xe8827a, rarity: 'common' },
      { adj: 'Mavi', color: 0x5a8fd0, color2: 0x88b0de, rarity: 'uncommon' },
      { adj: 'Mor', color: 0x9a6ac4, color2: 0xbc94d9, rarity: 'rare' },
      { adj: 'Altın', color: 0xe0b23c, color2: 0xf0cf6e, rarity: 'epic' },
    ],
  },
  {
    kind: 'chest', base: 'Hazine Sandığı', desc: 'İçinden kabarcık çıkan gizemli sandık.',
    variants: [
      { adj: 'Ahşap', color: 0x9a6a42, color2: 0xd9b23c, rarity: 'rare' },
      { adj: 'Demir', color: 0x6e7684, color2: 0x9aa5b4, rarity: 'rare' },
      { adj: 'Altın', color: 0xc9a02e, color2: 0xf0d060, rarity: 'legendary', scale: 1.1 },
    ],
  },
  {
    kind: 'wreck', base: 'Batık', desc: 'Efsanevi bir geminin kalıntısı.',
    variants: [
      { adj: 'Balıkçı Teknesi', color: 0x8a6a4a, color2: 0xa88a64, rarity: 'epic', scale: 1.2 },
      { adj: 'Kalyon', color: 0x6a5240, color2: 0x8a7058, rarity: 'legendary', scale: 1.4 },
    ],
  },
  {
    kind: 'column', base: 'Antik Sütun', desc: 'Kayıp bir uygarlıktan kalan sütun.',
    variants: [
      { adj: 'Mermer', color: 0xd8dce4, color2: 0xf0f2f6, rarity: 'uncommon' },
      { adj: 'Yıkık', color: 0xb8bcc4, color2: 0xd4d8de, rarity: 'uncommon' },
      { adj: 'Yosunlu', color: 0xa8b49a, color2: 0x7a9a6a, rarity: 'rare' },
    ],
  },
  {
    kind: 'statue', base: 'Heykel', desc: 'Denizin dibinde bir sanat eseri.',
    variants: [
      { adj: 'Denizkızı', color: 0xc8d0da, color2: 0xe4eaf0, rarity: 'rare' },
      { adj: 'Poseidon', color: 0xb0bac6, color2: 0xd8e0e8, rarity: 'epic', scale: 1.15 },
      { adj: 'Altın Balık', color: 0xd0aa32, color2: 0xf0d060, rarity: 'legendary' },
    ],
  },
  {
    kind: 'castle', base: 'Kale', desc: 'Klasik akvaryum şatosu.',
    variants: [
      { adj: 'Taş', color: 0xa8b0bc, color2: 0xc8d0da, rarity: 'rare', scale: 1.1 },
      { adj: 'Mercan', color: 0xe0908a, color2: 0xf4b4b0, rarity: 'epic', scale: 1.15 },
    ],
  },
  {
    kind: 'skull', base: 'Dev Kafatası', desc: 'Korsanların uğrak noktası.',
    variants: [
      { adj: 'Kadim', color: 0xd8d4c8, color2: 0xf0ece0, rarity: 'epic' },
    ],
  },
  {
    kind: 'amphora', base: 'Amfora', desc: 'Antik ticaret gemilerinden kalan testi.',
    variants: [
      { adj: 'Toprak', color: 0xb07a4a, color2: 0xcc9a6a, rarity: 'common' },
      { adj: 'Devrik', color: 0x9a6a42, color2: 0xb8885e, rarity: 'uncommon' },
      { adj: 'Desenli', color: 0xa06a3c, color2: 0x5a8fd0, rarity: 'rare' },
      { adj: 'Kraliyet', color: 0x8a6a9e, color2: 0xd9b23c, rarity: 'epic' },
    ],
  },
  {
    kind: 'lamp', base: 'Fener', desc: 'Suya sıcak bir ışık huzmesi ekler.',
    variants: [
      { adj: 'Bakır', color: 0xb87a4a, color2: 0xffe9a8, rarity: 'uncommon' },
      { adj: 'Deniz Feneri', color: 0xd95f4f, color2: 0xfff2c8, rarity: 'rare' },
      { adj: 'Ay Işığı', color: 0x8a9ac4, color2: 0xdce8ff, rarity: 'epic' },
      { adj: 'Güneş', color: 0xd9a83c, color2: 0xfff0b0, rarity: 'legendary' },
    ],
  },
  {
    kind: 'bubbler', base: 'Kabarcık Taşı', desc: 'Sürekli kabarcık üretir, suya hayat katar.',
    variants: [
      { adj: 'Mini', color: 0x8a94a0, color2: 0xcfe8f0, rarity: 'common' },
      { adj: 'Volkan', color: 0x7a5a52, color2: 0xe87a5e, rarity: 'rare' },
      { adj: 'Kristal', color: 0xa8d0e8, color2: 0xe8f6ff, rarity: 'epic' },
    ],
  },
  {
    kind: 'sign', base: 'Tabela', desc: 'Resifine kişilik katan minik tabela.',
    variants: [
      { adj: '"Balık Geçidi"', color: 0x9a7a52, color2: 0xe8d5a8, rarity: 'common' },
      { adj: '"Dalış Yasak"', color: 0x9a5252, color2: 0xf0d8d8, rarity: 'uncommon' },
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
      // Aynı nadirlikte fiyatları hafifçe çeşitlendir
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
