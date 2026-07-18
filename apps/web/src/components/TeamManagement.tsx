"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  Copy,
  House,
  LinkSimple,
  MagnifyingGlass,
  ShieldCheck,
  UserMinus,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { UserRole } from "@housepoints/contracts";
import type {
  CreateInviteResult,
  HouseAssignmentResult,
  MemberDisplayNameResult,
  MemberRemovalResult,
  RoleChangeResult,
} from "@/lib/action-results";
import type { AdminHouse, AdminUser } from "./AdminManageTypes";
import { ManageWorkspace } from "./ManageWorkspace";
import { ManageEmptyState } from "./ManageEmptyState";

type MemberFilter = "all" | "unassigned" | "members" | "admins";

interface TeamManagementProps {
  users: AdminUser[];
  houses: AdminHouse[];
  actorRole: UserRole;
  onAssignHouse: (formData: FormData) => Promise<HouseAssignmentResult>;
  onUpdateMemberDisplayName: (formData: FormData) => Promise<MemberDisplayNameResult>;
  onPromoteUser: (formData: FormData) => Promise<RoleChangeResult>;
  onRemoveOrgMember: (formData: FormData) => Promise<MemberRemovalResult>;
  onCreateInvite: () => Promise<CreateInviteResult>;
}

const FILTERS: Array<{ id: MemberFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unassigned", label: "Unassigned" },
  { id: "members", label: "Members" },
  { id: "admins", label: "Admins" },
];

function formatInviteUrl(joinPath: string): string {
  if (typeof window === "undefined") return joinPath;

  try {
    return new URL(joinPath, window.location.origin).toString();
  } catch {
    return joinPath;
  }
}

export function TeamManagement({
  users,
  houses,
  actorRole,
  onAssignHouse,
  onUpdateMemberDisplayName,
  onPromoteUser,
  onRemoveOrgMember,
  onCreateInvite,
}: TeamManagementProps) {
  const searchParams = useSearchParams();
  const requestedFilter =
    searchParams.get("memberStatus") === "unassigned" ? "unassigned" : "all";
  const [filter, setFilter] = useState<MemberFilter>(requestedFilter);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteJoinPath, setInviteJoinPath] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRole, setPendingRole] = useState<"ADMIN" | "MEMBER" | null>(null);
  const [removalPending, setRemovalPending] = useState(false);
  const [assignPending, startAssign] = useTransition();
  const [displayNamePending, startDisplayNameUpdate] = useTransition();
  const [rolePending, startRoleChange] = useTransition();
  const [invitePending, startInvite] = useTransition();
  const isOwner = actorRole === "OWNER";
  const selectedUser = users.find(({ id }) => id === selectedUserId) ?? null;
  const inviteUrl = inviteJoinPath ? formatInviteUrl(inviteJoinPath) : null;
  const houseById = new Map(houses.map((house) => [house.id, house]));
  const unassignedCount = users.filter((user) => !user.houseId).length;

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.displayName.toLocaleLowerCase().includes(normalizedSearch);
      const matchesFilter =
        filter === "all" ||
        (filter === "unassigned" && !user.houseId) ||
        (filter === "members" && user.role === "MEMBER") ||
        (filter === "admins" && (user.role === "ADMIN" || user.role === "OWNER"));

      return matchesSearch && matchesFilter;
    });
  }, [filter, search, users]);

  function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;
    const formData = new FormData(event.currentTarget);
    const houseName =
      houses.find((house) => house.id === formData.get("targetHouseId"))?.name ??
      "the selected house";

    startAssign(async () => {
      try {
        const result = await onAssignHouse(formData);
        if (!result.ok) {
          toast.error("Failed to assign house", { description: result.message });
          return;
        }
        toast.success("House assigned", {
          description: `${selectedUser.displayName} -> ${houseName}`,
        });
      } catch (error) {
        toast.error("Failed to assign house", {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  function handleDisplayNameUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;
    const formData = new FormData(event.currentTarget);
    const displayName = String(formData.get("displayName") ?? "").trim();

    startDisplayNameUpdate(async () => {
      try {
        const result = await onUpdateMemberDisplayName(formData);
        if (!result.ok) {
          toast.error("Failed to update display name", { description: result.message });
          return;
        }
        toast.success("Display name updated", {
          description: `${selectedUser.displayName} -> ${displayName}`,
        });
      } catch (error) {
        toast.error("Failed to update display name", {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  function confirmRoleChange() {
    if (!selectedUser || !pendingRole || !isOwner) return;
    const nextRole = pendingRole;
    const formData = new FormData();
    formData.set("targetUserId", selectedUser.id);
    formData.set("role", nextRole);
    setPendingRole(null);

    startRoleChange(async () => {
      try {
        const result = await onPromoteUser(formData);
        if (!result.ok) {
          toast.error("Failed to update role", { description: result.message });
          return;
        }
        if (nextRole === "ADMIN") {
          toast.success("Member promoted", {
            description: `${selectedUser.displayName} is now an admin.`,
          });
        } else {
          toast.success("Admin access removed", {
            description: `${selectedUser.displayName} is now a member.`,
          });
        }
      } catch (error) {
        toast.error("Failed to update role", {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  async function confirmRemoval() {
    if (!selectedUser || !isOwner) return;
    const removedUser = selectedUser;
    const formData = new FormData();
    formData.set("targetUserId", removedUser.id);
    setRemovalPending(true);

    try {
      const result = await onRemoveOrgMember(formData);
      if (!result.ok) {
        toast.error("Failed to remove member", { description: result.message });
        return;
      }
      toast.success("Member removed", {
        description: `${removedUser.displayName} no longer has access to this organization.`,
      });
      setSelectedUserId(null);
    } catch (error) {
      toast.error("Failed to remove member", {
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setRemovalPending(false);
    }
  }

  function handleInvite() {
    startInvite(async () => {
      try {
        const result = await onCreateInvite();
        if (!result.ok) {
          toast.error("Failed to generate invite", { description: result.message });
          return;
        }
        setInviteJoinPath(result.joinPath);
        setInviteExpiry(result.expiresAt);
        setCopied(false);
      } catch (error) {
        toast.error("Failed to generate invite", {
          description: error instanceof Error ? error.message : "Something went wrong",
        });
      }
    });
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleInviteOpenChange(open: boolean) {
    setInviteOpen(open);
    if (!open) {
      setInviteJoinPath(null);
      setInviteExpiry(null);
      setCopied(false);
    }
  }

  return (
    <ManageWorkspace
      id="members"
      title="Members"
      description="Find a member, then manage their house, profile, role, or access."
      count={users.length}
      className="space-y-5"
      action={
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <LinkSimple size={16} />
          Invite member
        </button>
      }
    >

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" aria-label="Member filters">
          {FILTERS.map((option) => {
            const count =
              option.id === "all"
                ? users.length
                : option.id === "unassigned"
                  ? unassignedCount
                  : option.id === "members"
                    ? users.filter((user) => user.role === "MEMBER").length
                    : users.filter((user) => user.role !== "MEMBER").length;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  filter === option.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {option.label} {count}
              </button>
            );
          })}
        </div>
        <label className="relative block sm:w-64">
          <MagnifyingGlass
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <span className="sr-only">Search members</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members"
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
      </div>

      {filteredUsers.length > 0 ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_8rem_2rem] gap-4 border-b bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
            <span>Member</span>
            <span>House</span>
            <span>Role</span>
            <span className="sr-only">Open</span>
          </div>
          <div className="divide-y">
            {filteredUsers.map((user) => {
              const house = user.houseId ? houseById.get(user.houseId) : null;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => {
                    setPendingRole(null);
                    setSelectedUserId(user.id);
                  }}
                  className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_8rem_2rem] sm:items-center sm:gap-4"
                  aria-label={`Manage ${user.displayName}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm">
                    {house ? (
                      <>
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: house.color }}
                          aria-hidden="true"
                        />
                        {house.name}
                      </>
                    ) : (
                      <span className="font-medium text-amber-700">Needs assignment</span>
                    )}
                  </span>
                  <span className="w-fit rounded-full border px-2 py-0.5 text-xs font-semibold capitalize text-muted-foreground">
                    {user.role.toLowerCase()}
                  </span>
                  <span className="hidden text-right text-muted-foreground sm:block" aria-hidden="true">
                    ›
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <ManageEmptyState
          title="No members match this view"
          description="Try another filter or clear the search."
          icon={<UsersThree size={28} />}
        />
      )}

      <Dialog.Root
        open={Boolean(selectedUser)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingRole(null);
            setSelectedUserId(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-lg overflow-y-auto border-l bg-card p-6 shadow-2xl">
            {selectedUser ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Dialog.Title className="font-display text-2xl font-semibold">
                      {selectedUser.displayName}
                    </Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                      {selectedUser.email}
                    </Dialog.Description>
                  </div>
                  <Dialog.Close asChild>
                    <button type="button" className="rounded-lg p-2 hover:bg-muted" aria-label="Close member details">
                      <X size={18} />
                    </button>
                  </Dialog.Close>
                </div>

                <div className="mt-6 space-y-6">
                  <form
                    aria-label="Update member display name"
                    onSubmit={handleDisplayNameUpdate}
                    className="space-y-3 border-b pb-6"
                  >
                    <div>
                      <h5 className="flex items-center gap-2 text-sm font-semibold">
                        <UsersThree size={16} />
                        Profile
                      </h5>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Display-name changes are recorded in the audit trail.
                      </p>
                    </div>
                    <input type="hidden" name="targetUserId" value={selectedUser.id} />
                    <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                      Display name
                      <input
                        name="displayName"
                        aria-label="New display name"
                        defaultValue={selectedUser.displayName}
                        maxLength={120}
                        required
                        className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={displayNamePending}
                      className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {displayNamePending ? "Saving..." : "Save display name"}
                    </button>
                  </form>

                  <form
                    aria-label="Assign user to house"
                    onSubmit={handleAssign}
                    className="space-y-3 border-b pb-6"
                  >
                    <div>
                      <h5 className="flex items-center gap-2 text-sm font-semibold">
                        <House size={16} />
                        House assignment
                      </h5>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Assign this member or move them to another house.
                      </p>
                    </div>
                    <input type="hidden" name="targetUserId" value={selectedUser.id} />
                    <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                      House
                      <select
                        name="targetHouseId"
                        aria-label="House assignment"
                        defaultValue={selectedUser.houseId ?? ""}
                        required
                        className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="" disabled>Select house...</option>
                        {houses.map((house) => (
                          <option key={house.id} value={house.id}>{house.name}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={assignPending || houses.length === 0}
                      className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {assignPending ? "Saving..." : "Save house"}
                    </button>
                  </form>

                  <section aria-label="Role management" className="space-y-3 border-b pb-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="flex items-center gap-2 text-sm font-semibold">
                          <ShieldCheck size={16} />
                          Organization role
                        </h5>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Admins manage member and point workflows. Owners manage organization settings.
                        </p>
                      </div>
                      {!isOwner ? (
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          Owner only
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                      <span className="text-sm capitalize">{selectedUser.role.toLowerCase()}</span>
                      {selectedUser.role === "OWNER" ? (
                        <span className="text-xs text-muted-foreground">Managed in Organization</span>
                      ) : (
                        <button
                          type="button"
                          disabled={!isOwner || rolePending}
                          onClick={() =>
                            setPendingRole(selectedUser.role === "ADMIN" ? "MEMBER" : "ADMIN")
                          }
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {selectedUser.role === "ADMIN" ? "Remove admin access" : "Promote to admin"}
                        </button>
                      )}
                    </div>
                    {pendingRole ? (
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <p className="text-sm font-semibold">
                          {pendingRole === "ADMIN"
                            ? `Promote ${selectedUser.displayName} to admin?`
                            : `Remove admin access for ${selectedUser.displayName}?`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pendingRole === "ADMIN"
                            ? "They will be able to invite members, assign houses, award points, and delete point awards."
                            : "They will keep their member profile and house assignment."}
                        </p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={confirmRoleChange}
                            className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"
                          >
                            Confirm role change
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingRole(null)}
                            className="h-8 rounded-lg border px-3 text-xs font-semibold"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </section>

                  <section aria-label="Member removal" className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                          <UserMinus size={16} />
                          Remove from organization
                        </h5>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Historical point records remain after access is removed.
                        </p>
                      </div>
                      {!isOwner ? (
                        <span className="shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          Owner only
                        </span>
                      ) : null}
                    </div>
                    {selectedUser.role === "OWNER" ? (
                      <p className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                        Transfer ownership before removing this member.
                      </p>
                    ) : (
                      <Dialog.Root>
                        <Dialog.Trigger asChild>
                          <button
                            type="button"
                            disabled={!isOwner || removalPending}
                            className="h-9 rounded-lg border border-destructive/30 px-3 text-sm font-semibold text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remove member
                          </button>
                        </Dialog.Trigger>
                        <Dialog.Portal>
                          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/50" />
                          <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card p-6 shadow-2xl">
                            <Dialog.Title className="font-display text-xl font-semibold">
                              Remove {selectedUser.displayName}?
                            </Dialog.Title>
                            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                              Their account keeps its history, but they lose organization access until invited again.
                            </Dialog.Description>
                            <div className="mt-5 flex justify-end gap-2">
                              <Dialog.Close asChild>
                                <button type="button" className="h-9 rounded-lg border px-3 text-sm font-semibold">
                                  Cancel
                                </button>
                              </Dialog.Close>
                              <button
                                type="button"
                                onClick={confirmRemoval}
                                disabled={removalPending}
                                className="h-9 rounded-lg bg-destructive px-3 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                              >
                                {removalPending ? "Removing..." : "Confirm removal"}
                              </button>
                            </div>
                          </Dialog.Content>
                        </Dialog.Portal>
                      </Dialog.Root>
                    )}
                  </section>
                </div>
              </>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={inviteOpen} onOpenChange={handleInviteOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
          <Dialog.Content
            aria-label="Invite member"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-xl font-semibold">Invite member</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Generate a single-use invite link valid for 72 hours.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button type="button" className="rounded-lg p-2 hover:bg-muted" aria-label="Close invite">
                  <X size={18} />
                </button>
              </Dialog.Close>
            </div>
            {inviteUrl ? (
              <div className="mt-5 min-w-0 space-y-3 overflow-hidden">
                <div className="flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border bg-muted/50 px-3 py-2.5">
                  <code className="min-w-0 flex-1 truncate font-mono text-xs" title={inviteUrl}>
                    {inviteUrl}
                  </code>
                  <button type="button" onClick={handleCopy} title="Copy invite link" className="shrink-0">
                    {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(inviteExpiry!).toLocaleString()}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInviteJoinPath(null);
                    setInviteExpiry(null);
                  }}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Generate another
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={invitePending}
                  className="h-10 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {invitePending ? "Generating..." : "Generate invite link"}
                </button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ManageWorkspace>
  );
}
