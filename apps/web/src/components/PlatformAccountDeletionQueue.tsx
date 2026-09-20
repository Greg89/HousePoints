"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlatformAccountDeletionQueue } from "@housepoints/contracts";
import { toast } from "sonner";
import { completePlatformAccountDeletion } from "@/app/actions/platform";

type DeletionItem = PlatformAccountDeletionQueue["pending"][number];

function PendingDeletion({ item }: { item: DeletionItem }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const blocked = item.lastOwnerConflicts.length > 0;
  const canComplete = !blocked && confirmation === item.displayName && note.trim().length >= 10 && !pending;
  function complete() { startTransition(async () => {
    const result = await completePlatformAccountDeletion({ userId: item.userId, confirmationDisplayName: confirmation, completionNote: note });
    if (!result.ok) { toast.error(result.message); return; }
    toast.success("Account deletion completed and evidence recorded."); router.refresh();
  }); }
  return <article className="rounded-2xl border bg-card p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">{item.displayName}</h2><p className="text-sm text-muted-foreground">{item.email ?? "No email"} · Requested {new Date(item.requestedAt).toLocaleString()}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.userId}</p></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Pending</span></div>
    {blocked ? <div role="alert" className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm"><p className="font-semibold">Ownership transfer required</p><p className="mt-1">Transfer ownership for {item.lastOwnerConflicts.map((conflict) => conflict.organizationName).join(", ")} before completing this request.</p></div> : null}
    <div className="mt-4 rounded-xl border p-3 text-sm"><p className="font-semibold">Completion plan</p><ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground"><li>Purge device registrations, notifications, and reactions.</li><li>Expire unused invitations created by this user.</li><li>Anonymize profile and email; keep memberships and point history under “Deleted user.”</li><li>Retain authentication identifiers only as blocked-registration tombstones.</li></ul></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Type <strong>{item.displayName}</strong> to confirm<input aria-label={`Deletion confirmation for ${item.displayName}`} className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><label className="text-sm font-medium">Private completion note<textarea aria-label={`Deletion note for ${item.displayName}`} className="mt-1 block min-h-24 w-full rounded-lg border bg-background px-3 py-2" maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></label></div>
    <button className="mt-3 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50" disabled={!canComplete} onClick={complete}>{pending ? "Completing…" : "Complete deletion"}</button>
  </article>;
}

export function PlatformAccountDeletionQueue({ queue }: { queue: PlatformAccountDeletionQueue }) {
  return <div className="space-y-8"><section><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Pending requests</h2><span className="text-sm font-semibold">{queue.pending.length}</span></div><div className="mt-4 space-y-4">{queue.pending.map((item) => <PendingDeletion key={item.userId} item={item} />)}{queue.pending.length === 0 ? <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No pending deletion requests.</p> : null}</div></section>
    <section><h2 className="font-display text-2xl font-semibold">Recent completion evidence</h2><div className="mt-4 space-y-3">{queue.recentlyCompleted.map((item) => <article key={item.userId} className="rounded-2xl border bg-card p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{item.displayName}</p><p className="font-mono text-xs text-muted-foreground">{item.userId}</p></div><p className="text-sm text-muted-foreground">Completed {new Date(item.completedAt!).toLocaleString()}</p></div>{item.evidence ? <p className="mt-3 text-sm text-muted-foreground">Purged {item.evidence.deletedDeviceRegistrations} devices, {item.evidence.deletedNotifications} notifications, and {item.evidence.deletedReactions} reactions; expired {item.evidence.expiredInvitations} invitations. Retained {item.evidence.retainedMemberships} memberships and {item.evidence.retainedHistoricalPointRecords} historical point links.</p> : null}<p className="mt-2 text-sm"><span className="font-semibold">Operator note:</span> {item.completionNote ?? "No note recorded"}</p></article>)}{queue.recentlyCompleted.length === 0 ? <p className="text-sm text-muted-foreground">No completed requests yet.</p> : null}</div></section>
  </div>;
}
