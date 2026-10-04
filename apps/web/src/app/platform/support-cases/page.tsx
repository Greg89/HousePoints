import { readPlatformSupportCases } from "@/app/actions/platform";
import { PlatformSupportCases } from "@/components/PlatformSupportCases";

export const dynamic = "force-dynamic";

export default async function PlatformSupportCasesPage() {
  const data = await readPlatformSupportCases();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Private support cases</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track operator-owned investigations without exposing private notes to organization members.
        </p>
      </div>
      <PlatformSupportCases data={data} />
    </div>
  );
}
