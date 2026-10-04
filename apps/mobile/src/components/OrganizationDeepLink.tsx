import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { DeepLinkAuthGate } from "./DeepLinkAuthGate";
import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { organizationDeepLinkState } from "@/lib/organization-deep-link";
import { logger, serializeError } from "@/lib/logger";

/** Shared route adapter: authenticate, recheck membership, then switch before navigating. */
export function OrganizationDeepLink({ slug, pointId }: { slug: string; pointId?: string }) {
  const { status } = useAppAuth();
  const { hydrated, memberships, activeOrgSlug, selectOrg } = useActiveOrg();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const membershipSlug = memberships.find(item => item.organizationSlug === slug)?.organizationSlug;
  const state = organizationDeepLinkState({ status, hydrated, memberships, slug, activeOrgSlug, selectedSlug });

  useFocusEffect(useCallback(() => {
    if (status !== "ready" || !hydrated || !membershipSlug) return;
    let cancelled = false;
    setError(false);
    setSelectedSlug(null);
    void selectOrg(membershipSlug).then(() => {
      if (!cancelled) setSelectedSlug(membershipSlug);
    }).catch(err => {
      if (!cancelled) setError(true);
      logger.warn("mobile.deep_link.organization_selection_failed", serializeError(err));
    });
    return () => { cancelled = true; };
  }, [status, hydrated, membershipSlug, selectOrg, retry]));

  useFocusEffect(useCallback(() => {
    if (state !== "ready" || error) return;
    if (pointId) router.replace({ pathname: "/(tabs)/activity", params: { pointId } });
    else router.replace("/(tabs)");
  }, [state, error, pointId]));

  return <DeepLinkAuthGate>
    <View style={styles.center}>
      {state === "unavailable" ? <>
        <Text style={styles.error}>You do not have access to this organization.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace("/")}><Text>Continue to HousePoints</Text></Pressable>
      </> : error ? <>
        <Text style={styles.error}>This organization could not be opened. Please try again.</Text>
        <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text>Try again</Text></Pressable>
      </> : <ActivityIndicator size="large" />}
    </View>
  </DeepLinkAuthGate>;
}
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  error: { color: "#991b1b", textAlign: "center" },
});
