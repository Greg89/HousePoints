import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Auth0Provider, auth0Config } from "@/lib/auth";

export default function RootLayout() {
  const { domain, clientId } = auth0Config();

  return (
    <SafeAreaProvider>
      <Auth0Provider domain={domain} clientId={clientId}>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </Auth0Provider>
    </SafeAreaProvider>
  );
}
