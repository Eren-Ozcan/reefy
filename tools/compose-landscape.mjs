/**
 * Builds the 16:9 cut of the promo video from the 9:16 master.
 *
 *   node tools/compose-landscape.mjs [options]
 *
 *     --lang=en|tr   which master to compose (default en)
 *     --dir=DIR      where the master lives (default docs/store-assets-originals/promo)
 *     --preview=N    encode only the first N seconds, fast and rough
 *
 * Needs a dev server (npm run dev) for the fonts, ffmpeg on PATH, and a master
 * recorded by record-promo.mjs — both the mp4 and the .beats.json beside it.
 *
 * Why compose rather than re-record landscape: the game lays out for a phone,
 * and a 1920-wide viewport hands it the wide layout instead (see VIEWPORT in
 * record-promo.mjs). A landscape recording would therefore advertise a layout
 * almost nobody installs. Keeping the phone frame and giving the empty half of
 * a 16:9 frame to a line of text shows the real product and fills the shape a
 * store listing wants.
 *
 * The text is not new copy. It is the voice of the captioned store plates
 * (CAPTIONS in capture-store-screenshots.mjs) carried into the film, so the
 * video and the screenshots make the same promises in the same words.
 *
 * Height is the binding constraint: a 1080x1920 master inside a 1080-tall frame
 * is 608 px wide at most, so the game is about a third of the width whatever
 * else happens. The text column carries the message; the game carries the mood.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const lang = flag('lang', 'en');
if (lang !== 'en' && lang !== 'tr') throw new Error(`--lang must be en or tr, got: ${lang}`);
const dir = flag('dir', 'docs/store-assets-originals/promo');
const port = flag('port', '5173');
/**
 * `--preview=12` encodes the first N seconds fast and rough, to a file of its
 * own. Checking a layout decision against a four-minute slow-preset encode is
 * how a wrong margin survives three rounds.
 */
const preview = Number(flag('preview', '0')) || 0;

const mp4 = join(dir, `reefy-promo-${lang}.mp4`);
const beatsFile = join(dir, `reefy-promo-${lang}.beats.json`);
for (const f of [mp4, beatsFile]) {
  if (!existsSync(f)) {
    throw new Error(`Missing ${f} — record the master first: npm run store:promo -- --lang=${lang}`);
  }
}
const film = JSON.parse(readFileSync(beatsFile, 'utf8'));

/**
 * The game's own ambient music, rendered by tools/render-promo-music.mjs. It is
 * optional: without it the cut comes out silent, which is what it was before
 * and is still fine for the listing field, where the player autoplays muted.
 */
const musicFile = join(dir, 'promo-music.m4a');
const music = existsSync(musicFile);

/**
 * Google's official "Get it on Google Play" badge, if it has been downloaded to
 * `badges/google-play-<lang>.png`. It is deliberately not in this repo and not
 * generated here: it is Google's mark, it has to come from their brand page in
 * the right localisation, and their guidelines forbid redrawing or recolouring
 * it. Without the file the closing card keeps its line of text.
 *
 * Worth being sure before adding it: the badge tells a viewer they can install
 * the app now. While Reefy is in closed testing that is not true for anyone off
 * the tester list, so the honest time to drop the file in is the production
 * rollout.
 */
const badgeFile = join(dir, 'badges', `google-play-${lang}.png`);
const badge = existsSync(badgeFile)
  ? 'data:image/png;base64,' + readFileSync(badgeFile).toString('base64')
  : null;

const FRAME = { width: 1920, height: 1080 };
/**
 * 576x1024 keeps the master's 9:16 exactly and both numbers even, which is what
 * yuv420p needs. 1024 rather than the full 1080 leaves a 28 px breath top and
 * bottom, so the phone reads as placed rather than cropped by the frame edge.
 */
const GAME = { width: 576, height: 1024, x: 104, y: 28 };
/** The rest of the width, with the same 104 px margin on the right. */
const CARD = { width: 1040, height: FRAME.height, x: 776, y: 0 };
const FADE = 0.35;
/** A card leaves before the next arrives, so two are never up together. */
const GAP = 0.15;

/**
 * Text per beat, written per language rather than translated — the same rule
 * the store copy follows. `head` breaks its own lines: the column is 1040 px
 * and a headline that wraps where the browser feels like it reads as an
 * accident. Keep every line under about 22 characters at this size.
 */
const CARDS = {
  en: {
    title: { head: 'A calm reef\nin your pocket', sub: 'No timers to beat. No fail state.' },
    welcome: { head: 'It earns while\nyou sleep', sub: 'Come back to what your fish made while you were gone.' },
    reef: { head: 'Grow your own reef', sub: '100 fish and 80 pieces of decor, arranged your way.' },
    feed: { head: 'Feed, clean, pet', sub: 'Care is the whole verb here. Nothing dies, nothing punishes a day off.' },
    'shop-fish': { head: 'Every fish\nhas a price', sub: 'From the common tetra to the legendary Golden Arowana.' },
    'shop-decor': { head: '80 pieces of decor', sub: 'Five rarities, dragged anywhere along the sand.' },
    'shop-tanks': { head: '25 aquariums\nto unlock', sub: 'Each with its own biome and its own light.' },
    collection: { head: '100 fish to collect', sub: 'The collection remembers every one you have raised.' },
    quests: { head: 'Something to\ncome back to', sub: 'Daily quests, streaks and the Coral Festival.' },
    outro: { head: 'Reefy', sub: 'Free to play. English and Türkçe.', badge: true },
  },
  tr: {
    title: { head: 'Cebinde\nsakin bir resif', sub: 'Yetişilecek sayaç yok. Kaybetmek yok.' },
    welcome: { head: 'Sen yokken\nkazanır', sub: 'Balıklarının sen yokken kazandığına dön.' },
    reef: { head: 'Kendi resifini büyüt', sub: '100 balık ve 80 dekor parçası, senin düzeninle.' },
    feed: { head: 'Besle, temizle, sev', sub: 'Buradaki tek fiil bakmak. Hiçbir şey ölmüyor, uğramadığın gün ceza yok.' },
    'shop-fish': { head: 'Her balığın\nbir fiyatı var', sub: 'Sıradan neon tetradan efsanevi Altın Arowana’ya.' },
    'shop-decor': { head: '80 dekor parçası', sub: 'Beş nadirlik seviyesi, kumun üstünde istediğin yere.' },
    'shop-tanks': { head: '25 akvaryum aç', sub: 'Her birinin kendi biyomu ve kendi ışığı var.' },
    collection: { head: '100 balık topla', sub: 'Koleksiyon büyüttüğün her balığı hatırlıyor.' },
    quests: { head: 'Dönmek için\nbir sebep', sub: 'Günlük görevler, seriler ve Mercan Festivali.' },
    outro: { head: 'Reefy', sub: 'Ücretsiz oynanır. Türkçe ve İngilizce.', badge: true },
  },
};

const copy = CARDS[lang];

/**
 * A beat holds until the next one starts. The last holds to the end of the
 * film, which the recorder measured from the frame timestamps rather than
 * asking ffprobe — the encode is a resample of exactly those frames.
 */
const windows = film.beats
  .map((b, i) => {
    const next = film.beats[i + 1];
    const end = (next ? next.t : film.duration) - GAP;
    return { id: b.id, start: b.t, end, ...copy[b.id] };
  })
  // A beat with no copy is deliberate, not an oversight: the picture carries it.
  .filter((w) => w.head && w.end - w.start > 2 * FADE);

if (!windows.length) throw new Error('No beat in the film matched a card — did the beat ids change?');

// ---- render the text cards ------------------------------------------------
const work = join(dir, '.landscape');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const browser = await chromium.launch();
// Same trick compose-captioned.mjs uses: render on the dev server's own origin
// so the page can pull the game's bundled Fredoka/Nunito. about:blank makes the
// font request cross-origin from a null origin and silently falls back to a
// system face, and a trailer in a different typeface than the UI beside it
// reads as a mockup.
const page = await browser.newPage({ viewport: { width: CARD.width, height: CARD.height } });
await page.goto(`http://localhost:${port}/`);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

for (const [i, w] of windows.entries()) {
  await page.evaluate(({ head, sub, badge }) => {
    document.body.innerHTML = `
      <style>
        /* The game paints html and body #2f7f96, and inline styles on those two
           elements were not enough to stop it — the first composite came out
           with an opaque teal slab where the text column should have been.
           omitBackground only clears the browser's own default. */
        html, body { background: transparent !important; margin: 0; }
        /* Every class here is prefixed because the game's own stylesheet is
           loaded — that is the point of rendering on its origin. The first
           version called the wrapper .card, which is a shop tile in style.css:
           it arrived with the tile's opaque background and centred everything,
           and the composite came out with a dark slab for a text column. */
        .promo-card {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          justify-content: center; align-items: flex-start;
          padding: 0 40px;
          text-align: left;
          /* The blurred tank behind this is teal and busy at the edges, so every
             glyph carries its own shadow rather than trusting the backdrop. */
          text-shadow: 0 4px 22px rgba(4, 24, 30, 0.75);
        }
        .promo-rule {
          width: 76px; height: 8px; border-radius: 4px;
          /* --accent-2, the game's own attention colour. The backdrop is the
             water's teal, so the teal accent would sink into it. */
          background: #ff8a5c;
          margin-bottom: 34px;
          box-shadow: 0 4px 18px rgba(4, 24, 30, 0.5);
        }
        .promo-head {
          font-family: 'Fredoka', 'Segoe UI', system-ui, sans-serif;
          font-weight: 600;
          font-size: 82px; line-height: 1.1;
          color: #fff;
          margin: 0;
          white-space: pre-line;
          letter-spacing: -0.5px;
        }
        .promo-sub {
          font-family: 'Nunito', 'Segoe UI', system-ui, sans-serif;
          font-weight: 600;
          font-size: 34px; line-height: 1.45;
          color: rgba(255, 255, 255, 0.86);
          margin: 26px 0 0;
          max-width: 880px;
        }
        .promo-badge {
          /* Height, not width: Google's guidelines size the badge by height and
             forbid stretching it. The asset ships at its own aspect ratio, so
             width stays auto and whatever they hand us keeps its proportions.
             The 92px minimum clear space around it is the margin below. */
          height: 108px; width: auto; display: block;
          margin-top: 46px;
          /* No filter, no recolour, no rounded corners: the mark goes on as it
             was downloaded. The drop shadow is allowed and keeps it off a busy
             backdrop. */
          filter: drop-shadow(0 6px 20px rgba(4, 24, 30, 0.55));
        }
      </style>
      <div class="promo-card">
        <div class="promo-rule"></div>
        <h1 class="promo-head">${head}</h1>
        ${sub ? `<p class="promo-sub">${sub}</p>` : ''}
        ${badge ? `<img class="promo-badge" src="${badge}" alt="Get it on Google Play">` : ''}
      </div>`;
  }, {
    head: esc(w.head),
    sub: w.sub ? esc(w.sub) : '',
    // The badge goes only on the card that asks for it, and only if the file is
    // actually there.
    badge: w.badge && badge ? badge : '',
  });

  // The fonts are already loaded by the game, but the swap still lands a frame
  // late often enough to have written one card in the fallback face.
  await page.evaluate(() => document.fonts.ready);
  w.png = join(work, `card-${String(i).padStart(2, '0')}.png`);
  await page.screenshot({ path: w.png, omitBackground: true });
}

await browser.close();

// ---- composite ------------------------------------------------------------
// Clamped: a --preview longer than the film would run the looped cards and the
// music on past the last frame and write a tail of silence-over-freeze.
const length = Math.min(preview || film.duration, film.duration);

// Every input is given its own length. The card stills are looped and the music
// track is rendered longer than either film, so without this the only finite
// input is the master and the graph leans on the output `-t` to stop — which it
// does for video alone, but deadlocked on the last frame once an audio stream
// was mapped alongside it.
const args = ['-y', '-i', mp4];
for (const w of windows) {
  args.push('-loop', '1', '-framerate', String(film.fps), '-t', String(length), '-i', w.png);
}
if (music) args.push('-t', String(length), '-i', musicFile);
const musicInput = windows.length + 1;

const filters = [
  // The master is the only source, so it is split: once blurred and blown up to
  // fill the frame, once placed at readable size. A flat black background reads
  // as a letterboxing mistake; the game's own water out of focus reads as a
  // choice, and it changes colour with the scene for free.
  '[0:v]split=2[bgsrc][gamesrc]',
  // Blurred small and then blown up, not blown up and then blurred. Both look
  // identical once the detail is gone, but blurring at full size means running
  // a box blur over a 1920x3413 upscale of every frame, which took longer than
  // the encode itself.
  `[bgsrc]scale=64:114:flags=bilinear,boxblur=3:2,` +
    `scale=${FRAME.width}:-2:flags=bilinear,crop=${FRAME.width}:${FRAME.height},` +
    // Dimmed and desaturated so the headline is the brightest thing on its half
    // of the frame. Blurred alone was not enough: the HUD bar and the sand came
    // through as two hard blobs that pulled the eye off the text.
    'eq=brightness=-0.14:saturation=0.72[bg]',
  `[gamesrc]scale=${GAME.width}:${GAME.height}:flags=lanczos[game]`,
  `[bg][game]overlay=${GAME.x}:${GAME.y}[base]`,
];

let prev = 'base';
windows.forEach((w, i) => {
  const inp = i + 1;
  const out = i === windows.length - 1 ? 'out' : `v${i}`;
  // The fade is on the card's alpha rather than a cut: a hard swap of a big
  // headline next to moving water reads as a glitch in the video.
  filters.push(
    `[${inp}:v]format=rgba,fade=t=in:st=${w.start.toFixed(3)}:d=${FADE}:alpha=1,` +
      `fade=t=out:st=${(w.end - FADE).toFixed(3)}:d=${FADE}:alpha=1[c${i}]`,
  );
  filters.push(
    `[${prev}][c${i}]overlay=${CARD.x}:${CARD.y}:` +
      `enable='between(t,${w.start.toFixed(3)},${w.end.toFixed(3)})'[${out}]`,
  );
  prev = out;
});

if (music) {
  // The track is rendered at 60 seconds to cover either language, so it is the
  // film that decides where the fade out goes, not the file. It arrives already
  // levelled — see render-promo-music.mjs — so nothing else happens to it here.
  filters.push(
    `[${musicInput}:a]afade=t=in:st=0:d=1.6,` +
      `afade=t=out:st=${Math.max(0, length - 2.4).toFixed(3)}:d=2.4[aout]`,
  );
}

const outFile = join(dir, preview ? `reefy-promo-${lang}-landscape-preview.mp4` : `reefy-promo-${lang}-landscape.mp4`);
args.push(
  '-filter_complex', filters.join(';'),
  '-map', '[out]',
  '-r', String(film.fps), '-fps_mode', 'cfr',
  // The card inputs are looped stills and therefore infinite. `-shortest` does
  // not end this: with a single mapped output stream it has nothing to compare
  // against, and the first run wrote a 25 MB file and was still going. The
  // film's own measured length is the authority, so it is stated outright.
  '-t', String(length),
  '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'slow', '-crf', preview ? '26' : '20',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
);
if (music) args.push('-map', '[aout]', '-c:a', 'aac', '-b:a', '192k');
else args.push('-an');
args.push(outFile);
execFileSync('ffmpeg', args, { stdio: 'inherit' });

// ---- the YouTube thumbnail ------------------------------------------------
/**
 * YouTube wants 1280x720, and nothing else in the asset set is that shape: the
 * store plates are 1080x1920 and the feature graphic is 1024x500. So it is cut
 * from this cut — halfway through the reef beat, which is the frame with a full
 * tank on one side and "Grow your own reef" on the other. Taking it from the
 * film is also what stops it drifting: the thumbnail is by definition a frame
 * of the video it belongs to.
 */
if (!preview) {
  const reef = windows.find((w) => w.id === 'reef') ?? windows[0];
  const at = (reef.start + reef.end) / 2;
  const thumb = join(dir, `reefy-promo-${lang}-thumb.jpg`);
  execFileSync('ffmpeg', [
    '-y', '-ss', at.toFixed(3), '-i', outFile,
    '-frames:v', '1',
    '-vf', 'scale=1280:720:flags=lanczos',
    // Quality 2 is the top of mjpeg's useful range; a 1280x720 frame lands
    // around 200 KB, well inside YouTube's 2 MB limit.
    '-q:v', '2',
    thumb,
  ], { stdio: 'inherit' });
  console.log('Wrote ' + thumb);
}

// A preview keeps its cards: when the composite looks wrong the first question
// is whether the card or the filter graph is at fault, and that is answered by
// opening the PNG.
if (!preview) rmSync(work, { recursive: true, force: true });
console.log(
  `Wrote ${outFile} (${windows.length} cards, ${film.duration}s` +
    `, ${music ? 'scored' : 'silent — run npm run store:music first'}` +
    `, ${badge ? 'Play badge' : 'no Play badge'})`,
);
