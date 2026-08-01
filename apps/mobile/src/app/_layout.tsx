import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { useMemo } from "react";
import { Auth0Provider } from "react-native-auth0";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/context/auth-provider";
import { OrgProvider } from "@/context/org-provider";
import { ToastProvider } from "@/context/toast-provider";
import { DeviceRegistrationManager } from "@/components/DeviceRegistrationManager";
import { NotificationResponseManager } from "@/components/NotificationResponseManager";
import { auth0Config } from "@/lib/auth";

export default function RootLayout() {
  const { domain, clientId } = useMemo(() => auth0Config(), []);
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
    [],
  );

  return (
    <SafeAreaProvider>
      <Auth0Provider domain={domain} clientId={clientId}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <OrgProvider>
              <DeviceRegistrationManager />
              <NotificationResponseManager />
              <ToastProvider>
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false }} />
              </ToastProvider>
            </OrgProvider>
          </AuthProvider>
        </QueryClientProvider>
      </Auth0Provider>
    </SafeAreaProvider>
  );
}
