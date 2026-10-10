import type { ReactNode } from "react";
import { router } from "expo-router";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { activityLongPressFeedback as longPressFeedback } from "@/lib/activity-haptics";

export function MemberDetailsLink({ memberId, name, children, style }: {
  memberId: string; name: string; children: ReactNode; style?: StyleProp<ViewStyle>;
}) {
  const open = () => {
    void longPressFeedback();
    router.push({ pathname: "/member/[memberId]", params: { memberId } });
  };
  return (
    <Pressable
      testID={`mobile.member.open.${memberId}`}
      style={style}
      onLongPress={open}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`Performance details for ${name}`}
      accessibilityHint="Long press to open member performance"
      accessibilityActions={[{ name: "activate", label: "Open performance" }, { name: "longpress", label: "Open performance" }]}
      onAccessibilityAction={(event) => {
        if (["activate", "longpress"].includes(event.nativeEvent.actionName)) open();
      }}
    >{children}</Pressable>
  );
}
