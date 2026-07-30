import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "HousePoints",
  slug: "housepoints",
  scheme: "housepoints",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    bundleIdentifier: "com.housepoints.app",
    supportsTablet: true,
  },
  android: {
    package: "com.housepoints.app",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    [
      "react-native-auth0",
      {
        // Provided via EXPO_PUBLIC_AUTH0_DOMAIN at runtime; the plugin needs
        // it at native build time as well so callback intent filters resolve.
        // Fallback string kept so `expo prebuild` succeeds before .env exists.
        domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? "example.auth0.com",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
