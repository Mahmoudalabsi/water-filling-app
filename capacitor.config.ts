import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.waterfilling.app',
  appName: 'تعبئة المياه',
  webDir: 'out',
  server: {
    // Use live URL when running in Capacitor
    url: 'https://water-filling-app.vercel.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0891b2',
      showSpinner: true,
      spinnerColor: '#ffffff',
    },
  },
};

export default config;
