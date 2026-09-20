import { ApiResponseError } from "@/lib/api-client";
import { readPlatformOverview } from "@/app/actions/platform";
import { PlatformDashboard } from "@/components/PlatformDashboard";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  let overview;
  let accessDenied = false;
  try {
    overview = await readPlatformOverview();
  } catch (error) {
    if (error instanceof ApiResponseError && error.statusCode === 403) {
      accessDenied = true;
    } else {
      throw error;
    }
  }

  if (accessDenied || !overview) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Platform access required</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This area is restricted to configured HousePoints platform operators.
          </p>
        </div>
      </main>
    );
  }

  return <PlatformDashboard overview={overview} />;
}
