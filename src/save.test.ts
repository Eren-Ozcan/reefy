// hasProgress() — the routine that decides, in a cloud conflict, whether the
// local save is safe to discard (see cloud-save.ts fast path).
//
// This test has two halves and BOTH are required:
//
// 1. Every signal that "counts as progress" is tested separately — if one is
//    missed, the player's effort gets silently deleted.
// 2. Every field that is "deliberately ignored" is also tested separately —
//    if one is wrongly counted as progress, the fast path never runs and the
//    fixed bug comes back (a newly set-up device sees a conflict screen with
//    one side empty again).

import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultSave,
  hasProgress,
  loadSave,
  parseSave,
  persist,
  progressFingerprint,
  START_COINS,
  START_FISH_COUNT,
  START_PEARLS,
  type SaveData,
} from './save';

beforeEach(() => {
  localStorage.clear();
});

/** Mutates a single field on the default save and runs the routine. */
function withChange(mutate: (s: SaveData) => void): boolean {
  const s = defaultSave();
  mutate(s);
  return hasProgress(s);
}

describe('an untouched save', () => {
  it('has no progress in the default save', () => {
    expect(hasProgress(defaultSave())).toBe(false);
  });

  it('does not count the default random fields, name and friend code, as progress', () => {
    // Every call generates a new name and code; none of them is a player choice.
    for (let i = 0; i < 25; i++) expect(hasProgress(defaultSave())).toBe(false);
  });

  it('counts a fresh save read from disk as untouched too', () => {
    persist(defaultSave());
    expect(hasProgress(loadSave())).toBe(false);
  });

  it('counts the default built when no save exists as untouched', () => {
    expect(hasProgress(loadSave())).toBe(false);
  });
});

describe('signals that count as progress', () => {
  it('a fish sold', () => {
    expect(withChange((s) => { s.stats.totalSold = 1; })).toBe(true);
  });

  it('coins earned', () => {
    expect(withChange((s) => { s.stats.totalEarned = 1; })).toBe(true);
  });

  it('feed dropped', () => {
    expect(withChange((s) => { s.stats.totalFed = 1; })).toBe(true);
  });

  it('an egg hatched', () => {
    expect(withChange((s) => { s.stats.eggsHatched = 1; })).toBe(true);
  });

  it('festival points', () => {
    expect(withChange((s) => { s.event = { id: 'coral-festival-2026-08', points: 40, claimed: [] }; })).toBe(true);
  });

  it('a claimed festival tier, even at zero points', () => {
    expect(withChange((s) => { s.event = { id: 'coral-festival-2026-08', points: 0, claimed: [0] }; })).toBe(true);
  });

  it('incubating egg', () => {
    expect(withChange((s) => { s.pendingEggs = [{ id: 1, tier: 'abis', readyAt: Date.now() + 1000 }]; })).toBe(true);
  });

  it('the decoration-placed counter', () => {
    expect(withChange((s) => { s.stats.decorPlacedCount = 1; })).toBe(true);
  });

  it('the dirt-cleaned counter', () => {
    expect(withChange((s) => { s.stats.totalCleaned = 1; })).toBe(true);
  });

  it('the level', () => {
    expect(withChange((s) => { s.level = 2; })).toBe(true);
  });

  it('experience points', () => {
    expect(withChange((s) => { s.xp = 1; })).toBe(true);
  });

  it('coins differing from the start, both more and less', () => {
    expect(withChange((s) => { s.coins = START_COINS + 1; })).toBe(true);
    expect(withChange((s) => { s.coins = START_COINS - 1; })).toBe(true);
  });

  it('pearls differing from the start, both more and less', () => {
    expect(withChange((s) => { s.pearls = START_PEARLS + 1; })).toBe(true);
    expect(withChange((s) => { s.pearls = START_PEARLS - 1; })).toBe(true);
  });

  it('a change in the fish count, both up and down', () => {
    expect(withChange((s) => { s.fishes = s.fishes.slice(0, START_FISH_COUNT - 1); })).toBe(true);
    expect(withChange((s) => { s.fishes = [...s.fishes, { ...s.fishes[0], seed: 99 }]; })).toBe(true);
  });

  it('a NEW species entering the collection, beyond the starting fish', () => {
    expect(withChange((s) => { s.collection = ['zebra-danio']; })).toBe(true);
  });

  it('a new species added alongside the starting fish', () => {
    expect(withChange((s) => {
      s.collection = [...s.fishes.map((f) => f.sp), 'zebra-danio'];
    })).toBe(true);
  });

  it('an achievement reward claimed', () => {
    expect(withChange((s) => { s.achievementsClaimed = ['ilk-satis']; })).toBe(true);
  });

  it('a second tank', () => {
    expect(withChange((s) => { s.tanksOwned = [...s.tanksOwned, 'tank-derin-mavi']; })).toBe(true);
  });

  it('feed in stock', () => {
    expect(withChange((s) => { s.feedOwned = { 'feed-basic': 3 }; })).toBe(true);
  });

  it('decorations owned', () => {
    expect(withChange((s) => { s.decorOwned = { 'decor-kaya': 1 }; })).toBe(true);
  });

  it('decorations placed in a tank', () => {
    expect(withChange((s) => {
      s.decorPlaced[s.activeTank] = [{ def: 'decor-kaya', fx: 0.5 }];
    })).toBe(true);
  });

  it('a friend added', () => {
    expect(withChange((s) => { s.friends = [{ code: 'REEF-ABCDE', name: 'Ali' }]; })).toBe(true);
  });

  it('a friend visit, by the counter', () => {
    expect(withChange((s) => { s.friendVisits = { day: '2026-08-07', visited: [], count: 1 }; })).toBe(true);
  });

  it('a friend visit, by the visited list', () => {
    expect(withChange((s) => {
      s.friendVisits = { day: '2026-08-07', visited: ['REEF-ABCDE'], count: 0 };
    })).toBe(true);
  });

  it('a gift sent to a friend', () => {
    expect(withChange((s) => {
      s.friendGifts = { day: '2026-08-07', gifted: ['REEF-ABCDE'] };
    })).toBe(true);
  });

  it('daily quest progress', () => {
    expect(withChange((s) => { s.quests.progress = { 'feed-5': 2 }; })).toBe(true);
  });

  it('a daily quest reward claimed', () => {
    expect(withChange((s) => { s.quests.claimed = ['feed-5']; })).toBe(true);
  });

  it('weekly quest progress', () => {
    expect(withChange((s) => { s.weeklyQuest.progress = { 'sell-20': 3 }; })).toBe(true);
  });

  it('a weekly quest reward claimed', () => {
    expect(withChange((s) => { s.weeklyQuest.claimed = ['sell-20']; })).toBe(true);
  });

  it('the legendary pity counter', () => {
    expect(withChange((s) => { s.pityCounter = 1; })).toBe(true);
  });

  it('a streak longer than one day, which shows a real return', () => {
    expect(withChange((s) => { s.streak = 2; })).toBe(true);
  });

  it('a best streak longer than one day', () => {
    expect(withChange((s) => { s.bestStreak = 2; })).toBe(true);
  });

  it('a rewarded dirt spot cleaned today', () => {
    expect(withChange((s) => { s.cleanRewardCount = 1; })).toBe(true);
  });

  it('a fish that was petted', () => {
    expect(withChange((s) => { s.petDay = '2026-08-07'; })).toBe(true);
  });

  it('a name the player chose themselves', () => {
    expect(withChange((s) => { s.playerName = 'Kaptan'; })).toBe(true);
  });

  it('a player-typed name that merely resembles the default', () => {
    // If the digit count doesn't match, it couldn't have come from the default generator.
    expect(withChange((s) => { s.playerName = 'Misafir-12345'; })).toBe(true);
    expect(withChange((s) => { s.playerName = 'Misafir-12'; })).toBe(true);
    expect(withChange((s) => { s.playerName = 'misafir-1234'; })).toBe(true);
  });
});

describe('fields ignored on purpose — they must not break the fast path', () => {
  it('the last-seen time', () => {
    expect(withChange((s) => { s.lastSeen = Date.now() + 86_400_000; })).toBe(false);
  });

  it('accumulated, not-yet-collected passive income', () => {
    // Grows on its own while the player is watching the screen; gets written to totalEarned when collected.
    expect(withChange((s) => { s.incomePot = 999; })).toBe(false);
  });

  it('dirt spots that appear on their own', () => {
    expect(withChange((s) => {
      s.dirtSpots[s.activeTank] = [{ id: 1, fx: 0.3, fy: 0.4, r: 1, kind: 0 }];
    })).toBe(false);
  });

  it('the growth and hunger values of the fish', () => {
    expect(withChange((s) => {
      for (const f of s.fishes) { f.progress = 1; f.hunger = 0; }
    })).toBe(false);
  });

  it('the sale bonus accumulated on a fish', () => {
    expect(withChange((s) => { s.fishes[0].bonus = 0.4; })).toBe(false);
  });

  it('the day counter and a streak of 1, both set up on first launch', () => {
    // game.ts applyDailyGift: on first launch it sets up lastDaily/streak WITHOUT giving a gift.
    expect(withChange((s) => {
      s.lastDaily = '2026-08-07';
      s.streak = 1;
      s.bestStreak = 1;
    })).toBe(false);
  });

  it('the quest day, set up at launch', () => {
    expect(withChange((s) => {
      s.quests.day = '2026-08-07';
      s.weeklyQuest.day = '2026-08-03';
    })).toBe(false);
  });

  it('quest entries whose progress is zero', () => {
    expect(withChange((s) => { s.quests.progress = { 'feed-5': 0 }; })).toBe(false);
  });

  it('empty decoration lists', () => {
    expect(withChange((s) => { s.decorPlaced = { [s.activeTank]: [], 'tank-derin-mavi': [] }; })).toBe(false);
  });

  it('the sound and music settings', () => {
    expect(withChange((s) => { s.music = false; s.sfx = false; })).toBe(false);
  });

  it('the language preference', () => {
    expect(withChange((s) => { s.lang = s.lang === 'tr' ? 'en' : 'tr'; })).toBe(false);
  });

  it('the one-time UI hints', () => {
    expect(withChange((s) => { s.feedHintSeen = true; s.editHintSeen = true; })).toBe(false);
  });

  it('dismissing the blocking intro carousel (tutorialDone)', () => {
    // The carousel appears as soon as the game opens and settings are only
    // reachable once it's dismissed; this does NOT mean "the player achieved something."
    expect(withChange((s) => { s.tutorialDone = true; })).toBe(false);
  });

  it('the starting fish entering the collection by growing up on their own', () => {
    // The two starter fish begin half-grown; even if the player does nothing,
    // they'll drop into the collection within a few minutes.
    expect(withChange((s) => {
      s.collection = s.fishes.map((f) => f.sp);
      for (const f of s.fishes) f.progress = 1;
    })).toBe(false);
  });

  it('the rewarded-cleanup day itself, while the counter is zero', () => {
    expect(withChange((s) => { s.cleanRewardDay = '2026-08-07'; })).toBe(false);
  });

  it('the friend code', () => {
    expect(withChange((s) => { s.friendCode = 'REEF-ZZZZZ'; })).toBe(false);
  });

  it('the ad-free entitlement, which is never restored from the cloud anyway', () => {
    expect(withChange((s) => { s.adsRemoved = true; })).toBe(false);
  });

  it('visit and gift ledgers with an empty day field', () => {
    expect(withChange((s) => {
      s.friendVisits = { day: '2026-08-07', visited: [], count: 0 };
      s.friendGifts = { day: '2026-08-07', gifted: [] };
    })).toBe(false);
  });
});

// progressFingerprint() — answers the question "are these two saves actually
// the same?" (see cloud-save.ts: the conflict screen whose two columns are
// identical).
//
// Both halves here are required and point in OPPOSITE directions:
// 1. Fields that change on their own must NOT break equality — otherwise two
//    copies of the same save look different forever and the bug comes back.
// 2. Every field that reflects the player's effort MUST break equality — a
//    mistake here silently swallows the conflict, picking a side without asking.
describe('the progress fingerprint', () => {
  /** Two copies of the same save: the given mutation is applied to the second one. */
  function sameAfter(mutate: (s: SaveData) => void): boolean {
    const a = defaultSave();
    const b = JSON.parse(JSON.stringify(a)) as SaveData;
    mutate(b);
    return progressFingerprint(a) === progressFingerprint(b);
  }

  describe('what must count as the same', () => {
    it('a copy of the save itself', () => {
      expect(sameAfter(() => {})).toBe(true);
    });

    it('every self-advancing field at once', () => {
      // State after a few minutes in the game — the player did nothing.
      expect(sameAfter((s) => {
        s.lastSeen += 300_000;
        s.incomePot = 42.7;
        s.dirtSpots[s.activeTank] = [{ id: 7, fx: 0.3, fy: 0.4, r: 1, kind: 0 }];
        for (const f of s.fishes) { f.progress = 1; f.hunger = 0.2; }
      })).toBe(true);
    });

    it('device-local settings and UI state', () => {
      expect(sameAfter((s) => {
        s.music = false;
        s.sfx = false;
        s.lang = s.lang === 'tr' ? 'en' : 'tr';
        s.tutorialDone = true;
        s.feedHintSeen = true;
        s.editHintSeen = true;
      })).toBe(true);
    });

    it('the ad-free entitlement, which never enters the payload at all', () => {
      expect(sameAfter((s) => { s.adsRemoved = true; })).toBe(true);
    });

    it('array order — the fish list is rebuilt from the scene on every syncSave', () => {
      const a = defaultSave();
      a.collection = ['zebra-danio', 'lepistes'];
      a.friends = [{ code: 'REEF-AAAAA', name: 'Ali' }, { code: 'REEF-BBBBB', name: 'Bora' }];
      a.tanksOwned = ['tank-mercan-koyu', 'tank-derin-mavi'];
      a.achievementsClaimed = ['ilk-satis', 'ilk-yem'];

      const b = JSON.parse(JSON.stringify(a)) as SaveData;
      b.fishes.reverse();
      b.collection.reverse();
      b.friends.reverse();
      b.tanksOwned.reverse();
      b.achievementsClaimed.reverse();

      expect(progressFingerprint(b)).toBe(progressFingerprint(a));
    });

    it('a zero-valued entry versus an entry that is absent', () => {
      // When feed runs out {feed: 0} is left behind; on the other device that key doesn't exist at all.
      expect(sameAfter((s) => {
        s.feedOwned = { 'feed-basic': 0 };
        s.decorOwned = { 'decor-kaya': 0 };
        s.quests.progress = { 'feed-5': 0 };
        s.decorPlaced = { ...s.decorPlaced, 'tank-derin-mavi': [] };
      })).toBe(true);
    });

    it('a save that went through the JSON round trip, upload then download', () => {
      // cloud-save.ts does the comparison exactly like this: one side in memory,
      // the other side unpacked from the payload via parseSave().
      const s = defaultSave();
      s.level = 6;
      s.coins = 4210;
      s.feedOwned = { 'feed-basic': 4 };
      s.decorPlaced[s.activeTank] = [{ def: 'decor-kaya', fx: 0.42 }];
      const round = parseSave(JSON.stringify(s));
      expect(progressFingerprint(round!)).toBe(progressFingerprint(s));
    });

    it('the same round trip with the ad-free entitlement stripped out', () => {
      // A real upload strips the adsRemoved field; it comes back as false when read.
      const s = defaultSave();
      s.adsRemoved = true;
      const stripped: Record<string, unknown> = { ...s };
      delete stripped.adsRemoved;
      const round = parseSave(JSON.stringify(stripped));
      expect(progressFingerprint(round!)).toBe(progressFingerprint(s));
    });
  });

  describe('what must count as different', () => {
    it('two separate new saves, with random names and friend codes', () => {
      expect(progressFingerprint(defaultSave())).not.toBe(progressFingerprint(defaultSave()));
    });

    it('the currencies and the level', () => {
      expect(sameAfter((s) => { s.coins += 1; })).toBe(false);
      expect(sameAfter((s) => { s.pearls += 1; })).toBe(false);
      expect(sameAfter((s) => { s.xp += 1; })).toBe(false);
      expect(sameAfter((s) => { s.level += 1; })).toBe(false);
    });

    it('every change to the fish roster', () => {
      expect(sameAfter((s) => { s.fishes.pop(); })).toBe(false);
      expect(sameAfter((s) => { s.fishes.push({ ...s.fishes[0], seed: 99 }); })).toBe(false);
      expect(sameAfter((s) => { s.fishes[0].name = 'Kaptan'; })).toBe(false);
      expect(sameAfter((s) => { s.fishes[0].tank = 'tank-derin-mavi'; })).toBe(false);
      expect(sameAfter((s) => { s.fishes[0].bonus = 0.2; })).toBe(false);
    });

    it('the collection, the achievements and the tanks', () => {
      expect(sameAfter((s) => { s.collection = ['zebra-danio']; })).toBe(false);
      expect(sameAfter((s) => { s.achievementsClaimed = ['ilk-satis']; })).toBe(false);
      expect(sameAfter((s) => { s.tanksOwned = [...s.tanksOwned, 'tank-derin-mavi']; })).toBe(false);
      expect(sameAfter((s) => { s.activeTank = 'tank-derin-mavi'; })).toBe(false);
    });

    it('the inventory and the placed decorations', () => {
      expect(sameAfter((s) => { s.feedOwned = { 'feed-basic': 1 }; })).toBe(false);
      expect(sameAfter((s) => { s.decorOwned = { 'decor-kaya': 1 }; })).toBe(false);
      expect(sameAfter((s) => { s.decorPlaced[s.activeTank] = [{ def: 'decor-kaya', fx: 0.5 }]; })).toBe(false);
      expect(sameAfter((s) => { s.decorPlaced[s.activeTank] = [{ def: 'decor-kaya', fx: 0.6 }]; })).toBe(false);
    });

    it('each of the statistics', () => {
      expect(sameAfter((s) => { s.stats.totalSold = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.totalEarned = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.totalFed = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.eggsHatched = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.decorPlacedCount = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.totalCleaned = 1; })).toBe(false);
    });

    it('the quest ledgers', () => {
      expect(sameAfter((s) => { s.quests.day = '2026-08-08'; })).toBe(false);
      expect(sameAfter((s) => { s.quests.progress = { 'feed-5': 2 }; })).toBe(false);
      expect(sameAfter((s) => { s.quests.claimed = ['feed-5']; })).toBe(false);
      expect(sameAfter((s) => { s.weeklyQuest.progress = { 'sell-20': 3 }; })).toBe(false);
      expect(sameAfter((s) => { s.weeklyQuest.claimed = ['sell-20']; })).toBe(false);
    });

    it('friends, visits and gifts', () => {
      expect(sameAfter((s) => { s.friends = [{ code: 'REEF-ABCDE', name: 'Ali' }]; })).toBe(false);
      expect(sameAfter((s) => { s.friendVisits = { day: 'x', visited: ['REEF-ABCDE'], count: 1 }; })).toBe(false);
      expect(sameAfter((s) => { s.friendGifts = { day: 'x', gifted: ['REEF-ABCDE'] }; })).toBe(false);
    });

    it('the identity fields', () => {
      expect(sameAfter((s) => { s.playerName = 'Kaptan'; })).toBe(false);
      expect(sameAfter((s) => { s.friendCode = 'REEF-ZZZZZ'; })).toBe(false);
    });

    it('the day and streak ledgers, and the counters', () => {
      expect(sameAfter((s) => { s.pityCounter = 1; })).toBe(false);
      expect(sameAfter((s) => { s.streak = 3; })).toBe(false);
      expect(sameAfter((s) => { s.bestStreak = 3; })).toBe(false);
      expect(sameAfter((s) => { s.lastDaily = '2026-08-08'; })).toBe(false);
      expect(sameAfter((s) => { s.cleanRewardDay = '2026-08-08'; })).toBe(false);
      expect(sameAfter((s) => { s.cleanRewardCount = 1; })).toBe(false);
      expect(sameAfter((s) => { s.petDay = '2026-08-08'; })).toBe(false);
    });
  });
});

describe('a real save taken off a device (regression)', () => {
  // 2026-08-07, Android 14 emulator: FRESH install, entered the game, dismissed
  // the blocking intro carousel, did NOTHING else, waited ~2 minutes.
  // If this save isn't counted as "no progress," a player connecting a new
  // device sees a conflict screen with one side empty — that's exactly why this fix exists.
  const FRESH_DEVICE_SAVE = `{"v":2,"coins":300,"pearls":5,"xp":0,"level":1,
    "playerName":"Misafir-3400","friendCode":"REEF-A5NJZ",
    "fishes":[{"sp":"lepistes","progress":1,"hunger":0.8723086425924178,"name":"Baloncuk","seed":11,"tank":"tank-mercan-koyu","bonus":0},
              {"sp":"neon-tetra","progress":1,"hunger":0.8223086425924178,"name":"Mercan","seed":42,"tank":"tank-mercan-koyu","bonus":0}],
    "collection":["lepistes","neon-tetra"],"feedOwned":{},"decorOwned":{},
    "decorPlaced":{"tank-mercan-koyu":[]},
    "dirtSpots":{"tank-mercan-koyu":[{"id":1786133268777,"fx":0.8891914043191127,"fy":0.6384453675154558,"r":0.9321811922629964,"kind":0}]},
    "tanksOwned":["tank-mercan-koyu"],"activeTank":"tank-mercan-koyu","friends":[],
    "friendVisits":{"day":"","visited":[],"count":0},"friendGifts":{"day":"","gifted":[]},
    "quests":{"day":"2026-08-07","progress":{},"claimed":[]},
    "weeklyQuest":{"day":"2026-08-03","progress":{},"claimed":[]},
    "achievementsClaimed":[],
    "stats":{"totalSold":0,"totalEarned":0,"totalFed":0,"eggsHatched":0,"decorPlacedCount":0,"totalCleaned":0},
    "pityCounter":0,"streak":1,"bestStreak":1,"incomePot":0.8729814588888655,
    "cleanRewardDay":"","cleanRewardCount":0,"petDay":"","music":true,"sfx":true,
    "lastSeen":1786133295173,"lastDaily":"2026-08-07","tutorialDone":true,
    "feedHintSeen":false,"editHintSeen":false,"adsRemoved":false,"lang":"en"}`;

  it('does NOT count an untouched device save as progress', () => {
    const s = parseSave(FRESH_DEVICE_SAVE);
    expect(s).not.toBeNull();
    expect(hasProgress(s!)).toBe(false);
  });

  it('counts the same save as progress once a single feed is dropped', () => {
    const s = parseSave(FRESH_DEVICE_SAVE)!;
    s.stats.totalFed = 1;
    expect(hasProgress(s)).toBe(true);
  });

  it('counts the same save as progress once a fish is bought', () => {
    const s = parseSave(FRESH_DEVICE_SAVE)!;
    s.coins = 145;
    expect(hasProgress(s)).toBe(true);
  });
});

describe('corrupt and incomplete data', () => {
  it('keeps an untouched save from the cloud untouched', () => {
    const restored = parseSave(JSON.stringify(defaultSave()));
    expect(restored).not.toBeNull();
    expect(hasProgress(restored!)).toBe(false);
  });

  it('keeps a progressed save from the cloud progressed', () => {
    const s = defaultSave();
    s.level = 7;
    const restored = parseSave(JSON.stringify(s));
    expect(hasProgress(restored!)).toBe(true);
  });

  it('evaluates a half-written save after migrate without throwing', () => {
    const restored = parseSave(JSON.stringify({ v: 2, coins: 300 }));
    expect(restored).not.toBeNull();
    expect(() => hasProgress(restored!)).not.toThrow();
  });

  it('still sees real progress in an incomplete save', () => {
    const restored = parseSave(JSON.stringify({ v: 2, coins: 5000 }));
    expect(hasProgress(restored!)).toBe(true);
  });

  it('a save written before the timed egg gets an empty queue, not undefined', () => {
    const restored = parseSave(JSON.stringify({ v: 2, coins: 300 }));
    expect(restored!.pendingEggs).toEqual([]);
    expect(hasProgress(restored!)).toBe(false);
  });

  it('a non-array pendingEggs is replaced rather than trusted', () => {
    const restored = parseSave(JSON.stringify({ v: 2, coins: 300, pendingEggs: 'x' }));
    expect(restored!.pendingEggs).toEqual([]);
  });

  it('an incubating egg survives the cloud round trip', () => {
    const s = defaultSave();
    s.pendingEggs = [{ id: 3, tier: 'abis', readyAt: 1_800_000_000_000 }];
    const restored = parseSave(JSON.stringify(s));
    expect(restored!.pendingEggs).toEqual([{ id: 3, tier: 'abis', readyAt: 1_800_000_000_000 }]);
  });

  it('a save written before the first event gets an empty event state', () => {
    const restored = parseSave(JSON.stringify({ v: 2, coins: 300 }));
    expect(restored!.event).toEqual({ id: '', points: 0, claimed: [] });
    expect(hasProgress(restored!)).toBe(false);
  });

  it('a hand-edited event state is repaired field by field, not trusted', () => {
    const restored = parseSave(JSON.stringify({ v: 2, coins: 300, event: { points: 'x', claimed: 5 } }));
    expect(restored!.event).toEqual({ id: '', points: 0, claimed: [] });
  });

  it('festival progress survives the cloud round trip', () => {
    const s = defaultSave();
    s.event = { id: 'coral-festival-2026-08', points: 420, claimed: [0, 1] };
    const restored = parseSave(JSON.stringify(s));
    expect(restored!.event).toEqual({ id: 'coral-festival-2026-08', points: 420, claimed: [0, 1] });
  });

  it('has parseSave reject malformed JSON', () => {
    expect(parseSave('{bozuk')).toBeNull();
    expect(parseSave('null')).toBeNull();
  });
});
