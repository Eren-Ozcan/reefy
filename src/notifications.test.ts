import { describe, expect, it } from 'vitest';
import { intoWakingHours, pickReminder } from './notifications';

const H = 3600_000;
// Local noon, so "now + a few hours" stays inside waking hours whatever the machine's zone.
const noon = new Date(2026, 5, 10, 12, 0, 0).getTime();

describe('pickReminder', () => {
  it('picks the soonest usable candidate', () => {
    const r = pickReminder([{ kind: 'pot', at: noon + 5 * H }, { kind: 'egg', at: noon + 2 * H }], noon, 0);
    expect(r?.kind).toBe('egg');
  });
  it('ignores things that are nearly here or beyond the offline cap', () => {
    expect(pickReminder([{ kind: 'egg', at: noon + 10 * 60_000 }], noon, 0)).toBeNull();
    expect(pickReminder([{ kind: 'egg', at: noon + 9 * H }], noon, 0)).toBeNull();
  });
  it('stays quiet within a day of the last one', () => {
    expect(pickReminder([{ kind: 'egg', at: noon + 2 * H }], noon, noon - 5 * H)).toBeNull();
    expect(pickReminder([{ kind: 'egg', at: noon + 2 * H }], noon, noon - 21 * H)).not.toBeNull();
  });
});

describe('intoWakingHours', () => {
  it('leaves daytime alone and moves night to 09:00', () => {
    const day = new Date(2026, 5, 10, 15, 0).getTime();
    expect(intoWakingHours(day)).toBe(day);
    const late = new Date(2026, 5, 10, 23, 30).getTime();
    expect(new Date(intoWakingHours(late)).getDate()).toBe(11);
    expect(new Date(intoWakingHours(late)).getHours()).toBe(9);
    const early = new Date(2026, 5, 10, 3, 0).getTime();
    expect(new Date(intoWakingHours(early)).getDate()).toBe(10);
  });
});
