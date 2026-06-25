import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.garuda.ai',
  appName: 'Garuda AI',
  webDir: 'out',
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      backgroundColor: '#00000000',
      style: 'DARK'
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0a0e14',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      spinnerColor: '#d4af37'
    },
    CapacitorHttp: {
      enabled: false,
    },
    CapacitorCookies: {
      enabled: true,
    }
  }
};

export default config;
