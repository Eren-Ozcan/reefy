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

// 1080x1640 at deviceScaleFactor 2. This is NOT a phone's aspect ratio, and
// that is the point: it is the game area of a 9:16 captioned plate, so the
// capture runs full-bleed under the caption with no device frame, no crop and
// no side margin. The old 9:19.5 capture had to be scaled down and centred,
// which left the game filling barely half the plate.
const VIEWPORT = { width: 540, height: 820 };

/**
 * The cast, eighteen strong. Capacity is min(6 + level, 24) plus the tank's
 * rarity bonus, so level 12 in Coral Cove caps at 18 — eighteen fish is what
 * makes the HUD read "18/18 - full" instead of the half-empty "7/18" the first
 * set shipped with, and a half-empty tank is the one thing a store shot of an
 * aquarium game cannot afford.
 *
 * Picked for silhouette and colour rather than for rarity. The store card is
 * ~120px wide in search results; at that size what registers is outline
 * variety and a warm accent against the teal, not a rarity badge.
 *
 * The second column is not decoration. A fish's spawn point is derived from its
 * save seed, so these numbers ARE the layout — solved for by
 * tools/fish-layout-seeds.mjs, which also carries the composition itself and
 * the reasoning behind it. They are only valid for VIEWPORT above; change it
 * and the seeds have to be re-solved.
 *
 * Left to swim, eighteen fish school into a clump in the middle of the frame
 * within about ten seconds, which is why the hero shot is taken early rather
 * than after a long settle.
 */
const CAST = [
  // The two legendaries carry the rarity glow. The Golden Arowana is the
  // largest sprite in the game and the warm focal point the frame needs.
  ['altin-arowana', 187581],      // 170,330
  ['inci', 288692],               // 390,250
  // Epics: two warm (koi, yellow tang), one cool for contrast, one — the
  // Moorish Idol — with a trailing dorsal nothing else has.
  ['koi', 228933],                // 95,200
  ['gen-epic-68', 267371],        // 455,400
  ['gen-epic-71', 321326],        // 275,148
  ['gen-epic-67', 32425],         // 80,420
  // Rares for outline: lionfish spines, betta fins, a deep-bodied cichlid.
  ['aslan', 145779],              // 445,152
  ['beta', 224674],               // 215,440
  ['gen-rare-62', 46829],         // 330,470
  ['kral-gramma', 292870],        // 165,145
  // Uncommons: the clownfish is the most recognisable fish in the set, and the
  // angelfish is the only tall body among the mid-size sprites.
  ['palyaco', 134595],            // 470,300
  ['melek', 139161],              // 250,245
  ['gen-uncommon-42', 5021],      // 120,478
  ['gen-uncommon-46', 84593],     // 345,355
  // Commons fill the gaps between the big shapes so the water is never bare.
  ['neon-tetra', 211068],         // 405,462
  ['lepistes', 352038],           // 65,305
  ['gen-common-3', 320595],       // 349,195
  ['gen-common-5', 59071],        // 230,375
];

const NAMES = [
  'Sunset', 'Pearl', 'Ember', 'Sunny', 'Halo', 'Sky', 'Blaze', 'Silk',
  'Zest', 'Royal', 'Pip', 'Wing', 'Patch', 'Volt', 'Spark', 'Guppy',
  'Dart', 'Stripe',
];

/**
 * Ten pieces — MAX_PLACED, the cap the game itself enforces, so this is as full
 * as a real tank can be. Clustered rather than evenly spaced, and picked for
 * height: tall kelp holds both edges, the galleon and the castle carry the
 * middle, low coral and chests fill the gaps between them. The first set spread
 * seven short pieces at even intervals, which read as a fence rather than a
 * reef.
 *
 * Six legendaries and three epics also push the decor bonus past DECOR_BOOST_CAP,
 * so the tank chip reads a green "+35%" where the first set read a red "-21%".
 */
const PLACED = [
  { def: 'dec-kelp-7', fx: 0.05 },          // Glowing Kelp - tall, left edge
  { def: 'dec-kelp-4', fx: 0.11 },          // Golden Kelp - tall, doubles the edge
  { def: 'dec-coral-mound-19', fx: 0.19 },  // Crystal Coral - low
  { def: 'dec-anemone-33', fx: 0.27 },      // Royal Anemone - mid
  { def: 'dec-wreck-57', fx: 0.42 },        // Galleon - the big mass, left of centre
  { def: 'dec-starfish-52', fx: 0.53 },     // Golden Starfish - low, breathing room
  { def: 'dec-castle-65', fx: 0.66 },       // Coral Castle - tall, right of centre
  { def: 'dec-chest-55', fx: 0.75 },        // Golden Chest - low
  { def: 'dec-lamp-74', fx: 0.84 },         // Sun Lantern - mid, warm
  { def: 'dec-kelp-6', fx: 0.95 },          // Neon Kelp - tall, right edge
];

/**
 * The collection the shot sells: 66 of the 100 species found.
 *
 * Seeding only the eighteen fish in the tank left the Collection panel reading
 * "18/100" over a grid of question marks — which is the exact opposite of what
 * its caption claims, and the panel is the second shot in the set, the one that
 * has to make the roster look worth chasing.
 *
 * Weighted the way a real save is: commons complete, uncommons most of the way,
 * rares thinning out, epics barely started, one legendary. The first tab a
 * visitor sees is therefore full, and the rarity tiers stay legible as tiers.
 */
const COLLECTION = [
  // Commons: all 30.
  'lepistes', 'neon-tetra', 'moli',
  ...Array.from({ length: 27 }, (_, i) => `gen-common-${i + 1}`),
  // Uncommons: 18 of 25.
  'palyaco', 'melek', 'zebra-ciklit',
  ...Array.from({ length: 15 }, (_, i) => `gen-uncommon-${i + 28}`),
  // Rares: 11 of 20 — including the one swimming in the tank.
  'beta', 'kral-gramma', 'aslan', 'gen-rare-62',
  ...Array.from({ length: 7 }, (_, i) => `gen-rare-${i + 50}`),
  // Epics: 5 of 15.
  'koi', 'mandarin', 'gen-epic-67', 'gen-epic-68', 'gen-epic-71',
  // Legendaries: 2 of 10. Both are in the tank; neither is common enough that
  // showing more would still read as an honest save.
  'altin-arowana', 'inci',
];

/**
 * @param {object} opts
 * @param {number} opts.awayMs   how long the player has been gone, in ms
 * @param {number} [opts.growing]  how many fish are left mid-growth, so the
 *   returning-player summary has a "grew up" line to report
 * @param {boolean} [opts.spotless]  backdate spotlessAt to lastSeen, which
 *   spends the ten-minute dirt grace on the whole away period and hands back a
 *   clean tank. Only works for a short absence — see the two-pass note below.
 */
function seedSave({ awayMs, growing = 0, spotless = false }) {
  const lastSeen = Date.now() - awayMs;
  const tanksOwned = [TANK, 'tank-lagun', 'tank-batik-koyu'];

  return {
    v: 2,
    coins: 18420,
    pearls: 46,
    xp: 340,
    level: 12,
    playerName: 'Reef Keeper',
    friendCode: 'REEF-K7M2P',
    fishes: CAST.map(([sp, seed], i) => ({
      sp,
      seed,
      // Anything short of 1 renders as a fry, and a fry in a store shot reads
      // as an empty slot. The only exceptions are the few left growing on
      // purpose for the welcome-back summary.
      progress: i < growing ? 0.9 : 1,
      // Full, not merely fed: hunger drains over the away time, and the care
      // bar counts anything below the threshold as "N hungry" — a complaint
      // printed across the most important frame in the set.
      hunger: 1,
      name: NAMES[i],
      tank: TANK,
    })),
    collection: COLLECTION,
    feedOwned: { lezzet: 24, gurme: 8 },
    decorOwned: {},
    decorPlaced: { [TANK]: PLACED },
    dirtSpots: {},
    spotlessAt: spotless ? Object.fromEntries(tanksOwned.map((t) => [t, lastSeen])) : {},
    tanksOwned,
    activeTank: TANK,
    friends: [],
    friendVisits: { day: '', visited: [], count: 0 },
    friendGifts: { day: '', gifted: [] },
    quests: { day: '', progress: {}, claimed: [] },
    weeklyQuest: { day: '', progress: {}, claimed: [] },
    event: { id: '', points: 0, claimed: [] },
    achievementsClaimed: [],
    pendingEggs: [],
    stats: { totalSold: 38, totalEarned: 41200, totalFed: 190, eggsHatched: 12, decorPlacedCount: 10, totalCleaned: 64 },
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
    lastSeen,
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
 * Two saves, because the set wants two incompatible things from the same run.
 *
 * The welcome-back shot needs a real absence to have anything worth reporting.
 * Every other shot needs a clean tank — and dirt accrues over the away time
 * with only a ten-minute grace, so anything longer than about twelve minutes is
 * a tank at its full -35% dirt penalty no matter what the save says on load.
 * Dirt is cleaned by tapping spots on the canvas, which is not something a
 * capture script can aim at reliably, so the run seeds twice and reloads in
 * between.
 *
 * Pass A is an hour rather than the three it started as. Hunger falls at
 * 1/(90 min) and SAD_THRESHOLD is 0.25, so three hours away put every fish
 * under it — eighteen sad faces with speech bubbles over them, which is not
 * what "your reef kept going while you were out" should look like. An hour
 * lands hunger at 0.33: still something to come back to, nobody sulking.
 */
const PASS_KEY = '__reefy-store-pass';
const PASSES = {
  a: seedSave({ awayMs: 60 * 60 * 1000, growing: 3 }),
  b: seedSave({ awayMs: 9 * 60 * 1000, spotless: true }),
};

/**
 * The eight shots that go up, in upload order. Play shows the first three in
 * search results and above the fold on the listing, so the set is ordered
 * outcome -> depth -> difference: what you get, how much of it there is, and
 * the one promise none of the tycoon games in the same search can make.
 *
 * The remaining captures stay as alternates; they get captions too so the
 * wording can be swapped without re-running the game.
 */
const UPLOAD_ORDER = [
  '03-tank-hero',
  '10-collection',
  '06-shop-decor',
  '07-shop-tanks',
  '05-shop-eggs',
  '12-feeding',
  '02-welcome-back',
  '08-quests',
];

/** The first three carry the install decision, so they get the larger type. */
const LEAD = UPLOAD_ORDER.slice(0, 3);

/**
 * Caption text per shot. Written per language rather than translated: the
 * Turkish lines are shorter on purpose, because the same promise takes more
 * characters in Turkish and a wrapped second line costs the plate its calm.
 *
 * The counts are the real ones — SPECIES is 100, DECOR is 80, TANKS is 25 —
 * and they are in the captions because "dozens of species" is a weaker claim
 * than the truth.
 */
const CAPTIONS = {
  en: {
    '02-welcome-back': 'It earns while you sleep',
    '03-tank-hero': 'Grow your own reef',
    '04-shop-fish': 'Every fish has a price',
    '05-shop-eggs': 'Hatch it and find out',
    '06-shop-decor': '80 pieces of decor',
    '07-shop-tanks': '25 aquariums to unlock',
    '08-quests': 'Something to come back to',
    '09-inventory': 'Feed, raise, and sell',
    '10-collection': '100 fish to collect',
    '11-profile': 'Streaks and achievements',
    '12-feeding': 'No timers. No losing.',
  },
  tr: {
    '02-welcome-back': 'Sen yokken kazanır',
    '03-tank-hero': 'Kendi resifini büyüt',
    '04-shop-fish': 'Her balığın bir fiyatı var',
    '05-shop-eggs': 'Ne çıktığını gör',
    '06-shop-decor': '80 dekor parçası',
    '07-shop-tanks': '25 akvaryum aç',
    '08-quests': 'Dönmek için bir sebep',
    '09-inventory': 'Besle, büyüt, sat',
    '10-collection': '100 balık topla',
    '11-profile': 'Seriler ve başarımlar',
    '12-feeding': 'Sayaç yok. Kayıp yok.',
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

// The init script runs on every navigation, so it reads which pass is current
// out of localStorage rather than closing over one save — that is what lets the
// reload below swap the seed instead of restoring the first one.
await page.addInitScript(({ passes, passKey }) => {
  const pass = localStorage.getItem(passKey) || 'a';
  localStorage.setItem('reefy-save-v1', JSON.stringify(passes[pass]));
}, { passes: PASSES, passKey: PASS_KEY });

// ---- pass A: three hours away, for the returning-player summary -----------
await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
await page.screenshot({ path: out + '/01-menu.png' });

await page.click('#play-btn');
await page.waitForSelector('#menu.hidden', { timeout: 20000 });
await page.waitForTimeout(1000);

const welcome = page.locator('.welcome-ok');
if (await welcome.count()) await page.screenshot({ path: out + '/02-welcome-back.png' });

// ---- pass B: nine minutes away, for a tank with clean glass ---------------
await page.evaluate((k) => localStorage.setItem(k, 'b'), PASS_KEY);
await page.reload();
await page.waitForTimeout(1500);
await page.click('#play-btn');
await page.waitForSelector('#menu.hidden', { timeout: 20000 });
await page.waitForTimeout(1000);
// Nine minutes still trips the summary; it is in the way now, so it goes.
const welcomeB = page.locator('.welcome-ok');
if (await welcomeB.count()) await welcomeB.click();

// Long enough for the tank to settle and the fish to drift off their exact
// spawn points — an arranged-looking frame is its own kind of wrong — and short
// enough that the layout the seeds bought is still there. Wandering runs at
// 26 * speedMul px/s, so this is under 60px of drift; ten seconds of it was a
// school bunched in the centre of the water.
await page.waitForTimeout(2200);
await page.screenshot({ path: out + '/03-tank-hero.png' });

/**
 * @param {string} name  output file stem
 * @param {() => Promise<void>} open  navigates to the screen
 * @param {number} [row]  card row to scroll to the top of the sheet. Every
 *   catalogue in the game is sorted cheapest-first, so an unscrolled shop shot
 *   is a grid of grey commons at 150 coins — the least interesting sixth of a
 *   catalogue whose whole selling point is its range.
 */
async function shot(name, open, row = 0) {
  await open();
  await page.waitForTimeout(600);
  if (row) {
    await page.evaluate((r) => {
      const body = document.querySelector('.panel-body');
      if (!body) return;
      const cards = body.querySelectorAll('.grid > .card');
      if (!cards.length) return;
      // Column count is not fixed across tabs — fish and decor lay out three
      // across, tanks two — so it is read off the first row rather than assumed.
      let cols = 1;
      while (cols < cards.length && cards[cols].offsetTop === cards[0].offsetTop) cols++;
      const card = cards[r * cols];
      if (!card) return;
      // Align the row's top edge to just under the sticky tab bar rather than
      // scrolling by a pixel count: the grid does not start on a row boundary,
      // so a raw offset leaves a sliver of the row above showing under the tabs
      // and reads as a rendering fault instead of a list that continues.
      const tabs = body.querySelector('.tab')?.parentElement;
      const stickyBottom = tabs
        ? tabs.getBoundingClientRect().bottom
        : body.getBoundingClientRect().top;
      body.scrollTop += card.getBoundingClientRect().top - stickyBottom - 2;
    }, row);
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: out + `/${name}.png` });
  const close = page.locator('.close-btn');
  if (await close.count()) await close.first().click();
  await page.waitForTimeout(400);
}

await shot('04-shop-fish', () => page.click('#bottombar button[data-act="shop"]'), 11);
await shot('05-shop-eggs', async () => {
  await page.click('#bottombar button[data-act="shop"]');
  await page.waitForTimeout(400);
  await page.click('.tab[data-tab="eggs"]');
});
await shot('06-shop-decor', async () => {
  await page.click('#bottombar button[data-act="shop"]');
  await page.waitForTimeout(400);
  await page.click('.tab[data-tab="decor"]');
}, 12);
await shot('07-shop-tanks', async () => {
  await page.click('#bottombar button[data-act="shop"]');
  await page.waitForTimeout(400);
  await page.click('.tab[data-tab="tanks"]');
}, 7);
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
// Armed is not fed: without a tap on the water the frame is an empty tank with
// a Done bar under it. Feed is dropped at six spread points rather than one or
// two — eighteen fish converging on a single pellet is a clump, six drops is a
// tank where something is happening everywhere. Shot while the pellets are
// still falling.
for (const [fx, fy] of [[150, 260], [330, 240], [430, 330], [130, 400], [270, 360], [380, 450]]) {
  await page.mouse.click(fx, fy);
}
await page.waitForTimeout(350);
await page.screenshot({ path: out + '/12-feeding.png' });

if (wantCaptions) {
  const { composeCaptioned } = await import('./compose-captioned.mjs');
  await composeCaptioned({ browser, srcDir: out, outDir: captionOut, captions: CAPTIONS[lang], lead: LEAD });
}

await browser.close();

if (errors.length) {
  console.error('Page errors during capture:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('Captured into ' + out + (wantCaptions ? ' (+ captioned/)' : ''));
