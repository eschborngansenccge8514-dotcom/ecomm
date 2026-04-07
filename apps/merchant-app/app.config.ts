import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MerchantMind',
  slug: 'merchant-app',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash-icon.png', // Corrected from ./assets/splash.png to ./assets/splash-icon.png based on initial app.json
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  scheme: 'hyperlocal',  // deep link scheme for auth redirects
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.yourcompany.merchantmind',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'We need your location to find nearby stores.',
      NSCameraUsageDescription: 'Upload product and review photos.',
      NSPhotoLibraryUsageDescription: 'Upload product and review photos.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png', // Corrected based on initial app.json
      backgroundColor: '#ffffff',
    },
    package: 'com.yourcompany.merchantmind',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/icon.png', // Fallback for notification icon, since assets/notification-icon.png doesn't exist
        color: '#ffffff',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'We need your location to find nearby stores.',
      },
    ],
    [
      'expo-camera',
      { cameraPermission: 'Allow $(PRODUCT_NAME) to access your camera.' },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
