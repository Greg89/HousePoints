"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlatformOrganizationDetail } from "@housepoints/contracts";
import { toast } from "sonner";
import { revokePlatformOrganizationInvite, revokePlatformOrganizationInvites } from "@/app/actions/platform";

export function PlatformInvitationSupport({ organization, invites }: { organization: PlatformOrganizationDetail["organization"]; invites: PlatformOrganizationDetail["activeInvites"] }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const canRevoke = confirmation === organization.slug && reason.trim().length >= 3 && !pending;

  function revoke(inviteId?: string) {
    startTransition(async () => {
      if (inviteId) {
        const result = await revokePlatformOrganizationInvite({ organizationId: organization.id, inviteId, confirmationSlug: confirmation, reason });
        if (!result.ok) { toast.error(result.message); return; }
        toast.success("Invitation revoked.");
      } else {
        const result = await revokePlatformOrganizationInvites({ organizationId: organization.id, confirmationSlug: confirmation, reason });
        if (!result.ok) { toast.error(result.message); return; }
        toast.success(`${result.revokedCount} outstanding invitation${result.revokedCount === 1 ? "" : "s"} revoked.`);
      }
      setConfirmation(""); setReason(""); router.refresh();
    });
  }

  return <section className="rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">Active invitations</h2><p className="mt-1 text-sm text-muted-foreground">Invitation tokens are never shown. Revocation takes effect immediately.</p></div><span className="text-sm font-semibold">{invites.length} active</span></div>
    {invites.length ? <>
      <div className="mt-4 space-y-3">{invites.map((invite) => <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="font-semibold">Created by {invite.createdByName}</p><p className="text-xs text-muted-foreground">Created {new Date(invite.createdAt).toLocaleString()} · Expires {new Date(invite.expiresAt).toLocaleString()}</p></div><button className="rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={!canRevoke} onClick={() => revoke(invite.id)}>Revoke invitation</button></div>)}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Type <strong>{organization.slug}</strong> to confirm<input aria-label="Invitation confirmation slug" className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><label className="text-sm font-medium">Support reason<input aria-label="Invitation revocation reason" className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label></div>
      <button className="mt-3 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50" disabled={!canRevoke} onClick={() => revoke()}>Revoke all active invitations</button>
    </> : <p className="mt-3 text-sm text-muted-foreground">No active invitations.</p>}
  </section>;
}
