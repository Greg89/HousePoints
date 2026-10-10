import type { LeaderboardEntry } from "@housepoints/contracts";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { activityLongPressFeedback as longPressFeedback } from "@/lib/activity-haptics";

export function HousesSection({ houses }: { houses: LeaderboardEntry[] }) {
  const sorted = [...houses].sort((a, b) => b.score - a.score);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Houses</Text>
      <Text style={styles.hint}>Long press a house to view its details.</Text>
      {sorted.length === 0 ? (
        <Text style={styles.empty}>No houses yet. Ask an admin to set some up.</Text>
      ) : (
        <View style={styles.card}>
          {sorted.map((house, index) => {
            const openDetails = () => {
              void longPressFeedback();
              router.push({ pathname: "/house/[houseId]", params: { houseId: house.id } });
            };
            return (
              <Pressable
                key={house.id}
                testID={`mobile.home.house.${house.id}`}
                style={[styles.row, index > 0 && styles.border]}
                onLongPress={openDetails}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={`${house.name}, ${house.score} points, ${house.memberCount} members`}
                accessibilityHint="Long press to open house details"
                accessibilityActions={[
                  { name: "activate", label: "Open house details" },
                  { name: "longpress", label: "Open house details" },
                ]}
                onAccessibilityAction={(event) => {
                  if (["activate", "longpress"].includes(event.nativeEvent.actionName)) openDetails();
                }}
              >
                <View style={[styles.dot, { backgroundColor: house.color }]} />
                <View style={styles.text}>
                  <Text style={styles.name}>{house.name}</Text>
                  <Text style={styles.meta}>
                    {house.memberCount} {house.memberCount === 1 ? "member" : "members"}
                    {" · "}{house.transactions} {house.transactions === 1 ? "award" : "awards"}
                  </Text>
                </View>
                <Text style={styles.score}>{house.score}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  title: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6 },
  hint: { fontSize: 12, color: "#64748b" },
  card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  border: { borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  text: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  score: { fontSize: 20, fontWeight: "700", color: "#0f172a", fontVariant: ["tabular-nums"] },
  empty: { color: "#64748b", fontSize: 14, padding: 20, textAlign: "center" },
});
