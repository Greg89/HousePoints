import type { ExpoConfig } from "expo/config";

const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

const config: ExpoConfig = {
  name: "HousePoints",
  slug: "housepoints",
  scheme: "housepoints",
  version: "1.0.0",
  icon: "./assets/icon.png",
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
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#020d24",
    },
  },
  plugins: [
    "expo-dev-client",
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 240,
        resizeMode: "contain",
        backgroundColor: "#020d24",
        dark: {
          image: "./assets/splash-icon.png",
          backgroundColor: "#020d24",
        },
      },
    ],
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
