import { useState, useTransition, type FormEvent } from "react";
import {
  Check,
  Copy,
  LinkSimple,
  UserSwitch,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import type {
  CreateInviteResult,
  HouseAssignmentResult,
} from "@/lib/action-results";
import type { AdminHouse, AdminUser } from "./AdminManageTypes";

interface TeamManagementProps {
  users: AdminUser[];
  houses: AdminHouse[];
  unassignedUsers: AdminUser[];
  assignedUsers: AdminUser[];
  unassignedSummary: string;
  onAssignHouse: (formData: FormData) => Promise<HouseAssignmentResult>;
  onCreateInvite: () => Promise<CreateInviteResult>;
}

export function TeamManagement({
  users,
  houses,
  unassignedUsers,
  assignedUsers,
  unassignedSummary,
  onAssignHouse,
  onCreateInvite,
}: TeamManagementProps) {
  const [assignPending, startAssign] = useTransition();
  const [invitePending, startInvite] = useTransition();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const unassignedCount = unassignedUsers.length;

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

      <form
        aria-label="Assign user to house"
        onSubmit={handleAssign}
        className="grid gap-3 rounded-xl border p-5 bg-card"
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
        <select
          name="targetUserId"
          aria-label="Member to assign"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
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
        <p className="text-xs text-muted-foreground">
          {unassignedCount > 0
            ? `${unassignedCount} ${unassignedCount === 1 ? "member needs" : "members need"} a house. They appear first in this list.`
            : "All members currently have a house. Select anyone to move them."}
        </p>
        <select
          name="targetHouseId"
          aria-label="House assignment"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
          required
          defaultValue=""
        >
          <option value="" disabled>Select house...</option>
          {houses.map((house) => (
            <option key={house.id} value={house.id}>{house.name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={assignPending}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {assignPending ? "Assigning..." : "Assign"}
        </button>
      </form>

      <div className="grid gap-3 rounded-xl border p-5 bg-card">
        <h5 className="text-sm font-semibold flex items-center gap-2">
          <LinkSimple size={16} />
          Invite Member
        </h5>
        <p className="text-xs text-muted-foreground">
          Generate a single-use token valid for 72 hours. Share it with the new member.
        </p>
        {inviteToken ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <code className="text-xs font-mono flex-1 truncate">{inviteToken}</code>
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
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {invitePending ? "Generating..." : "Generate invite token"}
          </button>
        )}
      </div>
    </section>
  );
}
