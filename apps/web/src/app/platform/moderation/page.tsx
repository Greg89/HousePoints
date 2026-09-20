import Link from "next/link";
import { readPlatformModerationReports } from "@/app/actions/platform";
import { PlatformModerationQueue } from "@/components/PlatformModerationQueue";

export const dynamic = "force-dynamic";

export default async function PlatformModerationPage() {
  const data = await readPlatformModerationReports();
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-5xl space-y-6"><Link href="/platform" className="text-sm font-semibold text-primary hover:underline">← Support dashboard</Link><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Trust and safety</p><h1 className="mt-2 font-display text-3xl font-bold">Moderation reports</h1><p className="mt-2 text-sm text-muted-foreground">Immutable evidence snapshots preserve what was reported even if the underlying activity or membership later changes.</p></div><PlatformModerationQueue reports={data.reports} /></div></main>;
}
