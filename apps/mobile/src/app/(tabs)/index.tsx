import { StyleSheet, Text, View } from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";

export default function HomeScreen() {
  const { user } = useAppAuth();
  const { activeMembership } = useActiveOrg();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Hi {user?.displayName ?? "there"}</Text>
      <Text style={styles.org}>
        {activeMembership?.organizationName ?? "No organization"}
      </Text>
      {activeMembership?.houseName ? (
        <Text style={styles.house}>House: {activeMembership.houseName}</Text>
      ) : null}
      <Text style={styles.subtitle}>
        Dashboard coming next: house leaderboard summary + season context.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#f8fafc" },
  greeting: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 16,
  },
  org: { fontSize: 16, color: "#475569", marginTop: 8 },
  house: { fontSize: 14, color: "#334155", marginTop: 4 },
  subtitle: { fontSize: 14, color: "#64748b", marginTop: 24, lineHeight: 20 },
});
