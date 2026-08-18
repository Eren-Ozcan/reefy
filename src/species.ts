export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Species {
  id: string;
  name: string;
  rarity: Rarity;
  colors: { body: number; belly: number; fin: number; accent: number };
  pattern: 'none' | 'stripes' | 'hstripe' | 'spots' | 'gradient';
  buyPrice: number;        // 0 => not purchasable with coins
  pearlPrice?: number;     // purchase with pearls
  sellPrice: number;       // adult sale price
  growthMs: number;        // baby -> adult duration
  unlockLevel: number;
  size: number;            // adult body length (px)
  bodyH?: number;          // body height ratio (default 0.48)
  finScale?: number;       // fin size multiplier
  spiky?: boolean;         // dorsal spikes
  tailShape?: 'lens' | 'forked' | 'round' | 'lyre' | 'ribbon' | 'lunate'; // tail shape (default 'lens')
  dorsalStyle?: 'triangle' | 'flowing' | 'sail'; // dorsal fin shape (default 'triangle')
  snout?: 'long' | 'hump' | 'blunt'; // snout/forehead protrusion (default none)
  desc: string;
}

export const RARITY_INFO: Record<Rarity, { name: string; color: string; glow: number; order: number }> = {
  common:    { name: 'Common',     color: '#9aa5ad', glow: 0xffffff, order: 0 },
  uncommon:  { name: 'Uncommon', color: '#57b26a', glow: 0x7de08f, order: 1 },
  rare:      { name: 'Rare',      color: '#3f8fd6', glow: 0x6fb6f2, order: 2 },
  epic:      { name: 'Epic',       color: '#a05fd0', glow: 0xc78ff0, order: 3 },
  legendary: { name: 'Legendary',   color: '#e5a52e', glow: 0xffd76e, order: 4 },
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const MIN = 60_000;

// ---- 14 handmade species (ids fixed for save compatibility) ----

const HANDMADE: Species[] = [
  {
    id: 'lepistes', name: 'Guppy', rarity: 'common',
    colors: { body: 0xff9e5e, belly: 0xffd9a8, fin: 0xffb02e, accent: 0xff6f61 },
    pattern: 'none', buyPrice: 40, sellPrice: 95, growthMs: 2 * MIN,
    unlockLevel: 1, size: 46, finScale: 1.35, tailShape: 'lyre',
    desc: "Cheerful and hardy. Every reef's first resident.",
  },
  {
    id: 'neon-tetra', name: 'Neon Tetra', rarity: 'common',
    colors: { body: 0x5ec8ff, belly: 0xdff6ff, fin: 0x8fd8ff, accent: 0xff5e6c },
    pattern: 'hstripe', buyPrice: 65, sellPrice: 150, growthMs: 2.5 * MIN,
    unlockLevel: 1, size: 40, tailShape: 'forked',
    desc: 'Famous for the red stripe that glows even in the dark.',
  },
  {
    id: 'moli', name: 'Black Molly', rarity: 'common',
    colors: { body: 0x3a3f52, belly: 0x596077, fin: 0x2c3040, accent: 0x596077 },
    pattern: 'none', buyPrice: 90, sellPrice: 210, growthMs: 3 * MIN,
    unlockLevel: 2, size: 44, tailShape: 'round',
    desc: 'Calm, elegant, and black as night.',
  },
  {
    id: 'palyaco', name: 'Clownfish', rarity: 'uncommon',
    colors: { body: 0xff8a3d, belly: 0xffb37d, fin: 0xff9d55, accent: 0xffffff },
    pattern: 'stripes', buyPrice: 220, sellPrice: 520, growthMs: 5 * MIN,
    unlockLevel: 2, size: 50, tailShape: 'round',
    desc: "The anemone's most charming neighbor.",
  },
  {
    id: 'melek', name: 'Angelfish', rarity: 'uncommon',
    colors: { body: 0xcfd8e3, belly: 0xf0f4f8, fin: 0xf7c948, accent: 0x3d4a5c },
    pattern: 'stripes', buyPrice: 340, sellPrice: 800, growthMs: 7 * MIN,
    unlockLevel: 3, size: 52, bodyH: 0.8, finScale: 1.5, tailShape: 'round', dorsalStyle: 'flowing',
    desc: 'Elegance gliding through the water on long fins.',
  },
  {
    id: 'zebra-ciklit', name: 'Zebra Cichlid', rarity: 'uncommon',
    colors: { body: 0x6fa8dc, belly: 0xa8c8ea, fin: 0x5b8fc7, accent: 0x2f4d6e },
    pattern: 'stripes', buyPrice: 480, sellPrice: 1150, growthMs: 9 * MIN,
    unlockLevel: 4, size: 54, tailShape: 'round',
    desc: 'A personality as bold as its stripes.',
  },
  {
    id: 'beta', name: 'Betta', rarity: 'rare',
    colors: { body: 0x9b59d0, belly: 0xc39bdf, fin: 0xe05297, accent: 0x6f3bb5 },
    pattern: 'gradient', buyPrice: 950, sellPrice: 2300, growthMs: 12 * MIN,
    unlockLevel: 5, size: 50, finScale: 1.9, tailShape: 'ribbon', dorsalStyle: 'flowing',
    desc: 'A warrior that dances through the water on silky fins.',
  },
  {
    id: 'kral-gramma', name: 'Royal Gramma', rarity: 'rare',
    colors: { body: 0xffd23e, belly: 0xffe58a, fin: 0xb14ecf, accent: 0x8e3fd1 },
    pattern: 'gradient', buyPrice: 1400, sellPrice: 3300, growthMs: 15 * MIN,
    unlockLevel: 6, size: 48, tailShape: 'forked',
    desc: "Half purple, half gold: nature's boldest color experiment.",
  },
  {
    id: 'aslan', name: 'Lionfish', rarity: 'rare',
    colors: { body: 0xe0574f, belly: 0xf2b3ae, fin: 0xd94840, accent: 0xfff1e8 },
    pattern: 'stripes', buyPrice: 1900, sellPrice: 4500, growthMs: 18 * MIN,
    unlockLevel: 7, size: 58, spiky: true, finScale: 1.4, tailShape: 'round', dorsalStyle: 'sail',
    desc: "The reef's proud king, crowned with spines.",
  },
  {
    id: 'mandarin', name: 'Mandarinfish', rarity: 'epic',
    colors: { body: 0x2e8fd8, belly: 0x5fb3ea, fin: 0xff9d2e, accent: 0xff7043 },
    pattern: 'spots', buyPrice: 3800, sellPrice: 8900, growthMs: 25 * MIN,
    unlockLevel: 8, size: 52, tailShape: 'round',
    desc: "The ocean's most colorful canvas.",
  },
  {
    id: 'koi', name: 'Koi', rarity: 'epic',
    colors: { body: 0xf7f3ee, belly: 0xffffff, fin: 0xf2e8dd, accent: 0xff7043 },
    pattern: 'spots', buyPrice: 5500, sellPrice: 12800, growthMs: 30 * MIN,
    unlockLevel: 9, size: 64, tailShape: 'round',
    desc: 'The fish of luck, patience, and peace.',
  },
  {
    id: 'diskus', name: 'Discus', rarity: 'epic',
    colors: { body: 0x40c4b0, belly: 0x7fdccf, fin: 0x2ea896, accent: 0xe25856 },
    pattern: 'spots', buyPrice: 7500, sellPrice: 17500, growthMs: 35 * MIN,
    unlockLevel: 10, size: 56, bodyH: 0.85, tailShape: 'round',
    desc: "The aquarium world's turquoise jewel.",
  },
  {
    id: 'altin-arowana', name: 'Golden Arowana', rarity: 'legendary',
    colors: { body: 0xf5c542, belly: 0xffe9a8, fin: 0xe8ae1f, accent: 0xffefb0 },
    pattern: 'none', buyPrice: 16000, sellPrice: 39000, growthMs: 45 * MIN,
    unlockLevel: 12, size: 78, finScale: 1.1, tailShape: 'round', dorsalStyle: 'flowing',
    desc: 'A living gold bar. Legends speak of it.',
  },
  {
    id: 'inci', name: 'Pearl Fish', rarity: 'legendary',
    colors: { body: 0x9fe8ff, belly: 0xe8fbff, fin: 0xc9f2ff, accent: 0xffffff },
    pattern: 'spots', buyPrice: 0, pearlPrice: 60, sellPrice: 52000, growthMs: 60 * MIN,
    unlockLevel: 1, size: 60, finScale: 1.5, tailShape: 'round', dorsalStyle: 'flowing',
    desc: 'A shimmering secret summoned only by pearls.',
  },
];

// ---- 86 fish from real species (deterministic — ids and names identical on every build) ----

interface SpeciesSeed {
  name: string;
  colors: { body: number; belly: number; fin: number; accent: number };
  pattern: Species['pattern'];
  size: number;
  bodyH?: number;
  finScale?: number;
  spiky?: boolean;
  tailShape?: Species['tailShape'];
  dorsalStyle?: Species['dorsalStyle'];
  snout?: Species['snout'];
  desc: string;
}

const REAL_SPECIES: Record<Rarity, SpeciesSeed[]> = {
  common: [
    { name: 'Zebra Danio', pattern: 'stripes', size: 36, tailShape: 'forked',
      colors: { body: 0xc9d3da, belly: 0xeef2f5, fin: 0x3a5f8a, accent: 0x1f3a5c },
      desc: 'An active, hardy freshwater fish known for its horizontal stripes.' },
    { name: 'Platy', pattern: 'none', size: 38, tailShape: 'round',
      colors: { body: 0xff7a4a, belly: 0xffd2b8, fin: 0xff9d6a, accent: 0xc94a1f },
      desc: 'An easy-care, livebearing freshwater fish full of cheer.' },
    { name: 'Swordtail', pattern: 'none', size: 44, finScale: 1.2, tailShape: 'lyre',
      colors: { body: 0x7ab86a, belly: 0xd6f0c8, fin: 0x4a8f4a, accent: 0xff6b3d },
      desc: 'Known for the sword-shaped tail on its males.' },
    { name: 'Cherry Barb', pattern: 'none', size: 36, tailShape: 'forked',
      colors: { body: 0xd6403f, belly: 0xf2a8a0, fin: 0xb8302f, accent: 0xffffff },
      desc: 'A cherry-red barb that loves swimming in small schools.' },
    { name: 'Tiger Barb', pattern: 'stripes', size: 38, tailShape: 'forked',
      colors: { body: 0xf2a13c, belly: 0xffd9a0, fin: 0xd9401f, accent: 0x2a2a2a },
      desc: 'An energetic species that brings life to the tank with its tiger stripes.' },
    { name: 'White Cloud Mountain Minnow', pattern: 'hstripe', size: 32, tailShape: 'forked',
      colors: { body: 0xb8c9a0, belly: 0xe8f0d8, fin: 0xd6403f, accent: 0xf2d049 },
      desc: 'A tiny resident of mountain streams that can even tolerate cold water.' },
    { name: 'Harlequin Rasbora', pattern: 'spots', size: 34, tailShape: 'forked',
      colors: { body: 0xe89a5c, belly: 0xf5cfa0, fin: 0xd97f3f, accent: 0x2a2a2a },
      desc: 'Known for its copper body and black triangular patch.' },
    { name: 'Corydoras', pattern: 'spots', size: 34, bodyH: 0.55, tailShape: 'round',
      colors: { body: 0x8a7a5c, belly: 0xd8cfa8, fin: 0x6f6047, accent: 0xb0a37a },
      desc: 'An adorable whiskered catfish that keeps the tank floor clean.' },
    { name: 'Bristlenose Pleco', pattern: 'spots', size: 46, bodyH: 0.5, spiky: true, tailShape: 'round',
      colors: { body: 0x4a3f30, belly: 0x7a6c52, fin: 0x2f2a20, accent: 0x8a7a5c },
      desc: 'An algae-eating catfish with bristly whisker-like growths.' },
    { name: "Endler's Livebearer", pattern: 'spots', size: 30, tailShape: 'lyre',
      colors: { body: 0xff9d2e, belly: 0xffe0a0, fin: 0x2fae7d, accent: 0x1f1f1f },
      desc: "The guppy's small, colorful cousin." },
    { name: 'Dalmatian Molly', pattern: 'spots', size: 46, tailShape: 'round',
      colors: { body: 0xeef2f5, belly: 0xffffff, fin: 0xd8dee2, accent: 0x2a2a2a },
      desc: 'Resembles a dalmatian dog with black spots on its white body.' },
    { name: 'Sailfin Molly', pattern: 'spots', size: 50, finScale: 1.6, tailShape: 'round', dorsalStyle: 'sail',
      colors: { body: 0x5c7a8a, belly: 0xa8c3cf, fin: 0x3a5666, accent: 0xf2d049 },
      desc: 'Stands out with a large, sail-like dorsal fin.' },
    { name: 'Rosy Barb', pattern: 'none', size: 40, tailShape: 'forked',
      colors: { body: 0xe0708a, belly: 0xf5c3d0, fin: 0xc7506a, accent: 0xffffff },
      desc: 'Adds elegance to the tank with rosy-pink tones.' },
    { name: 'Redfin Tetra', pattern: 'none', size: 36, tailShape: 'forked',
      colors: { body: 0xc7d3da, belly: 0xeef2f5, fin: 0xd6403f, accent: 0xff6f61 },
      desc: 'Creates a striking contrast between its red fins and silver body.' },
    { name: 'Serpae Tetra', pattern: 'none', size: 34, tailShape: 'forked',
      colors: { body: 0xc7343f, belly: 0xe89aa0, fin: 0x8a1f2a, accent: 0x1a1a1a },
      desc: 'Known for its deep red color and black-edged fins.' },
    { name: 'Black Skirt Tetra', pattern: 'none', size: 38, finScale: 1.3, tailShape: 'forked', dorsalStyle: 'flowing',
      colors: { body: 0x8a939c, belly: 0xc7cfd6, fin: 0x2a2a2a, accent: 0x4a525c },
      desc: 'An elegant tetra with fins resembling a long black skirt.' },
    { name: 'Glowlight Tetra', pattern: 'hstripe', size: 32, tailShape: 'forked',
      colors: { body: 0xd9765c, belly: 0xf2c3ab, fin: 0xc75f42, accent: 0xff9d2e },
      desc: 'Carries a glowing orange stripe along its side.' },
    { name: 'Kuhli Loach', pattern: 'stripes', size: 42, bodyH: 0.35, tailShape: 'round',
      colors: { body: 0xe0a13c, belly: 0xf2d29a, fin: 0xc7852e, accent: 0x2a1f14 },
      desc: 'A banded loach that swims with snake-like curves.' },
    { name: 'Otocinclus', pattern: 'hstripe', size: 28, tailShape: 'round',
      colors: { body: 0x9a8a6c, belly: 0xd8cfa8, fin: 0x7a6c52, accent: 0x3a3020 },
      desc: 'A tiny catfish that cleans glass algae.' },
    { name: 'Zebra Loach', pattern: 'stripes', size: 40, tailShape: 'forked',
      colors: { body: 0xf2e9d0, belly: 0xfff6e0, fin: 0xd9cba0, accent: 0x2a2a2a },
      desc: 'Carries a zebra pattern of black-and-white bands.' },
    { name: 'Buenos Aires Tetra', pattern: 'hstripe', size: 40, tailShape: 'forked',
      colors: { body: 0xc7cfd6, belly: 0xeef2f5, fin: 0xd6403f, accent: 0x2a2a2a },
      desc: 'A beginner favorite thanks to its hardy nature.' },
    { name: 'Paradise Fish', pattern: 'stripes', size: 46, finScale: 1.4, tailShape: 'lyre', dorsalStyle: 'flowing',
      colors: { body: 0x3a6ea8, belly: 0x8fb8dc, fin: 0xd6403f, accent: 0xf2d049 },
      desc: "The tank's paradise, with long fins and vivid colors." },
    { name: 'Fantail Goldfish', pattern: 'none', size: 48, bodyH: 0.75, finScale: 1.5, tailShape: 'lyre',
      colors: { body: 0xf2703c, belly: 0xffc79a, fin: 0xd9502a, accent: 0xffffff },
      desc: 'A classic goldfish with a round body and double tail.' },
    { name: 'Comet Goldfish', pattern: 'none', size: 50, finScale: 1.6, tailShape: 'ribbon',
      colors: { body: 0xf28a3c, belly: 0xffe0b0, fin: 0xffffff, accent: 0xd9702a },
      desc: 'A fast-swimming goldfish variety with a long single tail fin.' },
    { name: 'Shubunkin', pattern: 'spots', size: 48, bodyH: 0.68, tailShape: 'lyre',
      colors: { body: 0x6a8fb8, belly: 0xd0dde8, fin: 0xf28a3c, accent: 0x2a2a2a },
      desc: 'A one-of-a-kind goldfish with a mottled blue-orange pattern.' },
    { name: 'Threadfin Rainbowfish', pattern: 'none', size: 36, finScale: 1.7, tailShape: 'forked', dorsalStyle: 'flowing',
      colors: { body: 0xf2c33c, belly: 0xffe9a0, fin: 0xd6403f, accent: 0xffffff },
      desc: 'An elegant rainbowfish with long, thread-like fins.' },
    { name: 'Panda Corydoras', pattern: 'spots', size: 32, bodyH: 0.55, tailShape: 'round',
      colors: { body: 0xf0e6d0, belly: 0xfff8ea, fin: 0xd9cba0, accent: 0x1f1f1f },
      desc: 'An adorable catfish with a black-and-white panda pattern.' },
  ],
  uncommon: [
    { name: 'Rummynose Tetra', pattern: 'stripes', size: 36, tailShape: 'forked',
      colors: { body: 0xc7cfd6, belly: 0xeef2f5, fin: 0x2a2a2a, accent: 0xd6403f },
      desc: 'Easily recognized by its red nose and banded tail.' },
    { name: 'Congo Tetra', pattern: 'gradient', size: 48, finScale: 1.3, tailShape: 'lyre',
      colors: { body: 0x3fae9a, belly: 0xf2c33c, fin: 0xd6403f, accent: 0x6a5cc9 },
      desc: 'Dazzles with a metallic blue-gold shimmer.' },
    { name: 'Boesemani Rainbowfish', pattern: 'gradient', size: 50, tailShape: 'forked',
      colors: { body: 0x3a6ea8, belly: 0x8fb8dc, fin: 0xf2703c, accent: 0xd9502a },
      desc: 'A vivid rainbowfish, blue in front and orange behind.' },
    { name: 'Celestial Pearl Danio', pattern: 'spots', size: 22, tailShape: 'forked',
      colors: { body: 0x2a3a5c, belly: 0x5c7aa0, fin: 0xd6403f, accent: 0xf2d049 },
      desc: 'Famous for the pearl-like spots on its navy body.' },
    { name: 'Firemouth Cichlid', pattern: 'gradient', size: 52, tailShape: 'round',
      colors: { body: 0x8a8f9a, belly: 0xd6403f, fin: 0x5c6270, accent: 0xf2703c },
      desc: 'A cichlid named for its fiery red-orange throat.' },
    { name: 'Jack Dempsey Cichlid', pattern: 'spots', size: 58, tailShape: 'round',
      colors: { body: 0x4a3f4a, belly: 0x6f5c6f, fin: 0x2f2530, accent: 0x4fd8c9 },
      desc: 'Striking, with glittering turquoise flecks over a dark body.' },
    { name: 'Kribensis Cichlid', pattern: 'none', size: 40, tailShape: 'round',
      colors: { body: 0x7a8a5c, belly: 0xd6405c, fin: 0x5c6a3a, accent: 0xf2d049 },
      desc: 'A popular cichlid known for its pink belly and strong parenting instinct.' },
    { name: 'Pearl Gourami', pattern: 'spots', size: 48, finScale: 1.3, tailShape: 'lyre', dorsalStyle: 'flowing',
      colors: { body: 0x9a8a7a, belly: 0xd8cfc0, fin: 0xd6706a, accent: 0xf2e9d0 },
      desc: 'An elegant gourami with pearl-patterned scales.' },
    { name: 'Dwarf Gourami', pattern: 'stripes', size: 36, finScale: 1.2, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0x4a7ec9, belly: 0x9ac3ef, fin: 0xe0503f, accent: 0xffb830 },
      desc: 'Small in size but bold in its vivid blue-and-red stripes.' },
    { name: 'Honey Gourami', pattern: 'none', size: 34, finScale: 1.2, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0xf2a13c, belly: 0xffd9a0, fin: 0xd97f24, accent: 0x8a5a1a },
      desc: 'A peaceful species with a bright, honey-orange body.' },
    { name: 'Bumblebee Goby', pattern: 'stripes', size: 20, tailShape: 'round',
      colors: { body: 0xf2d049, belly: 0xfff2b0, fin: 0x2a2a2a, accent: 0x1a1a1a },
      desc: 'A tiny goby with bee-like yellow-and-black bands.' },
    { name: 'Silver Dollar Fish', pattern: 'none', size: 44, bodyH: 0.8, tailShape: 'round',
      colors: { body: 0xcfd8e0, belly: 0xf0f4f8, fin: 0xb8c3cc, accent: 0x8fa0ac },
      desc: 'Its flat, round body resembles a silver coin.' },
    { name: 'Rainbow Shark', pattern: 'none', size: 52, bodyH: 0.55, tailShape: 'forked', dorsalStyle: 'sail',
      colors: { body: 0x3a3a3a, belly: 0x5c5c5c, fin: 0xd6403f, accent: 0x1a1a1a },
      desc: 'A peaceful, shark-shaped species with red fins.' },
    { name: 'Red-Tailed Black Shark', pattern: 'none', size: 50, bodyH: 0.55, tailShape: 'forked', dorsalStyle: 'sail',
      colors: { body: 0x1f1f1f, belly: 0x3a3a3a, fin: 0xd6403f, accent: 0x0a0a0a },
      desc: 'Known for its jet-black body and flame-red tail.' },
    { name: 'Clown Loach', pattern: 'stripes', size: 46, tailShape: 'forked',
      colors: { body: 0xf2703c, belly: 0xffc79a, fin: 0xd9502a, accent: 0x1a1a1a },
      desc: "The tank's playful clown, with orange-and-black bands." },
    { name: 'Yoyo Loach', pattern: 'spots', size: 42, tailShape: 'forked',
      colors: { body: 0xd8dee2, belly: 0xf0f4f8, fin: 0xb8c3cc, accent: 0x2a2a2a },
      desc: 'Named for the Y- and X-shaped markings on its back.' },
    { name: 'Blue Gourami', pattern: 'spots', size: 50, finScale: 1.2, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0x3a7ea8, belly: 0x8fc0dc, fin: 0x2a5c80, accent: 0x1a1a1a },
      desc: 'Glides through calm waters with a powder-blue body.' },
    { name: 'Threadfin Acara', pattern: 'spots', size: 46, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0x2fae9a, belly: 0x8fdcc9, fin: 0xf2d049, accent: 0xd6403f },
      desc: 'A small cichlid jewel with turquoise-gold shimmering scales.' },
    { name: 'Electric Blue Ram', pattern: 'gradient', size: 30, finScale: 1.3, tailShape: 'round',
      colors: { body: 0x2f7fd6, belly: 0x8fbeef, fin: 0x1f5fb0, accent: 0xf2d049 },
      desc: 'Famous for an intense electric-blue color rarely seen in nature.' },
    { name: 'Bolivian Ram', pattern: 'hstripe', size: 32, finScale: 1.2, tailShape: 'round',
      colors: { body: 0xd9b96a, belly: 0xf2e0b0, fin: 0x8a7a5c, accent: 0x2a2a2a },
      desc: 'A calm-tempered cichlid with a black stripe through its eye.' },
    { name: 'Neon Rainbowfish', pattern: 'gradient', size: 34, tailShape: 'forked',
      colors: { body: 0x3fae9a, belly: 0x8fdcc9, fin: 0x2f8f7d, accent: 0xd6d049 },
      desc: 'Lights up the tank with a metallic turquoise-green shimmer.' },
    { name: 'Yellowtail Blue Damsel', pattern: 'gradient', size: 34, tailShape: 'forked',
      colors: { body: 0x1f3a6a, belly: 0x3a5c8a, fin: 0xf2d049, accent: 0x0a1a3a },
      desc: 'A reef dweller with a deep blue body and bright yellow tail.' },
  ],
  rare: [
    { name: 'Flowerhorn Cichlid', pattern: 'spots', size: 56, bodyH: 0.65, tailShape: 'round', snout: 'hump',
      colors: { body: 0xd6405c, belly: 0xf2a0b0, fin: 0xb8304a, accent: 0xf2d049 },
      desc: 'A special hybrid cichlid with a pronounced forehead hump and vivid pink color.' },
    { name: 'Peacock Bass', pattern: 'stripes', size: 64, bodyH: 0.56, tailShape: 'round',
      colors: { body: 0x8a9a4a, belly: 0xd8e0a8, fin: 0x5c6a2a, accent: 0x1a1a1a },
      desc: 'A river predator with a powerful build and an eyespot on its tail.' },
    { name: 'Green Terror Cichlid', pattern: 'spots', size: 54, bodyH: 0.58, tailShape: 'round',
      colors: { body: 0x2fae7d, belly: 0x8fdcbc, fin: 0xf2703c, accent: 0xd9502a },
      desc: 'Despite its name, it brings a stunning turquoise-green shimmer to the tank.' },
    { name: 'Oscar Fish', pattern: 'spots', size: 62, bodyH: 0.6, tailShape: 'round',
      colors: { body: 0x5c3a2a, belly: 0x8a6048, fin: 0x3a241a, accent: 0xd6703f },
      desc: 'A hobbyist favorite for its intelligence and interactive nature.' },
    { name: 'Severum Cichlid', pattern: 'stripes', size: 50, bodyH: 0.68, tailShape: 'round',
      colors: { body: 0x9a8a3a, belly: 0xd8cf8f, fin: 0x6f6020, accent: 0x4a3f1a },
      desc: 'A calm, large cichlid in gold-green tones.' },
    { name: 'Uaru Cichlid', pattern: 'spots', size: 52, bodyH: 0.6, tailShape: 'round',
      colors: { body: 0x6a4a3a, belly: 0x9a7a5c, fin: 0x4a3020, accent: 0x1a1a1a },
      desc: 'Stands out as a juvenile with chocolate-brown blotches.' },
    { name: 'Blue Acara', pattern: 'spots', size: 48, bodyH: 0.54, tailShape: 'round',
      colors: { body: 0x2f8f9a, belly: 0x8fd0d8, fin: 0x1f6a75, accent: 0xf2d049 },
      desc: "South America's elegant cichlid, with turquoise-shimmering scales." },
    { name: 'Texas Cichlid', pattern: 'spots', size: 50, bodyH: 0.6, tailShape: 'round',
      colors: { body: 0x3a8a9a, belly: 0x8fc9d6, fin: 0x2a6070, accent: 0xf2d049 },
      desc: 'Known for pearl-flecked, shimmering turquoise scales.' },
    { name: 'Parrot Cichlid', pattern: 'none', size: 46, bodyH: 0.62, tailShape: 'round', snout: 'blunt',
      colors: { body: 0x7a8a5c, belly: 0xc7d0a0, fin: 0x5c6a3a, accent: 0xd9b96a },
      desc: "A natural cichlid species with a mouth resembling a parrot's beak." },
    { name: 'Blood Parrot Cichlid', pattern: 'none', size: 48, bodyH: 0.75, tailShape: 'round', snout: 'blunt',
      colors: { body: 0xf2503c, belly: 0xffb090, fin: 0xd9301c, accent: 0xff8a5c },
      desc: 'A striking hybrid with a vivid red-orange, round body.' },
    { name: 'Frontosa Cichlid', pattern: 'stripes', size: 60, bodyH: 0.52, tailShape: 'round', snout: 'hump',
      colors: { body: 0xa8c3d6, belly: 0xe0eef5, fin: 0x5c7a90, accent: 0x2a2a2a },
      desc: "Lake Tanganyika's noble fish, with a forehead hump and bold bands." },
    { name: 'Malawi Peacock Cichlid', pattern: 'gradient', size: 44, bodyH: 0.44, tailShape: 'round',
      colors: { body: 0x4a5cc9, belly: 0x9aa8ef, fin: 0x2f3aa0, accent: 0xf2d049 },
      desc: "Lake Malawi's jewel, with a metallic purple-blue shimmer." },
    { name: 'Electric Yellow Cichlid', pattern: 'none', size: 40, bodyH: 0.42, tailShape: 'round',
      colors: { body: 0xf2d030, belly: 0xfff2a0, fin: 0xd9b020, accent: 0x1a1a1a },
      desc: 'Shines like sunshine in the tank with its bright yellow body.' },
    { name: 'Venustus Cichlid', pattern: 'spots', size: 56, bodyH: 0.46, tailShape: 'round',
      colors: { body: 0xe0c26a, belly: 0xf5e6b8, fin: 0x3a5c9a, accent: 0x2a2a2a },
      desc: 'A majestic Malawi cichlid with a blue face and sandy-gold body.' },
    { name: 'Red Empress Cichlid', pattern: 'gradient', size: 48, bodyH: 0.5, tailShape: 'round',
      colors: { body: 0xf2703c, belly: 0xffc79a, fin: 0x3a6ea8, accent: 0xd9502a },
      desc: 'An extraordinary cichlid whose body shifts from flame-red to blue.' },
    { name: 'Tropheus Duboisi', pattern: 'stripes', size: 42, bodyH: 0.58, tailShape: 'round',
      colors: { body: 0x1a1a1a, belly: 0x3a3a3a, fin: 0x0a0a0a, accent: 0xf2e9d0 },
      desc: 'A Lake Tanganyika classic, with a white band across its jet-black body.' },
    { name: 'Tiger Oscar', pattern: 'spots', size: 62, bodyH: 0.6, tailShape: 'round',
      colors: { body: 0xd97a1f, belly: 0xf2c78a, fin: 0x8a4a10, accent: 0x1a1a1a },
      desc: 'A charismatic Oscar variety with an orange-and-black tiger pattern.' },
  ],
  epic: [
    { name: 'Blue Tang', pattern: 'gradient', size: 50, bodyH: 0.65, tailShape: 'lunate',
      colors: { body: 0x1f5cc9, belly: 0x6a9aef, fin: 0xf2d030, accent: 0x1a1a1a },
      desc: "The ocean's most recognizable blue-and-yellow star." },
    { name: 'Yellow Tang', pattern: 'none', size: 42, bodyH: 0.75, tailShape: 'lunate',
      colors: { body: 0xf2c916, belly: 0xfff2a0, fin: 0xd9a80f, accent: 0xffffff },
      desc: 'Famous for its pure yellow body that glows on the reef.' },
    { name: 'Emperor Angelfish', pattern: 'hstripe', size: 52, bodyH: 0.75, tailShape: 'round',
      colors: { body: 0x1f5c9a, belly: 0x4a8fc9, fin: 0xf2c916, accent: 0xffffff },
      desc: "The reef's noble resident, earning blue-and-yellow stripes in adulthood." },
    { name: 'Queen Angelfish', pattern: 'gradient', size: 54, bodyH: 0.78, tailShape: 'round',
      colors: { body: 0x2f9ac9, belly: 0x6ac0e0, fin: 0xf2c916, accent: 0x1a1a1a },
      desc: 'Earns its name with a crown-shaped marking on its head.' },
    { name: 'Moorish Idol', pattern: 'stripes', size: 48, finScale: 1.6, tailShape: 'lunate', dorsalStyle: 'flowing',
      colors: { body: 0xf2e9d0, belly: 0xffffff, fin: 0x1a1a1a, accent: 0xf2c916 },
      desc: 'A reef icon with a long dorsal fin and banded pattern.' },
    { name: 'Picasso Triggerfish', pattern: 'stripes', size: 46, spiky: true, tailShape: 'round',
      colors: { body: 0xd9c98a, belly: 0xf2e9c0, fin: 0x1a1a1a, accent: 0x3a6ea8 },
      desc: 'Looks hand-painted with its geometric, multicolored pattern.' },
    { name: 'Powder Blue Tang', pattern: 'gradient', size: 46, bodyH: 0.68, tailShape: 'lunate',
      colors: { body: 0x5ca8e0, belly: 0xa8d8f2, fin: 0xf2c916, accent: 0x1a1a1a },
      desc: 'An icon of elegance with a powder-blue body and yellow dorsal fin.' },
    { name: 'Foxface Rabbitfish', pattern: 'spots', size: 44, spiky: true, tailShape: 'round', snout: 'long',
      colors: { body: 0xf2d030, belly: 0xfff2a0, fin: 0xd9b020, accent: 0x3a2a1a },
      desc: 'A calm-tempered species with a fox-like face, despite its venomous spines.' },
    { name: 'Harlequin Tuskfish', pattern: 'gradient', size: 48, tailShape: 'round',
      colors: { body: 0xf2703c, belly: 0xffb090, fin: 0x3a6ea8, accent: 0xd9502a },
      desc: "The reef's rare toothy gem, with vivid orange-blue gradients." },
    { name: 'Copperband Butterflyfish', pattern: 'stripes', size: 44, bodyH: 0.7, tailShape: 'round', snout: 'long',
      colors: { body: 0xf2e9d0, belly: 0xffffff, fin: 0xd97f24, accent: 0x1a1a1a },
      desc: 'An elegant butterflyfish with a long snout and copper bands.' },
    { name: 'Bicolor Angelfish', pattern: 'gradient', size: 40, bodyH: 0.7, tailShape: 'round',
      colors: { body: 0xf2c916, belly: 0xfff2a0, fin: 0x1f5c9a, accent: 0x1a1a1a },
      desc: 'Stands out with a sharp split of yellow and blue.' },
    { name: 'Achilles Tang', pattern: 'spots', size: 48, bodyH: 0.68, tailShape: 'lunate',
      colors: { body: 0x1a1a1a, belly: 0x3a3a3a, fin: 0xf2703c, accent: 0xffffff },
      desc: "One of the reef's most prized tangs, with a fiery orange patch on its tail." },
  ],
  legendary: [
    { name: 'Platinum Arowana', pattern: 'none', size: 82, finScale: 1.1, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0xf0f4f8, belly: 0xffffff, fin: 0xe0e8ee, accent: 0xcfd8e0 },
      desc: "A collector's dream, with flawless silver-white scales." },
    { name: 'Red Arowana', pattern: 'none', size: 80, finScale: 1.1, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0xc9302a, belly: 0xe87a5c, fin: 0xa8241f, accent: 0xf2a13c },
      desc: 'Prized as a fortune in Asia for its metallic red scales.' },
    { name: 'Silver Arowana', pattern: 'none', size: 84, finScale: 1.2, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0xcfd8e0, belly: 0xf0f4f8, fin: 0xb8c3cc, accent: 0x8fa0ac },
      desc: 'A legend gliding through the water on broad, paddle-like fins.' },
    { name: 'Napoleon Wrasse', pattern: 'gradient', size: 90, bodyH: 0.6, tailShape: 'round', snout: 'hump',
      colors: { body: 0x1f7a9a, belly: 0x5cb0cc, fin: 0x155c75, accent: 0xf2d049 },
      desc: "The reef's king, with a massive size and a forehead hump." },
    { name: 'Peppermint Angelfish', pattern: 'stripes', size: 40, bodyH: 0.7, tailShape: 'round',
      colors: { body: 0xd6405c, belly: 0xf2a0b0, fin: 0xb8304a, accent: 0xffffff },
      desc: "One of the world's rarest angelfish, living in deep waters." },
    { name: 'Masked Angelfish', pattern: 'gradient', size: 44, bodyH: 0.72, tailShape: 'round',
      colors: { body: 0xf2e9d0, belly: 0xffffff, fin: 0x1a1a1a, accent: 0xd8dee2 },
      desc: 'A white legend with a black mask, found only in Hawaiian waters.' },
    { name: 'Golden Basslet', pattern: 'gradient', size: 20, tailShape: 'forked',
      colors: { body: 0xf2a13c, belly: 0xffd9a0, fin: 0xd97f24, accent: 0xffe27a },
      desc: 'A rare species with a brilliant gold color, living in deep reef caves.' },
    { name: 'Swalesi Basslet', pattern: 'gradient', size: 18, tailShape: 'forked', dorsalStyle: 'flowing',
      colors: { body: 0x8a2a3a, belly: 0xc76a7a, fin: 0x5c1a26, accent: 0xf2a13c },
      desc: 'Known as one of the most expensive aquarium fish in the world.' },
  ],
};

const RARITY_PLAN: { r: Rarity; count: number; buy: [number, number]; grow: [number, number]; lvl: [number, number] }[] = [
  { r: 'common',    count: 27, buy: [50, 650],      grow: [2, 6],   lvl: [1, 4] },
  { r: 'uncommon',  count: 22, buy: [280, 2200],    grow: [5, 11],  lvl: [2, 8] },
  { r: 'rare',      count: 17, buy: [1100, 6500],   grow: [12, 20], lvl: [5, 12] },
  { r: 'epic',      count: 12, buy: [4200, 12500],  grow: [22, 38], lvl: [8, 16] },
  { r: 'legendary', count: 8,  buy: [15000, 42000], grow: [45, 75], lvl: [12, 20] },
];

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
  const rnd = mulberry(20260710);
  let gi = 0;
  for (const plan of RARITY_PLAN) {
    const seeds = REAL_SPECIES[plan.r];
    for (let i = 0; i < plan.count; i++) {
      gi++;
      const seed = seeds[i];

      const t = plan.count === 1 ? 0 : i / (plan.count - 1);
      const buy = Math.round((plan.buy[0] + (plan.buy[1] - plan.buy[0]) * t) / 10) * 10;
      const growMin = Math.round(plan.grow[0] + (plan.grow[1] - plan.grow[0]) * t);
      const lvl = Math.round(plan.lvl[0] + (plan.lvl[1] - plan.lvl[0]) * t);

      // A third of legendaries are pearl-only
      const pearlOnly = plan.r === 'legendary' && i % 3 === 2;

      out.push({
        id: `gen-${plan.r}-${gi}`,
        name: seed.name,
        rarity: plan.r,
        colors: {
          body: seed.colors.body,
          belly: seed.colors.belly,
          fin: seed.colors.fin,
          accent: i % 4 === 3 ? lighten(seed.colors.accent, 0.1) : seed.colors.accent,
        },
        pattern: seed.pattern,
        buyPrice: pearlOnly ? 0 : buy,
        pearlPrice: pearlOnly ? 50 + i * 10 : undefined,
        sellPrice: pearlOnly ? 48000 + i * 4000 : Math.round(buy * (2.2 + rnd() * 0.3)),
        growthMs: growMin * MIN,
        unlockLevel: lvl,
        size: seed.size,
        bodyH: seed.bodyH,
        finScale: seed.finScale,
        spiky: seed.spiky,
        tailShape: seed.tailShape,
        dorsalStyle: seed.dorsalStyle,
        snout: seed.snout,
        desc: seed.desc,
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
  odds: Partial<Record<Rarity, number>>; // percent
  desc: string;
}

export const EGGS: EggTier[] = [
  {
    id: 'bronz', name: 'Bronze Egg', emoji: '🥚', cost: 550, currency: 'coins',
    odds: { common: 70, uncommon: 25, rare: 5 },
    desc: 'A starter surprise. Small but full of hope.',
  },
  {
    id: 'gumus', name: 'Silver Egg', emoji: '🪺', cost: 2800, currency: 'coins',
    odds: { uncommon: 40, rare: 45, epic: 15 },
    desc: 'Good odds of hatching a rare friend.',
  },
  {
    id: 'altin', name: 'Golden Egg', emoji: '🌟', cost: 40, currency: 'pearls',
    odds: { rare: 30, epic: 50, legendary: 20 },
    desc: 'Legends are born from this egg. Guaranteed legendary every 8th egg!',
  },
];

export const PITY_LIMIT = 8; // legendary-guarantee counter for the golden egg

/** Adult fish's hourly passive coin income (by rarity). */
export const RARITY_INCOME: Record<Rarity, number> = {
  common: 25,
  uncommon: 60,
  rare: 150,
  epic: 400,
  legendary: 1000,
};

/** Nicknames picked at hatch time and stored in the save, so they are never
 *  translated at render time — a fish keeps the name it was born with. */
export const FISH_NAMES = [
  'Bubble', 'Coral', 'Lucky', 'Peanut', 'Olive', 'Cloud', 'Drop',
  'Ruby', 'Pearl', 'Lemon', 'Caramel', 'Paws', 'Hazel', 'Star',
  'Cotton', 'Pepper', 'Pebble', 'Honey', 'Corn', 'Taffy',
];
