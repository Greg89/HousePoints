import { selectOverviewReport, TRAIT_LABELS, type DashboardSummary, type LeaderboardEntry } from "@housepoints/contracts";
import { StyleSheet, Text, View } from "react-native";

export function HouseOverviewReport({ house, summary, categoryMode }: {
  house: LeaderboardEntry;
  summary: DashboardSummary;
  categoryMode: boolean;
}) {
  const report = selectOverviewReport(summary, house, categoryMode);
  const leader = report.leaders[0];
  return (
    <View style={styles.container}>
      <View style={[styles.card, { borderTopColor: house.color, borderTopWidth: 4 }]}>
        <Text style={styles.title}>{house.name}</Text>
        {house.description ? <Text style={styles.body}>{house.description}</Text> : null}
        <Text style={styles.subtitle}>{summary.selectedSeason.name}</Text>
        <View style={styles.metrics}>
          <Metric value={house.score} label="Points" />
          <Metric value={house.memberCount} label="Members" />
          <Metric value={house.transactions} label="Transactions" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Season standout</Text>
        {report.standout ? (
          <>
            <Text style={styles.name}>{report.standout.memberName}</Text>
            <Text style={styles.body}>{report.standout.points.toLocaleString()} points this season</Text>
          </>
        ) : <Text style={styles.body}>No points found for this season yet.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>{categoryMode ? "Leading category" : "Leading trait"}</Text>
        <Text style={styles.name}>{leader?.name ?? "No recognition data yet"}</Text>
        {leader?.name ? <Text style={styles.body}>{leader.count} {leader.count === 1 ? "award" : "awards"}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Points velocity</Text>
        <Text style={styles.body}>Daily points · 14 days</Text>
        {report.velocity.length ? report.velocity.map((entry) => (
          <View key={entry.houseId}>
            <View style={styles.chart}>
              {entry.days.map((day) => (
                <View
                  key={day.date}
                  accessible
                  accessibilityLabel={`${day.date}: ${day.points} points`}
                  style={[styles.bar, {
                    height: `${Math.max(10, (day.points / report.maxVelocityPoints) * 100)}%`,
                    backgroundColor: day.points > 0 ? house.color : "#e2e8f0",
                  }]}
                />
              ))}
            </View>
            <View style={styles.dates}>
              <Text style={styles.caption}>{entry.days[0]?.date}</Text>
              <Text style={styles.caption}>{entry.days.at(-1)?.date}</Text>
            </View>
          </View>
        )) : <Text style={styles.body}>No points trend available yet.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Members by points received</Text>
        {report.rankedMembers.length ? report.rankedMembers.map((member, index) => (
          <View key={member.memberId ?? "unattributed"} style={styles.row}>
            <Text style={styles.rank}>{member.rank ?? index + 1}</Text>
            <View style={styles.grow}>
              <Text style={styles.name}>{member.displayName}</Text>
              <Text style={styles.caption}>{member.role ?? (member.memberId ? "Former member" : "Identity unavailable")}</Text>
            </View>
            <Text style={styles.points}>{member.points.toLocaleString()}</Text>
          </View>
        )) : <Text style={styles.body}>No member points to show yet.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Recent activity</Text>
        <Text style={styles.caption}>From your organization's recent activity</Text>
        {report.recentActivity.length ? report.recentActivity.map((item) => (
          <View key={item.id} style={styles.activity}>
            <View style={styles.row}>
              <Text style={[styles.name, styles.grow]}>{item.targetUserName}</Text>
              <Text style={styles.points}>{item.delta > 0 ? "+" : ""}{item.delta}</Text>
            </View>
            <Text style={styles.body}>{item.reason}</Text>
            <Text style={styles.caption}>
              {item.actorName} · {new Date(item.createdAt).toLocaleDateString()}
              {item.category || item.trait ? ` · ${item.category?.name ?? (item.trait ? TRAIT_LABELS[item.trait] : "")}` : ""}
            </Text>
          </View>
        )) : <Text style={styles.body}>No recent activity for this house in the overview.</Text>}
      </View>
    </View>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return <View style={styles.metric}><Text style={styles.value}>{value.toLocaleString()}</Text><Text style={styles.caption}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 8 },
  title: { fontSize: 26, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 14, fontWeight: "600", color: "#475569" },
  heading: { fontSize: 16, fontWeight: "700", color: "#0f172a" },
  name: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  body: { fontSize: 14, lineHeight: 20, color: "#475569" },
  caption: { fontSize: 12, color: "#64748b" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 20, marginTop: 12 },
  metric: { minWidth: 64, gap: 4 },
  value: { fontSize: 23, fontWeight: "700", color: "#0f172a", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  rank: { width: 24, color: "#64748b", fontWeight: "600" },
  grow: { flex: 1 },
  points: { fontWeight: "700", color: "#0f172a", fontVariant: ["tabular-nums"] },
  activity: { borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 8, gap: 4 },
  chart: { height: 72, flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 12 },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  dates: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
});
