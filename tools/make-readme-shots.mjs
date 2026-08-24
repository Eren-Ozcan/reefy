/**
 * Cuts the three README images out of the store screenshot set.
 *
 * These are the ONE exception to the asset rule in CLAUDE.md: store and
 * marketing images stay out of this public repo, but a README with no picture
 * of the game in it is a README nobody reads. They are kept small on purpose —
 * a quarter of the captured width — because the repo carries them forever and a
 * full 1080x2340 plate is 40x the bytes for no gain at README size.
 *
 * Source is docs/store-assets-originals/screens-en, which is gitignored and
 * written by `npm run store:screens -- --lang=en`. Run that first if it is
 * missing.
 *
 *   node tools/make-readme-shots.mjs
 */
import sharp from 'sharp';
import { mkdirSync, existsSync } from 'node:fs';

const SRC = 'docs/store-assets-originals/screens-en';
const OUT = 'docs/readme';

// Three shots, and the reason each one is here: the reef itself, the thing you
// spend on, and the thing you are filling up.
const SHOTS = [
  ['03-tank-hero.png', 'tank.png'],
  ['05-shop-eggs.png', 'eggs.png'],
  ['10-collection.png', 'collection.png'],
];

// A quarter of the 1080px capture. Wide enough to read the HUD in a README's
// three-across row, small enough that the three together are under 200 KB.
const WIDTH = 270;

if (!existsSync(SRC)) {
  console.error(`missing ${SRC} — run: npm run store:screens -- --lang=en`);
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

for (const [from, to] of SHOTS) {
  await sharp(`${SRC}/${from}`)
    .resize({ width: WIDTH })
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${OUT}/${to}`);
  console.log(`${OUT}/${to}`);
}
