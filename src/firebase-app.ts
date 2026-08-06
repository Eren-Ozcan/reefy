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

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { FIREBASE_CONFIG, isFirebaseConfigured } from './firebase-config';

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
