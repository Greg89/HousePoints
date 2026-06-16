"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  House,
  LinkSimple,
  PencilSimple,
  Plus,
  UserSwitch,
  UsersThree,
} from "@phosphor-icons/react";

interface AdminUser {
  id: string;
  displayName: string;
  houseId?: string | null;
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

export function AdminForms({
  users,
  houses,
  onCreateHouse,
  onAssignHouse,
  onCreateInvite,
}: AdminFormsProps) {
  const [createPending, startCreate] = useTransition();
  const [editPending, startEdit] = useTransition();
  const [assignPending, startAssign] = useTransition();
  const [invitePending, startInvite] = useTransition();
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteExpiry, setInviteExpiry] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const unassignedCount = users.filter((user) => !user.houseId).length;

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
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Organization tools</p>
            <h3 className="font-display text-2xl font-semibold mt-1">Manage your team</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Invite teammates, tune the houses, and keep every member assigned without leaving the dashboard.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:min-w-80">
            <div className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UsersThree size={14} />
                Members
              </div>
              <p className="font-number text-2xl font-bold mt-1">{users.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <House size={14} />
                Houses
              </div>
              <p className="font-number text-2xl font-bold mt-1">{houses.length}</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserSwitch size={14} />
                Unassigned
              </div>
              <p className="font-number text-2xl font-bold mt-1">{unassignedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        <section className="space-y-6">
          <div>
            <h4 className="font-display text-lg font-semibold">Houses</h4>
            <p className="text-sm text-muted-foreground">
              Create new houses or update the details shown on the scoreboard.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border p-5 bg-card">
              <h5 className="text-sm font-semibold flex items-center gap-2">
                <Plus size={16} />
                Create House
              </h5>
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
                {createPending ? "Creating..." : "Create"}
              </button>
            </form>

            <form onSubmit={handleEdit} className="grid gap-3 rounded-xl border p-5 bg-card">
              <h5 className="text-sm font-semibold flex items-center gap-2">
                <PencilSimple size={16} />
                Edit House
              </h5>
              <select
                name="name"
                className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                required
                defaultValue=""
              >
                <option value="" disabled>Select house...</option>
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
                {editPending ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <h4 className="font-display text-lg font-semibold">Team Setup</h4>
            <p className="text-sm text-muted-foreground">
              Bring new members in and place them into the right house.
            </p>
          </div>

          <form onSubmit={handleAssign} className="grid gap-3 rounded-xl border p-5 bg-card">
            <h5 className="text-sm font-semibold flex items-center gap-2">
              <UserSwitch size={16} />
              Assign User to House
            </h5>
            <select
              name="targetUserId"
              className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              required
              defaultValue=""
            >
              <option value="" disabled>Select member...</option>
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
              <option value="" disabled>Select house...</option>
              {houses.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
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
      </div>
    </div>
  );
}
