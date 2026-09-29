import { readPlatformAccountDeletions } from "@/app/actions/platform";
import { PlatformAccountDeletionQueue } from "@/components/PlatformAccountDeletionQueue";

export const dynamic = "force-dynamic";

export default async function PlatformAccountDeletionsPage() {
  const queue = await readPlatformAccountDeletions();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold">Account-deletion queue</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Review ownership conflicts, execute the documented anonymization plan, and retain completion evidence. HousePoints history remains attributable only to an anonymized “Deleted user” record.
        </p>
      </div>
      <PlatformAccountDeletionQueue queue={queue} />
    </div>
  );
}
