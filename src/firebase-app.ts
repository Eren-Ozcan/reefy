// Paylaşılan Firebase uygulaması ve oyuncu kimliği.
//
// Aynı config ile initializeApp() ikinci kez çağrılırsa Firebase
// "app/duplicate-app" hatası verir; bu yüzden arkadaş kodu/liderlik
// (services.ts FirebaseSocial) ve bulut kaydı (cloud-save.ts) tek bir
// örneği buradan paylaşır.
//
// KİMLİK DİKİŞİ — iOS yolunu açık tutan yer:
// Oyunun geri kalanı bir kullanıcıyı YALNIZCA ensureUid() üzerinden görür;
// bu kimliğin anonim mi, Google ile mi, yoksa Sign in with Apple ile mi
// elde edildiği burada kapsüllenir. Kalıcı giriş eklenirken (linkWithCredential)
// sadece bu dosya değişir — cloud-save.ts ve oyun kodu aynen kalır.
//
// Kimlik bilerek platforma özgü bir kimliğe (Play Games player_id / Game
// Center) BAĞLANMAZ: Firebase UID'si Android ve iOS'ta aynı şekilde çalışır,
// böylece aynı oyuncu iki platformda tek kayda ulaşabilir. Native giriş
// (services.ts NativeGameAuth) oyun-içi isim/rozet için ayrı kalmaya devam eder.

import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  signInAnonymously,
  signInWithCredential,
  type Auth,
  type AuthCredential,
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
 * Oturumu açar ve oyuncunun kalıcı kimliğini döndürür; Firebase
 * yapılandırılmamışsa veya bağlantı kurulamazsa null döner — çağıranlar bu
 * durumda sessizce çevrimdışı çalışmaya devam eder (ads.ts/billing.ts ile
 * aynı deyim).
 *
 * signInAnonymously() zaten açık bir anonim oturum varsa YENİSİNİ
 * oluşturmaz, mevcut kullanıcıyı döndürür; bu yüzden tekrar çağrılması
 * güvenlidir ve UID cihazda sabit kalır.
 *
 * Hata durumunda söz (promise) önbellekten düşürülür: ilk açılış çevrimdışı
 * yapıldıysa bulut kaydı o oturum boyunca ölü kalmasın, ağ gelince bir
 * sonraki çağrı yeniden denesin.
 */
export function ensureUid(): Promise<string | null> {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  uidPromise ??= signInAnonymously(firebaseAuth())
    .then((cred) => cred.user.uid)
    .catch(() => {
      uidPromise = null;
      return null;
    });
  return uidPromise;
}

// ---------- Kalıcı kimlik (hesap bağlama) ----------

/** Oturum kalıcı bir hesaba bağlı mı — yani başka bir cihazda geri alınabilir mi. */
export function isLinked(): boolean {
  const u = firebaseAuth().currentUser;
  return !!u && !u.isAnonymous;
}

export function linkedLabel(): string | null {
  const u = firebaseAuth().currentUser;
  if (!u || u.isAnonymous) return null;
  return u.displayName || u.email || null;
}

/** Hesap bağlama yalnızca native pakette (Google hesap seçicisi orada var) anlamlı. */
export function isAccountLinkingAvailable(): boolean {
  return isFirebaseConfigured() && Capacitor.isNativePlatform();
}

export type LinkResult =
  | { ok: true; switched: false; msg: string }
  /** Bu Google hesabı BAŞKA bir kayda bağlıymış: o hesaba geçildi, buluttaki
   *  ilerleme indirilmeli (çağıran bulut senkronunu yeniden çalıştırmalı). */
  | { ok: true; switched: true; uid: string; msg: string }
  | { ok: false; msg: string };

/**
 * Anonim oturumu kalıcı bir Google hesabına bağlar.
 *
 * Kritik dal — `auth/credential-already-in-use`: seçilen Google hesabı zaten
 * BAŞKA bir Firebase kullanıcısına bağlıysa (oyuncu daha önce başka bir
 * cihazda bağlamışsa) bağlama başarısız olur. Bu durumda doğru davranış
 * hatayı yutmak değil, o hesaba GEÇMEK ve buluttaki kaydı indirmektir;
 * aksi halde oyuncunun eski ilerlemesi erişilemez kalır. Bu dalı ele almayan
 * implementasyonlar ya çöker ya da sessizce ilerleme kaybettirir.
 *
 * Buradaki anonim kullanıcı yetim kalır (silinmez) — üzerindeki yerel kayıt
 * zaten cihazda duruyor ve çakışma akışı devreye girerse kullanıcıya sorulur.
 */
export async function linkWithGoogle(): Promise<LinkResult> {
  if (!isAccountLinkingAvailable()) {
    return { ok: false, msg: t('Hesap bağlama mobil sürümde kullanılabilir.') };
  }
  try {
    await ensureUid(); // anonim oturumun açık olduğundan emin ol

    // skipNativeAuth: yalnızca hesap seçici + kimlik bilgisi; oturumu JS SDK açar
    // (bkz. capacitor.config.ts'teki gerekçe).
    const res = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const idToken = res.credential?.idToken;
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
        // Bu Google hesabının zaten bir kaydı var: ona geç.
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

    // Zaten kalıcı bir hesapta (ya da anonim oturum yok): doğrudan giriş yap.
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
