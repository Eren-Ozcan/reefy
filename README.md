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
