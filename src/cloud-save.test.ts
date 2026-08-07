// CloudSave.sync() karar tablosu — ağa hiç çıkılmaz, Firestore taklit edilir.
//
// Buradaki iddiaların üçü sessizce bozulabilir ve bozulduğunda oyuncu veri
// kaybeder:
//   1. Gerçek çakışmada (iki tarafta da ilerleme) ASLA otomatik karar verilmez.
//   2. Yerelde emek yokken çakışma ekranı gösterilmez, doğrudan geri yüklenir
//      (hızlı yol — yeni kurulan cihazın beklediği davranış).
//   3. Reklamsız sürüm hakkı ne buluta gider ne buluttan gelir.

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

/** Buluttaki dokümanı taklit eder; `payload` verilmezse kayıt yok sayılır. */
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

/** Buluta yazılmış gibi görünen, gerçekten ilerlemiş bir kayıt. */
function advancedSave(): SaveData {
  const s = defaultSave();
  s.level = 9;
  s.coins = 8000;
  s.collection = ['lepistes', 'neon-tetra'];
  s.stats.totalSold = 40;
  s.playerName = 'Derya';
  return s;
}

/** Yerelde gerçekten oynanmış bir kayıt. */
function playedSave(): SaveData {
  const s = defaultSave();
  s.level = 3;
  s.coins = 1200;
  s.stats.totalFed = 15;
  s.tutorialDone = true;
  return s;
}

/** Yeni kurulmuş cihaz: kayıt bakir ama "gönderilmemiş değişiklik" işaretli. */
function freshButDirty(): SaveData {
  const s = defaultSave();
  // Oyuna girildikten saniyeler sonra kendiliğinden olan değişiklikler.
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

    expect(save.level).toBe(3); // yerel korundu
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

    expect(save.level).toBe(3);                 // yerel dokunulmadı
    expect(setDocMock).not.toHaveBeenCalled();  // bulut da dokunulmadı (yedek kalır)
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
        updatedAt: undefined, // yerel önbellekten okunmuş, henüz sunucuya yazılmamış
      }),
    });

    const cloud = new CloudSave();
    await expect(cloud.sync(playedSave())).resolves.toBe('conflict');
    // 0 = "bilinmiyor"; arayüz bu durumda tarih yerine "bilinmiyor" yazar.
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
    cloudSave.adsRemoved = true; // bulutta olsa bile (elle kurcalanmış doküman)
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
    save.stats.totalFed = 1; // tek bir yem atıldı
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
    localStorage.setItem(REV_KEY, '30'); // eski hesabın sayacı
    getDocMock.mockResolvedValue(cloudDoc({ payload: JSON.stringify(advancedSave()), rev: 4 }));

    const cloud = new CloudSave();
    cloud.resetForNewAccount();

    const save = defaultSave();
    await expect(cloud.sync(save)).resolves.toBe('restored');
    expect(save.level).toBe(9);
  });
});

// İki cihaz sırayla senkron olunca gerçekten yaşandı: B buluttan geri yükledi,
// hâlâ açık olan A yüklemeye devam etti, B'nin bir sonraki senkronunda bulut
// ileride ve yerel "gönderilmemiş" göründü — çakışma ekranının iki sütunu
// birebir aynı veriyi gösterdi. rev sayacı "kim sonra yazdı"yı bilir, "ne
// yazdı"yı bilmez; içerik karşılaştırması bu boşluğu kapatır.
describe('iki taraf aynı kayıtken', () => {
  /** Gerçek yükleme gibi: reklamsız sürüm hakkı pakete girmez. */
  function uploaded(s: SaveData): string {
    const copy: Record<string, unknown> = { ...s };
    delete copy.adsRemoved;
    return JSON.stringify(copy);
  }

  /** Aynı kaydın "birkaç dakika sonraki" hali — oyuncu hiçbir şey yapmadı. */
  function drifted(s: SaveData): SaveData {
    const d = JSON.parse(JSON.stringify(s)) as SaveData;
    d.lastSeen += 300_000;
    d.incomePot = 63.4;
    d.dirtSpots[d.activeTank] = [{ id: 7, fx: 0.3, fy: 0.4, r: 0.9, kind: 0 }];
    d.fishes = d.fishes.map((f) => ({ ...f, progress: 1, hunger: 0.4 }));
    d.music = false; // cihaz ayarı
    return d;
  }

  /** Bulutta 4. sürüm var, yerelde aynı kaydın sürüklenmiş hali ve gönderilmemiş değişiklik. */
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
    // Karşılaştırmanın dışında tuttuğumuz alanlar yerelde ilerlemiş olabilir.
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
    expect(written.rev).toBe(5); // buluttaki 4'ün üstüne
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
    expect(written.rev).toBe(5); // buluttaki 4'ün üstüne
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
