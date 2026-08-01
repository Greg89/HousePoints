import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { DeepLinkAuthGate } from "@/components/DeepLinkAuthGate";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";

export default function InviteDeepLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, getAccessToken, refreshBootstrap } = useAppAuth();
  const { selectOrg } = useActiveOrg();

  const joinMutation = useMutation({
    mutationFn: async () => {
      if (!user || !token) throw new Error("Invite link is invalid.");
      const accessToken = await getAccessToken();
      return callApi(
        "/orgs/join",
        {
          displayName: user.displayName,
          ...(user.email ? { email: user.email } : {}),
          inviteToken: token,
        },
        { accessToken },
      );
    },
    onSuccess: async (joinedUser) => {
      const joinedMembership =
        joinedUser.organizationContexts.find(
          (membership) =>
            !user?.organizationContexts.some(
              (existing) => existing.organizationId === membership.organizationId,
            ),
        ) ??
        joinedUser.organizationContexts.find((membership) => membership.isCurrent) ??
        joinedUser.organizationContexts.at(-1);
      await refreshBootstrap();
      if (joinedMembership) {
        await selectOrg(joinedMembership.organizationSlug);
      }
      router.replace("/(tabs)");
    },
  });

  const errorMessage = joinMutation.error instanceof ApiResponseError
    ? joinMutation.error.message
    : joinMutation.error
      ? "Unable to accept this invitation."
      : null;

  return (
    <DeepLinkAuthGate>
      <View style={styles.container}>
        <Text style={styles.title}>Organization invitation</Text>
        <Text style={styles.body}>
          Accepting verifies this invitation with HousePoints and adds your
          account to the organization.
        </Text>
        <Pressable
          style={[styles.button, joinMutation.isPending && styles.disabled]}
          onPress={() => joinMutation.mutate()}
          disabled={joinMutation.isPending || !token}
        >
          {joinMutation.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Accept invitation</Text>
          )}
        </Pressable>
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </DeepLinkAuthGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 16, backgroundColor: "#f8fafc" },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  body: { fontSize: 15, lineHeight: 22, color: "#475569" },
  button: { backgroundColor: "#0f172a", borderRadius: 10, padding: 14, alignItems: "center" },
  buttonText: { color: "#ffffff", fontWeight: "700" },
  disabled: { opacity: 0.6 },
  error: { color: "#991b1b" },
});
