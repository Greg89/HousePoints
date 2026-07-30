import type { OrgMember } from "@housepoints/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, Stack, router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";
import { env } from "@/lib/env";
import { logger, serializeError } from "@/lib/logger";
import { canAccessMobileAdmin } from "@/lib/mobile-admin";
import {
  DEDUCTION_AMOUNT,
  DEDUCTION_REASON_MAX,
  DEDUCTION_REASON_MIN,
  eligibleDeductionMembers,
  pointDeductionErrorMessage,
} from "@/lib/point-deduction";

export default function DeductPointsScreen() {
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug, activeMembership } = useActiveOrg();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const allowed =
    env.pointAdjustmentsEnabled &&
    canAccessMobileAdmin(env.mobileAdminEnabled, activeMembership?.role);

  const membersQuery = useQuery({
    queryKey: ["members", activeOrgSlug],
    enabled: allowed && activeOrgSlug !== null,
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/members",
        {},
        { accessToken, organizationSlug: activeOrgSlug, signal },
      );
    },
  });
  const members: OrgMember[] | undefined = membersQuery.data;
  const eligibleMembers = useMemo(
    () =>
      eligibleDeductionMembers(
        members ?? [],
        activeMembership?.houseId ?? null,
        search,
      ),
    [activeMembership?.houseId, members, search],
  );
  const selectedMember =
    members?.find((member) => member.id === selectedMemberId) ?? null;
  const trimmedReason = reason.trim();
  const canSubmit =
    selectedMember !== null &&
    trimmedReason.length >= DEDUCTION_REASON_MIN &&
    trimmedReason.length <= DEDUCTION_REASON_MAX;

  const deduction = useMutation({
    mutationFn: async () => {
      if (!selectedMemberId) {
        throw new Error("A deduction target is required");
      }
      const accessToken = await getAccessToken();
      return callApi(
        "/points/deduct",
        { targetUserId: selectedMemberId, reason: trimmedReason },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: (transaction) => {
      showToast({
        message: `${DEDUCTION_AMOUNT} points deducted`,
        variant: "success",
      });
      logger.info("mobile.admin.points_deducted", {
        transactionId: transaction.id,
        targetUserId: selectedMemberId,
      });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["houses"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-context"] });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/admin");
      }
    },
    onError: (error) => {
      const fallback =
        error instanceof ApiResponseError
          ? error.message
          : "Unable to deduct points. Please try again.";
      showToast({
        message: pointDeductionErrorMessage(
          error instanceof ApiResponseError ? error.code : undefined,
          fallback,
        ),
        variant: "error",
      });
      logger.warn("mobile.admin.points_deduction_failed", serializeError(error));
    },
  });

  if (!allowed || !activeOrgSlug) {
    return <Redirect href="/(tabs)" />;
  }

  const confirmDeduction = () => {
    if (!canSubmit || !selectedMember) {
      return;
    }
    Alert.alert(
      "Confirm deduction",
      `Deduct ${DEDUCTION_AMOUNT} points from ${selectedMember.displayName}? This will appear in Activity and the audit trail.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deduct points",
          style: "destructive",
          onPress: () => deduction.mutate(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Deduct points",
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Fixed deduction: 10 points</Text>
            <Text style={styles.noticeText}>
              Your house can deduct once every 24 hours. A member can receive
              only one deduction during that window.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Member from another house</Text>
            {activeMembership?.houseId ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Search by name"
                  placeholderTextColor="#94a3b8"
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
                {membersQuery.isPending ? (
                  <ActivityIndicator style={styles.loading} color="#0f172a" />
                ) : membersQuery.isError ? (
                  <Pressable onPress={() => void membersQuery.refetch()}>
                    <Text style={styles.errorText}>
                      Unable to load members. Tap to retry.
                    </Text>
                  </Pressable>
                ) : (
                  <MemberList
                    members={eligibleMembers}
                    selectedId={selectedMemberId}
                    onSelect={setSelectedMemberId}
                  />
                )}
              </>
            ) : (
              <Text style={styles.errorText}>
                You must be assigned to a house before deducting points.
              </Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reason</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Explain why points are being deducted"
              placeholderTextColor="#94a3b8"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={DEDUCTION_REASON_MAX}
              textAlignVertical="top"
            />
            <Text style={styles.helper}>
              {trimmedReason.length}/{DEDUCTION_REASON_MAX}. This reason is
              visible in Activity.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.submitButton,
              (!canSubmit || deduction.isPending) && styles.submitDisabled,
            ]}
            disabled={!canSubmit || deduction.isPending}
            onPress={confirmDeduction}
          >
            {deduction.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>
                Deduct {DEDUCTION_AMOUNT} points
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MemberList({
  members,
  selectedId,
  onSelect,
}: {
  members: OrgMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (members.length === 0) {
    return <Text style={styles.emptyText}>No eligible members found.</Text>;
  }
  return (
    <FlatList
      data={members}
      keyExtractor={(member) => member.id}
      scrollEnabled={false}
      style={styles.memberList}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => {
        const selected = item.id === selectedId;
        return (
          <Pressable
            style={[styles.memberRow, selected && styles.memberSelected]}
            onPress={() => onSelect(item.id)}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: item.houseColor ?? "#94a3b8" },
              ]}
            />
            <View style={styles.memberText}>
              <Text style={styles.memberName}>{item.displayName}</Text>
              <Text style={styles.memberHouse}>{item.houseName}</Text>
            </View>
            <Text style={styles.selection}>{selected ? "Selected" : ""}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  flex: { flex: 1 },
  container: { padding: 20, gap: 20, paddingBottom: 24 },
  notice: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
    gap: 4,
  },
  noticeTitle: { color: "#991b1b", fontWeight: "700", fontSize: 15 },
  noticeText: { color: "#7f1d1d", fontSize: 13, lineHeight: 19 },
  section: { gap: 8 },
  sectionTitle: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  loading: { padding: 24 },
  errorText: { color: "#b91c1c", padding: 12, textAlign: "center" },
  emptyText: { color: "#64748b", padding: 16, textAlign: "center" },
  memberList: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    gap: 10,
  },
  memberSelected: { backgroundColor: "#fef2f2" },
  separator: { height: 1, backgroundColor: "#e2e8f0" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  memberText: { flex: 1 },
  memberName: { color: "#0f172a", fontWeight: "600" },
  memberHouse: { color: "#64748b", fontSize: 12, marginTop: 2 },
  selection: { color: "#991b1b", fontSize: 12, fontWeight: "600" },
  reasonInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  helper: { color: "#64748b", fontSize: 12, textAlign: "right" },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  submitButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#b91c1c",
  },
  submitDisabled: { backgroundColor: "#94a3b8" },
  submitText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});

