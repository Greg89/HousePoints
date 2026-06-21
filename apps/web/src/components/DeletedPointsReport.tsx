import type { DeletedPoint } from "@housepoints/contracts";

interface DeletedPointsReportProps {
  recentDeletedPoints: DeletedPoint[];
}

export function DeletedPointsReport({ recentDeletedPoints }: DeletedPointsReportProps) {
  const deletedPointsTotal = recentDeletedPoints.reduce((total, point) => total + point.delta, 0);
  const latestDeletedPoint = recentDeletedPoints[0] ?? null;

  return (
    <section className="rounded-2xl border bg-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">Admin reporting</p>
          <h4 className="font-display text-xl font-semibold mt-1">Recently deleted point awards</h4>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Deleted awards are removed from scoring, but stay visible here for review.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:min-w-72">
          <div className="rounded-xl border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Awards deleted</p>
            <p className="font-number text-2xl font-bold mt-1">{recentDeletedPoints.length}</p>
          </div>
          <div className="rounded-xl border bg-background/60 p-3">
            <p className="text-xs text-muted-foreground">Points removed</p>
            <p className="font-number text-2xl font-bold mt-1">{deletedPointsTotal}</p>
          </div>
        </div>
      </div>
      {latestDeletedPoint ? (
        <p className="mt-4 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Latest deletion: {latestDeletedPoint.deletedByName ?? "Unknown admin"} removed{" "}
          {latestDeletedPoint.delta} points from {latestDeletedPoint.targetUserName} on{" "}
          {new Date(latestDeletedPoint.deletedAt).toLocaleString()}.
        </p>
      ) : null}
      <div className="mt-5 overflow-hidden rounded-xl border">
        {recentDeletedPoints.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No point awards have been deleted recently.
          </p>
        ) : (
          <div className="divide-y">
            {recentDeletedPoints.map((point) => (
              <article key={point.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <div>
                  <p className="text-sm font-semibold">
                    {point.deletedByName ?? "Unknown admin"} deleted {point.delta} points to{" "}
                    {point.targetUserName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Original award from {point.actorName} to {point.targetHouseName} on{" "}
                    {new Date(point.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {point.deletionReason || point.reason}
                  </p>
                </div>
                <span className="rounded-full border bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                  {new Date(point.deletedAt).toLocaleDateString()}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
