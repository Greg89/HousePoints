"use client";

import { useState, useTransition } from "react";
import type { PlatformModerationReportList } from "@housepoints/contracts";
import { resolvePlatformModerationReport } from "@/app/actions/platform";

export function PlatformModerationQueue({ reports }: PlatformModerationReportList) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function act(reportId: string, action: "START_REVIEW" | "DISMISS" | "RESOLVE" | "REDACT_CONTENT") {
    setMessage(null);
    startTransition(async () => {
      const result = await resolvePlatformModerationReport({ reportId, action, operatorNote: notes[reportId] ?? "" });
      setMessage(result.ok ? "Moderation report updated." : result.message);
    });
  }
  return <div className="space-y-4">
    {message ? <p role="status" className="rounded-xl border bg-card p-3 text-sm">{message}</p> : null}
    {reports.map((report) => <article key={report.id} className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">{report.targetType.replaceAll("_", " ")}</h2><p className="text-sm text-muted-foreground">{report.organization.name} · Reported by {report.reporter.displayName}</p></div><div className="text-right text-xs font-semibold"><p>{report.category} · {report.status}</p><p className="mt-1 text-muted-foreground">{report.priorReportCount} prior report{report.priorReportCount === 1 ? "" : "s"}</p></div></div>
      {report.details ? <p className="mt-3 whitespace-pre-wrap text-sm">{report.details}</p> : null}
      <details className="mt-3 rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">Evidence snapshot</summary><pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-muted-foreground">{JSON.stringify(report.evidenceSnapshot, null, 2)}</pre></details>
      <p className="mt-3 text-xs text-muted-foreground">Submitted {new Date(report.createdAt).toLocaleString()} · Target {report.targetId}</p>
      {report.status === "RESOLVED" || report.status === "DISMISSED" ? <div className="mt-4 rounded-xl bg-muted p-3 text-sm"><p className="font-semibold">Decision note</p><p className="mt-1 whitespace-pre-wrap">{report.operatorNote}</p></div> : <div className="mt-4 space-y-3 border-t pt-4"><label className="block text-sm font-semibold">Private operator note<textarea value={notes[report.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} className="mt-1 min-h-20 w-full rounded-xl border bg-background p-3 font-normal" maxLength={1000} /></label><div className="flex flex-wrap gap-2"><button disabled={pending} onClick={() => act(report.id, "START_REVIEW")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Start review</button><button disabled={pending} onClick={() => act(report.id, "DISMISS")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Dismiss</button><button disabled={pending} onClick={() => act(report.id, "RESOLVE")} className="rounded-lg border px-3 py-2 text-sm font-semibold">Resolve</button>{report.targetType === "POINT_TRANSACTION" ? <button disabled={pending} onClick={() => act(report.id, "REDACT_CONTENT")} className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground">Redact activity</button> : null}</div></div>}
    </article>)}
    {reports.length === 0 ? <p className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">No reports have been submitted.</p> : null}
  </div>;
}
