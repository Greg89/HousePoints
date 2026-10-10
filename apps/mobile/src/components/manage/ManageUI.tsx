import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { canAccessMobileAdmin } from "@/lib/mobile-admin";
import { env } from "@/lib/env";
import { useManageContext } from "@/hooks/use-manage";
import type { AdminContext } from "@housepoints/contracts";
import { SafeAreaView } from "react-native-safe-area-context";

export function ManageGate({ children }: { children: ReactNode }) {
  const { status } = useAppAuth();
  const { activeOrgSlug, activeMembership, hydrated } = useActiveOrg();
  if (status === "signedOut" || status === "error") return <Redirect href="/login" />;
  if (status !== "ready" || !hydrated) return <ActivityIndicator accessibilityLabel="Loading organization" />;
  if (!activeOrgSlug || !activeMembership) return <Redirect href="/pick-org" />;
  if (!canAccessMobileAdmin(env.mobileAdminEnabled, activeMembership.role)) return <Redirect href="/(tabs)" />;
  return <View key={`${activeOrgSlug}:${activeMembership.role}`} style={{ flex: 1 }}>{children}</View>;
}
export function ManagePage({ title, children, refreshing = false, onRefresh }: { title: string; children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return <SafeAreaView edges={["bottom"]} style={s.screen}>
    <Stack.Screen options={{ headerShown: true, title }} />
    <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled" refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}>{children}</KeyboardAwareScrollView>
  </SafeAreaView>;
}
export function ContextPage({ title, children }: { title: string; children: (context: AdminContext) => ReactNode }) {
  const query = useManageContext();
  return <ManagePage title={title} refreshing={query.isRefetching} onRefresh={() => void query.refetch()}>
    {query.isPending ? <ActivityIndicator accessibilityLabel="Loading management tools" /> : query.isError ? <Action label="Unable to load management tools. Tap to retry" onPress={() => void query.refetch()} /> : children(query.data)}
  </ManagePage>;
}
export function Card({ children }: { children: ReactNode }) { return <View style={s.card}>{children}</View>; }
export function Heading({ children }: { children: ReactNode }) { return <Text accessibilityRole="header" style={s.heading}>{children}</Text>; }
export function Note({ children }: { children: ReactNode }) { return <Text style={s.note}>{children}</Text>; }
export function Action({ label, onPress, disabled = false, danger = false, testID }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean; testID?: string }) {
  return <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [s.action, danger && s.danger, (disabled || pressed) && { opacity: 0.5 }]}>
    <Text style={[s.actionText, danger && { color: "#991b1b" }]}>{label}</Text>
  </Pressable>;
}
export function Row({ title, subtitle, badge, color, onPress }: { title: string; subtitle?: string; badge?: string; color?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: "#f1f5f9" }]}>
    <View style={[s.avatar, color ? { backgroundColor: color } : undefined]}>
      <Text style={s.initial}>{title.charAt(0).toUpperCase()}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={s.name}>{title}</Text>{subtitle ? <Note>{subtitle}</Note> : null}</View>
    {badge ? <Text style={s.badge}>{badge}</Text> : null}<Text accessible={false} style={s.note}>›</Text>
  </Pressable>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}>
    <Note>{label}</Note>
    <TextInput accessibilityLabel={label} placeholderTextColor="#64748b" {...props} style={[s.input, props.style]} />
  </View>;
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" }, container: { padding: 20, gap: 16, paddingBottom: 36 },
  card: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", padding: 16, gap: 12 },
  heading: { fontSize: 18, fontWeight: "700", color: "#0f172a" }, note: { fontSize: 13, lineHeight: 19, color: "#64748b" },
  action: { minHeight: 46, borderRadius: 10, padding: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#eef2ff", borderWidth: 1, borderColor: "#c7d2fe" },
  actionText: { color: "#3730a3", fontWeight: "600", fontSize: 14 }, danger: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, minHeight: 64 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#475569", alignItems: "center", justifyContent: "center" },
  initial: { color: "#fff", fontWeight: "700" }, name: { fontSize: 16, fontWeight: "600", color: "#0f172a" }, badge: { fontSize: 11, color: "#475569", backgroundColor: "#f1f5f9", borderRadius: 8, padding: 5 },
  input: { borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, padding: 12, minHeight: 46, color: "#0f172a", backgroundColor: "#fff" },
});
