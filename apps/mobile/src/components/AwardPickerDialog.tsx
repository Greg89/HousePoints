import type { ReactNode } from "react";
import { Modal, Platform, StyleSheet, View } from "react-native";

/** Keep pickers inside the existing iOS award sheet instead of presenting another controller. */
export function AwardPickerDialog({ visible, onClose, children }: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (Platform.OS === "ios") {
    return visible ? (
      <View
        style={StyleSheet.absoluteFill}
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
      >
        {children}
      </View>
    ) : null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {children}
    </Modal>
  );
}
