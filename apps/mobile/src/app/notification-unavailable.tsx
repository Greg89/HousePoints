import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DeepLinkAuthGate } from "@/components/DeepLinkAuthGate";

export default function NotificationUnavailable() {
  return <DeepLinkAuthGate>
    <View style={styles.center}>
      <Text accessibilityRole="header" style={styles.title}>Notification unavailable</Text>
      <Text style={styles.message}>This notification cannot be opened. Your access may have changed, or its destination is no longer available.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/")} style={styles.button}>
        <Text style={styles.buttonText}>Continue to HousePoints</Text>
      </Pressable>
    </View>
  </DeepLinkAuthGate>;
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  title: { color: "#0f172a", fontSize: 22, fontWeight: "700" },
  message: { color: "#475569", textAlign: "center" },
  button: { backgroundColor: "#0f172a", padding: 14, borderRadius: 10 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
