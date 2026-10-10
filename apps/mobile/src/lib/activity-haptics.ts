import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export async function activityLongPressFeedback(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Long_Press);
    } else if (Platform.OS === "ios") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    // Feedback is optional; unsupported hardware must not block the menu.
  }
}
