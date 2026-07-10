export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Species {
  id: string;
  name: string;
  rarity: Rarity;
  colors: { body: number; belly: number; fin: number; accent: number };
  pattern: 'none' | 'stripes' | 'hstripe' | 'spots' | 'gradient';
  buyPrice: number;        // 0 => madeni parayla satılmaz
  pearlPrice?: number;     // inci ile satın alma
  sellPrice: number;       // yetişkin satış fiyatı
  growthMs: number;        // yavru -> yetişkin süresi
  unlockLevel: number;
  size: number;            // yetişkin gövde uzunluğu (px)
  bodyH?: number;          // gövde yükseklik oranı (varsayılan 0.48)
  finScale?: number;       // yüzgeç büyüklük çarpanı
  spiky?: boolean;         // sırt dikenleri (aslan balığı)
  desc: string;
}

export const RARITY_INFO: Record<Rarity, { name: string; color: string; glow: number; order: number }> = {
  common:    { name: 'Yaygın',    color: '#9aa5ad', glow: 0xffffff, order: 0 },
  uncommon:  { name: 'Az Bulunur', color: '#57b26a', glow: 0x7de08f, order: 1 },
  rare:      { name: 'Nadir',     color: '#3f8fd6', glow: 0x6fb6f2, order: 2 },
  epic:      { name: 'Epik',      color: '#a05fd0', glow: 0xc78ff0, order: 3 },
  legendary: { name: 'Efsanevi',  color: '#e5a52e', glow: 0xffd76e, order: 4 },
};

const MIN = 60_000;

export const SPECIES: Species[] = [
  // ---- Yaygın ----
  {
    id: 'lepistes', name: 'Lepistes', rarity: 'common',
    colors: { body: 0xff9e5e, belly: 0xffd9a8, fin: 0xffb02e, accent: 0xff6f61 },
    pattern: 'none', buyPrice: 40, sellPrice: 95, growthMs: 2 * MIN,
    unlockLevel: 1, size: 46, finScale: 1.35,
    desc: 'Neşeli ve dayanıklı. Her resifin ilk sakini.',
  },
  {
    id: 'neon-tetra', name: 'Neon Tetra', rarity: 'common',
    colors: { body: 0x5ec8ff, belly: 0xdff6ff, fin: 0x8fd8ff, accent: 0xff5e6c },
    pattern: 'hstripe', buyPrice: 65, sellPrice: 150, growthMs: 2.5 * MIN,
    unlockLevel: 1, size: 40,
    desc: 'Karanlıkta bile parlayan kırmızı şeridiyle ünlü.',
  },
  {
    id: 'moli', name: 'Siyah Moli', rarity: 'common',
    colors: { body: 0x3a3f52, belly: 0x596077, fin: 0x2c3040, accent: 0x596077 },
    pattern: 'none', buyPrice: 90, sellPrice: 210, growthMs: 3 * MIN,
    unlockLevel: 2, size: 44,
    desc: 'Sakin, zarif ve gece kadar siyah.',
  },
  // ---- Az Bulunur ----
  {
    id: 'palyaco', name: 'Palyaço Balığı', rarity: 'uncommon',
    colors: { body: 0xff8a3d, belly: 0xffb37d, fin: 0xff9d55, accent: 0xffffff },
    pattern: 'stripes', buyPrice: 220, sellPrice: 520, growthMs: 5 * MIN,
    unlockLevel: 2, size: 50,
    desc: 'Anemonların en sevimli komşusu.',
  },
  {
    id: 'melek', name: 'Melek Balığı', rarity: 'uncommon',
    colors: { body: 0xcfd8e3, belly: 0xf0f4f8, fin: 0xf7c948, accent: 0x3d4a5c },
    pattern: 'stripes', buyPrice: 340, sellPrice: 800, growthMs: 7 * MIN,
    unlockLevel: 3, size: 52, bodyH: 0.8, finScale: 1.5,
    desc: 'Uzun yüzgeçleriyle suda süzülen bir zarafet.',
  },
  {
    id: 'zebra-ciklit', name: 'Zebra Çiklit', rarity: 'uncommon',
    colors: { body: 0x6fa8dc, belly: 0xa8c8ea, fin: 0x5b8fc7, accent: 0x2f4d6e },
    pattern: 'stripes', buyPrice: 480, sellPrice: 1150, growthMs: 9 * MIN,
    unlockLevel: 4, size: 54,
    desc: 'Çizgileri kadar karakteri de belirgin.',
  },
  // ---- Nadir ----
  {
    id: 'beta', name: 'Beta', rarity: 'rare',
    colors: { body: 0x9b59d0, belly: 0xc39bdf, fin: 0xe05297, accent: 0x6f3bb5 },
    pattern: 'gradient', buyPrice: 950, sellPrice: 2300, growthMs: 12 * MIN,
    unlockLevel: 5, size: 50, finScale: 1.9,
    desc: 'İpek gibi yüzgeçleriyle suda dans eden savaşçı.',
  },
  {
    id: 'kral-gramma', name: 'Kraliyet Gramma', rarity: 'rare',
    colors: { body: 0xffd23e, belly: 0xffe58a, fin: 0xb14ecf, accent: 0x8e3fd1 },
    pattern: 'gradient', buyPrice: 1400, sellPrice: 3300, growthMs: 15 * MIN,
    unlockLevel: 6, size: 48,
    desc: 'Yarı mor yarı altın: doğanın cesur renk deneyi.',
  },
  {
    id: 'aslan', name: 'Aslan Balığı', rarity: 'rare',
    colors: { body: 0xe0574f, belly: 0xf2b3ae, fin: 0xd94840, accent: 0xfff1e8 },
    pattern: 'stripes', buyPrice: 1900, sellPrice: 4500, growthMs: 18 * MIN,
    unlockLevel: 7, size: 58, spiky: true, finScale: 1.4,
    desc: 'Dikenli tacıyla resifin gururlu kralı.',
  },
  // ---- Epik ----
  {
    id: 'mandarin', name: 'Mandarin Balığı', rarity: 'epic',
    colors: { body: 0x2e8fd8, belly: 0x5fb3ea, fin: 0xff9d2e, accent: 0xff7043 },
    pattern: 'spots', buyPrice: 3800, sellPrice: 8900, growthMs: 25 * MIN,
    unlockLevel: 8, size: 52,
    desc: 'Okyanusun en renkli tuvali.',
  },
  {
    id: 'koi', name: 'Koi', rarity: 'epic',
    colors: { body: 0xf7f3ee, belly: 0xffffff, fin: 0xf2e8dd, accent: 0xff7043 },
    pattern: 'spots', buyPrice: 5500, sellPrice: 12800, growthMs: 30 * MIN,
    unlockLevel: 9, size: 64,
    desc: 'Şans, sabır ve huzurun balığı.',
  },
  {
    id: 'diskus', name: 'Diskus', rarity: 'epic',
    colors: { body: 0x40c4b0, belly: 0x7fdccf, fin: 0x2ea896, accent: 0xe25856 },
    pattern: 'spots', buyPrice: 7500, sellPrice: 17500, growthMs: 35 * MIN,
    unlockLevel: 10, size: 56, bodyH: 0.85,
    desc: 'Akvaryum dünyasının turkuaz mücevheri.',
  },
  // ---- Efsanevi ----
  {
    id: 'altin-arowana', name: 'Altın Arowana', rarity: 'legendary',
    colors: { body: 0xf5c542, belly: 0xffe9a8, fin: 0xe8ae1f, accent: 0xffefb0 },
    pattern: 'none', buyPrice: 16000, sellPrice: 39000, growthMs: 45 * MIN,
    unlockLevel: 12, size: 78, finScale: 1.1,
    desc: 'Yaşayan bir altın külçesi. Efsaneler ondan bahseder.',
  },
  {
    id: 'inci', name: 'İnci Balığı', rarity: 'legendary',
    colors: { body: 0x9fe8ff, belly: 0xe8fbff, fin: 0xc9f2ff, accent: 0xffffff },
    pattern: 'spots', buyPrice: 0, pearlPrice: 60, sellPrice: 52000, growthMs: 60 * MIN,
    unlockLevel: 1, size: 60, finScale: 1.5,
    desc: 'Sadece incilerle çağrılabilen ışıltılı bir sır.',
  },
];

export function speciesById(id: string): Species {
  const sp = SPECIES.find((s) => s.id === id);
  if (!sp) throw new Error('unknown species: ' + id);
  return sp;
}

export interface EggTier {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  currency: 'coins' | 'pearls';
  odds: Partial<Record<Rarity, number>>; // yüzde
  desc: string;
}

export const EGGS: EggTier[] = [
  {
    id: 'bronz', name: 'Bronz Yumurta', emoji: '🥚', cost: 400, currency: 'coins',
    odds: { common: 70, uncommon: 25, rare: 5 },
    desc: 'Başlangıç sürprizi. Küçük ama umut dolu.',
  },
  {
    id: 'gumus', name: 'Gümüş Yumurta', emoji: '🪺', cost: 1800, currency: 'coins',
    odds: { uncommon: 40, rare: 45, epic: 15 },
    desc: 'İçinden nadir bir dost çıkma ihtimali yüksek.',
  },
  {
    id: 'altin', name: 'Altın Yumurta', emoji: '🌟', cost: 40, currency: 'pearls',
    odds: { rare: 30, epic: 50, legendary: 20 },
    desc: 'Efsaneler bu yumurtadan doğar.',
  },
];

export const FISH_NAMES = [
  'Baloncuk', 'Mercan', 'Şanslı', 'Fıstık', 'Zeytin', 'Bulut', 'Damla',
  'Yakut', 'Sedef', 'Limon', 'Karamel', 'Pati', 'Fındık', 'Yıldız',
  'Pamuk', 'Biber', 'Çakıl', 'Petek', 'Mısır', 'Lokum',
];
