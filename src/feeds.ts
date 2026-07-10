// Yem türleri: elle atılır (her dokunuş bir tane), kaliteli yemler
// balığın yetişkin satış fiyatına kalıcı bonus ekleme şansı taşır.

export interface FeedDef {
  id: string;
  name: string;
  emoji: string;
  cost: number;         // tane başına altın (0 = ücretsiz)
  hunger: number;       // tokluk artışı
  bonusChance: number;  // her yiyişte satış bonusu kazanma olasılığı (0..1)
  bonusAmount: number;  // kazanılan bonus (satış fiyatının oranı)
  color: number;        // yem tanesi rengi
  color2: number;       // parlama rengi
  desc: string;
}

export const FEEDS: FeedDef[] = [
  {
    id: 'standart', name: 'Standart Yem', emoji: '🍤', cost: 0,
    hunger: 0.35, bonusChance: 0, bonusAmount: 0,
    color: 0xc98a4b, color2: 0xe8b078,
    desc: 'Ücretsiz, doyurucu. Bonus vermez.',
  },
  {
    id: 'lezzet', name: 'Lezzet Yemi', emoji: '🦐', cost: 8,
    hunger: 0.4, bonusChance: 0.15, bonusAmount: 0.03,
    color: 0xe86a5e, color2: 0xffb0a0,
    desc: '%15 şansla satış fiyatına +%3 ekler.',
  },
  {
    id: 'altin', name: 'Altın Yem', emoji: '✨', cost: 40,
    hunger: 0.45, bonusChance: 0.3, bonusAmount: 0.06,
    color: 0xf0c040, color2: 0xffe9a0,
    desc: '%30 şansla satış fiyatına +%6 ekler.',
  },
];

export function feedById(id: string): FeedDef {
  return FEEDS.find((f) => f.id === id) ?? FEEDS[0];
}

/** Bir balığın yemle biriktirebileceği en yüksek satış bonusu. */
export const FISH_BONUS_CAP = 0.6;
