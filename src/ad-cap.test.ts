// The daily cap on rewarded ads. Worth its own tests because the cap is the
// only thing standing between the pearl economy and an unlimited free tap:
// before it existed a 30-second cooldown was the sole limit, which put roughly
// ten smallest-packs-per-hour within reach at no cost.
//
// The day boundary is the part that actually needs proving. A cap that counts
// against a stale day either locks a player out forever or resets on every
// call, and both look like the cap "working" until someone plays past midnight.
//
// Game is built for real; only the outside world is mocked.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('pixi.js', () => {
  class Node {
    addChild(child: unknown): unknown { return child; }
    removeChildren(): void {}
    destroy(): void {}
  }
  return {
    Application: class { screen = { width: 720, height: 1280 }; stage = new Node(); },
    Container: Node,
    Graphics: Node,
    Sprite: Node,
    Rectangle: class {},
    Texture: class {},
    FillGradient: class {},
    BlurFilter: class {},
  };
});

vi.mock('./services', () => ({
  createServices: () => ({ auth: {}, iap: {}, ads: {}, social: { updateScore: () => undefined } }),
  submitPlayScore: () => undefined,
}));

vi.mock('./cloud-save', () => ({
  CloudSave: class {
    get isStale(): boolean { return false; }
    markDirty(): void {}
    maybeUpload(): void {}
    flush(): void {}
    resetForNewAccount(): void {}
    async sync(): Promise<'in-sync'> { return 'in-sync'; }
  },
}));

const { Game } = await import('./game');
const { REWARDED_ADS_PER_DAY, GROWTH_ADS_PER_DAY, GROWTH_AD_MS } = await import('./ads');

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

beforeEach(() => {
  localStorage.clear();
});

describe('the rewarded-ad daily cap', () => {
  it('starts the day with the full allowance', () => {
    const game = new Game();
    expect(game.adRewardsLeftToday()).toBe(REWARDED_ADS_PER_DAY);
  });

  it('counts down as ads are watched, and stops at zero', () => {
    const game = new Game();
    for (let i = 0; i < REWARDED_ADS_PER_DAY; i++) game.noteAdRewardWatched();

    expect(game.adRewardsLeftToday()).toBe(0);
    expect(game.save.adRewardDay).toBe(today());

    // Past the cap the count may keep climbing; what must not happen is the
    // remaining allowance going negative and reading as "some left" anywhere.
    game.noteAdRewardWatched();
    expect(game.adRewardsLeftToday()).toBe(0);
  });

  it('gives the allowance back when the day changes', () => {
    const game = new Game();
    for (let i = 0; i < REWARDED_ADS_PER_DAY; i++) game.noteAdRewardWatched();
    expect(game.adRewardsLeftToday()).toBe(0);

    game.save.adRewardDay = '2020-01-01';
    expect(game.adRewardsLeftToday()).toBe(REWARDED_ADS_PER_DAY);

    // ...and the first ad of the new day restarts the count rather than adding
    // to yesterday's, which would burn the fresh allowance immediately.
    game.noteAdRewardWatched();
    expect(game.save.adRewardCount).toBe(1);
    expect(game.adRewardsLeftToday()).toBe(REWARDED_ADS_PER_DAY - 1);
  });

  it('treats a save written before the cap as a full day', () => {
    const game = new Game();
    game.save.adRewardDay = '';
    game.save.adRewardCount = 0;
    expect(game.adRewardsLeftToday()).toBe(REWARDED_ADS_PER_DAY);
  });
});

describe('the growth-boost ad', () => {
  // A stand-in for a live Fish: applyGrowthAd only touches progress, name and the species' growthMs.
  const fish = (progress: number, growthMs = 30 * 60 * 1000) =>
    ({ progress, name: 'Bubbles', sp: { growthMs } }) as unknown as Parameters<InstanceType<typeof Game>['applyGrowthAd']>[0];

  it('has its own allowance, separate from the pearl ads', () => {
    const game = new Game();
    game.applyGrowthAd(fish(0));
    expect(game.growthAdsLeftToday()).toBe(GROWTH_ADS_PER_DAY - 1);
    expect(game.adRewardsLeftToday()).toBe(REWARDED_ADS_PER_DAY);
  });

  it('skips exactly GROWTH_AD_MS of growth and no more than the fish has left', () => {
    const game = new Game();
    const f = fish(0.1);
    game.applyGrowthAd(f);
    expect(f.progress).toBeCloseTo(0.1 + GROWTH_AD_MS / (30 * 60 * 1000));

    const nearly = fish(0.95);
    game.applyGrowthAd(nearly);
    expect(nearly.progress).toBe(1);
  });

  it('refuses an adult and does not spend the allowance on it', () => {
    const game = new Game();
    expect(game.applyGrowthAd(fish(1)).ok).toBe(false);
    expect(game.growthAdsLeftToday()).toBe(GROWTH_ADS_PER_DAY);
  });

  it('gives the allowance back when the day changes', () => {
    const game = new Game();
    for (let i = 0; i < GROWTH_ADS_PER_DAY; i++) game.applyGrowthAd(fish(0));
    expect(game.growthAdsLeftToday()).toBe(0);
    game.save.growthAdDay = '2020-01-01';
    expect(game.growthAdsLeftToday()).toBe(GROWTH_ADS_PER_DAY);
  });
});
