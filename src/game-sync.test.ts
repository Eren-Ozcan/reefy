// The race between Game.syncSave() and restoring from the cloud — on a real
// device this actually caused data loss (see TODO.md "two-emulator run"):
//
//   1. syncSave() builds the fish list from the SCENE, not from the save.
//      During a mid-session restore, the scene still holds the OLD save's
//      fish, and the beforeunload -> syncSave() triggered by
//      location.reload() overwrites the downloaded fish with the old ones
//      (5 fish dropped to 2). Worse, the same call also writes to the cloud,
//      so the overwritten list could propagate to the other device.
//   2. The FIRST fix for this was also wrong: freezing ALL of syncSave()
//      also stopped persist() — the only place that writes the downloaded
//      save to disk — so reloading read the old save and silently wiped
//      out the restore.
//
// So the correct behavior has three parts, each tested separately below:
// while frozen, NO building from the scene, NO writing to the cloud, YES
// writing to disk.
//
// Game is set up as a real object (the actual syncSave() runs); only the
// outside world is mocked: Pixi scene objects, platform services, and the
// cloud.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fish } from './fish';
import type { CloudSyncResult } from './cloud-save';
import type { FishSave, SaveData } from './save';

/** Ordered log of calls made to the cloud and service layer. */
const calls: string[] = [];
/** The mocked cloud's sync() result — tests set up the restore scenario from here. */
let cloudSyncResult: CloudSyncResult = 'in-sync';

// Scene objects: syncSave() never touches any of these, they only exist so
// Game's field initializers (new Graphics() etc.) can be constructed.
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
    iap: {},
    ads: {},
    social: { updateScore: () => calls.push('updateScore') },
  }),
}));

/** Whether the mocked cloud reports a rev left behind by another device. */
let cloudStale = false;

vi.mock('./cloud-save', () => ({
  CloudSave: class {
    get isStale(): boolean { return cloudStale; }
    markDirty(): void { calls.push('markDirty'); }
    maybeUpload(): void { calls.push('maybeUpload'); }
    flush(): void { calls.push('flush'); }
    resetForNewAccount(): void { calls.push('resetForNewAccount'); }
    async sync(): Promise<CloudSyncResult> {
      calls.push('sync');
      // Deliberately does NOT clear cloudStale, and yields once before
      // resolving. The real sync() clears the flag on entry, which would make
      // overlapping calls impossible to observe — and overlapping calls are
      // exactly what the in-flight guard exists to stop.
      await Promise.resolve();
      return cloudSyncResult;
    }
  },
}));

const { Game } = await import('./game');
const { defaultSave, loadSave } = await import('./save');

/** A save downloaded from the cloud: 5 fish, none overlapping with the scene. */
function cloudRestoredSave(): SaveData {
  const s = defaultSave();
  s.level = 9;
  s.coins = 8000;
  s.fishes = ['a', 'b', 'c', 'd', 'e'].map((n, i) => ({
    sp: 'neon-tetra', progress: 0.5, hunger: 0.5, name: 'Bulut-' + n, seed: i, tank: s.activeTank,
  }));
  return s;
}

/** As far as syncSave() is concerned, toSave() is the scene fish's only interface. */
function sceneFish(name: string): Fish {
  return {
    toSave: (): FishSave => ({ sp: 'lepistes', progress: 0.5, hunger: 0.5, name, seed: 1, tank: 'tank-mercan-koyu' }),
  } as unknown as Fish;
}

/** Fish dormant in other tanks — `dormant` is intentionally private. */
function setDormant(game: InstanceType<typeof Game>, list: FishSave[]): void {
  (game as unknown as { dormant: FishSave[] }).dormant = list;
}

/** A game whose scene was built from the old save but whose save was refreshed from the cloud. */
function midSessionRestore(): InstanceType<typeof Game> {
  const game = new Game();
  game.save = cloudRestoredSave();
  game.fishes = [sceneFish('Sahne-1')];
  setDormant(game, [{ sp: 'lepistes', progress: 0.2, hunger: 0.5, name: 'Uykucu', seed: 5, tank: 'tank-derin-mavi' }]);
  return game;
}

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  cloudSyncResult = 'in-sync';
  cloudStale = false;
});

describe('syncSave when not frozen', () => {
  it('builds the fish list FROM THE SCENE and writes to the cloud', () => {
    const game = midSessionRestore();

    game.syncSave();

    expect(game.save.fishes.map((f) => f.name)).toEqual(['Uykucu', 'Sahne-1']);
    expect(loadSave().fishes).toHaveLength(2);
    expect(calls).toContain('markDirty');
    expect(calls).toContain('maybeUpload');
  });
});

describe('freezing after a restore', () => {
  it('freezeForRestore() writes the downloaded save to disk IMMEDIATELY', () => {
    // applyCloud only mutates the in-memory object; a reload reads from disk,
    // so if it isn't written the restore silently disappears.
    const game = midSessionRestore();

    game.freezeForRestore();

    expect(loadSave().coins).toBe(8000);
    expect(loadSave().fishes).toHaveLength(5);
  });

  it('a stale scene does NOT overwrite the downloaded fish while frozen', () => {
    const game = midSessionRestore();
    game.freezeForRestore();

    game.syncSave(); // location.reload() -> beforeunload

    expect(game.save.fishes.map((f) => f.name)).toEqual(
      ['a', 'b', 'c', 'd', 'e'].map((n) => 'Bulut-' + n),
    );
    expect(loadSave().fishes).toHaveLength(5);
  });

  it('still WRITES to disk while frozen — otherwise the restore dies on reload', () => {
    const game = midSessionRestore();
    game.freezeForRestore();
    localStorage.clear(); // wipe what freezing wrote: syncSave must write everything from here on

    game.syncSave();

    expect(loadSave().coins).toBe(8000);
    expect(loadSave().fishes).toHaveLength(5);
  });

  it('does not write to the CLOUD while frozen — the data came from there', () => {
    const game = midSessionRestore();
    game.freezeForRestore();
    calls.length = 0;

    game.syncSave();

    expect(calls).not.toContain('markDirty');
    expect(calls).not.toContain('maybeUpload');
  });

  it('stays frozen — later syncSave calls do not write either', () => {
    // In reality the 6-second timer keeps running until the reload happens.
    const game = midSessionRestore();
    game.freezeForRestore();
    calls.length = 0;

    game.syncSave();
    game.syncSave();
    game.syncSave();

    expect(game.save.fishes).toHaveLength(5);
    expect(calls).not.toContain('maybeUpload');
  });
});

// Two devices live at once: the other one wrote first, so this device's rev is
// behind and every upload it attempts can only be rejected. Before this, sync()
// ran at startup only, so the session had no way back until the app restarted.
describe('recovering from a rev another device moved past', () => {
  it('re-syncs instead of uploading again', async () => {
    const game = midSessionRestore();
    cloudStale = true;

    game.syncSave();
    await vi.waitFor(() => expect(calls).toContain('sync'));

    // The upload would be rejected for exactly the same reason as the last
    // one; spending a write on it is the bug this replaces.
    expect(calls).not.toContain('maybeUpload');
  });

  it('still writes the save to disk while recovering', () => {
    const game = midSessionRestore();
    cloudStale = true;

    game.syncSave();

    expect(loadSave().fishes).toHaveLength(2);
  });

  it('raises the conflict screen when the two devices really diverged', async () => {
    const game = midSessionRestore();
    cloudStale = true;
    cloudSyncResult = 'conflict';
    let raised = 0;
    game.onLateConflict = () => { raised++; };

    game.syncSave();
    await vi.waitFor(() => expect(raised).toBe(1));
  });

  it('does not start a second recovery while one is in flight', async () => {
    const game = midSessionRestore();
    cloudStale = true;

    game.syncSave();
    game.syncSave();
    game.syncSave();
    await vi.waitFor(() => expect(calls.filter((c) => c === 'sync').length).toBe(1));
  });
});

describe('re-syncing when the account changes', () => {
  it('freezes when a restore was applied', async () => {
    cloudSyncResult = 'restored';
    const game = midSessionRestore();

    await game.resyncCloudForNewAccount();
    calls.length = 0;
    game.syncSave();

    expect(game.save.fishes).toHaveLength(5);   // the scene list was not applied
    expect(loadSave().fishes).toHaveLength(5);  // but it was written to disk
    expect(calls).not.toContain('maybeUpload');
  });

  it('does NOT freeze without a restore — the game carries on normally', () => {
    cloudSyncResult = 'in-sync';
    const game = midSessionRestore();

    return game.resyncCloudForNewAccount().then(() => {
      game.syncSave();
      expect(game.save.fishes.map((f) => f.name)).toEqual(['Uykucu', 'Sahne-1']);
      expect(calls).toContain('maybeUpload');
    });
  });
});

// If the startup sync grace period (CLOUD_STARTUP_GRACE_MS) is exceeded, the
// game opens without waiting and the result arrives LATE. There used to be no
// path for this: a late result was treated as 'disabled' and discarded, and
// since startup sync only runs once per session the player never saw their
// progress again. On two emulators it showed up as "B's progress never
// reaches A"; measurements showed ensureUid took 2946 ms, i.e. it landed
// 54 ms under the old single 3000 ms budget.
describe('a startup sync that misses the grace period and lands late', () => {
  /** handleLateCloudSync is intentionally private — never called from outside, a late result triggers it. */
  function late(game: InstanceType<typeof Game>, res: CloudSyncResult): void {
    (game as unknown as { handleLateCloudSync(r: CloudSyncResult): void }).handleLateCloudSync(res);
  }

  let reloads = 0;

  beforeEach(() => {
    reloads = 0;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { reload: () => { reloads++; } },
    });
  });

  it("a late 'restored' writes the save to disk and reloads", () => {
    const game = midSessionRestore();

    late(game, 'restored');

    expect(reloads).toBe(1);
    // A reload reads from disk: if it isn't written, the restore silently disappears.
    expect(loadSave().coins).toBe(8000);
    expect(loadSave().fishes).toHaveLength(5);
  });

  it("the scene cannot overwrite the downloaded fish after a late 'restored'", () => {
    // The reload doesn't happen instantly; beforeunload -> syncSave() runs in between.
    const game = midSessionRestore();

    late(game, 'restored');
    calls.length = 0;
    game.syncSave();

    expect(game.save.fishes).toHaveLength(5);
    expect(calls).not.toContain('maybeUpload');
  });

  it("a late 'conflict' opens the conflict screen and does not reload", () => {
    const game = midSessionRestore();
    let shown = 0;
    game.onLateConflict = () => { shown++; };

    late(game, 'conflict');

    expect(shown).toBe(1);
    expect(reloads).toBe(0);
    expect(game.cloudSync).toBe('conflict');
  });

  it("a late 'in-sync' leaves the game alone", () => {
    const game = midSessionRestore();
    let shown = 0;
    game.onLateConflict = () => { shown++; };

    late(game, 'in-sync');

    expect(shown).toBe(0);
    expect(reloads).toBe(0);
    // No freeze: the game should keep running normally.
    game.syncSave();
    expect(calls).toContain('maybeUpload');
  });

  it('records the conflict even when the UI has not subscribed yet', () => {
    // ui.ts subscribes first and checks afterward; even if the result lands
    // between those two lines, it must still be catchable by reading cloudSync.
    const game = midSessionRestore();

    late(game, 'conflict');

    expect(game.cloudSync).toBe('conflict');
  });
});
