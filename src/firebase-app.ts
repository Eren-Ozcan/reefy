// Shared Firebase app and player identity.
//
// If initializeApp() is called a second time with the same config, Firebase
// throws an "app/duplicate-app" error; that's why friend code/leaderboard
// (services.ts FirebaseSocial) and cloud save (cloud-save.ts) share a single
// instance from here.
//
// IDENTITY SEAM — where the iOS path is kept open:
// The rest of the game sees a user ONLY through ensureUid(); whether that
// identity was obtained anonymously, via Google, or via Sign in with Apple is
// encapsulated here. When persistent sign-in is added (linkWithCredential),
// only this file changes — cloud-save.ts and the rest of the game code stay
// the same.
//
// Identity is deliberately NOT TIED to a platform-specific id (Play Games
// player_id / Game Center): Firebase's UID works the same way on Android and
// iOS, so the same player can reach a single save on both platforms. Native
// sign-in (services.ts NativeGameAuth) continues to remain separate, for
// in-game name/badge purposes.

import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  type Auth,
  type AuthCredential,
  type User,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { FIREBASE_CONFIG, isFirebaseConfigured } from './firebase-config';
import { t } from './i18n';

let app: FirebaseApp | null = null;
let dbRef: Firestore | null = null;
let authRef: Auth | null = null;
let uidPromise: Promise<string | null> | null = null;

function ensureApp(): void {
  if (app) return;
  app = initializeApp(FIREBASE_CONFIG);
  authRef = getAuth(app);
  dbRef = getFirestore(app);
}

export function firestore(): Firestore {
  ensureApp();
  return dbRef!;
}

export function firebaseAuth(): Auth {
  ensureApp();
  return authRef!;
}

/**
 * Signs in and returns the player's persistent identity; returns null if
 * Firebase isn't configured or a connection can't be established — in that
 * case callers silently keep working offline (same idiom as
 * ads.ts/billing.ts).
 *
 * If an anonymous session is already open, signInAnonymously() does NOT
 * create a new one, it returns the existing user; so calling it again is
 * safe and the UID stays fixed on the device.
 *
 * On error the promise is dropped from the cache: if the first startup
 * happened offline, cloud save shouldn't stay dead for the rest of that
 * session — the next call retries once the network comes back.
 */
/**
 * Waits for Firebase to restore the persisted session from disk.
 *
 * onAuthStateChanged only fires its first notification after this restore
 * finishes; until then `auth.currentUser` is null and gets mistaken for "no
 * session".
 */
function waitForRestoredUser(auth: Auth): Promise<User | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      () => {
        unsubscribe();
        resolve(null);
      },
    );
  });
}

export function ensureUid(): Promise<string | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  uidPromise ??= (async () => {
    const auth = firebaseAuth();
    // CRITICAL: calling signInAnonymously() directly ran before the
    // persistent session was restored from disk, so it created a NEW
    // anonymous user on EVERY STARTUP; the linked Google account became
    // orphaned and cloud save never worked for a returning player (caught on
    // the emulator). Wait for the existing session to restore first.
    const restored = await waitForRestoredUser(auth);
    if (restored) return restored.uid;
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  })().catch(() => {
    uidPromise = null;
    return null;
  });
  return uidPromise;
}

// ---------- Persistent identity (account linking) ----------

/** Whether the session is linked to a persistent account — i.e. can be recovered on another device. */
export function isLinked(): boolean {
  const u = firebaseAuth().currentUser;
  return !!u && !u.isAnonymous;
}

export function linkedLabel(): string | null {
  const u = firebaseAuth().currentUser;
  if (!u || u.isAnonymous) return null;
  return u.displayName || u.email || null;
}

/** Account linking only makes sense in the native package (that's where the Google account picker lives). */
export function isAccountLinkingAvailable(): boolean {
  return isFirebaseConfigured() && Capacitor.isNativePlatform();
}

export type LinkResult =
  | { ok: true; switched: false; msg: string }
  /** This Google account was already linked to ANOTHER save: switched to that
   *  account, the cloud progress needs to be downloaded (the caller should
   *  re-run the cloud sync). */
  | { ok: true; switched: true; uid: string; msg: string }
  | { ok: false; msg: string };

/**
 * Links the anonymous session to a persistent Google account.
 *
 * Critical branch — `auth/credential-already-in-use`: if the selected Google
 * account is already linked to ANOTHER Firebase user (the player linked it on
 * a different device before), linking fails. The correct behavior here is
 * not to swallow the error but to SWITCH to that account and download the
 * cloud save; otherwise the player's old progress stays unreachable.
 * Implementations that don't handle this branch either crash or silently
 * lose progress.
 *
 * The anonymous user here is left orphaned (not deleted) — the local save on
 * it is already sitting on the device, and if the conflict flow kicks in the
 * user gets asked.
 */
/**
 * Obtains a Google credential.
 *
 * On Android, the plugin uses Credential Manager by default; this API only
 * returns accounts that have previously authorized THIS APP on the device.
 * So on a first sign-in, even if the account is present on the device, it
 * comes back empty with "No matching credentials" and the account picker
 * never opens. That's why the modern flow is tried first, and falls back to
 * the classic picker if it comes back empty — otherwise no player could ever
 * link their account for the first time.
 */
async function requestGoogleIdToken(): Promise<string | null> {
  try {
    const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    if (res.credential?.idToken) return res.credential.idToken;
  } catch {
    /* fall through to the backup flow */
  }
  try {
    const res = await FirebaseAuthentication.signInWithGoogle({
      skipNativeAuth: true,
      useCredentialManager: false,
    });
    return res.credential?.idToken ?? null;
  } catch {
    return null;
  }
}

export async function linkWithGoogle(): Promise<LinkResult> {
  if (!isAccountLinkingAvailable()) {
    return { ok: false, msg: t('Hesap bağlama mobil sürümde kullanılabilir.') };
  }
  try {
    await ensureUid(); // make sure the anonymous session is open

    // skipNativeAuth: only the account picker + credential; the JS SDK opens the session
    // (see the rationale in capacitor.config.ts).
    const idToken = await requestGoogleIdToken();
    if (!idToken) return { ok: false, msg: t('Google girişi tamamlanmadı.') };

    const credential: AuthCredential = GoogleAuthProvider.credential(idToken);
    const auth = firebaseAuth();
    const current = auth.currentUser;

    if (current && current.isAnonymous) {
      try {
        await linkWithCredential(current, credential);
        return {
          ok: true,
          switched: false,
          msg: t('Hesabın bağlandı — ilerlemen artık diğer cihazlarında da açılabilir. ☁️'),
        };
      } catch (e) {
        const code = (e as { code?: string } | null)?.code;
        if (code !== 'auth/credential-already-in-use') throw e;
        // This Google account already has a save: switch to it.
        const signedIn = await signInWithCredential(auth, credential);
        uidPromise = Promise.resolve(signedIn.user.uid);
        return {
          ok: true,
          switched: true,
          uid: signedIn.user.uid,
          msg: t('Bu hesabın kayıtlı bir ilerlemesi var, ona geçildi.'),
        };
      }
    }

    // Already on a persistent account (or no anonymous session): sign in directly.
    const signedIn = await signInWithCredential(auth, credential);
    uidPromise = Promise.resolve(signedIn.user.uid);
    return {
      ok: true,
      switched: true,
      uid: signedIn.user.uid,
      msg: t('Giriş yapıldı.'),
    };
  } catch {
    return { ok: false, msg: t('Google girişi başarısız oldu, daha sonra tekrar dene.') };
  }
}
