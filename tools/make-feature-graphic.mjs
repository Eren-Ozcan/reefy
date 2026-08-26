/**
 * Builds the 1024x500 Play Store feature graphic.
 *
 * Play requires one and refuses to publish a listing without it. It is not a
 * screenshot: the store scales it down hard and can lay a play button over the
 * middle, so the art has to survive at thumbnail size and keep its text out of
 * the center.
 *
 * The background is the real game rather than a mockup — the game is run at
 * 1024x500 with every piece of UI chrome hidden, leaving the rendered reef —
 * and the wordmark is composed over it on the left, where the store's overlay
 * will not land.
 *
 * Needs a dev server on http://localhost:5173 (npm run dev).
 *
 *   node tools/make-feature-graphic.mjs [options]
 *
 *     --lang=en|tr   language of the tagline (default en)
 *     --out=DIR      output directory (default docs/store-assets-originals)
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const lang = flag('lang', 'en');
if (lang !== 'en' && lang !== 'tr') throw new Error(`--lang must be en or tr, got: ${lang}`);
const out = flag('out', 'docs/store-assets-originals');
mkdirSync(out, { recursive: true });

// The one place in the listing with room for the numbers AND the difference.
// Broken by hand rather than left to wrap: the natural break is after the
// counts, and letting the column decide put "No timers." alone on line two
// split across the sentence instead of between the two claims.
const TAGLINE = {
  en: ['100 fish. 25 aquariums.', 'No timers, nothing to lose.'],
  tr: ['100 balık. 25 akvaryum.', 'Sayaç yok, kaybetmek yok.'],
};

const TANK = 'tank-mercan-koyu';

/**
 * A wide, packed tank. Fuller than the screenshot seed on purpose: the frame is
 * a third as tall, so ten fish left most of the water bare — at store-card size
 * the old graphic read as an empty gradient with a wordmark on it.
 *
 * The second column is the layout, not a nonce. Spawn points are derived from
 * the save seed, so these are solved for by
 *   node tools/fish-layout-seeds.mjs --target=feature
 * which carries the composition and the reasoning with it. They hold only for
 * this 1024x500 frame.
 */
function seedSave() {
  const picks = [
    ['altin-arowana', 86567],  ['inci', 55605],           ['koi', 40152],
    ['gen-epic-68', 112515],   ['gen-epic-71', 16107],    ['gen-epic-67', 201514],
    ['aslan', 205302],         ['beta', 120047],          ['gen-rare-62', 38814],
    ['kral-gramma', 150957],   ['palyaco', 225927],       ['melek', 8162],
    ['gen-uncommon-42', 136177], ['gen-uncommon-46', 39881], ['neon-tetra', 388871],
    ['lepistes', 334689],      ['gen-common-3', 85851],   ['gen-common-5', 369667],
    ['diskus', 369451],        ['mandarin', 42108],       ['zebra-ciklit', 99241],
    ['moli', 371070],
  ];
  return {
    v: 2,
    coins: 24000, pearls: 60, xp: 500, level: 18,
    playerName: 'Reef Keeper', friendCode: 'REEF-K7M2P',
    fishes: picks.map(([sp, seed], i) => ({
      // Fully fed: below SAD_THRESHOLD a fish grows a speech bubble, and the
      // one thing the graphic cannot afford is a tank of sulking fish.
      sp, seed, progress: 1, hunger: 1, name: 'Fish' + i, tank: TANK,
    })),
    collection: picks.map(([sp]) => sp),
    feedOwned: {}, decorOwned: {},
    // Ten — MAX_PLACED — and weighted right, where the wordmark is not. Heights
    // alternate so the sand line is a skyline rather than a row of pegs.
    decorPlaced: {
      [TANK]: [
        { def: 'dec-kelp-4', fx: 0.05 },
        { def: 'dec-coral-mound-19', fx: 0.15 },
        { def: 'dec-anemone-33', fx: 0.3 },
        { def: 'dec-kelp-7', fx: 0.4 },
        { def: 'dec-wreck-57', fx: 0.52 },
        { def: 'dec-starfish-52', fx: 0.62 },
        { def: 'dec-castle-65', fx: 0.71 },
        { def: 'dec-chest-55', fx: 0.8 },
        { def: 'dec-lamp-74', fx: 0.88 },
        { def: 'dec-kelp-6', fx: 0.96 },
      ],
    },
    dirtSpots: {},
    tanksOwned: [TANK], activeTank: TANK,
    friends: [], friendVisits: { day: '', visited: [], count: 0 },
    friendGifts: { day: '', gifted: [] },
    quests: { day: '', progress: {}, claimed: [] },
    weeklyQuest: { day: '', progress: {}, claimed: [] },
    event: { id: '', points: 0, claimed: [] },
    achievementsClaimed: [], pendingEggs: [],
    stats: { totalSold: 0, totalEarned: 0, totalFed: 0, eggsHatched: 0, decorPlacedCount: 10, totalCleaned: 0 },
    pityCounter: 0, streak: 0, bestStreak: 0,
    // Zero: the collect bubble is hidden along with the rest of the chrome, and
    // a pot the graphic never shows is just noise in the save.
    incomePot: 0,
    cleanRewardDay: '', cleanRewardCount: 0, petDay: '',
    music: true, sfx: true,
    lastSeen: Date.now(), lastDaily: new Date().toISOString().slice(0, 10),
    tutorialDone: true, feedHintSeen: true, editHintSeen: true, adsRemoved: false,
    lang, langChosen: true,
  };
}

const browser = await chromium.launch();

// --- 1. the reef, with every piece of UI taken off it -----------------------
const scene = await browser.newPage({
  viewport: { width: 1024, height: 500 },
  deviceScaleFactor: 2,
  locale: lang === 'tr' ? 'tr-TR' : 'en-US',
});
await scene.addInitScript((save) => {
  localStorage.setItem('reefy-save-v1', JSON.stringify(save));
}, seedSave());
await scene.goto('http://localhost:5173/');
await scene.addStyleTag({
  // #topbar covers the money row AND the care bar under it — both used to be
  // separate elements (#hud and the removed #siderail), and hiding only #hud
  // left the care bar standing in the middle of the graphic.
  //
  // Injected BEFORE the game mounts, which is load-bearing rather than tidy.
  // The scene's floor line is placed above whatever the bottom bar measures,
  // and syncBottomInset bails on a zero-height bar — so hiding the chrome first
  // leaves the inset at 0 and the sand takes its natural 96px. Hiding it after
  // mount left an inset of ~120px already baked in, which pushed the sand up to
  // fill nearly half the graphic and squashed every fish into a band across the
  // top.
  content: `#topbar, #bottombar, #next-goal, #mode-chip,
            #feed-pop, #toasts, #panel-host { display: none !important; }`,
});
await scene.waitForTimeout(1200);
await scene.click('#play-btn');
await scene.waitForSelector('#menu.hidden', { timeout: 20000 });
await scene.waitForTimeout(800);
const welcome = scene.locator('.welcome-ok');
if (await welcome.count()) await welcome.click();

// The seeds ARE the layout, so this is only long enough to let the fish drift
// off their exact spawn points. Six seconds of wandering scrambled it.
await scene.waitForTimeout(1800);
const scenePath = join(out, `.feature-scene-${lang}.png`);
await scene.screenshot({ path: scenePath });
await scene.close();

// --- 2. the wordmark over it ------------------------------------------------
const plate = await browser.newPage({
  viewport: { width: 1024, height: 500 },
  deviceScaleFactor: 2,
});
// Same-origin so the game's own bundled Fredoka loads (see compose-captioned).
await plate.goto('http://localhost:5173/');
const sceneUri = 'data:image/png;base64,' + readFileSync(scenePath).toString('base64');

await plate.evaluate(
  ({ sceneUri, tagline }) => {
    document.head.innerHTML = `
      <link rel="stylesheet" href="/src/fonts.css">
      <style>
        html, body { margin: 0; padding: 0; }
        body { width: 1024px; height: 500px; overflow: hidden; position: relative; }
        .scene { position: absolute; inset: 0; width: 1024px; height: 500px; }
        /* Darkens the left third only, so the wordmark has contrast while the
           reef on the right stays fully visible. */
        .scrim {
          position: absolute; inset: 0;
          background: linear-gradient(100deg,
            rgba(8, 32, 38, 0.94) 0%,
            rgba(8, 32, 38, 0.86) 34%,
            rgba(8, 32, 38, 0.34) 56%,
            rgba(8, 32, 38, 0.05) 74%);
        }
        .copy {
          position: absolute; left: 62px; top: 0; height: 100%; width: 470px;
          display: flex; flex-direction: column; justify-content: center;
          font-family: 'Fredoka', system-ui, sans-serif;
        }
        .title {
          font-size: 108px; font-weight: 600; line-height: 1;
          color: #ffffff; letter-spacing: -1px;
          text-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
        }
        .rule { width: 96px; height: 7px; border-radius: 4px; background: #35c4ac; margin: 22px 0 20px; }
        .tagline {
          font-size: 30px; font-weight: 500; line-height: 1.3;
          color: #cfe7e4; max-width: 460px;
          text-shadow: 0 3px 12px rgba(0, 0, 0, 0.5);
        }
      </style>`;
    document.body.innerHTML = `
      <img class="scene" src="${sceneUri}">
      <div class="scrim"></div>
      <div class="copy">
        <div class="title">Reefy</div>
        <div class="rule"></div>
        <div class="tagline">${tagline}</div>
      </div>`;
  },
  { sceneUri, tagline: TAGLINE[lang].join('<br>') },
);
await plate.evaluate(() => document.fonts.ready);
await plate.waitForTimeout(150);

// Play wants exactly 1024x500, so the export is pinned rather than left to the
// device scale factor the scene was rendered at.
await plate.screenshot({ path: join(out, `feature-graphic-${lang}.png`), clip: { x: 0, y: 0, width: 1024, height: 500 }, scale: 'css' });
await plate.close();
await browser.close();

unlinkSync(scenePath);
console.log(`Wrote ${join(out, `feature-graphic-${lang}.png`)}`);
