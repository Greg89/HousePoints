import type {
  AdminContext,
  AdminUser,
  InviteLink,
} from "@housepoints/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppAuth } from "@/context/auth-provider";
import { useActiveOrg } from "@/context/org-provider";
import { useToast } from "@/context/toast-provider";
import { ApiResponseError, callApi } from "@/lib/api-client";
import { env } from "@/lib/env";
import {
  buildInviteShareMessage,
  buildInviteUrl,
  formatInviteExpiration,
} from "@/lib/invite-sharing";
import { logger, serializeError } from "@/lib/logger";
import {
  canManageMemberRole,
  canRemoveMember,
  filterAdminUsers,
} from "@/lib/member-management";
import { buildWebAdminUrl, canAccessMobileAdmin } from "@/lib/mobile-admin";

const OUT_OF_SCOPE_FLOWS = [
  "Season creation and transitions",
  "Organization archive and restore",
  "Audit and comparison reports",
  "Release announcements",
] as const;
const INVITE_DURATIONS = [
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
] as const;

export default function AdminScreen() {
  const { getAccessToken } = useAppAuth();
  const { activeOrgSlug, activeMembership } = useActiveOrg();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteDuration, setInviteDuration] = useState(72);
  const [invite, setInvite] = useState<InviteLink | null>(null);
  const [sharingInvite, setSharingInvite] = useState(false);
  const [openingWeb, setOpeningWeb] = useState(false);
  const allowed = canAccessMobileAdmin(
    env.mobileAdminEnabled,
    activeMembership?.role,
  );
  const actorRole =
    activeMembership?.role === "OWNER" ? "OWNER" : "ADMIN";
  const queryKey = ["admin-context", activeOrgSlug] as const;

  const contextQuery = useQuery({
    queryKey,
    enabled: allowed && activeOrgSlug !== null,
    queryFn: async ({ signal }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/admin/context",
        {},
        { accessToken, organizationSlug: activeOrgSlug, signal },
      );
    },
  });
  const adminContext: AdminContext | undefined = contextQuery.data;
  const users = useMemo(
    () => filterAdminUsers(adminContext?.users ?? [], search),
    [adminContext?.users, search],
  );

  const assignHouse = useMutation({
    mutationFn: async ({
      targetUserId,
      targetHouseId,
    }: {
      targetUserId: string;
      targetHouseId: string;
    }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/admin/users/assign-house",
        { targetUserId, targetHouseId },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: (updated) => {
      updateUser(queryClient, queryKey, updated.id, {
        houseId: updated.houseId,
      });
      showToast({ message: "House assignment updated", variant: "success" });
      logger.info("mobile.admin.member_house_assigned", {
        targetUserId: updated.id,
        targetHouseId: updated.houseId,
      });
    },
    onError: (error) => showMutationError(error, showToast),
  });

  const changeRole = useMutation({
    mutationFn: async ({
      targetUserId,
      role,
    }: {
      targetUserId: string;
      role: "MEMBER" | "ADMIN";
    }) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/admin/users/role",
        { targetUserId, role },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: (updated) => {
      updateUser(queryClient, queryKey, updated.id, { role: updated.role });
      showToast({ message: "Member role updated", variant: "success" });
      logger.info("mobile.admin.member_role_changed", {
        targetUserId: updated.id,
        role: updated.role,
      });
    },
    onError: (error) => showMutationError(error, showToast),
  });

  const removeMember = useMutation({
    mutationFn: async (targetUserId: string) => {
      const accessToken = await getAccessToken();
      return callApi(
        "/admin/users/remove",
        { targetUserId },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: (removed) => {
      queryClient.setQueryData<AdminContext>(
        queryKey,
        (current: AdminContext | undefined) =>
        current
          ? {
              ...current,
              users: current.users.filter(
                (user: AdminUser) => user.id !== removed.id,
              ),
            }
          : current,
      );
      showToast({ message: `${removed.displayName} removed`, variant: "success" });
      logger.info("mobile.admin.member_removed", { targetUserId: removed.id });
    },
    onError: (error) => showMutationError(error, showToast),
  });

  const createInvite = useMutation({
    mutationFn: async () => {
      const accessToken = await getAccessToken();
      return callApi(
        "/orgs/invite",
        { expiresInHours: inviteDuration },
        { accessToken, organizationSlug: activeOrgSlug },
      );
    },
    onSuccess: (created) => {
      setInvite(created);
      showToast({ message: "Invite created", variant: "success" });
      logger.info("mobile.admin.invite_created", {
        inviteId: created.id,
        expiresAt: created.expiresAt,
      });
    },
    onError: (error) => showMutationError(error, showToast),
  });

  if (!allowed || !activeOrgSlug) {
    return <Redirect href="/(tabs)" />;
  }

  const openWebDashboard = async () => {
    setOpeningWeb(true);
    try {
      await Linking.openURL(buildWebAdminUrl(env.webBaseUrl, activeOrgSlug));
      logger.info("mobile.admin.web_handoff_opened", {
        organizationSlug: activeOrgSlug,
      });
    } catch (error) {
      logger.warn("mobile.admin.web_handoff_failed", serializeError(error));
      showToast({
        message: "Unable to open the web dashboard.",
        variant: "error",
      });
    } finally {
      setOpeningWeb(false);
    }
  };

  const confirmRoleChange = (user: AdminUser) => {
    const role = user.role === "ADMIN" ? "MEMBER" : "ADMIN";
    Alert.alert(
      role === "ADMIN" ? "Promote to admin?" : "Remove admin access?",
      `${user.displayName} will become ${role.toLowerCase()}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => changeRole.mutate({ targetUserId: user.id, role }),
        },
      ],
    );
  };

  const confirmRemoval = (user: AdminUser) => {
    Alert.alert(
      "Remove member?",
      `${user.displayName} will lose access to this organization.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMember.mutate(user.id),
        },
      ],
    );
  };

  const shareInvite = async () => {
    if (!invite) {
      return;
    }

    const inviteUrl = buildInviteUrl(env.webBaseUrl, invite.joinPath);
    setSharingInvite(true);
    try {
      const result = await Share.share({
        title: `Invite to ${activeMembership?.organizationName}`,
        message: buildInviteShareMessage(
          activeMembership?.organizationName ?? "this organization",
          inviteUrl,
        ),
      });
      logger.info("mobile.admin.invite_share_completed", {
        inviteId: invite.id,
        action: result.action,
      });
    } catch (error) {
      logger.warn("mobile.admin.invite_share_failed", serializeError(error));
      showToast({
        message: "Unable to open the share sheet.",
        variant: "error",
      });
    } finally {
      setSharingInvite(false);
    }
  };

  const mutationPending =
    assignHouse.isPending || changeRole.isPending || removeMember.isPending;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={contextQuery.isRefetching}
          onRefresh={() => void contextQuery.refetch()}
        />
      }
    >
      <View>
        <Text style={styles.title}>Administration</Text>
        <Text style={styles.subtitle}>
          Manage {activeMembership?.organizationName} from your phone.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Invite a member</Text>
        <Text style={styles.body}>
          Create a single-use link for this organization.
        </Text>
        <Text style={styles.controlLabel}>Link expires in</Text>
        <View style={styles.chips}>
          {INVITE_DURATIONS.map((duration) => {
            const selected = duration.hours === inviteDuration;
            return (
              <Pressable
                key={duration.hours}
                style={[styles.chip, selected && styles.chipSelected]}
                disabled={createInvite.isPending}
                onPress={() => setInviteDuration(duration.hours)}
              >
                <Text
                  style={[
                    styles.chipText,
                    selected && styles.chipTextSelected,
                  ]}
                >
                  {duration.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          style={[
            styles.button,
            createInvite.isPending && styles.buttonDisabled,
          ]}
          disabled={createInvite.isPending}
          onPress={() => createInvite.mutate()}
        >
          {createInvite.isPending ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>
              {invite ? "Create another invite" : "Create invite"}
            </Text>
          )}
        </Pressable>
        {invite ? (
          <View style={styles.inviteResult}>
            <Text style={styles.inviteReady}>Invite ready</Text>
            <Text style={styles.inviteExpiry}>
              Expires {formatInviteExpiration(invite.expiresAt)}
            </Text>
            <Text style={styles.inviteWarning}>
              This link can be used once. Creating another link does not revoke
              this one.
            </Text>
            <Pressable
              style={[
                styles.shareButton,
                sharingInvite && styles.buttonDisabled,
              ]}
              disabled={sharingInvite}
              onPress={() => void shareInvite()}
            >
              {sharingInvite ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <Text style={styles.shareButtonText}>Share invite</Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>

      {env.pointAdjustmentsEnabled ? (
        <View style={styles.deductionCard}>
          <Text style={styles.cardTitle}>Point deduction</Text>
          <Text style={styles.body}>
            Deduct 10 points from a member in another house. Cooldowns and
            eligibility are verified by the server.
          </Text>
          <Pressable
            style={styles.deductionButton}
            onPress={() => router.push("/deduct")}
          >
            <Text style={styles.deductionButtonText}>Deduct points</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Members</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email"
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {contextQuery.isPending ? (
          <ActivityIndicator style={styles.loading} color="#0f172a" />
        ) : contextQuery.isError ? (
          <Pressable onPress={() => void contextQuery.refetch()}>
            <Text style={styles.errorText}>
              Unable to load members. Tap to retry.
            </Text>
          </Pressable>
        ) : users.length === 0 ? (
          <Text style={styles.emptyText}>No members match that search.</Text>
        ) : (
          users.map((user) => (
            <View key={user.id} style={styles.member}>
              <View style={styles.memberHeader}>
                <View style={styles.memberIdentity}>
                  <Text style={styles.memberName}>{user.displayName}</Text>
                  {user.email ? (
                    <Text style={styles.memberEmail}>{user.email}</Text>
                  ) : null}
                </View>
                <Text style={styles.roleBadge}>{formatRole(user.role)}</Text>
              </View>

              <Text style={styles.controlLabel}>House</Text>
              <View style={styles.chips}>
                {adminContext?.houses.map((house) => {
                  const selected = house.id === user.houseId;
                  return (
                    <Pressable
                      key={house.id}
                      style={[styles.chip, selected && styles.chipSelected]}
                      disabled={selected || mutationPending}
                      onPress={() =>
                        assignHouse.mutate({
                          targetUserId: user.id,
                          targetHouseId: house.id,
                        })
                      }
                    >
                      <View
                        style={[styles.houseDot, { backgroundColor: house.color }]}
                      />
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.chipTextSelected,
                        ]}
                      >
                        {house.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {canManageMemberRole(actorRole, user.role) ? (
                <Pressable
                  style={styles.secondaryButton}
                  disabled={mutationPending}
                  onPress={() => confirmRoleChange(user)}
                >
                  <Text style={styles.secondaryButtonText}>
                    {user.role === "ADMIN"
                      ? "Remove admin access"
                      : "Promote to admin"}
                  </Text>
                </Pressable>
              ) : null}
              {canRemoveMember(actorRole, user.role) ? (
                <Pressable
                  style={styles.removeButton}
                  disabled={mutationPending}
                  onPress={() => confirmRemoval(user)}
                >
                  <Text style={styles.removeButtonText}>Remove member</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Open the full web dashboard</Text>
        <Text style={styles.body}>
          These organization-level workflows remain on the web:
        </Text>
        {OUT_OF_SCOPE_FLOWS.map((flow) => (
          <Text key={flow} style={styles.listItem}>{"\u2022"} {flow}</Text>
        ))}
        <Pressable
          style={[styles.button, openingWeb && styles.buttonDisabled]}
          onPress={() => void openWebDashboard()}
          disabled={openingWeb}
        >
          {openingWeb ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Open web dashboard</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function updateUser(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: readonly unknown[],
  userId: string,
  patch: Partial<AdminUser>,
) {
  queryClient.setQueryData<AdminContext>(
    queryKey,
    (current: AdminContext | undefined) =>
    current
      ? {
          ...current,
          users: current.users.map((user: AdminUser) =>
            user.id === userId ? { ...user, ...patch } : user,
          ),
        }
      : current,
  );
}

function showMutationError(
  error: unknown,
  showToast: ReturnType<typeof useToast>["showToast"],
) {
  const message =
    error instanceof ApiResponseError
      ? error.message
      : "Unable to update this member. Please try again.";
  showToast({ message, variant: "error" });
  logger.warn("mobile.admin.member_update_failed", serializeError(error));
}

function formatRole(role: AdminUser["role"]) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a" },
  subtitle: { marginTop: 4, fontSize: 14, color: "#64748b" },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  deductionCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  deductionButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#b91c1c",
  },
  deductionButtonText: { color: "#ffffff", fontWeight: "700" },
  body: { color: "#475569", fontSize: 14, lineHeight: 20 },
  listItem: { color: "#475569", fontSize: 14, paddingLeft: 4 },
  inviteResult: {
    marginTop: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 5,
  },
  inviteReady: { color: "#166534", fontSize: 15, fontWeight: "700" },
  inviteExpiry: { color: "#166534", fontSize: 13 },
  inviteWarning: { color: "#475569", fontSize: 12, lineHeight: 17 },
  shareButton: {
    marginTop: 5,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#86efac",
  },
  shareButtonText: { color: "#0f172a", fontWeight: "700" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
    fontSize: 15,
  },
  loading: { padding: 24 },
  errorText: { color: "#b91c1c", paddingVertical: 16, textAlign: "center" },
  emptyText: { color: "#64748b", paddingVertical: 16, textAlign: "center" },
  member: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 14,
    gap: 10,
  },
  memberHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  memberIdentity: { flex: 1 },
  memberName: { color: "#0f172a", fontSize: 16, fontWeight: "600" },
  memberEmail: { color: "#64748b", fontSize: 12, marginTop: 2 },
  roleBadge: {
    color: "#475569",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "600",
  },
  controlLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipSelected: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  chipText: { color: "#334155", fontSize: 12, fontWeight: "500" },
  chipTextSelected: { color: "#ffffff" },
  houseDot: { width: 8, height: 8, borderRadius: 4 },
  secondaryButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 9,
  },
  secondaryButtonText: { color: "#334155", fontWeight: "600" },
  removeButton: { alignItems: "center", paddingVertical: 6 },
  removeButtonText: { color: "#b91c1c", fontWeight: "600" },
  button: {
    marginTop: 8,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#0f172a",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontWeight: "700" },
});
