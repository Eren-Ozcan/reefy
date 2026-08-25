// Platform services abstraction layer.
//
// On web/dev, local providers run.
// When packaged with Capacitor, the native counterparts of these interfaces are wired in:
//   - Auth   -> Google Play Games Services / Apple Game Center (wired up, see NativeGameAuth)
//   - IAP    -> Google Play Billing / Apple StoreKit (e.g. via RevenueCat)
//   - Social -> friend code verification and friend scores via Firebase/Firestore
//              (wired up, see FirebaseSocial); leaderboard bots are still simulated
// Game code only uses these interfaces; swapping providers is a one-line change.

import { Capacitor } from '@capacitor/core';
import { CapacitorGameConnect } from 'capacitor-game-connect-8';
import { Purchases, PURCHASES_ERROR_CODE, type PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { deleteDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AdMobAds, StubAds, type AdsProvider } from './ads';
import { ensureUid, firestore } from './firebase-app';
import { isFirebaseConfigured } from './firebase-config';
import { rememberStoreCurrency, t } from './i18n';
import type { SaveData } from './save';

// ---------- Identity / sign-in ----------

export interface PlayerIdentity {
  id: string;
  name: string;
  platform: 'local' | 'play-games' | 'game-center';
}

export interface AuthProvider {
  readonly platformLabel: string;
  current(): PlayerIdentity | null;
  signIn(): Promise<{ ok: boolean; msg: string }>;
}

export class LocalAuth implements AuthProvider {
  readonly platformLabel = t('Guest (local save)');
  constructor(private save: SaveData) {}
  current(): PlayerIdentity {
    return { id: this.save.friendCode, name: this.save.playerName, platform: 'local' };
  }
  signIn(): Promise<{ ok: boolean; msg: string }> {
    return Promise.resolve({
      ok: false,
      msg: t('Google Play Games / Game Center sign-in is enabled in the mobile build. For now your progress is safely stored on this device.'),
    });
  }
}

/**
 * Real sign-in via Apple Game Center (iOS) / Google Play Games (Android) in
 * native (Capacitor) builds. Uses the capacitor-game-connect-8 plugin;
 * the plugin's signIn() API is identical on both platforms, only the label
 * and the PlayerIdentity.platform field differ.
 *
 * Setup notes:
 *   - iOS: the "Game Center" capability must be added to the target app in
 *     Xcode (ios/App/App/App.entitlements already has it added; enabling the
 *     capability from Xcode > Signing & Capabilities wires it into the pbxproj
 *     correctly) and Game Center must be enabled from the App Store Connect >
 *     Features tab.
 *   - Android: the game_services_project_id placeholder in
 *     android/app/src/main/res/values/strings.xml must be replaced with the
 *     real project ID from Play Console > Play Games Services; otherwise
 *     signIn() fails.
 *
 * Never selected on web; createServices() picks based on platform.
 */
export class NativeGameAuth implements AuthProvider {
  readonly platformLabel: string;
  private readonly platform: 'game-center' | 'play-games';
  private identity: PlayerIdentity | null = null;

  constructor(private save: SaveData) {
    this.platform = Capacitor.getPlatform() === 'ios' ? 'game-center' : 'play-games';
    this.platformLabel = this.platform === 'game-center' ? 'Game Center' : 'Play Games';
  }

  current(): PlayerIdentity | null {
    return this.identity;
  }

  async signIn(): Promise<{ ok: boolean; msg: string }> {
    try {
      const res = await CapacitorGameConnect.signIn();
      this.identity = { id: res.player_id, name: res.player_name, platform: this.platform };
      // Sync in-game name/identity with the native player name (local value stays as fallback).
      this.save.playerName = res.player_name || this.save.playerName;
      return { ok: true, msg: t('Signed in to {platform}: {name} 🎮', { platform: this.platformLabel, name: res.player_name }) };
    } catch {
      return { ok: false, msg: t('{platform} sign-in failed. Check whether your account is signed in on this device.', { platform: this.platformLabel }) };
    }
  }
}

/** Game-platform sign-in is only available when running in a native (Capacitor) environment (iOS or Android). */
export function isNativeGameAuthAvailable(): boolean {
  return Capacitor.isNativePlatform() && (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android');
}

// ---------- Micro-transactions ----------

export interface IAPPack {
  id: string;
  name: string;
  pearls: number;
  coins?: number;
  bonus: string;
  /**
   * FALLBACK label shown when the store can't be reached. The real price is
   * fetched from the store via IAPProvider.loadPrices() and reflects the
   * player's country/currency; the value here is only shown in the web
   * preview and when the store doesn't respond.
   */
  priceLabel: string;
  emoji: string;
  removesAds?: boolean; // if true, grants a permanent "remove ads" entitlement instead of pearls/coins
}

// Note: ids use underscores (hyphens aren't supported), matching Play Console's
// "one-time product" id restriction — these ids must match the store product
// ids in RevenueCat/Play Billing exactly.
export const IAP_PACKS: IAPPack[] = [
  { id: 'pearls_s',  name: 'Handful of Pearls',  pearls: 60,   bonus: '',            priceLabel: '$2.99',  emoji: '🫧' },
  { id: 'pearls_m',  name: 'Pouch of Pearls',    pearls: 170,  bonus: '+15% bonus',  priceLabel: '$6.99',  emoji: '👛' },
  { id: 'pearls_l',  name: 'Chest of Pearls',    pearls: 450,  bonus: '+25% bonus',  priceLabel: '$14.99', emoji: '🧰' },
  { id: 'pearls_xl', name: 'Treasure of Pearls', pearls: 1000, bonus: '+40% bonus',  priceLabel: '$29.99', emoji: '💎' },
  { id: 'starter',   name: 'Starter Pack',       pearls: 80, coins: 5000, bonus: '+5,000 coins', priceLabel: '$3.99', emoji: '🎁' },
  { id: 'remove_ads', name: 'Remove Ads', pearls: 0, bonus: 'Permanently removes interstitial ads', priceLabel: '$5.99', emoji: '🚫', removesAds: true },
];

export interface IAPProvider {
  packs(): IAPPack[];
  /**
   * Fetches localized prices from the store. On success, packs() then returns
   * prices in the player's own currency (₺, €, ₹ — whatever Play/App Store
   * reports). If not called, or if the store can't be reached, the fallback
   * label in IAP_PACKS keeps showing; the price is never shown blank.
   */
  loadPrices(): Promise<void>;
  /** Purchase flow. Returns an info message on web; connects to the store in native builds. */
  purchase(packId: string): Promise<{ ok: boolean; msg: string; grantPearls?: number; grantCoins?: number; grantRemovesAds?: boolean }>;
  /**
   * Asks the STORE whether this account already owns the remove-ads product.
   *
   * `adsRemoved` lives in the local save and is deliberately never copied
   * through the cloud (see cloud-save.ts ENTITLEMENT_KEYS) — an entitlement
   * that travels in a save file is an entitlement anyone can hand themselves
   * by editing one. That leaves exactly one honest source for it: the store.
   * Without this call a player who reinstalls loses what they paid for, and
   * cannot buy it back either, because Play refuses to sell a non-consumable
   * twice.
   *
   * Answers false on any failure (offline, store not ready). The caller must
   * therefore only ever GRANT on true, never revoke on false.
   */
  ownsRemoveAds(): Promise<boolean>;
  /**
   * The explicit "Restore purchases" the player can press. Same question as
   * ownsRemoveAds(), but it forces the store to re-read the account rather
   * than accepting a cached answer, and it reports back in words because a
   * button that silently does nothing reads as broken.
   */
  restore(): Promise<{ ok: boolean; ownsRemoveAds: boolean; msg: string }>;
  readonly storeLabel: string;
}

export class StubIAP implements IAPProvider {
  readonly storeLabel = t('Web preview');
  packs(): IAPPack[] { return IAP_PACKS; }
  loadPrices(): Promise<void> { return Promise.resolve(); }
  purchase(): Promise<{ ok: boolean; msg: string }> {
    return Promise.resolve({
      ok: false,
      msg: t('Real purchases are enabled in the Google Play / App Store build. In this preview, use quests and level rewards to earn pearls.'),
    });
  }
  ownsRemoveAds(): Promise<boolean> { return Promise.resolve(false); }
  restore(): Promise<{ ok: boolean; ownsRemoveAds: boolean; msg: string }> {
    return Promise.resolve({
      ok: false,
      ownsRemoveAds: false,
      msg: t('Real purchases are enabled in the Google Play / App Store build. In this preview, use quests and level rewards to earn pearls.'),
    });
  }
}

/**
 * RevenueCat API keys (public SDK keys — like a Stripe publishable key, it's
 * safe to embed on the client and isn't a secret that needs to be hidden).
 * Obtained from RevenueCat dashboard > Project Settings > API Keys.
 * While unfilled (still a placeholder value), RevenueCatIAP.configure() is
 * skipped and purchase attempts return a "couldn't connect to store" error.
 */
const REVENUECAT_API_KEYS: { android: string; ios: string } = {
  android: 'goog_lRHfCAmAuwPZrEvwJtzktoNWCWy',
  ios: 'REPLACE_WITH_REVENUECAT_APPLE_API_KEY',
};

/** Only the key for the currently running platform needs to be filled in — Android
 * and iOS activate independently of each other, one waiting doesn't block the other. */
function isRevenueCatConfigured(): boolean {
  const key = Capacitor.getPlatform() === 'ios' ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
  return !key.startsWith('REPLACE_');
}

/**
 * Real Google Play Billing / Apple StoreKit purchase flow via RevenueCat in
 * native (Capacitor) builds. IAP_PACKS.id values must match the package
 * identifiers of the "current offering" defined in the RevenueCat dashboard exactly.
 *
 * Setup notes:
 *   - Create a project in RevenueCat, define the Google Play / App Store Connect
 *     products (pearls-s, pearls-m, pearls-l, pearls-xl, starter), and bundle
 *     them under an "offering".
 *   - Replace the placeholders in REVENUECAT_API_KEYS with the real public API
 *     keys from the RevenueCat dashboard.
 *   - grantPearls/grantCoins amounts are read directly from IAP_PACKS, not from
 *     RevenueCat; so the amount granted for real money always stays under
 *     control in this file.
 */
export class RevenueCatIAP implements IAPProvider {
  readonly storeLabel: string;
  private configured = false;
  private appUserId: string | null = null;
  private offeringsPromise: ReturnType<typeof Purchases.getOfferings> | null = null;
  /** packId -> localized price text as given by the store (e.g. "₺39,99", "$2.99") */
  private livePrices: Record<string, string> = {};

  constructor(appUserId: string) {
    this.storeLabel = Capacitor.getPlatform() === 'ios' ? 'App Store' : 'Google Play';
    if (!isRevenueCatConfigured()) return;
    this.appUserId = appUserId;
    void this.ensureConfigured();
  }

  /** If configure() rejects at cold start (bad key, no network, plugin not
   * ready), `configured` must not stay false forever and lock out purchases —
   * it's silently retried on the next purchase()/loadPrices() call instead. */
  private async ensureConfigured(): Promise<void> {
    if (this.configured || !this.appUserId) return;
    try {
      const apiKey = Capacitor.getPlatform() === 'ios' ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
      await Purchases.configure({ apiKey, appUserID: this.appUserId });
      this.configured = true;
    } catch {
      /* connection failed — configured stays false, retried on the next call */
    }
  }

  /**
   * Uses the store's price if one came in. Amounts (pearls/coins) intentionally
   * stay in IAP_PACKS — only the PRICE is taken from the store, the granted
   * amount never comes from outside.
   */
  packs(): IAPPack[] {
    return IAP_PACKS.map((p) => {
      const live = this.livePrices[p.id];
      return live ? { ...p, priceLabel: live } : p;
    });
  }

  /** Does not cache a failed getOfferings() call forever — resets on rejection
   * so the next call (e.g. once connectivity returns) retries. */
  private getOfferings(): ReturnType<typeof Purchases.getOfferings> {
    this.offeringsPromise ??= Purchases.getOfferings().catch((err) => {
      this.offeringsPromise = null;
      throw err;
    });
    return this.offeringsPromise;
  }

  async loadPrices(): Promise<void> {
    if (!this.configured) await this.ensureConfigured();
    if (!this.configured) return;
    try {
      const current = (await this.getOfferings()).current;
      if (!current) return;
      for (const pkg of current.availablePackages) {
        const price = pkg.product?.priceString;
        if (price) this.livePrices[pkg.identifier] = price;
        // The billing currency is the closest observable stand-in for the
        // store ACCOUNT's country, which decides the language on the next
        // launch (see i18n.ts detectLang). It arrives far too late to affect
        // this session's first frame, which is why it is only recorded.
        const currency = pkg.product?.currencyCode;
        if (currency) rememberStoreCurrency(currency);
      }
    } catch {
      /* couldn't fetch prices — fallback labels stay, the store still opens */
    }
  }

  private async findStorePackage(packId: string): Promise<PurchasesPackage | null> {
    const offerings = await this.getOfferings();
    const current = offerings.current;
    if (!current) return null;
    return current.availablePackages.find((p) => p.identifier === packId) ?? null;
  }

  async purchase(packId: string): Promise<{ ok: boolean; msg: string; grantPearls?: number; grantCoins?: number; grantRemovesAds?: boolean }> {
    const pack = IAP_PACKS.find((p) => p.id === packId);
    if (!pack) return { ok: false, msg: t('Unknown pack.') };
    if (!this.configured) await this.ensureConfigured();
    if (!this.configured) {
      return { ok: false, msg: t("{store} connection isn't set up yet. Please try again later.", { store: this.storeLabel }) };
    }
    try {
      const storePackage = await this.findStorePackage(packId);
      if (!storePackage) {
        return { ok: false, msg: t("This pack isn't currently available in the store.") };
      }
      await Purchases.purchasePackage({ aPackage: storePackage });
      return {
        ok: true,
        msg: t('{name} purchased! 🎉', { name: t(pack.name) }),
        grantPearls: pack.pearls,
        grantCoins: pack.coins,
        grantRemovesAds: pack.removesAds,
      };
    } catch (err) {
      const rcError = err as { code?: PURCHASES_ERROR_CODE; message?: string };
      if (rcError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { ok: false, msg: t('Purchase canceled.') };
      }
      // "You already own this" is the store's answer to the ONE product that
      // can only be bought once, and it is not a failure — it means the
      // player paid before and this device simply did not know. Reporting it
      // as an error would leave them staring at a raw store message with no
      // way forward, which is the exact dead end a reinstall creates. Grant
      // instead: the store just confirmed the purchase exists.
      if (rcError.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
        return pack.removesAds
          ? { ok: true, msg: t('You already own this — restored. ✓'), grantRemovesAds: true }
          : { ok: false, msg: t('Purchase failed: {err}', { err: rcError.message ?? t('unknown error') }) };
      }
      return { ok: false, msg: t('Purchase failed: {err}', { err: rcError.message ?? t('unknown error') }) };
    }
  }

  /**
   * The remove-ads product's STORE id. It is read from the offering rather
   * than assumed, because the package identifier (what IAP_PACKS uses) and
   * the Play/App Store product id are two different strings that only happen
   * to match today; hard-coding the assumption would fail silently the first
   * time they diverge. Falls back to the pack id when the offering cannot be
   * read, which is better than giving up on the check entirely.
   */
  private async removeAdsProductId(): Promise<string> {
    const pack = IAP_PACKS.find((p) => p.removesAds);
    const fallback = pack?.id ?? 'remove_ads';
    try {
      const storePackage = pack ? await this.findStorePackage(pack.id) : null;
      return storePackage?.product?.identifier ?? fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Both halves of the same question, because RevenueCat can answer it two
   * ways and only one of them is guaranteed to be configured: an ENTITLEMENT
   * exists only if someone mapped the product to one in the dashboard, while
   * the purchased-product list is filled in by the SDK itself. Checking both
   * means a dashboard that was never given an entitlement still restores.
   */
  private async ownsRemoveAdsFrom(info: {
    entitlements?: { active?: Record<string, unknown> };
    allPurchasedProductIdentifiers?: string[];
  }): Promise<boolean> {
    if (Object.keys(info.entitlements?.active ?? {}).length > 0) return true;
    const productId = await this.removeAdsProductId();
    return (info.allPurchasedProductIdentifiers ?? []).includes(productId);
  }

  async ownsRemoveAds(): Promise<boolean> {
    if (!this.configured) await this.ensureConfigured();
    if (!this.configured) return false;
    try {
      const { customerInfo } = await Purchases.getCustomerInfo();
      return await this.ownsRemoveAdsFrom(customerInfo);
    } catch {
      return false; // offline or store not ready — never revoke on a failed read
    }
  }

  async restore(): Promise<{ ok: boolean; ownsRemoveAds: boolean; msg: string }> {
    if (!this.configured) await this.ensureConfigured();
    if (!this.configured) {
      return {
        ok: false,
        ownsRemoveAds: false,
        msg: t("{store} connection isn't set up yet. Please try again later.", { store: this.storeLabel }),
      };
    }
    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const owns = await this.ownsRemoveAdsFrom(customerInfo);
      return {
        ok: true,
        ownsRemoveAds: owns,
        msg: owns ? t('Purchases restored. ✓') : t('No purchases found on this account.'),
      };
    } catch (err) {
      const rcError = err as { message?: string };
      return {
        ok: false,
        ownsRemoveAds: false,
        msg: t("Couldn't restore: {err}", { err: rcError.message ?? t('unknown error') }),
      };
    }
  }
}

// ---------- Play Games leaderboard ----------

/**
 * The Play Games leaderboard this game submits to.
 *
 * Ranking lives with Google rather than in Firestore on purpose. The score is
 * computed on the device, so a leaderboard we host can be written to by anyone
 * who can write as themselves — the Firestore rules can cap a number but cannot
 * make it true, and verifying it properly needs Cloud Functions the project
 * does not have. Play Games already owns the account, the ranking and the abuse
 * handling, and the dependency and manifest entry were half-wired for it
 * already.
 *
 * The id is minted by Play Console when the leaderboard is created there, so it
 * comes from the environment: with it unset the game behaves exactly as before,
 * which is also what happens on the web build and on iOS.
 */
const PLAY_LEADERBOARD_ID: string = (import.meta.env.VITE_PLAY_LEADERBOARD_ID ?? '').trim();

/** Whether a Play Games leaderboard can be shown at all in this build. */
export function isPlayLeaderboardAvailable(): boolean {
  return !!PLAY_LEADERBOARD_ID && Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
}

/**
 * Submits the player's total earnings to Play Games, at most once a minute and
 * only when it changed — the same restraint the Firestore write uses, for the
 * same reason: syncSave runs far more often than the number moves.
 *
 * Failures are swallowed. A player who never signed in to Play Games, or
 * declined, must not see an error for something they did not ask for.
 */
let lastPlaySubmit = { at: 0, score: -1 };

export function submitPlayScore(save: SaveData): void {
  if (!isPlayLeaderboardAvailable()) return;
  const score = Math.max(0, Math.round(save.stats.totalEarned));
  const now = Date.now();
  if (score === lastPlaySubmit.score || now - lastPlaySubmit.at < 60_000) return;
  lastPlaySubmit = { at: now, score };
  void CapacitorGameConnect.submitScore({ leaderboardID: PLAY_LEADERBOARD_ID, totalScoreAmount: score })
    .catch(() => { /* not signed in, or offline — the next change tries again */ });
}

/** Opens the native Play Games leaderboard view. */
export async function showPlayLeaderboard(): Promise<{ ok: boolean; msg: string }> {
  if (!isPlayLeaderboardAvailable()) return { ok: false, msg: t('The global leaderboard is only available in the Google Play build.') };
  try {
    await CapacitorGameConnect.showLeaderboard({ leaderboardID: PLAY_LEADERBOARD_ID });
    return { ok: true, msg: '' };
  } catch {
    return { ok: false, msg: t('Sign in to Google Play Games first, from Settings.') };
  }
}

// ---------- Social: friends + leaderboard ----------

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;   // total earnings
  isPlayer: boolean;
  isBot: boolean;
}

export interface SocialProvider {
  readonly label: string;
  leaderboard(save: SaveData, friendScores?: Record<string, number>): LeaderboardEntry[];
  addFriend(save: SaveData, code: string): Promise<{ ok: boolean; msg: string }>;
  /** Friend code -> current score. Returns empty if the provider doesn't support real scores. */
  friendScores(save: SaveData): Promise<Record<string, number>>;
  /** Notifies the provider of the player's own score so friends can see it (fire-and-forget). */
  updateScore?(save: SaveData): void;
  /** Publishes the player document (friend code -> name/score). Cloud sync can
   *  change friendCode, so this MUST be called after sync. */
  publishPlayer?(): Promise<void>;
  /**
   * Removes the player document. Part of the in-app deletion path: the
   * `players/{code}` record is the one genuinely public thing in the game (the
   * display name behind a friend code), so deleting cloud data that left it
   * standing would not be a deletion at all. Absent on providers with nothing
   * published.
   */
  deletePlayer?(): Promise<boolean>;
}

/** Visit/gift rewards are given once per friend per day, so a cap is put on the
 * list to prevent unlimited gold/feed farming via friend-code spam. */
const MAX_FRIENDS = 50;

const BOTS = [
  { name: 'CoralKing 🤖', mult: 3.2 },
  { name: 'DeepBlue 🤖', mult: 2.1 },
  { name: 'CaptainKelp 🤖', mult: 1.6 },
  { name: 'PearlHunter 🤖', mult: 1.25 },
  { name: 'PufferFish 🤖', mult: 0.85 },
  { name: 'TinyFin 🤖', mult: 0.5 },
  { name: 'LazySea 🤖', mult: 0.2 },
];

/** The leaderboard compares the player's score against community bots. If a
 * friend's score came in via `friendScores` (code -> score), the real value is
 * shown; otherwise (provider doesn't support it, or not fetched yet) a ⏳
 * placeholder is shown. LocalSocial and FirebaseSocial share this same leaderboard logic. */
function buildLocalLeaderboard(save: SaveData, friendScores: Record<string, number> = {}): LeaderboardEntry[] {
  const base = Math.max(1000, save.stats.totalEarned);
  const rows = BOTS.map((b) => ({
    name: b.name,
    score: Math.round((base * b.mult) / 10) * 10,
    isPlayer: false,
    isBot: true,
  }));
  rows.push({ name: save.playerName + ' ' + t('(you)'), score: save.stats.totalEarned, isPlayer: true, isBot: false });
  for (const f of save.friends) {
    const score = friendScores[f.code];
    rows.push({
      name: score === undefined ? f.name + ' ⏳' : f.name,
      score: score ?? 0,
      isPlayer: false,
      isBot: false,
    });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Shared format/duplicate/limit checks — both the local and Firebase providers
 * filter these out synchronously before hitting the network. */
function validateFriendCode(save: SaveData, code: string): { c: string } | { msg: string } {
  const c = code.trim().toUpperCase();
  if (!/^REEF-[A-Z0-9]{5}$/.test(c)) return { msg: t('Invalid code. Example format: REEF-AB12C') };
  if (c === save.friendCode) return { msg: t("That's your own code! 😄") };
  if (save.friends.some((f) => f.code === c)) return { msg: t('This friend is already on your list.') };
  if (save.friends.length >= MAX_FRIENDS) return { msg: t('You can add up to {n} friends.', { n: MAX_FRIENDS }) };
  return { c };
}

/**
 * Local social provider: friend codes are validated for format and saved,
 * but whether the other side actually exists is not checked — see
 * FirebaseSocial for that. When Firebase isn't configured (see
 * isFirebaseConfigured), createServices() falls back to this provider.
 */
export class LocalSocial implements SocialProvider {
  readonly label = t('Local mode — online leaderboard in the mobile build');

  leaderboard(save: SaveData, friendScores: Record<string, number> = {}): LeaderboardEntry[] {
    return buildLocalLeaderboard(save, friendScores);
  }

  async friendScores(): Promise<Record<string, number>> {
    return {};
  }

  async addFriend(save: SaveData, code: string): Promise<{ ok: boolean; msg: string }> {
    const v = validateFriendCode(save, code);
    if (!('c' in v)) return { ok: false, msg: v.msg };
    save.friends.push({ code: v.c, name: t('Friend') + ' ' + v.c.slice(5) });
    return {
      ok: true,
      msg: t('Friend code saved! It will auto-match in the online build. 🤝'),
    };
  }
}

/**
 * Real friend-code verification via Firebase/Firestore. Signs in anonymously,
 * saves its own code as a `players/{friendCode}` document, and addFriend()
 * checks whether the entered code actually exists in Firestore and fetches
 * the real player name (see firestore.rules: `get` is public, `list` is
 * closed — codes can't be scanned/enumerated, only a single known code can
 * be queried).
 *
 * The leaderboard skeleton compared against bots comes from
 * buildLocalLeaderboard; friend scores are fetched separately via
 * friendScores() and injected into that skeleton in the UI (see ui.ts
 * renderSocial) — since Firestore `list` is closed, the friend list can't be
 * fetched in a single query, each code is get'd individually.
 */
/** Deletion is awaited by a button the player is watching, so every step of it
 *  is bounded; a hung request has to surface as a failure, not as a spinner. */
const DELETE_TIMEOUT_MS = 8000;

/** Resolves to null on rejection OR timeout — the caller cannot tell the two
 *  apart and does not need to: both mean "it did not happen". */
function withDeadline<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); }),
  ]).finally(() => clearTimeout(timer));
}

export class FirebaseSocial implements SocialProvider {
  readonly label = t('Firebase — friend code verification');
  // The app instance and anonymous session are shared with cloud-save.ts (see
  // firebase-app.ts) — a second initializeApp() would throw "app/duplicate-app".
  private db = firestore();
  private ready: Promise<void>;
  private lastScoreWrite = { at: 0, score: -1 };

  constructor(private save: SaveData) {
    // The player document is NOT written HERE. Restoring a cloud save can
    // change friendCode (the cloud save brings its own code), and a document
    // written here would be left stranded under the old code — the code
    // friends see would diverge from the player's own code. Instead,
    // publishPlayer() is called by game.ts after cloud sync finishes.
    this.ready = ensureUid().then(() => undefined).catch(() => undefined);
  }

  /** Writes the player document (friend code -> name/score). Must be called
   *  AFTER cloud sync completes; see the rationale in the constructor. */
  async publishPlayer(): Promise<void> {
    const uid = await ensureUid();
    if (!uid) return;
    try {
      await setDoc(doc(this.db, 'players', this.save.friendCode), {
        name: this.save.playerName,
        uid,
        score: this.save.stats.totalEarned,
        updatedAt: serverTimestamp(),
      });
    } catch {
      /* no connection — fail silently, retried on the next launch */
    }
  }

  /**
   * Deletes this player's published document. Returns false only when the
   * write itself failed — a code that was never published is already in the
   * state the caller wants, so it counts as success.
   */
  async deletePlayer(): Promise<boolean> {
    // BOUNDED, unlike publishPlayer above. That one is fire-and-forget and can
    // afford to hang; this one is awaited by a button the player is watching,
    // and ensureUid() does not resolve at all when auth cannot be reached — the
    // button would sit on "Deleting…" for the rest of the session.
    const uid = await withDeadline(ensureUid(), DELETE_TIMEOUT_MS);
    if (!uid) return false;
    // The rules reject a delete on a document this uid does not own, and a
    // document that was never published deletes cleanly — so a failure here
    // means no network or someone else's code, not "nothing to delete".
    return (await withDeadline(
      deleteDoc(doc(this.db, 'players', this.save.friendCode)).then(() => true),
      DELETE_TIMEOUT_MS,
    )) === true;
  }

  leaderboard(save: SaveData, friendScores: Record<string, number> = {}): LeaderboardEntry[] {
    return buildLocalLeaderboard(save, friendScores);
  }

  /** Gets each friend code individually (see class comment) — the MAX_FRIENDS
   * limit keeps this parallel request count under control. */
  async friendScores(save: SaveData): Promise<Record<string, number>> {
    await this.ready;
    const entries = await Promise.all(
      save.friends.map(async (f): Promise<[string, number] | null> => {
        try {
          const snap = await getDoc(doc(this.db, 'players', f.code));
          if (!snap.exists()) return null;
          const score = snap.data().score;
          return typeof score === 'number' ? [f.code, score] : null;
        } catch {
          return null;
        }
      }),
    );
    return Object.fromEntries(entries.filter((e): e is [string, number] => e !== null));
  }

  /** Writes the score at most once a minute, and only if it actually changed —
   * to avoid burning through the Firestore daily write quota (Spark plan) on frequent syncSave calls. */
  updateScore(save: SaveData): void {
    const score = save.stats.totalEarned;
    const now = Date.now();
    if (score === this.lastScoreWrite.score || now - this.lastScoreWrite.at < 60_000) return;
    this.lastScoreWrite = { at: now, score };
    void this.ready
      .then(() => setDoc(doc(this.db, 'players', save.friendCode), { score }, { merge: true }))
      .catch(() => {
        /* connection issue — will be retried on the next syncSave */
      });
  }

  async addFriend(save: SaveData, code: string): Promise<{ ok: boolean; msg: string }> {
    const v = validateFriendCode(save, code);
    if (!('c' in v)) return { ok: false, msg: v.msg };
    await this.ready;
    try {
      const snap = await getDoc(doc(this.db, 'players', v.c));
      if (!snap.exists()) return { ok: false, msg: t("This code wasn't found. Make sure your friend shared the right code.") };
      const name = (snap.data().name as string) || t('Friend') + ' ' + v.c.slice(5);
      save.friends.push({ code: v.c, name });
      return { ok: true, msg: t('{name} added to your friends list! 🤝', { name }) };
    } catch {
      return { ok: false, msg: t('There was a connection issue, try again later.') };
    }
  }
}

// ---------- Service registration point ----------

export interface Services {
  auth: AuthProvider;
  iap: IAPProvider;
  social: SocialProvider;
  ads: AdsProvider;
}

export function createServices(save: SaveData): Services {
  // In iOS/Android native (Capacitor) builds: real sign-in to Game Center / Play
  // Games, real purchases via RevenueCat, and real ads via AdMob; in all other
  // environments (web preview, dev server), falls back to local/stub providers.
  const native = isNativeGameAuthAvailable();
  return {
    auth: native ? new NativeGameAuth(save) : new LocalAuth(save),
    iap: native ? new RevenueCatIAP(save.friendCode) : new StubIAP(),
    // Not tied to the native flag: once configured, this also works against the real backend in web preview.
    social: isFirebaseConfigured() ? new FirebaseSocial(save) : new LocalSocial(),
    ads: native ? new AdMobAds(save) : new StubAds(),
  };
}
