import type { QuestEvent } from './quests';

/**
 * A timed event: the game's THIRD rhythm, after the daily quests
 * (questsForDay) and the weekly one (weeklyQuestForWeek).
 *
 * The difference that justifies a separate file: a daily quest asks the player
 * to show up today and a weekly one to show up this week, but both are still
 * "finish a task, take the reward". An event runs for a fixed span of days and
 * accrues POINTS from ordinary play toward tiers claimed one by one, so what
 * it asks for is a run of days rather than a single session — and it has an
 * end date, which is where the urgency comes from.
 */
export interface EventTier {
  points: number;
  coins: number;
  pearls: number;
}

export interface EventDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** Inclusive YYYY-MM-DD day keys, in the same UTC form the quests use. */
  start: string;
  end: string;
  /** Points awarded per unit of a QuestEvent. An event omitted here scores nothing. */
  points: Partial<Record<QuestEvent, number>>;
  /** Ascending by points — the UI and the claim check both rely on the order. */
  tiers: EventTier[];
}

/**
 * Days AFTER the end date during which the tiers already earned can still be
 * claimed. It exists because losing a reward that was actually earned reads as
 * a bug rather than as urgency, and the closed test has few enough players
 * that one missed claim is loud feedback. It does NOT extend scoring — points
 * stop at the end date, so showing up during the event is still the only way
 * to reach a tier.
 */
export const EVENT_GRACE_DAYS = 2;

/**
 * The calendar is EMBEDDED rather than fetched. Firebase is already wired up
 * and a remote calendar would let a new event ship without an app update, but
 * that also adds an offline story and a "the event vanished mid-run" case to
 * handle. Neither is worth building before the first event has shown whether
 * the points and tiers are balanced at all.
 */
export const EVENTS: EventDef[] = [
  {
    id: 'coral-festival-2026-08',
    name: 'Coral Festival',
    emoji: '🎏',
    desc: 'The reef celebrates for five days. Everything you already do earns festival points.',
    start: '2026-08-24',
    end: '2026-08-28',
    // `earn` is deliberately NOT scored: coin income accrues on its own from
    // passive income, so it would pay points for leaving the game closed —
    // the exact opposite of what the event is for.
    points: { feed: 1, clean: 5, buyFish: 5, placeDecor: 5, sell: 8, hatch: 15, collect: 25 },
    tiers: [
      { points: 150, coins: 1000, pearls: 0 },
      { points: 400, coins: 2000, pearls: 2 },
      { points: 900, coins: 4000, pearls: 3 },
      { points: 1800, coins: 6000, pearls: 5 },
    ],
  },
];

/** Adds days to a YYYY-MM-DD key and returns the same form. */
export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * The event scoring right now, or null. ISO day keys compare correctly as
 * plain strings, which is why the whole file works in day keys rather than
 * timestamps — no timezone or millisecond arithmetic to get wrong.
 */
export function activeEvent(day: string): EventDef | null {
  return EVENTS.find((e) => e.start <= day && day <= e.end) ?? null;
}

/**
 * The event whose rewards can still be claimed today — the active one, or one
 * that ended within the grace window. Scoring uses activeEvent(); only
 * claiming uses this.
 */
export function claimableEvent(day: string): EventDef | null {
  return EVENTS.find((e) => e.start <= day && day <= addDays(e.end, EVENT_GRACE_DAYS)) ?? null;
}

/** Index of the highest tier reached at this point total; -1 when none is. */
export function tierReached(def: EventDef, points: number): number {
  let idx = -1;
  for (let i = 0; i < def.tiers.length; i++) if (points >= def.tiers[i].points) idx = i;
  return idx;
}
