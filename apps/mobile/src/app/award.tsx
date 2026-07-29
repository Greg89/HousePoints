import {
  TRAIT_LABELS,
  TRAITS,
  type OrgMember,
  type Trait,
} from "@housepoints/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { logger, serializeError } from "@/lib/logger";

const DELTA_MIN = 1;
const DELTA_MAX = 100;
const REASON_MIN = 3;
const REASON_MAX = 240;
const DELTA_DEFAULT = 5;
const DELTA_QUICK_VALUES = [1, 5, 10, 25] as const;

export default function AwardPointsScreen() {
  const { user, getAccessToken } = useAppAuth();
  const { activeOrgSlug } = useActiveOrg();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedTrait, setSelectedTrait] = useState<Trait | null>(null);
  const [delta, setDelta] = useState(DELTA_DEFAULT);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  const membersQuery = useQuery({
    queryKey: ["members", activeOrgSlug],
    enabled: activeOrgSlug !== null,
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

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const term = search.trim().toLowerCase();
    const eligible = members.filter(
      (member) => member.houseId !== null && member.id !== user?.id,
    );
    if (!term) return eligible;
    return eligible.filter((member) =>
      member.displayName.toLowerCase().includes(term),
    );
  }, [members, search, user?.id]);

  const selectedMember = useMemo(
    () => members?.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const trimmedReason = reason.trim();
  const reasonLength = trimmedReason.length;
  const canSubmit =
    Boolean(selectedMemberId) &&
    Boolean(selectedTrait) &&
    delta >= DELTA_MIN &&
    delta <= DELTA_MAX &&
    reasonLength >= REASON_MIN &&
    reasonLength <= REASON_MAX;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMemberId || !selectedTrait) {
        throw new Error("Missing target user or trait selection");
      }
      const accessToken = await getAccessToken();
      return callApi(
        "/points/adjust",
        {
          targetUserId: selectedMemberId,
          trait: selectedTrait,
          delta,
          reason: trimmedReason,
        },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: () => {
      showToast({ message: "Points awarded", variant: "success" });
      logger.info("mobile.award_points.success", {
        targetUserId: selectedMemberId,
        delta,
        trait: selectedTrait,
      });
      void queryClient.invalidateQueries({ queryKey: ["activity"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["houses"] });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    },
    onError: (error) => {
      const message =
        error instanceof ApiResponseError
          ? error.message
          : "Unable to award points. Please try again.";
      showToast({ message, variant: "error" });
      logger.warn("mobile.award_points.failed", serializeError(error));
    },
  });

  const step = (change: number) => {
    setDelta((current) => clamp(current + change, DELTA_MIN, DELTA_MAX));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Award points",
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
          <Section title="Recipient">
            {selectedMember ? (
              <SelectedMember
                member={selectedMember}
                onClear={() => setSelectedMemberId(null)}
              />
            ) : membersQuery.isPending ? (
              <ActivityIndicator style={styles.pad} color="#0f172a" />
            ) : membersQuery.error ? (
              <ErrorText>
                Unable to load members. Pull down or tap here to retry.
              </ErrorText>
            ) : (
              <>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search by name"
                  placeholderTextColor="#94a3b8"
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                <MemberList
                  members={filteredMembers}
                  onSelect={setSelectedMemberId}
                />
              </>
            )}
          </Section>

          {selectedMember ? (
            <>
              <Section title="Trait">
                <View style={styles.traitGrid}>
                  {TRAITS.map((trait) => {
                    const active = trait === selectedTrait;
                    return (
                      <Pressable
                        key={trait}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setSelectedTrait(trait)}
                      >
                        <Text
                          style={[
                            styles.chipLabel,
                            active && styles.chipLabelActive,
                          ]}
                        >
                          {TRAIT_LABELS[trait]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>

              <Section title={`Points (${DELTA_MIN}\u2013${DELTA_MAX})`}>
                <View style={styles.stepperRow}>
                  <StepperButton label="\u2212" onPress={() => step(-1)} />
                  <Text style={styles.deltaValue}>{delta}</Text>
                  <StepperButton label="+" onPress={() => step(1)} />
                </View>
                <View style={styles.quickRow}>
                  {DELTA_QUICK_VALUES.map((value) => {
                    const active = value === delta;
                    return (
                      <Pressable
                        key={value}
                        style={[styles.quickChip, active && styles.chipActive]}
                        onPress={() => setDelta(value)}
                      >
                        <Text
                          style={[
                            styles.chipLabel,
                            active && styles.chipLabelActive,
                          ]}
                        >
                          {value}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Section>

              <Section title="Reason">
                <TextInput
                  style={styles.reasonInput}
                  placeholder={`At least ${REASON_MIN} characters`}
                  placeholderTextColor="#94a3b8"
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  maxLength={REASON_MAX}
                  textAlignVertical="top"
                />
                <Text style={styles.counter}>
                  {reasonLength}/{REASON_MAX}
                </Text>
              </Section>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.submitButton,
              (!canSubmit || submitMutation.isPending) &&
                styles.submitButtonDisabled,
            ]}
            disabled={!canSubmit || submitMutation.isPending}
            onPress={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitLabel}>Award {delta} points</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SelectedMember({
  member,
  onClear,
}: {
  member: OrgMember;
  onClear: () => void;
}) {
  return (
    <View style={styles.selectedMember}>
      <View
        style={[
          styles.dot,
          { backgroundColor: member.houseColor ?? "#94a3b8" },
        ]}
      />
      <View style={styles.selectedMemberText}>
        <Text style={styles.selectedName}>{member.displayName}</Text>
        {member.houseName ? (
          <Text style={styles.selectedMeta}>{member.houseName}</Text>
        ) : null}
      </View>
      <Pressable onPress={onClear} style={styles.changeButton}>
        <Text style={styles.changeLabel}>Change</Text>
      </Pressable>
    </View>
  );
}

function MemberList({
  members,
  onSelect,
}: {
  members: OrgMember[];
  onSelect: (id: string) => void;
}) {
  if (members.length === 0) {
    return <ErrorText>No members match that search.</ErrorText>;
  }
  return (
    <FlatList
      style={styles.memberList}
      data={members}
      keyExtractor={(item) => item.id}
      ItemSeparatorComponent={MemberSeparator}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <Pressable
          style={styles.memberRow}
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
            {item.houseName ? (
              <Text style={styles.memberMeta}>{item.houseName}</Text>
            ) : null}
          </View>
        </Pressable>
      )}
    />
  );
}

function MemberSeparator() {
  return <View style={styles.memberSeparator} />;
}

function StepperButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.stepperButton} onPress={onPress}>
      <Text style={styles.stepperLabel}>{label}</Text>
    </Pressable>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.errorText}>{children}</Text>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 24, gap: 20 },
  pad: { padding: 20 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
  },
  memberList: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 4,
    maxHeight: 320,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  memberSeparator: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  memberText: { flex: 1 },
  memberName: { fontSize: 15, color: "#0f172a", fontWeight: "500" },
  memberMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  selectedMember: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  selectedMemberText: { flex: 1 },
  selectedName: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  selectedMeta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  changeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  changeLabel: { fontSize: 13, fontWeight: "600", color: "#334155" },
  traitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  chipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  chipLabel: { fontSize: 13, color: "#0f172a", fontWeight: "500" },
  chipLabelActive: { color: "#ffffff" },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingVertical: 8,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperLabel: { fontSize: 22, fontWeight: "600", color: "#0f172a" },
  deltaValue: {
    fontSize: 32,
    fontWeight: "700",
    color: "#0f172a",
    minWidth: 60,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  quickRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    minWidth: 44,
    alignItems: "center",
  },
  reasonInput: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    minHeight: 96,
  },
  counter: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "right",
    marginTop: 4,
  },
  errorText: {
    color: "#64748b",
    fontSize: 13,
    padding: 8,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  submitButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  submitLabel: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
});
