import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meudiva.app',
  appName: 'Meu Divã',
  webDir: 'public',
  server: {
    url: 'https://app.meudivaonline.com/mobile/splash',
    cleartext: false,
    allowNavigation: [
      'app.meudivaonline.com',
      'api.meudivaonline.com',
    ],
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