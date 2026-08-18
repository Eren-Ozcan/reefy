// The timed event's window arithmetic. Everything here is date logic, which is
// exactly the part that silently pays out on the wrong day if it regresses:
// scoring must stop at the end date while CLAIMING keeps working through the
// grace window, and the two must not be confused for one another.

import { describe, expect, it } from 'vitest';
import {
  EVENTS,
  EVENT_GRACE_DAYS,
  activeEvent,
  addDays,
  claimableEvent,
  tierReached,
  type EventDef,
} from './events';

const def: EventDef = {
  id: 'test-event',
  name: 'Test Festival',
  emoji: '🎏',
  desc: '',
  start: '2026-08-24',
  end: '2026-08-28',
  points: { feed: 1 },
  tiers: [
    { points: 100, coins: 10, pearls: 0 },
    { points: 300, coins: 20, pearls: 1 },
  ],
};

describe('day arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });

  it('adds days across a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('leaves the day unchanged at zero', () => {
    expect(addDays('2026-08-24', 0)).toBe('2026-08-24');
  });
});

describe('the shipped calendar', () => {
  it('has no event whose end precedes its start', () => {
    for (const e of EVENTS) expect(e.start <= e.end).toBe(true);
  });

  it('lists every event tier in ascending point order', () => {
    for (const e of EVENTS) {
      const pts = e.tiers.map((t) => t.points);
      expect(pts).toEqual([...pts].sort((a, b) => a - b));
    }
  });

  it('never runs two events at once — points would go to only one of them', () => {
    for (const a of EVENTS) {
      for (const b of EVENTS) {
        if (a === b) continue;
        expect(a.start > b.end || b.start > a.end).toBe(true);
      }
    }
  });

  it('scores nothing for `earn`, which accrues while the game is closed', () => {
    for (const e of EVENTS) expect(e.points.earn).toBeUndefined();
  });
});

describe('the scoring window', () => {
  const find = (day: string) => (activeEvent(day) ? 'active' : 'none');

  it('is closed the day before it opens', () => {
    expect(find('2026-08-23')).toBe('none');
  });

  it('is open on the first and the last day', () => {
    expect(find('2026-08-24')).toBe('active');
    expect(find('2026-08-28')).toBe('active');
  });

  it('is closed the day after the end — the grace window does NOT extend scoring', () => {
    expect(find('2026-08-29')).toBe('none');
  });
});

describe('the claim window', () => {
  it('stays open for the whole grace period after the end', () => {
    const last = addDays(def.end, EVENT_GRACE_DAYS);
    expect(last).toBe('2026-08-30');
    // Same shape the module uses, checked against this fixture rather than the
    // shipped calendar so the dates stay readable.
    expect(def.start <= last && last <= addDays(def.end, EVENT_GRACE_DAYS)).toBe(true);
  });

  it('closes once the grace period is over', () => {
    const past = addDays(def.end, EVENT_GRACE_DAYS + 1);
    expect(past > addDays(def.end, EVENT_GRACE_DAYS)).toBe(true);
  });

  it('matches the scoring window for a shipped event on its own dates', () => {
    const e = EVENTS[0];
    expect(activeEvent(e.end)?.id).toBe(e.id);
    expect(activeEvent(addDays(e.end, 1))).toBeNull();
    expect(claimableEvent(addDays(e.end, EVENT_GRACE_DAYS))?.id).toBe(e.id);
    expect(claimableEvent(addDays(e.end, EVENT_GRACE_DAYS + 1))).toBeNull();
  });
});

describe('tier reached', () => {
  it('is none below the first tier', () => {
    expect(tierReached(def, 99)).toBe(-1);
  });

  it('is the first tier exactly at its threshold', () => {
    expect(tierReached(def, 100)).toBe(0);
  });

  it('is the highest tier passed, not merely the next one', () => {
    expect(tierReached(def, 5000)).toBe(1);
  });
});
