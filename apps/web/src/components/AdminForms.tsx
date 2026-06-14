"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Plus, UserSwitch } from "@phosphor-icons/react";

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
}

export function AdminForms({ users, houses, onCreateHouse, onAssignHouse }: AdminFormsProps) {
  const [createPending, startCreate] = useTransition();
  const [assignPending, startAssign] = useTransition();

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

  return (
    <div className="grid gap-6 sm:grid-cols-2">
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
    </div>
  );
}
