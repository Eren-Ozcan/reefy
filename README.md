# Reefy 🐠

A cozy aquarium game for Android and iOS. Collect fish, decorate tanks, feed and care for your reef, and complete quests — all rendered in 2D with PixiJS and shipped as a native mobile app via Capacitor.

## Features

- **Fish & species system** — collect different species, each with its own look and behavior (`src/species.ts`, `src/fish.ts`)
- **Multiple tanks** — unlock and switch between aquariums (`src/tanks.ts`)
- **Feeding & care loop** — keep your fish fed and happy (`src/feeds.ts`)
- **Decorations** — customize tanks with decor items (`src/decor.ts`)
- **Quests** — goal-driven progression (`src/quests.ts`)
- **Offline saves** — progress is persisted locally (`src/save.ts`)
- **Google Play Games integration** via `@openforge/capacitor-game-connect` (`src/services.ts`)
- **In-app purchases** via RevenueCat (`@revenuecat/purchases-capacitor`, `src/services.ts`) — falls back to a stub in the web preview
- **Ads** via AdMob (`@capacitor-community/admob`, `src/ads.ts`) — interstitial on tank switches (rate-limited) and an opt-in rewarded ad for free pearls; purchasable "remove ads" IAP disables the interstitial. Falls back to a stub in the web preview
- **Sound & music** (`src/audio.ts`)

## Tech stack

- [PixiJS 8](https://pixijs.com/) for 2D rendering
- TypeScript + Vite
- [Capacitor 5](https://capacitorjs.com/) for the Android and iOS shells
- Playwright for automated smoke testing (`test-reefy.mjs`)

## Development

```bash
npm install
npm run dev        # run in the browser at localhost (Vite dev server)
npm run build      # type-check + production build
```

### Mobile builds

```bash
npx cap sync android   # copy web build into the Android project
npx cap open android   # open in Android Studio

npx cap sync ios       # same for iOS (requires macOS + Xcode)
npx cap open ios
```

### In-app purchases (RevenueCat)

The pearl packs in `IAP_PACKS` (`src/services.ts`) are sold through RevenueCat. Before shipping a release build:

1. Create the products in Google Play Console (Monetize > Products) and App Store Connect, using the same ids as `IAP_PACKS` (`pearls-s`, `pearls-m`, `pearls-l`, `pearls-xl`, `starter`).
2. In the RevenueCat dashboard, import those store products and group them into an offering, with package identifiers matching the same ids.
3. Replace the placeholders in `REVENUECAT_API_KEYS` (`src/services.ts`) with your project's public Google/Apple API keys from RevenueCat > Project Settings > API Keys.

Until the API keys are filled in, `RevenueCatIAP` skips configuration and purchases fail with a "not connected" message instead of crashing.

### Friend code verification (Firebase)

Adding a friend by code (`src/services.ts` → `FirebaseSocial`) checks a Firestore
collection (`players/{friendCode}`) to confirm the code is real and to fetch the
real player name, instead of blindly accepting any well-formed code (`LocalSocial`'s
fallback behavior when Firebase isn't configured — see `isFirebaseConfigured()` in
`src/firebase-config.ts`).

This uses a **separate, dedicated Firebase project for Reefy** — each game gets its
own Firebase/GCP project, never shared with another title.

Setup:

1. Create a new Firebase project (`npx firebase projects:create`, or via
   [console.firebase.google.com](https://console.firebase.google.com)).
2. Enable **Firestore** in Native mode (`npx firebase firestore:databases:create`)
   — pick the region carefully, it can't be changed later.
3. Enable **Anonymous Authentication**: Console → Authentication → Sign-in method →
   Anonymous → Enable. `firebase-tools` has no CLI command for this, it's a
   one-time manual toggle.
4. Register a Web app in the project (`npx firebase apps:create WEB "Reefy Web"`),
   then fetch its config (`npx firebase apps:sdkconfig WEB <appId>`) and paste the
   values into `src/firebase-config.ts` (`FIREBASE_CONFIG`), replacing the
   `REPLACE_WITH_...` placeholders. These values are public identifiers safe to
   embed client-side (like the RevenueCat key above) — the actual protection is
   the security rules below.
5. Deploy the security rules from the repo: `npx firebase deploy --only firestore:rules`
   (rules source: `firestore.rules`). They allow anyone signed in (anonymously) to
   `get` a single player doc by its exact code, but disallow `list` — so friend
   codes can be validated one at a time but not scraped/enumerated. Writes are
   restricted to the doc's own owner (`uid` match).

Until `FIREBASE_CONFIG` is filled in, `isFirebaseConfigured()` is false and
`createServices()` falls back to `LocalSocial`, which accepts any correctly
formatted code without checking whether it's real.

### Ads (AdMob)

Ad unit IDs live in `src/ads.ts` (`INTERSTITIAL_AD_IDS`, `REWARDED_AD_IDS`), registered under the "Reefy" app in [AdMob](https://apps.admob.com) for both Android and iOS. The Android app ID is also declared in `android/app/src/main/AndroidManifest.xml` (`com.google.android.gms.ads.APPLICATION_ID` meta-data) and the iOS one in `ios/App/App/Info.plist` (`GADApplicationIdentifier`) — both are required by the native SDK independently of the ad unit IDs used at runtime.

Before shipping:

1. Add payment details in the AdMob dashboard (Payments) — ad units won't serve without it.
2. Once the app is live on Play Store / App Store, link it from AdMob (Apps > Reefy > App settings) so it moves out of the "unlisted" review state.
3. Set up the matching `remove-ads` store product (Google Play Console / App Store Connect) and RevenueCat package so the "Reklamları Kaldır" purchase works end to end.
