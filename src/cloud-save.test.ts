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

describe('bulut kaydı yokken', () => {
  it('yerel kaydı yükler ve rev 1 yazar', async () => {
    const save = playedSave();
    const cloud = new CloudSave();

    await expect(cloud.sync(save)).resolves.toBe('uploaded');

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const written = setDocMock.mock.calls[0][1] as { rev: number; schemaVersion: number };
    expect(written.rev).toBe(1);
    expect(written.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(localStorage.getItem(REV_KEY)).toBe('1');
  });

  it('yüklenen paketten reklamsız sürüm hakkını çıkarır', async () => {
    const save = playedSave();
    save.adsRemoved = true;

    await new CloudSave().sync(save);

    const written = setDocMock.mock.calls[0][1] as { payload: string };
    expect(JSON.parse(written.payload)).not.toHaveProperty('adsRemoved');
  });

  it('çakışma özetini payload açılmadan okunabilir biçimde yazar', async () => {
    const save = playedSave();
    await new CloudSave().sync(save);

    const written = setDocMock.mock.calls[0][1] as { summary: Record<string, number> };
    expect(written.summary).toEqual({ level: 3, coins: 1200, collection: 0 });
  });
});

describe('bulut geride ya da eşitken', () => {
  it('yerel en az bulut kadar güncelse dokunmaz', async () => {
    localStorage.setItem(REV_KEY, '5');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 5 }));

    const save = playedSave();
    await expect(new CloudSave().sync(save)).resolves.toBe('in-sync');

    expect(save.level).toBe(3); // local was preserved
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('yerel güncel ama gönderilmemiş değişiklik varsa yükler', async () => {
    localStorage.setItem(REV_KEY, '5');
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 5 }));

    await expect(new CloudSave().sync(playedSave())).resolves.toBe('in-sync');
    expect(setDocMock).toHaveBeenCalledTimes(1);
  });
});

describe('bulut ilerideyken', () => {
  it('yerelde gönderilmemiş değişiklik yoksa geri yükler', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const save = playedSave();
    await expect(new CloudSave().sync(save)).resolves.toBe('restored');

    expect(save.level).toBe(9);
    expect(save.coins).toBe(8000);
    expect(save.playerName).toBe('Derya');
    expect(localStorage.getItem(REV_KEY)).toBe('4');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('iki tarafta da ilerleme varsa KARAR VERMEZ, çakışma bildirir', async () => {
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

  it('sunucu damgası yoksa özetteki zaman 0 kalır', async () => {
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

describe('hızlı yol — yerelde feda edilecek emek yokken', () => {
  it('bakir kayıt "değişmiş" işaretli olsa bile çakışma ekranı göstermez', async () => {
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

  it('geri yüklerken buluta yazmaz — buluttaki kayıt olduğu gibi kalır', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    await new CloudSave().sync(freshButDirty());
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('hızlı yolda da reklamsız sürüm hakkı buluttan GELMEZ', async () => {
    const cloudSave = advancedSave();
    cloudSave.adsRemoved = true; // even if it's set in the cloud (a manually tampered document)
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(cloudSave), rev: 4 }));

    const save = freshButDirty();
    save.adsRemoved = false;
    await new CloudSave().sync(save);

    expect(save.adsRemoved).toBe(false);
  });

  it('hızlı yolda cihazda SAHİP OLUNAN hak da kaybolmaz', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const save = freshButDirty();
    save.adsRemoved = true;
    await new CloudSave().sync(save);

    expect(save.adsRemoved).toBe(true);
  });

  it('en küçük gerçek ilerleme bile hızlı yolu KAPATIR', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const save = freshButDirty();
    save.stats.totalFed = 1; // a single feed was dropped
    const cloud = new CloudSave();

    await expect(cloud.sync(save)).resolves.toBe('conflict');
    expect(cloud.hasConflict).toBe(true);
    expect(save.stats.totalFed).toBe(1);
  });

  it('buluttaki kayıt bozuksa yerel kayıt korunur', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: '{bozuk', rev: 4 }));

    const save = freshButDirty();
    const before = save.coins;
    await expect(new CloudSave().sync(save)).resolves.toBe('disabled');

    expect(save.coins).toBe(before);
    expect(localStorage.getItem(REV_KEY)).not.toBe('4');
  });

  it('hesap değişiminden sonra (rev sıfırlanınca) da çalışır', async () => {
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
describe('iki taraf aynı kayıtken', () => {
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

  it('sürüklenmiş ama aynı olan kayıtta çakışma ekranı GÖSTERMEZ', async () => {
    const save = twoSidedSetup();
    const cloud = new CloudSave();

    await expect(cloud.sync(save)).resolves.toBe('in-sync');

    expect(cloud.hasConflict).toBe(false);
    expect(cloud.conflictSummary).toBeNull();
  });

  it('bulutun sayacını benimser — aynı çakışma her senkronda tekrarlanmaz', async () => {
    const save = twoSidedSetup();
    await new CloudSave().sync(save);

    expect(localStorage.getItem(REV_KEY)).toBe('4');
  });

  it('GERİ YÜKLEME YAPMAZ — yereldeki daha ileri durum ezilmez', async () => {
    // The fields we exclude from the comparison may have progressed locally.
    const save = twoSidedSetup();
    await new CloudSave().sync(save);

    expect(save.incomePot).toBe(63.4);
    expect(save.fishes.every((f) => f.progress === 1)).toBe(true);
    expect(save.music).toBe(false);
    expect(save.dirtSpots[save.activeTank]).toHaveLength(1);
  });

  it('buluta da yazmaz — sessiz çözümde hiçbir yazma tetiklenmez', async () => {
    const save = twoSidedSetup();
    await new CloudSave().sync(save);
    await Promise.resolve();

    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('gönderilmemiş değişiklik korunur; sonraki yükleme bulutun üstüne yazar', async () => {
    const save = twoSidedSetup();
    const cloud = new CloudSave();
    await cloud.sync(save);

    expect(localStorage.getItem(DIRTY_KEY)).toBe('1');
    cloud.flush(save);
    await vi.waitFor(() => expect(setDocMock).toHaveBeenCalledTimes(1));
    const written = setDocMock.mock.calls[0][1] as { rev: number };
    expect(written.rev).toBe(5); // on top of the cloud's 4
  });

  it('cihazdaki reklamsız sürüm hakkı bu yolda da korunur', async () => {
    const save = twoSidedSetup();
    save.adsRemoved = true;

    await expect(new CloudSave().sync(save)).resolves.toBe('in-sync');
    expect(save.adsRemoved).toBe(true);
  });

  it('bulutta hak işaretli olsa bile (kurcalanmış doküman) yerele geçmez', async () => {
    const shared = advancedSave();
    const tampered = { ...shared, adsRemoved: true };
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(tampered), rev: 4 }));

    const save = drifted(shared);
    save.adsRemoved = false;
    await expect(new CloudSave().sync(save)).resolves.toBe('in-sync');

    expect(save.adsRemoved).toBe(false);
  });

  it('tek altınlık gerçek fark bile ÇAKIŞMA olarak kalır', async () => {
    const save = twoSidedSetup();
    save.coins += 1;

    const cloud = new CloudSave();
    await expect(cloud.sync(save)).resolves.toBe('conflict');
    expect(cloud.hasConflict).toBe(true);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('yalnızca bir balığı farklı olan kayıt da çakışmadır', async () => {
    const save = twoSidedSetup();
    save.fishes.push({ ...save.fishes[0], seed: 99, name: 'Yeni' });

    await expect(new CloudSave().sync(save)).resolves.toBe('conflict');
  });

  it('paket okunamıyorsa kuşkuda kalmaz, ÇAKIŞMA bildirir', async () => {
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: '{bozuk', rev: 4 }));

    const save = playedSave();
    const cloud = new CloudSave();
    await expect(cloud.sync(save)).resolves.toBe('conflict');

    expect(save.level).toBe(3);
    expect(localStorage.getItem(REV_KEY)).not.toBe('4');
  });
});

describe('çakışma çözümü', () => {
  async function conflicted(): Promise<{ cloud: InstanceType<typeof CloudSave>; save: SaveData }> {
    localStorage.setItem(DIRTY_KEY, '1');
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));
    const save = playedSave();
    const cloud = new CloudSave();
    expect(await cloud.sync(save)).toBe('conflict');
    return { cloud, save };
  }

  it('"buluttaki kalsın" seçimi kaydı uygular ve çakışmayı kapatır', async () => {
    const { cloud, save } = await conflicted();

    expect(cloud.resolveKeepCloud(save)).toBe(true);
    expect(save.level).toBe(9);
    expect(cloud.hasConflict).toBe(false);
    expect(localStorage.getItem(REV_KEY)).toBe('4');
  });

  it('"bu cihaz kalsın" seçimi yereli buluttaki sürümün üstüne yazar', async () => {
    const { cloud, save } = await conflicted();

    await cloud.resolveKeepLocal(save);

    expect(save.level).toBe(3);
    expect(setDocMock).toHaveBeenCalledTimes(1);
    const written = setDocMock.mock.calls[0][1] as { rev: number };
    expect(written.rev).toBe(5); // on top of the cloud's 4
  });

  it('çakışma çözülmeden hiçbir yazma geçmez', async () => {
    const { cloud, save } = await conflicted();

    cloud.markDirty();
    cloud.flush(save);
    cloud.maybeUpload(save);
    await Promise.resolve();

    expect(setDocMock).not.toHaveBeenCalled();
  });
});

describe('yazmayı reddeden durumlar', () => {
  it('buluttaki şema bu istemciden yeniyse hiç dokunmaz', async () => {
    getDocMock.mockResolvedValue(
      cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 9, schemaVersion: SAVE_SCHEMA_VERSION + 1 }),
    );

    const save = playedSave();
    await expect(new CloudSave().sync(save)).resolves.toBe('needs-update');

    expect(save.level).toBe(3);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('oturum açılamazsa sessizce devre dışı kalır', async () => {
    ensureUid.mockResolvedValue(null);

    await expect(new CloudSave().sync(playedSave())).resolves.toBe('disabled');
    expect(getDocMock).not.toHaveBeenCalled();
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('doküman okunamazsa sessizce devre dışı kalır', async () => {
    getDocMock.mockRejectedValue(new Error('offline'));

    await expect(new CloudSave().sync(playedSave())).resolves.toBe('disabled');
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('payload metin değilse geri yükleme denenmez', async () => {
    getDocMock.mockResolvedValue(cloudDoc({ payload: { level: 9 }, rev: 4 }));

    const save = playedSave();
    await expect(new CloudSave().sync(save)).resolves.toBe('disabled');
    expect(save.level).toBe(3);
  });

  it('yazma hatası dirty bayrağını KORUR — sonra tekrar denenir', async () => {
    setDocMock.mockRejectedValue(new Error('permission-denied'));

    const cloud = new CloudSave();
    await cloud.sync(playedSave());

    expect(localStorage.getItem(DIRTY_KEY)).not.toBe('0');
  });
});

describe('kısıtlama (throttle)', () => {
  it('art arda gelen maybeUpload çağrıları tek yazmaya iner', async () => {
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
