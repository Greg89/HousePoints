import Link from "next/link";
import { readPlatformSupportCase } from "@/app/actions/platform";
import { PlatformSupportCaseDetail } from "@/components/PlatformSupportCaseDetail";

export const dynamic = "force-dynamic";

export default async function PlatformSupportCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supportCase = await readPlatformSupportCase(caseId);
  return <main className="min-h-screen bg-background px-4 py-8"><div className="mx-auto max-w-5xl space-y-6"><Link href="/platform/support-cases" className="text-sm font-semibold text-primary hover:underline">← Support cases</Link><PlatformSupportCaseDetail supportCase={supportCase} /></div></main>;
}
