# Roadmap

## Pending

### Coral Festival — what the first run has to answer

The feature is built and shipped (see Done); what is left is not code. The
first event runs **2026-08-24 to 2026-08-28** and it is the only source of
evidence for whether the numbers are right.

- [ ] **Watch the point totals against the tiers.** The four tiers (150 / 400 /
      900 / 1,800) were sized by estimate, not by measurement. If most players
      finish all four on day two, the event stops being a reason to come back;
      if nobody clears the third, the top tier is decoration.
- [ ] **Decide on a remote calendar only after that.** `EVENTS` in
      `src/events.ts` is embedded, so a new festival needs an app update. Moving
      it to Firestore is worth it once the tuning is known — and it brings an
      offline story and an "event vanished mid-run" case that are not worth
      writing against unvalidated numbers.
- [ ] **A second event needs new dates, not a reused id.** The save resets its
      points only when the active event's id differs; shipping the same id with
      new dates would hand returning players their old points.

### Turkish is back — one thing left to watch

- [ ] **Does Google Play actually populate `currencyCode` for these products?**
      Everything on this side of the boundary is now tested against a mock
      shaped like the SDK (`src/store-currency.test.ts`): `loadPrices()` records
      the currency, records nothing when the store is unreachable or silent, and
      the recorded value reaches `detectLang()` and outranks the device language
      in both directions. Changing the field name breaks those tests, which is
      the point — a wrong name would otherwise look implemented and never fire.
      What a mock cannot answer is whether the real store fills the field for
      this app's offering. The RevenueCat offering now exists (see Done), so
      this is unblocked — check it with a live Turkish Play account:
      `reefy-store-currency` should read `TRY` after the shop's Pearls tab has
      been opened once.

### Store listing is now stale

- [ ] **The closed-testing listing shows the old UI.** Every screenshot is the
      old white-panel Turkish interface; the game is now a dark sheet language.
      Four raw screenshots of the redesigned UI (tank, shop, quests, earnings
      report) were captured from a fresh save via `npm run dev` and pushed to
      the private `Eren-Ozcan/pictures` repo (`pictures/reefy/`) — see CLAUDE.md
      for why they don't live in this repo. **Still needed:** the listing copy
      itself hasn't been touched, the screenshots are raw captures (not cropped
      to Play's required dimensions or annotated), and nothing has been
      uploaded to Play Console yet. The fresh save also has no fish variety or
      decor, so a save with more progress would make a better hero shot than
      what's there now.

### Housekeeping

- [ ] Biome marks are raster PNGs (`src/icons/`) while the UI icons are inline
      SVG (`src/icons.ts`). Deliberate — they are illustrations, not
      affordances — but worth revisiting if they ever need to take a tint.

### Privacy policy and Data Safety

- [x] `PRIVACY.md` written (2026-08-08). The game had none at all. It covers the
      automatic anonymous player ID, what the cloud save copies (and that the
      ad-free entitlement deliberately is not restored), optional Google
      linking, and the `players/{code}` record — the display name and score
      behind a friend code are readable by anyone signed in who has that code,
      which is the one genuinely public thing in the game and needs saying out
      loud, since the name is free text the player types
- [x] The studio-wide policy at <https://yilkgames.com/privacy-policy/> was
      updated to match. It had claimed "Reefy does not show ads" and described
      sign-in as Play Games Services for a leaderboard — both stale
- [x] **Play Console Data Safety form — done (2026-08-08).** Declared: the save
      payload as App activity → other user-generated content (required, not
      shared); email + name as Personal info, **optional**, only for players who
      link; the anonymous player ID as Personal info → **User IDs** (required)
      rather than Device IDs, because Play scopes device identifiers to the
      device and an auth UID is an account identifier; the advertising ID as
      Device or other IDs (required, shared, advertising); approximate location
      (shared, advertising); and purchase history (optional, **shared** — this
      game routes purchases through RevenueCat, unlike Little Grand Hotel).
      Name carries a second purpose here that the sibling games do not need —
      app functionality — because of the friend-code display name
- [x] Declaring OAuth forced a second requirement: Play demands a **mandatory
      account deletion URL** on the store listing, and the privacy policy does
      not qualify (it must name the app, show the steps prominently, and state
      what is kept and for how long). <https://yilkgames.com/account-deletion/>
      was written for it; `#data-only` is the data-without-account variant
- [x] **In-app deletion — done (2026-08-19).** Settings → Delete my cloud data
      removes the save document and the `players/{code}` record. `firestore.rules`
      now allows `delete` on one's own document in both collections; the old
      blanket denial protected nothing, since anyone able to write as that uid
      could already overwrite the payload at rev+1

### Cloud save — remaining platforms

The shared design (Firestore `saves/{uid}`, monotonic `rev` instead of device
clocks, no automatic merging, entitlements never restored from the cloud) has
been ported to both sibling games:

- [x] **Çengel Bulmaca** — reuses the existing Firebase project and the lazy
      auth setup in `src/referral.ts`. The save is spread across ~13 `cengel-`
      prefixed localStorage keys and is collected through an allowlist;
      date-keyed hint entries are pruned to a one-week window.
- [ ] **Little Grand Hotel** — Firestore over REST with `HTTPRequest` (Godot has
      no official Firebase SDK); storage, conflict modal and rules are done.
      **Still missing: Google account linking is not wired.** `cloud_save.gd`
      exposes `set_google_id_token_provider()` but nothing ever calls it, so
      `is_account_linking_available()` is always false and the save is anonymous
      and device-bound — it survives a restart but not a reinstall or a new
      device. Also needs the Play app-signing SHA-1 once the first bundle is
      uploaded, or Google sign-in fails only in store builds.

### iOS

- [ ] Sign in with Apple — App Store guideline 4.8 requires an equivalent
      privacy-focused option once Google sign-in is offered.
- [ ] Keep Google sign-in available on iOS as well: an account that uses Apple's
      "Hide My Email" produces a different Firebase UID than the same person's
      Google account, so cross-platform continuity silently breaks unless the
      player can link both.
- [ ] RevenueCat iOS key is still a placeholder (`src/services.ts`) — purchases
      fall through to the "store not configured" path.

## Done

### Orphaned cloud saves cleared out (2026-08-19)

Was blocked on tooling, not a decision — the Firebase CLI can delete a known
path but can't list documents, and identifying orphans needed admin
credentials the CLI login doesn't provide. Unblocked by generating a key for
the existing `firebase-adminsdk-fbsvc@reefy-67ac5` service account and running
a one-off `firebase-admin` script (dry run first, then `--delete`) against the
exact criterion the earlier write-up specified: a `saves/{uid}` document with
no `players/` record referencing that uid, and `hasProgress()` false on the
parsed payload. Reused `hasProgress()`/`parseSave()` from `src/save.ts`
directly (via `tsx`) rather than reimplementing the check, so the script can't
drift from what the app itself considers "real progress".

Found 2 orphans out of 78 `saves/` documents — smaller than expected, most
stray anonymous users apparently never made it to a second launch. Deleted
both, then deleted the service account key and the downloaded script/JSON —
no standing admin credential was left behind.

### RevenueCat offering configured — purchases are live (2026-08-19)

Root cause was deeper than the dashboard-only gap the previous write-up
assumed: RevenueCat had no service account credentials for Play Console at
all, so `Import` on the Products page found nothing to import, not just an
unconfigured offering.

- Created a dedicated service account (`revenuecat-play-billing@reefy-67ac5`)
  in the `reefy-67ac5` GCP project, matching the pattern already used for
  Çengel Bulmaca. Downloaded its JSON key and uploaded it under the app's
  Service Account Credentials in RevenueCat.
- Invited that service account into Play Console → Users and permissions,
  scoped to the Reefy app only, with **View financial data** (no order
  management — RevenueCat only needs read access to validate transactions).
- Enabled the **Google Play Android Developer API** in the `reefy-67ac5` GCP
  project — it had never been turned on, which is a separate prerequisite
  from the Play Console invite and would have kept `Import` empty even with
  correct permissions.
- Imported all six products (`pearls_s/m/l/xl`, `starter`, `remove_ads`).
  `starter` and the four `pearls_*` packs are **Consumable** (repeatable
  currency purchases); `remove_ads` is **Non-consumable** — confirmed against
  `IAP_PACKS` in `src/services.ts`, where only `remove_ads` sets
  `removesAds: true` and grants a permanent entitlement.
- Created the `default` offering (RevenueCat's current offering by default,
  being the only one) with six packages, each package identifier set to
  match its product id exactly (`pearls_s`, `pearls_m`, etc.) — `findStorePackage()`
  and `loadPrices()` both key off `pkg.identifier`, so a mismatched name would
  have silently matched nothing.
- Did **not** wire up Google developer notifications (Pub/Sub) — the app page
  still shows "Credentials need attention" for that specific optional
  integration, but the core Purchases API access this task needed is
  confirmed working (Import successfully read the live Play Console catalog).
- iOS stays blocked behind an Apple Developer account, as before.

### UI redesign — Releases A and B (2026-08-18)

The approved "game language" direction: the aquarium never closes, panels sit
over it as sheets, and the retention loop is visible instead of inferred.

**Release A — the language itself.**

- The panel work lands in `panelShell()`, which every screen already routes
  through, so all 22 changed at once: grab handle, wider sheet radius, dark
  glass, filled pill tabs, card surfaces on tokens instead of hardcoded `#fff`.
- HUD became dark glass chips; the XP bar folded into the level as a
  conic-gradient ring; a streak chip appeared — `save.streak` was already
  tracked and already scaled the daily gift, it was just invisible.
- Passive income moved to the centre-ish of the scene, then **off** dead centre
  once the smoke run proved a DOM button there swallows the taps that feed fish
  and clean dirt. It hides entirely during feed and arrange modes.
- The dock gained an active-tab state (it had none) and a live status line per
  label, backed by `Game.claimableQuests()` and `Game.affordableShopItems()`.
  Feed and Arrange moved to a side rail — they act on the scene rather than
  navigating. Social folded under **You**, which replaced More; Quests was
  promoted to the dock.
- The current objective now sits on a strip above the dock, refreshed from
  `updateIncome()` because `questEvent()` records progress without redrawing
  the HUD.
- Typography: Fredoka and Nunito, bundled locally as variable woff2 rather than
  linked — this ships in a Capacitor WebView, where a CDN request means no font
  on a cold offline start. **Every figure is Nunito**: Fredoka has no
  tabular-figure table at all and its digits vary by a third in width, so
  counters would visibly jump.
- Emoji left the fixed-height chrome: eight inline SVG icons for HUD and dock,
  plus seven illustrated biome marks.

**Release B — the retention loop.** None of it adds an incentive; all three
were already computed and already paying out.

- Offline earnings and the daily gift became one itemised return receipt.
- The seven-day streak ladder is reachable from the HUD chip. The reward
  formula moved into `Game.dailyGiftFor()` so the ladder and the grant path
  cannot drift apart.
- Achievements got their own screen. The IA audit had found them at the bottom
  of the Quests scroll — reachable in principle, unseen in practice.

### Coral Festival — the third rhythm (2026-08-18)

A multi-day event that accrues points from ordinary play toward tiers claimed
one by one, next to the existing daily (`questsForDay`) and weekly
(`weeklyQuestForWeek`) rhythms. Lives in its own `src/events.ts`.

Both open questions went the conservative way:

- **Embedded calendar, not remote.** Firebase is already wired up, but a remote
  calendar adds an offline story and an "event vanished mid-run" case, and
  neither is worth building before one event has shown whether the numbers work.
- **A two-day grace window after the end** (`EVENT_GRACE_DAYS`). Losing a reward
  that was actually earned reads as a bug rather than as urgency, and the closed
  test has few enough players that one missed claim is loud feedback. Grace does
  NOT extend scoring — `activeEvent()` closes on the end date and only
  `claimableEvent()` stays open, which is the distinction the tests pin.

Details worth keeping:

- Scoring hangs off `questEvent()`, so every existing call site feeds the
  festival and no action can be scored by the quests but missed by the event.
- `earn` scores nothing: passive income accrues while the game is CLOSED, so
  paying points for it would reward the opposite of showing up.
- Event rewards are flat, unlike quests, which scale with level — the tiers are
  sized against the whole event, so scaling them again would make a late-game
  festival dwarf everything else.
- Windows are compared as ISO day-key STRINGS, the same form the quests use.
  There is no timestamp arithmetic anywhere in the file to get wrong.
- The clock-tampering stance holds: the calendar is date-based, so a moved
  clock can only enter a window early — the points themselves still require
  real play.

### A language nobody chose (2026-08-19)

The emulator run found a bug that no unit test would have: on a Turkish device
carrying a save from the English-only period, the menu came up Turkish and the
game came up English. The menu detects; the game reads `save.lang`, and that
field held an 'en' the player never chose — `detectLang()` was forced to return
it while `AVAILABLE_LANGS` was `['en']`.

Left alone, every Turkish player who installed in that window would have been
stuck in English permanently, with no way out: the settings row that would fix
it was behind the language they could not read. `langChosen` now separates a
choice from a guess, and old saves default to "not chosen" — while one language
shipped the row was hidden, so there were no real choices to lose.

### Turkish returned, and the language guess changed (2026-08-19)

`AVAILABLE_LANGS` is `['en', 'tr']` again. What changed beyond the one line:

- The first launch's language now leans on the STORE account rather than the
  handset. The Play/App Store account's country is not directly readable
  without another plugin, but its billing currency is, so `loadPrices()`
  records it and the NEXT launch reads it — prices arrive long after the first
  frame, so awaiting them was never an option.
- Turkish is chosen only on positive evidence; everything else gets English.
  Guessing English wrong leaves a player in a language most can navigate,
  guessing Turkish wrong strands them in one almost nobody can.
- A time-zone signal was tried and dropped: Europe/Istanbul says where the
  handset is, not what its owner reads, and it handed Turkish to a device
  explicitly set to German.
- `src/i18n.test.ts` now checks the TR table against every key the code asks
  for. It found no gaps on the day it was written; the point is the next
  feature.
- The smoke run pins its locale explicitly. Without that it followed the
  developer's machine — it failed an English assertion on a Turkish laptop the
  moment the second language shipped.

### The two-devices-live rev race, and the dead end it found (2026-08-19)

The last untested cloud path turned out to hide a real one-session dead end.
Device A writes rev 7 while B is still on 5; B's next upload asks for rev 6 and
the rule rejects it. `rev` correctly stayed put — but `sync()` only ever ran at
startup, so nothing re-read the cloud and B retried the same doomed revision
every throttle window until the app was restarted. Its progress reached nobody
in the meantime.

A rejected write now marks the client stale, `syncSave()` routes that into a
re-sync instead of another upload, and the sync resolves it the usual way:
identical content settles silently, diverged content raises the conflict screen
through the same late hook the startup path uses.

### Egg hatch timer — Abyssal Egg (2026-08-18)

The decision the roadmap was blocked on went to **a new tier, not retroactive**.
The three original eggs (`bronz`, `gumus`, `altin`) still hatch instantly and
their code path is untouched; the wait ships as a property of a fourth tier,
`abis` (Abyssal Egg, 110 pearls, epic 60 / legendary 40, four hours), so nobody
loses anything they had. Retroactive would have re-priced a purchase players
already make — and the coin inflation it would have curbed was never measured
as a problem.

- `EggTier.hatchMs` is optional (`src/species.ts`). Undefined means "instant",
  which is what makes the old path a no-op rather than a special case.
- `save.pendingEggs: PendingEgg[]` with a `migrate()` guard; a save written
  before this reads as an empty queue.
- The species is rolled at COLLECT time, not at purchase, so the outcome never
  sits in the save and the golden egg's pity counter stays single-sourced.
- Speed-up costs one pearl per 12 minutes remaining (`SPEEDUP_MS_PER_PEARL`),
  so a nearly-hatched egg is nearly free to finish — it sells impatience, not
  the egg.
- An incubating egg holds a tank slot (`reservedSlots`), or a player could buy
  an egg, fill the tank while it hatches, and leave it homeless. Collecting
  into a full tank fails without consuming the egg.
- No `src/cloud-save.ts` change was needed after all: that file replaces the
  whole save rather than merging fields, and `progressFingerprint()` is a
  denylist, so `pendingEggs` entered the conflict comparison on its own.

### Language flipped to English (2026-08-18)

Turkish text had been the dictionary key. 835 strings were codemodded to
English across call sites and data tables, and the EN dictionary was inverted
into a `TR` table rather than discarded. Verified lossless first: no two
Turkish strings shared one English translation, so the inversion is
unambiguous. Fixed three latent bugs on the way — a dictionary key with a typo
that left one paragraph untranslated for English players, an untranslated decor
adjective with no Turkish-specific letters, and percentages written in Turkish
order (`%-35` instead of `-35%`).

### Smoke run repaired (2026-08-18)

`npm run smoke` had stopped completing well before the redesign; the IA change
finished it off. It was hiding: no first-launch tutorial handling (a fresh
Playwright context always gets one, and its backdrop eats the first click), the
menu's 0.6s fade swallowing clicks, a `BlurFilter` assertion that outlived the
feature it tested (`b9dd3bb` replaced the blur with grime on the glass), a
decor drag grabbing a hardcoded `y` when decor sits on a sand surface that
curves with `x`, and profile assertions still expecting Turkish labels. The
dirt-cleaning step now asserts no UI covers the spot before tapping it, so a
control parked over the scene fails loudly instead of silently eating taps.

### Cloud save — phase 3: the fresh-install fast path (2026-08-07)
- [x] `hasProgress()` (`src/save.ts`) — decides whether the local save holds
      anything the player earned. Deliberately substance-based, not the `dirty`
      flag and not a deep-equality check against the default: the save counts as
      "changed" within seconds of entering the game (`lastSeen`, accrued income,
      dirt spots, the day-1 streak marker), which is exactly why a brand-new
      device saw a chooser with one empty side
- [x] `CloudSave.sync()` takes the conflict branch only when the local save
      actually holds progress; otherwise it restores from the cloud directly.
      The direction is deliberate — a wrong "no progress" would silently delete
      the player's game, a wrong "has progress" only falls back to asking
- [x] First test setup in this repo (vitest + jsdom, `npm test`): every signal
      that counts as progress and every field deliberately ignored is covered
      one by one, plus the `sync()` decision table against a faked Firestore
      (82 tests). The ignored-field half matters most: if one of them starts
      counting as progress by accident, the fast path silently stops working

### Cloud save — two-emulator run, and the two bugs it found (2026-08-07)
Two Android 14 emulators, same Google account, real Firestore. What the run
proved, and what only a real device could have shown:
- [x] **Fresh device restores automatically.** Device B, installed clean and
      never played, linked the account and picked up A's exact state — 145
      coins, 5/7 fish, all five fish — with no chooser in sight
- [x] **A genuine conflict still asks.** When both sides held real progress the
      chooser appeared with both columns filled; nothing was merged, and picking
      "this device" pushed the local save up
- [x] **`hasProgress()` was wrong twice, and the emulator proved it.** A brand-new
      install showed the chooser with an empty side, because two fields counted
      as progress that no player earned: `tutorialDone` (the intro carousel
      blocks the screen — you cannot reach Settings without dismissing it) and
      `collection` (both starting fish reach adulthood on their own within
      minutes). The device save that exposed this is now a regression test
- [x] **Mid-session restores silently dropped fish** — a pre-existing bug the
      fast path made routine. `syncSave()` rebuilds `save.fishes` from the
      *scene*, and `location.reload()` fires `beforeunload` → `syncSave()`, so
      the just-downloaded fish were overwritten by the stale scene's fish and
      could then be uploaded over the other device's. Restores now freeze that
      rebuild (`Game.freezeForRestore`)
- [x] **The first version of that fix was also wrong**, and the same run caught
      it: freezing *all* of `syncSave()` also froze `persist()`, which is the
      only thing that writes the restored save to disk — so the reload read the
      old save back and the restore vanished. The freeze now stops the
      scene-derived rebuild and the cloud write, never the local write

### Cloud save — B → A, and the timeout that hid it (2026-08-08)
- [x] **Device B → device A is proven.** Collected an income pot on B
      (145 → 228 coins), backgrounded it, cold-started A: the chooser appeared
      with both sides real (cloud 228 / this device 145), and picking the cloud
      side left A on 228 coins with all 5 fish
- [x] **The startup sync was dying on a 54 ms margin.** B's progress never
      reached A across four attempts. The cause was not the sync logic:
      `ensureUid()` measured **2946 ms** on a cold start against a **3000 ms**
      budget, so whether the sync ran at all was a coin flip. On the losing side
      it returned `disabled` and did nothing — no restore, no chooser, no error.
      Startup sync runs once per session, so a miss was permanent for that launch
- [x] **One timer was doing two jobs.** `AUTH_TIMEOUT_MS` was both "how long may
      the sync take" and "how long may startup wait" — and it was tuned for the
      second, which silently capped the first. Split: the sync now gets a
      generous budget (15 s), while `Game.CLOUD_STARTUP_GRACE_MS` (3 s) caps only
      the wait. Overrun no longer cancels anything — the game opens and
      `handleLateCloudSync()` applies the result when it lands (restore →
      freeze + reload, conflict → chooser)
- [x] Covered by tests (128 total, was 123): late restore persists and reloads,
      a late restore cannot be overwritten by the stale scene, late conflict
      opens the chooser without reloading, late `in-sync` leaves the game alone.
      Mutation-checked — dropping the freeze from the late path fails 2 of them
- [ ] Not verified on device: the *late* branch itself. The fixed build resolved
      auth inside the 3 s grace, so the conflict came through the normal path.
      The late path is only covered by tests so far

### Cloud save — phase 1: storage pipeline (2026-08-07)
- [x] Shared Firebase app and identity seam (`src/firebase-app.ts`) — the rest
      of the game only ever sees `ensureUid()`, so swapping anonymous for a
      permanent provider touched nothing else
- [x] `CloudSave` (`src/cloud-save.ts`) — `saves/{uid}`, throttled uploads,
      forced write when the app is backgrounded
- [x] Monotonic `rev` instead of device timestamps, enforced in
      `firestore.rules` so a stale client cannot overwrite newer progress
- [x] Entitlements (`adsRemoved`) stripped from the payload and re-derived
      locally — otherwise sharing a save would hand out the ad-free version
- [x] Cloud payloads go through the same `migrate()` gate as local saves
- [x] Fixed a deadlock: `setDoc()` never settles while offline, which left the
      upload flag stuck and killed cloud save for the whole session

### Cloud save — phase 2: permanent accounts (2026-08-07)
- [x] `@capacitor-firebase/authentication` with `skipNativeAuth: true` — the
      data layer is the JS SDK, and the default would have signed in only the
      native SDK while Firestore kept writing as the old anonymous user
- [x] `linkWithGoogle()` handles `auth/credential-already-in-use` by switching
      to that account instead of swallowing the error and stranding progress
- [x] Settings row + conflict chooser; the chooser also runs at startup, ahead
      of the welcome and tutorial flow
- [x] `resetForNewAccount()` — the `rev` counter lives on the device and
      belonged to the previous account
- [x] Player document moved after the cloud sync (`publishPlayer`): a restore
      can change `friendCode`, so writing it earlier split the player's own code
      from the one their friends see
- [x] Firebase config: Android app registered, three SHA-1s (app signing,
      upload, debug), Google provider enabled, `google-services.json` in place

### Cloud save — end-to-end verification on a real account (2026-08-07)
- [x] Linking works: Settings → Link → account picker → `Linked: <account>`
- [x] Data reaches Firestore: `saves/{uid}` with the payload as a string,
      `rev` incrementing, `schemaVersion`, a `summary` matching the HUD and a
      server-side `updatedAt`
- [x] Entitlement stripping holds — `adsRemoved` is absent from the stored
      payload, so a restored save can never hand out the ad-free version
- [x] Conflict screen renders with real figures on both sides and the relative
      time is correct; picking a side works and the unpicked save survives
- [x] Two bugs found and fixed that made the feature unusable — see
      `fix(auth): oturumu her açılışta kaybeden iki hatayı düzelt`. Neither was
      reachable without a real account, which is why they survived the earlier
      "everything is wired" pass:
      - Credential Manager only returns accounts that already authorized *this
        app*, so the picker never opened on a first sign-in
      - `signInAnonymously()` ran before Firebase restored the persisted
        session, minting a fresh anonymous user on every launch and orphaning
        the linked account

### Ads (2026-08-07)
- [x] Interstitial cooldown raised 3 → 10 min; app-open trigger added
- [x] Cleaning ad reworked: once per fresh launch, on a random one of the dirt
      spots present at startup. The previous "last spot in the tank" condition
      re-fired all session because dirt keeps respawning. Verified on the
      emulator, including that newly spawned dirt does not re-trigger it —
      the check was deliberately made after the 10-minute ad cooldown expired,
      otherwise the cooldown itself would have hidden the result
