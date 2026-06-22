import { useState, useTransition, type FormEvent } from "react";
import {
  Check,
  Copy,
  LinkSimple,
  ShieldCheck,
  UserSwitch,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type { AdminAuditAction, UserRole } from "@housepoints/contracts";
import type {
  CreateInviteResult,
  HouseAssignmentResult,
  RoleChangeResult,
} from "@/lib/action-results";
import type { AdminHouse, AdminUser } from "./AdminManageTypes";

interface TeamManagementProps {
  users: AdminUser[];
  houses: AdminHouse[];
  unassignedUsers: AdminUser[];
  assignedUsers: AdminUser[];
  unassignedSummary: string;
  recentAdminActions: AdminAuditAction[];
  actorRole: UserRole;
  onAssignHouse: (formData: FormData) => Promise<HouseAssignmentResult>;
  onPromoteUser: (formData: FormData) => Promise<RoleChangeResult>;
  onCreateInvite: () => Promise<CreateInviteResult>;
}

export function TeamManagement({
  users,
  houses,
  unassignedUsers,
  assignedUsers,
  unassignedSummary,
  recentAdminActions,
  actorRole,
  onAssignHouse,
  onPromoteUser,
  onCreateInvite,
}: TeamManagementProps) {
  const [assignPending, startAssign] = useTransition();
  const [invitePending, startInvite] = useTransition();
  const [promotePending, startPromote] = useTransition();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const unassignedCount = unassignedUsers.length;
  const inviteActions = recentAdminActions.filter(
    (action) => action.type === "INVITE_CREATED" || action.type === "INVITE_USED",
  );
  const inviteCreatedCount = inviteActions.filter((action) => action.type === "INVITE_CREATED").length;
  const inviteUsedCount = inviteActions.filter((action) => action.type === "INVITE_USED").length;
  const isOwner = actorRole === "OWNER";
  const promotionCandidates = users.filter((user) => user.role === "MEMBER");

  function handleAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const userName = users.find((user) => user.id === formData.get("targetUserId"))?.displayName;
    const houseName = houses.find((house) => house.id === formData.get("targetHouseId"))?.name;
    startAssign(async () => {
      try {
        const result = await onAssignHouse(formData);

        if (!result.ok) {
          toast.error("Failed to assign house", {
            description: result.message,
          });
          return;
        }

        toast.success("House assigned", {
          description: `${userName} -> ${houseName}`,
        });
        form.reset();
      } catch (err) {
        toast.error("Failed to assign house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleInvite() {
    startInvite(async () => {
      try {
        const result = await onCreateInvite();

        if (!result.ok) {
          toast.error("Failed to generate invite", {
            description: result.message,
          });
          return;
        }

        setInviteToken(result.token);
        setInviteExpiry(result.expiresAt);
        setCopied(false);
      } catch (err) {
        toast.error("Failed to generate invite", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handlePromote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isOwner) return;

    const formData = new FormData(e.currentTarget);
    const targetUserId = String(formData.get("targetUserId") ?? "");
    const userName = users.find((user) => user.id === targetUserId)?.displayName ?? "this member";
    const form = e.currentTarget;
    const confirmed = window.confirm(
      `Promote ${userName} to admin? They will be able to invite members, assign houses, award points, and delete point awards.`,
    );

    if (!confirmed) return;

    startPromote(async () => {
      try {
        const result = await onPromoteUser(formData);

        if (!result.ok) {
          toast.error("Failed to update role", {
            description: result.message,
          });
          return;
        }

        toast.success("Member promoted", {
          description: `${userName} is now an admin.`,
        });
        form.reset();
      } catch (err) {
        toast.error("Failed to update role", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  async function handleCopy() {
    if (!inviteToken) return;
    await navigator.clipboard.writeText(inviteToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="space-y-6">
      <div>
        <h4 className="font-display text-lg font-semibold">Team Setup</h4>
        <p className="text-sm text-muted-foreground">
          Bring new members in and place them into the right house.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.8fr)_minmax(18rem,0.8fr)]">
        <form
          aria-label="Assign user to house"
          onSubmit={handleAssign}
          className="grid min-w-0 content-start gap-4 rounded-xl border bg-card p-5"
        >
          <h5 className="flex items-center justify-between gap-3 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <UserSwitch size={16} />
              Assign User to House
            </span>
            {unassignedCount > 0 ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                {unassignedSummary}
              </span>
            ) : null}
          </h5>
          <div className="grid min-w-0 gap-3">
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              Member
              <select
                name="targetUserId"
                aria-label="Member to assign"
                className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  {unassignedCount > 0 ? `Select member... ${unassignedSummary}` : "Select member..."}
                </option>
                {unassignedUsers.length > 0 ? (
                  <optgroup label={`Needs assignment (${unassignedUsers.length})`}>
                    {unassignedUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.displayName} - Needs assignment</option>
                    ))}
                  </optgroup>
                ) : null}
                {assignedUsers.length > 0 ? (
                  <optgroup label="Assigned members">
                    {assignedUsers.map((user) => (
                      <option key={user.id} value={user.id}>{user.displayName}</option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
              House
              <select
                name="targetHouseId"
                aria-label="House assignment"
                className="h-10 w-full min-w-0 rounded-lg border bg-background px-3 text-sm font-normal text-foreground focus:outline-none"
                required
                defaultValue=""
              >
                <option value="" disabled>Select house...</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>{house.name}</option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={assignPending}
              className="h-10 w-full rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {assignPending ? "Assigning..." : "Assign"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {unassignedCount > 0
              ? `${unassignedCount} ${unassignedCount === 1 ? "member needs" : "members need"} a house. They appear first in this list.`
              : "All members currently have a house. Select anyone to move them."}
          </p>
        </form>

        <section aria-label="Invite member" className="grid min-w-0 content-start gap-4 rounded-xl border bg-card p-5">
          <div>
            <h5 className="text-sm font-semibold flex items-center gap-2">
              <LinkSimple size={16} />
              Invite Member
            </h5>
            <p className="mt-2 text-xs text-muted-foreground">
              Generate a single-use token valid for 72 hours. Share it with the new member.
            </p>
          </div>
          {inviteToken ? (
            <div className="space-y-2">
              <div className="flex h-10 min-w-0 max-w-full items-center gap-2 rounded-lg border bg-muted/50 px-3">
                <code className="block min-w-0 flex-1 truncate font-mono text-xs" title={inviteToken}>
                  {inviteToken}
                </code>
                <button
                  onClick={handleCopy}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy token"
                >
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expires: {new Date(inviteExpiry!).toLocaleString()}
              </p>
              <button
                onClick={() => { setInviteToken(null); setInviteExpiry(null); }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Generate another
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInvite}
              disabled={invitePending}
              className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {invitePending ? "Generating..." : "Generate invite token"}
            </button>
          )}
        </section>

        <form
          aria-label="Promote member"
          onSubmit={handlePromote}
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
              Promote trusted members to admin so they can help with team operations.
            </p>
          </div>
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
            disabled={!isOwner || promotePending || promotionCandidates.length === 0}
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {promotePending ? "Promoting..." : "Promote to admin"}
          </button>
          <p className="text-xs text-muted-foreground">
            Admins can manage member and points workflows. Owners keep org-level configuration.
          </p>
        </form>
      </div>

      <section className="rounded-xl border bg-card p-5" aria-label="Invite activity">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h5 className="text-sm font-semibold">Invite activity</h5>
            <p className="mt-1 text-xs text-muted-foreground">
              Recent token generation and use from the admin audit stream.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-56">
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xl font-semibold">{inviteCreatedCount}</p>
              <p className="text-xs text-muted-foreground">Tokens generated</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-xl font-semibold">{inviteUsedCount}</p>
              <p className="text-xs text-muted-foreground">Tokens used</p>
            </div>
          </div>
        </div>
        {inviteActions.length === 0 ? (
          <p className="mt-5 rounded-lg border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
            No invite activity has been recorded yet.
          </p>
        ) : (
          <div className="mt-5 divide-y overflow-hidden rounded-lg border">
            {inviteActions.slice(0, 5).map((action) => (
              <article key={action.id} className="grid gap-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <span className="rounded-full border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                    {action.type === "INVITE_CREATED" ? "Token generated" : "Token used"}
                  </span>
                  <p className="mt-2 text-sm font-semibold">{action.summary}</p>
                  {action.metadata.expiresAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expires {new Date(action.metadata.expiresAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <time dateTime={action.occurredAt} className="text-xs font-medium text-muted-foreground sm:text-right">
                  {new Date(action.occurredAt).toLocaleString()}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
