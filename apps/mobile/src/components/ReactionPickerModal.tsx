import {
  POINT_REACTION_LABELS,
  type PointReactionKey,
} from "@housepoints/contracts";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { MOBILE_REACTION_KEYS, REACTION_EMOJI } from "@/lib/activity-reactions";

export function ReactionPickerModal(props: {
  visible: boolean;
  selected: PointReactionKey | null;
  pending: boolean;
  onSelect: (key: PointReactionKey) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <Pressable style={styles.backdrop} onPress={props.onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>Choose a reaction</Text>
          <View style={styles.grid}>
            {MOBILE_REACTION_KEYS.map((key) => {
              const selected = props.selected === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: props.pending }}
                  accessibilityLabel={
                    selected
                      ? `Remove ${POINT_REACTION_LABELS[key]} reaction`
                      : `React with ${POINT_REACTION_LABELS[key]}`
                  }
                  style={[styles.option, selected && styles.optionSelected]}
                  disabled={props.pending}
                  onPress={() => props.onSelect(key)}
                >
                  <Text style={styles.emoji}>{REACTION_EMOJI[key]}</Text>
                  <Text style={styles.label}>{POINT_REACTION_LABELS[key]}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  sheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0f172a", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    width: "48%",
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionSelected: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  emoji: { fontSize: 22 },
  label: { flex: 1, fontSize: 13, fontWeight: "600", color: "#334155" },
});

