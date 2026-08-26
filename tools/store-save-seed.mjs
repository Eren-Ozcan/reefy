/**
 * The seeded save every capture runs against — the cast, the decor, the
 * collection, and the numbers on the HUD.
 *
 * It lives on its own because two tools need the SAME reef: the store
 * screenshots and the promo video. A second copy of these seeds would drift,
 * and the two would then be advertising different games.
 *
 * Nothing here touches a browser. Callers own the viewport, the language and
 * how long the player has supposedly been away.
 */
export const TANK = 'tank-mercan-koyu';

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
export const CAST = [
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

export const NAMES = [
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
export const PLACED = [
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
export const COLLECTION = [
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
export function makeSave({ lang, awayMs, growing = 0, spotless = false }) {
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
