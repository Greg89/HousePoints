import type { AppUserOrganizationContext } from "@housepoints/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";
import { logger, serializeError } from "@/lib/logger";
import { invalidateMobileQueries, mobileMutationInvalidations } from "@/lib/mobile-query-keys";
import { organizationOptions } from "@/lib/organization-selector";

const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 120;

export default function ProfileScreen() {
  const { user, signOut, refreshBootstrap, getAccessToken } = useAppAuth();
  const { activeOrgSlug, activeMembership, memberships, selectOrg } =
    useActiveOrg();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(user?.displayName ?? "");
  const [organizationPickerOpen, setOrganizationPickerOpen] = useState(false);

  const trimmedDraft = draftName.trim();
  const canSave =
    editing &&
    trimmedDraft.length >= DISPLAY_NAME_MIN &&
    trimmedDraft.length <= DISPLAY_NAME_MAX &&
    trimmedDraft !== user?.displayName;

  const updateNameMutation = useMutation({
    mutationFn: async (nextName: string) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/users/profile",
        { displayName: nextName },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: async () => {
      showToast({ message: "Display name updated", variant: "success" });
      logger.info("mobile.profile.name_updated");
      void invalidateMobileQueries(
        queryClient,
        mobileMutationInvalidations.profileChanged(activeOrgSlug),
      );
      setEditing(false);
      try {
        await refreshBootstrap();
      } catch (err) {
        logger.warn("mobile.profile.refresh_after_update_failed", serializeError(err));
      }
    },
    onError: (err) => {
      const message =
        err instanceof ApiResponseError
          ? err.message
          : "Unable to update your display name. Please try again.";
      showToast({ message, variant: "error" });
      logger.warn("mobile.profile.name_update_failed", serializeError(err));
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      return callApi(
        "/users/account-deletion",
        {},
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: async () => {
      logger.info("mobile.account_deletion.requested");
      await signOut();
    },
    onError: (err) => {
      const message =
        err instanceof ApiResponseError
          ? err.message
          : "Unable to request account deletion. Please try again.";
      Alert.alert("Account not deleted", message);
      logger.warn("mobile.account_deletion.failed", serializeError(err));
    },
  });

  const confirmAccountDeletion = useCallback(() => {
    Alert.alert(
      "Delete your HousePoints account?",
      "You will lose access to every HousePoints organization. Your name, email, login identity, and notification registrations will be removed during processing. Historical point and audit records may be retained in anonymized form. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => deleteAccountMutation.mutate(),
        },
      ],
    );
  }, [deleteAccountMutation]);

  const startEditing = useCallback(() => {
    setDraftName(user?.displayName ?? "");
    setEditing(true);
  }, [user?.displayName]);

  const cancelEditing = useCallback(() => {
    setDraftName(user?.displayName ?? "");
    setEditing(false);
  }, [user?.displayName]);

  const submitName = useCallback(() => {
    if (!canSave) return;
    updateNameMutation.mutate(trimmedDraft);
  }, [canSave, trimmedDraft, updateNameMutation]);

  const openOrganizationPicker = () => {
    if (memberships.length <= 1) {
      showToast({
        message: "You only belong to one organization.",
        variant: "info",
      });
      return;
    }
    setOrganizationPickerOpen(true);
  };

  const switchOrganization = async (
    membership: AppUserOrganizationContext,
  ) => {
    setOrganizationPickerOpen(false);
    if (membership.organizationSlug === activeOrgSlug) return;

    try {
      await selectOrg(membership.organizationSlug);
      showToast({
        message: `Switched to ${membership.organizationName}`,
        variant: "success",
      });
    } catch (err) {
      showToast({
        message: "Unable to switch organizations. Please try again.",
        variant: "error",
      });
      logger.warn("mobile.profile.organization_switch_failed", serializeError(err));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.label}>Display name</Text>
            {!editing ? (
              <Pressable onPress={startEditing} hitSlop={8}>
                <Text style={styles.linkAction}>Edit</Text>
              </Pressable>
            ) : null}
          </View>
          {editing ? (
            <>
              <TextInput
                style={styles.input}
                value={draftName}
                onChangeText={setDraftName}
                maxLength={DISPLAY_NAME_MAX}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={submitName}
                editable={!updateNameMutation.isPending}
                placeholder="Your display name"
                placeholderTextColor="#94a3b8"
              />
              <Text style={styles.counter}>
                {trimmedDraft.length}/{DISPLAY_NAME_MAX}
              </Text>
              <View style={styles.editActions}>
                <Pressable
                  style={[styles.secondaryButton, updateNameMutation.isPending && styles.buttonDisabled]}
                  onPress={cancelEditing}
                  disabled={updateNameMutation.isPending}
                >
                  <Text style={styles.secondaryLabel}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.primaryButton,
                    (!canSave || updateNameMutation.isPending) && styles.buttonDisabled,
                  ]}
                  onPress={submitName}
                  disabled={!canSave || updateNameMutation.isPending}
                >
                  {updateNameMutation.isPending ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryLabel}>Save</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <Text style={styles.value}>{user?.displayName ?? "-"}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? "-"}</Text>
        </View>

        <Pressable
          testID="mobile.profile.organization-select"
          accessibilityRole="button"
          accessibilityLabel={`Organization: ${activeMembership?.organizationName ?? "None selected"}`}
          accessibilityHint="Opens your organization list"
          style={styles.card}
          onPress={openOrganizationPicker}
        >
          <Text style={styles.label}>Organization</Text>
          <View style={styles.organizationValueRow}>
            <View style={styles.organizationText}>
              <Text style={styles.value}>
                {activeMembership?.organizationName ?? "-"}
              </Text>
              <Text style={styles.meta}>
                {activeMembership?.role ?? ""}
                {activeMembership?.houseName
                  ? ` \u00b7 ${activeMembership.houseName}`
                  : ""}
              </Text>
            </View>
            <Text style={styles.caret} accessibilityElementsHidden>
              ▾
            </Text>
          </View>
        </Pressable>

        <Pressable
          style={styles.signOut}
          onPress={() => {
            void signOut();
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={styles.dangerDescription}>
            Permanently remove your HousePoints access and request deletion of
            your personal account information.
          </Text>
          <Pressable
            style={[
              styles.deleteButton,
              deleteAccountMutation.isPending && styles.buttonDisabled,
            ]}
            onPress={confirmAccountDeletion}
            disabled={deleteAccountMutation.isPending}
          >
            {deleteAccountMutation.isPending ? (
              <ActivityIndicator color="#b91c1c" />
            ) : (
              <Text style={styles.deleteButtonText}>Delete account</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
      <OrganizationSelectModal
        visible={organizationPickerOpen}
        memberships={memberships}
        activeOrgSlug={activeOrgSlug}
        onClose={() => setOrganizationPickerOpen(false)}
        onSelect={(membership) => void switchOrganization(membership)}
      />
    </KeyboardAvoidingView>
  );
}

function OrganizationSelectModal({
  visible,
  memberships,
  activeOrgSlug,
  onClose,
  onSelect,
}: {
  visible: boolean;
  memberships: AppUserOrganizationContext[];
  activeOrgSlug: string | null;
  onClose: () => void;
  onSelect: (membership: AppUserOrganizationContext) => void;
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
          accessibilityLabel="Close organization list"
          onPress={onClose}
        />
        <View style={styles.organizationModal}>
          <View style={styles.modalHeader}>
            <View style={styles.organizationText}>
              <Text style={styles.modalTitle}>Select organization</Text>
              <Text style={styles.modalDescription}>
                Choose the organization you want to use
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close organization list"
              onPress={onClose}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseLabel}>×</Text>
            </Pressable>
          </View>
          <FlatList
            data={organizationOptions(memberships, activeOrgSlug)}
            keyExtractor={({ membership }) => membership.organizationId}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item: { membership, selected } }) => {
              return (
                <Pressable
                  testID={`mobile.profile.organization-option.${membership.organizationSlug}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${membership.organizationName}, ${membership.role}${membership.houseName ? `, ${membership.houseName}` : ""}`}
                  accessibilityState={{ selected }}
                  style={[styles.organizationRow, selected && styles.selectedRow]}
                  onPress={() => onSelect(membership)}
                >
                  <View style={styles.organizationText}>
                    <Text style={styles.organizationName}>
                      {membership.organizationName}
                    </Text>
                    <Text style={styles.organizationMeta}>
                      {membership.role}
                      {membership.houseName ? ` · ${membership.houseName}` : ""}
                    </Text>
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 24, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  organizationValueRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  organizationText: { flex: 1 },
  caret: { fontSize: 20, color: "#64748b", marginLeft: 12 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  linkAction: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  value: { fontSize: 16, color: "#0f172a", fontWeight: "600" },
  meta: { fontSize: 13, color: "#64748b", marginTop: 4 },
  input: {
    marginTop: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
  },
  counter: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "right",
    marginTop: 4,
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  primaryButton: {
    minWidth: 88,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryLabel: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  secondaryButton: {
    minWidth: 88,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  secondaryLabel: { color: "#0f172a", fontSize: 14, fontWeight: "600" },
  buttonDisabled: { opacity: 0.5 },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  organizationModal: {
    maxHeight: "72%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  modalDescription: { fontSize: 12, color: "#64748b", marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  modalCloseLabel: { fontSize: 24, lineHeight: 26, color: "#334155" },
  organizationRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 18,
    gap: 12,
  },
  selectedRow: { backgroundColor: "#f1f5f9" },
  organizationName: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  organizationMeta: { fontSize: 12, color: "#64748b", marginTop: 3 },
  selectedCheck: { fontSize: 18, fontWeight: "700", color: "#0f172a" },
  separator: { height: 1, backgroundColor: "#e2e8f0" },
  signOut: { alignItems: "center", padding: 12, marginTop: 16 },
  signOutText: { color: "#dc2626", fontSize: 15, fontWeight: "500" },
  dangerZone: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#fecaca",
    paddingTop: 20,
  },
  dangerTitle: { color: "#991b1b", fontSize: 16, fontWeight: "700" },
  dangerDescription: { color: "#64748b", fontSize: 13, marginTop: 6 },
  deleteButton: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dc2626",
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  deleteButtonText: { color: "#b91c1c", fontSize: 14, fontWeight: "700" },
});
