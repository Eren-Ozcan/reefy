/**
 * Renders the game's own ambient music to a file, for the promo video to use.
 *
 *   node tools/render-promo-music.mjs [options]
 *
 *     --seconds=60   how much to render (default 60, which covers both cuts)
 *     --out=DIR      output directory (default docs/store-assets-originals/promo)
 *     --port=5173    dev server port
 *
 * Needs a dev server (npm run dev) and ffmpeg on PATH.
 *
 * The film is captured with CDP's screencast, which is frames and nothing else,
 * so the recording has no sound to keep. This is the missing half.
 *
 * The music is the game's, not a library track: src/audio.ts synthesizes the
 * whole thing in WebAudio — a bass note, a thin pad and a kalimba melody over a
 * four-chord loop, per biome — so a trailer scored with it needs no licence, is
 * safe from Content ID, and sounds like the thing it is advertising.
 *
 * It is captured by loading the real module and recording what it plays, rather
 * than by rebuilding the graph here. A second copy of the synth in a tools file
 * would be a second thing to keep in tune, and it would go out of tune quietly.
 * The only trick needed is a shim over AudioContext so the master bus lands in
 * a MediaStreamDestination instead of the speakers.
 *
 * This runs in real time — a 60-second render takes 60 seconds. OfflineAudio-
 * Context would be faster, but the module builds its graph against
 * ctx.currentTime and paces the chord loop with setInterval, so it cannot be
 * rendered faster than it plays without changing the game's code for the sake
 * of a marketing asset.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TANK } from './store-save-seed.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const seconds = Number(flag('seconds', '60'));
const out = flag('out', 'docs/store-assets-originals/promo');
const port = flag('port', '5173');

mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  // An AudioContext starts suspended until the page has been interacted with,
  // and there is nobody here to click.
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext();

await context.addInitScript(() => {
  // Every AudioContext the page builds gets its destination swapped for a
  // MediaStreamDestination. `destination` is a getter on BaseAudioContext's
  // prototype, so an own property on the instance shadows it and audio.ts
  // connects its master bus to the recorder without knowing anything about it.
  const Original = window.AudioContext;
  window.AudioContext = class extends Original {
    constructor(...args) {
      super(...args);
      const captured = this.createMediaStreamDestination();
      Object.defineProperty(this, 'destination', {
        get: () => captured,
        configurable: true,
      });
      window.__promoStream = captured.stream;
    }
  };
});

const page = await context.newPage();
await page.goto(`http://localhost:${port}/`);

const webm = join(out, '.promo-music.webm');
const base64 = await page.evaluate(async ({ seconds, tankId }) => {
  // The dev server transforms these on request, so the tool gets the same
  // module the game runs and the same tank table the seeded save is built from.
  const { audio } = await import('/src/audio.ts');
  const { TANKS } = await import('/src/tanks.ts');

  // The film is shot in the seeded save's tank, so the trailer should be in
  // that tank's key rather than whatever the default happens to be.
  const tank = TANKS.find((t) => t.id === tankId);
  if (tank) audio.setBiome(tank.biome);

  audio.startAmbient();
  const stream = window.__promoStream;
  if (!stream) throw new Error('No AudioContext was created — did startAmbient() bail out?');

  const chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((r) => { rec.onstop = r; });
  rec.start();
  await new Promise((r) => setTimeout(r, seconds * 1000));
  rec.stop();
  await done;

  const blob = new Blob(chunks, { type: 'audio/webm' });
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}, { seconds, tankId: TANK });

await browser.close();

writeFileSync(webm, Buffer.from(base64, 'base64'));

const m4a = join(out, 'promo-music.m4a');
// AAC rather than the Opus that came out of the recorder: this is muxed into an
// mp4 that goes to YouTube, and AAC in mp4 is the combination every player and
// every uploader takes without re-encoding twice.
//
// Levelled here rather than while composing the video. The game mixes its music
// for a phone speaker under sound effects and it lands around -36 dB mean,
// which next to anything else on YouTube is silence; -16 LUFS is a shade under
// YouTube's own normalisation target, which suits a trailer with no voice in
// it. Doing it in this one-off pass keeps loudnorm's three-second lookahead out
// of the video encode, where it deadlocked the filter graph on the last frame.
execFileSync('ffmpeg', [
  '-y', '-i', webm,
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000',
  '-c:a', 'aac', '-b:a', '192k', '-ac', '2', m4a,
], { stdio: 'inherit' });
rmSync(webm, { force: true });

console.log('Wrote ' + m4a);
