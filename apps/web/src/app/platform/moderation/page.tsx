import { readPlatformModerationReports } from "@/app/actions/platform";
import { PlatformModerationQueue } from "@/components/PlatformModerationQueue";

export const dynamic = "force-dynamic";

export default async function PlatformModerationPage() {
  const data = await readPlatformModerationReports();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Moderation reports</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable evidence snapshots preserve what was reported even if the underlying activity or membership later changes.
        </p>
      </div>
      <PlatformModerationQueue reports={data.reports} />
    </div>
  );
}
