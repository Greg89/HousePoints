"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PlatformSupportCaseList } from "@housepoints/contracts";
import { toast } from "sonner";
import { createPlatformSupportCase } from "@/app/actions/platform";

export function PlatformSupportCases({ data }: { data: PlatformSupportCaseList }) {
  const router = useRouter();
  const [title, setTitle] = useState(""); const [summary, setSummary] = useState("");
  const [priority, setPriority] = useState<"LOW" | "NORMAL" | "HIGH" | "URGENT">("NORMAL");
  const [organizationId, setOrganizationId] = useState(""); const [userId, setUserId] = useState("");
  const [pending, startTransition] = useTransition();
  function create() { startTransition(async () => {
    const result = await createPlatformSupportCase({ title, summary, priority, ...(organizationId.trim() ? { organizationId: organizationId.trim() } : {}), ...(userId.trim() ? { userId: userId.trim() } : {}) });
    if (!result.ok) { toast.error(result.message); return; }
    toast.success("Support case created."); router.push(`/platform/support-cases/${result.id}`);
  }); }
  return <div className="space-y-6">
    <section className="rounded-2xl border bg-card p-5"><h2 className="font-display text-xl font-semibold">Create a private case</h2><p className="mt-1 text-sm text-muted-foreground">Use internal IDs to link a case to an organization or user. Case content and notes are visible only to platform operators.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Title<input aria-label="Case title" className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="text-sm font-medium">Priority<select aria-label="Case priority" className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label><label className="text-sm font-medium">Organization ID (optional)<input aria-label="Case organization ID" className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} /></label><label className="text-sm font-medium">User ID (optional)<input aria-label="Case user ID" className="mt-1 block w-full rounded-lg border bg-background px-3 py-2" value={userId} onChange={(event) => setUserId(event.target.value)} /></label></div><label className="mt-3 block text-sm font-medium">Initial private summary<textarea aria-label="Case summary" className="mt-1 block min-h-28 w-full rounded-lg border bg-background px-3 py-2" maxLength={1000} value={summary} onChange={(event) => setSummary(event.target.value)} /></label><button className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={pending || title.trim().length < 3 || summary.trim().length < 10} onClick={create}>{pending ? "Creating…" : "Create support case"}</button></section>
    <section><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Cases</h2><span className="text-sm font-semibold">{data.cases.length}</span></div><div className="mt-4 space-y-3">{data.cases.map((supportCase) => <Link key={supportCase.id} href={`/platform/support-cases/${supportCase.id}`} className="block rounded-2xl border bg-card p-5 hover:border-primary/50"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{supportCase.title}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{supportCase.summary}</p></div><div className="text-right text-xs font-semibold"><p>{supportCase.priority} · {supportCase.status}</p><p className="mt-1 text-muted-foreground">{supportCase.noteCount} note{supportCase.noteCount === 1 ? "" : "s"}</p></div></div><p className="mt-3 text-xs text-muted-foreground">{supportCase.organization?.name ?? "No organization"} · {supportCase.user?.displayName ?? "No user"} · Updated {new Date(supportCase.updatedAt).toLocaleString()}</p></Link>)}{data.cases.length === 0 ? <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No support cases yet.</p> : null}</div></section>
  </div>;
}
