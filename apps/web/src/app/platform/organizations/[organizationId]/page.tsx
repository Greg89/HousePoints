import Link from "next/link";
import { readPlatformOrganization } from "@/app/actions/platform";
import { PlatformOrganizationControls } from "@/components/PlatformOrganizationControls";

export const dynamic = "force-dynamic";

export default async function PlatformOrganizationPage({ params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params;
  const detail = await readPlatformOrganization(organizationId);
  const metrics = [["Members", detail.organization.memberCount], ["Point records", detail.organization.transactionCount], ["Active invites", detail.organization.activeInviteCount], ["Registered devices", detail.organization.deviceCount]] as const;
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-5xl space-y-6">
    <Link href="/platform" className="text-sm font-semibold text-primary hover:underline">← Support dashboard</Link>
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Organization support</p><h1 className="mt-2 font-display text-3xl font-bold">{detail.organization.name}</h1><p className="mt-1 text-sm text-muted-foreground">{detail.organization.slug} · {detail.organization.status}</p></div>
    <section className="grid gap-4 sm:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</section>
    <section className="rounded-2xl border bg-card p-5"><h2 className="font-display text-xl font-semibold">Owners</h2><div className="mt-3 space-y-2">{detail.owners.map((owner) => <div key={owner.id}><p className="font-semibold">{owner.displayName}</p>{owner.email ? <a className="text-sm text-primary hover:underline" href={`mailto:${owner.email}`}>{owner.email}</a> : <p className="text-sm text-muted-foreground">No email recorded</p>}</div>)}</div></section>
    <PlatformOrganizationControls organization={detail.organization} />
    <section className="rounded-2xl border bg-card p-5"><h2 className="font-display text-xl font-semibold">Recent application errors</h2><p className="mt-1 text-sm text-muted-foreground">{detail.recentErrorOccurrenceCount} occurrence{detail.recentErrorOccurrenceCount === 1 ? "" : "s"} in the last 7 days. Similar browser errors are grouped.</p><div className="mt-3 space-y-3">{detail.recentErrorSignals.length ? detail.recentErrorSignals.map((signal) => <div key={signal.id} className="rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{signal.message}</p><span className="text-xs font-semibold">{signal.occurrenceCount}×</span></div><p className="mt-1 text-xs text-muted-foreground">{signal.sourcePath ?? "Unknown page"} · Last seen {new Date(signal.lastSeenAt).toLocaleString()}</p></div>) : <p className="text-sm text-muted-foreground">No organization-scoped browser errors recorded recently.</p>}</div></section>
    <section className="rounded-2xl border bg-card p-5"><h2 className="font-display text-xl font-semibold">Recent organization audit</h2><div className="mt-3 space-y-3">{detail.recentAuditEvents.map((event) => <div key={event.id} className="rounded-xl border p-3"><p className="font-semibold">{event.summary}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</p></div>)}</div></section>
  </div></main>;
}
