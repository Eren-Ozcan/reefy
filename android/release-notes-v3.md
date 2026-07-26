# Reefy — Sürüm 1.0 (versionCode 3) Yayın Notları

## Play Console "Yayın notları" alanı için (tr-TR, kısa)

Reefy'ye hoş geldin! 🐠 Bu sürümde:
- Reklam izleyerek ücretsiz inci kazanabileceğin yeni bölüm
- "Reklamları Kaldır" satın alma seçeneği
- Küçük performans ve kararlılık iyileştirmeleri

## English (en-US, short)

Welcome to Reefy! 🐠 This release adds:
- A new way to earn free pearls by watching a rewarded ad
- A "Remove Ads" purchase option
- Minor performance and stability improvements

---

## Dahili notlar (Play Console'a girilmeyecek)

Bu sürüm (versionCode 3) önceki AAB'lere göre şunları ekliyor:
- AdMob entegrasyonu: akvaryum geçişlerinde soğuma süreli interstitial,
  isteğe bağlı ödüllü reklamla +5 inci (`src/ads.ts`)
- Mağazada "Reklamları Kaldır" IAP paketi (`remove-ads`)
- Android compileSdk/targetSdk 36, Kotlin jvmTarget 17 sabitlemesi

Play Console'da "Uygulama içeriği" bölümünde güncellenmesi gerekebilecek
bildirimler:
- **Reklamlar**: "Uygulamanız reklam içeriyor mu?" → Evet olarak işaretlenmeli
  (AdMob eklendiği için, önceki gönderimde bu "Hayır" olabilirdi).
- **Veri güvenliği**: AdMob ve RevenueCat üçüncü taraf SDK'lar reklam kimliği /
  cihaz tanımlayıcıları toplayabilir; "Veri güvenliği" formunun buna göre
  güncellenmesi gerekiyor.
