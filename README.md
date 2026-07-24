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
