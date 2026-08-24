/**
 * What the scene costs as it fills up, and whether it leaks.
 *
 * The scene is the one part of this game that can get slowly worse without any
 * test noticing: every fish, every dirt spot and every placed decor item is a
 * live Pixi object, and the tank the other tests run against holds two fish.
 *
 * The frame numbers are RELATIVE on purpose. An absolute budget is worthless
 * here: headless Chromium renders WebGL through SwiftShader, which turns in
 * ~12fps on a scene that a phone runs at 60, so a threshold tuned on this
 * machine would either pass everything or fail everywhere. What survives the
 * change of environment is the ratio — a full tank against an empty one, on the
 * same renderer, in the same run. A regression that makes content expensive
 * moves that ratio; the renderer being slow does not.
 *
 * Heap is absolute, because it is the same number everywhere.
 *
 * Needs a dev server on http://localhost:5173 (npm run dev).
 *
 *   node tools/perf-check.mjs [--seconds=6] [--report]
 *
 * Exits non-zero when a budget is exceeded.
 */
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const SECONDS = Number(flag('seconds', '6'));
const REPORT = argv.includes('--report');

// The handset the layout checks target: 1080x2340 at density 3.
const VIEWPORT = { width: 360, height: 780 };
const DSF = 3;
const TANK = 'tank-mercan-koyu';

const SPECIES = ['koi', 'aslan', 'palyaco', 'melek', 'beta', 'neon-tetra', 'mandarin'];
const DECOR = ['dec-coral-mound-19', 'dec-kelp-6', 'dec-anemone-29', 'dec-castle-64',
  'dec-rock-34', 'dec-chest-53', 'dec-kelp-1'];

/** A save with `fish` fish, `decor` placed items and `dirt` spots in the starter tank. */
function seedSave({ fish, decor, dirt }) {
  return {
    v: 2,
    coins: 42000, pearls: 60, xp: 300, level: 14,
    playerName: 'Perf', friendCode: 'REEF-PERF',
    fishes: Array.from({ length: fish }, (_, i) => ({
      sp: SPECIES[i % SPECIES.length],
      progress: 0.6 + (i % 5) * 0.05,
      hunger: 0.7,
      name: 'F' + i,
      seed: i * 7 + 3,
      tank: TANK,
    })),
    collection: SPECIES.slice(0, Math.max(1, fish)),
    feedOwned: { lezzet: 20 },
    decorOwned: {},
    decorPlaced: {
      [TANK]: Array.from({ length: decor }, (_, i) => ({ def: DECOR[i % DECOR.length], fx: 0.1 + i * 0.13 })),
    },
    dirtSpots: {
      [TANK]: Array.from({ length: dirt }, (_, i) => ({
        id: i, fx: 0.1 + i * 0.14, fy: 0.4 + (i % 3) * 0.15, r: 1, kind: i % 2,
      })),
    },
    tanksOwned: [TANK], activeTank: TANK,
    friends: [], friendVisits: { day: '', visited: [], count: 0 }, friendGifts: { day: '', gifted: [] },
    quests: { day: '', progress: {}, claimed: [] }, weeklyQuest: { day: '', progress: {}, claimed: [] },
    event: { id: '', points: 0, claimed: [] }, achievementsClaimed: [], pendingEggs: [],
    stats: { totalSold: 12, totalEarned: 9000, totalFed: 60, eggsHatched: 4, decorPlacedCount: decor, totalCleaned: 20 },
    pityCounter: 1, streak: 3, bestStreak: 6,
    incomePot: 800, cleanRewardDay: '', cleanRewardCount: 0, petDay: '',
    music: false, sfx: false,
    lastSeen: Date.now(), lastDaily: new Date().toISOString().slice(0, 10),
    tutorialDone: true, feedHintSeen: true, editHintSeen: true, adsRemoved: false,
    lang: 'tr', langChosen: true,
  };
}

const BUDGETS = {
  /**
   * A full tank against an empty one. Seven fish, seven decor items and six
   * dirt spots are allowed to cost this much more per frame than two fish and
   * bare sand. Set well above what this machine measures: the tripwire is for a
   * change that makes content cost DOUBLE, not for a few percent of drift.
   */
  loadedVsEmptyP50: 2.5,
  loadedVsEmptyP95: 3.0,
  /** JS heap on the loaded scene, MB. Same number on every machine. */
  heapMb: 220,
  /** Heap growth across the sample, MB — the leak tripwire. */
  heapGrowthMb: 40,
};

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

// Headless Chromium throttles requestAnimationFrame when it believes nothing is
// visible, which reports a flat 100ms frame and means nothing.
const browser = await chromium.launch({
  args: [
    '--js-flags=--expose-gc',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-frame-rate-limit',
  ],
});

/** Loads a save, lets the scene settle, and samples frame intervals and heap. */
async function measure(label, save) {
  const page = await browser.newPage({
    viewport: VIEWPORT, deviceScaleFactor: DSF, isMobile: true, hasTouch: true, locale: 'tr-TR',
  });
  page.on('pageerror', (e) => failures.push(`PAGEERROR (${label}): ${e.message}`));

  await page.addInitScript((s) => {
    localStorage.setItem('reefy-save-v1', JSON.stringify(s));
  }, save);
  await page.goto('http://localhost:5173/');
  await page.waitForSelector('#play-btn');
  await page.click('#play-btn');
  await page.waitForSelector('#bottombar', { state: 'visible' });
  // Fish spawn clustered and spread out; the first frames also carry texture
  // uploads that say nothing about steady state.
  await page.waitForTimeout(2500);

  const heapBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  const frames = await page.evaluate(async (seconds) => {
    const samples = [];
    let last = performance.now();
    const started = last;
    await new Promise((resolve) => {
      const tick = (now) => {
        samples.push(now - last);
        last = now;
        if (now - started >= seconds * 1000) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // The first sample spans the gap since the last paint, not a rendered frame.
    return samples.slice(1);
  }, SECONDS);
  const heapAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
  await page.close();

  const sorted = [...frames].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
  return {
    label,
    count: frames.length,
    p50: at(0.5),
    p95: at(0.95),
    heapMb: heapAfter / (1024 * 1024),
    growthMb: (heapAfter - heapBefore) / (1024 * 1024),
    hasHeap: heapAfter > 0,
  };
}

const empty = await measure('empty', seedSave({ fish: 2, decor: 0, dirt: 0 }));
const loaded = await measure('loaded', seedSave({ fish: 7, decor: 7, dirt: 6 }));
await browser.close();

const p50Ratio = loaded.p50 / empty.p50;
const p95Ratio = loaded.p95 / empty.p95;

if (REPORT || failures.length) {
  for (const m of [empty, loaded]) {
    console.log(`${m.label.padEnd(7)} ${m.count} frames  p50 ${m.p50.toFixed(1)}ms  p95 ${m.p95.toFixed(1)}ms  heap ${m.heapMb.toFixed(1)}MB (+${m.growthMb.toFixed(1)})`);
  }
  console.log(`ratio   p50 ${p50Ratio.toFixed(2)}x (budget ${BUDGETS.loadedVsEmptyP50}) · p95 ${p95Ratio.toFixed(2)}x (budget ${BUDGETS.loadedVsEmptyP95})`);
}

for (const m of [empty, loaded]) {
  check(m.count > SECONDS * 5, `${m.label}: only ${m.count} frames in ${SECONDS}s — the scene is not animating`);
}
check(p50Ratio <= BUDGETS.loadedVsEmptyP50,
  `a full tank costs ${p50Ratio.toFixed(2)}x an empty one at the median, budget ${BUDGETS.loadedVsEmptyP50}x`);
check(p95Ratio <= BUDGETS.loadedVsEmptyP95,
  `a full tank costs ${p95Ratio.toFixed(2)}x an empty one at p95, budget ${BUDGETS.loadedVsEmptyP95}x`);

// performance.memory is Chromium-only; skip rather than invent a pass.
if (loaded.hasHeap) {
  check(loaded.heapMb <= BUDGETS.heapMb, `heap ${loaded.heapMb.toFixed(1)}MB over budget ${BUDGETS.heapMb}MB`);
  check(loaded.growthMb <= BUDGETS.heapGrowthMb,
    `heap grew ${loaded.growthMb.toFixed(1)}MB during the sample, budget ${BUDGETS.heapGrowthMb}MB`);
}

if (failures.length) {
  console.error('FAIL');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`ok — full tank costs ${p50Ratio.toFixed(2)}x an empty one, heap ${loaded.heapMb.toFixed(1)}MB, no growth past budget`);
