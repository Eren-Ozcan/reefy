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
  spiky?: boolean;         // sırt dikenleri
  desc: string;
}

export const RARITY_INFO: Record<Rarity, { name: string; color: string; glow: number; order: number }> = {
  common:    { name: 'Yaygın',     color: '#9aa5ad', glow: 0xffffff, order: 0 },
  uncommon:  { name: 'Az Bulunur', color: '#57b26a', glow: 0x7de08f, order: 1 },
  rare:      { name: 'Nadir',      color: '#3f8fd6', glow: 0x6fb6f2, order: 2 },
  epic:      { name: 'Epik',       color: '#a05fd0', glow: 0xc78ff0, order: 3 },
  legendary: { name: 'Efsanevi',   color: '#e5a52e', glow: 0xffd76e, order: 4 },
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const MIN = 60_000;

// ---- El yapımı 14 tür (kayıt uyumluluğu için id'ler sabit) ----

const HANDMADE: Species[] = [
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

// ---- Üretilmiş 86 tür (deterministik — id'ler ve isimler her derlemede aynı) ----

interface Palette { adj: string; body: number; belly: number; fin: number; accent: number }

const PALETTES: Palette[] = [
  { adj: 'Mercan',    body: 0xff7e67, belly: 0xffc3b5, fin: 0xff9a85, accent: 0xfff1e8 },
  { adj: 'Safir',     body: 0x3f6fd6, belly: 0x9ab8f0, fin: 0x2f57b0, accent: 0xcfe0ff },
  { adj: 'Zümrüt',    body: 0x2fae7d, belly: 0x8fdcbc, fin: 0x22855f, accent: 0xd8f7e8 },
  { adj: 'Amber',     body: 0xe8a93c, belly: 0xf7d78f, fin: 0xc98a1f, accent: 0x8a5a1a },
  { adj: 'Lavanta',   body: 0xa98fd8, belly: 0xd6c8ef, fin: 0x8a6cc0, accent: 0xf0e8ff },
  { adj: 'Gülkurusu', body: 0xd88fa4, belly: 0xf0ccd7, fin: 0xc06f88, accent: 0xffffff },
  { adj: 'Turkuaz',   body: 0x36c3c9, belly: 0x9fe6e9, fin: 0x1f9aa0, accent: 0x0f6a6e },
  { adj: 'Gece',      body: 0x3c4670, belly: 0x6f7aa8, fin: 0x2a3252, accent: 0x9fb0e8 },
  { adj: 'Şafak',     body: 0xff9d6f, belly: 0xffd9c2, fin: 0xe87a4a, accent: 0xa84a8f },
  { adj: 'Nar',       body: 0xd6455c, belly: 0xef9dab, fin: 0xb03248, accent: 0xffdfe5 },
  { adj: 'Buz',       body: 0xa8dcef, belly: 0xe4f6fc, fin: 0x7fc3e0, accent: 0x4a90b8 },
  { adj: 'Bakır',     body: 0xc47a4a, belly: 0xe8b48c, fin: 0xa05c30, accent: 0x6f3d1c },
  { adj: 'Yosun',     body: 0x7da84a, belly: 0xbcd898, fin: 0x5c8530, accent: 0x3a5c1c },
  { adj: 'Sis',       body: 0xb0bcc4, belly: 0xdfe6ea, fin: 0x8f9ea8, accent: 0x5c6a74 },
  { adj: 'Alev',      body: 0xf25c30, belly: 0xffb090, fin: 0xd0431c, accent: 0xffe27a },
  { adj: 'Orkide',    body: 0xc45cc9, belly: 0xe6aae9, fin: 0xa03fa5, accent: 0xffffff },
  { adj: 'Kehribar',  body: 0xd9963c, belly: 0xf2cf9a, fin: 0xb87a26, accent: 0x7a4d12 },
  { adj: 'Okyanus',   body: 0x2f7fb8, belly: 0x8fc0e0, fin: 0x1f5f8f, accent: 0xdff2ff },
  { adj: 'Fulya',     body: 0xf2d049, belly: 0xfae9a8, fin: 0xd9b52e, accent: 0x8f7615 },
  { adj: 'Vişne',     body: 0x9e3548, belly: 0xd07d8d, fin: 0x7c2536, accent: 0xf2c3cc },
  { adj: 'Menekşe',   body: 0x6a5cc9, belly: 0xb0a8e8, fin: 0x4f43a5, accent: 0xe8e4ff },
  { adj: 'Çağla',     body: 0x9fd86f, belly: 0xd4f0b8, fin: 0x7fb84f, accent: 0x4f7a2a },
];

interface Archetype {
  noun: string;
  pattern: Species['pattern'];
  bodyH?: number;
  finScale?: number;
  spiky?: boolean;
  size: number;
}

const ARCHETYPES: Archetype[] = [
  { noun: 'Tetra',     pattern: 'hstripe',  size: 40 },
  { noun: 'Çiklit',    pattern: 'stripes',  size: 52 },
  { noun: 'Gurami',    pattern: 'none',     size: 50, finScale: 1.3 },
  { noun: 'Kelebek',   pattern: 'gradient', size: 48, bodyH: 0.72, finScale: 1.4 },
  { noun: 'Cerrah',    pattern: 'none',     size: 54, bodyH: 0.62 },
  { noun: 'Kaplan',    pattern: 'stripes',  size: 46 },
  { noun: 'Yüzgeçli',  pattern: 'gradient', size: 50, finScale: 1.8 },
  { noun: 'Benekli',   pattern: 'spots',    size: 48 },
  { noun: 'Diken',     pattern: 'stripes',  size: 56, spiky: true, finScale: 1.3 },
  { noun: 'Ay',        pattern: 'none',     size: 58, bodyH: 0.9, finScale: 1.2 },
  { noun: 'Yelken',    pattern: 'hstripe',  size: 52, finScale: 1.6 },
  { noun: 'İmparator', pattern: 'spots',    size: 60, bodyH: 0.7 },
];

const RARITY_PLAN: { r: Rarity; count: number; buy: [number, number]; grow: [number, number]; lvl: [number, number] }[] = [
  { r: 'common',    count: 27, buy: [50, 650],      grow: [2, 6],   lvl: [1, 4] },
  { r: 'uncommon',  count: 22, buy: [280, 2200],    grow: [5, 11],  lvl: [2, 8] },
  { r: 'rare',      count: 17, buy: [1100, 6500],   grow: [12, 20], lvl: [5, 12] },
  { r: 'epic',      count: 12, buy: [4200, 12500],  grow: [22, 38], lvl: [8, 16] },
  { r: 'legendary', count: 8,  buy: [15000, 42000], grow: [45, 75], lvl: [12, 20] },
];

const DESC_BY_RARITY: Record<Rarity, string[]> = {
  common: ['Resifin çalışkan sakini.', 'Sade ama sevimli bir dost.', 'Her akvaryuma yakışır.'],
  uncommon: ['Dikkatli gözlerin fark ettiği bir güzellik.', 'Renkleriyle suya neşe katar.', 'Az bulunur, çok sevilir.'],
  rare: ['Koleksiyoncuların gözdesi.', 'Suda süzülen bir mücevher.', 'Onu görmek şans işaretidir.'],
  epic: ['Derinliklerden gelen bir efsane adayı.', 'Renkleri gerçeküstü, huyu asil.', 'Akvaryumun yıldızı olmaya doğdu.'],
  legendary: ['Sadece en sabırlı bakıcılara görünür.', 'Hakkında şarkılar yazılan balık.', 'Okyanusun yaşayan efsanesi.'],
};

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function lighten(c: number, f: number): number {
  const r = Math.min(255, ((c >> 16) & 255) + Math.round(255 * f));
  const g = Math.min(255, ((c >> 8) & 255) + Math.round(255 * f));
  const b = Math.min(255, (c & 255) + Math.round(255 * f));
  return (r << 16) | (g << 8) | b;
}

function generate(): Species[] {
  const out: Species[] = [];
  const usedNames = new Set(HANDMADE.map((s) => s.name));
  const rnd = mulberry(20260710);
  let gi = 0;
  for (const plan of RARITY_PLAN) {
    for (let i = 0; i < plan.count; i++) {
      gi++;
      let pal: Palette = PALETTES[0];
      let arch: Archetype = ARCHETYPES[0];
      let name = '';
      let guard = 0;
      do {
        pal = PALETTES[Math.floor(rnd() * PALETTES.length)];
        arch = ARCHETYPES[Math.floor(rnd() * ARCHETYPES.length)];
        name = `${pal.adj} ${arch.noun}`;
        guard++;
      } while (usedNames.has(name) && guard < 80);
      usedNames.add(name);

      const t = plan.count === 1 ? 0 : i / (plan.count - 1);
      const buy = Math.round((plan.buy[0] + (plan.buy[1] - plan.buy[0]) * t) / 10) * 10;
      const growMin = Math.round(plan.grow[0] + (plan.grow[1] - plan.grow[0]) * t);
      const lvl = Math.round(plan.lvl[0] + (plan.lvl[1] - plan.lvl[0]) * t);
      const descs = DESC_BY_RARITY[plan.r];

      // Efsanevilerin üçte biri yalnızca inciyle alınır
      const pearlOnly = plan.r === 'legendary' && i % 3 === 2;

      out.push({
        id: `gen-${plan.r}-${gi}`,
        name,
        rarity: plan.r,
        colors: {
          body: pal.body,
          belly: pal.belly,
          fin: pal.fin,
          accent: i % 4 === 3 ? lighten(pal.accent, 0.1) : pal.accent,
        },
        pattern: arch.pattern,
        buyPrice: pearlOnly ? 0 : buy,
        pearlPrice: pearlOnly ? 50 + i * 10 : undefined,
        sellPrice: pearlOnly ? 48000 + i * 4000 : Math.round(buy * (2.2 + rnd() * 0.3)),
        growthMs: growMin * MIN,
        unlockLevel: lvl,
        size: arch.size + Math.round((rnd() - 0.5) * 8),
        bodyH: arch.bodyH,
        finScale: arch.finScale,
        spiky: arch.spiky,
        desc: descs[gi % descs.length],
      });
    }
  }
  return out;
}

export const SPECIES: Species[] = [...HANDMADE, ...generate()];

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
    desc: 'Efsaneler bu yumurtadan doğar. Her 8. yumurtada efsanevi garanti!',
  },
];

export const PITY_LIMIT = 8; // Altın yumurtada efsanevi garanti sayacı

/** Yetişkin balığın saatlik pasif altın üretimi (nadirliğe göre). */
export const RARITY_INCOME: Record<Rarity, number> = {
  common: 25,
  uncommon: 60,
  rare: 150,
  epic: 400,
  legendary: 1000,
};

export const FISH_NAMES = [
  'Baloncuk', 'Mercan', 'Şanslı', 'Fıstık', 'Zeytin', 'Bulut', 'Damla',
  'Yakut', 'Sedef', 'Limon', 'Karamel', 'Pati', 'Fındık', 'Yıldız',
  'Pamuk', 'Biber', 'Çakıl', 'Petek', 'Mısır', 'Lokum',
];
