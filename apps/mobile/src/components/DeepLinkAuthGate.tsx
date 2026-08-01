import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppAuth } from "@/context/auth-provider";

export function DeepLinkAuthGate({ children }: { children: ReactNode }) {
  const { status, signIn } = useAppAuth();
  if (status === "initializing" || status === "bootstrapping") {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }
  if (status === "signedOut" || status === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Sign in to continue</Text>
        <Pressable style={styles.button} onPress={() => void signIn()}>
          <Text style={styles.buttonText}>Sign in with Auth0</Text>
        </Pressable>
      </View>
    );
  }
  return children;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { color: "#0f172a", fontSize: 20, fontWeight: "700" },
  button: { backgroundColor: "#0f172a", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 },
  buttonText: { color: "#ffffff", fontWeight: "600" },
});

