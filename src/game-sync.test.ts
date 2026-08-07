// Game.syncSave() ile buluttan geri yükleme arasındaki yarış — cihazda
// gerçekten veri kaybettirdi (bkz. TODO.md "two-emulator run"):
//
//   1. syncSave() balık listesini kayıttan değil SAHNEDEN kurar. Oturum
//      ortasında yapılan geri yüklemede sahne hâlâ ESKİ kaydın balıklarını
//      tutar ve location.reload()'un tetiklediği beforeunload -> syncSave()
//      indirilen balıkları eskileriyle ezer (5 balık 2'ye düştü). Üstelik aynı
//      çağrı buluta da yazdığı için ezilmiş liste diğer cihaza gidebilirdi.
//   2. Bunun İLK düzeltmesi de yanlıştı: syncSave()'in TAMAMI dondurulunca
//      persist() de durdu — indirilen kaydı diske yazan tek yer orasıdır,
//      yeniden yükleme eski kaydı okuyup geri yüklemeyi sessizce yok etti.
//
// Yani doğru davranış üç maddedir ve üçü de aşağıda ayrı ayrı sınanır:
// donmuşken sahneden kurulum YOK, buluta yazma YOK, diske yazma VAR.
//
// Game gerçek nesne olarak kurulur (asıl syncSave() çalışır); yalnızca dış
// dünya taklit edilir: Pixi sahne nesneleri, platform servisleri ve bulut.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fish } from './fish';
import type { CloudSyncResult } from './cloud-save';
import type { FishSave, SaveData } from './save';

/** Bulut ve servis katmanına giden çağrıların sırayla dökümü. */
const calls: string[] = [];
/** Taklit bulutun sync() sonucu — testler geri yükleme senaryosunu buradan kurar. */
let cloudSyncResult: CloudSyncResult = 'in-sync';

// Sahne nesneleri: syncSave() hiçbirine dokunmaz, yalnızca Game'in alan
// başlangıç değerleri (new Graphics() vb.) kurulabilsin diye gerekliler.
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

/** Buluttan inmiş kayıt: 5 balık, sahnedekilerle hiç örtüşmüyor. */
function cloudRestoredSave(): SaveData {
  const s = defaultSave();
  s.level = 9;
  s.coins = 8000;
  s.fishes = ['a', 'b', 'c', 'd', 'e'].map((n, i) => ({
    sp: 'neon-tetra', progress: 0.5, hunger: 0.5, name: 'Bulut-' + n, seed: i, tank: s.activeTank,
  }));
  return s;
}

/** Sahnedeki balığın syncSave() açısından tek yüzü toSave()'dir. */
function sceneFish(name: string): Fish {
  return {
    toSave: (): FishSave => ({ sp: 'lepistes', progress: 0.5, hunger: 0.5, name, seed: 1, tank: 'tank-mercan-koyu' }),
  } as unknown as Fish;
}

/** Diğer akvaryumlarda uyuyan balıklar — `dormant` bilerek private. */
function setDormant(game: InstanceType<typeof Game>, list: FishSave[]): void {
  (game as unknown as { dormant: FishSave[] }).dormant = list;
}

/** Sahnesi eski kayıttan kurulmuş, kaydı buluttan yenilenmiş oyun. */
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
    // applyCloud yalnızca bellekteki nesneyi değiştirir; yeniden yükleme diskten
    // okuduğu için yazılmazsa geri yükleme sessizce kaybolur.
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
    localStorage.clear(); // dondurmanın yazdığını sil: bundan sonrasını syncSave yazmalı

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
    // Gerçekte 6 saniyelik zamanlayıcı, yeniden yükleme gelene dek çalışmaya devam eder.
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

    expect(game.save.fishes).toHaveLength(5);   // sahne listesi geçmedi
    expect(loadSave().fishes).toHaveLength(5);  // ama diske yazıldı
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

// Açılış senkronu mühleti (CLOUD_STARTUP_GRACE_MS) aşarsa oyun beklemeden açılır
// ve sonuç SONRADAN gelir. Eskiden böyle bir yol yoktu: geç kalan sonuç
// 'disabled' sayılıp atılıyordu, açılış senkronu da oturum başına bir kez
// çalıştığı için oyuncu ilerlemesini bir daha hiç görmüyordu. İki emülatörde
// "B'nin ilerlemesi A'ya hiç gelmiyor" diye göründü; ölçümde ensureUid 2946 ms
// sürmüştü, yani eski 3000 ms'lik tek bütçenin 54 ms altında salınıyordu.
describe('mühleti aşıp geç gelen açılış senkronu', () => {
  /** handleLateCloudSync bilerek private — dışarıdan çağrılmaz, geç sonuç onu tetikler. */
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
    // Yeniden yükleme diskten okur: yazılmamışsa geri yükleme sessizce kaybolur.
    expect(loadSave().coins).toBe(8000);
    expect(loadSave().fishes).toHaveLength(5);
  });

  it("geç gelen 'restored' sonrası sahne indirilen balıkları EZEMEZ", () => {
    // Yeniden yükleme anında olmaz; arada beforeunload -> syncSave() çalışır.
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
    // Donma yok: oyun normal çalışmaya devam etmeli.
    game.syncSave();
    expect(calls).toContain('maybeUpload');
  });

  it('UI henüz abone olmadıysa çakışma yine de kaydedilir', () => {
    // ui.ts önce abone olup sonra kontrol ediyor; yine de sonuç iki satır
    // arasında düşerse cloudSync okunarak yakalanabilmeli.
    const game = midSessionRestore();

    late(game, 'conflict');

    expect(game.cloudSync).toBe('conflict');
  });
});
