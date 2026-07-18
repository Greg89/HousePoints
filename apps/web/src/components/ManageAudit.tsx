"use client";

import { useState } from "react";
import type {
  AdminAuditAction,
  PagedAdminAuditActions,
  PointAdjustmentStats,
  Season,
} from "@housepoints/contracts";
import { PointAdjustmentReport } from "./PointAdjustmentReport";
import { RecentAdminActionsReport } from "./RecentAdminActionsReport";

interface ManageAuditProps {
  actions: AdminAuditAction[];
  nextCursor: string | null;
  pointAdjustmentStats: PointAdjustmentStats;
  seasons: Season[];
  onLoadPage: (
    type?: AdminAuditAction["type"],
    cursor?: string,
  ) => Promise<PagedAdminAuditActions>;
  onLoadPointAdjustmentStats: (seasonId?: string) => Promise<PointAdjustmentStats>;
}

export function ManageAudit(props: ManageAuditProps) {
  const [view, setView] = useState<"history" | "adjustments">("history");

  return (
    <section className="space-y-4">
      <div className="flex gap-1 rounded-xl border bg-card p-1" aria-label="Audit views">
        <button
          type="button"
          aria-pressed={view === "history"}
          onClick={() => setView("history")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            view === "history" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          History
        </button>
        <button
          type="button"
          aria-pressed={view === "adjustments"}
          onClick={() => setView("adjustments")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${
            view === "adjustments" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
          }`}
        >
          Point adjustments
        </button>
      </div>
      {view === "history" ? (
        <RecentAdminActionsReport
          actions={props.actions}
          nextCursor={props.nextCursor}
          onLoadPage={props.onLoadPage}
        />
      ) : (
        <PointAdjustmentReport
          pointAdjustmentStats={props.pointAdjustmentStats}
          seasons={props.seasons}
          onLoadPointAdjustmentStats={props.onLoadPointAdjustmentStats}
        />
      )}
    </section>
  );
}
