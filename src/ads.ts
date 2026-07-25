// Reklam sağlayıcısı soyutlama katmanı (services.ts'teki IAP/Auth desenini izler).
//
// Web/geliştirme ortamında StubAds çalışır (reklam göstermez).
// Capacitor paketlerinde AdMobAds, @capacitor-community/admob üzerinden
// Google AdMob'a bağlanır. Oyun kodu yalnızca AdsProvider arayüzünü kullanır.

import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { SaveData } from './save';

/** AdMob dashboard'da oluşturulan reklam birimi kimlikleri (bkz. apps.admob.com > Reefy). */
const INTERSTITIAL_AD_IDS: { android: string; ios: string } = {
  android: 'ca-app-pub-9709993577664180/8876084322',
  ios: 'ca-app-pub-9709993577664180/3722729912',
};
const REWARDED_AD_IDS: { android: string; ios: string } = {
  android: 'ca-app-pub-9709993577664180/5670356549',
  ios: 'ca-app-pub-9709993577664180/6249920983',
};

/** Ödüllü reklam başına verilen inci miktarı — mağaza IAP'lerinde olduğu gibi ödül miktarı
 * her zaman burada, kodda kontrol altındadır (reklam ağının kendi callback verisine güvenilmez). */
export const REWARDED_AD_PEARLS = 5;

const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000; // akvaryum geçişlerinde art arda reklam basmasın
const REWARDED_COOLDOWN_MS = 30 * 1000;         // yanlışlıkla çift tıklamayı önle

export interface AdsProvider {
  /** Doğal bir mola noktasında (örn. akvaryum değişimi) çağrılır; sessizce no-op olabilir
   * (soğuma süresi dolmadıysa, reklam hazır değilse veya "reklamları kaldır" satın alındıysa). */
  maybeShowInterstitial(): void;
  /** Oyuncunun bilerek başlattığı ödüllü reklam akışı. */
  showRewarded(): Promise<{ ok: boolean; msg: string; grantPearls?: number }>;
}

export class StubAds implements AdsProvider {
  maybeShowInterstitial(): void {}
  showRewarded(): Promise<{ ok: boolean; msg: string }> {
    return Promise.resolve({
      ok: false,
      msg: 'Reklamlar Google Play / App Store sürümünde etkinleşir.',
    });
  }
}

export class AdMobAds implements AdsProvider {
  private ready = false;
  private interstitialReady = false;
  private lastInterstitial = 0;
  private lastRewarded = 0;

  constructor(private save: SaveData) {
    void this.setup();
  }

  private platform(): 'android' | 'ios' {
    return Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  }

  private async setup(): Promise<void> {
    try {
      await AdMob.initialize({});
      this.ready = true;
      if (!this.save.adsRemoved) void this.loadInterstitial();
    } catch {
      this.ready = false;
    }
  }

  private async loadInterstitial(): Promise<void> {
    try {
      await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_IDS[this.platform()] });
      this.interstitialReady = true;
    } catch {
      this.interstitialReady = false;
    }
  }

  maybeShowInterstitial(): void {
    if (!this.ready || this.save.adsRemoved || !this.interstitialReady) return;
    const now = Date.now();
    if (now - this.lastInterstitial < INTERSTITIAL_COOLDOWN_MS) return;
    this.lastInterstitial = now;
    this.interstitialReady = false;
    void AdMob.showInterstitial()
      .catch(() => {})
      .finally(() => void this.loadInterstitial());
  }

  async showRewarded(): Promise<{ ok: boolean; msg: string; grantPearls?: number }> {
    if (!this.ready) return { ok: false, msg: 'Reklam sistemi henüz hazır değil, birazdan tekrar dene.' };
    const now = Date.now();
    if (now - this.lastRewarded < REWARDED_COOLDOWN_MS) {
      return { ok: false, msg: 'Az önce bir reklam izledin, biraz sonra tekrar dene.' };
    }
    try {
      await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_IDS[this.platform()] });
      let rewarded = false;
      const listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        rewarded = true;
      });
      await AdMob.showRewardVideoAd();
      await listener.remove();
      if (!rewarded) return { ok: false, msg: 'Reklamı tamamlamadan çıktın, ödül verilmedi.' };
      this.lastRewarded = now;
      return { ok: true, msg: `Reklamı izledin! +${REWARDED_AD_PEARLS} inci 🦪`, grantPearls: REWARDED_AD_PEARLS };
    } catch {
      return { ok: false, msg: 'Şu anda gösterilecek reklam bulunamadı, daha sonra tekrar dene.' };
    }
  }
}
