// The quiet spell a tank earns by being cleared completely.
//
// The offline half is the part worth pinning. Cleaning a tank and closing the
// app is the exact moment the reward matters most, and the away-time maths is
// where it would silently stop working: the grace has to cancel only the part
// of the absence that overlaps it, never the whole absence and never nothing.

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

const GRACE_MS = 10 * 60_000;
/** applyOfflineDirt is private; the away-time maths is the whole point of these tests. */
type OfflineDirt = { applyOfflineDirt(elapsed: number): void };

beforeEach(() => {
  localStorage.clear();
});

function tankWithGraceStartedAgo(ms: number): InstanceType<typeof Game> {
  const game = new Game();
  const tank = game.save.activeTank;
  game.save.tanksOwned = [tank];
  game.save.dirtSpots[tank] = [];
  game.save.spotlessAt[tank] = Date.now() - ms;
  return game;
}

describe('the quiet spell after a tank is cleared', () => {
  it('spawns nothing while the whole absence falls inside it', () => {
    const game = tankWithGraceStartedAgo(60_000);
    (game as unknown as OfflineDirt).applyOfflineDirt(60_000);
    expect(game.save.dirtSpots[game.save.activeTank]).toHaveLength(0);
  });

  it('only discounts the overlapping part of a longer absence', () => {
    // Away for the grace plus an hour: the hour still dirties the tank.
    const game = tankWithGraceStartedAgo(GRACE_MS + 3_600_000);
    (game as unknown as OfflineDirt).applyOfflineDirt(GRACE_MS + 3_600_000);
    expect(game.save.dirtSpots[game.save.activeTank].length).toBeGreaterThan(0);
  });

  it('does not apply to a tank that was never cleared', () => {
    const game = new Game();
    const tank = game.save.activeTank;
    game.save.tanksOwned = [tank];
    game.save.dirtSpots[tank] = [];
    game.save.spotlessAt = {};
    (game as unknown as OfflineDirt).applyOfflineDirt(3_600_000);
    expect(game.save.dirtSpots[tank].length).toBeGreaterThan(0);
  });

});
