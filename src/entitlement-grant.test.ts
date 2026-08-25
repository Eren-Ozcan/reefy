// What the game does with the store's answer about the remove-ads
// entitlement. The store side is covered in iap-restore.test.ts; this is the
// half that decides whether the flag in the save changes.
//
// The rule that matters is asymmetric, and it is easy to get wrong by writing
// the obvious `save.adsRemoved = owns`: a false answer means "offline" just as
// often as it means "never bought", so assigning it would switch ads back on
// for a paying player whose train went into a tunnel. Grant on true, and
// never touch it otherwise.

import { beforeEach, describe, expect, it, vi } from 'vitest';

/** What the fake store reports, and how many times it was asked. */
let ownsRemoveAds = false;
let restoreResult = { ok: true, ownsRemoveAds: false, msg: 'restored' };
const calls: string[] = [];

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
  createServices: () => ({
    auth: {},
    ads: {},
    social: {},
    iap: {
      ownsRemoveAds: async () => {
        calls.push('ownsRemoveAds');
        return ownsRemoveAds;
      },
      restore: async () => {
        calls.push('restore');
        return restoreResult;
      },
    },
  }),
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

const { Game } = await import('./game');
const { loadSave } = await import('./save');

/** restoreEntitlements is private on purpose — nothing outside startup calls it. */
function startupCheck(game: InstanceType<typeof Game>): Promise<void> {
  return (game as unknown as { restoreEntitlements(): Promise<void> }).restoreEntitlements();
}

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  ownsRemoveAds = false;
  restoreResult = { ok: true, ownsRemoveAds: false, msg: 'restored' };
});

describe('the startup entitlement check', () => {
  it('grants remove-ads when the store says the account owns it', async () => {
    ownsRemoveAds = true;
    const game = new Game();
    expect(game.save.adsRemoved).toBeFalsy();

    await startupCheck(game);

    expect(game.save.adsRemoved).toBe(true);
    // Written to disk, not just held in memory: the next cold start must not
    // have to ask the store again to keep the ads off.
    expect(loadSave().adsRemoved).toBe(true);
  });

  it('leaves the flag alone when the store says no', async () => {
    ownsRemoveAds = false;
    const game = new Game();

    await startupCheck(game);

    expect(game.save.adsRemoved).toBeFalsy();
  });

  it('never revokes an entitlement this device already knows about', async () => {
    // The offline case. A false answer here is indistinguishable from "the
    // store could not be reached", and taking ads-free away from someone who
    // paid is the more expensive mistake of the two.
    ownsRemoveAds = false;
    const game = new Game();
    game.save.adsRemoved = true;

    await startupCheck(game);

    expect(game.save.adsRemoved).toBe(true);
  });

  it('does not ask the store at all once the flag is set', async () => {
    const game = new Game();
    game.save.adsRemoved = true;

    await startupCheck(game);

    expect(calls).toEqual([]);
  });
});

describe('the Restore purchases button', () => {
  it('grants and persists what the store returns', async () => {
    restoreResult = { ok: true, ownsRemoveAds: true, msg: 'Purchases restored. ✓' };
    const game = new Game();

    const msg = await game.restorePurchases();

    expect(game.save.adsRemoved).toBe(true);
    expect(loadSave().adsRemoved).toBe(true);
    // The message is passed through rather than reworded, so the player sees
    // the store's own outcome — including the "nothing found" case.
    expect(msg).toBe('Purchases restored. ✓');
  });

  it('reports an empty account without changing anything', async () => {
    restoreResult = { ok: true, ownsRemoveAds: false, msg: 'No purchases found on this account.' };
    const game = new Game();

    const msg = await game.restorePurchases();

    expect(game.save.adsRemoved).toBeFalsy();
    expect(msg).toBe('No purchases found on this account.');
  });

  it('does not revoke on a failed restore', async () => {
    restoreResult = { ok: false, ownsRemoveAds: false, msg: "Couldn't restore: offline" };
    const game = new Game();
    game.save.adsRemoved = true;

    await game.restorePurchases();

    expect(game.save.adsRemoved).toBe(true);
  });
});
