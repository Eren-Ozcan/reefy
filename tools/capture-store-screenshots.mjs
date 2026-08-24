/**
 * Captures Play Store screenshots at phone size from a save that already has
 * progress in it.
 *
 * The smoke run's screenshots are a by-product of a desktop-sized functional
 * pass on a FRESH save: a near-empty tank with two fish, no decor, at an aspect
 * ratio Play rejects. A store listing needs the opposite — a phone viewport and
 * a reef that looks lived in — so this seeds the save directly rather than
 * playing the game up to that state.
 *
 * Needs a dev server on http://localhost:5173 (npm run dev).
 *
 *   node tools/capture-store-screenshots.mjs [options]
 *
 *     --lang=en|tr   UI language to capture in (default en)
 *     --captions     also write a captioned set beside the raw one
 *     --out=DIR      output directory (default docs/store-assets-originals)
 *
 * Output goes to docs/store-assets-originals/ by default, which is gitignored —
 * marketing assets are mirrored to the private pictures repo, see CLAUDE.md.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const lang = flag('lang', 'en');
if (lang !== 'en' && lang !== 'tr') throw new Error(`--lang must be en or tr, got: ${lang}`);
const wantCaptions = argv.includes('--captions');
// The language goes in the directory name: a tr-TR listing needs its own set,
// and one shared folder would have each run silently overwrite the last.
const out = flag('out', `docs/store-assets-originals/screens-${lang}`);
const captionOut = out + '/captioned';

mkdirSync(out, { recursive: true });
if (wantCaptions) mkdirSync(captionOut, { recursive: true });

const TANK = 'tank-mercan-koyu';

// 1080x2340 at deviceScaleFactor 2 — a current-generation phone, and well
// inside Play's 320..3840 px bounds and 1:2..2:1 aspect ratio window.
const VIEWPORT = { width: 540, height: 1170 };

/**
 * A reef with something to look at: a full tank, a mix of rarities so the
 * sprites differ, and grown fish so nothing on screen is a bare fry.
 */
function seedSave() {
  const fishes = [
    { sp: 'koi', progress: 1, hunger: 0.9, name: 'Sunset', seed: 7, tank: TANK },
    { sp: 'aslan', progress: 0.95, hunger: 0.8, name: 'Ember', seed: 19, tank: TANK },
    { sp: 'palyaco', progress: 1, hunger: 0.95, name: 'Pip', seed: 23, tank: TANK },
    { sp: 'melek', progress: 0.85, hunger: 0.7, name: 'Halo', seed: 31, tank: TANK },
    { sp: 'beta', progress: 1, hunger: 0.85, name: 'Silk', seed: 44, tank: TANK },
    { sp: 'neon-tetra', progress: 0.75, hunger: 0.9, name: 'Spark', seed: 58, tank: TANK },
    { sp: 'mandarin', progress: 0.9, hunger: 0.8, name: 'Jewel', seed: 66, tank: TANK },
  ];

  const placed = [
    { def: 'dec-coral-mound-19', fx: 0.12 },
    { def: 'dec-kelp-6', fx: 0.24 },
    { def: 'dec-anemone-29', fx: 0.36 },
    { def: 'dec-castle-64', fx: 0.52 },
    { def: 'dec-rock-34', fx: 0.66 },
    { def: 'dec-chest-53', fx: 0.78 },
    { def: 'dec-kelp-1', fx: 0.9 },
  ];

  return {
    v: 2,
    coins: 18420,
    pearls: 46,
    xp: 340,
    level: 12,
    playerName: 'Reef Keeper',
    friendCode: 'REEF-K7M2P',
    fishes,
    collection: ['lepistes', 'neon-tetra', 'moli', 'palyaco', 'melek', 'beta', 'koi', 'mandarin', 'aslan'],
    feedOwned: { lezzet: 24, gurme: 8 },
    decorOwned: {},
    decorPlaced: { [TANK]: placed },
    dirtSpots: {},
    tanksOwned: [TANK, 'tank-lagun', 'tank-batik-koyu'],
    activeTank: TANK,
    friends: [],
    friendVisits: { day: '', visited: [], count: 0 },
    friendGifts: { day: '', gifted: [] },
    quests: { day: '', progress: {}, claimed: [] },
    weeklyQuest: { day: '', progress: {}, claimed: [] },
    event: { id: '', points: 0, claimed: [] },
    achievementsClaimed: [],
    pendingEggs: [],
    stats: { totalSold: 38, totalEarned: 41200, totalFed: 190, eggsHatched: 12, decorPlacedCount: 7, totalCleaned: 64 },
    pityCounter: 3,
    streak: 6,
    bestStreak: 9,
    // Enough to make the collect button worth pressing without looking absurd.
    incomePot: 1260,
    cleanRewardDay: '',
    cleanRewardCount: 0,
    petDay: '',
    music: true,
    sfx: true,
    // Backdated so the returning-player summary has something to report, but
    // not so far back that the pot reads as an idle-game jackpot.
    lastSeen: Date.now() - 3 * 60 * 60 * 1000,
    lastDaily: '',
    // The intro carousel and the hints are blocking overlays; a store shot must
    // never open on one.
    tutorialDone: true,
    feedHintSeen: true,
    editHintSeen: true,
    adsRemoved: false,
    lang,
    // The captured language has to be a CHOICE — left false it would fall back
    // to detection and follow the runner's machine rather than --lang.
    langChosen: true,
  };
}

/**
 * Caption text per shot. Written per language rather than translated: the
 * Turkish lines are shorter on purpose, because the same promise takes more
 * characters in Turkish and a wrapped third line breaks the band.
 */
const CAPTIONS = {
  en: {
    '02-welcome-back': 'Your fish earn while you sleep',
    '03-tank-hero': 'Grow the calmest reef on your phone',
    '04-shop-fish': 'Collect dozens of species',
    '05-shop-eggs': 'Hatch eggs, chase the legendary',
    '06-shop-decor': 'Decorate it until it looks like yours',
    '07-shop-tanks': 'Unlock aquariums with their own biomes',
    '08-quests': 'Daily quests worth coming back for',
    '09-inventory': 'Feed, raise, and sell for profit',
    '10-collection': 'Fill the collection, one fish at a time',
    '11-profile': 'Streaks, stats and achievements',
    '12-feeding': 'Better feed, better sale price',
  },
  tr: {
    '02-welcome-back': 'Sen yokken de kazanmaya devam',
    '03-tank-hero': 'Telefonundaki en huzurlu resif',
    '04-shop-fish': 'Onlarca balık türünü topla',
    '05-shop-eggs': 'Yumurta çatlat, efsaneyi yakala',
    '06-shop-decor': 'Sana benzeyene kadar tasarla',
    '07-shop-tanks': 'Kendi biyomu olan akvaryumlar aç',
    '08-quests': 'Her gün için yeni görevler',
    '09-inventory': 'Besle, büyüt, kârına sat',
    '10-collection': 'Koleksiyonu tek tek doldur',
    '11-profile': 'Seriler, istatistikler, başarımlar',
    '12-feeding': 'İyi yem, yüksek satış fiyatı',
  },
};

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: lang === 'tr' ? 'tr-TR' : 'en-US',
});

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.addInitScript((save) => {
  localStorage.setItem('reefy-save-v1', JSON.stringify(save));
}, seedSave());

await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
await page.screenshot({ path: out + '/01-menu.png' });

await page.click('#play-btn');
await page.waitForSelector('#menu.hidden', { timeout: 20000 });
await page.waitForTimeout(1000);

// The returning-player summary is worth one shot, then it has to go before
// anything behind it can be photographed.
const welcome = page.locator('.welcome-ok');
if (await welcome.count()) {
  await page.screenshot({ path: out + '/02-welcome-back.png' });
  await welcome.click();
}
// Fish swim; give them a moment to spread out instead of stacking at spawn.
await page.waitForTimeout(3500);
await page.screenshot({ path: out + '/03-tank-hero.png' });

async function shot(name, open) {
  await open();
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + `/${name}.png` });
  const close = page.locator('.close-btn');
  if (await close.count()) await close.first().click();
  await page.waitForTimeout(400);
}

await shot('04-shop-fish', () => page.click('#bottombar button[data-act="shop"]'));
await shot('05-shop-eggs', async () => {
  await page.click('#bottombar button[data-act="shop"]');
  await page.waitForTimeout(400);
  await page.click('.tab[data-tab="eggs"]');
});
await shot('06-shop-decor', async () => {
  await page.click('#bottombar button[data-act="shop"]');
  await page.waitForTimeout(400);
  await page.click('.tab[data-tab="decor"]');
});
await shot('07-shop-tanks', async () => {
  await page.click('#bottombar button[data-act="shop"]');
  await page.waitForTimeout(400);
  await page.click('.tab[data-tab="tanks"]');
});
await shot('08-quests', () => page.click('#bottombar button[data-act="quests"]'));
await shot('09-inventory', () => page.click('#bottombar button[data-act="inventory"]'));
await shot('10-collection', async () => {
  await page.click('#bottombar button[data-act="you"]');
  await page.waitForTimeout(400);
  await page.click('.more-btn[data-go="collection"]');
});
await shot('11-profile', () => page.click('#bottombar button[data-act="you"]'));

// Feed mode: the one interaction a static shot can actually show off.
// The care bar replaced the right-edge rail this used to reach for; the same
// rename broke the smoke run (48fc01a) and was missed here.
await page.click('#carebar button[data-care="feed"]');
await page.waitForTimeout(600);
// Feed mode only actually arms — and only then does the Done bar appear —
// once a feed is picked, so the shot without this is just the picker.
const feedOpt = page.locator('.feed-opt').first();
if (await feedOpt.count()) {
  await feedOpt.click();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: out + '/12-feeding.png' });

if (wantCaptions) {
  const { composeCaptioned } = await import('./compose-captioned.mjs');
  await composeCaptioned({ browser, srcDir: out, outDir: captionOut, captions: CAPTIONS[lang] });
}

await browser.close();

if (errors.length) {
  console.error('Page errors during capture:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Captured into ' + out + (wantCaptions ? ' (+ captioned/)' : ''));
