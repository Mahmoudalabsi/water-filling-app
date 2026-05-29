import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.waterfilling.app',
  appName: 'تعبئة المياه',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0891b2',
      showSpinner: true,
      spinnerColor: '#ffffff',
    }
  }
};

export default config;
