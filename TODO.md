# Roadmap

## Pending

### Cloud save — leftovers after the end-to-end run

The main flow is verified on a real account (see Done). What is left:

- [ ] **Cross-device restore has not been proven.** Everything was tested on a
      single emulator, so "cloud → this device" was always the *same* device.
      Play on device A while linked, then link the same account on device B and
      confirm B picks up A's progress.
- [ ] **Conflict screen may be noisy on a fresh install.** It shows up even
      when the local save is an untouched default, because the save counts as
      "changed" a few seconds after entering the game and the code never picks
      a side on its own. Consider a fast path: if the local save is still the
      default, restore from the cloud directly instead of asking.
- [ ] **Orphaned anonymous users.** The auth bug below created a new anonymous
      user on every launch, so `saves/` has a few stray documents. Harmless,
      but worth clearing out before launch so the collection is not misleading.

### Cloud save — remaining platforms

Cloud save currently exists **only in reefy**. The shared design (Firestore
`saves/{uid}`, monotonic `rev` instead of device clocks, no automatic merging,
entitlements never restored from the cloud) is meant to be reused.

- [ ] **Çengel Bulmaca** — reuses the existing Firebase project and the lazy
      auth setup in `src/referral.ts`. Extra work: the save is spread across
      ~13 `cengel-` prefixed localStorage keys (one per puzzle, one per hint
      day) and has to be collected through an allowlist; date-keyed entries
      need pruning or the document grows forever.
- [ ] **Little Grand Hotel** — highest effort. Godot has no official Firebase
      SDK, so Firestore has to be reached over REST with `HTTPRequest`. Play
      Games Saved Games was ruled out because it is Android-only and would not
      survive an iOS release. Its `_validate_save_dict()` is already hardened by
      the fuzzer, so cloud payloads get validation for free.

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
