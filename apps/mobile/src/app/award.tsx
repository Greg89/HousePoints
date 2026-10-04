import {
  createPointSubmissionKeys,
  RECOGNITION_CATEGORY_API_VERSION,
  TRAIT_LABELS,
  TRAITS,
  type OrgMember,
  type RecognitionCategory,
  type Trait,
} from "@housepoints/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";
import { env } from "@/lib/env";
import { eligibleAwardMembers } from "@/lib/award-members";
import {
  AWARD_POINTS_DEFAULT,
  AWARD_POINTS_MAX,
  AWARD_POINTS_MIN,
  parseAwardPoints,
  stepAwardPoints,
} from "@/lib/award-points";
import { logger, serializeError } from "@/lib/logger";
import { invalidateMobileQueries, mobileMutationInvalidations, mobileQueryKeys } from "@/lib/mobile-query-keys";
import { MOBILE_QUERY_STALE_MS } from "@/lib/query-policy";
import { availableRecognitionCategories, recognitionCategoryAwardsEnabled, selectedRecognitionCategory } from "@/lib/recognition-categories";
import { generateRequestId } from "@/lib/request-id";

const REASON_MIN = 3;
const REASON_MAX = 240;
const DELTA_QUICK_VALUES = [1, 5, 10, 25] as const;

export default function AwardPointsScreen() {
  const { user, getAccessToken } = useAppAuth();
  const { activeOrgSlug, activeMembership } = useActiveOrg();
  const categoriesEnabled = recognitionCategoryAwardsEnabled(
    env.recognitionCategoriesEnabled,
    env.recognitionCategoryRolloutOrganizationIds,
    activeMembership?.organizationId,
  );
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(85);

  const submissionKeys = useRef(createPointSubmissionKeys(generateRequestId));
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedTrait, setSelectedTrait] = useState<Trait | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [pointsInput, setPointsInput] = useState(String(AWARD_POINTS_DEFAULT));
  const delta = parseAwardPoints(pointsInput);
  const [reason, setReason] = useState("");
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [recognitionPickerOpen, setRecognitionPickerOpen] = useState(false);
  const previousOrgSlug = useRef(activeOrgSlug);

  useEffect(() => {
    if (previousOrgSlug.current === activeOrgSlug) return;
    previousOrgSlug.current = activeOrgSlug;
    setSelectedMemberId(null);
    setSelectedTrait(null);
    setSelectedCategoryId(null);
    setCategoryError(null);
    submissionKeys.current = createPointSubmissionKeys(generateRequestId);
  }, [activeOrgSlug]);

  const membersQuery = useQuery({
    queryKey: mobileQueryKeys.members(activeOrgSlug),
    staleTime: MOBILE_QUERY_STALE_MS.members,
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

  const categoriesQuery = useQuery({
    queryKey: mobileQueryKeys.recognitionCategories(activeOrgSlug),
    enabled: categoriesEnabled && activeOrgSlug !== null,
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      const response = await callApi("/recognition-categories/list", { includeArchived: true }, { accessToken, organizationSlug: activeOrgSlug, signal });
      return response.categories;
    },
  });

  const categories: RecognitionCategory[] | undefined = categoriesQuery.data;
  const availableCategories = useMemo(() => availableRecognitionCategories(categories), [categories]);
  const selectedCategory = selectedRecognitionCategory(categories, selectedCategoryId);
  const categoryUnavailable = Boolean(selectedCategoryId) && (!selectedCategory || selectedCategory.archivedAt !== null);
  const recognitionOptions = useMemo(() => categoriesEnabled
    ? availableCategories.map((category) => ({ value: category.id, label: category.name }))
    : TRAITS.map((trait) => ({ value: trait, label: TRAIT_LABELS[trait] })), [availableCategories, categoriesEnabled]);
  const selectedRecognitionLabel = categoriesEnabled
    ? selectedCategory?.name ?? null
    : selectedTrait ? TRAIT_LABELS[selectedTrait] : null;

  const members: OrgMember[] | undefined = membersQuery.data;

  const eligibleMembers = useMemo(
    () => eligibleAwardMembers(members, user?.id),
    [members, user?.id],
  );

  const selectedMember = useMemo(
    () => members?.find((member) => member.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const trimmedReason = reason.trim();
  const reasonLength = trimmedReason.length;
  const canSubmit =
    Boolean(selectedMemberId) &&
    (categoriesEnabled
      ? Boolean(selectedCategoryId) && !categoryUnavailable && !categoryError
      : Boolean(selectedTrait)) &&
    delta !== null &&
    reasonLength >= REASON_MIN &&
    reasonLength <= REASON_MAX;

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMemberId || (categoriesEnabled ? !selectedCategoryId : !selectedTrait)) {
        throw new Error("Missing target user or recognition selection");
      }
      if (delta === null) {
        throw new Error("Invalid award points");
      }
      const payload = categoriesEnabled
        ? { targetUserId: selectedMemberId, categoryApiVersion: RECOGNITION_CATEGORY_API_VERSION, categoryId: selectedCategoryId!, delta, reason: trimmedReason }
        : { targetUserId: selectedMemberId, trait: selectedTrait!, delta, reason: trimmedReason };
      const idempotencyKey = submissionKeys.current.keyFor([activeOrgSlug, payload]);
      const accessToken = await getAccessToken();
      const transaction = await callApi(
        "/points/adjust",
        { ...payload, idempotencyKey },
        { accessToken, organizationSlug: activeOrgSlug },
      );
      submissionKeys.current.complete(idempotencyKey);
      return transaction;
    },
    onSuccess: () => {
      showToast({ message: "Points awarded", variant: "success" });
      logger.info("mobile.award_points.success", {
        targetUserId: selectedMemberId,
        delta,
        trait: selectedTrait,
        categoryId: selectedCategoryId,
      });
      void invalidateMobileQueries(
        queryClient,
        mobileMutationInvalidations.pointsChanged(activeOrgSlug),
      );
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)");
      }
    },
    onError: (error) => {
      if (categoriesEnabled && error instanceof ApiResponseError && error.code === "RECOGNITION_CATEGORY_UNAVAILABLE") {
        setCategoryError("This category is no longer available. Your draft is saved; choose another category.");
        void categoriesQuery.refetch();
      }
      const message =
        error instanceof ApiResponseError
          ? error.message
          : "Unable to award points. Please try again.";
      showToast({ message, variant: "error" });
      logger.warn("mobile.award_points.failed", serializeError(error));
    },
  });

  const step = (change: -1 | 1) => {
    setPointsInput((current) => stepAwardPoints(current, change));
  };
  const submitLabel = delta === null ? "Award points" : `Award ${delta} points`;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Stack.Screen
        options={{
          presentation: "modal",
          headerShown: true,
          title: "Award points",
        }}
      />
      <View style={styles.flex}>
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={styles.container}
          bottomOffset={footerHeight + 12}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Section title="Recipient">
            {membersQuery.isPending ? (
              <ActivityIndicator style={styles.pad} color="#0f172a" />
            ) : membersQuery.error ? (
              <Pressable onPress={() => void membersQuery.refetch()}>
                <ErrorText>Unable to load members. Tap to retry.</ErrorText>
              </Pressable>
            ) : eligibleMembers.length === 0 ? (
              <ErrorText>No other assigned members are available.</ErrorText>
            ) : (
              <MemberSelect
                selectedMember={selectedMember}
                onPress={() => setMemberPickerOpen(true)}
              />
            )}
          </Section>

          {selectedMember ? (
            <>
              <Section title={categoriesEnabled ? "Category" : "Trait"}>
                <RecognitionSelect
                  mode={categoriesEnabled ? "category" : "trait"}
                  selectedLabel={selectedRecognitionLabel}
                  onPress={() => { if (categoriesEnabled) void categoriesQuery.refetch(); setRecognitionPickerOpen(true); }}
                />
                {categoryUnavailable || categoryError ? <ErrorText>{categoryError ?? "This category is no longer available. Choose another category."}</ErrorText> : null}
              </Section>

              <Section title={`Points (${AWARD_POINTS_MIN}\u2013${AWARD_POINTS_MAX})`}>
                <View style={styles.stepperRow}>
                  <StepperButton label={"\u2212"} onPress={() => step(-1)} />
                  <TextInput
                    testID="mobile.award.points"
                    accessibilityLabel="Points to award"
                    accessibilityHint="Enter a whole number from 1 to 100"
                    style={styles.deltaValue}
                    value={pointsInput}
                    onChangeText={setPointsInput}
                    keyboardType="number-pad"
                    maxLength={3}
                    selectTextOnFocus
                  />
                  <StepperButton label="+" onPress={() => step(1)} />
                </View>
                <View style={styles.quickRow}>
                  {DELTA_QUICK_VALUES.map((value) => {
                    const active = value === delta;
                    return (
                      <Pressable
                        key={value}
                        style={[styles.quickChip, active && styles.chipActive]}
                        onPress={() => setPointsInput(String(value))}
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
                {delta === null ? (
                  <Text style={styles.pointsError} accessibilityLiveRegion="polite">
                    Enter a whole number from 1 to 100.
                  </Text>
                ) : null}
              </Section>

              <Section title="Reason">
                <TextInput
                  testID="mobile.award.reason"
                  accessibilityLabel="Award reason"
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
        </KeyboardAwareScrollView>

        <KeyboardStickyView
          style={styles.footer}
          offset={{ opened: insets.bottom }}
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        >
          <Pressable
            testID="mobile.award.submit"
            accessibilityLabel={submitLabel}
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
              <Text style={styles.submitLabel}>{submitLabel}</Text>
            )}
          </Pressable>
        </KeyboardStickyView>
      </View>
      <MemberSelectModal
        visible={memberPickerOpen}
        members={eligibleMembers}
        selectedMemberId={selectedMemberId}
        onClose={() => setMemberPickerOpen(false)}
        onSelect={(memberId) => {
          setSelectedMemberId(memberId);
          setMemberPickerOpen(false);
        }}
      />
      <RecognitionSelectModal
        visible={recognitionPickerOpen}
        mode={categoriesEnabled ? "category" : "trait"}
        options={recognitionOptions}
        selectedValue={categoriesEnabled ? selectedCategoryId : selectedTrait}
        loading={categoriesEnabled && categoriesQuery.isPending}
        error={categoriesEnabled && categoriesQuery.error ? "Categories could not load. Tap to retry." : null}
        onRetry={() => void categoriesQuery.refetch()}
        onClose={() => setRecognitionPickerOpen(false)}
        onSelect={(value) => {
          if (categoriesEnabled) { setSelectedCategoryId(value); setCategoryError(null); }
          else setSelectedTrait(value as Trait);
          setRecognitionPickerOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

type RecognitionMode = "category" | "trait";
type RecognitionOption = { value: string; label: string };

function RecognitionSelect({ mode, selectedLabel, onPress }: {
  mode: RecognitionMode;
  selectedLabel: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`mobile.award.${mode}-select`}
      accessibilityRole="button"
      accessibilityLabel={selectedLabel ? `Selected ${mode}: ${selectedLabel}` : `Select a ${mode}`}
      accessibilityHint={`Opens the list of ${mode === "category" ? "categories" : "traits"}`}
      style={styles.selectField}
      onPress={onPress}
    >
      <Text
        style={selectedLabel ? styles.selectedName : styles.memberPlaceholder}
      >
        {selectedLabel ?? `Select a ${mode}...`}
      </Text>
      <Text style={styles.caret} accessibilityElementsHidden>
        ▾
      </Text>
    </Pressable>
  );
}

function RecognitionSelectModal({
  visible,
  mode,
  options,
  selectedValue,
  loading,
  error,
  onRetry,
  onClose,
  onSelect,
}: {
  visible: boolean;
  mode: RecognitionMode;
  options: RecognitionOption[];
  selectedValue: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const title = mode === "category" ? "Select category" : "Select trait";
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`Close ${mode} list`}
          onPress={onClose}
        />
        <View style={styles.memberModal}>
          <View style={styles.memberModalHeader}>
            <View>
              <Text style={styles.memberModalTitle}>{title}</Text>
              <Text style={styles.memberModalDescription}>
                Choose what this award recognizes
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${mode} list`}
              onPress={onClose}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseLabel}>×</Text>
            </Pressable>
          </View>
          {loading ? <ActivityIndicator style={styles.pad} color="#0f172a" /> : error ? <Pressable onPress={onRetry}><ErrorText>{error}</ErrorText></Pressable> : options.length === 0 ? <ErrorText>No available categories. Ask an owner to add one.</ErrorText> : <FlatList
              data={options}
              keyExtractor={(option) => option.value}
              ItemSeparatorComponent={MemberSeparator}
              renderItem={({ item: option }) => {
                const selected = option.value === selectedValue;
                return <Pressable
                  testID={`mobile.award.${mode}.${option.value}`}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected }}
                  style={[styles.traitRow, selected && styles.memberRowSelected]}
                  onPress={() => onSelect(option.value)}
                >
                  <Text style={styles.traitName}>{option.label}</Text>
                  {selected ? <Text style={styles.selectedCheck}>✓</Text> : null}
                </Pressable>;
              }}
            />}
        </View>
      </View>
    </Modal>
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

function MemberSelect({
  selectedMember,
  onPress,
}: {
  selectedMember: OrgMember | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="mobile.award.member-select"
      accessibilityRole="button"
      accessibilityLabel="Select award recipient"
      accessibilityHint="Opens a list of assigned organization members"
      style={styles.memberSelect}
      onPress={onPress}
    >
      {selectedMember ? (
        <View
          style={[
            styles.dot,
            { backgroundColor: selectedMember.houseColor ?? "#94a3b8" },
          ]}
        />
      ) : null}
      <View style={styles.memberSelectText}>
        <Text
          style={
            selectedMember ? styles.selectedName : styles.memberPlaceholder
          }
        >
          {selectedMember?.displayName ?? "Select a team member..."}
        </Text>
        {selectedMember?.houseName ? (
          <Text style={styles.selectedMeta}>{selectedMember.houseName}</Text>
        ) : null}
      </View>
      <Text style={styles.caret} accessibilityElementsHidden>
        ▾
      </Text>
    </Pressable>
  );
}

function MemberSelectModal({
  visible,
  members,
  selectedMemberId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  members: OrgMember[];
  selectedMemberId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Close recipient list"
          onPress={onClose}
        />
        <View style={styles.memberModal}>
          <View style={styles.memberModalHeader}>
            <View>
              <Text style={styles.memberModalTitle}>Select recipient</Text>
              <Text style={styles.memberModalDescription}>
                Assigned members in this organization
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close recipient list"
              onPress={onClose}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseLabel}>×</Text>
            </Pressable>
          </View>
          <FlatList
            data={members}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={MemberSeparator}
            renderItem={({ item }) => {
              const selected = item.id === selectedMemberId;
              return (
                <Pressable
                  testID={`mobile.award.member-option.${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.displayName}${item.houseName ? `, ${item.houseName}` : ""}`}
                  accessibilityState={{ selected }}
                  style={[styles.memberRow, selected && styles.memberRowSelected]}
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
                  {selected ? <Text style={styles.selectedCheck}>✓</Text> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
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
  memberSelect: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectField: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  memberSelectText: { flex: 1 },
  memberPlaceholder: { fontSize: 15, color: "#64748b" },
  caret: { fontSize: 20, color: "#64748b" },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  memberModal: {
    maxHeight: "72%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
  },
  memberModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  memberModalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  memberModalDescription: { fontSize: 12, color: "#64748b", marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  modalCloseLabel: { fontSize: 24, lineHeight: 26, color: "#334155" },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  memberRowSelected: { backgroundColor: "#f1f5f9" },
  memberSeparator: {
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  memberText: { flex: 1 },
  memberName: { fontSize: 15, color: "#0f172a", fontWeight: "500" },
  memberMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  selectedName: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  selectedMeta: { fontSize: 13, color: "#64748b", marginTop: 2 },
  selectedCheck: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  traitRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  traitName: { flex: 1, fontSize: 15, color: "#0f172a", fontWeight: "500" },
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
    width: 96,
    minHeight: 52,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    backgroundColor: "#ffffff",
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
  pointsError: { color: "#b91c1c", fontSize: 13, textAlign: "center", marginTop: 8 },
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
