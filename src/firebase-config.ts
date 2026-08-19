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

/**
 * The public demo build (`VITE_DEMO=1`, see .github/workflows/demo.yml) reports
 * "not configured" even though the values above are filled in. That single
 * switch keeps the demo entirely local: no anonymous sign-in, so no cloud save
 * document and no `players/{code}` record is created in the production project
 * by anyone who happens to open the page, and the social provider falls back to
 * LocalSocial. Ads, purchases and platform sign-in are already stubbed off the
 * native flag, so this is the only backend the web build could otherwise reach.
 */
export function isFirebaseConfigured(): boolean {
  if (import.meta.env.VITE_DEMO === '1') return false;
  return !FIREBASE_CONFIG.apiKey.startsWith('REPLACE_');
}
