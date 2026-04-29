import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meudiva.app',
  appName: 'Meu Divã',
  webDir: 'public',
  server: {
    url: 'https://meudiva-frontend-prod-fobtlq5wja-rj.a.run.app/mobile/splash',
    cleartext: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#E03673',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;