// The two clocks the player never sees running: the daily gift's day boundary
// and the income that accrues while the app is closed. Both are written against
// wall-clock time, both are easy to get wrong in a way that only shows up a day
// later, and neither had a test.
//
// The sister project (Little Grand Hotel) has had `time_check` and
// `offline_check` for a while and they cover exactly these two: a day boundary
// that pays twice, a streak that breaks when it should not, an offline cap that
// mints coins it should not, a bank that drains by the wrong amount.
//
// Game is set up the same way as game-sync.test.ts: the real object, with only
// the outside world mocked. applyOffline() and applyDailyGift() are private, so
// they are reached through a cast — the alternative is exporting them purely for
// the test, which would say they are API when they are not.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveData } from './save';

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
  createServices: () => ({ auth: {}, iap: {}, ads: {}, social: {} }),
  submitPlayScore: () => undefined,
}));

vi.mock('./cloud-save', () => ({
  CloudSave: class {
    get isStale(): boolean { return false; }
    markDirty(): void {}
    maybeUpload(): void {}
    flush(): void {}
    resetForNewAccount(): void {}
    async sync(): Promise<string> { return 'in-sync'; }
  },
}));

const { Game, INCOME_CAP_HOURS } = await import('./game');
const { defaultSave } = await import('./save');
const { RARITY_INCOME } = await import('./species');

type GameInstance = InstanceType<typeof Game>;
/** applyOffline and applyDailyGift are private on purpose; the tests still need them. */
type Innards = { applyOffline(): void; applyDailyGift(): void };
const innards = (g: GameInstance): Innards => g as unknown as Innards;

const HOUR = 3600_000;
const DAY = 86_400_000;
/** The offline income multiplier and the away cap, mirrored from game.ts. */
const OFFLINE_SPEED = 0.5;
const OFFLINE_CAP_HOURS = 8;

const dayKey = (t: number): string => new Date(t).toISOString().slice(0, 10);

/** A game with a save the test fully controls. */
function gameWith(patch: (s: SaveData) => void): GameInstance {
  const game = new Game();
  const save = defaultSave();
  patch(save);
  game.save = save;
  return game;
}

/** One adult common fish in the starter tank — 25 coins/hour, no decor, no dirt. */
function oneAdult(s: SaveData): void {
  s.fishes = [{ sp: 'lepistes', progress: 1, hunger: 1, name: 'A', seed: 1, tank: s.activeTank }];
}

beforeEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('the daily gift, at the day boundary', () => {
  it('the first launch starts the streak WITHOUT paying a gift', () => {
    // Otherwise every fresh install, and every save reset, is a free day one.
    const game = gameWith((s) => { s.lastDaily = ''; s.coins = 300; });

    innards(game).applyDailyGift();

    expect(game.save.streak).toBe(1);
    expect(game.save.coins).toBe(300);
    expect(game.offline.dailyGift).toBe(false);
  });

  it('a second call on the same day pays nothing', () => {
    // syncSave and the visibility handler both reach this path; paying on each
    // one would make the gift a function of how often the app is reopened.
    const game = gameWith((s) => {
      s.lastDaily = dayKey(Date.now() - DAY);
      s.streak = 3;
      s.coins = 0;
    });

    innards(game).applyDailyGift();
    const afterFirst = game.save.coins;
    expect(afterFirst).toBeGreaterThan(0);

    innards(game).applyDailyGift();

    expect(game.save.coins).toBe(afterFirst);
    expect(game.save.streak).toBe(4);
  });

  it('yesterday continues the streak; a gap resets it to one', () => {
    const continued = gameWith((s) => { s.lastDaily = dayKey(Date.now() - DAY); s.streak = 5; });
    innards(continued).applyDailyGift();
    expect(continued.save.streak).toBe(6);

    const broken = gameWith((s) => { s.lastDaily = dayKey(Date.now() - 3 * DAY); s.streak = 5; });
    innards(broken).applyDailyGift();
    expect(broken.save.streak).toBe(1);
  });

  it('the best streak survives a break', () => {
    const game = gameWith((s) => { s.lastDaily = dayKey(Date.now() - 4 * DAY); s.streak = 9; s.bestStreak = 9; });

    innards(game).applyDailyGift();

    expect(game.save.streak).toBe(1);
    expect(game.save.bestStreak).toBe(9);
  });

  it('reports the gift so the returning-player summary can show it', () => {
    const game = gameWith((s) => { s.lastDaily = dayKey(Date.now() - DAY); s.streak = 6; });

    innards(game).applyDailyGift();

    expect(game.offline.dailyGift).toBe(true);
    expect(game.offline.giftCoins).toBeGreaterThan(0);
    // Day seven of a cycle is the one that pays three pearls.
    expect(game.offline.giftPearls).toBe(3);
  });
});

describe('the gift ladder', () => {
  it('coins rise with the streak and then stop rising', () => {
    const at = (n: number) => Game.dailyGiftFor(n).coins;
    expect(at(1)).toBeLessThan(at(2));
    expect(at(7)).toBeGreaterThan(at(1));
    // Capped, or a long streak eventually pays more than the game is worth.
    expect(at(30)).toBe(at(7));
  });

  it('every seventh day pays three pearls, the rest pay one', () => {
    for (let n = 1; n <= 21; n++) {
      expect(Game.dailyGiftFor(n).pearls, `day ${n}`).toBe(n % 7 === 0 ? 3 : 1);
    }
  });
});

describe('the seven-day ladder the sheet draws', () => {
  const cycle = (streak: number) => gameWith((s) => { s.streak = streak; }).streakCycle();

  it('always has seven days, with exactly one marked today', () => {
    for (const streak of [1, 4, 7, 8, 13, 15]) {
      const days = cycle(streak);
      expect(days).toHaveLength(7);
      expect(days.filter((d) => d.state === 'today'), `streak ${streak}`).toHaveLength(1);
    }
  });

  it('puts today at the right rung, and wraps after the seventh', () => {
    expect(cycle(1).findIndex((d) => d.state === 'today')).toBe(0);
    expect(cycle(7).findIndex((d) => d.state === 'today')).toBe(6);
    // Day 8 is the first rung of the SECOND cycle, not an eighth rung.
    expect(cycle(8).findIndex((d) => d.state === 'today')).toBe(0);
  });

  it('shows the rewards of the cycle it is actually in', () => {
    // The second cycle's rungs are the streak's real days 8..14, so the seventh
    // rung there must still be the three-pearl one.
    const second = cycle(8);
    expect(second[6].pearls).toBe(3);
    expect(second.slice(0, 6).every((d) => d.pearls === 1)).toBe(true);
  });
});

describe('income earned while the app was closed', () => {
  const rate = RARITY_INCOME.common; // one adult common fish, no multipliers

  it('does nothing for a trip shorter than a minute', () => {
    const game = gameWith((s) => { oneAdult(s); s.lastSeen = Date.now() - 30_000; s.incomePot = 0; });

    innards(game).applyOffline();

    expect(game.save.incomePot).toBe(0);
    expect(game.offline.minutes).toBe(0);
  });

  it('accrues at half rate, against the tank as it is on return', () => {
    // The multiplier is read AFTER the call on purpose: applyOffline() adds the
    // dirt for the time away before it prices the income, so the rate that pays
    // is the dirty one, not the one the player left behind.
    const game = gameWith((s) => { oneAdult(s); s.lastSeen = Date.now() - 2 * HOUR; s.incomePot = 0; });

    innards(game).applyOffline();

    const paid = rate * game.growthMult;
    expect(game.save.incomePot).toBeCloseTo(paid * 2 * OFFLINE_SPEED, 0);
    expect(game.offline.income).toBe(Math.floor(paid * 2 * OFFLINE_SPEED));
  });

  it('stops counting after the away cap, however long the trip was', () => {
    // Without this, a phone whose clock jumped — or a player back from a week
    // away — mints the difference.
    const overnight = gameWith((s) => { oneAdult(s); s.lastSeen = Date.now() - OFFLINE_CAP_HOURS * HOUR; });
    const aWeek = gameWith((s) => { oneAdult(s); s.lastSeen = Date.now() - 7 * 24 * HOUR; });

    innards(overnight).applyOffline();
    innards(aWeek).applyOffline();

    expect(aWeek.save.incomePot).toBeCloseTo(overnight.save.incomePot, 0);
  });

  it('never fills the pot past the collection cap', () => {
    const game = gameWith((s) => { oneAdult(s); s.lastSeen = Date.now() - 7 * 24 * HOUR; s.incomePot = 0; });

    innards(game).applyOffline();

    expect(game.save.incomePot).toBeLessThanOrEqual(rate * game.growthMult * INCOME_CAP_HOURS + 0.001);
  });

  it('the cap never takes back coins that were already banked', () => {
    // Regression. The pot is filled online at the clean rate; the tank then gets
    // dirty while the app is closed, which lowers the rate AND the cap with it.
    // A plain Math.min against the new cap deleted the difference — 35 coins in
    // this setup — and reported it as NEGATIVE income in the welcome-back sheet.
    const bankedAtCleanRate = rate * INCOME_CAP_HOURS;
    const game = gameWith((s) => {
      oneAdult(s);
      s.lastSeen = Date.now() - 6 * HOUR;
      s.incomePot = bankedAtCleanRate;
    });

    innards(game).applyOffline();

    expect(game.growthMult, 'the tank did get dirty while away').toBeLessThan(1);
    expect(game.save.incomePot).toBeGreaterThanOrEqual(bankedAtCleanRate);
    expect(game.offline.income).toBeGreaterThanOrEqual(0);
  });

  it('a tank with no adults earns nothing at all', () => {
    const game = gameWith((s) => {
      s.fishes = [{ sp: 'lepistes', progress: 0.3, hunger: 1, name: 'Yavru', seed: 1, tank: s.activeTank }];
      s.lastSeen = Date.now() - 5 * HOUR;
      s.incomePot = 0;
    });

    innards(game).applyOffline();

    expect(game.save.incomePot).toBe(0);
    expect(game.offline.income).toBe(0);
  });
});

describe('fish, while the app was closed', () => {
  it('hunger falls but never below the floor', () => {
    const game = gameWith((s) => {
      s.fishes = [{ sp: 'lepistes', progress: 1, hunger: 1, name: 'A', seed: 1, tank: s.activeTank }];
      s.lastSeen = Date.now() - 7 * 24 * HOUR;
    });

    innards(game).applyOffline();

    expect(game.save.fishes[0].hunger).toBeGreaterThanOrEqual(0.05);
    expect(game.save.fishes[0].hunger).toBeLessThan(1);
  });

  it('growth finishes and is counted, and never passes one', () => {
    const game = gameWith((s) => {
      s.fishes = [{ sp: 'lepistes', progress: 0.95, hunger: 1, name: 'A', seed: 1, tank: s.activeTank }];
      s.lastSeen = Date.now() - OFFLINE_CAP_HOURS * HOUR;
    });

    innards(game).applyOffline();

    expect(game.save.fishes[0].progress).toBe(1);
    expect(game.offline.grown).toBe(1);
  });

  it('a fish that was already grown is not counted again', () => {
    // offline.grown drives a toast; counting an adult would announce a fish
    // that grew up days ago, every single launch.
    const game = gameWith((s) => { oneAdult(s); s.lastSeen = Date.now() - 5 * HOUR; });

    innards(game).applyOffline();

    expect(game.offline.grown).toBe(0);
  });

  it('reports how long the player was away, in minutes', () => {
    const game = gameWith((s) => { oneAdult(s); s.lastSeen = Date.now() - 90 * 60_000; });

    innards(game).applyOffline();

    expect(game.offline.minutes).toBe(90);
  });
});
