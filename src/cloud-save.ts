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
// * ENTITLEMENT (satın alma hakkı) BULUTTAN GELMEZ. `adsRemoved` yüklenirken
//   payload'dan çıkarılır, indirilirken yerel/mağaza değeri korunur. Aksi
//   halde bir kayıt paylaşımı ücretsiz reklamsız sürüm anlamına gelirdi.
//
// * Ağ yoksa, yapılandırma eksikse veya bir şey ters giderse her fonksiyon
//   sessizce no-op olur; oyun akışı asla bozulmaz (ads.ts/billing.ts deyimi).

import { Capacitor } from '@capacitor/core';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ensureUid, firestore } from './firebase-app';
import { parseSave, SAVE_SCHEMA_VERSION, type SaveData } from './save';

const REV_KEY = 'reefy-cloud-rev';
const DIRTY_KEY = 'reefy-cloud-dirty';

const UPLOAD_THROTTLE_MS = 60_000; // Firestore günlük yazma kotasını koru (Spark: 20K/gün)
const AUTH_TIMEOUT_MS = 3000;      // kötü ağda açılışı kilitleme
const FETCH_TIMEOUT_MS = 4000;
const MAX_PAYLOAD_BYTES = 400_000; // firestore.rules'daki tavanla aynı

/** Buluta gönderilmeyen alanlar — bkz. dosya başı "ENTITLEMENT" notu. */
const ENTITLEMENT_KEYS = ['adsRemoved'] as const;

export type CloudSyncResult =
  | 'disabled'      // yapılandırma yok / ağ yok / zaman aşımı — sessizce yerel devam
  | 'in-sync'       // yerel en az bulut kadar güncel
  | 'uploaded'      // bulutta kayıt yoktu, yerel yüklendi
  | 'restored'      // buluttan indirildi ve uygulandı
  | 'conflict'      // iki taraf da ilerlemiş — yerel korundu, bulut dokunulmadı
  | 'needs-update'; // buluttaki şema bu istemciden yeni

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
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
  private pendingCloud: { rev: number; payload: string } | null = null;

  /** Çözülmemiş bir çakışma var mı (Faz 2'de UI bunu sorar). */
  get hasConflict(): boolean {
    return this.blocked && this.pendingCloud !== null;
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

    const data = snap.data() as { payload?: unknown; rev?: unknown; schemaVersion?: unknown };
    const cloudRev = typeof data.rev === 'number' ? data.rev : 0;
    const payload = typeof data.payload === 'string' ? data.payload : null;
    const cloudSchema = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

    // Daha yeni bir istemcinin yazdığı kayıt: migrate() bilmediği alanları
    // eleyip veriyi bozacağı için hiç dokunma.
    if (cloudSchema > SAVE_SCHEMA_VERSION) return 'needs-update';

    if (!payload) return 'disabled';

    // Yerel en az bulut kadar güncel — normal durum.
    if (cloudRev <= this.rev) {
      if (this.dirty) this.flush(save);
      return 'in-sync';
    }

    // Bulut ilerideyken yerelde de gönderilmemiş değişiklik varsa gerçek
    // çakışma: karar kullanıcınındır, buluta yazma.
    if (this.dirty) {
      this.blocked = true;
      this.pendingCloud = { rev: cloudRev, payload };
      return 'conflict';
    }

    return this.applyCloud(save, cloudRev, payload) ? 'restored' : 'disabled';
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
      await setDoc(this.ref(uid), {
        payload,
        schemaVersion: SAVE_SCHEMA_VERSION,
        rev: nextRev,
        updatedAt: serverTimestamp(),
        platform: Capacitor.getPlatform(),
        // Çakışma ekranının payload'ı açmadan özet gösterebilmesi için.
        summary: { level: save.level, coins: save.coins, collection: save.collection.length },
      });
      this.rev = nextRev;
      this.dirty = false;
      return true;
    } catch {
      // Kural reddi (bayat rev) ya da ağ hatası: dirty korunur, sonra yeniden denenir.
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
