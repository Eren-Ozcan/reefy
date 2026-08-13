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

vi.mock('./cloud-save', () => ({
  CloudSave: class {
    markDirty(): void { calls.push('markDirty'); }
    maybeUpload(): void { calls.push('maybeUpload'); }
    flush(): void { calls.push('flush'); }
    resetForNewAccount(): void { calls.push('resetForNewAccount'); }
    async sync(): Promise<CloudSyncResult> {
      calls.push('sync');
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
});

describe('normal (donmamış) syncSave', () => {
  it('balık listesini SAHNEDEN kurar ve buluta yazar', () => {
    const game = midSessionRestore();

    game.syncSave();

    expect(game.save.fishes.map((f) => f.name)).toEqual(['Uykucu', 'Sahne-1']);
    expect(loadSave().fishes).toHaveLength(2);
    expect(calls).toContain('markDirty');
    expect(calls).toContain('maybeUpload');
  });
});

describe('geri yükleme sonrası donma', () => {
  it('freezeForRestore() indirilen kaydı HEMEN diske yazar', () => {
    // applyCloud only mutates the in-memory object; a reload reads from disk,
    // so if it isn't written the restore silently disappears.
    const game = midSessionRestore();

    game.freezeForRestore();

    expect(loadSave().coins).toBe(8000);
    expect(loadSave().fishes).toHaveLength(5);
  });

  it('donmuşken bayat sahne indirilen balıkları EZMEZ', () => {
    const game = midSessionRestore();
    game.freezeForRestore();

    game.syncSave(); // location.reload() -> beforeunload

    expect(game.save.fishes.map((f) => f.name)).toEqual(
      ['a', 'b', 'c', 'd', 'e'].map((n) => 'Bulut-' + n),
    );
    expect(loadSave().fishes).toHaveLength(5);
  });

  it('donmuşken de diske YAZAR — yoksa geri yükleme yeniden yüklemede yok olur', () => {
    const game = midSessionRestore();
    game.freezeForRestore();
    localStorage.clear(); // wipe what freezing wrote: syncSave must write everything from here on

    game.syncSave();

    expect(loadSave().coins).toBe(8000);
    expect(loadSave().fishes).toHaveLength(5);
  });

  it('donmuşken BULUTA yazılmaz — veri zaten buluttan geldi', () => {
    const game = midSessionRestore();
    game.freezeForRestore();
    calls.length = 0;

    game.syncSave();

    expect(calls).not.toContain('markDirty');
    expect(calls).not.toContain('maybeUpload');
  });

  it('donma kalıcıdır — art arda gelen syncSave çağrıları da yazmaz', () => {
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

describe('hesap değişiminde yeniden senkron', () => {
  it('geri yükleme uygulandıysa donar', async () => {
    cloudSyncResult = 'restored';
    const game = midSessionRestore();

    await game.resyncCloudForNewAccount();
    calls.length = 0;
    game.syncSave();

    expect(game.save.fishes).toHaveLength(5);   // the scene list was not applied
    expect(loadSave().fishes).toHaveLength(5);  // but it was written to disk
    expect(calls).not.toContain('maybeUpload');
  });

  it('geri yükleme YOKSA donmaz — oyun normal çalışmaya devam eder', () => {
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
describe('mühleti aşıp geç gelen açılış senkronu', () => {
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

  it("geç gelen 'restored' kaydı diske yazıp yeniden yükler", () => {
    const game = midSessionRestore();

    late(game, 'restored');

    expect(reloads).toBe(1);
    // A reload reads from disk: if it isn't written, the restore silently disappears.
    expect(loadSave().coins).toBe(8000);
    expect(loadSave().fishes).toHaveLength(5);
  });

  it("geç gelen 'restored' sonrası sahne indirilen balıkları EZEMEZ", () => {
    // The reload doesn't happen instantly; beforeunload -> syncSave() runs in between.
    const game = midSessionRestore();

    late(game, 'restored');
    calls.length = 0;
    game.syncSave();

    expect(game.save.fishes).toHaveLength(5);
    expect(calls).not.toContain('maybeUpload');
  });

  it("geç gelen 'conflict' çakışma ekranını açar, yeniden yüklemez", () => {
    const game = midSessionRestore();
    let shown = 0;
    game.onLateConflict = () => { shown++; };

    late(game, 'conflict');

    expect(shown).toBe(1);
    expect(reloads).toBe(0);
    expect(game.cloudSync).toBe('conflict');
  });

  it("geç gelen 'in-sync' oyunu rahatsız etmez", () => {
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

  it('UI henüz abone olmadıysa çakışma yine de kaydedilir', () => {
    // ui.ts subscribes first and checks afterward; even if the result lands
    // between those two lines, it must still be catchable by reading cloudSync.
    const game = midSessionRestore();

    late(game, 'conflict');

    expect(game.cloudSync).toBe('conflict');
  });
});
