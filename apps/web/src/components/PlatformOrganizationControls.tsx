"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlatformOrganizationDetail } from "@housepoints/contracts";
import { toast } from "sonner";
import { updatePlatformOrganizationStatus } from "@/app/actions/platform";

export function PlatformOrganizationControls({ organization }: { organization: PlatformOrganizationDetail["organization"] }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const confirmed = confirmation === organization.slug;

  function changeStatus(action: "SUSPEND" | "RESUME" | "ARCHIVE" | "RESTORE") {
    startTransition(async () => {
      const result = await updatePlatformOrganizationStatus({ organizationId: organization.id, action, confirmationSlug: confirmation, ...(action === "SUSPEND" ? { reason } : {}) });
      if (!result.ok) { toast.error(result.message); return; }
      toast.success(`Organization ${action.toLowerCase()}${action.endsWith("E") ? "d" : "ed"}.`);
      setConfirmation(""); setReason(""); router.refresh();
    });
  }

  return <section className="rounded-2xl border border-destructive/40 bg-card p-5">
    <h2 className="font-display text-xl font-semibold">Lifecycle and access controls</h2>
    <p className="mt-2 text-sm text-muted-foreground">Suspension temporarily blocks use. Archive removes the organization from normal membership context and frees one capacity slot.</p>
    {organization.suspensionReason ? <p className="mt-2 text-sm">Current suspension reason: {organization.suspensionReason}</p> : null}
    <label className="mt-4 block text-sm font-medium">Type <strong>{organization.slug}</strong> to confirm
      <input aria-label="Confirmation slug" className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
    </label>
    {organization.status === "ACTIVE" ? <label className="mt-3 block text-sm font-medium">Suspension reason
      <textarea aria-label="Suspension reason" className="mt-1 block min-h-24 w-full rounded-lg border bg-background px-3 py-2" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
    </label> : null}
    <div className="mt-4 flex flex-wrap gap-3">
      {organization.status === "ACTIVE" ? <button className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" disabled={pending || !confirmed || reason.trim().length < 3} onClick={() => changeStatus("SUSPEND")}>Suspend organization</button> : null}
      {organization.status === "SUSPENDED" ? <button className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50" disabled={pending || !confirmed} onClick={() => changeStatus("RESUME")}>Resume organization</button> : null}
      {organization.status !== "ARCHIVED" ? <button className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50" disabled={pending || !confirmed} onClick={() => changeStatus("ARCHIVE")}>Archive organization</button> : <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={pending || !confirmed} onClick={() => changeStatus("RESTORE")}>Restore organization</button>}
    </div>
  </section>;
}
