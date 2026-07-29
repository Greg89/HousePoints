import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth0 } from "react-native-auth0";
import { apiRequest, ApiResponseError } from "@/lib/api-client";
import { auth0AuthorizeParams } from "@/lib/auth";

type ProbeResult = {
  status: "ok" | "error";
  detail: string;
};

/**
 * Task 6.1 spike screen.
 *
 * Proves the mobile app can:
 *   1. Sign in with Auth0 via native PKCE.
 *   2. Reach the API on the same host used by the web app (`GET /health`).
 *   3. Attach a valid access token to authenticated requests (`POST /users/bootstrap`).
 *
 * Replace with the real Phase 1 dashboard once 6.2 begins.
 */
export default function HomeScreen() {
  const { user, authorize, clearSession, getCredentials, isLoading, error } =
    useAuth0();
  const [busy, setBusy] = useState(false);
  const [healthResult, setHealthResult] = useState<ProbeResult | null>(null);
  const [bootstrapResult, setBootstrapResult] = useState<ProbeResult | null>(null);

  const handleSignIn = useCallback(async () => {
    try {
      setBusy(true);
      await authorize(auth0AuthorizeParams());
    } catch {
      // react-native-auth0 surfaces the error via the `error` field on the
      // hook; nothing to do here.
    } finally {
      setBusy(false);
    }
  }, [authorize]);

  const handleSignOut = useCallback(async () => {
    setHealthResult(null);
    setBootstrapResult(null);
    await clearSession();
  }, [clearSession]);

  const runHealthProbe = useCallback(async () => {
    setBusy(true);
    setHealthResult(null);
    try {
      const body = await apiRequest<Record<string, unknown>>("/health");
      setHealthResult({ status: "ok", detail: JSON.stringify(body) });
    } catch (probeError) {
      setHealthResult({
        status: "error",
        detail:
          probeError instanceof ApiResponseError
            ? `${probeError.code} (${probeError.statusCode})`
            : String(probeError),
      });
    } finally {
      setBusy(false);
    }
  }, []);

  const runAuthProbe = useCallback(async () => {
    setBusy(true);
    setBootstrapResult(null);
    try {
      const credentials = await getCredentials();
      if (!credentials?.accessToken) {
        throw new Error("No access token in credentials store");
      }
      const body = await apiRequest<Record<string, unknown>>("/users/bootstrap", {
        method: "POST",
        accessToken: credentials.accessToken,
        body: {},
      });
      setBootstrapResult({
        status: "ok",
        detail: JSON.stringify(body).slice(0, 240),
      });
    } catch (probeError) {
      setBootstrapResult({
        status: "error",
        detail:
          probeError instanceof ApiResponseError
            ? `${probeError.code} (${probeError.statusCode})`
            : String(probeError),
      });
    } finally {
      setBusy(false);
    }
  }, [getCredentials]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>HousePoints spike</Text>
        <Text style={styles.subtitle}>Auth0 native PKCE + API smoke test</Text>

        {isLoading ? (
          <ActivityIndicator />
        ) : user ? (
          <View style={styles.card}>
            <Text style={styles.label}>Signed in as</Text>
            <Text style={styles.value}>
              {user.name ?? user.email ?? user.sub ?? "(unknown user)"}
            </Text>
            <Button title="Sign out" onPress={handleSignOut} disabled={busy} />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Not signed in</Text>
            <Button
              title="Sign in with Auth0"
              onPress={handleSignIn}
              disabled={busy}
            />
            {error ? (
              <Text style={styles.error}>
                {error.message ?? String(error)}
              </Text>
            ) : null}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>Public API probe</Text>
          <Button title="GET /health" onPress={runHealthProbe} disabled={busy} />
          {healthResult ? (
            <Text
              style={
                healthResult.status === "ok" ? styles.value : styles.error
              }
            >
              {healthResult.detail}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Authenticated API probe</Text>
          <Button
            title="POST /users/bootstrap"
            onPress={runAuthProbe}
            disabled={busy || !user}
          />
          {bootstrapResult ? (
            <Text
              style={
                bootstrapResult.status === "ok" ? styles.value : styles.error
              }
            >
              {bootstrapResult.detail}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 24, gap: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#475569", marginBottom: 12 },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
  },
  value: { fontSize: 14, color: "#0f172a" },
  error: { fontSize: 13, color: "#b91c1c" },
});
