/**
 * Checks the two things a phone shows and a desktop browser does not: the system
 * navigation bar eating the bottom of the chrome, and the top row overflowing
 * once the tank chip grows a growth badge.
 *
 * Neither is visible in a normal desktop run. The navigation bar is simulated by
 * overriding --safe-b, the variable every bottom-pinned element adds to its own
 * offset; env(safe-area-inset-bottom) itself cannot be set from a page. The top
 * row is loaded with its widest realistic content instead of its narrowest: the
 * longest tank name, a fully dirty tank so the growth badge is present, and
 * seven-figure balances carrying their plus marks. The streak moved down to the
 * goal row, so it is measured there instead.
 *
 * Needs a dev server on http://localhost:5173 (npm run dev).
 *
 *   node tools/check-mobile-layout.mjs [--lang=en|tr] [--nav=48] [--shots=DIR]
 *
 * Exits non-zero on the first failed assertion, so it can gate a release.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const lang = flag('lang', 'tr');
// Three-button navigation on a 1080px-wide phone is 48 CSS px. Gesture
// navigation is 24; the taller bar is the one that breaks things.
const NAV = Number(flag('nav', '48'));
const shots = flag('shots', '');
if (shots) mkdirSync(shots, { recursive: true });

// The handset the defects were found on is 1080x2340 at density 3.0, which is
// 360 CSS px wide — NOT 540. Getting this wrong is not cosmetic: at 540 the row
// has 180px of slack that no phone has, and the first version of this check
// passed while the real device wrapped its top row on a fresh save.
const CSS_WIDTH = Number(flag('css-width', '360'));
const DSF = Number(flag('dsf', '3'));
const VIEWPORT = { width: CSS_WIDTH, height: Math.round(2340 / DSF) };

// The longest tank name in the game, in a tank dirty enough to carry a growth
// badge. Both halves matter: the badge is what used to push the row over its
// width, and it only appears when the multiplier is not 1.
const TANK = 'tank-aysberg';

// The state an ordinary player is in most of the time: a short tank name, a
// clean tank so there is no growth badge, three figures of coins, no streak.
// The row MUST hold one line here — wrapping is reserved for the widest state,
// and a fresh save dropping a chip to a second line is the bug this pass
// exists to catch.
const ORDINARY_TANK = 'tank-mercan-koyu';

function seedSave() {
  return {
    v: 2,
    coins: 1284900, pearls: 999, xp: 340, level: 88,
    playerName: 'Layout', friendCode: 'REEF-LAYT',
    fishes: [
      { sp: 'koi', progress: 1, hunger: 0.9, name: 'A', seed: 7, tank: TANK },
      { sp: 'beta', progress: 1, hunger: 0.2, name: 'B', seed: 19, tank: TANK },
    ],
    collection: ['koi', 'beta'],
    feedOwned: { lezzet: 24 },
    decorOwned: {},
    decorPlaced: { [TANK]: [] },
    // A fully dirty tank: the largest negative badge the chip can show.
    dirtSpots: {
      [TANK]: Array.from({ length: 6 }, (_, i) => ({ id: i, fx: 0.1 + i * 0.13, fy: 0.5, r: 1, kind: 0 })),
    },
    tanksOwned: [TANK],
    activeTank: TANK,
    friends: [],
    friendVisits: { day: '', visited: [], count: 0 },
    friendGifts: { day: '', gifted: [] },
    quests: { day: '', progress: {}, claimed: [] },
    weeklyQuest: { day: '', progress: {}, claimed: [] },
    event: { id: '', points: 0, claimed: [] },
    achievementsClaimed: [],
    pendingEggs: [],
    stats: { totalSold: 0, totalEarned: 0, totalFed: 0, eggsHatched: 0, decorPlacedCount: 0, totalCleaned: 0 },
    pityCounter: 0,
    // 6 is the tease state: the streak chip carries its extra "big reward
    // tomorrow" line there, which is the widest it ever gets.
    streak: 6,
    bestStreak: 9,
    incomePot: 999999,
    cleanRewardDay: '',
    cleanRewardCount: 0,
    petDay: '',
    music: false,
    sfx: false,
    lastSeen: Date.now(),
    // Today, so the daily gift does not run and reset the streak to 1 — an
    // empty lastDaily hides the streak chip, which is half of what is measured.
    lastDaily: new Date().toISOString().slice(0, 10),
    tutorialDone: true,
    feedHintSeen: true,
    editHintSeen: true,
    adsRemoved: false,
    lang,
    langChosen: true,
  };
}

function seedOrdinary() {
  const s = seedSave();
  return {
    ...s,
    coins: 395,
    pearls: 5,
    level: 1,
    fishes: s.fishes.map((f) => ({ ...f, tank: ORDINARY_TANK })),
    decorPlaced: { [ORDINARY_TANK]: [] },
    dirtSpots: {},
    tanksOwned: [ORDINARY_TANK],
    activeTank: ORDINARY_TANK,
    streak: 1,
    incomePot: 120,
  };
}

const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); return ok; };

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: VIEWPORT,
  deviceScaleFactor: DSF,
  isMobile: true,
  hasTouch: true,
  locale: lang === 'tr' ? 'tr-TR' : 'en-US',
});
page.on('pageerror', (e) => failures.push('PAGEERROR: ' + e.message));

await page.addInitScript((save) => {
  localStorage.setItem('reefy-save-v1', JSON.stringify(save));
}, seedSave());
await page.goto('http://localhost:5173/');
await page.waitForSelector('#play-btn');
await page.click('#play-btn');
await page.waitForSelector('#bottombar', { state: 'visible' });

// Stand in for the navigation bar. Every bottom-pinned element ADDS this, so a
// correct layout keeps its own offset on top of it; the old max() form collapsed
// that offset to nothing here and left the dock's text sitting on the bar.
await page.evaluate((nav) => {
  document.documentElement.style.setProperty('--safe-b', nav + 'px');
}, NAV);
await page.waitForTimeout(400);

const safeBottom = VIEWPORT.height - NAV;

// ---- 1. The dock clears the navigation bar ----
const dock = await page.locator('#bottombar').boundingBox();
check(dock.y + dock.height <= safeBottom + 0.5,
  'dock bottom ' + Math.round(dock.y + dock.height) + ' is past the navigation bar at ' + safeBottom);

// ---- 2. The top row fits on one line, with everything still on it ----
const hud = await page.evaluate(() => {
  const row = document.querySelector('#hud');
  const bar = document.querySelector('#topbar');
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
  };
  return {
    row: box(row),
    bar: box(bar),
    scrollW: row.scrollWidth,
    clientW: row.clientWidth,
    chips: [...row.children].map((c) => ({
      id: c.id || c.className,
      text: c.textContent.trim(),
      ...box(c),
    })),
  };
});
check(hud.scrollW <= hud.clientW + 0.5,
  'top row overflows: ' + hud.scrollW + 'px of content in a ' + hud.clientW + 'px row');
// A hidden chip has no box, so it can neither overflow nor wrap.
for (const c of hud.chips.filter((c) => c.w > 0 && c.h > 0)) {
  check(c.right <= hud.bar.right + 0.5,
    '"' + c.text + '" (' + c.id + ') runs ' + Math.round(c.right - hud.bar.right) + 'px past the right edge');
  check(c.left >= hud.bar.left - 0.5, '"' + c.text + '" (' + c.id + ') runs past the left edge');
  check(c.h <= 56, '"' + c.text + '" (' + c.id + ') is ' + Math.round(c.h) + 'px tall — it has wrapped onto another line');
}
// The plus marks are part of what the currency chips now cost in width, so a
// run without them measured a narrower row than any player sees.
const plusCount = await page.locator('#hud .hud-plus:visible').count();
check(plusCount === 2, 'expected both currency chips to carry a plus mark, found ' + plusCount);
// The badge is the whole reason the chip grew; it has to survive the truncation.
const badge = await page.locator('#hud-tank b').first().textContent().catch(() => null);
check(badge != null && badge.indexOf('%') >= 0,
  'the growth badge is missing from the tank chip (got ' + JSON.stringify(badge) + ')');

// ---- 2b. The goal row holds the streak chip and the strip on one line ----
// The chip is fixed-width and the strip is elastic, so the failure mode here is
// the strip's text pushing the row taller rather than the chip falling off it.
const goalRow = await page.evaluate(() => {
  const row = document.querySelector('#goal-row');
  const chip = document.querySelector('#hud-streak');
  const strip = document.querySelector('#next-goal');
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, w: r.width, h: r.height };
  };
  return { row: box(row), chip: box(chip), strip: box(strip), scrollW: row?.scrollWidth, clientW: row?.clientWidth };
});
check(goalRow.row != null, 'the goal row is missing');
check(goalRow.chip != null && goalRow.chip.w > 0,
  'the streak chip is hidden — the seeded streak should be showing it');
if (goalRow.chip && goalRow.strip && goalRow.strip.w > 0) {
  check(goalRow.scrollW <= goalRow.clientW + 0.5,
    'goal row overflows: ' + goalRow.scrollW + 'px of content in a ' + goalRow.clientW + 'px row');
  check(goalRow.chip.right <= goalRow.strip.left + 0.5,
    'the streak chip overlaps the goal strip');
  check(Math.abs(goalRow.chip.h - goalRow.row.h) <= 24,
    'the streak chip is ' + Math.round(goalRow.chip.h) + 'px in a ' + Math.round(goalRow.row.h) + 'px row — one of them has wrapped');
}

if (argv.includes('--report')) {
  console.log('top row: ' + hud.clientW + 'px available, ' + hud.scrollW + 'px used');
  for (const c of hud.chips) console.log('  ' + String(Math.round(c.w)).padStart(4) + 'px  ' + (c.id || '?') + '  ' + JSON.stringify(c.text));
}

if (shots) await page.screenshot({ path: shots + '/hud-widest.png' });

// ---- 3. A sheet's last line clears the navigation bar ----
// Settings is the one that matters most: its last line is the diagnostic, the
// readout built for answering whether the store and the ad SDK came up.
await page.click('#bottombar button[data-act="you"]');
await page.waitForSelector('.panel');
await page.click('.panel [data-go="settings"]');
await page.waitForTimeout(400);
const opened = await page.locator('.panel').count();
check(opened > 0, 'no sheet opened — the sheet checks did not run');
if (opened) {
  // The last line is only at risk once it has been scrolled into view.
  await page.evaluate(() => {
    const body = document.querySelector('.panel .panel-body');
    body.scrollTop = body.scrollHeight;
  });
  await page.waitForTimeout(200);
  const sheet = await page.evaluate(() => {
    const panel = document.querySelector('.panel');
    const body = panel.querySelector('.panel-body');
    const last = body.lastElementChild;
    const b = last.getBoundingClientRect();
    return {
      bodyBottom: body.getBoundingClientRect().bottom,
      lastBottom: b.bottom,
      text: last.textContent.trim().replace(/\s+/g, ' ').slice(0, 60),
    };
  });
  check(sheet.lastBottom <= safeBottom + 0.5,
    'the sheet\'s last line ("' + sheet.text + '") ends at ' + Math.round(sheet.lastBottom)
    + ', past the navigation bar at ' + safeBottom);
  check(sheet.bodyBottom <= safeBottom + 0.5,
    'the sheet\'s scrolling area ends at ' + Math.round(sheet.bodyBottom)
    + ', past the navigation bar at ' + safeBottom);
  if (shots) await page.screenshot({ path: shots + '/sheet-bottom.png' });
}

// ---- 4. The ordinary state holds one line ----
// Same viewport, a save without any of the things that make the row wide.
const plain = await browser.newPage({
  viewport: VIEWPORT, deviceScaleFactor: DSF, isMobile: true, hasTouch: true,
  locale: lang === 'tr' ? 'tr-TR' : 'en-US',
});
await plain.addInitScript((save) => {
  localStorage.setItem('reefy-save-v1', JSON.stringify(save));
}, seedOrdinary());
await plain.goto('http://localhost:5173/');
await plain.waitForSelector('#play-btn');
await plain.click('#play-btn');
await plain.waitForSelector('#bottombar', { state: 'visible' });
await plain.waitForTimeout(600);
// Counted by height rather than by each chip's top: align-items: center gives
// chips of different heights different tops on the SAME line, which made the
// first version of this assertion report three lines for a row that had one.
const plainRow = await plain.evaluate(() => {
  const row = document.querySelector('#hud');
  const kids = [...row.children].filter((c) => c.getBoundingClientRect().width > 0);
  const tallest = Math.max(...kids.map((c) => c.getBoundingClientRect().height));
  return {
    height: Math.round(row.getBoundingClientRect().height),
    tallest: Math.round(tallest),
    width: row.clientWidth,
    used: row.scrollWidth,
  };
});
check(plainRow.height <= plainRow.tallest + 2,
  'the top row wrapped in the ordinary state: ' + plainRow.height + 'px tall against a '
  + plainRow.tallest + 'px chip, in ' + plainRow.width + 'px — wrapping is only for the widest state');
if (argv.includes('--report')) {
  console.log('ordinary row: ' + plainRow.height + 'px tall, tallest chip '
    + plainRow.tallest + 'px, ' + plainRow.used + '/' + plainRow.width + 'px used');
}
if (shots) await plain.screenshot({ path: shots + '/hud-ordinary.png' });

await browser.close();

if (failures.length) {
  console.error('FAIL — ' + lang + ', ' + NAV + 'px navigation bar');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('ok — ' + lang + ', ' + NAV + 'px navigation bar: dock, top row and sheet all clear');
