import { Capacitor } from '@capacitor/core';
import { FirebaseAnalytics } from '@capacitor-firebase/analytics';

// Native only: the web and demo builds never talk to Analytics, and the unit
// tests run without it. Collection also stays off until the ad-consent flow has
// answered (the manifest ships `firebase_analytics_collection_enabled=false`),
// so events logged before that answer are held, not sent, and are dropped if
// the answer is no.

type Params = Record<string, string | number | boolean>;

const MAX_QUEUED = 50;
let decided = false;
let enabled = false;
let queue: { name: string; params?: Params }[] = [];

function send(name: string, params?: Params): void {
  FirebaseAnalytics.logEvent({ name, params }).catch(() => undefined);
}

/** Called once the consent flow has an answer; may be called again if the player changes it. */
export function setAnalyticsEnabled(on: boolean): void {
  decided = true;
  enabled = on;
  if (!Capacitor.isNativePlatform()) { queue = []; return; }
  FirebaseAnalytics.setEnabled({ enabled: on }).catch(() => undefined);
  if (on) for (const e of queue) send(e.name, e.params);
  queue = [];
}

/** Event names: snake_case, at most 40 characters (Firebase's limit). */
export function track(name: string, params?: Params): void {
  if (!Capacitor.isNativePlatform()) return;
  if (!decided) {
    if (queue.length < MAX_QUEUED) queue.push({ name, params });
    return;
  }
  if (enabled) send(name, params);
}
