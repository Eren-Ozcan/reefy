import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yilkgames.reefy',
  appName: 'Reefy',
  webDir: 'dist',
  plugins: {
    SafeArea: {
      detectViewportFitCoverChanges: true,
      initialViewportFitCover: true,
    },
    SystemBars: {
      insetsHandling: 'disable',
    },
    // skipNativeAuth ZORUNLU olarak true: oyunun tüm veri katmanı (cloud-save.ts,
    // services.ts FirebaseSocial) Firebase JS SDK'sını kullanıyor. Varsayılan
    // (false) davranışta eklenti oturumu NATIVE SDK'da açar; JS SDK'nın oturumu
    // ayrı kaldığı için giriş "başarılı" görünür ama Firestore yazmaları hâlâ
    // eski anonim kullanıcıya gider. true iken native katman yalnızca hesap
    // seçiciyi gösterip kimlik bilgisini döndürür, oturumu JS SDK açar.
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
  },
};

export default config;
