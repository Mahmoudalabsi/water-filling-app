import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.waterfilling.app',
  appName: 'تعبئة المياه',
  webDir: 'out',
  server: {
    // Use live URL when running in Capacitor (for initial load)
    // The app will work offline using cached data via service worker after first login
    url: 'https://water-filling-app.vercel.app',
    cleartext: true,
    // Allow the app to work offline when server is not reachable
    androidScheme: 'https',
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
    // Network plugin for detecting online/offline status
    Network: {
      // No special config needed
    },
  },
};

export default config;
