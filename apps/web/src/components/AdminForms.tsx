"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, UserSwitch, PencilSimple, LinkSimple, Copy, Check } from "@phosphor-icons/react";

interface AdminUser {
  id: string;
  displayName: string;
}

interface AdminHouse {
  id: string;
  name: string;
  color?: string;
}

interface AdminFormsProps {
  users: AdminUser[];
  houses: AdminHouse[];
  onCreateHouse: (formData: FormData) => Promise<void>;
  onAssignHouse: (formData: FormData) => Promise<void>;
  onCreateInvite: () => Promise<{ token: string; expiresAt: string }>;
}

export function AdminForms({ users, houses, onCreateHouse, onAssignHouse, onCreateInvite }: AdminFormsProps) {
  const [createPending, startCreate] = useTransition();
  const [editPending, startEdit] = useTransition();
  const [assignPending, startAssign] = useTransition();
  const [invitePending, startInvite] = useTransition();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const form = e.currentTarget;
    startCreate(async () => {
      try {
        await onCreateHouse(formData);
        toast.success("House created", { description: name });
        form.reset();
      } catch (err) {
        toast.error("Failed to create house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    const form = e.currentTarget;
    startEdit(async () => {
      try {
        await onCreateHouse(formData);
        toast.success("House updated", { description: name });
        form.reset();
      } catch (err) {
        toast.error("Failed to update house", {
          description: err instanceof Error ? err.message : "Something went wrong",
        });
      }
    });
  }

  function handleAssign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;
    const userName = users.find((u) => u.id === formData.get("targetUserId"))?.displayName;
    const houseName = houses.find((h) => h.id === formData.get("targetHouseId"))?.name;
    startAssign(async () => {
      try {
        await onAssignHouse(formData);
        toast.success("House assigned", {
          description: `${userName} → ${houseName}`,
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
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {/* Create house */}
      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border p-5 bg-card">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Plus size={16} />
          Create House
        </h4>
        <input
          name="name"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="House name"
          required
        />
        <input
          name="color"
          type="color"
          defaultValue="#7c3aed"
          className="h-9 w-full rounded-lg border bg-background px-2 cursor-pointer"
          title="House color"
        />
        <input
          name="description"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Description (optional)"
        />
        <button
          type="submit"
          disabled={createPending}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {createPending ? "Creating…" : "Create"}
        </button>
      </form>

      {/* Edit house color / description */}
      <form onSubmit={handleEdit} className="grid gap-3 rounded-xl border p-5 bg-card">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <PencilSimple size={16} />
          Edit House
        </h4>
        <select
          name="name"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
          required
          defaultValue=""
        >
          <option value="" disabled>Select house…</option>
          {houses.map((h) => (
            <option key={h.id} value={h.name}>{h.name}</option>
          ))}
        </select>
        <input
          name="color"
          type="color"
          defaultValue="#7c3aed"
          className="h-9 w-full rounded-lg border bg-background px-2 cursor-pointer"
          title="New color"
        />
        <input
          name="description"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Description (optional)"
        />
        <button
          type="submit"
          disabled={editPending}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {editPending ? "Saving…" : "Save changes"}
        </button>
      </form>

      {/* Assign user to house */}
      <form onSubmit={handleAssign} className="grid gap-3 rounded-xl border p-5 bg-card">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <UserSwitch size={16} />
          Assign User to House
        </h4>
        <select
          name="targetUserId"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
          required
          defaultValue=""
        >
          <option value="" disabled>Select member…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.displayName}</option>
          ))}
        </select>
        <select
          name="targetHouseId"
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
          required
          defaultValue=""
        >
          <option value="" disabled>Select house…</option>
          {houses.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={assignPending}
          className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {assignPending ? "Assigning…" : "Assign"}
        </button>
      </form>
      {/* Invite member */}
      <div className="grid gap-3 rounded-xl border p-5 bg-card">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <LinkSimple size={16} />
          Invite Member
        </h4>
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
            {invitePending ? "Generating…" : "Generate invite token"}
          </button>
        )}
      </div>
    </div>
  );
}
