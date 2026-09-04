import { slugSchema, type AppUser } from "@housepoints/contracts";
import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState, type ComponentProps } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";
import { parseInviteInput, slugifyOrganizationName } from "@/lib/mobile-onboarding";

const COLORS = ["#7c3aed", "#2563eb", "#16a34a", "#ea580c", "#dc2626", "#db2777"];
type Mode = "options" | "create" | "join";
type FormProps = { user: AppUser; getAccessToken: () => Promise<string>; onBack: () => void; onSuccess: (user: AppUser) => Promise<void> };

export default function PickOrgScreen() {
  const { user, signOut, getAccessToken, synchronizeUser } = useAppAuth();
  const { memberships, selectOrg } = useActiveOrg();
  const [mode, setMode] = useState<Mode>("options");
  if (!user) return null;

  const finish = async (updatedUser: AppUser) => {
    const membership = updatedUser.organizationContexts.find((item) => item.isCurrent) ?? updatedUser.organizationContexts.at(-1);
    synchronizeUser(updatedUser);
    if (membership) await selectOrg(membership.organizationSlug);
    router.replace("/(tabs)");
  };

  if (memberships.length) return (
    <View style={styles.container}>
      <Header title="Choose a workspace" subtitle="Pick an organization to continue." />
      <FlatList data={memberships} keyExtractor={(item) => item.organizationId} contentContainerStyle={styles.list} ItemSeparatorComponent={() => <View style={styles.separator} />} renderItem={({ item }) => (
        <Pressable style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={async () => { await selectOrg(item.organizationSlug); router.replace("/(tabs)"); }}>
          <Text style={styles.cardTitle}>{item.organizationName}</Text><Text style={styles.cardBody}>{item.role}{item.houseName ? ` · ${item.houseName}` : ""}</Text>
        </Pressable>
      )} />
      <SignOut onPress={signOut} />
    </View>
  );

  return <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    {mode === "options" ? <View style={styles.grow}>
      <Header title="Set up your workspace" subtitle={`Welcome, ${user.displayName}. Create an organization or join one with an invite.`} />
      <View style={styles.options}>
        <Action testID="mobile.onboarding.create" title="Create a new organization" body="Set up houses and invite your team. You will become the owner." onPress={() => setMode("create")} />
        <Action testID="mobile.onboarding.join" title="Join with an invite link" body="Paste the invite link or token shared by an organization owner." onPress={() => setMode("join")} />
      </View><SignOut onPress={signOut} />
    </View> : mode === "create" ? <Create user={user} getAccessToken={getAccessToken} onBack={() => setMode("options")} onSuccess={finish} /> : <Join user={user} getAccessToken={getAccessToken} onBack={() => setMode("options")} onSuccess={finish} />}
  </KeyboardAvoidingView>;
}

function Create({ user, getAccessToken, onBack, onSuccess }: FormProps) {
  const [name, setName] = useState(""); const [slug, setSlug] = useState(""); const [slugEdited, setSlugEdited] = useState(false); const [house, setHouse] = useState(""); const [color, setColor] = useState(COLORS[0]);
  const validation = useMemo(() => name.trim().length < 2 ? "Enter an organization name." : !slugSchema.safeParse(slug).success ? "Use 2–60 lowercase letters, numbers, or hyphens for the URL name." : house.trim().length < 2 ? "Enter a name for the first house." : null, [name, slug, house]);
  const mutation = useMutation({ mutationFn: async () => callApi("/orgs/create", { displayName: user.displayName, ...(user.email ? { email: user.email } : {}), orgName: name.trim(), orgSlug: slug, firstHouseName: house.trim(), firstHouseColor: color }, { accessToken: await getAccessToken() }), onSuccess });
  return <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Back onPress={onBack} /><Header title="Create an organization" subtitle="You will be its owner and can invite members after setup." />
    <Field label="Organization name" value={name} onChangeText={(value) => { setName(value); if (!slugEdited) setSlug(slugifyOrganizationName(value)); }} placeholder="The Gregory Family" testID="mobile.onboarding.org-name" />
    <Field label="Organization URL name" value={slug} onChangeText={(value) => { setSlugEdited(true); setSlug(slugifyOrganizationName(value)); }} placeholder="the-gregory-family" autoCapitalize="none" testID="mobile.onboarding.org-slug" />
    <Field label="First house" value={house} onChangeText={setHouse} placeholder="House Phoenix" testID="mobile.onboarding.house-name" />
    <Text style={styles.label}>House color</Text><View style={styles.colors}>{COLORS.map((item) => <Pressable key={item} accessibilityLabel={`Select house color ${item}`} onPress={() => setColor(item)} style={[styles.color, { backgroundColor: item }, item === color && styles.selected]} />)}</View>
    {mutation.error ? <Text style={styles.error}>{message(mutation.error, "Unable to create the organization.")}</Text> : null}<Submit label="Create organization" pending={mutation.isPending} disabled={Boolean(validation)} onPress={() => mutation.mutate()} testID="mobile.onboarding.create-submit" />{validation ? <Text style={styles.hint}>{validation}</Text> : null}
  </ScrollView>;
}

function Join({ user, getAccessToken, onBack, onSuccess }: FormProps) {
  const [invite, setInvite] = useState(""); const parsed = parseInviteInput(invite);
  const mutation = useMutation({ mutationFn: async () => { if (!parsed) throw new Error("Invite is required"); return callApi("/orgs/join", { displayName: user.displayName, ...(user.email ? { email: user.email } : {}), ...parsed }, { accessToken: await getAccessToken() }); }, onSuccess });
  return <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Back onPress={onBack} /><Header title="Join an organization" subtitle="Paste the complete invite link or the invite token." /><Field label="Invite" value={invite} onChangeText={setInvite} placeholder="https://…/join/… or invite token" autoCapitalize="none" testID="mobile.onboarding.invite" />{mutation.error ? <Text style={styles.error}>{message(mutation.error, "Unable to accept this invitation.")}</Text> : null}<Submit label="Join organization" pending={mutation.isPending} disabled={!parsed} onPress={() => mutation.mutate()} testID="mobile.onboarding.join-submit" /></ScrollView>;
}

function Header({ title, subtitle }: { title: string; subtitle: string }) { return <View style={styles.header}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>; }
function Action({ title, body, onPress, testID }: { title: string; body: string; onPress: () => void; testID: string }) { return <Pressable testID={testID} style={({ pressed }) => [styles.card, pressed && styles.pressed]} onPress={onPress}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardBody}>{body}</Text></Pressable>; }
function Field({ label, ...props }: ComponentProps<typeof TextInput> & { label: string }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} style={styles.input} placeholderTextColor="#94a3b8" /></View>; }
function Submit({ label, pending, disabled, onPress, testID }: { label: string; pending: boolean; disabled: boolean; onPress: () => void; testID: string }) { return <Pressable testID={testID} disabled={disabled || pending} onPress={onPress} style={[styles.primary, (disabled || pending) && styles.disabled]}>{pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{label}</Text>}</Pressable>; }
function Back({ onPress }: { onPress: () => void }) { return <Pressable onPress={onPress} style={styles.back}><Text style={styles.backText}>‹ Back</Text></Pressable>; }
function SignOut({ onPress }: { onPress: () => Promise<void> }) { return <Pressable style={styles.signOut} onPress={() => void onPress()}><Text style={styles.signOutText}>Sign out</Text></Pressable>; }
function message(error: Error, fallback: string) { return error instanceof ApiResponseError ? error.message : fallback; }

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#f8fafc", padding: 24 }, grow: { flex: 1 }, header: { paddingTop: 24, paddingBottom: 24 }, title: { fontSize: 26, fontWeight: "700", color: "#0f172a", marginBottom: 8 }, subtitle: { fontSize: 15, color: "#475569", lineHeight: 21 }, list: { paddingBottom: 24 }, separator: { height: 12 }, options: { gap: 14, flex: 1 }, card: { backgroundColor: "#fff", borderRadius: 12, padding: 17, borderWidth: 1, borderColor: "#e2e8f0" }, pressed: { opacity: 0.72 }, cardTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 5 }, cardBody: { fontSize: 14, color: "#64748b", lineHeight: 20 }, form: { paddingBottom: 32 }, back: { alignSelf: "flex-start", paddingVertical: 8 }, backText: { color: "#7c3aed", fontSize: 16, fontWeight: "600" }, field: { marginBottom: 16 }, label: { color: "#334155", fontWeight: "600", marginBottom: 7 }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, color: "#0f172a", fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 }, colors: { flexDirection: "row", gap: 13, marginBottom: 22 }, color: { width: 36, height: 36, borderRadius: 18 }, selected: { borderWidth: 4, borderColor: "#0f172a" }, primary: { backgroundColor: "#7c3aed", borderRadius: 10, padding: 14, alignItems: "center", minHeight: 49 }, primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 }, disabled: { opacity: 0.48 }, error: { color: "#991b1b", marginBottom: 14 }, hint: { color: "#64748b", textAlign: "center", marginTop: 9, fontSize: 13 }, signOut: { alignItems: "center", paddingVertical: 12 }, signOutText: { color: "#dc2626", fontSize: 15, fontWeight: "500" } });
