// The other half of the remove-ads check: that switching tanks really does
// route through the ads provider rather than reaching AdMob on its own.
//
// [[interstitial-guard.test.ts]] proves the guard refuses once remove-ads is
// owned; that only protects the tank switch if the switch asks the provider at
// all. This is the pairing test, and it is a test rather than a handset check
// because a second tank costs 2,500 coins and level 3.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const maybeShowInterstitial = vi.hoisted(() => vi.fn());

vi.mock('pixi.js', () => {
  // Unlike the other suites' pixi stubs, this one has to survive a real
  // buildStatic() call — switchTank redraws the whole scene on its way to the
  // ads provider. The drawing commands are chainable and their return values
  // are never inspected, so one self-returning stub covers all of them.
  const DRAW = [
    'clear', 'rect', 'roundRect', 'circle', 'ellipse', 'poly', 'star',
    'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo',
    'beginPath', 'closePath', 'fill', 'stroke', 'setStrokeStyle', 'setFillStyle',
  ];
  class Node {
    children: unknown[] = [];
    position = { set: (): void => undefined };
    scale = { set: (): void => undefined };
    constructor() {
      for (const m of DRAW) (this as Record<string, unknown>)[m] = (): Node => this;
    }
    addChild(child: unknown): unknown { this.children.push(child); return child; }
    removeChildren(): void { this.children = []; }
    removeChild(): void {}
    destroy(): void {}
  }
  return {
    Application: class { screen = { width: 720, height: 1280 }; stage = new Node(); },
    Container: Node,
    Graphics: Node,
    Sprite: Node,
    Rectangle: class {},
    Texture: class {},
    FillGradient: class { addColorStop(): void {} },
    BlurFilter: class {},
  };
});

vi.mock('./services', () => ({
  createServices: () => ({
    auth: {},
    iap: {},
    ads: { maybeShowInterstitial },
    social: { updateScore: () => undefined },
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
    async sync(): Promise<'in-sync'> { return 'in-sync'; }
  },
}));

const { Game } = await import('./game');
const { TANKS } = await import('./tanks');

const SECOND_TANK = TANKS[1].id;

/** `Game.ui` is wired up by main.ts, not the constructor; switchTank refreshes
 *  the HUD on its way through, so the tests stand in the one method it uses. */
function headlessGame(): InstanceType<typeof Game> {
  const game = new Game();
  (game as unknown as { ui: { refreshHUD(): void } }).ui = { refreshHUD: () => undefined };
  return game;
}

beforeEach(() => {
  localStorage.clear();
  maybeShowInterstitial.mockClear();
});

describe('switching tanks', () => {
  it('asks the ads provider on a successful switch', () => {
    const game = headlessGame();
    game.save.tanksOwned.push(SECOND_TANK);

    expect(game.switchTank(SECOND_TANK).ok).toBe(true);
    expect(maybeShowInterstitial).toHaveBeenCalledTimes(1);
  });

  it('asks nothing when the switch is refused', () => {
    // A refused switch showing an ad would be the worst of both: the player
    // pays attention for a screen they never left.
    const game = headlessGame();

    expect(game.switchTank(SECOND_TANK).ok).toBe(false); // not owned
    expect(game.switchTank(game.save.activeTank).ok).toBe(false); // already here
    expect(maybeShowInterstitial).not.toHaveBeenCalled();
  });
});
