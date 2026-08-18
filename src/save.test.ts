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

describe('dokunulmamış kayıt', () => {
  it('varsayılan kayıtta ilerleme yoktur', () => {
    expect(hasProgress(defaultSave())).toBe(false);
  });

  it('varsayılanın rastgele alanları (ad, arkadaş kodu) ilerleme saydırmaz', () => {
    // Every call generates a new name and code; none of them is a player choice.
    for (let i = 0; i < 25; i++) expect(hasProgress(defaultSave())).toBe(false);
  });

  it('diskten okunan taze kayıt da bakir sayılır', () => {
    persist(defaultSave());
    expect(hasProgress(loadSave())).toBe(false);
  });

  it('kayıt hiç yokken üretilen varsayılan da bakirdir', () => {
    expect(hasProgress(loadSave())).toBe(false);
  });
});

describe('ilerleme sayılan sinyaller', () => {
  it('satılan balık', () => {
    expect(withChange((s) => { s.stats.totalSold = 1; })).toBe(true);
  });

  it('kazanılan altın', () => {
    expect(withChange((s) => { s.stats.totalEarned = 1; })).toBe(true);
  });

  it('atılan yem', () => {
    expect(withChange((s) => { s.stats.totalFed = 1; })).toBe(true);
  });

  it('çıkan yumurta', () => {
    expect(withChange((s) => { s.stats.eggsHatched = 1; })).toBe(true);
  });

  it('incubating egg', () => {
    expect(withChange((s) => { s.pendingEggs = [{ id: 1, tier: 'abis', readyAt: Date.now() + 1000 }]; })).toBe(true);
  });

  it('yerleştirilen dekor sayacı', () => {
    expect(withChange((s) => { s.stats.decorPlacedCount = 1; })).toBe(true);
  });

  it('temizlenen kir sayacı', () => {
    expect(withChange((s) => { s.stats.totalCleaned = 1; })).toBe(true);
  });

  it('seviye', () => {
    expect(withChange((s) => { s.level = 2; })).toBe(true);
  });

  it('deneyim puanı', () => {
    expect(withChange((s) => { s.xp = 1; })).toBe(true);
  });

  it('başlangıçtan farklı altın — hem fazlası hem eksiği', () => {
    expect(withChange((s) => { s.coins = START_COINS + 1; })).toBe(true);
    expect(withChange((s) => { s.coins = START_COINS - 1; })).toBe(true);
  });

  it('başlangıçtan farklı inci — hem fazlası hem eksiği', () => {
    expect(withChange((s) => { s.pearls = START_PEARLS + 1; })).toBe(true);
    expect(withChange((s) => { s.pearls = START_PEARLS - 1; })).toBe(true);
  });

  it('balık sayısının değişmesi — hem artması hem azalması', () => {
    expect(withChange((s) => { s.fishes = s.fishes.slice(0, START_FISH_COUNT - 1); })).toBe(true);
    expect(withChange((s) => { s.fishes = [...s.fishes, { ...s.fishes[0], seed: 99 }]; })).toBe(true);
  });

  it('koleksiyona giren YENİ tür (açılış balıkları dışında)', () => {
    expect(withChange((s) => { s.collection = ['zebra-danio']; })).toBe(true);
  });

  it('açılış balıklarının yanına eklenen yeni tür', () => {
    expect(withChange((s) => {
      s.collection = [...s.fishes.map((f) => f.sp), 'zebra-danio'];
    })).toBe(true);
  });

  it('alınan başarım ödülü', () => {
    expect(withChange((s) => { s.achievementsClaimed = ['ilk-satis']; })).toBe(true);
  });

  it('ikinci akvaryum', () => {
    expect(withChange((s) => { s.tanksOwned = [...s.tanksOwned, 'tank-derin-mavi']; })).toBe(true);
  });

  it('stoktaki yem', () => {
    expect(withChange((s) => { s.feedOwned = { 'feed-basic': 3 }; })).toBe(true);
  });

  it('sahip olunan dekor', () => {
    expect(withChange((s) => { s.decorOwned = { 'decor-kaya': 1 }; })).toBe(true);
  });

  it('akvaryuma yerleştirilmiş dekor', () => {
    expect(withChange((s) => {
      s.decorPlaced[s.activeTank] = [{ def: 'decor-kaya', fx: 0.5 }];
    })).toBe(true);
  });

  it('eklenen arkadaş', () => {
    expect(withChange((s) => { s.friends = [{ code: 'REEF-ABCDE', name: 'Ali' }]; })).toBe(true);
  });

  it('arkadaş ziyareti — sayaç', () => {
    expect(withChange((s) => { s.friendVisits = { day: '2026-08-07', visited: [], count: 1 }; })).toBe(true);
  });

  it('arkadaş ziyareti — ziyaret listesi', () => {
    expect(withChange((s) => {
      s.friendVisits = { day: '2026-08-07', visited: ['REEF-ABCDE'], count: 0 };
    })).toBe(true);
  });

  it('arkadaşa gönderilen hediye', () => {
    expect(withChange((s) => {
      s.friendGifts = { day: '2026-08-07', gifted: ['REEF-ABCDE'] };
    })).toBe(true);
  });

  it('günlük görev ilerlemesi', () => {
    expect(withChange((s) => { s.quests.progress = { 'feed-5': 2 }; })).toBe(true);
  });

  it('alınan günlük görev ödülü', () => {
    expect(withChange((s) => { s.quests.claimed = ['feed-5']; })).toBe(true);
  });

  it('haftalık görev ilerlemesi', () => {
    expect(withChange((s) => { s.weeklyQuest.progress = { 'sell-20': 3 }; })).toBe(true);
  });

  it('alınan haftalık görev ödülü', () => {
    expect(withChange((s) => { s.weeklyQuest.claimed = ['sell-20']; })).toBe(true);
  });

  it('efsanevi garanti sayacı', () => {
    expect(withChange((s) => { s.pityCounter = 1; })).toBe(true);
  });

  it('1 günden uzun seri — gerçek geri dönüş', () => {
    expect(withChange((s) => { s.streak = 2; })).toBe(true);
  });

  it('1 günden uzun en iyi seri', () => {
    expect(withChange((s) => { s.bestStreak = 2; })).toBe(true);
  });

  it('bugün ödüllü temizlenen leke', () => {
    expect(withChange((s) => { s.cleanRewardCount = 1; })).toBe(true);
  });

  it('okşanan balık', () => {
    expect(withChange((s) => { s.petDay = '2026-08-07'; })).toBe(true);
  });

  it('oyuncunun kendi seçtiği ad', () => {
    expect(withChange((s) => { s.playerName = 'Kaptan'; })).toBe(true);
  });

  it('varsayılan ada benzeyen ama oyuncunun yazdığı ad', () => {
    // If the digit count doesn't match, it couldn't have come from the default generator.
    expect(withChange((s) => { s.playerName = 'Misafir-12345'; })).toBe(true);
    expect(withChange((s) => { s.playerName = 'Misafir-12'; })).toBe(true);
    expect(withChange((s) => { s.playerName = 'misafir-1234'; })).toBe(true);
  });
});

describe('bilerek yok sayılan alanlar — hızlı yolu bozmamalı', () => {
  it('son görülme zamanı', () => {
    expect(withChange((s) => { s.lastSeen = Date.now() + 86_400_000; })).toBe(false);
  });

  it('biriken (henüz toplanmamış) pasif gelir', () => {
    // Grows on its own while the player is watching the screen; gets written to totalEarned when collected.
    expect(withChange((s) => { s.incomePot = 999; })).toBe(false);
  });

  it('kendiliğinden çıkan kir lekeleri', () => {
    expect(withChange((s) => {
      s.dirtSpots[s.activeTank] = [{ id: 1, fx: 0.3, fy: 0.4, r: 1, kind: 0 }];
    })).toBe(false);
  });

  it('balıkların büyüme ve tokluk değerleri', () => {
    expect(withChange((s) => {
      for (const f of s.fishes) { f.progress = 1; f.hunger = 0; }
    })).toBe(false);
  });

  it('balıklarda biriken satış bonusu', () => {
    expect(withChange((s) => { s.fishes[0].bonus = 0.4; })).toBe(false);
  });

  it('ilk açılışta kurulan gün sayacı ve 1 değerindeki seri', () => {
    // game.ts applyDailyGift: on first launch it sets up lastDaily/streak WITHOUT giving a gift.
    expect(withChange((s) => {
      s.lastDaily = '2026-08-07';
      s.streak = 1;
      s.bestStreak = 1;
    })).toBe(false);
  });

  it('açılışta kurulan görev günü', () => {
    expect(withChange((s) => {
      s.quests.day = '2026-08-07';
      s.weeklyQuest.day = '2026-08-03';
    })).toBe(false);
  });

  it('sıfır ilerlemeli görev girdileri', () => {
    expect(withChange((s) => { s.quests.progress = { 'feed-5': 0 }; })).toBe(false);
  });

  it('boş dekor listeleri', () => {
    expect(withChange((s) => { s.decorPlaced = { [s.activeTank]: [], 'tank-derin-mavi': [] }; })).toBe(false);
  });

  it('ses ve müzik ayarları', () => {
    expect(withChange((s) => { s.music = false; s.sfx = false; })).toBe(false);
  });

  it('dil tercihi', () => {
    expect(withChange((s) => { s.lang = s.lang === 'tr' ? 'en' : 'tr'; })).toBe(false);
  });

  it('bir kez gösterilen arayüz ipuçları', () => {
    expect(withChange((s) => { s.feedHintSeen = true; s.editHintSeen = true; })).toBe(false);
  });

  it('engelleyici giriş karuselinin kapatılması (tutorialDone)', () => {
    // The carousel appears as soon as the game opens and settings are only
    // reachable once it's dismissed; this does NOT mean "the player achieved something."
    expect(withChange((s) => { s.tutorialDone = true; })).toBe(false);
  });

  it('kendi kendine yetişkin olan açılış balıkları koleksiyona girince', () => {
    // The two starter fish begin half-grown; even if the player does nothing,
    // they'll drop into the collection within a few minutes.
    expect(withChange((s) => {
      s.collection = s.fishes.map((f) => f.sp);
      for (const f of s.fishes) f.progress = 1;
    })).toBe(false);
  });

  it('ödüllü temizlik gününün kendisi (sayaç sıfırken)', () => {
    expect(withChange((s) => { s.cleanRewardDay = '2026-08-07'; })).toBe(false);
  });

  it('arkadaş kodu', () => {
    expect(withChange((s) => { s.friendCode = 'REEF-ZZZZZ'; })).toBe(false);
  });

  it('reklamsız sürüm hakkı — zaten buluttan geri yüklenmez', () => {
    expect(withChange((s) => { s.adsRemoved = true; })).toBe(false);
  });

  it('boş gün alanlı ziyaret/hediye defterleri', () => {
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
describe('ilerleme parmak izi', () => {
  /** Two copies of the same save: the given mutation is applied to the second one. */
  function sameAfter(mutate: (s: SaveData) => void): boolean {
    const a = defaultSave();
    const b = JSON.parse(JSON.stringify(a)) as SaveData;
    mutate(b);
    return progressFingerprint(a) === progressFingerprint(b);
  }

  describe('aynı sayılması gerekenler', () => {
    it('kaydın kendi kopyası', () => {
      expect(sameAfter(() => {})).toBe(true);
    });

    it('kendiliğinden ilerleyen alanların hepsi bir arada', () => {
      // State after a few minutes in the game — the player did nothing.
      expect(sameAfter((s) => {
        s.lastSeen += 300_000;
        s.incomePot = 42.7;
        s.dirtSpots[s.activeTank] = [{ id: 7, fx: 0.3, fy: 0.4, r: 1, kind: 0 }];
        for (const f of s.fishes) { f.progress = 1; f.hunger = 0.2; }
      })).toBe(true);
    });

    it('cihaza ait ayarlar ve arayüz durumu', () => {
      expect(sameAfter((s) => {
        s.music = false;
        s.sfx = false;
        s.lang = s.lang === 'tr' ? 'en' : 'tr';
        s.tutorialDone = true;
        s.feedHintSeen = true;
        s.editHintSeen = true;
      })).toBe(true);
    });

    it('reklamsız sürüm hakkı — pakete zaten hiç girmez', () => {
      expect(sameAfter((s) => { s.adsRemoved = true; })).toBe(true);
    });

    it('dizilerin sırası — balık listesi her syncSave\'de sahneden kurulur', () => {
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

    it('sıfır değerli girdi ile hiç olmayan girdi', () => {
      // When feed runs out {feed: 0} is left behind; on the other device that key doesn't exist at all.
      expect(sameAfter((s) => {
        s.feedOwned = { 'feed-basic': 0 };
        s.decorOwned = { 'decor-kaya': 0 };
        s.quests.progress = { 'feed-5': 0 };
        s.decorPlaced = { ...s.decorPlaced, 'tank-derin-mavi': [] };
      })).toBe(true);
    });

    it('JSON turundan (buluta yaz - buluttan oku) geçmiş kayıt', () => {
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

    it('paketten çıkarılmış reklamsız hakkıyla birlikte JSON turu', () => {
      // A real upload strips the adsRemoved field; it comes back as false when read.
      const s = defaultSave();
      s.adsRemoved = true;
      const stripped: Record<string, unknown> = { ...s };
      delete stripped.adsRemoved;
      const round = parseSave(JSON.stringify(stripped));
      expect(progressFingerprint(round!)).toBe(progressFingerprint(s));
    });
  });

  describe('farklı sayılması gerekenler', () => {
    it('iki ayrı yeni kayıt (rastgele ad ve arkadaş kodu)', () => {
      expect(progressFingerprint(defaultSave())).not.toBe(progressFingerprint(defaultSave()));
    });

    it('para birimleri ve seviye', () => {
      expect(sameAfter((s) => { s.coins += 1; })).toBe(false);
      expect(sameAfter((s) => { s.pearls += 1; })).toBe(false);
      expect(sameAfter((s) => { s.xp += 1; })).toBe(false);
      expect(sameAfter((s) => { s.level += 1; })).toBe(false);
    });

    it('balık kadrosundaki her değişiklik', () => {
      expect(sameAfter((s) => { s.fishes.pop(); })).toBe(false);
      expect(sameAfter((s) => { s.fishes.push({ ...s.fishes[0], seed: 99 }); })).toBe(false);
      expect(sameAfter((s) => { s.fishes[0].name = 'Kaptan'; })).toBe(false);
      expect(sameAfter((s) => { s.fishes[0].tank = 'tank-derin-mavi'; })).toBe(false);
      expect(sameAfter((s) => { s.fishes[0].bonus = 0.2; })).toBe(false);
    });

    it('koleksiyon, başarımlar ve akvaryumlar', () => {
      expect(sameAfter((s) => { s.collection = ['zebra-danio']; })).toBe(false);
      expect(sameAfter((s) => { s.achievementsClaimed = ['ilk-satis']; })).toBe(false);
      expect(sameAfter((s) => { s.tanksOwned = [...s.tanksOwned, 'tank-derin-mavi']; })).toBe(false);
      expect(sameAfter((s) => { s.activeTank = 'tank-derin-mavi'; })).toBe(false);
    });

    it('envanter ve yerleştirilmiş dekor', () => {
      expect(sameAfter((s) => { s.feedOwned = { 'feed-basic': 1 }; })).toBe(false);
      expect(sameAfter((s) => { s.decorOwned = { 'decor-kaya': 1 }; })).toBe(false);
      expect(sameAfter((s) => { s.decorPlaced[s.activeTank] = [{ def: 'decor-kaya', fx: 0.5 }]; })).toBe(false);
      expect(sameAfter((s) => { s.decorPlaced[s.activeTank] = [{ def: 'decor-kaya', fx: 0.6 }]; })).toBe(false);
    });

    it('istatistiklerin her biri', () => {
      expect(sameAfter((s) => { s.stats.totalSold = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.totalEarned = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.totalFed = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.eggsHatched = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.decorPlacedCount = 1; })).toBe(false);
      expect(sameAfter((s) => { s.stats.totalCleaned = 1; })).toBe(false);
    });

    it('görev defterleri', () => {
      expect(sameAfter((s) => { s.quests.day = '2026-08-08'; })).toBe(false);
      expect(sameAfter((s) => { s.quests.progress = { 'feed-5': 2 }; })).toBe(false);
      expect(sameAfter((s) => { s.quests.claimed = ['feed-5']; })).toBe(false);
      expect(sameAfter((s) => { s.weeklyQuest.progress = { 'sell-20': 3 }; })).toBe(false);
      expect(sameAfter((s) => { s.weeklyQuest.claimed = ['sell-20']; })).toBe(false);
    });

    it('arkadaşlar, ziyaretler ve hediyeler', () => {
      expect(sameAfter((s) => { s.friends = [{ code: 'REEF-ABCDE', name: 'Ali' }]; })).toBe(false);
      expect(sameAfter((s) => { s.friendVisits = { day: 'x', visited: ['REEF-ABCDE'], count: 1 }; })).toBe(false);
      expect(sameAfter((s) => { s.friendGifts = { day: 'x', gifted: ['REEF-ABCDE'] }; })).toBe(false);
    });

    it('kimlik alanları', () => {
      expect(sameAfter((s) => { s.playerName = 'Kaptan'; })).toBe(false);
      expect(sameAfter((s) => { s.friendCode = 'REEF-ZZZZZ'; })).toBe(false);
    });

    it('gün/seri defterleri ve sayaçlar', () => {
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

describe('cihazdan alınmış gerçek kayıt (regresyon)', () => {
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

  it('dokunulmamış cihaz kaydı ilerleme SAYILMAZ', () => {
    const s = parseSave(FRESH_DEVICE_SAVE);
    expect(s).not.toBeNull();
    expect(hasProgress(s!)).toBe(false);
  });

  it('aynı kayıt tek bir yem atılınca ilerleme sayılır', () => {
    const s = parseSave(FRESH_DEVICE_SAVE)!;
    s.stats.totalFed = 1;
    expect(hasProgress(s)).toBe(true);
  });

  it('aynı kayıt mağazadan balık alınınca ilerleme sayılır', () => {
    const s = parseSave(FRESH_DEVICE_SAVE)!;
    s.coins = 145;
    expect(hasProgress(s)).toBe(true);
  });
});

describe('bozuk ve eksik veri', () => {
  it('buluttan gelen bakir kayıt bakir kalır', () => {
    const restored = parseSave(JSON.stringify(defaultSave()));
    expect(restored).not.toBeNull();
    expect(hasProgress(restored!)).toBe(false);
  });

  it('buluttan gelen ilerlemeli kayıt ilerlemeli kalır', () => {
    const s = defaultSave();
    s.level = 7;
    const restored = parseSave(JSON.stringify(s));
    expect(hasProgress(restored!)).toBe(true);
  });

  it('yarım (alanları eksik) kayıt migrate sonrası çökmeden değerlendirilir', () => {
    const restored = parseSave(JSON.stringify({ v: 2, coins: 300 }));
    expect(restored).not.toBeNull();
    expect(() => hasProgress(restored!)).not.toThrow();
  });

  it('eksik kayıtta gerçek ilerleme hâlâ görülür', () => {
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

  it('bozuk JSON parseSave tarafından reddedilir', () => {
    expect(parseSave('{bozuk')).toBeNull();
    expect(parseSave('null')).toBeNull();
  });
});
