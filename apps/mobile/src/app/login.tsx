import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppAuth } from "@/context/auth-provider";

export default function LoginScreen() {
  const { status, error, signIn } = useAppAuth();

  useEffect(() => {
    if (status === "ready" || status === "bootstrapping") {
      router.replace("/");
    }
  }, [status]);

  const busy = status === "initializing" || status === "bootstrapping";

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>HousePoints</Text>
        <Text style={styles.subtitle}>
          Sign in to award points, cheer for your house, and stay on top of the
          leaderboard.
        </Text>
      </View>
      <Pressable
        testID="mobile.login.sign-in"
        accessibilityLabel="Sign in with Auth0"
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
          busy && styles.buttonBusy,
        ]}
        onPress={() => {
          void signIn();
        }}
        disabled={busy}
      >
        <Text style={styles.buttonText}>
          {busy ? "Signing in\u2026" : "Sign in with Auth0"}
        </Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 24,
    justifyContent: "center",
  },
  hero: { marginBottom: 48 },
  title: {
    color: "#f8fafc",
    fontSize: 40,
    fontWeight: "700",
    marginBottom: 12,
  },
  subtitle: { color: "#cbd5e1", fontSize: 16, lineHeight: 22 },
  button: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.8 },
  buttonBusy: { opacity: 0.6 },
  buttonText: { color: "#0f172a", fontSize: 16, fontWeight: "600" },
  error: { color: "#fca5a5", marginTop: 16, textAlign: "center" },
});
