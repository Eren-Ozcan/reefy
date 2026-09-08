import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yilkgames.reefy',
  appName: 'Reefy',
  webDir: 'dist',
  plugins: {
    SafeArea: {
      detectViewportFitCoverChanges: true,
      initialViewportFitCover: true,
    },
    SystemBars: {
      insetsHandling: 'disable',
    },
    // skipNativeAuth MUST be true: the game's entire data layer (cloud-save.ts,
    // services.ts FirebaseSocial) uses the Firebase JS SDK. With the default
    // (false) behaviour the plugin opens the session in the NATIVE SDK; since
    // the JS SDK's session stays separate, sign-in looks "successful" but
    // Firestore writes still go to the old anonymous user. With true, the
    // native layer only shows the account picker and returns the credential,
    // and the JS SDK opens the session.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
