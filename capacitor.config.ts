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
  },
};

export default config;
