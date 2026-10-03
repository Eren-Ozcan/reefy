import { Capacitor } from '@capacitor/core';
import { FirebaseRemoteConfig, GetValueSource } from '@capacitor-firebase/remote-config';

// Tunables the studio may want to change without shipping a build (ad pacing
// and caps). Every key has a default in code and a clamp, so an empty console,
// no network, or a typo in a published value can never switch ads off or flood
// the player. The last fetched values are kept in localStorage so the first
// session after a fetch already uses them instead of waiting for the network.

const STORE_KEY = 'reefy.remoteConfig.v1';
const KEYS = ['interstitial_cooldown_ms', 'rewarded_cooldown_ms', 'rewarded_ads_per_day', 'growth_ads_per_day'] as const;
type Key = (typeof KEYS)[number];

let values: Partial<Record<Key, number>> = load();

function load(): Partial<Record<Key, number>> {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Partial<Record<Key, number>>;
  } catch {
    return {};
  }
}

/** The remote value for `key`, clamped to [min, max]; `fallback` when none was ever fetched. */
export function remoteNumber(key: Key, fallback: number, min: number, max: number): number {
  const v = values[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

/** Fetches in the background; a failure leaves whatever was cached. */
export async function initRemoteConfig(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await FirebaseRemoteConfig.setSettings({ minimumFetchIntervalInSeconds: 12 * 3600 });
    await FirebaseRemoteConfig.fetchAndActivate();
    const next: Partial<Record<Key, number>> = {};
    for (const key of KEYS) {
      const { value, source } = await FirebaseRemoteConfig.getNumber({ key });
      // A key never published reads as a static 0, which must not win over the code default.
      if (source === GetValueSource.Remote && Number.isFinite(value)) next[key] = value;
    }
    values = next;
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* offline or not configured: keep the cached values */
  }
}
