# Roadmap

## Where to pick up

1.2.0 went out to closed testing on 2026-08-22 and is live on a real handset.
That release carries the rebuilt aquarium screen, five scene bugs, the global
ranking, and the ad recovery — and it closed the two questions that had been
open for weeks, both read off the diagnostic line under the version in
Settings: `store: TRY` (Play does fill `currencyCode` for this app) with no
`ads:` error after it (the ad SDK now initialises).

The one that was NOT known before today: **ads were dead in production**, and
silently. The consent step failed with "Publisher misconfiguration — no
form(s) configured for the input app ID" because no UMP privacy message
existed for Reefy in AdMob, and the old code treated any consent failure as
permanent for the session. Both halves are fixed: the message is published,
and setup now retries when the player actually asks for an ad. Do not
re-introduce a silent `catch` there.

**master is well ahead of the shipped 1.2.0, and the gap is now worth a
release.** Nothing below is on any device. In the order it landed: the smoke
run's selectors (`48fc01a`), the top block's width on wide viewports
(`a233076`), and then on 2026-08-24 the two handset-only layout defects, the
`ads: test` / `ads: live` diagnostic, the demo workflow's action versions and
the README. **Built and signed as 1.2.1 / versionCode 8 on 2026-08-24**,
waiting to be uploaded to the alpha closed-test track. The certificate fix is
NOT what makes this release necessary — that fix is entirely server-side (see
the certificate item) — but the layout fixes only reach a phone through a
build, and the phone has to be reinstalled from the track anyway to test
sign-in.

Two Playwright runs guard the parts unit tests cannot reach. Neither is part of
`npm test` and both need a dev server on port 5173:

- `npm run smoke` walks the real UI. It had been silently reaching for the
  vertical rail the care bar replaced, so it failed on its first click and
  covered nothing — run it after any HUD change; that is what it is for.
- `npm run layout:check` loads the top row and the sheets in their widest state
  at 1080x2340 and asserts nothing is clipped by the navigation bar or pushed
  off an edge. Both defects it checks for were invisible on a desktop browser
  and obvious on a handset.

**The handset no longer has the Play build on it** (2026-08-23). To test ads
without being served live ones, the phone was moved to a locally built release
APK — same version, signed with the upload key rather than Play's, which is why
it had to be uninstalled first rather than updated in place. Consequences worth
knowing before reading anything off that phone: it gets no Play track updates,
Play Billing does not resolve, so Settings reads `store: —` instead of
`store: TRY`, and — **since 2026-08-24 this is the other way round** — Google
sign-in is the thing that now works on a Play build and not on that local one,
because the single Play Games credential names the app-signing key rather than
the upload key it used to. `adb install -r` from Play to local, or back, will
always fail with INSTALL_FAILED_UPDATE_INCOMPATIBLE — reinstall from the
closed-test track to get the Play build back, which is now the only way to test
anything about accounts.

The save on that phone did not survive intact. `adb backup`/`adb restore`
carried it across the uninstall, but restored an older snapshot than the one
taken: 986 coins, 7 pearls and a 3-day streak came back as 300 / 5 / day 1, with
the onboarding replaying. Local saves are still the only copy — cloud save
cannot be connected on any Play build for the same certificate reason — so treat
that phone's progress as expendable until sign-in works.

What is left needs decisions or accounts rather than code. In the owner's
stated order: a promo video (nobody but the owner can shoot it), and then the
one question that covers both that video and the README's missing screenshots —
whether this public repo takes an image and a clip as a deliberate exception to
the asset rule in CLAUDE.md, or whether they are hosted outside it and linked.
The README refresh itself is done. iOS stays parked until the owner asks for it.

The Coral Festival's first run started 2026-08-24 and ends 2026-08-28, so the
tier measurement below cannot be taken yet — `npm run event:dump` needs players
to have played, and a service-account key.

**The rebuilt store listing is uploaded** (2026-08-26). New plates, new feature
graphics and new copy went up for both languages: tr-TR published the same day,
en-US is in review. See "Store listing is now stale" below for what each
language carries and what is still empty.

## Pending

### No OAuth client carries the Play app-signing key — sign-in is dead on Play builds

Found on the handset 2026-08-23, and it is the reason the ranking has never had
a score in it. Google sign-in — both the Play Games account and cloud save —
fails **silently on every build installed from Play**, because the OAuth clients
registered for `com.yilkgames.reefy` do not include the certificate Play signs
the app with.

The three Android clients in `android/app/google-services.json` carry
`c9690f21…`, `99e821da…` and `38374df2…`. That last one is the **upload** key
(`android/reefy-release.keystore`), not the app-signing key — an earlier note
had these backwards. The APK Play actually delivered to the phone
(`adb pull` of `base.apk`, then `apksigner verify --print-certs`) is signed with

    SHA-1 8A:C0:B7:C8:81:C8:F8:EC:8F:05:9A:29:7D:88:C7:07:84:ED:30:D5

which appears in no client. The proof is a matched pair on one handset: on the
Play-installed 1.2.0, tapping Settings > Hesap > "Giriş yap" opens and closes
`GamesResolutionActivity`/`SignInActivity` with nothing shown and the button
unchanged (logcat: `getToken() -> BAD_AUTHENTICATION … games.firstparty`); on a
locally built APK signed with the upload key, the same tap brings up the real
"Play Games profili oluşturun" sheet.

- [x] **Registered, bound and published (2026-08-24).** Three steps, all done:
      the SHA-1 was added to the Firebase Android app, which made Google create
      the Android OAuth client `778208134304-hm2mjkb4cchfb5imskcoi5f84usrb59b`
      carrying it; `android/app/google-services.json` was regenerated from
      `firebase apps:sdkconfig` (not a console download) so the new client is in
      the repo; and the Play Games Services Android credential — which turned
      out to be bound to the **upload** key client
      (`…q3q974hifqr49e7mqv216pp6glpm5bpg`, fingerprint `38:37:4D:F2…`) — was
      repointed at the new one and published. Play's own page confirmed the
      fingerprint reads `8A:C0:B7:C8:81:C8:F8:EC:8F:05:9A:29:7D:88:C7:07:84:ED:30:D5`
      before saving.
      Two consequences to know:
      - **All of it is server-side; none of it needs a new build.** An earlier
        note here said the Firebase half had to ship in an AAB. It does not:
        only the WEB client (`…33oiprsk…`, client_type 3) reaches the app, as
        `default_web_client_id` in
        `android/app/build/generated/res/processReleaseGoogleServices/values/values.xml`.
        The Android client entries in `google-services.json` are never compiled
        in — Google resolves package name plus signing certificate on its own
        side. So the updated `google-services.json` in this repo is bookkeeping,
        and **the already-shipped 1.2.0 on the track should now be able to sign
        in** once the Play Games publish propagates (a few hours).
      - **Sideloaded APKs signed with the upload key can no longer sign in.**
        There is exactly one Android credential and it now names the app-signing
        key. That is deliberate — the case that matters is the one players get —
        but it means the sign-in test has to happen on a build installed from the
        closed-test track, which is what this item always said anyway. If local
        sign-in testing is wanted back, add a SECOND Android credential for the
        upload key and leave it non-primary; it was not added on purpose.
- [ ] **Then sign in once from Settings > Hesap** and open Social > Global
      ranking. That is what starts scores reaching the board; `submitPlayScore`
      is called from syncSave but does nothing while signed out.
      Needs the phone reinstalled from the closed-test track — it is currently
      on a local upload-key APK, which is now the case that cannot sign in. A
      new AAB is NOT required for this test (see above); 1.2.1 is worth
      installing anyway because it is the build that carries the layout fixes.
- [ ] **Not verified.** Everything above is configuration; nothing has actually
      signed in yet. Until a Play build does, "fixed" means "the certificate the
      APK is signed with now appears in a client the credential names", not
      "sign-in works".
- [ ] **The handset's Google account has no Play Games profile yet.** The sheet
      offers to CREATE one; creating a profile on someone's Google account is
      theirs to do, so the test stops there until the owner taps it.

### Play Games says "Firebase bağlı değil"

- [ ] Noticed 2026-08-24 on the Play Games Services configuration page, beside
      "Kaydedilmiş oyunlar etkin değil". Neither is needed for sign-in or for the
      leaderboard, and cloud save here is Firestore's own, not Play's saved
      games — so this is a note, not a defect. Worth revisiting only if Play's
      saved-games or its Firebase integration ever becomes wanted.

### The test-device id in `.env.local` was the wrong device

- [x] **Corrected 2026-08-23.** The id that had been sitting in `.env.local`
      belonged to no device the SDK recognised, so `initializeForTesting` had no
      effect and the handset was served a real ad — confirmed the hard way, by
      a live rewarded ad playing on it. Nothing was tapped inside it, and an
      impression alone is not what gets an account suspended; a click is.
      The id AdMob actually wants is printed by the SDK on every ad request:

          adb logcat -s Ads | grep setTestDeviceIds

      With the right one in `.env.local` the same tap now shows the "Test
      Reklamı" plate and logcat says `This request is sent from a test device.`

- [ ] **Any build that reaches the phone must be built with that line present.**
      A build made without it serves live ads again. The emulator is safe on its
      own; the SDK treats emulators as test devices.
      **"Play build = live ads" is no longer a safe assumption in either
      direction** (2026-08-24). Releases are built on the developer's machine,
      not by CI, so 1.2.1 carries `.env.local` — which means the Play-track
      build DOES name the test device, and "Watch Ad" on it is safe. It also
      means the leaderboard id is only present because of the same file: with
      `VITE_PLAY_LEADERBOARD_ID` unset the global ranking does not exist at all
      in that build, silently. Do not build a release anywhere `.env.local` is
      missing. Read the diagnostic line rather than reasoning about where the
      build came from.
      **The app now says which it is** (2026-08-24): Settings' diagnostic reads
      `ads: test` when the build names a test device and `ads: live` when it
      does not, in the slot that previously appeared only when there was an
      error. Live ads on a developer's own handset are the one thing on that
      line that can cost the account rather than merely confuse a reader, and it
      was not observable from inside the app at all.
- [x] **The test device is recognised again on 1.2.2** (2026-08-25). logcat
      prints `This request is sent from a test device.` instead of asking for an
      id, and Settings reads `ads: dev 1B1D,BF39`. Ad paths are safe to exercise
      on this build; they were not on 1.2.1.
- [x] **The income cap fix is visible in the wild.** After eight hours away with
      the tank gone fully dirty (-35%), the welcome-back sheet reported
      "Balıkların üretti 40" — a positive number. That is the exact shape that
      used to go negative.
- [x] **Rewarded ads work end to end on a PLAY build** (verified 2026-08-24, on
      1.2.1 installed from the track): the consent step passes, the ad plays,
      the five pearls are granted (5 to 10) and the daily cap ticks down (3 to
      2). This is the first time the UMP fix has been proven anywhere other than
      a sideloaded APK, and it is the thing that was dead in production.
- [ ] **A live ad was served during that test, and the diagnostic said it was
      safe.** The id in `.env.local` was captured on the sideloaded build.
      Reinstalling from Play rotated the app-set id the SDK identifies the
      device by, so the stored id matched nothing and a real advertiser got a
      real impression on the developer's own handset. Nothing was tapped inside
      the ad; it was closed with its own X.
      Two things changed because of it:
      - The correct id for the Play install, `BF39…`, is appended in
        `.env.local` (the variable takes a comma-separated list, so both are
        kept).
      - **The diagnostic no longer claims `ads: test`.** It prints `ads: dev
        1B1D,BF39` — the prefixes this build NAMES — because the SDK never tells
        the app whether it accepted any of them. Compare against
        `adb logcat -s Ads | grep setTestDeviceIds`: if the SDK is still asking
        for an id, the ones listed are stale.
      **Re-capture the id after every reinstall.** That is the rule; the old
      note assumed the id was stable and it is not.
- [ ] **A SECOND live ad followed, and it is the more important one.** An
      interstitial appeared while navigating the panels — no ad button was
      pressed. It is not certain which tap reached it, and that is the finding:
      the interstitial fires by itself when the tank's LAST dirt spot is
      cleared (`countCleanForAd`, once per session) or on a tank switch, and a
      tap on the water can clean dirt. On a build whose test-device id is stale,
      **there is no such thing as a safe tap** — every ad path serves a live
      advertiser. Both ads were closed with their own control (the rewarded
      one's X, the interstitial with the hardware back key); nothing inside
      either was clicked.
      Two impressions on one device is not what gets an account actioned — a
      click is — but it is invalid traffic on your own inventory, and it was
      avoidable.
      **Rule for device testing from now on: do not touch the app until the
      build on the phone is one whose id logcat confirms.** The confirmation is
      the SDK printing `This request is sent from a test device.` instead of
      asking for an id. Testing with the network off is the other safe option:
      no ad can load, and every non-network path is still exercisable.

### Two layout defects the handset shows and the desktop does not

Both seen on a 1080x2340 phone (Android 9, three-button navigation bar), on the
build that already carries `a233076`. **Both fixed on master (2026-08-24), and
neither is on any device yet.**

- [x] **Every sheet's last line sat under the system navigation bar.** The cause
      was `max(12px, env(safe-area-inset-bottom))` on the dock and nothing at all
      on the sheet. `max()` is the wrong operator here: a three-button bar is
      48px against offsets of 12-16px, so it always won and collapsed the gap to
      nothing. Every bottom-pinned element now ADDS `--safe-b` to its own offset,
      and the sheet carries the inset as bottom padding — its surface continues
      behind the bar so nothing shows through, its content stops above it.
- [x] **The top row no longer overflows.** Three separate causes, and the first
      two were invisible until the widths were measured:
      - `.hud-chip { flex: none }` is declared after `.hud-tank`, so the rule
        meant to let the tank chip give up width never applied at all. Both
        elastic rules are id-scoped now.
      - The streak chip's seventh-day tease was a **sentence** — 156px of a
        430px row, more than the tank chip and the level ring together. It is a
        pearl mark now, with the sentence kept as the chip's title; the ladder
        the chip opens already spells it out.
      - `.hud-chip .icon { order: 2 }` was written for the currency chips and
        was also throwing the tank chip's biome mark to the end, after the
        badge. The mark leads in that chip now.
      In its widest state the row still cannot fit one line — 1.3M coins, the
      longest tank name, a growth badge and a streak at once — so `#hud` wraps.
      A second line reads as a full HUD; a tank name truncated to "A." reads as
      breakage.
- [x] **`npm run layout:check` now covers both** (`tools/check-mobile-layout.mjs`).
      It loads that widest state — longest tank name, fully dirty tank so the
      growth badge sits at "-32%", streak on its tease day — at 1080x2340 and
      asserts nothing is clipped or pushed off an edge. The navigation bar is
      simulated by overriding `--safe-b`, which is only possible because every
      bottom offset goes through that one variable; `env(safe-area-inset-bottom)`
      itself cannot be set from a page. `--report` prints the measured chip
      widths, `--nav=` sets the bar height, `--shots=DIR` writes screenshots.
      Like the smoke run it needs a dev server and is not part of `npm test`.

### Before production — what 2026-08-24's device pass found

Everything below was checked on 1.2.1 installed from the closed-test track.

- [x] Play Games sign-in, cloud save linking and the global leaderboard all
      work. A score reached the board for the first time (95, first place).
- [x] Play Billing resolves: the pearl packs show `₺47,99` and the rest in TRY.
      Settings reads `store: —` until the Pearls tab has been opened once,
      because prices are fetched lazily — the dash is not a failure.
- [x] The Coral Festival is running and scoring (58 points, ends 2026-08-28).
- [x] **The store listing's screenshots are uploaded** (2026-08-26). The plates
      advertising the removed right-edge rail are gone from both languages.
      tr-TR went out as submission 12 and published at 11:23; en-US followed as
      a six-change submission and is in review. Each language carries the eight
      captioned plates on both phone and 7-inch tablet, its own feature graphic
      and the rebuilt short and full description.
- [x] **Measured on 1.2.2 (2026-08-25), and the answer is unambiguous.** The
      diagnostic reads:

          store: TRY · ads: dev 1B1D,BF39 · sa 27/0 · vh 780/780@3

      `sa 27/0` — the TOP inset arrives (27px, the status bar) and the bottom
      arrives as zero. `vh 780/780` — the webview is the full height of the
      screen, so nothing padded it natively either. Both halves of the same
      mechanism, one working and one not: this is not "insets are missing", it
      is Chromium 150 in this WebView mapping the status bar into
      `safe-area-inset-top` and NOT mapping the navigation bar into
      `safe-area-inset-bottom`.
      `@capacitor-community/safe-area` cannot help: its padding fallback only
      runs for Chromium below 140, and this device is on 150, so it correctly
      stands down and hands the job to a Chromium that does not do it.
- [ ] **The fix is a choice between two plugins, and it is not a five-minute
      change.** Capacitor 8 ships its own `SystemBars`, which injects
      `--safe-area-inset-top/right/bottom/left` onto `documentElement`
      (`node_modules/@capacitor/android/.../plugin/SystemBars.java`) — exactly
      the number that is missing. It is switched OFF here by
      `SystemBars: { insetsHandling: 'disable' }` in `capacitor.config.ts`,
      which the community plugin's own README tells you to set so the two do
      not fight.
      Turning it on is a one-line config change plus

          --safe-b: max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px));

      and it would fix this device. The catch is the OTHER case: on a webview
      below 140 the community plugin pads the webview natively AND Capacitor
      would inject a non-zero variable, so the inset lands twice. CSS cannot
      tell those apart — though the `vh` figure in this same diagnostic can,
      because a natively padded webview is shorter than the screen.
      So the real decision is which plugin owns insets, not which line to
      write. **Not worth taking blind before a release**: the defect is
      cosmetic on this handset because the navigation bar is translucent — the
      last line of a sheet is readable under it — and the only thing genuinely
      awkward is the shop's buy buttons sitting in the bar's band.
      **2026-08-25 adds one case that is not ours and not cosmetic**: the
      Google sign-in sheet raised by "Link cloud save" is a system sheet, and
      it inherits this window's layout — its confirm button lands in the
      navigation bar's band. The first tap at the button's centre hit the Home
      key and dropped the app to the launcher instead of signing in. So the
      band swallows a step in account linking, not just a shop button.
- [x] **In-app purchase now runs end to end (2026-08-25) — and it cost
      nothing.** The device's account is on the license-testing list, so the
      Play sheet came up as "Test kartı, her zaman onaylanır · Bu bir test
      siparişidir, sizden ödeme alınmayacaktır". Avuç İnci (₺47,99, 60 pearls)
      was bought twice: 11 → 71 → 131. The second sheet opening is the proof
      that matters — an unconsumed consumable would have been refused with
      "you already own this item", so the consume step works. A cold restart
      afterwards left the balance at 131, not 191: the purchase is not
      re-granted on relaunch. Prices for the whole ladder resolve in TRY
      (₺47,99 / ₺59,99 / ₺119,99 / ₺274,99 / ₺539,99).
- [ ] **The one product still untested is `Reklamları Kaldır` (₺95,99)**, the
      only non-consumable. Buying it even as a test order marks this account as
      owning it permanently, which switches interstitials off on the one handset
      that can test them — undoing it means cancelling the order in Play
      Console. Worth doing deliberately, not in passing.
- [x] **Remove Ads can only be bought once — and now it can be got back
      (2026-08-25).** Two separate things were true: the shop already refuses a
      second purchase (`ui.ts` renders "You own this ✓" disabled once
      `adsRemoved` is set) and Play refuses one anyway, so a double charge was
      never possible. But the entitlement lived ONLY in the local save, and it
      is stripped from every cloud write on purpose, so a reinstall or a new
      phone left a paying player with ads back on, a buyable-looking button,
      and a raw "Purchase failed: …" toast when they pressed it — Play answers
      PRODUCT_ALREADY_PURCHASED and nothing handled that code.
      The store is now the source of truth for it, in three places:
      `IAPProvider.ownsRemoveAds()` runs at startup and grants (never revokes —
      a false answer means "offline" just as easily as "never bought"),
      Settings gained a "Restore purchases" row calling
      `Purchases.restorePurchases()`, and PRODUCT_ALREADY_PURCHASED on the
      remove-ads pack is now a silent restore rather than an error. Ownership
      is read from BOTH the entitlement map and
      `allPurchasedProductIdentifiers`, so a dashboard with no entitlement
      configured still restores. 18 new tests (280 total).
      Still to verify on the handset: it needs a build newer than the 1.2.2
      that is installed there.

### 1.2.2 device pass — 2026-08-25

Same handset (Huawei POT-LX1, Android 10, WebView 150), 1.2.2 (versionCode 9)
from the alpha track. Ads are in test mode on this build, so the paths that
were unsafe to touch on 1.2.1 could finally be exercised.

- [x] **The test device is recognised.** `I/Ads: This request is sent from a
      test device.` — on 1.2.1 the SDK was still asking for the id, and two
      live impressions came from that.
- [x] **Interstitial fires at the intended break** (last dirt spot cleaned) and
      arrives with the "Test Ad" plate.
- [x] **The income-cap fix holds in the field.** After 8 hours away the tank was
      fully dirty (-35%) and the welcome screen still read `+40`, positive —
      exactly the setup that used to report a negative gain.
- [x] **Cloud restore, end to end, from a wiped install.** The device save
      (786 coins / 11 pearls / Mercan the neon tetra / 2-day streak) was pushed
      to the cloud first — verified in `localStorage` through an `adb backup`:
      `reefy-cloud-dirty` flips to `0` with `rev` 192 then 193, which is the
      only proof the write was acknowledged rather than queued. Then
      `pm clear`, relaunch, tutorial, and Settings → Link cloud save.
      Because the tutorial counts as progress the CONFLICT screen came up (not
      the silent fast path) with two genuinely different columns — cloud 786 /
      this device 300 — and picking the cloud restored every field: coins,
      pearls, streak, player name, friend code, the fish and its hunger.
      Worth keeping: a `flush()` triggered by backgrounding did NOT land while
      the app was in the background (rev advanced, dirty stayed 1 — the write
      timed out under Android's throttling); the next foreground sync uploaded
      it. Cloud freshness cannot be assumed from a tab-hide alone.
- [x] **Back button.** In the aquarium it asks once ("Press back again to
      exit"); inside a sheet it closes the sheet and nothing else.
- [x] **Language switch** en ⇄ tr reloads and comes back with the save intact.
- [x] **Egg hatching, decor placement, quest tracking.** Bronze egg → Fantail
      Goldfish (new species, added to the collection); a decor bought, placed,
      and counted by `Arrange`. Daily quests moved with the actions: hatch 1/2,
      decorate 1/2, feed 4/20 — feed only counts when a fish actually eats a
      pellet, not when one is dropped, which is why three taps at a sated tank
      moved nothing.
- [x] **A 4.5-hour background stretch** (the phone slept from 04:40 to 09:03)
      returned with the session intact.
- [x] **Friend code:** a code that does not exist is refused by the Firestore
      lookup. Adding a real friend still needs a second account.

### 1.2.3 cleared review and is on the handset — one check left

Submitted to the alpha track on 2026-08-25: versionCode 10, release name
`10 (1.2.3)`, release notes in tr-TR and en-US, full rollout. The only warning
was the missing deobfuscation file, which R8 being off explains and 1.2.2 had
too. The AAB is at
`android/app/build/outputs/bundle/release/reefy-1.2.3-vc10.aab`. The review
cleared overnight and the phone was updated from the track on 2026-08-26; the
save survived the update intact, unlike the 1.2.2 reinstall.

Two of the three checks are done, on the device, on the Play build:

- [x] **Settings → "Satın alımları geri yükle" on an account that owns
      nothing** answers "Bu hesapta satın alım bulunamadı." Both toasts fire in
      order and the whole exchange is over in under six seconds — the first
      attempt looked like a dead button only because the screenshot came too
      late. The one log line is RevenueCat's expected
      `allowSharingPlayStoreAccount is set to false` warning.
- [x] **Reklamları Kaldır (₺95,99) bought, and interstitials stopped.** The Play
      sheet confirmed it as a test order ("Bu bir test siparişidir") before the
      tap, so it cost nothing; the shop button now reads "Sahipsin ✓". Both
      triggers were then exercised on the device: cleaning the tank to spotless
      (`src/game.ts:1532`) and, after buying Altın Kumsal with in-game coins,
      switching tanks (`src/game.ts:2019`). Neither showed an ad, and logcat
      carries zero AdMob lines — with `adsRemoved` set, `src/ads.ts:199` never
      even preloads one. **This handset can no longer test interstitials**
      until the order is cancelled in Play Console.
- [x] **`pm clear` and relaunch — and it FAILED, which is why 1.2.4 exists.**
      On the wiped install the shop still asked ₺95,99; the Settings button,
      one screen later, restored it. The two paths were asking different
      questions: `ownsRemoveAds` reads `getCustomerInfo`, which describes the
      customer record for this install's RevenueCat app user id, and a reinstall
      gets a new one — empty however many non-consumables the Play account owns.
      `restorePurchases` is what reaches the store, and the log says it plainly:
      nothing at launch, then `Purchase history retrieved productIds:
      [remove_ads], orderId: GPA.3312-4767-0274-32974` on the button. Fixed in
      `src/game.ts` (`restoreEntitlements`), covered by four new cases in
      `src/entitlement-grant.test.ts`. Not re-tested on a device yet — the fix
      is in 1.2.4, which is in review.
      Worth knowing for the retest: the first launch after `pm clear` also hit
      `Scheduling restart of crashed service ... InAppBillingService`, so the
      first reading was thrown away and the check repeated on a healthy launch.
      The cloud half of the row did pass: the save was wiped, no sign-in
      happened, and the entitlement still came back from the store.

Which trigger fires is not left to the device alone any more:
`src/interstitial-guard.test.ts` pins the guard itself (shown, then refused once
`adsRemoved` is set, refused on every later trigger, and not burning the
ten-minute cooldown while refusing) and `src/tank-switch-ad.test.ts` pins the
switch actually asking the provider. They were written because a second tank
costs 2,500 coins and level 3, which put the switch out of reach on a fresh
account — the device pass has since confirmed both, but the pair is what keeps
either from rotting.

### 1.2.4 is in review

Submitted to the alpha track on 2026-08-26: versionCode 11, release name
`11 (1.2.4)`, notes in tr-TR and en-US, full rollout. AAB at
`android/app/build/outputs/bundle/release/reefy-1.2.4-vc11.aab`.

It carries the startup-restore fix above, the HUD rework and the portrait lock.
Two warnings, both understood: the missing deobfuscation file (R8 is off, every
release has had it) and **26 devices dropped** — which is the portrait lock
doing exactly what it was asked to. No phones were lost (12,281 either side);
the losses are TV 6 → 3, Android Auto 25 → 8, tablet 6,633 → 6,627.

When it lands, the retest is the `pm clear` row above, and the HUD is finally
on a device.

### The HUD rework is on master and on no device

Landed 2026-08-26, after 1.2.3 shipped, so **the phone does not have it**: the
level ring is gone from the top row, the streak moved down beside the goal
strip as a `🔥n` chip, and both currency chips grew a `+` that opens the pearl
shelf. The row is `nowrap` now — it used to wrap to a second line, and with the
plus marks added, a dirty tank's `-35%` badge was enough to trigger it. The tank
name truncates instead.

Both orientations are locked to portrait as well (`android:screenOrientation`
and the iOS plist), which is the one change here that cannot be seen without a
build.

To look at the HUD on the handset without touching the installed Play build:
`adb reverse tcp:5173 tcp:5173` with `npm run dev` running, then open
`http://localhost:5173/` in the phone's Chrome. To seed a save from the desktop,
`adb forward tcp:9222 localabstract:chrome_devtools_remote` and drive that
Chrome with Playwright's `chromium.connectOverCDP` — `page.addInitScript` is the
part that matters, since a plain evaluate-then-reload loses to the running
game's own save write.

### Production access — unlocked on 2026-08-25

- [x] The three closed-test conditions are struck through and "Üretime başvur"
      is live on the dashboard (seen 2026-08-25).
- [ ] The screenshot blocker is cleared as of 2026-08-26 — the live listing no
      longer shows the removed right-edge rail. Applying is now a decision, not
      a dependency; the one thing worth waiting for is the en-US review coming
      back, so a reviewer does not land on a half-updated listing.

### Coral Festival — what the first run has to answer

The feature is built and shipped (see Done); what is left is not code. The
first event runs **2026-08-24 to 2026-08-28** and it is the only source of
evidence for whether the numbers are right.

- [ ] **Watch the point totals against the tiers.** The four tiers (150 / 400 /
      900 / 1,800) were sized by estimate, not by measurement. If most players
      finish all four on day two, the event stops being a reason to come back;
      if nobody clears the third, the top tier is decoration.
      The measurement no longer needs writing: `tools/dump-event-points.mjs`
      (`npm run event:dump -- --key <service-account.json>`, add `--csv out.csv`
      for per-player rows) reads every `saves/{uid}` document with the Admin
      SDK, keeps only the saves carrying this event's id, and prints the point
      distribution, the share of players reaching each tier, and how many
      earned a tier without claiming it — that last number points at the claim
      UI rather than at the numbers. A client cannot do this: the Firestore
      rules lock each player to their own save document, which is why the
      script needs a service-account key.
- [ ] **Decide on a remote calendar only after that.** `EVENTS` in
      `src/events.ts` is embedded, so a new festival needs an app update. Moving
      it to Firestore is worth it once the tuning is known — and it brings an
      offline story and an "event vanished mid-run" case that are not worth
      writing against unvalidated numbers.
- [ ] **A second event needs new dates, not a reused id.** The save resets its
      points only when the active event's id differs; shipping the same id with
      new dates would hand returning players their old points.

### Turkish is back — the currency question is answered

- [x] **Google Play does populate `currencyCode` for these products** (verified
      2026-08-22). Settings reads `store: TRY` on a real Turkish Play account,
      on a build installed from the closed-test track. The mocks in
      `src/store-currency.test.ts` were always going to pass; what they could
      not settle was whether the real store fills the field, and it does. The
      language guess therefore has its strongest signal on real devices, not
      just in tests.

### Store listing is now stale

- [x] **Screenshots and copy now exist** (2026-08-20). The earlier captures were
      unusable twice over: 1568x744 desktop landscape, which is outside Play's
      2:1 aspect ratio limit, and taken from a fresh save with two fish and no
      decor. `tools/capture-store-screenshots.mjs` replaces them — it seeds a
      progressed save (full tank, seven placed decor items, a stocked
      collection) and captures twelve 1080x2340 portrait shots against
      `npm run dev`. Listing copy for both en-US and tr-TR, plus the
      recommended eight-shot ordering, is in
      `docs/store-assets-originals/listing-copy.md`. All of it is gitignored
      here and mirrored to the private `Eren-Ozcan/pictures` repo — see
      CLAUDE.md for why.
- [x] **Both languages, captioned, plus a feature graphic** (2026-08-20).
      `npm run store:screens -- --lang=en|tr --captions` writes a raw set per
      language and a captioned variant beside it; `npm run store:feature --
      --lang=en|tr` writes the 1024x500 graphic Play will not publish without.
      The caption goes ABOVE the capture, never over it — the game fills the
      frame edge to edge, so an overlay band buries either the HUD or the
      bottom bar. (The device frame this version drew around the capture is
      gone as of 2026-08-26.) The feature graphic's background is the game
      itself run at 1024x500 with the chrome hidden, with the wordmark on the
      left where the store's play button will not land.
- [x] **Uploaded and submitted for review** (2026-08-20). The listing was
      Turkish-only, so **en-US was added as a new store language** — without a
      localized image set Play serves the default language's images, which would
      have shown an English visitor Turkish screenshots. Each language got its
      own copy, its own eight captioned plates (phone and 7-inch tablet) and its
      own feature graphic; the app name is now `Reefy: Cozy Aquarium` in both.
      The three stale 10-inch tablet shots were removed rather than replaced —
      with phone screenshots present Play needs no separate 10-inch set.
- [x] **The stale-capture breakage is fixed** (2026-08-24). The captures on the
      listing showed the removed right-edge rail because the care bar landed
      after they were taken, and the capture tools had gone stale with the same
      rename and could not be re-run at all — `capture-store-screenshots.mjs`
      timed out on `#siderail button[data-rail="feed"]`, and
      `make-feature-graphic.mjs` was hiding `#hud` and `#siderail` when the
      element to hide is now `#topbar`. Same class of breakage as `48fc01a` — a
      HUD rename silently disabling a Playwright tool — and it is why
      `npm run smoke` and `npm run layout:check` belong in the release routine.

- [x] **The whole set was rebuilt on 2026-08-26**, and not for staleness this
      time. The 2026-08-20 plates were selling the wrong thing. The hero shot
      was a tank at 7 fish of 18 with seven short decor pieces spread at even
      intervals, and its HUD printed `7 hungry`, `7/18` and a red `-21%` dirt
      penalty across the most important frame in the set. At the ~120px a Play
      search result actually gives a card, that reads as an empty blue
      rectangle with complaints on it. Five commits: `cd0d006`, `374ff66`,
      `14f5769`, `de57489`, `4632a08`.

      What changed, and the reasoning is in
      `docs/store-assets-originals/listing-copy.md` rather than repeated here:

      - The seeded save fills the tank — 18 fish (capacity at level 12), all
        fed, 10 decor (`MAX_PLACED`), clean glass, 66/100 collected. The same
        chips now read `all fed`, `18/18` and a green `+35%`.
      - **Fish placement is solved, not scattered.** `Fish`'s constructor
        derives its spawn point from the save's `seed`, so the seeds in `CAST`
        ARE the layout. `tools/fish-layout-seeds.mjs` brute-forces them from a
        target composition and carries both the screenshot's and the feature
        graphic's. Two traps documented in that file: its bounds are
        `swimBounds` (`sandTopY`), not the capture viewport, because the UI has
        not reported its inset when the fish are built; and the hero fires 2.2s
        in, because at 26 * speedMul px/s ten seconds of wandering is a school
        clumped in the middle of the frame.
      - No device frame. The capture is taken at 540x820 — the game area of a
        9:16 plate rather than a phone's aspect ratio — so it runs full-bleed
        under the caption. The game went from ~53% of the plate to ~85%.
      - The caption zone is water, not a band: Coral Cove's own gradient, a
        light ray, a few bubbles, and a last stop that matches the tank's
        surface colour so the join has no seam. The gradient lives on the zone
        rather than the body — on the body its stops spread over the whole
        960px plate and drew a hard line across the join.
      - Real counts in the copy: **100 fish, 80 decor, 25 aquariums.** The old
        text said "dozens of species" and "eighty-odd pieces of decor".
      - The feature graphic hides the chrome BEFORE the game mounts.
        `syncBottomInset` bails on a zero-height bottom bar, so the inset stays
        0 and the sand keeps its natural 96px; hiding it after mount baked in a
        ~120px inset that pushed the sand up to fill half the graphic.
      - Two capture passes in one run, because the set wants two incompatible
        things: pass A is an hour away for the welcome-back summary, pass B is
        nine minutes and `spotless` for clean glass everywhere else. Dirt is
        cleaned by tapping canvas spots, which a script cannot aim at.

- [x] **All of it is uploaded** (2026-08-26). Eight captioned plates per
      language on phone AND 7-inch tablet, both feature graphics, and the four
      text fields. tr-TR went out as submission 12 and published at 11:23;
      en-US followed as a six-change submission and is in review. The en-US
      submission also carried an app-icon change that was already sitting
      unsubmitted before this session.

      An earlier attempt the same day was stopped by the browser, not by a
      decision: the extension lost host permission for `play.google.com`
      mid-session and would not recover. Four things that make the next
      listing pass cheap:

      - A bare console URL opens on Chrome's default account
        (`crazything5341@gmail.com`) and lands on the *create developer
        account* signup form. Do not fill it in. Append
        `?authuser=yilkgamesstudio@gmail.com` to the console URL instead.
      - "Öğe ekle" is a `<button>`, not an `<input type=file>`. Clicking it
        *creates* a real multiple file input on `document.body`, which
        `file_upload` then accepts — and that one input can be reused for every
        subsequent upload into the same slot.
      - Assets land in the library auto-selected, and the slot takes them in
        **reverse** library order, so a single multi-file upload arrives
        backwards. Uploading one file at a time and pressing "Ekle" after each
        is what puts the eight plates in the order `listing-copy.md` specifies.
      - The console's `<input>` fields accept a native value setter plus an
        `input` event, but its `<textarea>`s ignore it and stay empty in the
        Angular model. Use `document.execCommand('insertText')` on a focused
        textarea, or real keystrokes.
      - **"Kaydet" is not always the last step.** The tr-TR save reached review
        and published without anyone pressing "incelemeye gönder"; the en-US
        save an hour later sat in "Henüz incelemeye gönderilmeyen değişiklikler"
        until the button was pressed. Managed publishing is off, so do not
        assume a save is still a draft — check the publishing overview.

- [ ] **The 10-inch tablet set is empty in both languages.** Not a blocker, and
      better than the pre-redesign images that were there; worth filling if a
      tablet audience ever matters.
- [ ] **Nothing here has been A/B tested.** Play's Store Listing Experiments
      need production traffic and the app is in closed testing, so the whole
      rebuild is a considered guess. First experiment once live: screenshot 1,
      one variable, 7+ days.
- [ ] **Captioned plates are 1080x1920 and raw captures are 1080x1640.** The
      plate is 9:16 because only 16:9 or 9:16 shots at 1080 px or more are
      eligible for Play's promotional placements; 1640 is that height minus the
      280px caption zone, which is what lets the capture run edge to edge with
      no letterboxing. Change one and the other has to follow.

### Playable web demo

- [x] **Live since 2026-08-19** — <https://eren-ozcan.github.io/reefy/>, built
      with `VITE_DEMO=1` and deployed from `master` by
      `.github/workflows/demo.yml`. The demo opens in English whatever the
      browser reports, and makes no Firebase request at all (verified against
      the deployed build from both a `tr-TR` and an `en-US` context).
- [x] **The workflow's actions are off the deprecated Node 20 runtime**
      (2026-08-24): checkout v4 to v7, setup-node v4 to v7, configure-pages v5
      to v6, upload-pages-artifact v3 to v5, deploy-pages v4 to v5. Two breaking
      changes were checked and neither applies: checkout's safer
      `pull_request_target` defaults (this workflow runs on `push`) and
      upload-pages-artifact v4 dropping dotfiles from the artifact (`dist/` has
      none — Vite writes `index.html` and `assets/`). `.nvmrc` went 20 to 22 in
      the same pass; Node 20 is past end of life, and 22 is what the machine
      this is developed on runs. Not yet observed green — the first run of it
      happens on the next push.

### Presenting the game — store page, video, repo

None of this is code; all of it is what a stranger sees first. The demo is
live, so for the first time there is something to point a link at.

- [x] **Play Console store listing** — done 2026-08-20 and submitted for
      review, including adding en-US as a store language. See "Store listing is
      now stale" above for what went up and what is still open.
- [ ] **A promo video.** Wanted for both the store listing (Play takes a
      YouTube link) and the repo. Open questions to settle when it is made:
      whether it is a silent screen capture or narrated, and whether it is cut
      from the web demo (easy to capture at any resolution) or from a device
      (what players actually see, including the native store and ad paths the
      demo stubs out).
- [ ] **Put that video in the README.** GitHub does not play an embedded
      YouTube iframe in a README — it strips the markup — so the practical
      form is a thumbnail image linking to the video, or a short muted GIF/MP4
      committed to the repo for autoplay in the page. Decide which when the
      video exists; a GIF long enough to show the loop is easily several MB, so
      it should be a trimmed highlight rather than the whole video. Note the
      tension with the asset rule in CLAUDE.md: store and marketing images stay
      out of this repo. A README clip is a deliberate exception to decide on,
      not an oversight — the alternative is hosting it outside the repo and
      linking to it.
- [x] **README refreshed** (2026-08-24). It opens with what the game is and the
      demo link, then "What you actually do" — the loop in the player's terms,
      where the old feature list was a map of source files. That map survives as
      a "Where things live" table below the build instructions, which is what it
      was always for. Also documented there: the `layout:check` run, why neither
      Playwright run is part of `npm test`, and the UMP privacy message whose
      absence silently killed ads in production.
- [x] **Three images at the top** (2026-08-24). The owner took the exception:
      `docs/readme/*.png` is committed and exempted in `.gitignore`, and CLAUDE.md
      now carries the rule and its limits. They are 270px wide, ~35 KB each, and
      cut from the store screenshot set by `node tools/make-readme-shots.mjs`
      rather than captured separately — so the README cannot drift to a different
      build than the listing. A video or GIF is the same decision and is NOT
      covered by it; ask before committing one.
- [x] **The demo is explained for a visitor first** (2026-08-24). The link is in
      the third line of the file. What the demo leaves out is three plain
      bullets now — no account, no ads or purchases, no Play Games — with the
      `isFirebaseConfigured()` and `createServices()` detail kept but moved out
      of the pitch. Everything below the horizontal rule is for someone
      building it.

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
- [x] **Little Grand Hotel** — this entry was stale (corrected 2026-08-19,
      checked against LGH's own repo/TODO). Google account linking is done and
      has been since 2026-08-08: `cloud_save.gd` calls
      `set_google_id_token_provider(_google_signin.request_id_token)`, backed
      by `src/cloud/google_signin.gd` — a system-browser + PKCE flow
      (RFC 8252/7636) in pure GDScript, no native plugin, one code path for
      Android/iOS/desktop. Proven across two real devices. The SHA-1 blocker
      this entry warned about doesn't apply to that design at all — it's a
      `google-services.json`/native-SDK problem, and the PKCE approach was
      chosen specifically to avoid it (see `docs/cloud-save-setup.md` in that
      repo). An unlink button shipped 2026-08-18 too.

### iOS — parked

Not being worked on. Nothing in this section is picked up until the owner
explicitly asks for iOS; it is kept here only so the requirements are not
rediscovered later.

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
