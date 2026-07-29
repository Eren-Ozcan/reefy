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
  apiKey: 'AIzaSyBO6JaY-VGlWkUvKR6nh3kw5asK--eVS_k',
  authDomain: 'reefy-67ac5.firebaseapp.com',
  projectId: 'reefy-67ac5',
  storageBucket: 'reefy-67ac5.firebasestorage.app',
  messagingSenderId: '778208134304',
  appId: '1:778208134304:web:7508e0b42d534d290775c5',
};

export function isFirebaseConfigured(): boolean {
  return !FIREBASE_CONFIG.apiKey.startsWith('REPLACE_');
}
