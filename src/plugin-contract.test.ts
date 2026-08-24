// What the native plugins promise, checked against what this code assumes.
//
// TypeScript already checks the call shapes it can see, but the interesting
// failures are the ones it cannot: a plugin minor release renames a response
// field, `npm update` picks it up, and the call still compiles because the
// value flows through an `any` or a cast. The symptom is a feature that goes
// quiet rather than a build that breaks — which is how the leaderboard was
// silent for weeks for a different reason, and exactly the failure mode this
// project keeps rediscovering.
//
// Little Grand Hotel does the equivalent by prying open the .aar and looking
// for its ten keys in the constant pool. Here the plugins ship TypeScript
// declarations, so the pool to search is the .d.ts.
//
// This is a NAME check, not a behaviour check. It cannot tell whether
// `player_name` still holds what it used to; it can only tell whether the
// plugin still has a `player_name` at all. That is the half that breaks
// silently.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();

/** Every .d.ts a package ships, concatenated — the plugins split them per file. */
function declarations(pkg: string): string {
  const base = join(root, 'node_modules', pkg);
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) {
        if (entry === 'node_modules') continue;
        walk(p);
      } else if (entry.endsWith('.d.ts')) {
        out.push(readFileSync(p, 'utf8'));
      }
    }
  };
  walk(base);
  expect(out.length, `${pkg} ships no .d.ts`).toBeGreaterThan(0);
  return out.join('\n');
}

/**
 * The names this code reads off each plugin. Kept as literal strings rather
 * than derived from the source: a name that is wrong in both places would
 * derive cleanly and prove nothing.
 */
const CONTRACTS: Record<string, string[]> = {
  '@capacitor-community/admob': [
    // Methods
    'initialize', 'requestConsentInfo', 'showConsentForm',
    'prepareInterstitial', 'showInterstitial',
    'prepareRewardVideoAd', 'showRewardVideoAd',
    // Fields read off options and responses. testingDevices and
    // initializeForTesting are the pair that decides whether a real advertiser
    // is served an impression on a developer's handset.
    'testingDevices', 'initializeForTesting', 'adId',
    'canRequestAds', 'isConsentFormAvailable',
  ],
  'capacitor-game-connect-8': [
    'signIn', 'submitScore', 'showLeaderboard',
    // The response field the sign-in toast prints, and the two the score
    // submission is addressed with.
    'player_name', 'leaderboardID', 'totalScoreAmount',
  ],
  '@capacitor-firebase/authentication': [
    'signInWithGoogle',
    // skipNativeAuth is load-bearing: without it the native SDK opens the
    // session and the JS SDK's writes keep going to the old anonymous user.
    'skipNativeAuth', 'idToken', 'credential',
  ],
};

describe('the native plugins still have the names this code reads', () => {
  for (const [pkg, names] of Object.entries(CONTRACTS)) {
    it(pkg, () => {
      const dts = declarations(pkg);
      const missing = names.filter((n) => !dts.includes(n));
      expect(missing, `${pkg} no longer declares`).toEqual([]);
    });
  }

  it('the installed plugin versions are the ones package.json asks for', () => {
    // A contract checked against a tree that npm resolved differently from the
    // manifest is a contract checked against the wrong thing.
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    for (const name of Object.keys(CONTRACTS)) {
      expect(pkg.dependencies[name], `${name} is not a declared dependency`).toBeDefined();
    }
  });
});

describe('the scripts nothing else compiles', () => {
  // tsc covers src/. The .mjs tools are outside it entirely: a syntax error in
  // one of them is found by running it, which for the store capture tools meant
  // months later. `node --check` parses without executing.
  const scripts = [
    'test-reefy.mjs',
    ...readdirSync(join(root, 'tools'))
      .filter((f) => f.endsWith('.mjs'))
      .map((f) => join('tools', f)),
  ];

  it('there are scripts to check', () => {
    expect(scripts.length).toBeGreaterThan(3);
  });

  for (const script of scripts) {
    it(`${script} parses`, () => {
      expect(() => execFileSync(process.execPath, ['--check', join(root, script)], { stdio: 'pipe' }))
        .not.toThrow();
    });
  }
});
