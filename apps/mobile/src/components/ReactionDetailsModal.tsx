import type { PointReactionDetailsResponse } from "@housepoints/contracts";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { REACTION_EMOJI } from "@/lib/activity-reactions";

export function ReactionDetailsModal(props: {
  visible: boolean;
  data: PointReactionDetailsResponse | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.title}>Reactions</Text>
          {props.loading ? <ActivityIndicator /> : null}
          {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
          {props.data?.reactions.map((reaction) => (
            <View key={reaction.id} style={styles.row}>
              <Text style={styles.emoji}>{REACTION_EMOJI[reaction.reactionKey]}</Text>
              <Text style={styles.name}>{reaction.actorName}</Text>
            </View>
          ))}
          {!props.loading && props.data?.reactions.length === 0 ? (
            <Text style={styles.empty}>No reactions yet.</Text>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  card: { backgroundColor: "#ffffff", borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  emoji: { fontSize: 20 },
  name: { fontSize: 15, color: "#334155" },
  error: { color: "#991b1b" },
  empty: { color: "#64748b" },
});

