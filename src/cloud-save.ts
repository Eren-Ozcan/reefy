// Bulut kaydı (Firestore) — `saves/{uid}` altında tek doküman.
//
// Tasarım kararları ve gerekçeleri:
//
// * Cihaz saatine GÜVENİLMEZ. "Son yazan kazanır" mantığı, saati ileri
//   alınmış bir cihazda kalıcı veri kaybına yol açar (o cihaz sonsuza dek
//   "daha yeni" görünür). Bunun yerine monotonik `rev` sayacı kullanılır;
//   `updatedAt` yalnızca kullanıcıya gösterilmek içindir ve sunucu damgasıdır.
//
// * ÇAKIŞMADA BİRLEŞTİRME YAPILMAZ. İki ilerlemeyi otomatik birleştirmek
//   (altınları topla? görevleri birleştir?) ekonomiyi bozar ve istismara açar.
//   Çakışma tespit edilince yerel kayıt korunur ve BULUTA HİÇ YAZILMAZ —
//   yani buluttaki sürüm kendiliğinden yedek olarak kalır. Faz 2'de kullanıcıya
//   seçim sunulacak; resolveKeepLocal/resolveKeepCloud o iş için hazır.
//
// * AYNI KAYIT ÇAKIŞMA SAYILMAZ. rev sayacı "kim sonra yazdı"yı bilir, "ne
//   yazdı"yı bilmez; iki cihaz sırayla senkron olunca iki sütunu birebir aynı
//   olan bir seçim ekranı çıkabiliyordu. sync() karar vermeden önce iki tarafın
//   içeriğini karşılaştırır (bkz. save.ts progressFingerprint) ve aynılarsa
//   soru sormadan sessizce çözer.
//
// * ENTITLEMENT (satın alma hakkı) BULUTTAN GELMEZ. `adsRemoved` yüklenirken
//   payload'dan çıkarılır, indirilirken yerel/mağaza değeri korunur. Aksi
//   halde bir kayıt paylaşımı ücretsiz reklamsız sürüm anlamına gelirdi.
//
// * Ağ yoksa, yapılandırma eksikse veya bir şey ters giderse her fonksiyon
//   sessizce no-op olur; oyun akışı asla bozulmaz (ads.ts/billing.ts deyimi).

import { Capacitor } from '@capacitor/core';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ensureUid, firestore } from './firebase-app';
import { hasProgress, parseSave, progressFingerprint, SAVE_SCHEMA_VERSION, type SaveData } from './save';

const REV_KEY = 'reefy-cloud-rev';
const DIRTY_KEY = 'reefy-cloud-dirty';

const UPLOAD_THROTTLE_MS = 60_000; // Firestore günlük yazma kotasını koru (Spark: 20K/gün)
// ensureUid() soğuk açılışta initializeApp'i çalıştırır ve Auth'un kalıcı
// oturumu IndexedDB'den geri yüklemesini bekler (bkz. firebase-app.ts
// waitForRestoredUser). Android 14 emülatöründe ÖLÇÜLDÜ: 2946 ms — eski 3000 ms
// bütçesinin 54 ms altı. Yani sınırda salınıyordu ve aşan her açılışta senkron
// 'disabled' dönüp SESSİZCE hiçbir şey yapmıyordu; iki cihazlı testte "B'nin
// ilerlemesi A'ya hiç gelmiyor" olarak göründü.
//
// Süre CÖMERT tutulur, çünkü zaman aşımının bedeli ağır: açılış senkronu oturum
// başına BİR KEZ çalışır, kaçırılırsa oyuncu ne geri yükleme ne çakışma ekranı
// görür. Buradaki değer artık AÇILIŞI BEKLETMİYOR — game.ts açılışı yalnızca
// CLOUD_STARTUP_GRACE_MS kadar bekletir, sonucu geç gelirse sonradan işler.
const AUTH_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 4000;
// setDoc() çevrimdışıyken ÇÖZÜLMEZ: Firestore yazmayı yerel kuyruğa alır ve
// sözü sunucu onaylayana kadar askıda tutar. Zaman aşımı olmadan upload()
// içindeki finally hiç çalışmaz, `uploading` kilitli kalır ve bulut kaydı
// oturum boyunca tamamen ölür — bu yüzden yazma da sınırlandırılıyor.
const WRITE_TIMEOUT_MS = 8000;
const MAX_PAYLOAD_BYTES = 400_000; // firestore.rules'daki tavanla aynı

/** Buluta gönderilmeyen alanlar — bkz. dosya başı "ENTITLEMENT" notu. */
const ENTITLEMENT_KEYS = ['adsRemoved'] as const;

/** Çakışma ekranının payload'ı açmadan gösterebildiği özet. */
export interface CloudSummary {
  level: number;
  coins: number;
  collection: number;
  /** Sunucu damgası (ms). Cihaz saatinden bağımsızdır; 0 = bilinmiyor. */
  updatedAtMs: number;
}

export type CloudSyncResult =
  | 'disabled'      // yapılandırma yok / ağ yok / zaman aşımı — sessizce yerel devam
  | 'in-sync'       // yerel en az bulut kadar güncel
  | 'uploaded'      // bulutta kayıt yoktu, yerel yüklendi
  | 'restored'      // buluttan indirildi ve uygulandı
  | 'conflict'      // iki taraf da ilerlemiş — yerel korundu, bulut dokunulmadı
  | 'needs-update'; // buluttaki şema bu istemciden yeni

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

function readInt(key: string): number {
  const n = Number(localStorage.getItem(key) ?? '0');
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export class CloudSave {
  /** En son başarıyla yüklenen/indirilen sürüm numarası. */
  private get rev(): number {
    return readInt(REV_KEY);
  }
  private set rev(v: number) {
    try {
      localStorage.setItem(REV_KEY, String(v));
    } catch {
      /* depolama engelli — bulut kaydı devre dışı kalır, oyun etkilenmez */
    }
  }

  /** Son senkrondan beri yerelde değişiklik var mı (uygulama öldürülse de hatırlanır). */
  private get dirty(): boolean {
    return localStorage.getItem(DIRTY_KEY) === '1';
  }
  private set dirty(v: boolean) {
    try {
      localStorage.setItem(DIRTY_KEY, v ? '1' : '0');
    } catch {
      /* yok sayılır */
    }
  }

  private lastUpload = 0;
  private uploading = false;
  /** Çakışma çözülene dek yazmalar durur; buluttaki sürüm yedek olarak korunur. */
  private blocked = false;
  private pendingCloud: { rev: number; payload: string; summary: CloudSummary } | null = null;

  /** Çözülmemiş bir çakışma var mı. */
  get hasConflict(): boolean {
    return this.blocked && this.pendingCloud !== null;
  }

  /** Çakışma ekranının göstereceği buluttaki kaydın özeti. */
  get conflictSummary(): CloudSummary | null {
    return this.pendingCloud?.summary ?? null;
  }

  /**
   * Oturum başka bir hesaba geçtiğinde çağrılır. rev sayacı CİHAZDA tutulur ve
   * eski hesaba aitti; yeni hesap için anlamsızdır. Sıfırlanmazsa yerel sayaç
   * buluttakinden büyük görünüp "yerel güncel" sanılabilir ve diğer hesabın
   * ilerlemesi sessizce ezilirdi. Sıfırlayıp dirty işaretleyince bir sonraki
   * sync() iki tarafı da görüp kullanıcıya seçtirir.
   */
  resetForNewAccount(): void {
    this.rev = 0;
    this.dirty = true;
    this.blocked = false;
    this.pendingCloud = null;
    this.lastUpload = 0;
  }

  private ref(uid: string) {
    return doc(firestore(), 'saves', uid);
  }

  /** Yerelde değişiklik olduğunu işaretler; syncSave() her çağrıldığında çalışır. */
  markDirty(): void {
    if (!this.dirty) this.dirty = true;
  }

  /**
   * Açılışta bir kez çağrılır: buluttaki kaydı yerelle karşılaştırır ve
   * gerekiyorsa `save` nesnesini YERİNDE günceller (referansı değiştirmez —
   * services.ts sağlayıcıları aynı nesneyi tutuyor).
   */
  async sync(save: SaveData): Promise<CloudSyncResult> {
    const uid = await withTimeout(ensureUid(), AUTH_TIMEOUT_MS);
    if (!uid) return 'disabled';

    const snap = await withTimeout(getDoc(this.ref(uid)), FETCH_TIMEOUT_MS);
    if (!snap) return 'disabled';

    if (!snap.exists()) {
      const ok = await this.upload(save);
      return ok ? 'uploaded' : 'disabled';
    }

    const data = snap.data() as {
      payload?: unknown;
      rev?: unknown;
      schemaVersion?: unknown;
      updatedAt?: { toMillis?: () => number };
      summary?: { level?: unknown; coins?: unknown; collection?: unknown };
    };
    const cloudRev = typeof data.rev === 'number' ? data.rev : 0;
    const payload = typeof data.payload === 'string' ? data.payload : null;
    const cloudSchema = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const summary: CloudSummary = {
      level: num(data.summary?.level),
      coins: num(data.summary?.coins),
      collection: num(data.summary?.collection),
      // Sunucu damgası; henüz yazılmamışsa (yerel önbellek) 0 kalır.
      updatedAtMs: typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0,
    };

    // Daha yeni bir istemcinin yazdığı kayıt: migrate() bilmediği alanları
    // eleyip veriyi bozacağı için hiç dokunma.
    if (cloudSchema > SAVE_SCHEMA_VERSION) return 'needs-update';

    if (!payload) return 'disabled';

    // Yerel en az bulut kadar güncel — normal durum.
    if (cloudRev <= this.rev) {
      // Awaited: upload() is bounded by its own WRITE_TIMEOUT_MS, so it never
      // hangs sync() — but left fire-and-forget, callers that await sync()
      // (e.g. resyncCloudForNewAccount) could proceed before the write
      // finished and race with the next state change.
      if (this.dirty) await this.upload(save);
      return 'in-sync';
    }

    // Bulut ilerideyken yerelde de gönderilmemiş değişiklik varsa gerçek
    // çakışma: karar kullanıcınındır, buluta yazma.
    //
    // HIZLI YOL: "gönderilmemiş değişiklik" her zaman bir ilerleme demek
    // değildir — oyuna girildikten saniyeler sonra kayıt kendiliğinden
    // değişmiş sayılır (bkz. save.ts hasProgress). Yerelde feda edilecek bir
    // emek yoksa soracak bir şey de yoktur: bir tarafı boş olan çakışma
    // ekranını göstermek yerine doğrudan buluttakini geri yükle. Yeni kurulan
    // cihazda ve hesap bağlandıktan hemen sonra beklenen davranış budur.
    if (this.dirty && hasProgress(save)) {
      // AYNI KAYDIN İKİ KOPYASI ÇAKIŞMA DEĞİLDİR. rev sayacı yalnızca "kim
      // sonra yazdı"yı bilir, "ne yazdı"yı bilmez: A cihazı yazmaya devam
      // ederken B buluttan geri yüklerse, B'nin bir sonraki senkronunda bulut
      // ileride ve yerel "gönderilmemiş" görünür — oysa iki taraf birebir aynı
      // ilerlemedir. İki sütunu aynı olan bir seçim ekranı oyuncuya hangi
      // düğmeye bassa aynı oyunu verir ve ekrana olan güvenini bitirir.
      if (this.matchesLocal(save, payload)) {
        // Geri YÜKLEME yapılmaz — bilerek: yerel taraf, karşılaştırmanın dışında
        // tuttuğumuz alanlarda (biriken gelir, balıkların büyümesi) daha ileride
        // olabilir ve bunları buluttakiyle ezmenin hiçbir kazancı yok. Yalnızca
        // bulutun sayacı benimsenir ki aynı çakışma her senkronda tekrarlanmasın.
        // `dirty` korunur: yereldeki sürüklenme bir sonraki kısıtlı yüklemeyle
        // (rev = cloudRev + 1) kendiliğinden buluta gider.
        this.rev = cloudRev;
        return 'in-sync';
      }
      this.blocked = true;
      this.pendingCloud = { rev: cloudRev, payload, summary };
      return 'conflict';
    }

    return this.applyCloud(save, cloudRev, payload) ? 'restored' : 'disabled';
  }

  /**
   * Buluttaki paket ile yerel kayıt oyuncu gözünde AYNI mı? Karşılaştırma
   * payload metni üzerinden değil, iki tarafı da aynı kapıdan (parseSave ->
   * migrate) geçirip parmak izlerinden yapılır; metin karşılaştırması alan
   * sırası ve kendiliğinden değişen alanlar yüzünden neredeyse hiç tutmaz.
   *
   * Kuşkuda kalınırsa (paket okunamadı) FARKLI sayılır: sormak güvenlidir,
   * yanlış otomatik karar değildir — dosyanın geri kalanıyla aynı yön.
   */
  private matchesLocal(save: SaveData, payload: string): boolean {
    const cloud = parseSave(payload);
    if (!cloud) return false;
    return progressFingerprint(cloud) === progressFingerprint(save);
  }

  /** Buluttaki kaydı yerel duruma uygular. Bozuk veride yerel korunur. */
  private applyCloud(save: SaveData, cloudRev: number, payload: string): boolean {
    const restored = parseSave(payload);
    if (!restored) return false;

    // Satın alma hakkı buluttan gelmez; cihazdaki/mağazadaki değer kazanır.
    const keepLocal: Partial<SaveData> = {};
    for (const k of ENTITLEMENT_KEYS) keepLocal[k] = save[k];

    Object.assign(save, restored, keepLocal);
    this.rev = cloudRev;
    this.dirty = false;
    this.blocked = false;
    this.pendingCloud = null;
    return true;
  }

  /** Çakışmayı "bu cihaz kazansın" diye çözer (Faz 2 UI'ı için hazır). */
  async resolveKeepLocal(save: SaveData): Promise<void> {
    if (this.pendingCloud) this.rev = this.pendingCloud.rev;
    this.blocked = false;
    this.pendingCloud = null;
    await this.upload(save);
  }

  /** Çakışmayı "buluttaki kazansın" diye çözer (Faz 2 UI'ı için hazır). */
  resolveKeepCloud(save: SaveData): boolean {
    if (!this.pendingCloud) return false;
    return this.applyCloud(save, this.pendingCloud.rev, this.pendingCloud.payload);
  }

  /** Kısıtlı (throttle'lı) yükleme — sık syncSave() çağrılarında kota yakmaz. */
  maybeUpload(save: SaveData): void {
    if (Date.now() - this.lastUpload < UPLOAD_THROTTLE_MS) return;
    void this.upload(save);
  }

  /** Anında yükleme — uygulama arka plana alınırken/kritik anlarda. */
  flush(save: SaveData): void {
    void this.upload(save);
  }

  private async upload(save: SaveData): Promise<boolean> {
    if (this.blocked || this.uploading) return false;
    this.uploading = true;
    // Kısıtlamayı denemenin BAŞINDA güncelle: aksi halde çevrimdışıyken her
    // başarısız deneme kısıtlamayı sıfır bırakır ve syncSave'in 6 saniyelik
    // aralığı bir yeniden deneme fırtınasına dönüşür.
    this.lastUpload = Date.now();

    try {
      const uid = await withTimeout(ensureUid(), AUTH_TIMEOUT_MS);
      if (!uid) return false;

      const payload = this.serialize(save);
      // Doküman tavanını aşan kayıt (olmamalı) sessizce atlanır; yerel kayıt sağlam.
      if (payload.length > MAX_PAYLOAD_BYTES) return false;

      const nextRev = this.rev + 1;
      // The setDoc() promise is kept separate: even if the timeout wins the
      // race, its late-arriving rejection (rule reject) must be swallowed
      // silently, or it becomes an unhandled rejection — but this .catch()
      // does NOT affect the race's outcome below, which reads a separate chain.
      const writePromise = setDoc(this.ref(uid), {
        payload,
        schemaVersion: SAVE_SCHEMA_VERSION,
        rev: nextRev,
        updatedAt: serverTimestamp(),
        platform: Capacitor.getPlatform(),
        // Çakışma ekranının payload'ı açmadan özet gösterebilmesi için.
        summary: { level: save.level, coins: save.coins, collection: save.collection.length },
      });
      writePromise.catch(() => {});

      let outcome: 'ok' | 'timeout' | 'rejected';
      let timer: ReturnType<typeof setTimeout>;
      try {
        outcome = await Promise.race([
          writePromise.then(() => 'ok' as const),
          new Promise<'timeout'>((resolve) => {
            timer = setTimeout(() => resolve('timeout'), WRITE_TIMEOUT_MS);
          }),
        ]);
      } catch {
        outcome = 'rejected';
      } finally {
        clearTimeout(timer!);
      }

      // On timeout, rev still advances: Firestore may have queued the write
      // offline and it could still land on the server later; retrying the
      // same rev would be rejected by the rule and sync would get stuck for
      // good. BUT a genuine rule reject (stale rev, permission error) is
      // different: the write definitely did not happen, so advancing rev
      // could let the local save get ahead of the cloud and later overwrite
      // another device's genuinely newer progress without ever hitting the
      // conflict screen.
      if (outcome === 'rejected') return false; // dirty stays set, rev stays UNCHANGED
      this.rev = nextRev;
      if (outcome !== 'ok') return false; // timeout: dirty stays set, retried later

      this.dirty = false;
      return true;
    } catch {
      // Unexpected error (e.g. serialize/URL): dirty stays set, retried later.
      return false;
    } finally {
      this.uploading = false;
    }
  }

  private serialize(save: SaveData): string {
    const copy: Record<string, unknown> = { ...save };
    for (const k of ENTITLEMENT_KEYS) delete copy[k];
    return JSON.stringify(copy);
  }
}
