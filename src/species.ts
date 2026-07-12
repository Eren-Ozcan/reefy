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
  tailShape?: 'lens' | 'forked' | 'round' | 'lyre' | 'ribbon' | 'lunate'; // kuyruk biçimi (varsayılan 'lens')
  dorsalStyle?: 'triangle' | 'flowing' | 'sail'; // sırt yüzgeci biçimi (varsayılan 'triangle')
  snout?: 'long' | 'hump' | 'blunt'; // burun/alın çıkıntısı (varsayılan yok)
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
    unlockLevel: 1, size: 46, finScale: 1.35, tailShape: 'lyre',
    desc: 'Neşeli ve dayanıklı. Her resifin ilk sakini.',
  },
  {
    id: 'neon-tetra', name: 'Neon Tetra', rarity: 'common',
    colors: { body: 0x5ec8ff, belly: 0xdff6ff, fin: 0x8fd8ff, accent: 0xff5e6c },
    pattern: 'hstripe', buyPrice: 65, sellPrice: 150, growthMs: 2.5 * MIN,
    unlockLevel: 1, size: 40, tailShape: 'forked',
    desc: 'Karanlıkta bile parlayan kırmızı şeridiyle ünlü.',
  },
  {
    id: 'moli', name: 'Siyah Moli', rarity: 'common',
    colors: { body: 0x3a3f52, belly: 0x596077, fin: 0x2c3040, accent: 0x596077 },
    pattern: 'none', buyPrice: 90, sellPrice: 210, growthMs: 3 * MIN,
    unlockLevel: 2, size: 44, tailShape: 'round',
    desc: 'Sakin, zarif ve gece kadar siyah.',
  },
  {
    id: 'palyaco', name: 'Palyaço Balığı', rarity: 'uncommon',
    colors: { body: 0xff8a3d, belly: 0xffb37d, fin: 0xff9d55, accent: 0xffffff },
    pattern: 'stripes', buyPrice: 220, sellPrice: 520, growthMs: 5 * MIN,
    unlockLevel: 2, size: 50, tailShape: 'round',
    desc: 'Anemonların en sevimli komşusu.',
  },
  {
    id: 'melek', name: 'Melek Balığı', rarity: 'uncommon',
    colors: { body: 0xcfd8e3, belly: 0xf0f4f8, fin: 0xf7c948, accent: 0x3d4a5c },
    pattern: 'stripes', buyPrice: 340, sellPrice: 800, growthMs: 7 * MIN,
    unlockLevel: 3, size: 52, bodyH: 0.8, finScale: 1.5, tailShape: 'round', dorsalStyle: 'flowing',
    desc: 'Uzun yüzgeçleriyle suda süzülen bir zarafet.',
  },
  {
    id: 'zebra-ciklit', name: 'Zebra Çiklit', rarity: 'uncommon',
    colors: { body: 0x6fa8dc, belly: 0xa8c8ea, fin: 0x5b8fc7, accent: 0x2f4d6e },
    pattern: 'stripes', buyPrice: 480, sellPrice: 1150, growthMs: 9 * MIN,
    unlockLevel: 4, size: 54, tailShape: 'round',
    desc: 'Çizgileri kadar karakteri de belirgin.',
  },
  {
    id: 'beta', name: 'Beta', rarity: 'rare',
    colors: { body: 0x9b59d0, belly: 0xc39bdf, fin: 0xe05297, accent: 0x6f3bb5 },
    pattern: 'gradient', buyPrice: 950, sellPrice: 2300, growthMs: 12 * MIN,
    unlockLevel: 5, size: 50, finScale: 1.9, tailShape: 'ribbon', dorsalStyle: 'flowing',
    desc: 'İpek gibi yüzgeçleriyle suda dans eden savaşçı.',
  },
  {
    id: 'kral-gramma', name: 'Kraliyet Gramma', rarity: 'rare',
    colors: { body: 0xffd23e, belly: 0xffe58a, fin: 0xb14ecf, accent: 0x8e3fd1 },
    pattern: 'gradient', buyPrice: 1400, sellPrice: 3300, growthMs: 15 * MIN,
    unlockLevel: 6, size: 48, tailShape: 'forked',
    desc: 'Yarı mor yarı altın: doğanın cesur renk deneyi.',
  },
  {
    id: 'aslan', name: 'Aslan Balığı', rarity: 'rare',
    colors: { body: 0xe0574f, belly: 0xf2b3ae, fin: 0xd94840, accent: 0xfff1e8 },
    pattern: 'stripes', buyPrice: 1900, sellPrice: 4500, growthMs: 18 * MIN,
    unlockLevel: 7, size: 58, spiky: true, finScale: 1.4, tailShape: 'round', dorsalStyle: 'sail',
    desc: 'Dikenli tacıyla resifin gururlu kralı.',
  },
  {
    id: 'mandarin', name: 'Mandarin Balığı', rarity: 'epic',
    colors: { body: 0x2e8fd8, belly: 0x5fb3ea, fin: 0xff9d2e, accent: 0xff7043 },
    pattern: 'spots', buyPrice: 3800, sellPrice: 8900, growthMs: 25 * MIN,
    unlockLevel: 8, size: 52, tailShape: 'round',
    desc: 'Okyanusun en renkli tuvali.',
  },
  {
    id: 'koi', name: 'Koi', rarity: 'epic',
    colors: { body: 0xf7f3ee, belly: 0xffffff, fin: 0xf2e8dd, accent: 0xff7043 },
    pattern: 'spots', buyPrice: 5500, sellPrice: 12800, growthMs: 30 * MIN,
    unlockLevel: 9, size: 64, tailShape: 'round',
    desc: 'Şans, sabır ve huzurun balığı.',
  },
  {
    id: 'diskus', name: 'Diskus', rarity: 'epic',
    colors: { body: 0x40c4b0, belly: 0x7fdccf, fin: 0x2ea896, accent: 0xe25856 },
    pattern: 'spots', buyPrice: 7500, sellPrice: 17500, growthMs: 35 * MIN,
    unlockLevel: 10, size: 56, bodyH: 0.85, tailShape: 'round',
    desc: 'Akvaryum dünyasının turkuaz mücevheri.',
  },
  {
    id: 'altin-arowana', name: 'Altın Arowana', rarity: 'legendary',
    colors: { body: 0xf5c542, belly: 0xffe9a8, fin: 0xe8ae1f, accent: 0xffefb0 },
    pattern: 'none', buyPrice: 16000, sellPrice: 39000, growthMs: 45 * MIN,
    unlockLevel: 12, size: 78, finScale: 1.1, tailShape: 'round', dorsalStyle: 'flowing',
    desc: 'Yaşayan bir altın külçesi. Efsaneler ondan bahseder.',
  },
  {
    id: 'inci', name: 'İnci Balığı', rarity: 'legendary',
    colors: { body: 0x9fe8ff, belly: 0xe8fbff, fin: 0xc9f2ff, accent: 0xffffff },
    pattern: 'spots', buyPrice: 0, pearlPrice: 60, sellPrice: 52000, growthMs: 60 * MIN,
    unlockLevel: 1, size: 60, finScale: 1.5, tailShape: 'round', dorsalStyle: 'flowing',
    desc: 'Sadece incilerle çağrılabilen ışıltılı bir sır.',
  },
];

// ---- Gerçek türlerden 86 balık (deterministik — id'ler ve isimler her derlemede aynı) ----

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
      desc: 'Yatay çizgileriyle tanınan hareketli ve dayanıklı bir tatlı su balığı.' },
    { name: 'Platy', pattern: 'none', size: 38, tailShape: 'round',
      colors: { body: 0xff7a4a, belly: 0xffd2b8, fin: 0xff9d6a, accent: 0xc94a1f },
      desc: 'Bakımı kolay, canlı doğuran neşeli bir tatlı su balığı.' },
    { name: 'Kılıçkuyruk', pattern: 'none', size: 44, finScale: 1.2, tailShape: 'lyre',
      colors: { body: 0x7ab86a, belly: 0xd6f0c8, fin: 0x4a8f4a, accent: 0xff6b3d },
      desc: 'Erkeklerindeki kılıç biçimli kuyruğuyla tanınır.' },
    { name: 'Kiraz Barbusu', pattern: 'none', size: 36, tailShape: 'forked',
      colors: { body: 0xd6403f, belly: 0xf2a8a0, fin: 0xb8302f, accent: 0xffffff },
      desc: 'Küçük sürüler halinde yüzmeyi seven kiraz kırmızısı bir barbus.' },
    { name: 'Kaplan Barbusu', pattern: 'stripes', size: 38, tailShape: 'forked',
      colors: { body: 0xf2a13c, belly: 0xffd9a0, fin: 0xd9401f, accent: 0x2a2a2a },
      desc: 'Kaplan çizgileriyle akvaryuma enerji katan hareketli bir tür.' },
    { name: 'Beyaz Bulut Dağ Balığı', pattern: 'hstripe', size: 32, tailShape: 'forked',
      colors: { body: 0xb8c9a0, belly: 0xe8f0d8, fin: 0xd6403f, accent: 0xf2d049 },
      desc: 'Soğuk suya bile dayanabilen dağ derelerinin küçük sakini.' },
    { name: 'Arlekin Rasbora', pattern: 'spots', size: 34, tailShape: 'forked',
      colors: { body: 0xe89a5c, belly: 0xf5cfa0, fin: 0xd97f3f, accent: 0x2a2a2a },
      desc: 'Bakır rengi gövdesi ve siyah üçgen lekesiyle tanınır.' },
    { name: 'Kori Balığı', pattern: 'spots', size: 34, bodyH: 0.55, tailShape: 'round',
      colors: { body: 0x8a7a5c, belly: 0xd8cfa8, fin: 0x6f6047, accent: 0xb0a37a },
      desc: 'Akvaryum tabanını temizleyen sevimli bıyıklı bir yayın balığı.' },
    { name: 'Fırça Burunlu Yayın', pattern: 'spots', size: 46, bodyH: 0.5, spiky: true, tailShape: 'round',
      colors: { body: 0x4a3f30, belly: 0x7a6c52, fin: 0x2f2a20, accent: 0x8a7a5c },
      desc: 'Yosunları temizleyen dikensi çıkıntılı bir tabanci balığı.' },
    { name: 'Endler Guppisi', pattern: 'spots', size: 30, tailShape: 'lyre',
      colors: { body: 0xff9d2e, belly: 0xffe0a0, fin: 0x2fae7d, accent: 0x1f1f1f },
      desc: 'Guppinin küçük ve rengarenk akrabası.' },
    { name: 'Dalmaçyalı Moli', pattern: 'spots', size: 46, tailShape: 'round',
      colors: { body: 0xeef2f5, belly: 0xffffff, fin: 0xd8dee2, accent: 0x2a2a2a },
      desc: 'Beyaz gövdesindeki siyah benekleriyle dalmaçya köpeğini andırır.' },
    { name: 'Yelkenli Moli', pattern: 'spots', size: 50, finScale: 1.6, tailShape: 'round', dorsalStyle: 'sail',
      colors: { body: 0x5c7a8a, belly: 0xa8c3cf, fin: 0x3a5666, accent: 0xf2d049 },
      desc: 'Büyük yelken gibi sırt yüzgeciyle dikkat çeker.' },
    { name: 'Pembe Barbus', pattern: 'none', size: 40, tailShape: 'forked',
      colors: { body: 0xe0708a, belly: 0xf5c3d0, fin: 0xc7506a, accent: 0xffffff },
      desc: 'Pembe-gül tonlarıyla akvaryuma zarafet katar.' },
    { name: 'Kanatlı Tetra', pattern: 'none', size: 36, tailShape: 'forked',
      colors: { body: 0xc7d3da, belly: 0xeef2f5, fin: 0xd6403f, accent: 0xff6f61 },
      desc: 'Kırmızı yüzgeçleriyle gümüş gövdesi arasında güzel bir kontrast oluşturur.' },
    { name: 'Serpae Tetra', pattern: 'none', size: 34, tailShape: 'forked',
      colors: { body: 0xc7343f, belly: 0xe89aa0, fin: 0x8a1f2a, accent: 0x1a1a1a },
      desc: 'Derin kırmızı rengi ve siyah yüzgeç kenarıyla tanınır.' },
    { name: 'Siyah Etek Tetra', pattern: 'none', size: 38, finScale: 1.3, tailShape: 'forked', dorsalStyle: 'flowing',
      colors: { body: 0x8a939c, belly: 0xc7cfd6, fin: 0x2a2a2a, accent: 0x4a525c },
      desc: 'Uzun siyah eteğini andıran yüzgeçleriyle zarif bir tetra.' },
    { name: 'Parlak Tetra', pattern: 'hstripe', size: 32, tailShape: 'forked',
      colors: { body: 0xd9765c, belly: 0xf2c3ab, fin: 0xc75f42, accent: 0xff9d2e },
      desc: 'Yanında turuncu ışıltılı bir çizgi taşır.' },
    { name: 'Kuhli Yılan Balığı', pattern: 'stripes', size: 42, bodyH: 0.35, tailShape: 'round',
      colors: { body: 0xe0a13c, belly: 0xf2d29a, fin: 0xc7852e, accent: 0x2a1f14 },
      desc: 'Yılan gibi kıvrılarak yüzen bantlı bir yayın balığı.' },
    { name: 'Otosinklus', pattern: 'hstripe', size: 28, tailShape: 'round',
      colors: { body: 0x9a8a6c, belly: 0xd8cfa8, fin: 0x7a6c52, accent: 0x3a3020 },
      desc: 'Cam yosunlarını temizleyen minik bir tabanci balığı.' },
    { name: 'Zebra Yılan Balığı', pattern: 'stripes', size: 40, tailShape: 'forked',
      colors: { body: 0xf2e9d0, belly: 0xfff6e0, fin: 0xd9cba0, accent: 0x2a2a2a },
      desc: 'Siyah-beyaz bantlarıyla zebra desenini taşır.' },
    { name: 'Buenos Aires Tetra', pattern: 'hstripe', size: 40, tailShape: 'forked',
      colors: { body: 0xc7cfd6, belly: 0xeef2f5, fin: 0xd6403f, accent: 0x2a2a2a },
      desc: 'Dayanıklı yapısıyla yeni başlayanların favorisi.' },
    { name: 'Cennet Balığı', pattern: 'stripes', size: 46, finScale: 1.4, tailShape: 'lyre', dorsalStyle: 'flowing',
      colors: { body: 0x3a6ea8, belly: 0x8fb8dc, fin: 0xd6403f, accent: 0xf2d049 },
      desc: 'Uzun yüzgeçleri ve canlı renkleriyle akvaryumun cenneti.' },
    { name: 'Fantail Japon Balığı', pattern: 'none', size: 48, bodyH: 0.75, finScale: 1.5, tailShape: 'lyre',
      colors: { body: 0xf2703c, belly: 0xffc79a, fin: 0xd9502a, accent: 0xffffff },
      desc: 'Yuvarlak gövdesi ve çift kuyruğuyla klasik bir Japon balığı.' },
    { name: 'Komet Japon Balığı', pattern: 'none', size: 50, finScale: 1.6, tailShape: 'ribbon',
      colors: { body: 0xf28a3c, belly: 0xffe0b0, fin: 0xffffff, accent: 0xd9702a },
      desc: 'Uzun tek kuyruk yüzgeciyle hızlı yüzen bir Japon balığı türü.' },
    { name: 'Shubunkin', pattern: 'spots', size: 48, bodyH: 0.68, tailShape: 'lyre',
      colors: { body: 0x6a8fb8, belly: 0xd0dde8, fin: 0xf28a3c, accent: 0x2a2a2a },
      desc: 'Alacalı mavi-turuncu deseniyle benzersiz bir Japon balığı.' },
    { name: 'İplik Yüzgeç Gökkuşağı', pattern: 'none', size: 36, finScale: 1.7, tailShape: 'forked', dorsalStyle: 'flowing',
      colors: { body: 0xf2c33c, belly: 0xffe9a0, fin: 0xd6403f, accent: 0xffffff },
      desc: 'İnce uzayan yüzgeçleriyle zarif bir gökkuşağı balığı.' },
    { name: 'Panda Kori', pattern: 'spots', size: 32, bodyH: 0.55, tailShape: 'round',
      colors: { body: 0xf0e6d0, belly: 0xfff8ea, fin: 0xd9cba0, accent: 0x1f1f1f },
      desc: 'Siyah-beyaz panda desenli sevimli bir tabanci balığı.' },
  ],
  uncommon: [
    { name: 'Rummy Nose Tetra', pattern: 'stripes', size: 36, tailShape: 'forked',
      colors: { body: 0xc7cfd6, belly: 0xeef2f5, fin: 0x2a2a2a, accent: 0xd6403f },
      desc: 'Kırmızı burnu ve bantlı kuyruğuyla kolayca tanınır.' },
    { name: 'Kongo Tetrası', pattern: 'gradient', size: 48, finScale: 1.3, tailShape: 'lyre',
      colors: { body: 0x3fae9a, belly: 0xf2c33c, fin: 0xd6403f, accent: 0x6a5cc9 },
      desc: 'Metalik mavi-altın parıltısıyla göz kamaştırır.' },
    { name: 'Boesemani Gökkuşağı', pattern: 'gradient', size: 50, tailShape: 'forked',
      colors: { body: 0x3a6ea8, belly: 0x8fb8dc, fin: 0xf2703c, accent: 0xd9502a },
      desc: 'Mavi ön, turuncu arka gövdesiyle canlı bir gökkuşağı balığı.' },
    { name: 'Gökyüzü İnci Danio', pattern: 'spots', size: 22, tailShape: 'forked',
      colors: { body: 0x2a3a5c, belly: 0x5c7aa0, fin: 0xd6403f, accent: 0xf2d049 },
      desc: 'Lacivert gövdesindeki inci benekleriyle ünlüdür.' },
    { name: 'Ateş Ağızlı Çiklit', pattern: 'gradient', size: 52, tailShape: 'round',
      colors: { body: 0x8a8f9a, belly: 0xd6403f, fin: 0x5c6270, accent: 0xf2703c },
      desc: 'Kırmızı-turuncu boğazıyla adını alan bir çiklit.' },
    { name: 'Jack Dempsey Çiklit', pattern: 'spots', size: 58, tailShape: 'round',
      colors: { body: 0x4a3f4a, belly: 0x6f5c6f, fin: 0x2f2530, accent: 0x4fd8c9 },
      desc: 'Koyu gövdesindeki parlayan turkuaz benekleriyle etkileyici.' },
    { name: 'Kribensis Çiklit', pattern: 'none', size: 40, tailShape: 'round',
      colors: { body: 0x7a8a5c, belly: 0xd6405c, fin: 0x5c6a3a, accent: 0xf2d049 },
      desc: 'Pembe karnı ve ebeveynlik içgüdüsüyle tanınan popüler bir çiklit.' },
    { name: 'İnci Gurami', pattern: 'spots', size: 48, finScale: 1.3, tailShape: 'lyre', dorsalStyle: 'flowing',
      colors: { body: 0x9a8a7a, belly: 0xd8cfc0, fin: 0xd6706a, accent: 0xf2e9d0 },
      desc: 'Gövdesindeki inci desenli pullarıyla zarif bir gurami.' },
    { name: 'Cüce Gurami', pattern: 'stripes', size: 36, finScale: 1.2, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0x4a7ec9, belly: 0x9ac3ef, fin: 0xe0503f, accent: 0xffb830 },
      desc: 'Küçük boyuna rağmen canlı mavi-kırmızı çizgileriyle dikkat çeker.' },
    { name: 'Bal Gurami', pattern: 'none', size: 34, finScale: 1.2, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0xf2a13c, belly: 0xffd9a0, fin: 0xd97f24, accent: 0x8a5a1a },
      desc: 'Bal rengindeki parlak turuncu gövdesiyle sakin bir tür.' },
    { name: 'Bombus Kaya Balığı', pattern: 'stripes', size: 20, tailShape: 'round',
      colors: { body: 0xf2d049, belly: 0xfff2b0, fin: 0x2a2a2a, accent: 0x1a1a1a },
      desc: 'Arı gibi sarı-siyah bantlarıyla minik bir kaya balığı.' },
    { name: 'Gümüş Dolar Balığı', pattern: 'none', size: 44, bodyH: 0.8, tailShape: 'round',
      colors: { body: 0xcfd8e0, belly: 0xf0f4f8, fin: 0xb8c3cc, accent: 0x8fa0ac },
      desc: 'Yassı yuvarlak gövdesiyle gümüş bir madeni parayı andırır.' },
    { name: 'Gökkuşağı Köpekbalığı', pattern: 'none', size: 52, bodyH: 0.55, tailShape: 'forked', dorsalStyle: 'sail',
      colors: { body: 0x3a3a3a, belly: 0x5c5c5c, fin: 0xd6403f, accent: 0x1a1a1a },
      desc: 'Köpekbalığı görünümlü, kırmızı yüzgeçli barışçıl bir tür.' },
    { name: 'Kırmızı Kuyruklu Köpekbalığı', pattern: 'none', size: 50, bodyH: 0.55, tailShape: 'forked', dorsalStyle: 'sail',
      colors: { body: 0x1f1f1f, belly: 0x3a3a3a, fin: 0xd6403f, accent: 0x0a0a0a },
      desc: 'Simsiyah gövdesi ve alev kırmızısı kuyruğuyla tanınır.' },
    { name: 'Palyaço Yılan Balığı', pattern: 'stripes', size: 46, tailShape: 'forked',
      colors: { body: 0xf2703c, belly: 0xffc79a, fin: 0xd9502a, accent: 0x1a1a1a },
      desc: 'Turuncu-siyah bantlarıyla akvaryumun hareketli palyaçosu.' },
    { name: 'Yoyo Yılan Balığı', pattern: 'spots', size: 42, tailShape: 'forked',
      colors: { body: 0xd8dee2, belly: 0xf0f4f8, fin: 0xb8c3cc, accent: 0x2a2a2a },
      desc: 'Sırtındaki Y ve X şekilli desenlerden adını alır.' },
    { name: 'Mavi Gurami', pattern: 'spots', size: 50, finScale: 1.2, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0x3a7ea8, belly: 0x8fc0dc, fin: 0x2a5c80, accent: 0x1a1a1a },
      desc: 'Pudra mavisi gövdesiyle sakin sularda süzülür.' },
    { name: 'İplik Yüzgeç Akara', pattern: 'spots', size: 46, tailShape: 'round', dorsalStyle: 'flowing',
      colors: { body: 0x2fae9a, belly: 0x8fdcc9, fin: 0xf2d049, accent: 0xd6403f },
      desc: 'Turkuaz-altın parıltılı pullarıyla küçük bir çiklit mücevheri.' },
    { name: 'Elektrik Mavi Ram', pattern: 'gradient', size: 30, finScale: 1.3, tailShape: 'round',
      colors: { body: 0x2f7fd6, belly: 0x8fbeef, fin: 0x1f5fb0, accent: 0xf2d049 },
      desc: 'Doğada nadir görülen yoğun elektrik mavisi rengiyle ünlü.' },
    { name: 'Bolivya Ram Çiklit', pattern: 'hstripe', size: 32, finScale: 1.2, tailShape: 'round',
      colors: { body: 0xd9b96a, belly: 0xf2e0b0, fin: 0x8a7a5c, accent: 0x2a2a2a },
      desc: 'Gözünden geçen siyah çizgisiyle sakin huylu bir çiklit.' },
    { name: 'Neon Gökkuşağı Balığı', pattern: 'gradient', size: 34, tailShape: 'forked',
      colors: { body: 0x3fae9a, belly: 0x8fdcc9, fin: 0x2f8f7d, accent: 0xd6d049 },
      desc: 'Turkuaz-yeşil metalik parıltısıyla akvaryumu aydınlatır.' },
    { name: 'Sarı Kuyruklu Mavi Damla', pattern: 'gradient', size: 34, tailShape: 'forked',
      colors: { body: 0x1f3a6a, belly: 0x3a5c8a, fin: 0xf2d049, accent: 0x0a1a3a },
      desc: 'Koyu mavi gövdesi ve parlak sarı kuyruğuyla resif sakini.' },
  ],
  rare: [],
  epic: [],
  legendary: [],
};

const RARITY_PLAN: { r: Rarity; count: number; buy: [number, number]; grow: [number, number]; lvl: [number, number] }[] = [
  { r: 'common',    count: 27, buy: [50, 650],      grow: [2, 6],   lvl: [1, 4] },
  { r: 'uncommon',  count: 22, buy: [280, 2200],    grow: [5, 11],  lvl: [2, 8] },
  { r: 'rare',      count: 0,  buy: [1100, 6500],   grow: [12, 20], lvl: [5, 12] },
  { r: 'epic',      count: 0,  buy: [4200, 12500],  grow: [22, 38], lvl: [8, 16] },
  { r: 'legendary', count: 0,  buy: [15000, 42000], grow: [45, 75], lvl: [12, 20] },
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

      // Efsanevilerin üçte biri yalnızca inciyle alınır
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
  odds: Partial<Record<Rarity, number>>; // yüzde
  desc: string;
}

export const EGGS: EggTier[] = [
  {
    id: 'bronz', name: 'Bronz Yumurta', emoji: '🥚', cost: 550, currency: 'coins',
    odds: { common: 70, uncommon: 25, rare: 5 },
    desc: 'Başlangıç sürprizi. Küçük ama umut dolu.',
  },
  {
    id: 'gumus', name: 'Gümüş Yumurta', emoji: '🪺', cost: 2800, currency: 'coins',
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
