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

const TAGLINE = {
  en: 'Grow the calmest reef on your phone',
  tr: 'Telefonundaki en huzurlu resif',
};

const TANK = 'tank-mercan-koyu';

/**
 * A wide, busy tank. This seed is deliberately fuller than the screenshot
 * seed's: the frame is a third as tall, so the same fish count would leave the
 * water looking empty at feature-graphic size.
 */
function seedSave() {
  const picks = [
    ['koi', 7], ['aslan', 19], ['palyaco', 23], ['melek', 31],
    ['beta', 44], ['mandarin', 66], ['diskus', 81], ['kral-gramma', 95],
    ['zebra-ciklit', 102], ['altin-arowana', 117],
  ];
  return {
    v: 2,
    coins: 24000, pearls: 60, xp: 500, level: 18,
    playerName: 'Reef Keeper', friendCode: 'REEF-K7M2P',
    fishes: picks.map(([sp, seed], i) => ({
      sp, seed, progress: 1, hunger: 0.9, name: 'Fish' + i, tank: TANK,
    })),
    collection: picks.map(([sp]) => sp),
    feedOwned: {}, decorOwned: {},
    decorPlaced: {
      [TANK]: [
        { def: 'dec-coral-mound-19', fx: 0.08 },
        { def: 'dec-kelp-6', fx: 0.18 },
        { def: 'dec-anemone-29', fx: 0.28 },
        { def: 'dec-wreck-57', fx: 0.44 },
        { def: 'dec-castle-64', fx: 0.6 },
        { def: 'dec-rock-34', fx: 0.72 },
        { def: 'dec-chest-53', fx: 0.82 },
        { def: 'dec-kelp-1', fx: 0.93 },
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
    stats: { totalSold: 0, totalEarned: 0, totalFed: 0, eggsHatched: 0, decorPlacedCount: 8, totalCleaned: 0 },
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
await scene.waitForTimeout(1200);
await scene.click('#play-btn');
await scene.waitForSelector('#menu.hidden', { timeout: 20000 });
await scene.waitForTimeout(800);
const welcome = scene.locator('.welcome-ok');
if (await welcome.count()) await welcome.click();

await scene.addStyleTag({
  content: `#hud, #siderail, #bottombar, #collect, #next-goal, #mode-chip,
            #feed-pop, #toasts, #panel-host { display: none !important; }`,
});
// Let the fish scatter: they spawn clustered, and a clump reads as a bug at
// this size.
await scene.waitForTimeout(6000);
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
          font-size: 33px; font-weight: 500; line-height: 1.24;
          color: #cfe7e4; max-width: 420px;
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
  { sceneUri, tagline: TAGLINE[lang] },
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
