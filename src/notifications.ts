import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { t } from './i18n';

// One reminder at most, scheduled when the app goes to the background and
// cancelled when it comes back. Three things are worth a nudge in this genre:
// an egg that has hatched, a fish that has finished growing, and an income pot
// that has filled up. The soonest one wins, it lands in waking hours, and a
// second reminder is never sent within a day of the previous one.

export type ReminderKind = 'egg' | 'fish' | 'pot';
export interface Candidate { kind: ReminderKind; at: number }

const NOTIFICATION_ID = 4001;
const CHANNEL_ID = 'reminders';
const MIN_LEAD_MS = 30 * 60_000;          // not worth interrupting for something that is nearly here
const MIN_GAP_MS = 20 * 3600_000;         // at most about one a day
const OFFLINE_CAP_MS = 8 * 3600_000;      // progress stops after this long away, so a later reminder would be a lie
const WAKE_HOUR = 9;
const SLEEP_HOUR = 21;
const FIRED_KEY = 'reefy.notify.lastFired';
const ASKED_KEY = 'reefy.notify.asked';
const PLANNED_KEY = 'reefy.notify.planned';

/** Moves a time outside 09:00–21:00 local to the next 09:00. */
export function intoWakingHours(at: number): number {
  const d = new Date(at);
  const h = d.getHours();
  if (h >= WAKE_HOUR && h < SLEEP_HOUR) return at;
  const next = new Date(at);
  next.setHours(WAKE_HOUR, 0, 0, 0);
  if (h >= SLEEP_HOUR) next.setDate(next.getDate() + 1);
  return next.getTime();
}

/** Pure choice of what to schedule; `null` means stay quiet. */
export function pickReminder(cands: Candidate[], now: number, lastFired: number): Candidate | null {
  const usable = cands
    .filter((c) => c.at >= now + MIN_LEAD_MS && c.at <= now + OFFLINE_CAP_MS)
    .sort((a, b) => a.at - b.at);
  const first = usable[0];
  if (!first) return null;
  const at = intoWakingHours(first.at);
  if (at - lastFired < MIN_GAP_MS) return null;
  return { kind: first.kind, at };
}

const BODY: Record<ReminderKind, () => string> = {
  egg: () => t('🥚 Your egg has hatched!'),
  fish: () => t('🐟 A fish has grown up and is ready to sell.'),
  pot: () => t('🪙 Your income pot is full. Come and collect it!'),
};

function read(key: string): number {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
}
function write(key: string, v: number): void {
  try { localStorage.setItem(key, String(v)); } catch { /* storage unavailable */ }
}

const native = (): boolean => Capacitor.isNativePlatform();

/** True once a reminder we scheduled has had time to fire; remembered so the one-a-day gap survives. */
function settlePlanned(now: number): void {
  const planned = read(PLANNED_KEY);
  if (planned && planned <= now) write(FIRED_KEY, planned);
  write(PLANNED_KEY, 0);
}

export async function scheduleReminder(cands: Candidate[]): Promise<void> {
  if (!native()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;
    const now = Date.now();
    settlePlanned(now);
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
    const pick = pickReminder(cands, now, read(FIRED_KEY));
    if (!pick) return;
    await LocalNotifications.createChannel({ id: CHANNEL_ID, name: 'Reminders', importance: 3 });
    await LocalNotifications.schedule({
      notifications: [{
        id: NOTIFICATION_ID,
        title: 'Reefy',
        body: BODY[pick.kind](),
        channelId: CHANNEL_ID,
        schedule: { at: new Date(pick.at), allowWhileIdle: true },
      }],
    });
    write(PLANNED_KEY, pick.at);
  } catch {
    /* notifications are a nicety; never let them break the game */
  }
}

export async function cancelReminder(): Promise<void> {
  if (!native()) return;
  try {
    settlePlanned(Date.now());
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch { /* see above */ }
}

/**
 * Asks for permission once, at the moment a timer first starts (an egg going
 * into the incubator), so the system prompt arrives with its reason attached.
 */
export async function askNotificationPermissionOnce(): Promise<void> {
  if (!native() || read(ASKED_KEY)) return;
  write(ASKED_KEY, 1);
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      await LocalNotifications.requestPermissions();
    }
  } catch { /* see above */ }
}
