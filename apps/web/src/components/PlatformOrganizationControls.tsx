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
  if (organization.status === "ARCHIVED") return <section className="rounded-2xl border bg-card p-5"><h2 className="font-display text-xl font-semibold">Lifecycle controls</h2><p className="mt-2 text-sm text-muted-foreground">This organization is archived. Platform archive and restore controls are planned for the next increment.</p></section>;
  const action = organization.status === "SUSPENDED" ? "RESUME" : "SUSPEND";
  function submit() { startTransition(async () => {
    const result = await updatePlatformOrganizationStatus({ organizationId: organization.id, action, confirmationSlug: confirmation, ...(action === "SUSPEND" ? { reason } : {}) });
    if (!result.ok) { toast.error(result.message); return; }
    toast.success(`Organization ${action === "SUSPEND" ? "suspended" : "resumed"}.`);
    router.refresh();
  }); }
  return <section className="rounded-2xl border border-destructive/40 bg-card p-5"><h2 className="font-display text-xl font-semibold">Lifecycle controls</h2>{organization.suspensionReason ? <p className="mt-2 text-sm">Current reason: {organization.suspensionReason}</p> : null}<label className="mt-4 block text-sm font-medium">Type <strong>{organization.slug}</strong> to confirm<input aria-label="Confirmation slug" className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{action === "SUSPEND" ? <label className="mt-3 block text-sm font-medium">Reason<textarea aria-label="Suspension reason" className="mt-1 block min-h-24 w-full rounded-lg border bg-background px-3 py-2" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : null}<button className="mt-4 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50" disabled={pending || confirmation !== organization.slug || (action === "SUSPEND" && reason.trim().length < 3)} onClick={submit}>{pending ? "Updating…" : action === "SUSPEND" ? "Suspend organization" : "Resume organization"}</button></section>;
}
