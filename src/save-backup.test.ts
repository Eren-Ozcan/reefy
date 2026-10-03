// The local backup behind loadSave()/persist(): a save that stops parsing must
// not cost a guest player (who has no cloud copy) their whole reef.
//
// Before the backup existed, an unreadable save fell back to a fresh one and the
// next persist() — six seconds later — overwrote the broken text for good.

import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSave, loadSave, persist, wipeSave } from './save';

const KEY = 'reefy-save-v1';

beforeEach(() => {
  localStorage.clear();
});

function saveWithCoins(coins: number) {
  const s = defaultSave();
  s.coins = coins;
  return s;
}

describe('save backup', () => {
  it('keeps the previous good save as the backup on every overwrite', () => {
    persist(saveWithCoins(111));
    persist(saveWithCoins(222));
    expect(JSON.parse(localStorage.getItem(`${KEY}.bak`)!).coins).toBe(111);
    expect(JSON.parse(localStorage.getItem(KEY)!).coins).toBe(222);
  });

  it('loads the backup when the main save no longer parses', () => {
    persist(saveWithCoins(111));
    persist(saveWithCoins(222));
    localStorage.setItem(KEY, '{"coins": 22'); // truncated write
    expect(loadSave().coins).toBe(111);
  });

  it('parks the unreadable text instead of destroying it', () => {
    persist(saveWithCoins(111));
    localStorage.setItem(KEY, 'not json');
    loadSave();
    expect(localStorage.getItem(`${KEY}.corrupt`)).toBe('not json');
  });

  it('never turns a corrupt main save into the backup', () => {
    persist(saveWithCoins(111));
    persist(saveWithCoins(222));
    localStorage.setItem(KEY, 'not json');
    persist(saveWithCoins(333));
    expect(JSON.parse(localStorage.getItem(`${KEY}.bak`)!).coins).toBe(111);
  });

  it('falls back to a fresh save when there is no backup either', () => {
    localStorage.setItem(KEY, 'not json');
    expect(loadSave().coins).toBe(defaultSave().coins);
  });

  it('"Delete all progress" removes the backup too, so nothing comes back', () => {
    persist(saveWithCoins(111));
    persist(saveWithCoins(222));
    wipeSave();
    expect(localStorage.getItem(`${KEY}.bak`)).toBeNull();
    expect(loadSave().coins).toBe(defaultSave().coins);
  });
});
