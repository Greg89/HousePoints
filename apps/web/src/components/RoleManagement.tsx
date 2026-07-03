"use client";

import { useState, useTransition, type FormEvent } from "react";
import { ShieldCheck } from "@phosphor-icons/react";
import { toast } from "sonner";
import type { UserRole } from "@housepoints/contracts";
import type { RoleChangeResult } from "@/lib/action-results";
import type { AdminUser } from "./AdminManageTypes";

interface RoleManagementProps {
  users: AdminUser[];
  actorRole: UserRole;
  onPromoteUser: (formData: FormData) => Promise<RoleChangeResult>;
}

export function RoleManagement({ users, actorRole, onPromoteUser }: RoleManagementProps) {
  const [rolePending, startRoleChange] = useTransition();
  const [pendingPromoteId, setPendingPromoteId] = useState<string | null>(null);
  const [pendingDemoteId, setPendingDemoteId] = useState<string | null>(null);

  const isOwner = actorRole === "OWNER";
  const promotionCandidates = users.filter((user) => user.role === "MEMBER");
  const demotionCandidates = users.filter((user) => user.role === "ADMIN");
  const pendingPromoteName = pendingPromoteId
    ? (users.find((u) => u.id === pendingPromoteId)?.displayName ?? "this member")
    : null;
  const pendingDemoteName = pendingDemoteId
    ? (users.find((u) => u.id === pendingDemoteId)?.displayName ?? "this admin")
    : null;

  function handlePromote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isOwner) return;
    const formData = new FormData(e.currentTarget);
    const targetUserId = String(formData.get("targetUserId") ?? "");
    if (!targetUserId) return;
    setPendingPromoteId(targetUserId);
  }

  function confirmPromote() {
    if (!pendingPromoteId) return;
    const userId = pendingPromoteId;
    const userName = users.find((u) => u.id === userId)?.displayName ?? "this member";
    setPendingPromoteId(null);
    const formData = new FormData();
    formData.set("targetUserId", userId);
    formData.set("role", "ADMIN");
    startRoleChange(async () => {
      try {
        const result = await onPromoteUser(formData);
        if (!result.ok) {
          toast.error("Failed to update role", { description: result.message });
          return;
        }
        toast.success("Member promoted", { description: `${userName} is now an admin.` });
      } catch (err) {
        toast.error("Failed to update role", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleDemote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isOwner) return;
    const formData = new FormData(e.currentTarget);
    const targetUserId = String(formData.get("targetUserId") ?? "");
    if (!targetUserId) return;
    setPendingDemoteId(targetUserId);
  }

  function confirmDemote() {
    if (!pendingDemoteId) return;
    const userId = pendingDemoteId;
    const userName = users.find((u) => u.id === userId)?.displayName ?? "this admin";
    setPendingDemoteId(null);
    const formData = new FormData();
    formData.set("targetUserId", userId);
    formData.set("role", "MEMBER");
    startRoleChange(async () => {
      try {
        const result = await onPromoteUser(formData);
        if (!result.ok) {
          toast.error("Failed to update role", { description: result.message });
          return;
        }
        toast.success("Admin access removed", { description: `${userName} is now a member.` });
      } catch (err) {
        toast.error("Failed to update role", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  return (
    <section className="space-y-6">
      <div>
        <h4 className="font-display text-lg font-semibold">Role Management</h4>
        <p className="text-sm text-muted-foreground">
          Promote trusted members to admin or remove admin access when responsibilities change.
        </p>
      </div>

      <section
        aria-label="Role management"
        className="grid min-w-0 content-start gap-4 rounded-xl border bg-card p-5"
      >
        <div>
          <h5 className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} />
              Role Management
            </span>
            {!isOwner ? (
              <span className="rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Owner only
              </span>
            ) : null}
          </h5>
          <p className="mt-2 text-xs text-muted-foreground">
            Admins can manage member and points workflows. Owners keep org-level configuration.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* Promote column */}
          <div className="space-y-3">
            <form aria-label="Promote member" onSubmit={handlePromote} className="grid gap-3">
              <input type="hidden" name="role" value="ADMIN" />
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Member
                <select
                  name="targetUserId"
                  aria-label="Member to promote"
                  className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none disabled:opacity-60"
                  required
                  defaultValue=""
                  disabled={!isOwner || promotionCandidates.length === 0}
                >
                  <option value="" disabled>
                    {promotionCandidates.length > 0 ? "Select member..." : "No members eligible"}
                  </option>
                  {promotionCandidates.map((user) => (
                    <option key={user.id} value={user.id}>{user.displayName}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={!isOwner || rolePending || promotionCandidates.length === 0}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {rolePending ? "Updating..." : "Promote to admin"}
              </button>
            </form>
            {pendingPromoteName ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <p className="text-sm font-semibold">Promote {pendingPromoteName} to admin?</p>
                <p className="text-xs text-muted-foreground">
                  They will be able to invite members, assign houses, award points, and delete point awards.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={confirmPromote}
                    disabled={rolePending}
                    className="h-8 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingPromoteId(null)}
                    className="h-8 rounded-lg border px-3 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Demote column */}
          <div className="space-y-3">
            <form aria-label="Remove admin access" onSubmit={handleDemote} className="grid gap-3">
              <input type="hidden" name="role" value="MEMBER" />
              <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
                Admin
                <select
                  name="targetUserId"
                  aria-label="Admin to demote"
                  className="h-10 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none disabled:opacity-60"
                  required
                  defaultValue=""
                  disabled={!isOwner || demotionCandidates.length === 0}
                >
                  <option value="" disabled>
                    {demotionCandidates.length > 0 ? "Select admin..." : "No admins eligible"}
                  </option>
                  {demotionCandidates.map((user) => (
                    <option key={user.id} value={user.id}>{user.displayName}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={!isOwner || rolePending || demotionCandidates.length === 0}
                className="h-10 rounded-lg border px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
              >
                {rolePending ? "Updating..." : "Remove admin access"}
              </button>
            </form>
            {pendingDemoteName ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                <p className="text-sm font-semibold text-destructive">
                  Remove admin access for {pendingDemoteName}?
                </p>
                <p className="text-xs text-muted-foreground">
                  They will keep their member profile and house assignment.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={confirmDemote}
                    disabled={rolePending}
                    className="h-8 rounded-lg bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDemoteId(null)}
                    className="h-8 rounded-lg border px-3 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </section>
  );
}
