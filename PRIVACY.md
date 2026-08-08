# Privacy Policy — Reefy

_Last updated: 8 August 2026_

Reefy is published by Yilk Games. This policy describes this game specifically;
the studio-wide policy covering all of our games is at
<https://yilkgames.com/privacy-policy/>.

## Summary

- Your aquarium is stored on your device **and** backed up to our cloud save, so
  it survives reinstalling the app or moving to a new phone.
- To do that, the app creates an **anonymous player ID** for you the first time
  it runs. It is not linked to your name or email unless you choose to sign in.
- Signing in with a Google account is **optional**. It exists so the backup can
  follow you to another device.
- If you use the friends feature, the **display name you choose** and your total
  earnings are visible to anyone you give your friend code to.
- The app displays ads through **Google AdMob**, and offers optional in-app
  purchases through **Google Play**.
- We never ask for your name, phone number, address, or payment card details.

## Player ID and cloud save

The first time you open the game, it signs you in anonymously with Firebase
Authentication (a Google service we use as our backend). This produces a random
player ID. It contains nothing about you: not your name, not your email, not
your phone number.

Your game data is copied to our database (Google Firestore), in a document only
your player ID can read or write. What is copied: your fish and their state,
your tanks and decorations, your coins and pearls, your inventory, your quest
and collection progress, your statistics, and your settings.

Your "remove ads" purchase is deliberately **not** copied to the cloud — it is
re-checked with Google Play on each device instead, so a shared save cannot hand
out the paid version.

Cloud save is part of how the game works and is not something you switch on. If
you would prefer your progress never to leave the device, the app is not able to
offer that today — you can, however, ask us to delete what has been stored (see
"Keeping and deleting your data").

## Linking a Google account

An anonymous player ID lives with the app installation. If you uninstall the
game without linking an account, that ID — and the backup attached to it — can
no longer be reached.

Linking a Google account solves this: it attaches your anonymous ID to that
account, so signing in on a new phone brings your aquarium with you. If you do
this, we receive the email address and display name of the Google account you
picked, from Google's sign-in screen. The app shows the account name back to you
so you can tell which one is linked. We do not use it to email you, and we do
not share it.

You are never required to link an account, and you are never asked for a
password — the sign-in screen is Google's own.

## Friends and the leaderboard

Every player gets a random friend code (for example `REEF-A5NJZ`). To make the
friends list and leaderboard work, we store one small record against that code:
the **display name you set in Settings**, your anonymous player ID, and your
total earnings score.

Please treat this as public to the people you share your code with: anyone who
is signed in and knows a friend code can read the name and score behind it. Your
code cannot be found by browsing — the database refuses to list codes, so it can
only be looked up by someone who already has it — but it is not secret either.
The display name is free text you choose, so avoid putting your real name or
anything private in it if you plan to share your code.

The rest of your save — your fish, your coins, your inventory — is never visible
to friends. Only the name and the score are.

## Ads (Google AdMob)

Reefy is funded by advertising and uses Google AdMob for this:

- **Interstitial ads** are shown occasionally when you finish a task, never in
  the middle of one.
- **Rewarded ads** are optional: you may choose to watch one to earn pearls. If
  you do not watch, no data is shared.

To serve and measure ads, AdMob may collect your device's advertising ID, your
IP address (which gives approximate location), device/operating system
information and ad interaction data. This data goes to Google, not to Reefy
itself, and is subject to Google's
[Privacy Policy](https://policies.google.com/privacy).

In the European Economic Area and the UK, a consent form (Google's User
Messaging Platform) is shown before any ad loads, and your choice there is
respected. Everywhere else, you can manage ad personalization from your device's
system settings (Google Settings → Ads → Opt out of Ads Personalization / Reset
advertising ID).

If you buy the ad-free version, no ads are requested at all.

## Purchases

The game offers optional in-app purchases: currency packs and a one-time "remove
ads" purchase. Payment is handled entirely by **Google Play Billing** — we never
see or store your card details. We use **RevenueCat** to manage and verify these
purchases; it receives purchase data such as the product ID, the purchase date
and an anonymous purchase token.

## Data stored on your device

The same data listed under "Cloud save" is also kept locally, in the app's own
storage, so the game works offline. The local copy is deleted when you uninstall
the app. Deleting the app does **not** delete the cloud copy — see below.

## Keeping and deleting your data

We keep your cloud save for as long as the game is installed and in use, so it
is there when you need it. Uninstalling removes the local copy only.

To have your cloud save and your friend-code record deleted, write to
erenozcaan@hotmail.com from — or telling us — the Google account you linked, or
including your friend code if you never linked one. We will delete it and
confirm. Data held by Google or RevenueCat on our behalf (your advertising ID,
your purchase history) can also be managed from your Google account's privacy
settings.

## Children's privacy

The app does not target a specific age group and is not marketed to children.
Because it asks for no personal information directly, it collects none from
anyone; however, since ads are served through Google AdMob, we recommend that a
user you know to be under 13 use non-personalized ad settings.

## Changes

If this policy changes, the current version will be published in this file, at
<https://yilkgames.com/privacy-policy/>, and on the app's store page.

## Contact

For questions: erenozcaan@hotmail.com
