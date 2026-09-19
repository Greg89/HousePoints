"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PlatformOverview } from "@housepoints/contracts";
import { toast } from "sonner";
import { updatePlatformSettings } from "@/app/actions/platform";

export function PlatformDashboard({ overview }: { overview: PlatformOverview }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState(overview.settings.organizationCreationEnabled);
  const [maximum, setMaximum] = useState(overview.settings.maxActiveOrganizations?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const organizations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? overview.organizations.filter((organization) =>
          `${organization.name} ${organization.slug}`.toLowerCase().includes(normalized))
      : overview.organizations;
  }, [overview.organizations, query]);

  function saveSettings() {
    const parsedMaximum = maximum.trim() ? Number(maximum) : null;
    if (parsedMaximum !== null && (!Number.isSafeInteger(parsedMaximum) || parsedMaximum < 1)) {
      toast.error("Enter a positive whole-number organization limit.");
      return;
    }
    startTransition(async () => {
      const result = await updatePlatformSettings({
        organizationCreationEnabled: enabled,
        maxActiveOrganizations: parsedMaximum,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Platform capacity settings updated.");
      router.refresh();
    });
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">HousePoints platform</p>
          <h1 className="mt-2 font-display text-3xl font-bold">Support dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">Operate capacity and inspect organizations without changing organization context.</p>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <Metric label="Active organizations" value={`${overview.activeOrganizationCount}${overview.settings.effectiveMaxActiveOrganizations ? ` / ${overview.settings.effectiveMaxActiveOrganizations}` : ""}`} />
          <Metric label="Archived organizations" value={String(overview.archivedOrganizationCount)} />
          <Metric label="Active memberships" value={String(overview.totalMemberCount)} />
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Organization registration</h2>
              <p className="mt-1 text-sm text-muted-foreground">Railway hard ceiling: {overview.settings.hardOrganizationCreationEnabled ? "enabled" : "disabled"}, {overview.settings.hardMaxActiveOrganizations ?? "unlimited"} organizations.</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />Accept new organizations</label>
              <label className="text-sm font-medium">Operating limit<input className="mt-1 block w-32 rounded-lg border bg-background px-3 py-2" type="number" min="1" value={maximum} placeholder="Unlimited" onChange={(event) => setMaximum(event.target.value)} /></label>
              <button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" disabled={pending} onClick={saveSettings}>{pending ? "Saving…" : "Save controls"}</button>
            </div>
          </div>
          <p className="mt-4 text-sm font-semibold">Effective state: {overview.settings.effectiveOrganizationCreationEnabled ? "Open" : "Closed"}</p>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="font-display text-xl font-semibold">Organizations</h2><input aria-label="Search organizations" className="rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Search name or slug" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3">Organization</th><th>Status</th><th>Members</th><th>Owners</th><th>Last activity</th><th>Created</th></tr></thead><tbody>{organizations.map((organization) => <tr key={organization.id} className="border-b last:border-0"><td className="py-3"><Link className="font-semibold text-primary hover:underline" href={`/platform/organizations/${organization.id}`}>{organization.name}</Link><p className="text-xs text-muted-foreground">{organization.slug}</p></td><td>{organization.status}</td><td>{organization.memberCount}</td><td>{organization.ownerCount}</td><td>{formatDate(organization.lastActivityAt)}</td><td>{formatDate(organization.createdAt)}</td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-xl font-semibold">Recent platform changes</h2>
          <div className="mt-4 space-y-3">{overview.recentAuditEvents.length ? overview.recentAuditEvents.map((event) => <div key={event.id} className="rounded-xl border p-3"><p className="text-sm font-semibold">{event.summary}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.createdAt)} · {event.actorAuth0Sub}</p></div>) : <p className="text-sm text-muted-foreground">No platform changes recorded yet.</p>}</div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 font-display text-3xl font-bold">{value}</p></div>; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "—"; }
