/**
 * Simple i18n: English text is used directly as the dictionary key (no need to
 * invent separate key names). t('English text') looks up its counterpart in the
 * TR dictionary when the language is 'tr', and falls back to the English text
 * as-is if not found — so the app never breaks even if a translation is missing.
 */
export type Lang = 'tr' | 'en';

/** Languages the game ships. Turkish returned on 2026-08-19. */
export const AVAILABLE_LANGS: readonly Lang[] = ['en', 'tr'];

/**
 * Labels for the settings language picker. Deliberately in the language they
 * NAME rather than translated: the player most likely to need this row is the
 * one who cannot read the language currently on screen.
 */
export const LANG_LABELS: Record<Lang, string> = { tr: 'Türkçe', en: 'English' };

const STORAGE_KEY = 'reefy-lang';
/**
 * Currency reported by the store on a previous launch (see services.ts
 * loadPrices). It is the closest thing to the PLAY ACCOUNT's country the app
 * can observe: the store bills in the account's currency regardless of what
 * language the device is set to. Prices arrive well after the first frame, so
 * it can only inform the NEXT launch — which is exactly why it is persisted
 * rather than awaited.
 */
export const STORE_CURRENCY_KEY = 'reefy-store-currency';

function isAvailable(l: string | undefined): l is Lang {
  return !!l && (AVAILABLE_LANGS as readonly string[]).includes(l);
}

/** Records the store's billing currency for the next launch's language guess. */
export function rememberStoreCurrency(code: string): void {
  if (!code) return;
  try { localStorage.setItem(STORE_CURRENCY_KEY, code.toUpperCase()); } catch { /* storage may be disabled */ }
}

function storedStoreCurrency(): string {
  try { return localStorage.getItem(STORE_CURRENCY_KEY) ?? ''; } catch { return ''; }
}

/**
 * Turkish is chosen only on POSITIVE evidence of a Turkish player; everything
 * else gets English. That asymmetry is the point — a wrong guess toward
 * English leaves the player in a language nearly everyone can navigate, while
 * a wrong guess toward Turkish strands them in one almost nobody can.
 *
 * The signals, strongest first:
 *
 * 1. The store's billing currency from a previous launch. The Play/App Store
 *    account's country is not directly readable without another plugin, but
 *    the account's CURRENCY is, and a Turkish account bills in TRY whatever
 *    language the handset is set to.
 * 2. The device language tags — 'tr' in any position, or any tag with the TR
 *    region (a Turkish player whose phone is in English still gets 'en-TR').
 *    A device that lists tags and none of them are Turkish DECIDES for
 *    English: the player has already said what they read.
 *
 * The IANA time zone was tried as a third signal and removed. Europe/Istanbul
 * says where the handset is, not what its owner reads — it handed Turkish to a
 * device explicitly set to German, which is the exact failure the asymmetry
 * above exists to prevent.
 */
export function detectLang(): Lang {
  return looksTurkish() ? 'tr' : 'en';
}

function looksTurkish(): boolean {
  const currency = storedStoreCurrency();
  // The currency is the strongest signal, so it DECIDES rather than votes:
  // a player billed in euros is not handed Turkish because of a leftover
  // time zone, and one billed in lira keeps Turkish on an English handset.
  if (currency) return currency === 'TRY';

  const tags = typeof navigator !== 'undefined'
    ? [...(navigator.languages ?? []), navigator.language ?? ''].filter(Boolean)
    : [];
  return tags.some((tag) => {
    const low = tag.toLowerCase();
    return low === 'tr' || low.startsWith('tr-') || low.endsWith('-tr');
  });
}

function readStored(): Lang | undefined {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isAvailable(v ?? undefined) ? (v as Lang) : undefined;
  } catch {
    return undefined;
  }
}

// The menu is shown before the save loads (before pressing Play), so the
// initial language is determined from the last localStorage preference, or
// the browser language otherwise.
let current: Lang = readStored() ?? detectLang();

export function getLang(): Lang {
  return current;
}

export function setLang(l: Lang): void {
  if (!isAvailable(l)) return;
  current = l;
  try { localStorage.setItem(STORAGE_KEY, l); } catch { /* localStorage may be disabled */ }
}

/** A stored preference for a language that is no longer offered (a save from when
 *  Turkish shipped) resolves to an available one instead of being honoured. The
 *  saved value itself is left alone, so the preference returns with the language. */
export function initLang(saved?: Lang): void {
  current = isAvailable(saved) ? saved : detectLang();
}

/** English distinguishes singular from plural where Turkish doesn't, so the few
 *  templates that count something are built in code rather than by substitution.
 *  '{n}-day streak' needs no rule — "1-day streak" is already correct. */
const PLURAL_EN: Record<string, (n: number) => string> = {
  '{n} days': (n) => `${n} day${n === 1 ? '' : 's'}`,
  'Daily quests 🔥 Streak: {n} days': (n) => `Daily quests 🔥 Streak: ${n} day${n === 1 ? '' : 's'}`,
  '🔥 Streak: <b>{n} days</b> — keep it up and gifts grow bigger!': (n) =>
    `🔥 Streak: <b>${n} day${n === 1 ? '' : 's'}</b> — keep it up and gifts grow bigger!`,
  '{n} more days until the rare egg reward': (n) =>
    `${n} more day${n === 1 ? '' : 's'} until the rare egg reward`,
  '{n} day streak': (n) => `${n} day streak`,
};

/** Translates the English text (key) to the current language; replaces {var} patterns with vars. */
export function t(s: string, vars?: Record<string, string | number>): string {
  if (current === 'en' && vars && typeof vars.n === 'number' && PLURAL_EN[s]) {
    return PLURAL_EN[s](vars.n);
  }
  let out = current === 'tr' ? (TR[s] ?? s) : s;
  if (vars) {
    for (const k of Object.keys(vars)) out = out.split(`{${k}}`).join(String(vars[k]));
  }
  return out;
}

const TR: Record<string, string> = {
  // ---- Rarity / biome ----
  'Common': 'Yaygın', 'Uncommon': 'Az Bulunur', 'Rare': 'Nadir', 'Epic': 'Epik', 'Legendary': 'Efsanevi',
  'Tropical': 'Tropik', 'Lagoon': 'Lagün', 'Deep Sea': 'Derin Deniz', 'Cave': 'Mağara',
  'Polar': 'Kutup', 'Sunset': 'Gün Batımı', 'Mystic': 'Mistik',

  // ---- Handcrafted species ----
  'Guppy': 'Lepistes',
  "Cheerful and hardy. Every reef's first resident.": 'Neşeli ve dayanıklı. Her resifin ilk sakini.',
  'Famous for the red stripe that glows even in the dark.': 'Karanlıkta bile parlayan kırmızı şeridiyle ünlü.',
  'Black Molly': 'Siyah Moli',
  'Calm, elegant, and black as night.': 'Sakin, zarif ve gece kadar siyah.',
  'Clownfish': 'Palyaço Balığı',
  "The anemone's most charming neighbor.": 'Anemonların en sevimli komşusu.',
  'Angelfish': 'Melek Balığı',
  'Elegance gliding through the water on long fins.': 'Uzun yüzgeçleriyle suda süzülen bir zarafet.',
  'Zebra Cichlid': 'Zebra Çiklit',
  'A personality as bold as its stripes.': 'Çizgileri kadar karakteri de belirgin.',
  'Betta': 'Beta',
  'A warrior that dances through the water on silky fins.': 'İpek gibi yüzgeçleriyle suda dans eden savaşçı.',
  'Royal Gramma': 'Kraliyet Gramma',
  "Half purple, half gold: nature's boldest color experiment.": 'Yarı mor yarı altın: doğanın cesur renk deneyi.',
  'Lionfish': 'Aslan Balığı',
  "The reef's proud king, crowned with spines.": 'Dikenli tacıyla resifin gururlu kralı.',
  'Mandarinfish': 'Mandarin Balığı',
  "The ocean's most colorful canvas.": 'Okyanusun en renkli tuvali.',
  'Koi': 'Koi',
  'The fish of luck, patience, and peace.': 'Şans, sabır ve huzurun balığı.',
  'Discus': 'Diskus',
  "The aquarium world's turquoise jewel.": 'Akvaryum dünyasının turkuaz mücevheri.',
  'Golden Arowana': 'Altın Arowana',
  'A living gold bar. Legends speak of it.': 'Yaşayan bir altın külçesi. Efsaneler ondan bahseder.',
  'Pearl Fish': 'İnci Balığı',
  'A shimmering secret summoned only by pearls.': 'Sadece incilerle çağrılabilen ışıltılı bir sır.',

  // ---- Real species: common ----
  'Zebra Danio': 'Zebra Danio',
  'An active, hardy freshwater fish known for its horizontal stripes.': 'Yatay çizgileriyle tanınan hareketli ve dayanıklı bir tatlı su balığı.',
  'Platy': 'Platy',
  'An easy-care, livebearing freshwater fish full of cheer.': 'Bakımı kolay, canlı doğuran neşeli bir tatlı su balığı.',
  'Swordtail': 'Kılıçkuyruk',
  'Known for the sword-shaped tail on its males.': 'Erkeklerindeki kılıç biçimli kuyruğuyla tanınır.',
  'Cherry Barb': 'Kiraz Barbusu',
  'A cherry-red barb that loves swimming in small schools.': 'Küçük sürüler halinde yüzmeyi seven kiraz kırmızısı bir barbus.',
  'Tiger Barb': 'Kaplan Barbusu',
  'An energetic species that brings life to the tank with its tiger stripes.': 'Kaplan çizgileriyle akvaryuma enerji katan hareketli bir tür.',
  'White Cloud Mountain Minnow': 'Beyaz Bulut Dağ Balığı',
  'A tiny resident of mountain streams that can even tolerate cold water.': 'Soğuk suya bile dayanabilen dağ derelerinin küçük sakini.',
  'Harlequin Rasbora': 'Arlekin Rasbora',
  'Known for its copper body and black triangular patch.': 'Bakır rengi gövdesi ve siyah üçgen lekesiyle tanınır.',
  'Corydoras': 'Kori Balığı',
  'An adorable whiskered catfish that keeps the tank floor clean.': 'Akvaryum tabanını temizleyen sevimli bıyıklı bir yayın balığı.',
  'Bristlenose Pleco': 'Fırça Burunlu Yayın',
  'An algae-eating catfish with bristly whisker-like growths.': 'Yosunları temizleyen dikensi çıkıntılı bir tabanci balığı.',
  "Endler's Livebearer": 'Endler Guppisi',
  "The guppy's small, colorful cousin.": 'Guppinin küçük ve rengarenk akrabası.',
  'Dalmatian Molly': 'Dalmaçyalı Moli',
  'Resembles a dalmatian dog with black spots on its white body.': 'Beyaz gövdesindeki siyah benekleriyle dalmaçya köpeğini andırır.',
  'Sailfin Molly': 'Yelkenli Moli',
  'Stands out with a large, sail-like dorsal fin.': 'Büyük yelken gibi sırt yüzgeciyle dikkat çeker.',
  'Rosy Barb': 'Pembe Barbus',
  'Adds elegance to the tank with rosy-pink tones.': 'Pembe-gül tonlarıyla akvaryuma zarafet katar.',
  'Redfin Tetra': 'Kanatlı Tetra',
  'Creates a striking contrast between its red fins and silver body.': 'Kırmızı yüzgeçleriyle gümüş gövdesi arasında güzel bir kontrast oluşturur.',
  'Serpae Tetra': 'Serpae Tetra',
  'Known for its deep red color and black-edged fins.': 'Derin kırmızı rengi ve siyah yüzgeç kenarıyla tanınır.',
  'Black Skirt Tetra': 'Siyah Etek Tetra',
  'An elegant tetra with fins resembling a long black skirt.': 'Uzun siyah eteğini andıran yüzgeçleriyle zarif bir tetra.',
  'Glowlight Tetra': 'Parlak Tetra',
  'Carries a glowing orange stripe along its side.': 'Yanında turuncu ışıltılı bir çizgi taşır.',
  'Kuhli Loach': 'Kuhli Yılan Balığı',
  'A banded loach that swims with snake-like curves.': 'Yılan gibi kıvrılarak yüzen bantlı bir yayın balığı.',
  'Otocinclus': 'Otosinklus',
  'A tiny catfish that cleans glass algae.': 'Cam yosunlarını temizleyen minik bir tabanci balığı.',
  'Zebra Loach': 'Zebra Yılan Balığı',
  'Carries a zebra pattern of black-and-white bands.': 'Siyah-beyaz bantlarıyla zebra desenini taşır.',
  'Buenos Aires Tetra': 'Buenos Aires Tetra',
  'A beginner favorite thanks to its hardy nature.': 'Dayanıklı yapısıyla yeni başlayanların favorisi.',
  'Paradise Fish': 'Cennet Balığı',
  "The tank's paradise, with long fins and vivid colors.": 'Uzun yüzgeçleri ve canlı renkleriyle akvaryumun cenneti.',
  'Fantail Goldfish': 'Fantail Japon Balığı',
  'A classic goldfish with a round body and double tail.': 'Yuvarlak gövdesi ve çift kuyruğuyla klasik bir Japon balığı.',
  'Comet Goldfish': 'Komet Japon Balığı',
  'A fast-swimming goldfish variety with a long single tail fin.': 'Uzun tek kuyruk yüzgeciyle hızlı yüzen bir Japon balığı türü.',
  'Shubunkin': 'Shubunkin',
  'A one-of-a-kind goldfish with a mottled blue-orange pattern.': 'Alacalı mavi-turuncu deseniyle benzersiz bir Japon balığı.',
  'Threadfin Rainbowfish': 'İplik Yüzgeç Gökkuşağı',
  'An elegant rainbowfish with long, thread-like fins.': 'İnce uzayan yüzgeçleriyle zarif bir gökkuşağı balığı.',
  'Panda Corydoras': 'Panda Kori',
  'An adorable catfish with a black-and-white panda pattern.': 'Siyah-beyaz panda desenli sevimli bir tabanci balığı.',

  // ---- Real species: uncommon ----
  'Rummynose Tetra': 'Rummy Nose Tetra',
  'Easily recognized by its red nose and banded tail.': 'Kırmızı burnu ve bantlı kuyruğuyla kolayca tanınır.',
  'Congo Tetra': 'Kongo Tetrası',
  'Dazzles with a metallic blue-gold shimmer.': 'Metalik mavi-altın parıltısıyla göz kamaştırır.',
  'Boesemani Rainbowfish': 'Boesemani Gökkuşağı',
  'A vivid rainbowfish, blue in front and orange behind.': 'Mavi ön, turuncu arka gövdesiyle canlı bir gökkuşağı balığı.',
  'Celestial Pearl Danio': 'Gökyüzü İnci Danio',
  'Famous for the pearl-like spots on its navy body.': 'Lacivert gövdesindeki inci benekleriyle ünlüdür.',
  'Firemouth Cichlid': 'Ateş Ağızlı Çiklit',
  'A cichlid named for its fiery red-orange throat.': 'Kırmızı-turuncu boğazıyla adını alan bir çiklit.',
  'Jack Dempsey Cichlid': 'Jack Dempsey Çiklit',
  'Striking, with glittering turquoise flecks over a dark body.': 'Koyu gövdesindeki parlayan turkuaz benekleriyle etkileyici.',
  'Kribensis Cichlid': 'Kribensis Çiklit',
  'A popular cichlid known for its pink belly and strong parenting instinct.': 'Pembe karnı ve ebeveynlik içgüdüsüyle tanınan popüler bir çiklit.',
  'Pearl Gourami': 'İnci Gurami',
  'An elegant gourami with pearl-patterned scales.': 'Gövdesindeki inci desenli pullarıyla zarif bir gurami.',
  'Dwarf Gourami': 'Cüce Gurami',
  'Small in size but bold in its vivid blue-and-red stripes.': 'Küçük boyuna rağmen canlı mavi-kırmızı çizgileriyle dikkat çeker.',
  'Honey Gourami': 'Bal Gurami',
  'A peaceful species with a bright, honey-orange body.': 'Bal rengindeki parlak turuncu gövdesiyle sakin bir tür.',
  'Bumblebee Goby': 'Bombus Kaya Balığı',
  'A tiny goby with bee-like yellow-and-black bands.': 'Arı gibi sarı-siyah bantlarıyla minik bir kaya balığı.',
  'Silver Dollar Fish': 'Gümüş Dolar Balığı',
  'Its flat, round body resembles a silver coin.': 'Yassı yuvarlak gövdesiyle gümüş bir madeni parayı andırır.',
  'Rainbow Shark': 'Gökkuşağı Köpekbalığı',
  'A peaceful, shark-shaped species with red fins.': 'Köpekbalığı görünümlü, kırmızı yüzgeçli barışçıl bir tür.',
  'Red-Tailed Black Shark': 'Kırmızı Kuyruklu Köpekbalığı',
  'Known for its jet-black body and flame-red tail.': 'Simsiyah gövdesi ve alev kırmızısı kuyruğuyla tanınır.',
  'Clown Loach': 'Palyaço Yılan Balığı',
  "The tank's playful clown, with orange-and-black bands.": 'Turuncu-siyah bantlarıyla akvaryumun hareketli palyaçosu.',
  'Yoyo Loach': 'Yoyo Yılan Balığı',
  'Named for the Y- and X-shaped markings on its back.': 'Sırtındaki Y ve X şekilli desenlerden adını alır.',
  'Blue Gourami': 'Mavi Gurami',
  'Glides through calm waters with a powder-blue body.': 'Pudra mavisi gövdesiyle sakin sularda süzülür.',
  'Threadfin Acara': 'İplik Yüzgeç Akara',
  'A small cichlid jewel with turquoise-gold shimmering scales.': 'Turkuaz-altın parıltılı pullarıyla küçük bir çiklit mücevheri.',
  'Electric Blue Ram': 'Elektrik Mavi Ram',
  'Famous for an intense electric-blue color rarely seen in nature.': 'Doğada nadir görülen yoğun elektrik mavisi rengiyle ünlü.',
  'Bolivian Ram': 'Bolivya Ram Çiklit',
  'A calm-tempered cichlid with a black stripe through its eye.': 'Gözünden geçen siyah çizgisiyle sakin huylu bir çiklit.',
  'Neon Rainbowfish': 'Neon Gökkuşağı Balığı',
  'Lights up the tank with a metallic turquoise-green shimmer.': 'Turkuaz-yeşil metalik parıltısıyla akvaryumu aydınlatır.',
  'Yellowtail Blue Damsel': 'Sarı Kuyruklu Mavi Damla',
  'A reef dweller with a deep blue body and bright yellow tail.': 'Koyu mavi gövdesi ve parlak sarı kuyruğuyla resif sakini.',

  // ---- Real species: rare ----
  'Flowerhorn Cichlid': 'Çiçek Boynuzlu Çiklit',
  'A special hybrid cichlid with a pronounced forehead hump and vivid pink color.': 'Alnındaki belirgin hörgücü ve canlı pembe rengiyle özel bir melez çiklit.',
  'Peacock Bass': 'Tavus Levrek',
  'A river predator with a powerful build and an eyespot on its tail.': 'Güçlü yapısı ve göz benekli kuyruğuyla nehirlerin avcısı.',
  'Green Terror Cichlid': 'Yeşil Terör Çiklit',
  'Despite its name, it brings a stunning turquoise-green shimmer to the tank.': 'Adının aksine akvaryumda görkemli bir turkuaz-yeşil parıltı sunar.',
  'Oscar Fish': 'Oskar Balığı',
  'A hobbyist favorite for its intelligence and interactive nature.': 'Zeki ve etkileşimli yapısıyla akvaryumcuların gözdesi.',
  'Severum Cichlid': 'Severum Çiklit',
  'A calm, large cichlid in gold-green tones.': 'Altın-yeşil tonlarıyla sakin, iri bir çiklit.',
  'Uaru Cichlid': 'Uaru Çiklit',
  'Stands out as a juvenile with chocolate-brown blotches.': 'Genç halinde çikolata kahvesi lekeleriyle dikkat çeker.',
  'Blue Acara': 'Mavi Akara',
  "South America's elegant cichlid, with turquoise-shimmering scales.": "Turkuaz parıltılı pullarıyla Güney Amerika'nın zarif çikliti.",
  'Texas Cichlid': 'Teksas Çiklit',
  'Known for pearl-flecked, shimmering turquoise scales.': 'İnci gibi parlayan benekli turkuaz pullarıyla tanınır.',
  'Parrot Cichlid': 'Papağan Çiklit',
  "A natural cichlid species with a mouth resembling a parrot's beak.": 'Papağan gagasını andıran ağzıyla doğal bir çiklit türü.',
  'Blood Parrot Cichlid': 'Kan Papağanı Çiklit',
  'A striking hybrid with a vivid red-orange, round body.': 'Canlı kırmızı-turuncu yuvarlak gövdesiyle dikkat çekici bir melez.',
  'Frontosa Cichlid': 'Frontosa Çiklit',
  "Lake Tanganyika's noble fish, with a forehead hump and bold bands.": "Alnındaki hörgücü ve dik bantlarıyla Tanganyika Gölü'nün asil balığı.",
  'Malawi Peacock Cichlid': 'Malawi Tavus Çiklit',
  "Lake Malawi's jewel, with a metallic purple-blue shimmer.": "Mor-mavi metalik parıltısıyla Malawi Gölü'nün mücevheri.",
  'Electric Yellow Cichlid': 'Elektrik Sarı Çiklit',
  'Shines like sunshine in the tank with its bright yellow body.': 'Parlak sarı gövdesiyle akvaryumda güneş gibi parlar.',
  'Venustus Cichlid': 'Venustus Çiklit',
  'A majestic Malawi cichlid with a blue face and sandy-gold body.': 'Mavi yüzü ve kumlu altın gövdesiyle görkemli bir Malawi çikliti.',
  'Red Empress Cichlid': 'Kızıl İmparatoriçe Çiklit',
  'An extraordinary cichlid whose body shifts from flame-red to blue.': 'Alev kırmızısından maviye geçen gövde rengiyle olağanüstü bir çiklit.',
  'Tropheus Duboisi': 'Tropheus Duboisi',
  'A Lake Tanganyika classic, with a white band across its jet-black body.': "Jet siyahı gövdesindeki beyaz bandıyla Tanganyika Gölü'nün klasiği.",
  'Tiger Oscar': 'Kaplan Oskar',
  'A charismatic Oscar variety with an orange-and-black tiger pattern.': 'Turuncu-siyah kaplan desenli, karizmatik bir Oskar varyetesi.',

  // ---- Real species: epic ----
  'Blue Tang': 'Mavi Cerrah Balığı',
  "The ocean's most recognizable blue-and-yellow star.": 'Okyanusun en tanınan mavi-sarı desenli yıldızı.',
  'Yellow Tang': 'Sarı Cerrah Balığı',
  'Famous for its pure yellow body that glows on the reef.': 'Resiflerde parlayan saf sarı gövdesiyle ünlü.',
  'Emperor Angelfish': 'İmparator Melek Balığı',
  "The reef's noble resident, earning blue-and-yellow stripes in adulthood.": 'Yetişkinlikte kazandığı mavi-sarı şeritleriyle resifin asil sakini.',
  'Queen Angelfish': 'Kraliçe Melek Balığı',
  'Earns its name with a crown-shaped marking on its head.': 'Başındaki taç desenli benekle adını hak eder.',
  'Moorish Idol': 'Mağribi Put Balığı',
  'A reef icon with a long dorsal fin and banded pattern.': 'Uzun sırt yüzgeci ve bant desenleriyle resiflerin sembolü.',
  'Picasso Triggerfish': 'Picasso Balistesi',
  'Looks hand-painted with its geometric, multicolored pattern.': 'Geometrik çok renkli deseniyle sanki fırçayla boyanmış gibidir.',
  'Powder Blue Tang': 'Toz Mavisi Cerrah',
  'An icon of elegance with a powder-blue body and yellow dorsal fin.': 'Pudra mavisi gövdesi ve sarı sırt yüzgeciyle şıklığın simgesi.',
  'Foxface Rabbitfish': 'Tilki Yüz Tavşan Balığı',
  'A calm-tempered species with a fox-like face, despite its venomous spines.': 'Zehirli dikenlerine rağmen sakin huylu, tilkiyi andıran yüzlü bir tür.',
  'Harlequin Tuskfish': 'Arlekin Diş Balığı',
  "The reef's rare toothy gem, with vivid orange-blue gradients.": 'Canlı turuncu-mavi renk geçişleriyle resifin nadide dişlisi.',
  'Copperband Butterflyfish': 'Bakır Bantlı Kelebek Balığı',
  'An elegant butterflyfish with a long snout and copper bands.': 'Uzun burnu ve bakır bantlarıyla zarif bir kelebek balığı.',
  'Bicolor Angelfish': 'İki Renkli Melek Balığı',
  'Stands out with a sharp split of yellow and blue.': 'Yarısı sarı yarısı mavi keskin renk ayrımıyla dikkat çeker.',
  'Achilles Tang': 'Akhilleus Cerrahı',
  "One of the reef's most prized tangs, with a fiery orange patch on its tail.": 'Kuyruğundaki alev turuncusu lekesiyle resifin en değerli cerrahlarından.',

  // ---- Real species: legendary ----
  'Platinum Arowana': 'Platin Arowana',
  "A collector's dream, with flawless silver-white scales.": 'Pürüzsüz gümüş-beyaz pullarıyla koleksiyonerlerin rüyası.',
  'Red Arowana': 'Kırmızı Arowana',
  'Prized as a fortune in Asia for its metallic red scales.': "Metalik kızıl pullarıyla Asya'da servet değerinde sayılır.",
  'Silver Arowana': 'Gümüş Arowana',
  'A legend gliding through the water on broad, paddle-like fins.': 'Geniş kürek yüzgeçleriyle suda süzülen bir efsane.',
  'Napoleon Wrasse': 'Napolyon Dudak Balığı',
  "The reef's king, with a massive size and a forehead hump.": 'Devasa boyutu ve alnındaki hörgücüyle resiflerin kralı.',
  'Peppermint Angelfish': 'Nane Melek Balığı',
  "One of the world's rarest angelfish, living in deep waters.": 'Derin sularda yaşayan, dünyanın en nadir melek balıklarından biri.',
  'Masked Angelfish': 'Maskeli Melek Balığı',
  'A white legend with a black mask, found only in Hawaiian waters.': 'Sadece Hawaii sularında bulunan, siyah maskeli beyaz bir efsane.',
  'Golden Basslet': 'Altın Bas Balığı',
  'A rare species with a brilliant gold color, living in deep reef caves.': 'Derin resif mağaralarında yaşayan parlak altın rengiyle nadir bir tür.',
  'Swalesi Basslet': 'Bıçak Yüzgeçli Bas Balığı',
  'Known as one of the most expensive aquarium fish in the world.': 'Dünyanın en pahalı akvaryum balıklarından biri olarak bilinir.',

  // ---- Eggs ----
  'Bronze Egg': 'Bronz Yumurta',
  'A starter surprise. Small but full of hope.': 'Başlangıç sürprizi. Küçük ama umut dolu.',
  'Silver Egg': 'Gümüş Yumurta',
  'Good odds of hatching a rare friend.': 'İçinden nadir bir dost çıkma ihtimali yüksek.',
  'Golden Egg': 'Altın Yumurta',
  'Legends are born from this egg. Guaranteed legendary every 8th egg!': 'Efsaneler bu yumurtadan doğar. Her 8. yumurtada efsanevi garanti!',

  // ---- Tanks ----
  'Coral Cove': 'Mercan Koyu',
  'The warm, safe cove where it all begins.': 'Her şeyin başladığı sıcak, güvenli koy.',
  'Golden Sands': 'Altın Kumsal',
  'Shallow waters where the sun warms the sand.': 'Güneşin kumları ısıttığı sığ sular.',
  'Kelp Garden': 'Yosun Bahçesi',
  'A lush, thriving underwater garden.': 'Yemyeşil, bereketli bir su bahçesi.',
  'Shallow Reef': 'Sığ Resif',
  'The busiest neighborhood of colorful corals.': 'Renkli mercanların en kalabalık mahallesi.',
  'Cove Mouth': 'Koy Ağzı',
  'The gateway to the open sea.': 'Açık denize açılan kapı.',
  'Turquoise Lagoon': 'Turkuaz Lagün',
  'A paradise straight off a postcard.': 'Kartpostallardan fırlamış bir cennet.',
  'Mangrove Shore': 'Mangrov Kıyısı',
  'Fish playing hide-and-seek among the roots.': 'Köklerin arasında saklambaç oynayan balıklar.',
  'Tide Pool': 'Gelgit Havuzu',
  'A tiny world renewed with every tide.': 'Her gelgitte yenilenen minik bir dünya.',
  'Pearl Beds': 'İnci Yatakları',
  'Pearly waters where oysters whisper.': 'İstiridyelerin fısıldaştığı sedefli sular.',
  'Storm Point': 'Fırtına Burnu',
  'Choppy waters that test the boldest fish.': 'Cesur balıkların sınandığı dalgalı sular.',
  'Shipwreck Cove': 'Batık Koyu',
  'A cove that keeps the stories of old ships.': 'Eski gemilerin hikâyelerini saklayan koy.',
  'Crystal Cave': 'Kristal Mağara',
  'A hidden cave with crystals hanging from its ceiling.': 'Tavanından kristaller sarkan gizli mağara.',
  'Underwater Canyon': 'Su Altı Kanyonu',
  'A deep rift whose walls echo endlessly.': 'Duvarları yankıyla dolu derin yarık.',
  'Glacier Shore': 'Buzul Kıyısı',
  'A silent world of ice-blue waters.': 'Buz mavisi suların sessiz dünyası.',
  'Sunset Reef': 'Gün Batımı Resifi',
  'Sunset happens even beneath the waves.': 'Suyun altında bile gün batımı yaşanır.',
  'Abyss Gate': 'Abis Kapısı',
  'The border where light fades and mystery grows.': 'Işığın azaldığı, gizemin arttığı sınır.',
  'Volcanic Bed': 'Volkanik Yatak',
  'A mineral paradise fed by hot vents.': 'Sıcak kaynakların beslediği mineral cenneti.',
  'Under the Iceberg': 'Aysberg Altı',
  'In the blue shadow of a towering iceberg.': 'Dev buz dağının mavi gölgesinde.',
  'Ancient City': 'Antik Şehir',
  'A lost city whose pillars still stand.': 'Sütunları hâlâ ayakta duran kayıp şehir.',
  'Glowing Valley': 'Işıldayan Vadi',
  'A valley where every creature carries its own light.': 'Her canlının kendi ışığını taşıdığı vadi.',
  'Moon Lagoon': 'Ay Lagünü',
  'A legendary lagoon where moonlight never fades.': 'Ay ışığının hiç sönmediği efsanevi lagün.',
  'Golden Palace': 'Altın Saray',
  'The golden throne of a sunken empire.': 'Batık bir imparatorluğun altın tahtı.',
  'Ghost Ship': 'Hayalet Gemisi',
  'A ship that never sinks, seen through the mist.': 'Sisin içinden görünen, asla batmayan gemi.',
  'Coral Throne': 'Mercan Tahtı',
  "The reef kingdom's heart. Open only to legends.": 'Resif krallığının kalbi. Sadece efsanelere açık.',
  'Infinity Pool': 'Sonsuzluk Havuzu',
  "Water with no horizon. Reefy's greatest secret.": "Ufku olmayan su. Reefy'nin en büyük sırrı.",

  // ---- Decor: kelp ----
  'Kelp': 'Yosun',
  'A living plant that dances with the water.': 'Suyla dans eden canlı bitki.',
  'Green Kelp': 'Yeşil Yosun', 'Dark Kelp': 'Koyu Yosun', 'Red Kelp': 'Kızıl Yosun',
  'Golden Kelp': 'Altın Yosun', 'Purple Kelp': 'Mor Yosun', 'Neon Kelp': 'Neon Yosun', 'Glowing Kelp': 'Işıl Yosun',
  // ---- Decor: sword plant ----
  'Sword Plant': 'Kılıç Bitkisi',
  'An elegant aquarium plant with upright leaves.': 'Dik yapraklı zarif akvaryum bitkisi.',
  'Green Sword Plant': 'Yeşil Kılıç Bitkisi', 'Lemon Sword Plant': 'Limon Kılıç Bitkisi',
  'Burgundy Sword Plant': 'Bordo Kılıç Bitkisi', 'Mottled Sword Plant': 'Alacalı Kılıç Bitkisi',
  'Crystal Sword Plant': 'Kristal Kılıç Bitkisi',
  // ---- Decor: coral cluster ----
  'Coral Cluster': 'Mercan Kümesi',
  'A colorful bed of soft coral.': 'Rengarenk yumuşak mercan yatağı.',
  'Pink Coral Cluster': 'Pembe Mercan Kümesi', 'Rose Coral Cluster': 'Gül Mercan Kümesi',
  'Orange Coral Cluster': 'Turuncu Mercan Kümesi', 'Lilac Coral Cluster': 'Lila Mercan Kümesi',
  'Turquoise Coral Cluster': 'Turkuaz Mercan Kümesi', 'Rainbow Coral Cluster': 'Gökkuşağı Mercan Kümesi',
  'Crystal Coral Cluster': 'Kristal Mercan Kümesi',
  // ---- Decor: tube coral ----
  'Tube Coral': 'Boru Mercanı',
  'A colony formed of upright tubes.': 'Dik boruların oluşturduğu koloni.',
  'Orange Tube Coral': 'Turuncu Boru Mercanı', 'Yellow Tube Coral': 'Sarı Boru Mercanı',
  'Red Tube Coral': 'Kırmızı Boru Mercanı', 'Blue Tube Coral': 'Mavi Boru Mercanı', 'Midnight Tube Coral': 'Gece Boru Mercanı',
  // ---- Decor: fan coral ----
  'Fan Coral': 'Yelpaze Mercanı',
  'An elegant fan swaying in the current.': 'Akıntıda sallanan zarif yelpaze.',
  'Red Fan Coral': 'Kızıl Yelpaze Mercanı', 'Purple Fan Coral': 'Mor Yelpaze Mercanı',
  'Amber Fan Coral': 'Amber Yelpaze Mercanı', 'Pearl Fan Coral': 'İnci Yelpaze Mercanı',
  // ---- Decor: anemone ----
  'Anemone': 'Anemon',
  "A clownfish's home.": 'Palyaço balıklarının yuvası.',
  'Pink Anemone': 'Pembe Anemon', 'Green Anemone': 'Yeşil Anemon', 'Purple Anemone': 'Mor Anemon',
  'Fire Anemone': 'Ateş Anemon', 'Royal Anemone': 'Kraliyet Anemon',
  // ---- Decor: rock ----
  'Rock': 'Kaya',
  'A natural-looking decorative rock.': 'Doğal görünümlü dekoratif kaya.',
  'Gray Rock': 'Gri Kaya', 'Sandstone Rock': 'Kumtaşı Kaya', 'Basalt Rock': 'Bazalt Kaya',
  'Mossy Rock': 'Yosunlu Kaya', 'Lava Rock': 'Lav Kaya', 'Amethyst Rock': 'Ametist Kaya',
  // ---- Decor: rock arch ----
  'Rock Arch': 'Kaya Kemeri',
  'An arch fish love swimming through.': 'Balıkların içinden geçmeyi sevdiği kemer.',
  'Gray Rock Arch': 'Gri Kaya Kemeri', 'Sandstone Rock Arch': 'Kumtaşı Kaya Kemeri',
  'Coral-Crusted Rock Arch': 'Mercanlı Kaya Kemeri',
  // ---- Decor: sea shell ----
  'Sea Shell': 'Deniz Kabuğu',
  'A giant oyster shell.': 'Dev istiridye kabuğu.',
  'Beige Sea Shell': 'Bej Deniz Kabuğu', 'Pink Sea Shell': 'Pembe Deniz Kabuğu',
  'Mother-of-Pearl Sea Shell': 'Sedef Deniz Kabuğu', 'Pearled Sea Shell': 'İncili Deniz Kabuğu',
  'Golden Sea Shell': 'Altın Deniz Kabuğu',
  // ---- Decor: starfish ----
  'Starfish': 'Denizyıldızı',
  'A cute star resting on the sand.': 'Kumda dinlenen sevimli yıldız.',
  'Orange Starfish': 'Turuncu Denizyıldızı', 'Red Starfish': 'Kırmızı Denizyıldızı',
  'Blue Starfish': 'Mavi Denizyıldızı', 'Purple Starfish': 'Mor Denizyıldızı', 'Golden Starfish': 'Altın Denizyıldızı',
  // ---- Decor: treasure chest ----
  'Treasure Chest': 'Hazine Sandığı',
  'A mysterious chest that bubbles from within.': 'İçinden kabarcık çıkan gizemli sandık.',
  'Wooden Treasure Chest': 'Ahşap Hazine Sandığı', 'Iron Treasure Chest': 'Demir Hazine Sandığı',
  'Golden Treasure Chest': 'Altın Hazine Sandığı',
  // ---- Decor: shipwreck ----
  'Shipwreck': 'Batık',
  'The remains of a legendary ship.': 'Efsanevi bir geminin kalıntısı.',
  'Fishing Boat Wreck': 'Balıkçı Teknesi Batık', 'Galleon Wreck': 'Kalyon Batık',
  // ---- Decor: ancient column ----
  'Ancient Column': 'Antik Sütun',
  'A column left behind by a lost civilization.': 'Kayıp bir uygarlıktan kalan sütun.',
  'Marble Ancient Column': 'Mermer Antik Sütun', 'Ruined Ancient Column': 'Yıkık Antik Sütun',
  'Mossy Ancient Column': 'Yosunlu Antik Sütun',
  // ---- Decor: statue ----
  'Statue': 'Heykel',
  'A work of art on the seafloor.': 'Denizin dibinde bir sanat eseri.',
  'Mermaid Statue': 'Denizkızı Heykel', 'Poseidon Statue': 'Poseidon Heykel', 'Golden Fish Statue': 'Altın Balık Heykel',
  // ---- Decor: castle ----
  'Castle': 'Kale',
  'A classic aquarium castle.': 'Klasik akvaryum şatosu.',
  'Stone Castle': 'Taş Kale', 'Coral Castle': 'Mercan Kale',
  // ---- Decor: giant skull ----
  'Giant Skull': 'Dev Kafatası',
  "A pirate's favorite haunt.": 'Korsanların uğrak noktası.',
  'Ancient Giant Skull': 'Kadim Dev Kafatası',
  // ---- Decor: amphora ----
  'Amphora': 'Amfora',
  'A jar left behind by ancient trading ships.': 'Antik ticaret gemilerinden kalan testi.',
  'Clay Amphora': 'Toprak Amfora', 'Tipped Amphora': 'Devrik Amfora',
  'Patterned Amphora': 'Desenli Amfora', 'Royal Amphora': 'Kraliyet Amfora',
  // ---- Decor: lantern ----
  'Lantern': 'Fener',
  'Adds a warm beam of light to the water.': 'Suya sıcak bir ışık huzmesi ekler.',
  'Copper Lantern': 'Bakır Fener', 'Lighthouse Lantern': 'Deniz Feneri Fener',
  'Moonlight Lantern': 'Ay Işığı Fener', 'Sun Lantern': 'Güneş Fener',
  // ---- Decor: bubble stone ----
  'Bubble Stone': 'Kabarcık Taşı',
  'Continuously produces bubbles, bringing life to the water.': 'Sürekli kabarcık üretir, suya hayat katar.',
  'Mini Bubble Stone': 'Mini Kabarcık Taşı', 'Volcano Bubble Stone': 'Volkan Kabarcık Taşı',
  'Crystal Bubble Stone': 'Kristal Kabarcık Taşı',
  // ---- Decor: sign ----
  'Sign': 'Tabela',
  'A tiny sign that adds personality to your reef.': 'Resifine kişilik katan minik tabela.',
  '"Fish Crossing" Sign': '"Balık Geçidi" Tabela', '"No Diving" Sign': '"Dalış Yasak" Tabela',
  '"Reefy" Sign': '"Reefy" Tabela',

  // ---- Feeds ----
  'Basic Feed': 'Standart Yem',
  'Free and filling. No bonus.': 'Ücretsiz, doyurucu. Bonus vermez.',
  'Tasty Feed': 'Lezzet Yemi',
  '15% chance to add +3% to sale price.': '%15 şansla satış fiyatına +%3 ekler.',
  'Golden Feed': 'Altın Yem',
  '30% chance to add +6% to sale price.': '%30 şansla satış fiyatına +%6 ekler.',

  // ---- Daily quests ----
  'Feed your fish 20 times': 'Balıklarına 20 yem yedir',
  'Feed your fish 50 times': 'Balıklarına 50 yem yedir',
  'Sell 3 fish': '3 balık sat',
  'Sell 6 fish': '6 balık sat',
  'Hatch 1 egg': '1 yumurta aç',
  'Hatch 2 eggs': '2 yumurta aç',
  'Buy 2 new fish': '2 yeni balık satın al',
  'Place 1 decoration': '1 dekor yerleştir',
  'Earn 2,000 coins': '2.000 altın kazan',
  'Add 1 species to your collection': 'Koleksiyona 1 tür ekle',
  'Clean 3 dirt spots': '3 kir lekesi temizle',
  'Feed your fish 80 times': 'Balıklarına 80 yem yedir',
  'Sell 10 fish': '10 balık sat',
  'Hatch 3 eggs': '3 yumurta aç',
  'Buy 4 new fish': '4 yeni balık satın al',
  'Place 2 decorations': '2 dekor yerleştir',
  'Earn 5,000 coins': '5.000 altın kazan',
  'Add 2 species to your collection': 'Koleksiyona 2 tür ekle',
  'Clean 6 dirt spots': '6 kir lekesi temizle',
  // ---- Weekly quests ----
  'Feed 200 times this week': 'Bu hafta 200 yem yedir',
  'Sell 20 fish this week': 'Bu hafta 20 balık sat',
  'Earn 20,000 coins this week': 'Bu hafta 20.000 altın kazan',
  'Hatch 10 eggs this week': 'Bu hafta 10 yumurta aç',
  'Clean 15 dirt spots this week': 'Bu hafta 15 kir lekesi temizle',
  'Add 5 species to your collection this week': 'Bu hafta koleksiyona 5 tür ekle',
  'Buy 12 new fish this week': 'Bu hafta 12 yeni balık satın al',
  'Place 8 decorations this week': 'Bu hafta 8 dekor yerleştir',

  // ---- Achievements ----
  'First Sale': 'İlk Satış', 'Sell your first fish': 'İlk balığını sat',
  'Shopkeeper': 'Esnaf',
  'Fish Trader': 'Balık Tüccarı', 'Sell 50 fish': '50 balık sat',
  'Reef Baron': 'Resif Baronu', 'Sell 200 fish': '200 balık sat',
  'First Earnings': 'İlk Kazanç', 'Earn 1,000 coins total': 'Toplamda 1.000 altın kazan',
  'First Savings': 'İlk Birikim', 'Earn 5,000 coins total': 'Toplamda 5.000 altın kazan',
  'Small Fortune': 'Küçük Servet', 'Earn 20,000 coins total': 'Toplamda 20.000 altın kazan',
  'Rich Waters': 'Zengin Sular', 'Earn 75,000 coins total': 'Toplamda 75.000 altın kazan',
  'Coral Treasure': 'Mercan Hazinesi', 'Earn 250,000 coins total': 'Toplamda 250.000 altın kazan',
  'Reef Tycoon': 'Resif Zengini', 'Earn 750,000 coins total': 'Toplamda 750.000 altın kazan',
  'Deep Pockets': 'Derin Cüzdan', 'Earn 2,000,000 coins total': 'Toplamda 2.000.000 altın kazan',
  'Ocean Treasure': 'Okyanus Hazinesi', 'Earn 6,000,000 coins total': 'Toplamda 6.000.000 altın kazan',
  'Legendary Fortune': 'Efsanevi Servet', 'Earn 20,000,000 coins total': 'Toplamda 20.000.000 altın kazan',
  'Treasure of Eternity': 'Sonsuzluk Hazinesi', 'Earn 60,000,000 coins total': 'Toplamda 60.000.000 altın kazan',
  'Apprentice Keeper': 'Çırak Bakıcı', 'Reach level 5': "Seviye 5'e ulaş",
  'Master Keeper': 'Usta Bakıcı', 'Reach level 10': "Seviye 10'a ulaş",
  'Reef Legend': 'Resif Efsanesi', 'Reach level 20': "Seviye 20'ye ulaş",
  'Curious': 'Meraklı', 'Add 10 species to your collection': 'Koleksiyona 10 tür ekle',
  'Naturalist': 'Doğa Bilimci', 'Add 30 species to your collection': 'Koleksiyona 30 tür ekle',
  'Encyclopedist': 'Ansiklopedist', 'Add 60 species to your collection': 'Koleksiyona 60 tür ekle',
  'Heart of the Ocean': 'Okyanusun Kalbi', 'Collect all 100 species': 'Tüm 100 türü topla',
  'Lucky Hand': 'Şanslı El', 'Hatch 10 eggs': '10 yumurta aç',
  'Decorator': 'Dekoratör', 'Place 5 decorations': '5 dekor yerleştir',
  'Interior Designer': 'İç Mimar', 'Place 20 decorations': '20 dekor yerleştir',
  'Traveler': 'Gezgin', 'Own 3 tanks': '3 akvaryuma sahip ol',
  'Ocean Emperor': 'Okyanus İmparatoru', 'Own 10 tanks': '10 akvaryuma sahip ol',
  'Loyal Friend': 'Sadık Dost', 'Play 7 days in a row': '7 gün üst üste oyna',
  'Cleaner': 'Temizlikçi', 'Clean 25 dirt spots': '25 kir lekesi temizle',
  'Devoted Feeder': 'Sadık Besleyici', 'Feed a total of 500 times': 'Toplam 500 yem ver',
  'Feeding Master': 'Yem Ustası', 'Feed a total of 2,000 times': 'Toplam 2.000 yem ver',
  'Palace Architect': 'Saray Mimarı', 'Place 50 decorations': '50 dekor yerleştir',
  'Social Butterfly': 'Sosyal Kelebek', 'Add 5 friends': '5 arkadaş ekle',
  'Reef Community': 'Resif Topluluğu', 'Add 25 friends': '25 arkadaş ekle',
  'Monthly Friend': 'Aylık Dost', 'Play 30 days in a row': '30 gün üst üste oyna',

  // ---- Main menu ----
  'Build your own reef, grow your fish,\ncomplete your collection': 'Kendi resifini kur, balıklarını büyüt,\nkoleksiyonunu tamamla',
  'Play': 'Oyna',

  // ---- Fish growth stages (fish.ts) ----
  'Adult': 'Yetişkin', 'Young': 'Genç', 'Baby': 'Yavru',

  // ---- game.ts: game messages ----
  'No income collected yet': 'Henüz birikmiş gelir yok',
  '+{n} coins collected! 🪙': '+{n} altın toplandı! 🪙',
  '🎉 {name} grew up! Tap it to sell.': '🎉 {name} yetişkin oldu! Satmak için üzerine dokun.',
  '🎉 {name} grew up in {tank}!': '🎉 {name}, {tank} akvaryumunda yetişkin oldu!',
  '📖 Added to collection: {name}': '📖 Koleksiyona eklendi: {name}',
  '✨ {rarity} set complete! +15 pearls, permanent +5% to sales': '✨ {rarity} seti tamamlandı! +15 inci, satışlara kalıcı +%5',
  '✅ Quest complete: {name} — claim your reward from Quests!': "✅ Görev tamamlandı: {name} — ödülünü Görevler'den al!",
  '🏅 Weekly quest complete: {name} — claim your reward from Quests!': "🏅 Haftalık görev tamamlandı: {name} — ödülünü Görevler'den al!",
  'Quest not completed yet.': 'Görev henüz tamamlanmadı.',
  'Reward already claimed.': 'Ödül zaten alındı.',
  '+{coins} coins': '+{coins} altın',
  ', +{n} pearls': ', +{n} inci',
  'Weekly quest not completed yet.': 'Haftalık görev henüz tamamlanmadı.',
  'Weekly reward: +{coins} coins': 'Haftalık ödül: +{coins} altın',
  'Unknown achievement': 'Bilinmeyen başarım',
  'Achievement not completed yet.': 'Başarım henüz tamamlanmadı.',
  '{name}: +{coins} coins, +{pearls} pearls': '{name}: +{coins} altın, +{pearls} inci',
  '🧹 Dirt cleaned! +{n} coins': '🧹 Leke temizlendi! +{n} altın',
  '🧹 {spots} dirt spots cleaned! +{n} coins': '🧹 {spots} leke temizlendi! +{n} altın',
  'Not enough coins ({name}: {cost} 🪙 each)': 'Yeterli altın yok ({name}: {cost} 🪙/tane)',
  'Unknown pack': 'Bilinmeyen paket',
  'Not enough coins': 'Yeterli altın yok',
  '{qty} × {name} added to your bag! 🎒': '{qty} × {name} çantana eklendi! 🎒',
  'This tank is full ({cap} fish)': 'Bu akvaryum dolu ({cap} balık)',
  'Not enough pearls': 'Yeterli inci yok',
  'Level {n} required': 'Seviye {n} gerekli',
  '{name} joined the tank! 🐟': '{name} akvaryuma katıldı! 🐟',
  'Still a baby — wait for it to grow': 'Henüz yavru — büyümesini bekle',
  '{name} sold: +{n} coins': '{name} satıldı: +{n} altın',
  'Fish not found': 'Balık bulunamadı',
  "You don't have this decoration in your inventory": 'Envanterinde bu dekordan yok',
  'This tank can hold at most {n} decorations': 'Bu akvaryumda en fazla {n} dekor olabilir',
  '{name} placed (+{n}% growth & income)': '{name} yerleştirildi (+%{n} büyüme & gelir)',
  '{name} added to your inventory! 🎒 Place it from your Inventory.': '{name} envanterine eklendi! 🎒 Envanterden yerleştir.',
  'Decoration not found': 'Dekor bulunamadı',
  '{name} returned to your bag': '{name} envantere geri alındı',
  'You already own this tank': 'Bu akvaryuma zaten sahipsin',
  '{name} is now yours! 🏝️ Switch to it from your Inventory.': '{name} artık senin! 🏝️ Envanterden geçiş yapabilirsin.',
  'You need to buy this tank first': 'Önce bu akvaryumu satın almalısın',
  "You're already in this tank": 'Zaten bu akvaryumdasın',
  'Fish is already in this tank': 'Balık zaten bu akvaryumda',
  '{name} is full ({cap} fish)': '{name} dolu ({cap} balık)',
  '{name} moved to {tank} 🌊': '{name}, {tank} akvaryumuna taşındı 🌊',
  '⭐ Level {n}! +3 pearls, capacity {cap} fish': '⭐ Seviye {n}! +3 inci, kapasite {cap} balık',
  '🐟 +{n} capacity': '🐟 +{n} kapasite',
  'Friend not found': 'Arkadaş bulunamadı',
  "You've already visited this friend today.": 'Bu arkadaşı bugün zaten ziyaret ettin.',
  'You visited the tank: +{coins} coins, +{xp} XP 🤝': 'Akvaryumu ziyaret ettin: +{coins} altın, +{xp} XP 🤝',
  "You've already petted a fish today. Come back tomorrow! 💕": 'Bugün zaten bir balığını okşadın. Yarın tekrar gel! 💕',
  '{name} is happy! +{n} XP, sale value increased 💕': '{name} mutlu oldu! +{n} XP, satış değeri arttı 💕',
  "You've already sent this friend a gift today.": 'Bu arkadaşına bugün zaten hediye gönderdin.',
  'Gift sent! You received +{qty} {feed} in return 🎁': 'Hediye gönderildi! Karşılığında +{qty} {feed} kazandın 🎁',

  // ---- services.ts ----
  'Guest (local save)': 'Misafir (yerel kayıt)',
  'Google Play Games / Game Center sign-in is enabled in the mobile build. For now your progress is safely stored on this device.': 'Google Play Games / Game Center girişi mobil pakette etkinleşir. Şimdilik ilerlemen bu cihazda güvenle saklanıyor.',
  'Signed in to {platform}: {name} 🎮': "{platform}'a giriş yapıldı: {name} 🎮",
  '{platform} sign-in failed. Check whether your account is signed in on this device.': '{platform} girişi başarısız. Hesabın cihazda oturum açık mı kontrol et.',
  'Handful of Pearls': 'Avuç İnci',
  '+15% bonus': '+%15 bonus',
  'Pouch of Pearls': 'Kese İnci',
  '+25% bonus': '+%25 bonus',
  'Chest of Pearls': 'Sandık İnci',
  '+40% bonus': '+%40 bonus',
  'Treasure of Pearls': 'Hazine İnci',
  'Starter Pack': 'Başlangıç Paketi',
  '+5,000 coins': '+5.000 altın',
  'Remove Ads': 'Reklamları Kaldır',
  'Permanently removes interstitial ads': 'Geçiş reklamlarını kalıcı olarak kaldırır',
  'Web preview': 'Web önizleme',
  'Real purchases are enabled in the Google Play / App Store build. In this preview, use quests and level rewards to earn pearls.': 'Gerçek satın alma Google Play / App Store sürümünde etkinleşir. Bu önizlemede inci kazanmak için görevleri ve seviye ödüllerini kullanabilirsin.',
  'Unknown pack.': 'Bilinmeyen paket.',
  "{store} connection isn't set up yet. Please try again later.": '{store} bağlantısı henüz kurulmadı. Lütfen daha sonra tekrar dene.',
  "This pack isn't currently available in the store.": 'Bu paket şu anda mağazada bulunamadı.',
  '{name} purchased! 🎉': '{name} satın alındı! 🎉',
  'Purchase canceled.': 'Satın alma iptal edildi.',
  'Purchase failed: {err}': 'Satın alma başarısız: {err}',
  'unknown error': 'bilinmeyen hata',
  'Invalid code. Example format: REEF-AB12C': 'Geçersiz kod. Örnek biçim: REEF-AB12C',
  "That's your own code! 😄": 'Bu senin kendi kodun! 😄',
  'This friend is already on your list.': 'Bu arkadaş zaten listende.',
  'You can add up to {n} friends.': 'En fazla {n} arkadaş ekleyebilirsin.',
  'Local mode — online leaderboard in the mobile build': 'Yerel mod — çevrimiçi liderlik mobil sürümde',
  'Friend code saved! It will auto-match in the online build. 🤝': 'Arkadaş kodu kaydedildi! Çevrimiçi sürümde otomatik eşleşecek. 🤝',
  'Firebase — friend code verification': 'Firebase — arkadaş kodu doğrulanıyor',
  "This code wasn't found. Make sure your friend shared the right code.": 'Bu kod bulunamadı. Arkadaşının doğru kodu paylaştığından emin ol.',
  '{name} added to your friends list! 🤝': '{name} arkadaş listene eklendi! 🤝',
  'There was a connection issue, try again later.': 'Bağlantı sorunu oldu, daha sonra tekrar dene.',
  'Friend': 'Dost',
  'CoralKing 🤖': 'MercanKral 🤖', 'DeepBlue 🤖': 'DerinMavi 🤖', 'CaptainKelp 🤖': 'KaptanYosun 🤖',
  'PearlHunter 🤖': 'İnciAvcısı 🤖', 'PufferFish 🤖': 'BalonBalık 🤖', 'TinyFin 🤖': 'MinikYüzgeç 🤖', 'LazySea 🤖': 'TembelDeniz 🤖',

  // ---- ui.ts: interface ----
  'Feed': 'Besle', 'Shop': 'Mağaza', 'Inventory': 'Envanter', 'Social': 'Sosyal', 'More': 'Daha',
  'Switch tank': 'Akvaryum değiştir', 'Done ✓': 'Bitti ✓',
  'Lv': 'Sv',
  'Dirty — tap to clean the glass': 'Kirli — camı temizlemek için dokun',
  'Press back again to exit': 'Çıkmak için tekrar geri tuşuna bas',
  'Free': 'Ücretsiz',
  '{n} in stock': '{n} stokta',
  '{cost} each': '{cost}/tane',
  '{stock} left': '{stock} kaldı',
  'feed by tapping the water': 'suya dokunarak yemle',
  '🛠️ Drag decorations': '🛠️ Dekoru sürükle',
  '🛠️ Drag a decoration to move it — the last one you drop comes to the front.': '🛠️ Dekoru sürükleyerek taşı — en son bıraktığın en öne gelir.',
  '🐟 Fish': '🐟 Balık', '🥚 Eggs': '🥚 Yumurta', '🍤 Feed': '🍤 Yem', '🪸 Decor': '🪸 Dekor',
  '🏝️ Tank': '🏝️ Akvaryum', '💎 Pearls': '💎 İnci',
  'Sale: 🪙 {price} • {min} min': 'Satış: 🪙 {price} • {min} dk',
  'Legendary guarantee: {cur}/{max}': 'Efsanevi garanti: {cur}/{max}',
  '☁️ Delete my cloud data': '☁️ Bulut verimi sil',
  'Removes the copy of your save in the cloud and your friend-code record. The game on this device is untouched.': 'Buluttaki kayıt kopyanı ve arkadaş kodu kaydını siler. Bu cihazdaki oyuna dokunulmaz.',
  'Delete': 'Sil',
  'Tap again to confirm': 'Onaylamak için tekrar dokun',
  'Deleting…': 'Siliniyor…',
  'Deleted': 'Silindi',
  'Your cloud data has been deleted.': 'Bulut verin silindi.',
  'Could not reach the cloud. Try again later.': 'Buluta ulaşılamadı. Daha sonra tekrar dene.',
  'Coral Festival': 'Mercan Şenliği',
  'The reef celebrates for five days. Everything you already do earns festival points.': 'Resif beş gün boyunca kutlama yapıyor. Zaten yaptığın her şey şenlik puanı kazandırır.',
  '{n} festival points': '{n} şenlik puanı',
  '{n} points': '{n} puan',
  'Ends {day}': 'Bitiş: {day}',
  'Ended — claim what you earned': 'Bitti — kazandığını al',
  "{emoji} Festival tier reached — claim it from Quests!": "{emoji} Şenlik kademesine ulaştın — Görevler'den al!",
  'This festival has ended.': 'Bu şenlik sona erdi.',
  'Not enough festival points yet.': 'Henüz yeterli şenlik puanı yok.',
  'Unknown reward': 'Bilinmeyen ödül',
  'Abyssal Egg': 'Derinlik Yumurtası',
  'The deep keeps no commons. Needs four hours to hatch — or a handful of pearls.': 'Derinlik sıradan balık barındırmaz. Çıkması dört saat sürer — ya da bir avuç inci.',
  'Hatches in {t}': '{t} sonra çıkar',
  'Incubating': 'Kuluçkada',
  'Collect': 'Al',
  'Finish now': 'Hemen bitir',
  'Ready!': 'Hazır!',
  'Egg': 'Yumurta',
  '{n} egg ready': '{n} yumurta hazır',
  '{name} is incubating.': '{name} kuluçkaya girdi.',
  'That egg is gone.': 'O yumurta artık yok.',
  'This egg is still incubating.': 'Bu yumurta hâlâ kuluçkada.',
  'h': 'sa', 'm': 'dk', 's': 'sn',
  'Feed bought in packs is added to your bag as stock and costs <b>less per piece</b> than normal. Once stock runs out, the selected feed keeps being dropped at the normal per-piece coin price.': 'Paketten alınan yem çantana stok olarak girer ve tane başına <b>normalden ucuza</b> gelir. Stok bitince seçili yem, tane başı normal fiyattan altınla atılmaya devam eder.',
  'Per piece 🪙 {price} (normal {cost})': 'Tane başı 🪙 {price} (normal {cost})',
  '+{n}% growth & income': '+%{n} büyüme & gelir',
  'You own this ✓': 'Sahipsin ✓',
  "💎 Pearl packs are purchased with real money. You're in <b>{store}</b> mode — purchases are enabled in the Google Play / App Store build. You can also earn pearls from quests, level-ups, and collection sets.": '💎 İnci paketleri gerçek parayla satın alınır. <b>{store}</b> modundasın — satın alma, Google Play / App Store sürümünde etkinleşir. İnciyi görevlerden, seviye ve set ödüllerinden de kazanabilirsin.',
  'Watch Ad': 'Reklam İzle',
  '🦪 Earn 5 pearls<br/><b>Free</b>': '🦪 5 inci kazan<br/><b>Ücretsiz</b>',
  'Watch': 'İzle',
  '🦪 {n} pearls {bonus}': '🦪 {n} inci {bonus}',
  '🐟 My Fish': '🐟 Balıklarım', '🍤 My Feed': '🍤 Yemlerim', '🪸 My Decor': '🪸 Dekorlarım', '🏝️ My Tanks': '🏝️ Akvaryumlarım',
  'No fish in this tank.': 'Bu akvaryumda balık yok.',
  '😢 hungry': '😢 aç',
  '🌱 growing': '🌱 büyüyor',
  '{n} sell': '{n} sat',
  'out of stock': 'stok yok',
  'Once stock runs out, feed is dropped at the normal per-piece coin price. Packs are cheaper per piece.': 'Stok bittiğinde yem, tane başına normal fiyattan altınla atılır. Paketler tane başına daha ucuzdur.',
  '🛒 Go to feed packs': '🛒 Yem paketlerine git',
  'No decorations in this tank yet.': 'Bu akvaryumda henüz dekor yok.',
  "You don't have any decorations — check the Shop → Decor tab! 🛒": 'Çantanda dekor yok — Mağaza → Dekor sekmesine göz at! 🛒',
  '🛠️ Edit Layout': '🛠️ Yerleşimi Düzenle',
  'In this tank ({n}/{max})': 'Bu akvaryumda ({n}/{max})',
  'In your bag': 'Çantanda',
  'Remove': 'Kaldır', 'Place': 'Yerleştir',
  'You are here 📍': 'Buradasın 📍', 'Switch': 'Geç',
  '🐟 {n}/{cap} fish • +{boost}% growth & income': '🐟 {n}/{cap} balık • +%{boost} büyüme & gelir',
  'New tanks are in the Shop → Tank tab! 🛒': 'Yeni akvaryumlar Mağaza → Akvaryum sekmesinde! 🛒',
  '🏆 Leaderboard': '🏆 Liderlik', '👥 Friends': '👥 Arkadaşlar',
  'Ranked by total earnings.': 'Toplam kazanca göre sıralama.',
  'Your code:': 'Senin kodun:', 'Copy': 'Kopyala',
  'Add': 'Ekle',
  'Your friends': 'Arkadaşların',
  "You haven't added any friends yet.": 'Henüz arkadaş eklemedin.',
  'Visited ✓': 'Ziyaret edildi ✓', 'Visit': 'Ziyaret Et',
  'Gift sent ✓': 'Hediye gönderildi ✓', '🎁 Send Gift': '🎁 Hediye Gönder',
  "Visit each friend once a day to earn coins and XP. Once the online version is connected, you'll be able to see their real tanks. 🤝": 'Her arkadaşı günde bir kez ziyaret ederek altın ve XP kazan. Çevrimiçi sürüm bağlandığında gerçek akvaryumlarını görebileceksin. 🤝',
  'Code copied! Share it with your friends 📋': 'Kod kopyalandı! Arkadaşlarınla paylaş 📋',
  'Quests': 'Görevler', 'Collection': 'Koleksiyon', 'Earnings': 'Kazanç', 'Profile': 'Profil', 'Settings': 'Ayarlar',
  '⭐ Level': '⭐ Seviye', '🐟 Your fish': '🐟 Balıkların', '🏝️ Your tanks': '🏝️ Akvaryumların',
  '📖 Collection': '📖 Koleksiyon', '🏆 Achievements': '🏆 Başarımlar', '🔥 Daily streak': '🔥 Günlük seri',
  '{n} ({xp}/{need} XP)': '{n} ({xp}/{need} XP)',
  '{count}/{total}': '{count}/{total}',
  '{n}/{total} species': '{n}/{total} tür',
  '📊 Lifetime stats': '📊 Ömür boyu istatistikler',
  '🤝 Fish sold': '🤝 Satılan balık', '💰 Total earned': '💰 Toplam kazanç', '🍤 Times fed': '🍤 Yedirilen yem',
  '🥚 Eggs hatched': '🥚 Açılan yumurta', '🪸 Decorations placed': '🪸 Yerleştirilen dekor', '🧹 Dirt cleaned': '🧹 Temizlenen leke',
  'Total output: <b>🪙 {n}/hour</b> • Accumulated: <b>{pot}</b>{cap}.\n      Only adult fish produce; tank + decor bonuses affect output and growth. Dirty tanks fog up the glass and slow production and growth — tap dirt spots to clean them! 🧹': 'Toplam üretim: <b>🪙 {n}/saat</b> • Birikmiş: <b>{pot}</b>{cap}.\n      Yalnızca yetişkin balıklar üretir; akvaryum + dekor bonusu üretime ve büyümeye işler. Kirlenen akvaryumlarda cam bulanıklaşır, üretim ve büyüme yavaşlar — kir lekelerine dokunarak temizle! 🧹',
  ' (cap {n})': ' (tavan {n})',
  '🌱 once grown {n}/hr': '🌱 olunca {n}/sa',
  'Weekly quest': 'Haftalık görev',
  'Claim': 'Al',
  '{n}/100 species collected. A species is added to your collection the first time it reaches adulthood.\n      Each completed set gives a permanent <b>+5% sale bonus</b>. Current bonus: <b>+{n2}%</b>': '{n}/100 tür toplandı. Bir türü ilk kez yetişkinliğe ulaştırdığında koleksiyona eklenir.\n      Tamamlanan her set kalıcı <b>+%5 satış bonusu</b> verir. Şu anki bonus: <b>+%{n2}</b>',
  '✅ +5% sale bonus': '✅ +%5 satış bonusu',
  '👤 Player name': '👤 Oyuncu adı', 'Save': 'Kaydet',
  '🎮 Account': '🎮 Hesap', 'Sign in': 'Giriş yap',
  // Cloud save (settings row + account linking + conflict screen)
  '☁️ Cloud save': '☁️ Bulut kaydı', 'Link': 'Bağla', 'Linked': 'Bağlı',
  'Linked: {who}': 'Bağlı: {who}', 'On mobile': 'Mobil sürümde',
  'Connecting to your Google account…': 'Google hesabına bağlanılıyor…',
  'Account linking is available in the mobile version.': 'Hesap bağlama mobil sürümde kullanılabilir.',
  'Google sign-in was not completed.': 'Google girişi tamamlanmadı.',
  'Google sign-in failed, please try again later.': 'Google girişi başarısız oldu, daha sonra tekrar dene.',
  'Your account is linked — your progress can now be opened on your other devices. ☁️': 'Hesabın bağlandı — ilerlemen artık diğer cihazlarında da açılabilir. ☁️',
  'This account already has saved progress, switched to it.': 'Bu hesabın kayıtlı bir ilerlemesi var, ona geçildi.',
  'Signed in.': 'Giriş yapıldı.',
  'Your progress was restored, restarting…': 'İlerlemen geri yüklendi, yeniden başlatılıyor…',
  '☁️ Two progressions found': '☁️ İki ilerleme bulundu',
  'You have also played on another device with this account. Which one do you want to continue with? The one you do not pick is not deleted, it stays in the cloud.': 'Bu hesapta başka bir cihazda da oynamışsın. Hangisiyle devam etmek istersin? Seçmediğin kayıt silinmez, buluttaki yerinde kalır.',
  'Cloud': 'Bulut', 'This device': 'Bu cihaz', 'Use this one': 'Bunu kullan',
  'Level {n}': 'Seviye {n}', '{n} coins': '{n} altın', '{n} species': '{n} tür',
  'just now': 'şu an', 'moments ago': 'az önce', 'unknown': 'bilinmiyor',
  '{n} minutes ago': '{n} dakika önce', '{n} hours ago': '{n} saat önce', '{n} days ago': '{n} gün önce',
  'Loading the progress from the cloud…': 'Buluttaki ilerleme yükleniyor…',
  'The progress on this device was written to the cloud.': 'Bu cihazdaki ilerleme buluta yazıldı.',
  'The save could not be read, the progress on this device was kept.': 'Kayıt okunamadı, bu cihazdaki ilerleme korundu.',
  '🎵 Music': '🎵 Müzik', 'On': 'Açık', 'Off': 'Kapalı',
  '🔊 Sound Effects': '🔊 Ses Efektleri',
  '📤 Tell your friends': '📤 Arkadaşlarına anlat', 'Share': 'Paylaş',
  '🌐 Language': '🌐 Dil / Language',
  '🗑️ Delete all progress': '🗑️ Tüm ilerlemeyi sil', 'Reset': 'Sıfırla',
  'Reefy v{v} — made with love 🐠': 'Reefy v{v} — sevgiyle yapıldı 🐠',
  'Name must be at least 3 characters': 'İsim en az 3 karakter olmalı',
  'Name updated: {name}': 'İsim güncellendi: {name}',
  'Check out my aquarium! 🐠': 'Akvaryumuma bir bak! 🐠',
  'Link copied! 📋': 'Bağlantı kopyalandı! 📋',
  'All progress will be deleted. Are you sure?': 'Tüm ilerleme silinecek. Emin misin?',
  'Awesome! 🎉': 'Harika! 🎉',
  '🔀 Move to another tank': '🔀 Başka akvaryuma taşı',
  '🐟 {n}/{cap}{boost}{full}': '🐟 {n}/{cap}{boost}{full}',
  ' • +{n}%': ' • +%{n}',
  ' • full': ' • dolu',
  '✏️ Rename': '✏️ Adlandır',
  '🤗 Pet': '🤗 Okşa', '🤗 Petted today': '🤗 Bugün okşadın',
  'Growth ({stage})': 'Büyüme ({stage})',
  'Hunger': 'Tokluk', '😢 hungry!': '😢 aç!',
  'Output: 🪙 {n}/hour {state}': 'Üretim: 🪙 {n}/saat {state}',
  '(active)': '(aktif)', '(once adult)': '(yetişkin olunca)',
  '✨ Feed bonus: sale +{n}%': '✨ Yem bonusu: satış +%{n}',
  '🪙 Sell for {n}': '🪙 {n} karşılığında sat',
  'Growing… wait for it to become an adult to sell 🌱': 'Büyüyor… satmak için yetişkin olmasını bekle 🌱',
  'Name must be at least 2 characters': 'İsim en az 2 karakter olmalı',
  'Name updated: {name} 🐟': 'İsim güncellendi: {name} 🐟',
  'You were away for <b>{n} minutes</b> — your fish kept growing.': 'Sen yokken <b>{n} dakika</b> geçti — balıkların büyümeye devam etti.',
  '🎉 <b>{n} fish</b> grew up, ready to sell!': '🎉 <b>{n} balık</b> yetişkin oldu, satılmaya hazır!',
  "🪙 Your fish produced <b>{n} coins</b> for you — don't forget to collect!": '🪙 Balıkların senin için <b>{n} altın</b> üretti — toplamayı unutma!',
  '🎁 Your daily gift: <b>+{coins} coins, +{pearls} pearls</b>': '🎁 Günlük hediyen: <b>+{coins} altın, +{pearls} inci</b>',
  '🌊 Welcome back!': '🌊 Tekrar hoş geldin!',
  'Dive into your tank 🐠': 'Akvaryuma dal 🐠',
  // ---- ui.ts: first-launch tutorial (mandatory, step by step) ----
  '🌊 Welcome to Reefy!': "🌊 Reefy'ye hoş geldin!",
  'This reef is now yours. Grow your fish, complete your collection, and build your own reef.': 'Bu resif artık senin. Balıklarını büyüt, koleksiyonunu tamamla, kendi resifini kur.',
  '🍤 Learn to feed': '🍤 Beslemeyi öğren',
  'Tap "Feed" in the bottom menu, pick a feed, then tap the water to feed. Quality feed boosts sale price!': 'Alt menüden "Besle"ye dokun, bir yem seç, sonra suya dokunarak yemle. Kaliteli yemler satış fiyatını artırır!',
  '🐟 Sell and grow': '🐟 Satış yap, büyü',
  'Tap adult fish to sell them, then use your earnings to buy new species and grow your reef.': 'Yetişkin olan balıklara dokunup satabilirsin. Kazandığın altınla yeni türler alıp resifini büyütebilirsin.',
  '📋 Daily quests': '📋 Günlük görevler',
  'Complete daily quests, place decorations, and grow your tank to make room for more fish!': 'Günlük görevleri tamamla, dekor yerleştir, akvaryumunu büyüterek daha fazla balığa yer aç!',
  'Next': 'İleri',
  "Let's dive in! 🎉": 'Hadi başlayalım! 🎉',

  // ---- ui.ts: panel titles ----
  '🛒 Shop': '🛒 Mağaza', '🎒 Inventory': '🎒 Envanter', '🏆 Social': '🏆 Sosyal', '☰ Menu': '☰ Menü',
  '📈 Earnings Report': '📈 Kazanç Raporu', '📋 Quests': '📋 Görevler',
  '⚙️ Settings': '⚙️ Ayarlar',
  'Sale': 'Satış',
  '👤 Profile': '👤 Profil',
  'Achievements': 'Başarımlar',
  'Turkish': 'Türkçe', 'English': 'English',
  '(you)': '(sen)',

  // ---- ads.ts ----
  'Ads are enabled in the Google Play / App Store build.': 'Reklamlar Google Play / App Store sürümünde etkinleşir.',
  "The ad system isn't ready yet, try again shortly.": 'Reklam sistemi henüz hazır değil, birazdan tekrar dene.',
  'You just watched an ad, try again in a bit.': 'Az önce bir reklam izledin, biraz sonra tekrar dene.',
  'You exited before finishing the ad, no reward given.': 'Reklamı tamamlamadan çıktın, ödül verilmedi.',
  'You watched the ad! +{n} pearls 🦪': 'Reklamı izledin! +{n} inci 🦪',
  'No ad is available right now, try again later.': 'Şu anda gösterilecek reklam bulunamadı, daha sonra tekrar dene.',
  '/hr': '/sa',

  // ---- Decor adjectives and composed names, plural templates, later additions ----
  '{n} days': '{n} gün',
  '{n}-day streak': '{n} gün seri',
  'Daily quests 🔥 Streak: {n} days': 'Günlük görevler 🔥 Seri: {n} gün',
  '🔥 Streak: <b>{n} days</b> — keep it up and gifts grow bigger!': '🔥 Seri: <b>{n} gün</b> — devam ettikçe hediyeler büyüyor!',
  'Green': 'Yeşil',
  'Dark': 'Koyu',
  'Red': 'Kızıl',
  'Golden': 'Altın',
  'Purple': 'Mor',
  'Neon': 'Neon',
  'Glowing': 'Işıl',
  'Lemon': 'Limon',
  'Burgundy': 'Bordo',
  'Mottled': 'Alacalı',
  'Crystal': 'Kristal',
  'Pink': 'Pembe',
  'Rose': 'Gül',
  'Orange': 'Turuncu',
  'Lilac': 'Lila',
  'Turquoise': 'Turkuaz',
  'Rainbow': 'Gökkuşağı',
  'Yellow': 'Sarı',
  'Blue': 'Mavi',
  'Midnight': 'Gece',
  'Amber': 'Amber',
  'Pearl': 'İnci',
  'Fire': 'Ateş',
  'Royal': 'Kraliyet',
  'Gray': 'Gri',
  'Sandstone': 'Kumtaşı',
  'Basalt': 'Bazalt',
  'Mossy': 'Yosunlu',
  'Lava': 'Lav',
  'Amethyst': 'Ametist',
  'Coral-Crusted': 'Mercanlı',
  'Beige': 'Bej',
  'Mother-of-Pearl': 'Sedef',
  'Pearled': 'İncili',
  'Wooden': 'Ahşap',
  'Iron': 'Demir',
  'Fishing Boat': 'Balıkçı Teknesi',
  'Galleon': 'Kalyon',
  'Marble': 'Mermer',
  'Ruined': 'Yıkık',
  'Mermaid': 'Denizkızı',
  'Poseidon': 'Poseidon',
  'Golden Fish': 'Altın Balık',
  'Stone': 'Taş',
  'Coral': 'Mercan',
  'Ancient': 'Kadim',
  'Clay': 'Toprak',
  'Tipped': 'Devrik',
  'Patterned': 'Desenli',
  'Copper': 'Bakır',
  'Lighthouse': 'Deniz Feneri',
  'Moonlight': 'Ay Işığı',
  'Sun': 'Güneş',
  'Mini': 'Mini',
  'Volcano': 'Volkan',
  '"Fish Crossing"': '"Balık Geçidi"',
  '"No Diving"': '"Dalış Yasak"',
  '"Reefy"': '"Reefy"',
  'big reward tomorrow': 'yarın büyük ödül',
  'waiting in the vault': 'kasada bekliyor',
  'COLLECT': 'TOPLA',
  'Aquarium': 'Akvaryum',
  'Next up': 'Sıradaki',
  'You were away': 'Yokken geçen süre',
  'Your fish produced': 'Balıkların üretti',
  'Grew up': 'Yetişkin oldu',
  'Hungry now': 'Şu an aç',
  'Daily gift': 'Günlük hediye',
  'seventh day bonus': 'yedinci gün bonusu',
  'Welcome back': 'Tekrar hoş geldin',
  'Dive in': 'Akvaryuma dön',
  '{n}m': '{n} dk',
  '{h}h': '{h} sa',
  '{h}h {m}m': '{h} sa {m} dk',
  '{d}d': '{d} gün',
  '{d}d {h}h': '{d} gün {h} sa',
  'Daily streak': 'Günlük seri',
  'days in a row': 'gün üst üste',
  '{n} day streak': '{n} günlük seri',
  '{n} more days until the rare egg reward': 'Nadir yumurta ödülüne {n} gün kaldı',
  'Seventh day — the big reward is today': 'Yedinci gün — büyük ödül bugün',
  'Best streak': 'En uzun seri',
  'days': 'gün',
  '{done}/{total} unlocked': '{done}/{total} açıldı',
  'Ready': 'Hazır',
  'You': 'Sen',
  'Arrange': 'Düzen',
  '{n} affordable': '{n} alınabilir',
  '{n} items': '{n} ürün',
  '{n} ready': '{n} hazır',
  'Fishing Boat Shipwreck': 'Balıkçı Teknesi Batık',
  'Galleon Shipwreck': 'Kalyon Batık',
};
