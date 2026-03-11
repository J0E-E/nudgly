import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for Nudgly.
 * Run `npx cap add android` and `npx cap add ios` when ready for mobile.
 * Web asset dir is dist (Vite build output).
 */
const config: CapacitorConfig = {
  appId: 'com.nudgly.app',
  appName: 'Nudgly',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
