import { Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { env } from "@/lib/env";
import { logger, serializeError } from "@/lib/logger";
import { buildWebAdminUrl, canAccessMobileAdmin } from "@/lib/mobile-admin";

const OUT_OF_SCOPE_FLOWS = [
  "Season creation and transitions",
  "Organization archive and restore",
  "Audit and comparison reports",
  "Release announcements",
] as const;

export default function AdminScreen() {
  const { activeOrgSlug, activeMembership } = useActiveOrg();
  const { showToast } = useToast();
  const [openingWeb, setOpeningWeb] = useState(false);
  const allowed = canAccessMobileAdmin(
    env.mobileAdminEnabled,
    activeMembership?.role,
  );

  if (!allowed || !activeOrgSlug) {
    return <Redirect href="/(tabs)" />;
  }

  const openWebDashboard = async () => {
    setOpeningWeb(true);
    const url = buildWebAdminUrl(env.webBaseUrl, activeOrgSlug);
    try {
      await Linking.openURL(url);
      logger.info("mobile.admin.web_handoff_opened", {
        organizationSlug: activeOrgSlug,
      });
    } catch (err) {
      logger.warn("mobile.admin.web_handoff_failed", serializeError(err));
      showToast({
        message: "Unable to open the web dashboard.",
        variant: "error",
      });
    } finally {
      setOpeningWeb(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View>
        <Text style={styles.title}>Administration</Text>
        <Text style={styles.subtitle}>
          Manage {activeMembership?.organizationName} from your phone.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Native admin tools</Text>
        <Text style={styles.body}>
          Member management, invitations, and point deductions are being added
          in the next mobile slices.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Open the full web dashboard</Text>
        <Text style={styles.body}>
          These organization-level workflows remain on the web:
        </Text>
        {OUT_OF_SCOPE_FLOWS.map((flow) => (
          <Text key={flow} style={styles.listItem}>• {flow}</Text>
        ))}
        <Pressable
          style={[styles.button, openingWeb && styles.buttonDisabled]}
          onPress={() => void openWebDashboard()}
          disabled={openingWeb}
        >
          {openingWeb ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Open web dashboard</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { marginTop: 4, fontSize: 14, color: "#64748b" },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  body: { color: "#475569", fontSize: 14, lineHeight: 20 },
  listItem: { color: "#475569", fontSize: 14, paddingLeft: 4 },
  button: {
    marginTop: 8,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#0f172a",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontWeight: "700" },
});
