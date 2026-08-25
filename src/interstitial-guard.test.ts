// The one line that decides whether a player who paid to remove ads still sees
// them: the guard at the top of AdMobAds.maybeShowInterstitial.
//
// Worth its own test because every interstitial in the game funnels through
// that single method — the tank-switch trigger and the tank-cleaned trigger
// both call it and neither checks adsRemoved itself. A handset can only prove
// the trigger that the current save can reach; buying a second tank costs
// 2,500 coins and level 3, so the switch path is out of reach on a fresh
// account. Here both are the same call, and the guard is checked directly.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const showInterstitial = vi.fn(async () => undefined);
const prepareInterstitial = vi.fn(async () => undefined);

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true },
}));

vi.mock('@capacitor-community/admob', () => ({
  AdMob: {
    initialize: vi.fn(async () => undefined),
    requestConsentInfo: vi.fn(async () => ({ status: 'NOT_REQUIRED', isConsentFormAvailable: false })),
    showConsentForm: vi.fn(async () => ({ status: 'NOT_REQUIRED' })),
    prepareInterstitial,
    showInterstitial,
    prepareRewardVideoAd: vi.fn(async () => undefined),
    showRewardVideoAd: vi.fn(async () => ({ type: 'reward', amount: 1 })),
    addListener: vi.fn(() => ({ remove: () => undefined })),
  },
  AdmobConsentStatus: { NOT_REQUIRED: 'NOT_REQUIRED', OBTAINED: 'OBTAINED', REQUIRED: 'REQUIRED' },
  RewardAdPluginEvents: { Loaded: 'Loaded', Rewarded: 'Rewarded', FailedToLoad: 'FailedToLoad' },
}));

const { AdMobAds } = await import('./ads');
const { defaultSave } = await import('./save');

/** An ads provider that has already got past setup and has an ad in hand —
 *  the only state in which an interstitial could actually be shown. */
function armedAds(adsRemoved: boolean): InstanceType<typeof AdMobAds> {
  const save = defaultSave();
  save.adsRemoved = adsRemoved;
  const ads = new AdMobAds(save);
  const internals = ads as unknown as {
    ready: boolean;
    interstitialReady: boolean;
    lastInterstitial: number;
  };
  internals.ready = true;
  internals.interstitialReady = true;
  internals.lastInterstitial = 0; // past the cooldown
  return ads;
}

beforeEach(() => {
  localStorage.clear();
  showInterstitial.mockClear();
  prepareInterstitial.mockClear();
});

describe('the interstitial guard', () => {
  it('shows an interstitial when the player has not bought remove-ads', () => {
    armedAds(false).maybeShowInterstitial();
    expect(showInterstitial).toHaveBeenCalledTimes(1);
  });

  it('shows nothing once remove-ads is owned', () => {
    armedAds(true).maybeShowInterstitial();
    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it('keeps refusing on every later trigger, not just the first', () => {
    const ads = armedAds(true);
    // Both call sites in game.ts, twice over: cleaning a tank and switching to
    // another one. An entitlement that only held for the first trigger of a
    // session would still let ads through on the next tank switch.
    ads.maybeShowInterstitial();
    ads.maybeShowInterstitial();
    ads.maybeShowInterstitial();
    expect(showInterstitial).not.toHaveBeenCalled();
  });

  it('does not burn the cooldown while refusing', () => {
    // The guard returns before the timestamp is written. If it did not, the
    // refusal would silently push the next legitimate ad ten minutes out for
    // anyone who later lost the entitlement (a refund, a different account).
    const ads = armedAds(true);
    ads.maybeShowInterstitial();
    expect(localStorage.getItem('reefy.ads.lastInterstitial')).toBeNull();
  });
});
