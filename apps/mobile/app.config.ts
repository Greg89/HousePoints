import type { ExpoConfig } from "expo/config";

const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: "HousePoints",
  slug: "housepoints",
  scheme: "housepoints",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  runtimeVersion: {
    policy: "appVersion",
  },
  updates: easProjectId
    ? {
        url: `https://u.expo.dev/${easProjectId}`,
        checkAutomatically: "ON_LOAD",
        fallbackToCacheTimeout: 0,
      }
    : undefined,
  extra: {
    eas: {
      projectId: easProjectId,
    },
  },
  ios: {
    bundleIdentifier: "com.housepoints.app",
    supportsTablet: true,
  },
  android: {
    package: "com.housepoints.app",
  },
  plugins: [
    "expo-dev-client",
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
