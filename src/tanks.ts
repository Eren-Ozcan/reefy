import { Rarity } from './species';

export type Biome = 'tropik' | 'lagun' | 'derin' | 'magara' | 'kutup' | 'gunbatimi' | 'mistik';

export interface TankDef {
  id: string;
  name: string;
  biome: Biome;
  rarity: Rarity;
  /** su gradyanı: yüzey, orta, dip */
  water: [number, number, number];
  sand: number;
  sandDots: number;
  price: number;          // 0 => başlangıç akvaryumu
  currency: 'coins' | 'pearls';
  unlockLevel: number;
  growthBonus: number;    // % büyüme bonusu
  desc: string;
}

/** Akvaryum kademesinin balık kapasitesine eklediği bonus. */
export const TANK_CAP_BONUS: Record<Rarity, number> = {
  common: 0, uncommon: 2, rare: 4, epic: 7, legendary: 10,
};

export const BIOME_INFO: Record<Biome, { name: string; emoji: string }> = {
  tropik:    { name: 'Tropik',     emoji: '🏝️' },
  lagun:     { name: 'Lagün',      emoji: '🌺' },
  derin:     { name: 'Derin Deniz', emoji: '🌌' },
  magara:    { name: 'Mağara',     emoji: '🪨' },
  kutup:     { name: 'Kutup',      emoji: '❄️' },
  gunbatimi: { name: 'Gün Batımı', emoji: '🌅' },
  mistik:    { name: 'Mistik',     emoji: '🔮' },
};

export const TANKS: TankDef[] = [
  // ---- Başlangıç ----
  { id: 'tank-mercan-koyu', name: 'Mercan Koyu', biome: 'tropik', rarity: 'common',
    water: [0x9fe0da, 0x58aab4, 0x2f7f96], sand: 0xe8d5a8, sandDots: 0xd9bf8c,
    price: 0, currency: 'coins', unlockLevel: 1, growthBonus: 0,
    desc: 'Her şeyin başladığı sıcak, güvenli koy.' },
  // ---- Yaygın ----
  { id: 'tank-kumsal', name: 'Altın Kumsal', biome: 'tropik', rarity: 'common',
    water: [0xaee8dc, 0x62b8b4, 0x3a8a96], sand: 0xf0dfae, sandDots: 0xe0c88f,
    price: 2500, currency: 'coins', unlockLevel: 3, growthBonus: 1,
    desc: 'Güneşin kumları ısıttığı sığ sular.' },
  { id: 'tank-yosunluk', name: 'Yosun Bahçesi', biome: 'lagun', rarity: 'common',
    water: [0xa8e0c0, 0x5aab8a, 0x2f7a68], sand: 0xd8cf9a, sandDots: 0xc4b87f,
    price: 4000, currency: 'coins', unlockLevel: 4, growthBonus: 1,
    desc: 'Yemyeşil, bereketli bir su bahçesi.' },
  { id: 'tank-sig-resif', name: 'Sığ Resif', biome: 'tropik', rarity: 'common',
    water: [0xb8ece4, 0x6ec0c4, 0x3f92a4], sand: 0xecd8ac, sandDots: 0xd8c390,
    price: 6000, currency: 'coins', unlockLevel: 5, growthBonus: 1,
    desc: 'Renkli mercanların en kalabalık mahallesi.' },
  { id: 'tank-koy-agzi', name: 'Koy Ağzı', biome: 'lagun', rarity: 'common',
    water: [0x9fd8e0, 0x54a0b8, 0x2c6f8e], sand: 0xe0d0a0, sandDots: 0xccba85,
    price: 8500, currency: 'coins', unlockLevel: 6, growthBonus: 1,
    desc: 'Açık denize açılan kapı.' },
  // ---- Az Bulunur ----
  { id: 'tank-lagun', name: 'Turkuaz Lagün', biome: 'lagun', rarity: 'uncommon',
    water: [0xa5ecec, 0x4fc0c9, 0x2a8a9e], sand: 0xf2e2b8, sandDots: 0xe0cc96,
    price: 12000, currency: 'coins', unlockLevel: 7, growthBonus: 2,
    desc: 'Kartpostallardan fırlamış bir cennet.' },
  { id: 'tank-mangrov', name: 'Mangrov Kıyısı', biome: 'lagun', rarity: 'uncommon',
    water: [0xb0d8b8, 0x5f9e7f, 0x35705c], sand: 0xccb88a, sandDots: 0xb8a272,
    price: 16000, currency: 'coins', unlockLevel: 8, growthBonus: 2,
    desc: 'Köklerin arasında saklambaç oynayan balıklar.' },
  { id: 'tank-gelgit', name: 'Gelgit Havuzu', biome: 'tropik', rarity: 'uncommon',
    water: [0xc0ece0, 0x70bcb0, 0x428e92], sand: 0xe8d8b0, sandDots: 0xd4c294,
    price: 20000, currency: 'coins', unlockLevel: 9, growthBonus: 2,
    desc: 'Her gelgitte yenilenen minik bir dünya.' },
  { id: 'tank-inci-yataklari', name: 'İnci Yatakları', biome: 'lagun', rarity: 'uncommon',
    water: [0xc8e4ec, 0x74aec4, 0x467e9e], sand: 0xe4dcc4, sandDots: 0xd0c6a8,
    price: 26000, currency: 'coins', unlockLevel: 10, growthBonus: 2,
    desc: 'İstiridyelerin fısıldaştığı sedefli sular.' },
  { id: 'tank-firtina', name: 'Fırtına Burnu', biome: 'derin', rarity: 'uncommon',
    water: [0x8fb8c8, 0x4a7f9e, 0x27506e], sand: 0xc4b494, sandDots: 0xb09e7c,
    price: 33000, currency: 'coins', unlockLevel: 11, growthBonus: 2,
    desc: 'Cesur balıkların sınandığı dalgalı sular.' },
  // ---- Nadir ----
  { id: 'tank-batik-koyu', name: 'Batık Koyu', biome: 'derin', rarity: 'rare',
    water: [0x7fa8c0, 0x3f6f96, 0x1f4468], sand: 0xb8a888, sandDots: 0xa49270,
    price: 45000, currency: 'coins', unlockLevel: 12, growthBonus: 3,
    desc: 'Eski gemilerin hikâyelerini saklayan koy.' },
  { id: 'tank-magara', name: 'Kristal Mağara', biome: 'magara', rarity: 'rare',
    water: [0x8a9ec4, 0x4a5c92, 0x26305e], sand: 0x9a94a8, sandDots: 0x847e94,
    price: 60000, currency: 'coins', unlockLevel: 13, growthBonus: 3,
    desc: 'Tavanından kristaller sarkan gizli mağara.' },
  { id: 'tank-kanyon', name: 'Su Altı Kanyonu', biome: 'derin', rarity: 'rare',
    water: [0x7f9eb8, 0x3f6488, 0x1f3a58], sand: 0xac9c80, sandDots: 0x968668,
    price: 80000, currency: 'coins', unlockLevel: 14, growthBonus: 3,
    desc: 'Duvarları yankıyla dolu derin yarık.' },
  { id: 'tank-buzul', name: 'Buzul Kıyısı', biome: 'kutup', rarity: 'rare',
    water: [0xd0ecf4, 0x8ac0dc, 0x4a84ac], sand: 0xdce4ec, sandDots: 0xc4d0dc,
    price: 105000, currency: 'coins', unlockLevel: 15, growthBonus: 3,
    desc: 'Buz mavisi suların sessiz dünyası.' },
  { id: 'tank-gunbatimi', name: 'Gün Batımı Resifi', biome: 'gunbatimi', rarity: 'rare',
    water: [0xf7c8a0, 0xd08a84, 0x7a4a74], sand: 0xecc9a0, sandDots: 0xd8b288,
    price: 135000, currency: 'coins', unlockLevel: 16, growthBonus: 3,
    desc: 'Suyun altında bile gün batımı yaşanır.' },
  // ---- Epik ----
  { id: 'tank-abis', name: 'Abis Kapısı', biome: 'derin', rarity: 'epic',
    water: [0x5a7a9e, 0x2c4470, 0x101c3a], sand: 0x8a8090, sandDots: 0x746a7c,
    price: 175000, currency: 'coins', unlockLevel: 17, growthBonus: 5,
    desc: 'Işığın azaldığı, gizemin arttığı sınır.' },
  { id: 'tank-volkanik', name: 'Volkanik Yatak', biome: 'magara', rarity: 'epic',
    water: [0x9a8a8a, 0x5c4448, 0x2e1c22], sand: 0x6a5a56, sandDots: 0xd0603c,
    price: 220000, currency: 'coins', unlockLevel: 18, growthBonus: 5,
    desc: 'Sıcak kaynakların beslediği mineral cenneti.' },
  { id: 'tank-aysberg', name: 'Aysberg Altı', biome: 'kutup', rarity: 'epic',
    water: [0xe0f2f8, 0x9accdf, 0x5490b8], sand: 0xe8eef4, sandDots: 0xd0dce8,
    price: 270000, currency: 'coins', unlockLevel: 19, growthBonus: 5,
    desc: 'Dev buz dağının mavi gölgesinde.' },
  { id: 'tank-antik-sehir', name: 'Antik Şehir', biome: 'mistik', rarity: 'epic',
    water: [0x9ab8c8, 0x5a80a0, 0x2e4a6e], sand: 0xc8bca0, sandDots: 0xb0a488,
    price: 330000, currency: 'coins', unlockLevel: 20, growthBonus: 5,
    desc: 'Sütunları hâlâ ayakta duran kayıp şehir.' },
  { id: 'tank-biyolumin', name: 'Işıldayan Vadi', biome: 'mistik', rarity: 'epic',
    water: [0x6a8ab0, 0x3a5288, 0x181f4e], sand: 0x7c7490, sandDots: 0x9fe8ff,
    price: 400000, currency: 'coins', unlockLevel: 21, growthBonus: 5,
    desc: 'Her canlının kendi ışığını taşıdığı vadi.' },
  // ---- Efsanevi ----
  { id: 'tank-ay-lagunu', name: 'Ay Lagünü', biome: 'mistik', rarity: 'legendary',
    water: [0xc8d8f0, 0x8098cc, 0x3c4a8e], sand: 0xd8dcE8, sandDots: 0xc0c8dc,
    price: 120, currency: 'pearls', unlockLevel: 22, growthBonus: 8,
    desc: 'Ay ışığının hiç sönmediği efsanevi lagün.' },
  { id: 'tank-altin-saray', name: 'Altın Saray', biome: 'mistik', rarity: 'legendary',
    water: [0xf0dca8, 0xc9a85e, 0x8a6a2e], sand: 0xf0e0b0, sandDots: 0xe0c880,
    price: 160, currency: 'pearls', unlockLevel: 24, growthBonus: 8,
    desc: 'Batık bir imparatorluğun altın tahtı.' },
  { id: 'tank-hayalet-gemisi', name: 'Hayalet Gemisi', biome: 'derin', rarity: 'legendary',
    water: [0x8a9aa8, 0x4a5a70, 0x1e2838], sand: 0x9a948c, sandDots: 0x848078,
    price: 200, currency: 'pearls', unlockLevel: 26, growthBonus: 8,
    desc: 'Sisin içinden görünen, asla batmayan gemi.' },
  { id: 'tank-mercan-tahti', name: 'Mercan Tahtı', biome: 'tropik', rarity: 'legendary',
    water: [0xffd8cc, 0xf09a94, 0x9a4a6e], sand: 0xf7dfc0, sandDots: 0xecc8a0,
    price: 250, currency: 'pearls', unlockLevel: 28, growthBonus: 8,
    desc: 'Resif krallığının kalbi. Sadece efsanelere açık.' },
  { id: 'tank-sonsuzluk', name: 'Sonsuzluk Havuzu', biome: 'mistik', rarity: 'legendary',
    water: [0xb0e0f0, 0x6a9ed8, 0x2a3c9e], sand: 0xcfe0f0, sandDots: 0xb8d0e8,
    price: 320, currency: 'pearls', unlockLevel: 30, growthBonus: 10,
    desc: 'Ufku olmayan su. Reefy\'nin en büyük sırrı.' },
];

export function tankById(id: string): TankDef {
  const t = TANKS.find((x) => x.id === id);
  if (!t) throw new Error('unknown tank: ' + id);
  return t;
}
