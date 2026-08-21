// Ad provider abstraction layer (follows the IAP/Auth pattern in services.ts).
//
// In the web/dev environment StubAds runs (shows no ads).
// In Capacitor builds, AdMobAds connects to Google AdMob via
// @capacitor-community/admob. Game code only uses the AdsProvider interface.

import { Capacitor } from '@capacitor/core';
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';
import { t } from './i18n';
import type { SaveData } from './save';

/** Ad unit IDs created in the AdMob dashboard (see apps.admob.com > Reefy). */
const INTERSTITIAL_AD_IDS: { android: string; ios: string } = {
  android: 'ca-app-pub-9709993577664180/8876084322',
  ios: 'ca-app-pub-9709993577664180/3722729912',
};
const REWARDED_AD_IDS: { android: string; ios: string } = {
  android: 'ca-app-pub-9709993577664180/5670356549',
  ios: 'ca-app-pub-9709993577664180/6249920983',
};

/** Pearl amount granted per rewarded ad — as with store IAPs, the reward amount
 * is always controlled here in code (the ad network's own callback data is not trusted). */
export const REWARDED_AD_PEARLS = 5;

/**
 * How many rewarded ads a player may cash in per day.
 *
 * Without a cap the only limit was a 30-second cooldown, which puts roughly
 * 600 pearls an hour within reach — about ten times the smallest pearl pack,
 * for free. That does not just undercut the pack, it removes the reason to
 * buy one at all.
 *
 * Three rather than one or two: the rewarded ad is a reason to come back
 * tomorrow as much as it is an economy tap, and it is the one ad the player
 * chooses to watch, so cutting it too far costs both retention and ad
 * revenue. Three a day is 15 pearls — a quarter of the smallest pack, enough
 * to feel worth opening the app for, not enough to replace buying one.
 *
 * The number is an estimate, like the festival tiers were: revisit it against
 * what players actually do rather than defend it as tuned.
 */
export const REWARDED_ADS_PER_DAY = 3;

/**
 * Devices that should be served TEST ads instead of live ones.
 *
 * Tapping your own live ad is what gets an AdMob account suspended, and testing
 * on a real handset is exactly when that happens. Emulators are treated as test
 * devices by the SDK automatically; a real phone has to be named, and its id is
 * printed by the SDK itself on the first ad request ("Use
 * RequestConfiguration.Builder().setTestDeviceIds(...)" in logcat).
 *
 * Read from the environment rather than written here on purpose: the id belongs
 * to one person's handset, it is not interesting to anyone else, and a public
 * repo is the wrong place for it. Put it in a local .env.local as
 * VITE_ADMOB_TEST_DEVICES=<id>[,<id>] — with the variable unset, which is how
 * every release is built, this is exactly the previous behaviour.
 */
const TEST_DEVICES: string[] = (import.meta.env.VITE_ADMOB_TEST_DEVICES ?? '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

const TEST_DEVICE_INIT = TEST_DEVICES.length
  ? { testingDevices: TEST_DEVICES, initializeForTesting: true }
  : {};

const INTERSTITIAL_COOLDOWN_MS = 10 * 60 * 1000; // don't show ads back-to-back on tank transitions
const REWARDED_COOLDOWN_MS = 30 * 1000;         // prevent accidental double-clicks

/** Where the cooldown timer lives on disk. When kept only in memory, it reset
 *  whenever the player closed and reopened the app; every cold start yielded a
 *  fresh ad opportunity. Deliberately kept separate from the save file
 *  (SaveData): this isn't game progress, it's harmless-to-lose side data. */
const INTERSTITIAL_TS_KEY = 'reefy.ads.lastInterstitial';

function loadLastInterstitial(): number {
  try {
    const raw = Number(localStorage.getItem(INTERSTITIAL_TS_KEY));
    // A future timestamp (device clock rolled back) shouldn't cause a permanent
    // lock: treat it as invalid and start fresh.
    return Number.isFinite(raw) && raw > 0 && raw <= Date.now() ? raw : 0;
  } catch {
    return 0;
  }
}

function saveLastInterstitial(ts: number): void {
  try {
    localStorage.setItem(INTERSTITIAL_TS_KEY, String(ts));
  } catch {
    /* private mode / quota — don't let the ad timer break game flow */
  }
}

export interface AdsProvider {
  /** Called at a natural break point INSIDE the game (tank change, tank fully
   * cleared); may silently no-op (if the cooldown hasn't elapsed, the ad isn't
   * ready, or "remove ads" has been purchased).
   *
   * NOT CALLED on app startup: AdMob forbids interstitials on launch/foreground,
   * the allowed format for that scenario is a separate "App Open" unit —
   * which doesn't exist in the version of @capacitor-community/admob we use. */
  maybeShowInterstitial(): void;
  /** The rewarded ad flow, deliberately started by the player. */
  showRewarded(): Promise<{ ok: boolean; msg: string; grantPearls?: number }>;
  /** Why ads are unavailable, if they are — empty when they work. Shown in Settings. */
  readonly lastError?: string;
}

export class StubAds implements AdsProvider {
  maybeShowInterstitial(): void {}
  showRewarded(): Promise<{ ok: boolean; msg: string }> {
    return Promise.resolve({
      ok: false,
      msg: t('Ads are enabled in the Google Play / App Store build.'),
    });
  }
}

export class AdMobAds implements AdsProvider {
  private ready = false;
  private interstitialReady = false;
  private lastInterstitial = loadLastInterstitial();
  private lastRewarded = 0;

  constructor(private save: SaveData) {
    void this.setup();
  }

  private platform(): 'android' | 'ios' {
    return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  }

  /** GDPR/UMP consent flow: for EU/UK traffic, consent must be requested
   *  BEFORE any ad request is made. If consent can't be obtained (or the SDK
   *  errors out), proceed without ads — app startup must never block on this. */
  private async requestConsent(): Promise<boolean> {
    try {
      let info = await AdMob.requestConsentInfo();
      if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) {
        info = await AdMob.showConsentForm();
      }
      if (!info.canRequestAds) this.lastError = `consent: ${String(info.status)}`;
      return info.canRequestAds;
    } catch (e) {
      // Recorded rather than swallowed. This call reaches Google's UMP servers,
      // so it fails on a bad connection at launch as readily as on a real
      // configuration problem, and the two are indistinguishable from the game's
      // side — but only one of them is worth a person's afternoon.
      this.lastError = `consent: ${e instanceof Error ? e.message : String(e)}`;
      return false;
    }
  }

  /** Why ads are unavailable, if they are. Surfaced in Settings — see ui.ts. */
  lastError = '';

  /** Guards against two setups running at once when a retry lands mid-flight. */
  private setupInFlight: Promise<void> | null = null;

  private setup(): Promise<void> {
    if (this.setupInFlight) return this.setupInFlight;
    this.setupInFlight = this.runSetup().finally(() => { this.setupInFlight = null; });
    return this.setupInFlight;
  }

  private async runSetup(): Promise<void> {
    try {
      if (!(await this.requestConsent())) {
        this.ready = false;
        return;
      }
      await AdMob.initialize(TEST_DEVICE_INIT);
      this.ready = true;
      this.lastError = '';
      if (!this.save.adsRemoved) void this.loadInterstitial();
    } catch (e) {
      this.lastError = `init: ${e instanceof Error ? e.message : String(e)}`;
      this.ready = false;
    }
  }

  private async loadInterstitial(): Promise<void> {
    try {
      await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_IDS[this.platform()] });
      this.interstitialReady = true;
    } catch {
      this.interstitialReady = false;
    }
  }

  maybeShowInterstitial(): void {
    if (!this.ready || this.save.adsRemoved || !this.interstitialReady) return;
    const now = Date.now();
    if (now - this.lastInterstitial < INTERSTITIAL_COOLDOWN_MS) return;
    this.lastInterstitial = now;
    saveLastInterstitial(now);
    this.interstitialReady = false;
    void AdMob.showInterstitial()
      .catch(() => {})
      .finally(() => void this.loadInterstitial());
  }

  async showRewarded(): Promise<{ ok: boolean; msg: string; grantPearls?: number }> {
    // One retry, here, where the player has actually asked for an ad. Setup runs
    // once at launch and reaches the network; a hiccup in that moment used to
    // disable ads for the WHOLE session with no way back, which on a phone that
    // was still connecting is most launches.
    if (!this.ready) await this.setup();
    if (!this.ready) return { ok: false, msg: t("The ad system isn't ready yet, try again shortly.") };
    const now = Date.now();
    if (now - this.lastRewarded < REWARDED_COOLDOWN_MS) {
      return { ok: false, msg: t('You just watched an ad, try again in a bit.') };
    }
    let listener: { remove: () => Promise<void> } | null = null;
    try {
      await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_IDS[this.platform()] });
      let rewarded = false;
      listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      });
      await AdMob.showRewardVideoAd();
      if (!rewarded) return { ok: false, msg: t('You exited before finishing the ad, no reward given.') };
      this.lastRewarded = now;
      return { ok: true, msg: t('You watched the ad! +{n} pearls 🦪', { n: REWARDED_AD_PEARLS }), grantPearls: REWARDED_AD_PEARLS };
    } catch {
      return { ok: false, msg: t('No ad is available right now, try again later.') };
    } finally {
      // If showRewardVideoAd() rejects (ad expired, network dropped), the
      // listener used to never get removed; on the next successful watch the
      // stale listener and the new one would both fire, risking a double reward.
      if (listener) void listener.remove();
    }
  }
}
