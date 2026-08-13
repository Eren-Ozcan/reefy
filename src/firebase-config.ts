// Firebase web config — for friend code verification (see FirebaseSocial, services.ts).
//
// These values are identifiers that are safe to embed in the client, like a
// RevenueCat public API key — they're not secrets that need to be kept
// hidden. The real protection lives in the Firestore security rules (see
// firestore.rules), not in this config.
//
// Setup steps are in the "Friend code verification (Firebase)" section of
// README.md. Until the placeholders are filled in, isFirebaseConfigured()
// returns false and the game falls back to LocalSocial (a local mode that
// never checks whether a friend code exists).
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
