// Cloud save (Firestore) — a single document under `saves/{uid}`.
//
// Design decisions and rationale:
//
// * The device clock is NOT TRUSTED. A "last write wins" approach would cause
//   permanent data loss on a device whose clock is set ahead (that device
//   would forever look "newer"). A monotonic `rev` counter is used instead;
//   `updatedAt` is only for display to the user and is a server timestamp.
//
// * NO MERGING ON CONFLICT. Automatically merging two progress states
//   (combine coins? merge quests?) breaks the economy and opens it to abuse.
//   When a conflict is detected the local save is kept and NOTHING IS WRITTEN
//   TO THE CLOUD — so the cloud version stays intact as a backup. Phase 2 will
//   offer the user a choice; resolveKeepLocal/resolveKeepCloud are ready for that.
//
// * THE SAME SAVE IS NOT A CONFLICT. The rev counter knows "who wrote last",
//   not "what was written"; when two devices sync in sequence this could
//   produce a choice screen where both columns are identical. Before deciding,
//   sync() compares the content of both sides (see save.ts progressFingerprint)
//   and silently resolves without asking when they match.
//
// * ENTITLEMENTS DO NOT COME FROM THE CLOUD. `adsRemoved` is stripped from the
//   payload on upload and the local/store value is kept on download. Otherwise
//   sharing a save would mean a free ad-free version.
//
// * If there's no network, config is missing, or something goes wrong, every
//   function silently becomes a no-op; the game flow is never broken (same
//   idiom as ads.ts/billing.ts).

import { Capacitor } from '@capacitor/core';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ensureUid, firestore } from './firebase-app';
import { hasProgress, parseSave, progressFingerprint, SAVE_SCHEMA_VERSION, type SaveData } from './save';

const REV_KEY = 'reefy-cloud-rev';
const DIRTY_KEY = 'reefy-cloud-dirty';

const UPLOAD_THROTTLE_MS = 60_000; // protect Firestore's daily write quota (Spark: 20K/day)
// ensureUid() runs initializeApp() on cold start and waits for Auth to
// restore the persisted session from IndexedDB (see firebase-app.ts
// waitForRestoredUser). MEASURED on an Android 14 emulator: 2946 ms — 54 ms
// under the old 3000 ms budget. So it was oscillating right at the edge, and
// on every startup that exceeded it sync silently returned 'disabled' and did
// nothing; in two-device testing this showed up as "B's progress never
// reaches A".
//
// The timeout is kept GENEROUS because the cost of timing out is high: the
// startup sync runs ONCE per session, and if it's missed the player sees
// neither a restore nor a conflict screen. This value no longer BLOCKS
// STARTUP — game.ts only delays startup by CLOUD_STARTUP_GRACE_MS and
// processes the result later if it arrives after that.
const AUTH_TIMEOUT_MS = 15_000;
const FETCH_TIMEOUT_MS = 4000;
// setDoc() does NOT resolve while offline: Firestore queues the write locally
// and keeps the promise pending until the server acknowledges it. Without a
// timeout, the finally block inside upload() never runs, `uploading` stays
// locked, and cloud save dies entirely for the rest of the session — so
// writes are bounded too.
const WRITE_TIMEOUT_MS = 8000;
const MAX_PAYLOAD_BYTES = 400_000; // matches the cap in firestore.rules

/** Fields that are never sent to the cloud — see the "ENTITLEMENT" note at the top of the file. */
const ENTITLEMENT_KEYS = ['adsRemoved'] as const;

/** The summary the conflict screen can show without opening the payload. */
export interface CloudSummary {
  level: number;
  coins: number;
  collection: number;
  /** Server timestamp (ms). Independent of the device clock; 0 = unknown. */
  updatedAtMs: number;
}

export type CloudSyncResult =
  | 'disabled'      // no config / no network / timeout — silently continue locally
  | 'in-sync'       // local is at least as up to date as the cloud
  | 'uploaded'      // there was no cloud save, local was uploaded
  | 'restored'      // downloaded from the cloud and applied
  | 'conflict'      // both sides have progressed — local kept, cloud untouched
  | 'needs-update'; // the cloud schema is newer than this client

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
  /** The last successfully uploaded/downloaded revision number. */
  private get rev(): number {
    return readInt(REV_KEY);
  }
  private set rev(v: number) {
    try {
      localStorage.setItem(REV_KEY, String(v));
    } catch {
      /* storage blocked — cloud save stays disabled, game is unaffected */
    }
  }

  /** Whether there have been local changes since the last sync (remembered even if the app is killed). */
  private get dirty(): boolean {
    return localStorage.getItem(DIRTY_KEY) === '1';
  }
  private set dirty(v: boolean) {
    try {
      localStorage.setItem(DIRTY_KEY, v ? '1' : '0');
    } catch {
      /* ignored */
    }
  }

  private lastUpload = 0;
  private uploading = false;
  /** Writes stop until the conflict is resolved; the cloud version is kept as a backup. */
  private blocked = false;
  private pendingCloud: { rev: number; payload: string; summary: CloudSummary } | null = null;

  /** Whether there is an unresolved conflict. */
  get hasConflict(): boolean {
    return this.blocked && this.pendingCloud !== null;
  }

  /** The summary of the cloud save that the conflict screen will show. */
  get conflictSummary(): CloudSummary | null {
    return this.pendingCloud?.summary ?? null;
  }

  /**
   * Called when the session switches to a different account. The rev counter
   * is kept ON THE DEVICE and belonged to the old account; it's meaningless
   * for the new one. If not reset, the local counter could look larger than
   * the cloud's and be mistaken for "local is up to date", silently
   * overwriting the other account's progress. Resetting it and marking dirty
   * makes the next sync() see both sides and let the user choose.
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

  /** Marks that there is a local change; runs every time syncSave() is called. */
  markDirty(): void {
    if (!this.dirty) this.dirty = true;
  }

  /**
   * Called once at startup: compares the cloud save with the local one and,
   * if needed, updates the `save` object IN PLACE (does not change its
   * reference — services.ts providers hold onto the same object).
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
      // Server timestamp; stays 0 if not yet written (local cache).
      updatedAtMs: typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0,
    };

    // A save written by a newer client: don't touch it at all, since
    // migrate() would strip fields it doesn't know about and corrupt the data.
    if (cloudSchema > SAVE_SCHEMA_VERSION) return 'needs-update';

    if (!payload) return 'disabled';

    // Local is at least as up to date as the cloud — the normal case.
    if (cloudRev <= this.rev) {
      // Awaited: upload() is bounded by its own WRITE_TIMEOUT_MS, so it never
      // hangs sync() — but left fire-and-forget, callers that await sync()
      // (e.g. resyncCloudForNewAccount) could proceed before the write
      // finished and race with the next state change.
      if (this.dirty) await this.upload(save);
      return 'in-sync';
    }

    // If the cloud is ahead while local also has unsent changes, that's a
    // genuine conflict: the decision belongs to the user, don't write to the cloud.
    //
    // FAST PATH: "unsent change" doesn't always mean actual progress — the
    // save is considered self-modified a few seconds after entering the game
    // (see save.ts hasProgress). If there's no local effort worth risking,
    // there's nothing to ask about either: instead of showing a conflict
    // screen where one side is empty, restore straight from the cloud. This
    // is the expected behavior on a freshly set up device and right after
    // linking an account.
    if (this.dirty && hasProgress(save)) {
      // TWO COPIES OF THE SAME SAVE ARE NOT A CONFLICT. The rev counter only
      // knows "who wrote last", not "what was written": if device A keeps
      // writing while B restores from the cloud, on B's next sync the cloud
      // looks ahead and local looks "unsent" — even though both sides are
      // byte-for-byte the same progress. A choice screen where both columns
      // are identical gives the player the same outcome no matter which
      // button they press, and kills their trust in the screen.
      if (this.matchesLocal(save, payload)) {
        // No RESTORE happens here — deliberately: the local side may be
        // ahead in fields we deliberately exclude from the comparison
        // (accrued income, fish growth), and overwriting those with the
        // cloud version gains nothing. Only the cloud's counter is adopted,
        // so the same conflict doesn't repeat on every sync. `dirty` is kept
        // set: local drift will reach the cloud on its own via the next
        // throttled upload (rev = cloudRev + 1).
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
   * Is the cloud payload the SAME as the local save from the player's point
   * of view? The comparison isn't done on raw payload text — both sides go
   * through the same gate (parseSave -> migrate) and are compared by
   * fingerprint; text comparison would almost never hold up due to field
   * ordering and self-modifying fields.
   *
   * When in doubt (payload couldn't be read) it's treated as DIFFERENT:
   * asking is safe, an incorrect automatic decision is not — same direction
   * as the rest of the file.
   */
  private matchesLocal(save: SaveData, payload: string): boolean {
    const cloud = parseSave(payload);
    if (!cloud) return false;
    return progressFingerprint(cloud) === progressFingerprint(save);
  }

  /** Applies the cloud save to local state. If the data is corrupt, local is kept. */
  private applyCloud(save: SaveData, cloudRev: number, payload: string): boolean {
    const restored = parseSave(payload);
    if (!restored) return false;

    // Entitlements don't come from the cloud; the device/store value wins.
    const keepLocal: Partial<SaveData> = {};
    for (const k of ENTITLEMENT_KEYS) keepLocal[k] = save[k];

    Object.assign(save, restored, keepLocal);
    this.rev = cloudRev;
    this.dirty = false;
    this.blocked = false;
    this.pendingCloud = null;
    return true;
  }

  /** Resolves the conflict as "this device wins" (ready for the Phase 2 UI). */
  async resolveKeepLocal(save: SaveData): Promise<void> {
    if (this.pendingCloud) this.rev = this.pendingCloud.rev;
    this.blocked = false;
    this.pendingCloud = null;
    await this.upload(save);
  }

  /** Resolves the conflict as "the cloud wins" (ready for the Phase 2 UI). */
  resolveKeepCloud(save: SaveData): boolean {
    if (!this.pendingCloud) return false;
    return this.applyCloud(save, this.pendingCloud.rev, this.pendingCloud.payload);
  }

  /** Throttled upload — doesn't burn quota on frequent syncSave() calls. */
  maybeUpload(save: SaveData): void {
    if (Date.now() - this.lastUpload < UPLOAD_THROTTLE_MS) return;
    void this.upload(save);
  }

  /** Immediate upload — when the app is backgrounded/at critical moments. */
  flush(save: SaveData): void {
    void this.upload(save);
  }

  private async upload(save: SaveData): Promise<boolean> {
    if (this.blocked || this.uploading) return false;
    this.uploading = true;
    // Update the throttle at the START of the attempt: otherwise, while
    // offline, every failed attempt would leave the throttle at zero and
    // syncSave's 6-second interval would turn into a retry storm.
    this.lastUpload = Date.now();

    try {
      const uid = await withTimeout(ensureUid(), AUTH_TIMEOUT_MS);
      if (!uid) return false;

      const payload = this.serialize(save);
      // A save exceeding the document cap (shouldn't happen) is silently skipped; local save stays intact.
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
        // So the conflict screen can show a summary without opening the payload.
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
