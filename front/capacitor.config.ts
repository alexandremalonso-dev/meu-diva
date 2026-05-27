import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meudiva.app',
  appName: 'Meu Div\u00e3',
  webDir: 'public',
  server: {
    url: 'https://meudiva-frontend-prod-fobtlq5wja-rj.a.run.app/mobile/splash',
    cleartext: false,
    allowNavigation: [
      'api.meudivaonline.com',
      'meudiva-api-backend-592671373665.southamerica-east1.run.app',
      'meudiva-frontend-prod-fobtlq5wja-rj.a.run.app',
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

