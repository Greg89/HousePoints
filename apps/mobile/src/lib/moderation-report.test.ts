import { describe, expect, it } from "vitest";
import { activityReportPayload } from "./moderation-report";

describe("activityReportPayload", () => {
  it("builds a bounded point-transaction report payload", () => {
    expect(activityReportPayload("tx-1", "SPAM", "  Repeated promotion  ")).toEqual({ targetType: "POINT_TRANSACTION", targetId: "tx-1", category: "SPAM", details: "Repeated promotion" });
  });

  it("omits blank optional details", () => {
    expect(activityReportPayload("tx-1", "OTHER", "  ").details).toBeUndefined();
  });
});
