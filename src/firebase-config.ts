// Firebase web config — arkadaş kodu doğrulaması için (bkz. FirebaseSocial, services.ts).
//
// Bu değerler RevenueCat public API key'i gibi client'a gömülü olması güvenli
// tanımlayıcılardır, gizli tutulması gereken sırlar değildir — gerçek koruma
// Firestore güvenlik kurallarında (bkz. firestore.rules), buradaki config'te değil.
//
// Kurulum adımları README.md'deki "Arkadaş kodu doğrulama (Firebase)" bölümünde.
// Placeholder'lar doldurulmadan isFirebaseConfigured() false döner ve oyun
// LocalSocial'a (arkadaş kodu var mı diye hiç kontrol etmeyen yerel mod) düşer.
export const FIREBASE_CONFIG = {
  apiKey: 'REPLACE_WITH_FIREBASE_API_KEY',
  authDomain: 'REPLACE_WITH_FIREBASE_AUTH_DOMAIN',
  projectId: 'REPLACE_WITH_FIREBASE_PROJECT_ID',
  storageBucket: 'REPLACE_WITH_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_WITH_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_WITH_FIREBASE_APP_ID',
};

export function isFirebaseConfigured(): boolean {
  return !FIREBASE_CONFIG.apiKey.startsWith('REPLACE_');
}
