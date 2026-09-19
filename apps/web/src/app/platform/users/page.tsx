import Link from "next/link";
import { PlatformUserSearch } from "@/components/PlatformUserSearch";

export const dynamic = "force-dynamic";
export default function PlatformUsersPage() {
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-6xl space-y-6"><Link href="/platform" className="text-sm font-semibold text-primary hover:underline">← Support dashboard</Link><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">User support</p><h1 className="mt-2 font-display text-3xl font-bold">User and permission search</h1><p className="mt-2 text-sm text-muted-foreground">Search by name, email, or identity subject. Results are diagnostic and do not impersonate the user.</p></div><PlatformUserSearch /></div></main>;
}
