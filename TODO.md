# Roadmap

## Pending

### Cloud save — leftovers after the end-to-end run

The main flow is verified on a real account (see Done). What is left:

- [ ] **The two-devices-live rev race was never exercised.** Both directions are
      now proven (see Done), but always with the other device idle. Two devices
      writing inside the same window — A at rev 7 while B is still on 5 — is
      still untested.
- [ ] **Orphaned anonymous users.** The auth bug below created a new anonymous
      user on every launch, so `saves/` has a few stray documents. Harmless,
      but worth clearing out before launch so the collection is not misleading.
      The emulator runs added more: a document under a first-pass test account
      on top of the account the final run used.

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
- [ ] **No in-app "delete my cloud save" affordance.** Deletion goes through
      email today, which satisfies Play but is a poor experience — and
      `firestore.rules` denies `delete` on both collections, so honouring such a
      request means doing it from the console

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
