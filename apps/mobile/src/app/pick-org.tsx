import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";

export default function PickOrgScreen() {
  const { user, signOut } = useAppAuth();
  const { memberships, selectOrg } = useActiveOrg();

  if (!user) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose a workspace</Text>
        <Text style={styles.subtitle}>
          You belong to multiple organizations. Pick one to continue.
        </Text>
      </View>
      <FlatList
        data={memberships}
        keyExtractor={(item) => item.organizationId}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.orgCard,
              pressed && styles.orgCardPressed,
            ]}
            onPress={async () => {
              await selectOrg(item.organizationSlug);
              router.replace("/(tabs)");
            }}
          >
            <Text style={styles.orgName}>{item.organizationName}</Text>
            <Text style={styles.orgMeta}>
              {item.role}
              {item.houseName ? ` \u00b7 ${item.houseName}` : ""}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            You do not belong to any organization yet. Ask an admin for an
            invite.
          </Text>
        }
      />
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
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 24 },
  header: { paddingTop: 24, paddingBottom: 24 },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: { fontSize: 15, color: "#475569", lineHeight: 21 },
  list: { paddingBottom: 24 },
  separator: { height: 12 },
  orgCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  orgCardPressed: { opacity: 0.75 },
  orgName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 4,
  },
  orgMeta: { fontSize: 13, color: "#64748b" },
  empty: { color: "#475569", textAlign: "center", padding: 24 },
  signOut: { alignItems: "center", paddingVertical: 12 },
  signOutText: { color: "#dc2626", fontSize: 15, fontWeight: "500" },
});
