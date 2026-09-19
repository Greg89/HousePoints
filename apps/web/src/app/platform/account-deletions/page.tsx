import Link from "next/link";
import { readPlatformAccountDeletions } from "@/app/actions/platform";
import { PlatformAccountDeletionQueue } from "@/components/PlatformAccountDeletionQueue";

export const dynamic = "force-dynamic";

export default async function PlatformAccountDeletionsPage() {
  const queue = await readPlatformAccountDeletions();
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-5xl space-y-6">
    <Link href="/platform" className="text-sm font-semibold text-primary hover:underline">← Support dashboard</Link>
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Compliance operations</p><h1 className="mt-2 font-display text-3xl font-bold">Account-deletion queue</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Review ownership conflicts, execute the documented anonymization plan, and retain completion evidence. HousePoints history remains attributable only to an anonymized “Deleted user” record.</p></div>
    <PlatformAccountDeletionQueue queue={queue} />
  </div></main>;
}
