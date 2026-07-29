import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";

export default function ProfileScreen() {
  const { user, signOut } = useAppAuth();
  const { activeOrgSlug, activeMembership, memberships, selectOrg } =
    useActiveOrg();
  const { showToast } = useToast();

  const promptSwitch = () => {
    if (memberships.length <= 1) {
      showToast({
        message: "You only belong to one organization.",
        variant: "info",
      });
      return;
    }
    const otherMemberships = memberships.filter(
      (m) => m.organizationSlug !== activeOrgSlug,
    );
    Alert.alert("Switch organization", "Choose an organization to switch to.", [
      ...otherMemberships.map((m) => ({
        text: m.organizationName,
        onPress: () => {
          void selectOrg(m.organizationSlug);
          showToast({
            message: `Switched to ${m.organizationName}`,
            variant: "success",
          });
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Display name</Text>
        <Text style={styles.value}>{user?.displayName ?? "-"}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email ?? "-"}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Organization</Text>
        <Text style={styles.value}>
          {activeMembership?.organizationName ?? "-"}
        </Text>
        <Text style={styles.meta}>
          {activeMembership?.role ?? ""}
          {activeMembership?.houseName
            ? ` \u00b7 ${activeMembership.houseName}`
            : ""}
        </Text>
      </View>
      <Pressable style={styles.switchButton} onPress={promptSwitch}>
        <Text style={styles.switchText}>Switch organization</Text>
      </Pressable>
      <Text style={styles.subtitle}>
        Display-name editing arrives in the next slice.
      </Text>
      <Pressable
        style={styles.signOut}
        onPress={() => {
          void signOut();
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 24, gap: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  value: { fontSize: 16, color: "#0f172a", fontWeight: "600" },
  meta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  switchButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0f172a",
    alignItems: "center",
    marginTop: 12,
  },
  switchText: { color: "#0f172a", fontWeight: "500" },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
    marginTop: 16,
  },
  signOut: { alignItems: "center", padding: 12, marginTop: "auto" },
  signOutText: { color: "#dc2626", fontSize: 15, fontWeight: "500" },
});
