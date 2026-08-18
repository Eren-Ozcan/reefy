// CloudSave.sync() decision table — never touches the network, Firestore is mocked.
//
// Three of the claims here can silently break, and when they do the player
// loses data:
//   1. In a real conflict (progress on both sides), a decision is NEVER made automatically.
//   2. When there's no local effort, the conflict screen isn't shown — it
//      restores directly (fast path — the behavior a newly set-up device expects).
//   3. The ad-removal entitlement never goes to the cloud and never comes from it.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveData } from './save';

const ensureUid = vi.fn<() => Promise<string | null>>();
const setDocMock = vi.fn<(ref: unknown, data: unknown) => Promise<void>>();
const getDocMock = vi.fn<() => Promise<CloudSnapshot>>();

interface CloudSnapshot {
  exists: () => boolean;
  data: () => Record<string, unknown>;
}

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
}));

vi.mock('./firebase-app', () => ({
  ensureUid: () => ensureUid(),
  firestore: () => ({}),
}));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, uid: string) => ({ path: `${col}/${uid}` }),
  getDoc: () => getDocMock(),
  setDoc: (ref: unknown, data: unknown) => setDocMock(ref, data),
  serverTimestamp: () => ({ __server: true }),
}));

const { CloudSave } = await import('./cloud-save');
const { defaultSave, SAVE_SCHEMA_VERSION } = await import('./save');

const REV_KEY = 'reefy-cloud-rev';
const DIRTY_KEY = 'reefy-cloud-dirty';

/** Mocks the document in the cloud; if `payload` isn't given, the save is treated as absent. */
function cloudDoc(opts: {
  payload?: unknown;
  rev?: number;
  schemaVersion?: number;
  summary?: Record<string, unknown>;
  updatedAtMs?: number;
}): CloudSnapshot {
  return {
    exists: () => true,
    data: () => ({
      payload: opts.payload,
      rev: opts.rev ?? 1,
      schemaVersion: opts.schemaVersion ?? SAVE_SCHEMA_VERSION,
      summary: opts.summary ?? { level: 9, coins: 8000, collection: 12 },
      updatedAt: { toMillis: () => opts.updatedAtMs ?? 1_700_000_000_000 },
    }),
  };
}

const noCloudDoc: CloudSnapshot = { exists: () => false, data: () => ({}) };

/** A save that looks like it was written to the cloud and has genuinely progressed. */
function advancedSave(): SaveData {
  const s = defaultSave();
  s.level = 9;
  s.coins = 8000;
  s.collection = ['lepistes', 'neon-tetra'];
  s.stats.totalSold = 40;
  s.playerName = 'Derya';
  return s;
}

/** A save that has genuinely been played locally. */
function playedSave(): SaveData {
  const s = defaultSave();
  s.level = 3;
  s.coins = 1200;
  s.stats.totalFed = 15;
  s.tutorialDone = true;
  return s;
}

/** A freshly set-up device: the save is untouched but flagged as having an "unsent change." */
function freshButDirty(): SaveData {
  const s = defaultSave();
  // Changes that happen on their own a few seconds after entering the game.
  s.lastSeen = Date.now();
  s.incomePot = 12.5;
  s.lastDaily = '2026-08-07';
  s.streak = 1;
  s.bestStreak = 1;
  s.quests.day = '2026-08-07';
  localStorage.setItem(DIRTY_KEY, '1');
  return s;
}

beforeEach(() => {
  localStorage.clear();
  ensureUid.mockReset().mockResolvedValue('uid-1');
  setDocMock.mockReset().mockResolvedValue(undefined);
  getDocMock.mockReset().mockResolvedValue(noCloudDoc);
});

describe('when there is no cloud save', () => {
  it('uploads the local save and writes rev 1', async () => {
    const save = playedSave();
    const cloud = new CloudSave();

    await expect(cloud.sync(save)).resolves.toBe('uploaded');

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const written = setDocMock.mock.calls[0][1] as { rev: number; schemaVersion: number };
    expect(written.rev).toBe(1);
    expect(written.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(localStorage.getItem(REV_KEY)).toBe('1');
  });

  it('strips the ad-free entitlement out of the uploaded payload', async () => {
    const save = playedSave();
    save.adsRemoved = true;

    await new CloudSave().sync(save);

    const written = setDocMock.mock.calls[0][1] as { payload: string };
    expect(JSON.parse(written.payload)).not.toHaveProperty('adsRemoved');
  });

  it('writes a summary the conflict screen can read without opening the payload', async () => {
    const save = playedSave();
    await new CloudSave().sync(save);

    const written = setDocMock.mock.calls[0][1] as { summary: Record<string, number> };
    expect(written.summary).toEqual({ level: 3, coins: 1200, collection: 0 });
  });
});

describe('when the cloud is behind or level', () => {
  it('leaves both sides alone when local is at least as current', async () => {
    localStorage.setItem(REV_KEY, '5');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 5 }));

    const save = playedSave();
    await expect(new CloudSave().sync(save)).resolves.toBe('in-sync');

    expect(save.level).toBe(3); // local was preserved
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('uploads when local is current but has unsent changes', async () => {
    localStorage.setItem(REV_KEY, '5');
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 5 }));

    await expect(new CloudSave().sync(playedSave())).resolves.toBe('in-sync');
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });
});

describe('when the cloud is ahead', () => {
  it('restores when local has no unsent changes', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const save = playedSave();
    await expect(new CloudSave().sync(save)).resolves.toBe('restored');

    expect(save.level).toBe(9);
    expect(save.coins).toBe(8000);
    expect(save.playerName).toBe('Derya');
    expect(localStorage.getItem(REV_KEY)).toBe('4');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('DECIDES NOTHING when both sides progressed — it reports a conflict', async () => {
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const save = playedSave();
    const cloud = new CloudSave();
    await expect(cloud.sync(save)).resolves.toBe('conflict');

    expect(save.level).toBe(3);                 // local wasn't touched
    expect(setDocMock).not.toHaveBeenCalled();  // cloud wasn't touched either (stays as the backup)
    expect(cloud.hasConflict).toBe(true);
    expect(cloud.conflictSummary).toEqual({
      level: 9, coins: 8000, collection: 12, updatedAtMs: 1_700_000_000_000,
    });
  });

  it('leaves the summary time at 0 when the server stamp is missing', async () => {
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        payload: JSON.stringify(advancedSave()),
        rev: 4,
        schemaVersion: SAVE_SCHEMA_VERSION,
        summary: { level: 9, coins: 8000, collection: 12 },
        updatedAt: undefined, // read from local cache, not yet written to the server
      }),
    });

    const cloud = new CloudSave();
    await expect(cloud.sync(playedSave())).resolves.toBe('conflict');
    // 0 = "unknown"; in this case the UI shows "unknown" instead of a date.
    expect(cloud.conflictSummary?.updatedAtMs).toBe(0);
  });
});

describe('the fast path — when there is no local effort to sacrifice', () => {
  it('shows no conflict screen for an untouched save, even one marked dirty', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const save = freshButDirty();
    const cloud = new CloudSave();
    await expect(cloud.sync(save)).resolves.toBe('restored');

    expect(cloud.hasConflict).toBe(false);
    expect(cloud.conflictSummary).toBeNull();
    expect(save.level).toBe(9);
    expect(save.coins).toBe(8000);
    expect(localStorage.getItem(REV_KEY)).toBe('4');
    expect(localStorage.getItem(DIRTY_KEY)).toBe('0');
  });

  it('writes nothing to the cloud while restoring — the cloud copy stays intact', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    await new CloudSave().sync(freshButDirty());
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('still does NOT take the ad-free entitlement from the cloud', async () => {
    const cloudSave = advancedSave();
    cloudSave.adsRemoved = true; // even if it's set in the cloud (a manually tampered document)
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(cloudSave), rev: 4 }));

    const save = freshButDirty();
    save.adsRemoved = false;
    await new CloudSave().sync(save);

    expect(save.adsRemoved).toBe(false);
  });

  it('does not lose an entitlement the device already OWNS', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const save = freshButDirty();
    save.adsRemoved = true;
    await new CloudSave().sync(save);

    expect(save.adsRemoved).toBe(true);
  });

  it('CLOSES the fast path on even the smallest real progress', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const save = freshButDirty();
    save.stats.totalFed = 1; // a single feed was dropped
    const cloud = new CloudSave();

    await expect(cloud.sync(save)).resolves.toBe('conflict');
    expect(cloud.hasConflict).toBe(true);
    expect(save.stats.totalFed).toBe(1);
  });

  it('keeps the local save when the cloud copy is corrupt', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: '{bozuk', rev: 4 }));

    const save = freshButDirty();
    const before = save.coins;
    await expect(new CloudSave().sync(save)).resolves.toBe('disabled');

    expect(save.coins).toBe(before);
    expect(localStorage.getItem(REV_KEY)).not.toBe('4');
  });

  it('works after an account switch too, once rev has been reset', async () => {
    localStorage.setItem(REV_KEY, '30'); // the old account's counter
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const cloud = new CloudSave();
    cloud.resetForNewAccount();

    const save = defaultSave();
    await expect(cloud.sync(save)).resolves.toBe('restored');
    expect(save.level).toBe(9);
  });
});

// This actually happened when two devices synced one after another: B
// restored from the cloud, A — still open — kept uploading, and on B's next
// sync the cloud looked ahead while local looked "unsent" — the conflict
// screen's two columns showed identical data. The rev counter knows "who
// wrote last," not "what they wrote"; the content comparison closes that gap.
describe('when both sides hold the same save', () => {
  /** Like a real upload: the ad-removal entitlement doesn't go into the payload. */
  function uploaded(s: SaveData): string {
    const copy: Record<string, unknown> = { ...s };
    delete copy.adsRemoved;
    return JSON.stringify(copy);
  }

  /** The "a few minutes later" state of the same save — the player did nothing. */
  function drifted(s: SaveData): SaveData {
    const d = JSON.parse(JSON.stringify(s)) as SaveData;
    d.lastSeen += 300_000;
    d.incomePot = 63.4;
    d.dirtSpots[d.activeTank] = [{ id: 7, fx: 0.3, fy: 0.4, r: 0.9, kind: 0 }];
    d.fishes = d.fishes.map((f) => ({ ...f, progress: 1, hunger: 0.4 }));
    d.music = false; // a device setting
    return d;
  }

  /** The cloud has rev 4, local has a drifted copy of the same save plus an unsent change. */
  function twoSidedSetup(): SaveData {
    const shared = advancedSave();
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: uploaded(shared), rev: 4 }));
    return drifted(shared);
  }

  it('shows NO conflict screen for a drifted but identical save', async () => {
    const save = twoSidedSetup();
    const cloud = new CloudSave();

    await expect(cloud.sync(save)).resolves.toBe('in-sync');

    expect(cloud.hasConflict).toBe(false);
    expect(cloud.conflictSummary).toBeNull();
  });

  it('adopts the cloud counter — the same conflict does not return every sync', async () => {
    const save = twoSidedSetup();
    await new CloudSave().sync(save);

    expect(localStorage.getItem(REV_KEY)).toBe('4');
  });

  it('does NOT restore — a more advanced local state is not overwritten', async () => {
    // The fields we exclude from the comparison may have progressed locally.
    const save = twoSidedSetup();
    await new CloudSave().sync(save);

    expect(save.incomePot).toBe(63.4);
    expect(save.fishes.every((f) => f.progress === 1)).toBe(true);
    expect(save.music).toBe(false);
    expect(save.dirtSpots[save.activeTank]).toHaveLength(1);
  });

  it('does not upload either — a silent resolution triggers no write at all', async () => {
    const save = twoSidedSetup();
    await new CloudSave().sync(save);
    await Promise.resolve();

    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('keeps unsent changes; the next upload lands on top of the cloud', async () => {
    const save = twoSidedSetup();
    const cloud = new CloudSave();
    await cloud.sync(save);

    expect(localStorage.getItem(DIRTY_KEY)).toBe('1');
    cloud.flush(save);
    await vi.waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1));
    const written = setDocMock.mock.calls[0][1] as { rev: number };
    expect(written.rev).toBe(5); // on top of the cloud's 4
  });

  it('keeps the device ad-free entitlement on this path as well', async () => {
    const save = twoSidedSetup();
    save.adsRemoved = true;

    await expect(new CloudSave().sync(save)).resolves.toBe('in-sync');
    expect(save.adsRemoved).toBe(true);
  });

  it('does not adopt an entitlement set in the cloud, tampered document or not', async () => {
    const shared = advancedSave();
    const tampered = { ...shared, adsRemoved: true };
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(tampered), rev: 4 }));

    const save = drifted(shared);
    save.adsRemoved = false;
    await expect(new CloudSave().sync(save)).resolves.toBe('in-sync');

    expect(save.adsRemoved).toBe(false);
  });

  it('stays a CONFLICT on a real difference of a single coin', async () => {
    const save = twoSidedSetup();
    save.coins += 1;

    const cloud = new CloudSave();
    await expect(cloud.sync(save)).resolves.toBe('conflict');
    expect(cloud.hasConflict).toBe(true);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('treats a save differing by one fish as a conflict too', async () => {
    const save = twoSidedSetup();
    save.fishes.push({ ...save.fishes[0], seed: 99, name: 'Yeni' });

    await expect(new CloudSave().sync(save)).resolves.toBe('conflict');
  });

  it('reports a CONFLICT rather than guessing when the payload is unreadable', async () => {
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: '{bozuk', rev: 4 }));

    const save = playedSave();
    const cloud = new CloudSave();
    await expect(cloud.sync(save)).resolves.toBe('conflict');

    expect(save.level).toBe(3);
    expect(localStorage.getItem(REV_KEY)).not.toBe('4');
  });
});

describe('resolving a conflict', () => {
  async function conflicted(): Promise<{ cloud: InstanceType<typeof CloudSave>; save: SaveData }> {
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));
    const save = playedSave();
    const cloud = new CloudSave();
    expect(await cloud.sync(save)).toBe('conflict');
    return { cloud, save };
  }

  it('"keep the cloud one" applies that save and clears the conflict', async () => {
    const { cloud, save } = await conflicted();

    expect(cloud.resolveKeepCloud(save)).toBe(true);
    expect(save.level).toBe(9);
    expect(cloud.hasConflict).toBe(false);
    expect(localStorage.getItem(REV_KEY)).toBe('4');
  });

  it('"keep this device" writes local over the cloud revision', async () => {
    const { cloud, save } = await conflicted();

    await cloud.resolveKeepLocal(save);

    expect(save.level).toBe(3);
    expect(setDocMock).toHaveBeenCalledTimes(1);
    const written = setDocMock.mock.calls[0][1] as { rev: number };
    expect(written.rev).toBe(5); // on top of the cloud's 4
  });

  it('lets no write through until the conflict is resolved', async () => {
    const { cloud, save } = await conflicted();

    cloud.markDirty();
    cloud.flush(save);
    cloud.maybeUpload(save);
    await Promise.resolve();

    expect(setDocMock).not.toHaveBeenCalled();
  });
});

describe('cases that refuse to write', () => {
  it('touches nothing when the cloud schema is newer than this client', async () => {
    getDocMock.mockResolvedValue(
      cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 9, schemaVersion: SAVE_SCHEMA_VERSION + 1 }),
    );

    const save = playedSave();
    await expect(new CloudSave().sync(save)).resolves.toBe('needs-update');

    expect(save.level).toBe(3);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('goes quietly disabled when it cannot sign in', async () => {
    ensureUid.mockResolvedValue(null);

    await expect(new CloudSave().sync(playedSave())).resolves.toBe('disabled');
    expect(getDocMock).not.toHaveBeenCalled();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('goes quietly disabled when the document cannot be read', async () => {
    getDocMock.mockRejectedValue(new Error('offline'));

    await expect(new CloudSave().sync(playedSave())).resolves.toBe('disabled');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('does not attempt a restore when the payload is not text', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: { level: 9 }, rev: 4 }));

    const save = playedSave();
    await expect(new CloudSave().sync(save)).resolves.toBe('disabled');
    expect(save.level).toBe(3);
  });

  it('KEEPS the dirty flag on a write failure — it is retried later', async () => {
    setDocMock.mockRejectedValue(new Error('permission-denied'));

    const cloud = new CloudSave();
    await cloud.sync(playedSave());

    expect(localStorage.getItem(DIRTY_KEY)).not.toBe('0');
  });
});

// Two devices live at the same time: A has already written rev 7 while B is
// still on rev 5. B's next upload asks for rev 6, which the rule rejects
// (`rev > resource.data.rev` is false). Every earlier test had the OTHER device
// idle, so this path had never run.
describe('two devices writing in the same window', () => {
  it('does not advance rev when the write is rejected', async () => {
    localStorage.setItem(REV_KEY, '5');
    setDocMock.mockRejectedValue(new Error('permission-denied'));

    const cloud = new CloudSave();
    cloud.markDirty();
    cloud.flush(playedSave());
    await vi.waitFor(() => expect(setDocMock).toHaveBeenCalled());

    // Advancing here would let the device climb past the cloud and later
    // overwrite the other device's progress without any conflict screen.
    expect(localStorage.getItem(REV_KEY)).toBe('5');
    expect(localStorage.getItem(DIRTY_KEY)).not.toBe('0');
  });

  it('marks itself stale so the session can recover without a restart', async () => {
    localStorage.setItem(REV_KEY, '5');
    setDocMock.mockRejectedValue(new Error('permission-denied'));

    const cloud = new CloudSave();
    cloud.markDirty();
    cloud.flush(playedSave());
    await vi.waitFor(() => expect(cloud.isStale).toBe(true));
  });

  it('clears stale on the next sync, which is what resolves the rev', async () => {
    localStorage.setItem(REV_KEY, '5');
    setDocMock.mockRejectedValue(new Error('permission-denied'));
    const cloud = new CloudSave();
    cloud.markDirty();
    cloud.flush(playedSave());
    await vi.waitFor(() => expect(cloud.isStale).toBe(true));

    // The other device's document, one revision ahead and with the same
    // content: sync() settles it silently and the device carries on.
    setDocMock.mockResolvedValue(undefined);
    const save = playedSave();
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(save), rev: 7 }));
    await cloud.sync(save);

    expect(cloud.isStale).toBe(false);
    expect(localStorage.getItem(REV_KEY)).toBe('7');
  });

  it('raises a conflict when the other device wrote something genuinely different', async () => {
    localStorage.setItem(REV_KEY, '5');
    setDocMock.mockRejectedValue(new Error('permission-denied'));
    const cloud = new CloudSave();
    cloud.markDirty();
    cloud.flush(playedSave());
    await vi.waitFor(() => expect(cloud.isStale).toBe(true));

    setDocMock.mockResolvedValue(undefined);
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 7 }));
    await expect(cloud.sync(playedSave())).resolves.toBe('conflict');
    expect(cloud.hasConflict).toBe(true);
  });
});

describe('throttling', () => {
  it('collapses back-to-back maybeUpload calls into a single write', async () => {
    localStorage.setItem(REV_KEY, '2');
    const cloud = new CloudSave();
    const save = playedSave();

    cloud.maybeUpload(save);
    await vi.waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1));

    cloud.maybeUpload(save);
    cloud.maybeUpload(save);
    await Promise.resolve();

    expect(setDocMock).toHaveBeenCalledTimes(1);
  });
});
