// Platform servisleri soyutlama katmanı.
//
// Web/geliştirme ortamında yerel (local) sağlayıcılar çalışır.
// Capacitor ile paketlerken bu arayüzlerin native karşılıkları bağlanır:
//   - Auth   -> Google Play Games Services / Apple Game Center
//   - IAP    -> Google Play Billing / Apple StoreKit (örn. RevenueCat üzerinden)
//   - Social -> Play Games liderlik tablosu / Game Center veya Firebase backend
// Oyun kodu yalnızca bu arayüzleri kullanır; sağlayıcı değişimi tek satırdır.

import type { SaveData } from './save';

// ---------- Kimlik / giriş ----------

export interface PlayerIdentity {
  id: string;
  name: string;
  platform: 'local' | 'play-games' | 'game-center';
}

export interface AuthProvider {
  readonly platformLabel: string;
  current(): PlayerIdentity | null;
  signIn(): Promise<{ ok: boolean; msg: string }>;
}

export class LocalAuth implements AuthProvider {
  readonly platformLabel = 'Misafir (yerel kayıt)';
  constructor(private save: SaveData) {}
  current(): PlayerIdentity {
    return { id: this.save.friendCode, name: this.save.playerName, platform: 'local' };
  }
  signIn(): Promise<{ ok: boolean; msg: string }> {
    return Promise.resolve({
      ok: false,
      msg: 'Google Play Games / Game Center girişi mobil pakette etkinleşir. Şimdilik ilerlemen bu cihazda güvenle saklanıyor.',
    });
  }
}

// ---------- Mikro ödemeler ----------

export interface IAPPack {
  id: string;
  name: string;
  pearls: number;
  bonus: string;
  priceLabel: string; // gerçek fiyat mağaza API'sinden gelir; bu etiket tanıtım amaçlı
  emoji: string;
}

export const IAP_PACKS: IAPPack[] = [
  { id: 'pearls-s',  name: 'Avuç İnci',      pearls: 60,   bonus: '',          priceLabel: '₺39,99',  emoji: '🫧' },
  { id: 'pearls-m',  name: 'Kese İnci',      pearls: 170,  bonus: '+%15 bonus', priceLabel: '₺99,99',  emoji: '👛' },
  { id: 'pearls-l',  name: 'Sandık İnci',    pearls: 450,  bonus: '+%25 bonus', priceLabel: '₺229,99', emoji: '🧰' },
  { id: 'pearls-xl', name: 'Hazine İnci',    pearls: 1000, bonus: '+%40 bonus', priceLabel: '₺449,99', emoji: '💎' },
  { id: 'starter',   name: 'Başlangıç Paketi', pearls: 80, bonus: '+5.000 altın', priceLabel: '₺49,99', emoji: '🎁' },
];

export interface IAPProvider {
  packs(): IAPPack[];
  /** Satın alma akışı. Web sürümünde bilgilendirme döner; native pakette mağazaya bağlanır. */
  purchase(packId: string): Promise<{ ok: boolean; msg: string; grantPearls?: number; grantCoins?: number }>;
  readonly storeLabel: string;
}

export class StubIAP implements IAPProvider {
  readonly storeLabel = 'Web önizleme';
  packs(): IAPPack[] { return IAP_PACKS; }
  purchase(): Promise<{ ok: boolean; msg: string }> {
    return Promise.resolve({
      ok: false,
      msg: 'Gerçek satın alma Google Play / App Store sürümünde etkinleşir. Bu önizlemede inci kazanmak için görevleri ve seviye ödüllerini kullanabilirsin.',
    });
  }
}

// ---------- Sosyal: arkadaşlar + liderlik ----------

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;   // toplam kazanç
  isPlayer: boolean;
  isBot: boolean;
}

export interface SocialProvider {
  readonly label: string;
  leaderboard(save: SaveData): LeaderboardEntry[];
  addFriend(save: SaveData, code: string): { ok: boolean; msg: string };
}

/**
 * Yerel sosyal sağlayıcı: liderlik tablosu, oyuncunun skorunu topluluk
 * botlarıyla kıyaslar (çevrimiçi sürümde gerçek oyuncularla değişir).
 * Arkadaş kodları kaydedilir ve backend bağlandığında eşleşir.
 */
/** Ziyaret/hediye ödülleri arkadaş başına günlük verildiği için kod kodu spam'iyle
 * sınırsız altın/yem çiftliğini önlemek amacıyla listeye üst sınır konur. */
const MAX_FRIENDS = 50;

export class LocalSocial implements SocialProvider {
  readonly label = 'Yerel mod — çevrimiçi liderlik mobil sürümde';

  private bots = [
    { name: 'MercanKral 🤖', mult: 3.2 },
    { name: 'DerinMavi 🤖', mult: 2.1 },
    { name: 'KaptanYosun 🤖', mult: 1.6 },
    { name: 'İnciAvcısı 🤖', mult: 1.25 },
    { name: 'BalonBalık 🤖', mult: 0.85 },
    { name: 'MinikYüzgeç 🤖', mult: 0.5 },
    { name: 'TembelDeniz 🤖', mult: 0.2 },
  ];

  leaderboard(save: SaveData): LeaderboardEntry[] {
    const base = Math.max(1000, save.stats.totalEarned);
    const rows = this.bots.map((b) => ({
      name: b.name,
      score: Math.round((base * b.mult) / 10) * 10,
      isPlayer: false,
      isBot: true,
    }));
    rows.push({ name: save.playerName + ' (sen)', score: save.stats.totalEarned, isPlayer: true, isBot: false });
    for (const f of save.friends) {
      rows.push({ name: f.name + ' ⏳', score: 0, isPlayer: false, isBot: false });
    }
    rows.sort((a, b) => b.score - a.score);
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  addFriend(save: SaveData, code: string): { ok: boolean; msg: string } {
    const c = code.trim().toUpperCase();
    if (!/^REEF-[A-Z0-9]{5}$/.test(c)) return { ok: false, msg: 'Geçersiz kod. Örnek biçim: REEF-AB12C' };
    if (c === save.friendCode) return { ok: false, msg: 'Bu senin kendi kodun! 😄' };
    if (save.friends.some((f) => f.code === c)) return { ok: false, msg: 'Bu arkadaş zaten listende.' };
    if (save.friends.length >= MAX_FRIENDS) return { ok: false, msg: `En fazla ${MAX_FRIENDS} arkadaş ekleyebilirsin.` };
    save.friends.push({ code: c, name: 'Dost ' + c.slice(5) });
    return {
      ok: true,
      msg: 'Arkadaş kodu kaydedildi! Çevrimiçi sürümde otomatik eşleşecek. 🤝',
    };
  }
}

// ---------- Servis kayıt noktası ----------

export interface Services {
  auth: AuthProvider;
  iap: IAPProvider;
  social: SocialProvider;
}

export function createServices(save: SaveData): Services {
  // Capacitor paketinde burada platforma göre native sağlayıcılar seçilir.
  return {
    auth: new LocalAuth(save),
    iap: new StubIAP(),
    social: new LocalSocial(),
  };
}
