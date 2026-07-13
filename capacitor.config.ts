import type { CapacitorConfig } from '@capacitor/cli';

// NOT: appId burada geçici bir yer tutucudur. Gerçek yayın için Apple Developer
// portalında kayıtlı App ID ile eşleşen, kendi ters-domain bundle kimliğinle
// değiştirmen gerekir (örn. com.senisim.reefy). Google Play tarafı için de
// applicationId'nin bununla eşleşmesi gerekir.
const config: CapacitorConfig = {
  appId: 'com.reefy.app',
  appName: 'Reefy',
  webDir: 'dist',
};

export default config;
