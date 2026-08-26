/**
 * Solves for the per-fish `seed` values that place the store shot's cast where
 * the composition wants them.
 *
 * A fish's starting position is not random at runtime — Fish's constructor
 * derives it from the save's `seed` field:
 *
 *   const rnd = mulberry32(seed);
 *   rnd();                                    // speedMul, discarded here
 *   x = 60 + rnd() * (bounds.w - 120);
 *   y = 90 + rnd() * (bounds.h - 220);
 *
 * so a seed IS a spawn point. Fish then wander at 26 * speedMul px/s, which is
 * slow enough that a shot taken a couple of seconds in still holds the layout —
 * it just softens it, which is what keeps the frame from looking arranged.
 *
 * This script brute-forces the seed nearest each target point, which is how the
 * CAST table in capture-store-screenshots.mjs got its numbers. Re-run it if the
 * capture viewport changes or the composition is reworked; the layout is tied
 * to BOUNDS below and to nothing else.
 *
 *   node tools/fish-layout-seeds.mjs [--target=screens|feature]
 */

const target = process.argv.includes('--target=feature') ? 'feature' : 'screens';

/**
 * NOT the capture viewport. Fish are constructed against Game's `swimBounds`,
 * which is `{ w: app.screen.width, h: sandTopY }` — and sandTopY is
 * `screen.height - uiBottomInset - 96`. At the moment the save's fish are
 * built the UI has not reported its inset yet, so that is 820 - 0 - 96 = 724.
 * Solving against 820 puts every fish about 16% too low.
 *
 * Once the UI does mount, the inset lands (123px at this viewport) and update()
 * starts clamping y to sandTopY - 100 = 501. Targets below ~490 pile up on that
 * line instead of sitting where they were placed, so the layout stays above it.
 *
 * To re-derive after a layout change: capture the hero shot, read off where the
 * top and bottom fish actually land, and fit h from the two.
 */
const BOUNDS = target === 'feature'
  // The feature graphic runs the same game at 1024x500 with the chrome hidden,
  // so sandTopY is 500 - 0 - 96.
  ? { w: 1024, h: 404 }
  : { w: 540, h: 724 };

/** Must match Fish's own generator (src/fish.ts). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function spawnFor(seed) {
  const rnd = mulberry32(seed);
  rnd(); // speedMul
  return {
    x: 60 + rnd() * Math.max(60, BOUNDS.w - 120),
    y: 90 + rnd() * Math.max(60, BOUNDS.h - 220),
  };
}

/**
 * The composition, in capture CSS pixels.
 *
 * The care bar ends at y=116 and the decor line starts around y=480, so the
 * open water is that band and the layout uses all of it: anything placed lower
 * disappears behind the kelp and the wreck, which is where the first attempt
 * lost four fish. The top of the band matters most — leave it empty and the
 * frame opens on a stripe of bare water directly under the HUD.
 *
 * Spread across the full width rather than pooled in the middle, and irregular
 * on purpose: an even lattice reads as wallpaper and a centred cluster reads as
 * a product shot. The two legendaries are the largest silhouettes and sit
 * off-centre, where the eye lands first.
 */
const LAYOUT = [
  ['altin-arowana', 170, 330],     // the focal point: biggest sprite, warm gold
  ['inci', 390, 250],
  ['koi', 95, 200],
  ['gen-epic-68', 455, 400],       // Yellow Tang
  ['gen-epic-71', 275, 148],       // Moorish Idol
  ['gen-epic-67', 80, 420],        // Blue Tang - the cool note, bottom left
  ['aslan', 445, 152],             // Lionfish - spines, upper right
  ['beta', 215, 440],
  ['gen-rare-62', 330, 470],       // Electric Yellow Cichlid
  ['kral-gramma', 165, 145],
  ['palyaco', 470, 300],           // Clownfish - the most recognisable outline
  ['melek', 250, 245],
  ['gen-uncommon-42', 120, 478],   // Clown Loach
  ['gen-uncommon-46', 345, 355],   // Electric Blue Ram
  ['neon-tetra', 405, 462],
  ['lepistes', 65, 305],
  ['gen-common-3', 350, 195],      // Swordtail
  ['gen-common-5', 230, 375],      // Tiger Barb
];

/**
 * The feature graphic's own composition, in its 1024x500 pixels.
 *
 * Different problem from the screenshot: the frame is a third as tall, the
 * wordmark owns the left 470px behind a scrim, and Play can drop a play button
 * over the middle. So the water is packed from x=380 rightward, thins under the
 * scrim rather than stopping dead at it, and keeps its largest shapes off the
 * exact centre. Spawn y can only run 90..274 at this height, which is the whole
 * usable band anyway once the sand takes the bottom quarter.
 */
const FEATURE_LAYOUT = [
  ['altin-arowana', 690, 175],     // focal, right of the play-button zone
  ['inci', 905, 130],
  ['koi', 470, 120],
  ['gen-epic-68', 830, 245],
  ['gen-epic-71', 600, 105],
  ['gen-epic-67', 355, 235],
  ['aslan', 975, 210],
  ['beta', 545, 250],
  ['gen-rare-62', 760, 100],
  ['kral-gramma', 250, 130],       // under the scrim: a shape, not a subject
  ['palyaco', 880, 180],
  ['melek', 430, 180],
  ['gen-uncommon-42', 660, 260],
  ['gen-uncommon-46', 300, 195],
  ['neon-tetra', 990, 105],
  ['lepistes', 150, 215],
  ['gen-common-3', 520, 200],
  ['gen-common-5', 780, 205],
  ['diskus', 210, 265],
  ['mandarin', 105, 140],
  ['zebra-ciklit', 940, 265],
  ['moli', 385, 145],
];

const SEARCH = 400_000;
const used = new Set();

for (const [sp, tx, ty] of target === 'feature' ? FEATURE_LAYOUT : LAYOUT) {
  let best = 0;
  let bestD = Infinity;
  for (let s = 1; s <= SEARCH; s++) {
    if (used.has(s)) continue;
    const { x, y } = spawnFor(s);
    const d = Math.hypot(x - tx, y - ty);
    if (d < bestD) {
      bestD = d;
      best = s;
      if (d < 0.4) break; // sub-pixel; nothing to gain from searching on
    }
  }
  used.add(best);
  const { x, y } = spawnFor(best);
  console.log(`  ['${sp}', ${best}],`.padEnd(34) + `// ${Math.round(x)},${Math.round(y)}`);
}
