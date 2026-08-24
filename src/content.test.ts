/**
 * The content tables and the things outside the code that have to agree with
 * them. Nothing here exercises game logic; it asserts that the hand-written
 * data is internally consistent and that the facts repeated elsewhere — the
 * Android version, the README's product ids — still match their source.
 *
 * This exists because the sister project (Little Grand Hotel) has had a
 * `data_check` and a `store_compliance_check` for months and this one did not,
 * and the first run of it found a real defect: the README told anyone setting
 * up the store to create products called `pearls-s`, while the code has always
 * asked the store for `pearls_s`. A store product whose id is one character off
 * does not fail loudly — `findStorePackage()` simply never matches it, and the
 * purchase declines.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { EGGS, RARITY_INFO, RARITY_ORDER, SPECIES, type Rarity } from './species';
import { BIOME_INFO, TANKS } from './tanks';
import { DECOR, DECOR_BOOST, MAX_PLACED } from './decor';
import { FEEDS, FEED_PACKS } from './feeds';
import { IAP_PACKS } from './services';
import { EVENTS } from './events';

/** Every id that reaches a save file, so a rename is caught rather than silently orphaning saves. */
const TABLES = {
  species: SPECIES.map((s) => s.id),
  tanks: TANKS.map((t) => t.id),
  decor: DECOR.map((d) => d.id),
  feeds: FEEDS.map((f) => f.id),
  eggs: EGGS.map((e) => e.id),
  iap: IAP_PACKS.map((p) => p.id),
  events: EVENTS.map((e) => e.id),
};

describe('ids', () => {
  for (const [table, ids] of Object.entries(TABLES)) {
    it(`${table} ids are unique`, () => {
      const seen = new Set<string>();
      const dupes = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
      expect(dupes).toEqual([]);
    });

    it(`${table} ids are non-empty and free of characters a save key cannot hold`, () => {
      for (const id of ids) {
        expect(id).not.toBe('');
        // Ids end up as object keys in the save and as Play product ids; keeping
        // them to this set means neither layer has to escape anything.
        expect(id).toMatch(/^[a-z0-9_-]+$/);
      }
    });
  }
});

describe('references resolve', () => {
  it('every tank names a biome that exists', () => {
    const missing = TANKS.filter((t) => !(t.biome in BIOME_INFO)).map((t) => t.id);
    expect(missing).toEqual([]);
  });

  it('every species names a rarity that exists', () => {
    const missing = SPECIES.filter((s) => !(s.rarity in RARITY_INFO)).map((s) => s.id);
    expect(missing).toEqual([]);
  });

  it('every decor item names a rarity that exists, and that rarity has a boost', () => {
    const missing = DECOR.filter((d) => !(d.rarity in RARITY_INFO) || !(d.rarity in DECOR_BOOST));
    expect(missing.map((d) => d.id)).toEqual([]);
  });

  it('every egg tier draws only from rarities that exist, and its odds sum to 100', () => {
    for (const egg of EGGS) {
      const rarities = Object.keys(egg.odds) as Rarity[];
      expect(rarities.every((r) => RARITY_ORDER.includes(r)), egg.id).toBe(true);
      const total = Object.values(egg.odds).reduce((a, b) => a + b, 0);
      expect(total, `${egg.id} odds`).toBe(100);
    }
  });

  it('every egg tier can actually hatch something at every rarity it promises', () => {
    // Odds that name a rarity no species has are worse than a bug in the table:
    // the roll succeeds and then finds an empty pool.
    for (const egg of EGGS) {
      for (const rarity of Object.keys(egg.odds) as Rarity[]) {
        const pool = SPECIES.filter((s) => s.rarity === rarity);
        expect(pool.length, `${egg.id} rolls ${rarity}`).toBeGreaterThan(0);
      }
    }
  });

  it('every event scores only actions the game reports', () => {
    // The keys are compared against the union the scorer accepts. A typo here
    // is silent: the action fires, the key misses, the player earns nothing.
    const scorable = ['feed', 'clean', 'buyFish', 'placeDecor', 'sell', 'hatch', 'collect', 'earn'];
    for (const e of EVENTS) {
      const unknown = Object.keys(e.points).filter((k) => !scorable.includes(k));
      expect(unknown, e.id).toEqual([]);
    }
  });
});

describe('numbers that would break the economy silently', () => {
  it('no species sells for less than it costs', () => {
    // A negative margin is not a difficulty knob, it is a trap: the fish can
    // only ever lose money, and nothing in the UI says so.
    const upsideDown = SPECIES
      .filter((s) => s.buyPrice > 0 && s.sellPrice <= s.buyPrice)
      .map((s) => `${s.id} buy ${s.buyPrice} sell ${s.sellPrice}`);
    expect(upsideDown).toEqual([]);
  });

  it('every species takes real time to grow and unlocks at a real level', () => {
    for (const s of SPECIES) {
      expect(s.growthMs, s.id).toBeGreaterThan(0);
      expect(s.unlockLevel, s.id).toBeGreaterThanOrEqual(1);
      expect(s.size, s.id).toBeGreaterThan(0);
    }
  });

  it('every priced thing costs something, in a currency that exists', () => {
    for (const d of DECOR) {
      expect(d.price, d.id).toBeGreaterThan(0);
      expect(['coins', 'pearls']).toContain(d.currency);
    }
    for (const e of EGGS) {
      expect(e.cost, e.id).toBeGreaterThan(0);
      expect(['coins', 'pearls']).toContain(e.currency);
    }
  });

  it('the free feed is the only free one, and every feed fills something', () => {
    const free = FEEDS.filter((f) => f.cost === 0).map((f) => f.id);
    expect(free).toEqual(['standart']);
    for (const f of FEEDS) expect(f.hunger, f.id).toBeGreaterThan(0);
  });

  it('every feed pack sells a feed that exists', () => {
    const ids = new Set(FEEDS.map((f) => f.id));
    const orphans = FEED_PACKS.filter((p) => !ids.has(p.feed)).map((p) => p.id ?? p.feed);
    expect(orphans).toEqual([]);
  });

  it('every tank is buyable at a sane price, except the starter', () => {
    expect(MAX_PLACED).toBeGreaterThan(0);
    const free = TANKS.filter((t) => t.price === 0).map((t) => t.id);
    expect(free.length, 'exactly one starter tank').toBe(1);
    for (const t of TANKS) {
      expect(['coins', 'pearls']).toContain(t.currency);
      expect(t.unlockLevel, t.id).toBeGreaterThanOrEqual(1);
      // A negative growth bonus would be a tank you are punished for buying.
      expect(t.growthBonus, t.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('event tiers rise, and each one pays something', () => {
    for (const e of EVENTS) {
      const points = e.tiers.map((t) => t.points);
      expect(points, e.id).toEqual([...points].sort((a, b) => a - b));
      expect(new Set(points).size, `${e.id} duplicate tiers`).toBe(points.length);
      for (const t of e.tiers) expect(t.coins + t.pearls, `${e.id} tier ${t.points}`).toBeGreaterThan(0);
    }
  });

  it('every event ends after it starts', () => {
    for (const e of EVENTS) expect(e.end >= e.start, e.id).toBe(true);
  });
});

describe('facts repeated outside the code', () => {
  // Resolved from the repo root: vitest runs there, and import.meta.url under
  // the jsdom environment does not survive a ../ join.
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

  it('the Android versionName matches package.json', () => {
    // Bumped by hand in two files. They have never disagreed, and the only
    // reason is that nobody has forgotten yet.
    const pkg = JSON.parse(read('package.json')) as { version: string };
    const gradle = read('android/app/build.gradle');
    const name = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
    expect(name).toBe(pkg.version);
  });

  it('the Android versionCode is a plain increasing integer', () => {
    const gradle = read('android/app/build.gradle');
    const code = /versionCode\s+(\d+)/.exec(gradle)?.[1];
    expect(code).toBeDefined();
    expect(Number(code)).toBeGreaterThan(0);
  });

  it('the README lists the product ids the code actually asks the store for', () => {
    // RevenueCat matches by product id. An id that differs by one character
    // does not error — findStorePackage() just never matches, and the purchase
    // declines with "not connected".
    const readme = read('README.md');
    for (const pack of IAP_PACKS) {
      expect(readme, `README is missing ${pack.id}`).toContain(pack.id);
    }
  });

  it('the ad unit ids are this publisher\'s, not Google\'s sample ids', () => {
    // ca-app-pub-3940256099942544 is the id every AdMob tutorial pastes. A
    // release that ships it serves test ads to everyone and earns nothing.
    const ads = read('src/ads.ts');
    expect(ads).not.toContain('ca-app-pub-3940256099942544');
    expect(ads).toMatch(/ca-app-pub-\d+\/\d+/);
  });

  it('the privacy policy the store points at is named in the repo', () => {
    const privacy = read('PRIVACY.md');
    expect(privacy.length).toBeGreaterThan(200);
  });
});
