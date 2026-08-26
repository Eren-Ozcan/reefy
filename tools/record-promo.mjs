/**
 * Records the store promo video from the web build.
 *
 *   node tools/record-promo.mjs [options]
 *
 *     --lang=en|tr   UI language (default en)
 *     --port=5173    dev server port
 *     --out=DIR      output directory (default docs/store-assets-originals/promo)
 *     --gif          also write a trimmed GIF for the README
 *
 * Needs a dev server (npm run dev) and ffmpeg on PATH.
 *
 * Why the web build and not the device: the same seeded save the store
 * screenshots use (tools/store-save-seed.mjs) gives a reef that is already
 * worth filming, at any resolution, reproducibly. A device capture would show
 * the native store sheet and the ad paths the demo stubs out — worth doing one
 * day, but not at the cost of filming a fresh save with two fish in it.
 *
 * The output is deliberately silent. Play takes a YouTube link rather than a
 * file, and a listing video autoplays muted anyway.
 */
import { chromium } from 'playwright';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { makeSave } from './store-save-seed.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const lang = flag('lang', 'en');
if (lang !== 'en' && lang !== 'tr') throw new Error(`--lang must be en or tr, got: ${lang}`);
const port = flag('port', '5173');
const out = flag('out', 'docs/store-assets-originals/promo');
const wantGif = argv.includes('--gif');

mkdirSync(out, { recursive: true });
const raw = join(out, '.raw');
rmSync(raw, { recursive: true, force: true });
mkdirSync(raw, { recursive: true });

/**
 * 9:16, which is what a store listing video and every phone player expect.
 * The screenshot set uses 540x820 because it is filling the game area of a
 * captioned plate; a video has no caption band, so it gets the full frame.
 *
 * Recorded at 1080x1920 against deviceScaleFactor 2, so the frames come off the
 * page at their real pixel size rather than being upscaled afterwards.
 */
const VIEWPORT = { width: 540, height: 960 };
const VIDEO_SIZE = { width: 1080, height: 1920 };

/**
 * Nine minutes away, spotless. Long enough that the welcome-back sheet has
 * something to report, short enough that the tank is not sitting at its full
 * -35% dirt penalty for the rest of the film.
 */
const SAVE = makeSave({ lang, awayMs: 9 * 60 * 1000, growing: 3, spotless: true });

const browser = await chromium.launch();

// Warm the dev server before the camera rolls. Vite compiles on first request,
// and the first cut of this film opened on five and a half seconds of a static
// title card while that happened.
const warm = await browser.newContext();
const warmPage = await warm.newPage();
await warmPage.goto(`http://localhost:${port}/`);
await warmPage.waitForTimeout(2500);
await warm.close();

const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: lang === 'tr' ? 'tr-TR' : 'en-US',
  recordVideo: { dir: raw, size: VIDEO_SIZE },
});
// Recording starts with the context, so everything before the take has to be
// cut back off at encode time — see TAKE_AT below.
const contextStart = Date.now();
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.addInitScript((save) => {
  localStorage.setItem('reefy-save-v1', JSON.stringify(save));
}, SAVE);

/** A sheet's own scroll, eased — a jump cut inside a panel reads as a glitch. */
async function scrollPanel(distance, ms = 1400) {
  await page.evaluate(
    ({ distance, ms }) =>
      new Promise((done) => {
        const body = document.querySelector('.panel-body');
        if (!body) return done();
        const from = body.scrollTop;
        const t0 = performance.now();
        const step = (t) => {
          const p = Math.min(1, (t - t0) / ms);
          // easeInOutCubic: starts and stops still, which is what makes it read
          // as a hand moving rather than a scrollbar being dragged.
          const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
          body.scrollTop = from + distance * e;
          if (p < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    { distance, ms },
  );
}

const openSheet = async (act) => {
  await page.click(`#bottombar button[data-act="${act}"]`);
  await page.waitForTimeout(700);
};
const closeSheet = async () => {
  const close = page.locator('.close-btn');
  if (await close.count()) await close.first().click();
  await page.waitForTimeout(600);
};

// Boot once and reload, so the take opens on a menu that is already painted.
// Warming a throwaway context is not enough: the recorded one starts with an
// empty cache of its own, and the first cut spent five seconds on a static
// title card while the game booted.
await page.goto(`http://localhost:${port}/`);
await page.waitForSelector('#play-btn', { timeout: 20000 });
// Play once too: what costs the seconds is the game booting behind the menu,
// not the menu itself, and only a real start pulls every sprite through the
// decoder. After the reload the browser still holds them.
await page.click('#play-btn');
await page.waitForSelector('#menu.hidden', { timeout: 20000 });
await page.waitForTimeout(800);
await page.reload();
await page.waitForSelector('#play-btn', { timeout: 20000 });
await page.waitForTimeout(400);

// Half a second of pre-roll so the cut does not land on the first painted frame.
const TAKE_AT = Math.max(0, (Date.now() - contextStart) / 1000 - 0.5);

// ---- 1. the title card ----------------------------------------------------
await page.waitForTimeout(600);

// ---- 2. coming back to a reef that kept earning ---------------------------
await page.click('#play-btn');
await page.waitForSelector('#menu.hidden', { timeout: 20000 });
// The summary is the pitch — "it earned while you were gone" — so it is the
// one sheet that gets a hold long enough to read.
await page.waitForTimeout(3400);
const welcome = page.locator('.welcome-ok');
if (await welcome.count()) await welcome.click();

// ---- 3. the tank itself, which is the whole pitch -------------------------
await page.waitForTimeout(3200);

// ---- 4. feeding, the one interaction worth filming ------------------------
await page.click('#carebar button[data-care="feed"]');
await page.waitForTimeout(900);
const feedOpt = page.locator('.feed-opt').first();
if (await feedOpt.count()) {
  await feedOpt.click();
  await page.waitForTimeout(700);
}
// Six drops spread across the water rather than one: eighteen fish converging
// on a single pellet is a clump, six is a tank where something happens
// everywhere. Spaced in time so the swim toward each one is visible.
for (const [fx, fy] of [[150, 300], [340, 270], [430, 380], [130, 470], [280, 420], [390, 530]]) {
  await page.mouse.click(fx, fy);
  await page.waitForTimeout(320);
}
await page.waitForTimeout(2200);
// Feed mode hides the bottom bar and puts a Done chip over the water; the
// care bar's own Feed button is not clickable while it is up.
const doneBtn = page.locator('#mode-done');
if (await doneBtn.count()) await doneBtn.click();
await page.waitForTimeout(900);

// ---- 5. what there is to spend it on --------------------------------------
await openSheet('shop');
await scrollPanel(1500, 1900);
await page.waitForTimeout(500);
await page.click('.tab[data-tab="decor"]');
await page.waitForTimeout(700);
await scrollPanel(1400, 1700);
await page.waitForTimeout(500);
await page.click('.tab[data-tab="tanks"]');
await page.waitForTimeout(700);
await scrollPanel(1100, 1600);
await page.waitForTimeout(600);
await closeSheet();

// ---- 6. the roster, which is the reason to keep going ---------------------
await page.click('#bottombar button[data-act="you"]');
await page.waitForTimeout(700);
await page.click('.more-btn[data-go="collection"]');
await page.waitForTimeout(900);
await scrollPanel(1200, 1800);
await page.waitForTimeout(500);
await closeSheet();

// ---- 7. a reason to come back tomorrow ------------------------------------
await openSheet('quests');
await page.waitForTimeout(1700);
await closeSheet();

// ---- 8. end on the reef ---------------------------------------------------
await page.waitForTimeout(2600);

await context.close();
await browser.close();

if (errors.length) {
  console.error('Page errors during recording:\n' + errors.join('\n'));
  process.exit(1);
}

// ---- encode ---------------------------------------------------------------
const webm = readdirSync(raw).filter((f) => f.endsWith('.webm')).map((f) => join(raw, f))[0];
if (!webm) throw new Error('Playwright wrote no video into ' + raw);

const mp4 = join(out, `reefy-promo-${lang}.mp4`);
// yuv420p and the even-dimension filter are what make the file play on phones
// and upload cleanly; without them YouTube re-encodes from a format some
// players refuse outright.
execFileSync('ffmpeg', [
  '-y', '-ss', TAKE_AT.toFixed(2), '-i', webm,
  '-r', '30',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
  '-pix_fmt', 'yuv420p',
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
  '-movflags', '+faststart',
  '-an', mp4,
], { stdio: 'inherit' });

if (wantGif) {
  // A GIF of the whole film would be tens of megabytes and it lives in git
  // history forever, so this is a trimmed highlight: the tank, then feeding.
  // 480px wide at 12fps is the point where the loop is still legible and the
  // file still small enough to commit.
  const gif = join(out, `reefy-promo-${lang}.gif`);
  const palette = join(raw, 'palette.png');
  // The window is the reef and the feeding — the two seconds either side of it
  // are a title card and a shop list, neither of which reads at GIF size.
  const trim = ['-ss', '8', '-t', '11'];
  const scale = 'fps=12,scale=480:-1:flags=lanczos';
  execFileSync('ffmpeg', ['-y', ...trim, '-i', mp4, '-vf', `${scale},palettegen=max_colors=128`, palette], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', ...trim, '-i', mp4, '-i', palette,
    '-lavfi', `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, gif], { stdio: 'inherit' });
  console.log('Wrote ' + gif);
}

rmSync(raw, { recursive: true, force: true });
console.log('Wrote ' + mp4);
