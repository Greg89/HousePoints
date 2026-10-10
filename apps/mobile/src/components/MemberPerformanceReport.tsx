import { selectMemberOverview, type DashboardSummary, type LeaderboardEntry, type MemberPerformance } from "@housepoints/contracts";
import { StyleSheet, Text, View } from "react-native";

export function MemberPerformanceReport({ performance, summary, houses }: {
  performance: MemberPerformance; summary: DashboardSummary; houses: LeaderboardEntry[];
}) {
  const overview = selectMemberOverview(summary, houses, performance.member.id);
  const maxMagnitude = Math.max(1, ...performance.days.map(day => Math.abs(day.points)));
  return <View style={styles.container}>
    <View style={styles.card}>
      <Text style={styles.title}>{performance.member.displayName}</Text>
      <Text style={styles.body}>{performance.selectedSeason.name}</Text>
      <Text style={styles.caption}>{overview.rank ? `Leaderboard rank #${overview.rank}` : "Not currently ranked on the leaderboard"}</Text>
      <View style={styles.metrics}>
        <Metric value={performance.summary.netPoints} label="Net points" />
        <Metric value={performance.summary.awardedPoints} label="Awarded" />
        <Metric value={performance.summary.deductedPoints} label="Deducted" />
      </View>
      <Text style={styles.body}>{performance.summary.awardCount} awards · {performance.summary.deductionCount} deductions</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>Recognition received</Text>
      {performance.recognition.length ? performance.recognition.map(entry => <View key={entry.key} style={styles.row}>
        <View style={styles.grow}><Text style={styles.name}>{entry.label}</Text><Text style={styles.caption}>{entry.count} {entry.count === 1 ? "award" : "awards"}</Text></View>
        <Text style={styles.points}>{entry.points.toLocaleString()} pts</Text>
      </View>) : <Text style={styles.body}>No recognition received this season yet.</Text>}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>Daily net points · 14 days</Text>
      <Text style={styles.caption}>Blue shows gains; red shows deductions. Daily totals are listed below.</Text>
      <View style={styles.chart}>
        {performance.days.map(day => <View key={day.date} accessible accessibilityLabel={`${day.date}: ${day.points} net points`}
          style={[styles.bar, { height: `${Math.max(3, Math.abs(day.points) / maxMagnitude * 100)}%`, backgroundColor: day.points < 0 ? "#dc2626" : day.points > 0 ? "#2563eb" : "#e2e8f0" }]} />)}
      </View>
      <View style={styles.dates}><Text style={styles.caption}>{performance.days[0]?.date}</Text><Text style={styles.caption}>{performance.days.at(-1)?.date}</Text></View>
      {performance.days.filter(day => day.points !== 0).map(day => <Text key={day.date} style={styles.caption}>{day.date}: {day.points > 0 ? "+" : ""}{day.points} points</Text>)}
      {performance.days.every(day => day.points === 0) ? <Text style={styles.body}>No net point changes in this period.</Text> : null}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>House contributions</Text>
      <Text style={styles.caption}>Points stay with the house that received them, including past house assignments.</Text>
      {overview.contributions.map(house => <View key={house.houseId} style={styles.row}>
        <Text style={[styles.name, styles.grow, { color: house.houseColor }]}>{house.houseName}</Text>
        <Text style={styles.points}>{house.points.toLocaleString()} pts</Text>
      </View>)}
      {!overview.contributions.length ? <Text style={styles.body}>No house contributions this season yet.</Text> : null}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>Recent activity</Text>
      <Text style={styles.caption}>Latest eight transactions this season</Text>
      {performance.recentActivity.map(item => <View key={item.id} style={styles.activity}>
        <View style={styles.row}><Text style={[styles.name, styles.grow]}>{item.giver.displayName}</Text><Text style={styles.points}>{item.delta > 0 ? "+" : ""}{item.delta}</Text></View>
        <Text style={styles.body}>{item.reason}</Text>
        <Text style={styles.caption}>{item.house.name} · {new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>)}
      {!performance.recentActivity.length ? <Text style={styles.body}>No activity for this member this season.</Text> : null}
    </View>
  </View>;
}
function Metric({ value, label }: { value: number; label: string }) {
  return <View><Text style={styles.value}>{value.toLocaleString()}</Text><Text style={styles.caption}>{label}</Text></View>;
}
const styles = StyleSheet.create({
  container: { gap: 16 }, card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 8 },
  title: { fontSize: 25, fontWeight: "700", color: "#0f172a" }, heading: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  name: { fontSize: 15, fontWeight: "600", color: "#0f172a" }, body: { fontSize: 14, color: "#475569", lineHeight: 20 },
  caption: { fontSize: 12, color: "#64748b" }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 24, paddingVertical: 8 },
  value: { fontSize: 23, fontWeight: "700", color: "#0f172a", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }, grow: { flex: 1 },
  points: { fontWeight: "700", color: "#0f172a", fontVariant: ["tabular-nums"] },
  activity: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, gap: 4 },
  chart: { height: 72, flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 12 }, bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  dates: { flexDirection: "row", justifyContent: "space-between" },
});
