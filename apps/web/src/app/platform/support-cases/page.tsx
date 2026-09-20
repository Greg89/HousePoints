import Link from "next/link";
import { readPlatformSupportCases } from "@/app/actions/platform";
import { PlatformSupportCases } from "@/components/PlatformSupportCases";

export const dynamic = "force-dynamic";

export default async function PlatformSupportCasesPage() {
  const data = await readPlatformSupportCases();
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-5xl space-y-6"><Link href="/platform" className="text-sm font-semibold text-primary hover:underline">← Support dashboard</Link><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Support operations</p><h1 className="mt-2 font-display text-3xl font-bold">Private support cases</h1><p className="mt-2 text-sm text-muted-foreground">Track operator-owned investigations without exposing private notes to organization members.</p></div><PlatformSupportCases data={data} /></div></main>;
}
