// Platform servisleri soyutlama katmanı.
//
// Web/geliştirme ortamında yerel (local) sağlayıcılar çalışır.
// Capacitor ile paketlerken bu arayüzlerin native karşılıkları bağlanır:
//   - Auth   -> Google Play Games Services / Apple Game Center (bağlandı, bkz. NativeGameAuth)
//   - IAP    -> Google Play Billing / Apple StoreKit (örn. RevenueCat üzerinden)
//   - Social -> arkadaş kodu doğrulaması ve arkadaş skorları Firebase/Firestore ile
//              (bağlandı, bkz. FirebaseSocial); liderlik tablosundaki botlar hâlâ simüle
// Oyun kodu yalnızca bu arayüzleri kullanır; sağlayıcı değişimi tek satırdır.

import { Capacitor } from '@capacitor/core';
import { CapacitorGameConnect } from '@openforge/capacitor-game-connect';
import { Purchases, PURCHASES_ERROR_CODE, type PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { AdMobAds, StubAds, type AdsProvider } from './ads';
import { FIREBASE_CONFIG, isFirebaseConfigured } from './firebase-config';
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

/**
 * Native (Capacitor) paketlerde Apple Game Center (iOS) / Google Play Games (Android)
 * üzerinden gerçek giriş. @openforge/capacitor-game-connect eklentisini kullanır;
 * eklentinin signIn() API'si her iki platformda da aynıdır, sadece etiket ve
 * PlayerIdentity.platform alanı ayrışır.
 *
 * Kurulum notları:
 *   - iOS: Xcode'da hedef uygulamaya "Game Center" capability'si eklenmeli
 *     (ios/App/App/App.entitlements zaten eklendi, capability'yi
 *     Xcode > Signing & Capabilities'ten açman pbxproj'a doğru şekilde bağlar)
 *     ve App Store Connect > Özellikler sekmesinden Game Center etkinleştirilmelidir.
 *   - Android: android/app/src/main/res/values/strings.xml içindeki
 *     game_services_project_id yer tutucusu, Play Console > Play Games Services
 *     ile alınan gerçek proje ID'siyle değiştirilmeli; aksi halde signIn() başarısız olur.
 *
 * Web'de bu sınıf hiç seçilmez; createServices() platforma göre seçer.
 */
export class NativeGameAuth implements AuthProvider {
  readonly platformLabel: string;
  private readonly platform: 'game-center' | 'play-games';
  private identity: PlayerIdentity | null = null;

  constructor(private save: SaveData) {
    this.platform = Capacitor.getPlatform() === 'ios' ? 'game-center' : 'play-games';
    this.platformLabel = this.platform === 'game-center' ? 'Game Center' : 'Play Games';
  }

  current(): PlayerIdentity | null {
    return this.identity;
  }

  async signIn(): Promise<{ ok: boolean; msg: string }> {
    try {
      const res = await CapacitorGameConnect.signIn();
      this.identity = { id: res.player_id, name: res.player_name, platform: this.platform };
      // Oyun içi isim/kimliği native oyuncu adıyla senkronla (yerel yedek olarak kalır).
      this.save.playerName = res.player_name || this.save.playerName;
      return { ok: true, msg: `${this.platformLabel}'a giriş yapıldı: ${res.player_name} 🎮` };
    } catch {
      return { ok: false, msg: `${this.platformLabel} girişi başarısız. Hesabın cihazda oturum açık mı kontrol et.` };
    }
  }
}

/** Yalnızca native (Capacitor) ortamda (iOS veya Android) çalışırken oyun platformu girişi kullanılabilir olur. */
export function isNativeGameAuthAvailable(): boolean {
  return Capacitor.isNativePlatform() && (Capacitor.getPlatform() === 'ios' || Capacitor.getPlatform() === 'android');
}

// ---------- Mikro ödemeler ----------

export interface IAPPack {
  id: string;
  name: string;
  pearls: number;
  coins?: number;
  bonus: string;
  priceLabel: string; // gerçek fiyat mağaza API'sinden gelir; bu etiket tanıtım amaçlı
  emoji: string;
  removesAds?: boolean; // true ise inci/altın değil, kalıcı "reklamları kaldır" hakkı verir
}

// Not: id'ler Play Console'un "tek seferlik ürün" kimliği kısıtlamasına uygun
// olarak alt çizgi kullanır (tire desteklenmiyor) — bu id'ler RevenueCat/Play
// Billing'de mağazadaki ürün kimlikleriyle birebir eşleşmeli.
export const IAP_PACKS: IAPPack[] = [
  { id: 'pearls_s',  name: 'Avuç İnci',      pearls: 60,   bonus: '',          priceLabel: '₺39,99',  emoji: '🫧' },
  { id: 'pearls_m',  name: 'Kese İnci',      pearls: 170,  bonus: '+%15 bonus', priceLabel: '₺99,99',  emoji: '👛' },
  { id: 'pearls_l',  name: 'Sandık İnci',    pearls: 450,  bonus: '+%25 bonus', priceLabel: '₺229,99', emoji: '🧰' },
  { id: 'pearls_xl', name: 'Hazine İnci',    pearls: 1000, bonus: '+%40 bonus', priceLabel: '₺449,99', emoji: '💎' },
  { id: 'starter',   name: 'Başlangıç Paketi', pearls: 80, coins: 5000, bonus: '+5.000 altın', priceLabel: '₺49,99', emoji: '🎁' },
  { id: 'remove_ads', name: 'Reklamları Kaldır', pearls: 0, bonus: 'Geçiş reklamlarını kalıcı olarak kaldırır', priceLabel: '₺79,99', emoji: '🚫', removesAds: true },
];

export interface IAPProvider {
  packs(): IAPPack[];
  /** Satın alma akışı. Web sürümünde bilgilendirme döner; native pakette mağazaya bağlanır. */
  purchase(packId: string): Promise<{ ok: boolean; msg: string; grantPearls?: number; grantCoins?: number; grantRemovesAds?: boolean }>;
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

/**
 * RevenueCat API anahtarları (public SDK key'ler — Stripe publishable key gibi
 * istemci tarafında gömülü olması güvenlidir, gizli tutulması gereken key değildir).
 * RevenueCat dashboard > Project Settings > API Keys üzerinden alınır.
 * Doldurulmadan (yer tutucu değerdeyken) RevenueCatIAP.configure() atlanır ve
 * satın alma denemeleri "mağazaya bağlanılamadı" hatası döner.
 */
const REVENUECAT_API_KEYS: { android: string; ios: string } = {
  android: 'goog_lRHfCAmAuwPZrEvwJtzktoNWCWy',
  ios: 'REPLACE_WITH_REVENUECAT_APPLE_API_KEY',
};

/** Yalnızca çalışılan platformun key'i doldurulmuş olması yeterli — Android ve iOS
 * birbirinden bağımsız olarak devreye girer, biri beklerken diğeri engellenmez. */
function isRevenueCatConfigured(): boolean {
  const key = Capacitor.getPlatform() === 'ios' ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
  return !key.startsWith('REPLACE_');
}

/**
 * Native (Capacitor) paketlerde RevenueCat üzerinden gerçek Google Play Billing /
 * Apple StoreKit satın alma akışı. IAP_PACKS.id değerleri, RevenueCat dashboard'da
 * tanımlanan "current offering"in paket (package) identifier'larıyla birebir eşleşmelidir.
 *
 * Kurulum notları:
 *   - RevenueCat'te bir proje oluştur, Google Play / App Store Connect ürünlerini
 *     (pearls-s, pearls-m, pearls-l, pearls-xl, starter) tanımla ve bunları bir
 *     "offering" altında paketle.
 *   - REVENUECAT_API_KEYS içindeki yer tutucuları RevenueCat dashboard'daki
 *     gerçek public API key'lerle değiştir.
 *   - grantPearls/grantCoins miktarları RevenueCat'ten değil, doğrudan IAP_PACKS'ten
 *     okunur; yani gerçek para karşılığı verilecek miktar hep bu dosyada kontrol altında kalır.
 */
export class RevenueCatIAP implements IAPProvider {
  readonly storeLabel: string;
  private configured = false;
  private offeringsPromise: ReturnType<typeof Purchases.getOfferings> | null = null;

  constructor(appUserId: string) {
    this.storeLabel = Capacitor.getPlatform() === 'ios' ? 'App Store' : 'Google Play';
    if (!isRevenueCatConfigured()) return;
    const apiKey = Capacitor.getPlatform() === 'ios' ? REVENUECAT_API_KEYS.ios : REVENUECAT_API_KEYS.android;
    void Purchases.configure({ apiKey, appUserID: appUserId }).then(() => {
      this.configured = true;
    });
  }

  packs(): IAPPack[] { return IAP_PACKS; }

  private async findStorePackage(packId: string): Promise<PurchasesPackage | null> {
    if (!this.offeringsPromise) this.offeringsPromise = Purchases.getOfferings();
    const offerings = await this.offeringsPromise;
    const current = offerings.current;
    if (!current) return null;
    return current.availablePackages.find((p) => p.identifier === packId) ?? null;
  }

  async purchase(packId: string): Promise<{ ok: boolean; msg: string; grantPearls?: number; grantCoins?: number; grantRemovesAds?: boolean }> {
    const pack = IAP_PACKS.find((p) => p.id === packId);
    if (!pack) return { ok: false, msg: 'Bilinmeyen paket.' };
    if (!this.configured) {
      return { ok: false, msg: `${this.storeLabel} bağlantısı henüz kurulmadı. Lütfen daha sonra tekrar dene.` };
    }
    try {
      const storePackage = await this.findStorePackage(packId);
      if (!storePackage) {
        return { ok: false, msg: 'Bu paket şu anda mağazada bulunamadı.' };
      }
      await Purchases.purchasePackage({ aPackage: storePackage });
      return {
        ok: true,
        msg: `${pack.name} satın alındı! 🎉`,
        grantPearls: pack.pearls,
        grantCoins: pack.coins,
        grantRemovesAds: pack.removesAds,
      };
    } catch (err) {
      const rcError = err as { code?: PURCHASES_ERROR_CODE; message?: string };
      if (rcError.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { ok: false, msg: 'Satın alma iptal edildi.' };
      }
      return { ok: false, msg: `Satın alma başarısız: ${rcError.message ?? 'bilinmeyen hata'}` };
    }
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
  leaderboard(save: SaveData, friendScores?: Record<string, number>): LeaderboardEntry[];
  addFriend(save: SaveData, code: string): Promise<{ ok: boolean; msg: string }>;
  /** Arkadaş kodu -> güncel skor. Sağlayıcı gerçek skorları desteklemiyorsa boş döner. */
  friendScores(save: SaveData): Promise<Record<string, number>>;
  /** Oyuncunun kendi skorunu arkadaşlarının görebilmesi için sağlayıcıya bildirir (fire-and-forget). */
  updateScore?(save: SaveData): void;
}

/** Ziyaret/hediye ödülleri arkadaş başına günlük verildiği için kod kodu spam'iyle
 * sınırsız altın/yem çiftliğini önlemek amacıyla listeye üst sınır konur. */
const MAX_FRIENDS = 50;

const BOTS = [
  { name: 'MercanKral 🤖', mult: 3.2 },
  { name: 'DerinMavi 🤖', mult: 2.1 },
  { name: 'KaptanYosun 🤖', mult: 1.6 },
  { name: 'İnciAvcısı 🤖', mult: 1.25 },
  { name: 'BalonBalık 🤖', mult: 0.85 },
  { name: 'MinikYüzgeç 🤖', mult: 0.5 },
  { name: 'TembelDeniz 🤖', mult: 0.2 },
];

/** Liderlik tablosu, oyuncunun skorunu topluluk botlarıyla kıyaslar. Arkadaşların
 * skoru `friendScores` (kod -> skor) ile geldiyse gerçek değer, gelmediyse
 * (sağlayıcı desteklemiyor veya henüz çekilmedi) ⏳ placeholder gösterilir.
 * LocalSocial ve FirebaseSocial aynı liderlik mantığını paylaşır. */
function buildLocalLeaderboard(save: SaveData, friendScores: Record<string, number> = {}): LeaderboardEntry[] {
  const base = Math.max(1000, save.stats.totalEarned);
  const rows = BOTS.map((b) => ({
    name: b.name,
    score: Math.round((base * b.mult) / 10) * 10,
    isPlayer: false,
    isBot: true,
  }));
  rows.push({ name: save.playerName + ' (sen)', score: save.stats.totalEarned, isPlayer: true, isBot: false });
  for (const f of save.friends) {
    const score = friendScores[f.code];
    rows.push({
      name: score === undefined ? f.name + ' ⏳' : f.name,
      score: score ?? 0,
      isPlayer: false,
      isBot: false,
    });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Ortak biçim/tekrar/üst-sınır kontrolleri — hem yerel hem Firebase sağlayıcı
 * ağa gitmeden önce bunları senkron olarak eler. */
function validateFriendCode(save: SaveData, code: string): { c: string } | { msg: string } {
  const c = code.trim().toUpperCase();
  if (!/^REEF-[A-Z0-9]{5}$/.test(c)) return { msg: 'Geçersiz kod. Örnek biçim: REEF-AB12C' };
  if (c === save.friendCode) return { msg: 'Bu senin kendi kodun! 😄' };
  if (save.friends.some((f) => f.code === c)) return { msg: 'Bu arkadaş zaten listende.' };
  if (save.friends.length >= MAX_FRIENDS) return { msg: `En fazla ${MAX_FRIENDS} arkadaş ekleyebilirsin.` };
  return { c };
}

/**
 * Yerel sosyal sağlayıcı: arkadaş kodları biçim olarak doğrulanır ve
 * kaydedilir, ama karşı tarafın gerçekten var olup olmadığı kontrol
 * edilmez — bunun için bkz. FirebaseSocial. Firebase yapılandırılmadığında
 * (bkz. isFirebaseConfigured) createServices() bu sağlayıcıya düşer.
 */
export class LocalSocial implements SocialProvider {
  readonly label = 'Yerel mod — çevrimiçi liderlik mobil sürümde';

  leaderboard(save: SaveData, friendScores: Record<string, number> = {}): LeaderboardEntry[] {
    return buildLocalLeaderboard(save, friendScores);
  }

  async friendScores(): Promise<Record<string, number>> {
    return {};
  }

  async addFriend(save: SaveData, code: string): Promise<{ ok: boolean; msg: string }> {
    const v = validateFriendCode(save, code);
    if (!('c' in v)) return { ok: false, msg: v.msg };
    save.friends.push({ code: v.c, name: 'Dost ' + v.c.slice(5) });
    return {
      ok: true,
      msg: 'Arkadaş kodu kaydedildi! Çevrimiçi sürümde otomatik eşleşecek. 🤝',
    };
  }
}

/**
 * Firebase/Firestore üzerinden gerçek arkadaş kodu doğrulaması. Anonim olarak
 * giriş yapar, kendi kodunu `players/{friendCode}` dokümanı olarak kaydeder,
 * ve addFriend() girilen kodun Firestore'da gerçekten var olup olmadığını
 * kontrol edip gerçek oyuncu adını çeker (bkz. firestore.rules: `get` herkese
 * açık, `list` kapalı — kod taranamaz/enumerate edilemez, sadece bilinen tek
 * bir kod sorgulanabilir).
 *
 * Botlarla kıyaslanan liderlik tablosu iskeleti buildLocalLeaderboard'tan gelir;
 * arkadaşların skoru friendScores() ile ayrıca çekilip UI'da bu iskeleye enjekte
 * edilir (bkz. ui.ts renderSocial) — Firestore `list` kapalı olduğu için tek
 * sorguyla arkadaş listesi çekilemez, her kod ayrı ayrı get edilir.
 */
export class FirebaseSocial implements SocialProvider {
  readonly label = 'Firebase — arkadaş kodu doğrulanıyor';
  private db = getFirestore(initializeApp(FIREBASE_CONFIG));
  private ready: Promise<void>;
  private lastScoreWrite = { at: 0, score: -1 };

  constructor(save: SaveData) {
    const auth = getAuth();
    this.ready = signInAnonymously(auth)
      .then((cred) =>
        setDoc(doc(this.db, 'players', save.friendCode), {
          name: save.playerName,
          uid: cred.user.uid,
          score: save.stats.totalEarned,
          updatedAt: serverTimestamp(),
        }),
      )
      .catch(() => {
        /* bağlantı yoksa/başarısızsa sessizce geç — addFriend await sırasında zaten hata verecek */
      });
  }

  leaderboard(save: SaveData, friendScores: Record<string, number> = {}): LeaderboardEntry[] {
    return buildLocalLeaderboard(save, friendScores);
  }

  /** Her arkadaş kodunu ayrı ayrı get eder (bkz. sınıf yorumu) — MAX_FRIENDS
   * sınırı sayesinde bu paralel istek sayısı kontrol altında kalır. */
  async friendScores(save: SaveData): Promise<Record<string, number>> {
    await this.ready;
    const entries = await Promise.all(
      save.friends.map(async (f): Promise<[string, number] | null> => {
        try {
          const snap = await getDoc(doc(this.db, 'players', f.code));
          if (!snap.exists()) return null;
          const score = snap.data().score;
          return typeof score === 'number' ? [f.code, score] : null;
        } catch {
          return null;
        }
      }),
    );
    return Object.fromEntries(entries.filter((e): e is [string, number] => e !== null));
  }

  /** Skoru en fazla dakikada bir ve gerçekten değiştiyse yazar — sık syncSave
   * çağrılarında Firestore günlük yazma kotasını (Spark planı) tüketmemek için. */
  updateScore(save: SaveData): void {
    const score = save.stats.totalEarned;
    const now = Date.now();
    if (score === this.lastScoreWrite.score || now - this.lastScoreWrite.at < 60_000) return;
    this.lastScoreWrite = { at: now, score };
    void this.ready
      .then(() => setDoc(doc(this.db, 'players', save.friendCode), { score }, { merge: true }))
      .catch(() => {
        /* bağlantı sorunu — bir sonraki syncSave'de tekrar denenecek */
      });
  }

  async addFriend(save: SaveData, code: string): Promise<{ ok: boolean; msg: string }> {
    const v = validateFriendCode(save, code);
    if (!('c' in v)) return { ok: false, msg: v.msg };
    await this.ready;
    try {
      const snap = await getDoc(doc(this.db, 'players', v.c));
      if (!snap.exists()) return { ok: false, msg: 'Bu kod bulunamadı. Arkadaşının doğru kodu paylaştığından emin ol.' };
      const name = (snap.data().name as string) || 'Dost ' + v.c.slice(5);
      save.friends.push({ code: v.c, name });
      return { ok: true, msg: `${name} arkadaş listene eklendi! 🤝` };
    } catch {
      return { ok: false, msg: 'Bağlantı sorunu oldu, daha sonra tekrar dene.' };
    }
  }
}

// ---------- Servis kayıt noktası ----------

export interface Services {
  auth: AuthProvider;
  iap: IAPProvider;
  social: SocialProvider;
  ads: AdsProvider;
}

export function createServices(save: SaveData): Services {
  // iOS/Android native (Capacitor) paketinde Game Center / Play Games'e gerçek giriş,
  // RevenueCat üzerinden gerçek satın alma ve AdMob üzerinden gerçek reklamlar; diğer
  // tüm ortamlarda (web önizleme, dev sunucusu) yerel/stub sağlayıcılara düşülür.
  const native = isNativeGameAuthAvailable();
  return {
    auth: native ? new NativeGameAuth(save) : new LocalAuth(save),
    iap: native ? new RevenueCatIAP(save.friendCode) : new StubIAP(),
    // Native bayrağına bağlı değil: config girildikten sonra web preview'de de gerçek backend'e karşı çalışır.
    social: isFirebaseConfigured() ? new FirebaseSocial(save) : new LocalSocial(),
    ads: native ? new AdMobAds(save) : new StubAds(),
  };
}
