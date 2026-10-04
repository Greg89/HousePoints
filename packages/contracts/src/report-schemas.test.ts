import { describe, expect, it } from "vitest";
import { reportPageRequestSchema } from "./report-schemas.js";

describe("reportPageRequestSchema", () => {
  it("requires an explicit season and bounds each page", () => {
    expect(reportPageRequestSchema.safeParse({}).success).toBe(false);
    expect(reportPageRequestSchema.safeParse({ seasonId: "s", limit: 51 }).success).toBe(false);
    expect(reportPageRequestSchema.parse({ seasonId: "s" }).limit).toBe(25);
  });

  it("allows anonymized recipient scope but rejects unknown filters", () => {
    expect(reportPageRequestSchema.parse({ seasonId: "s", memberId: null }).memberId).toBeNull();
    expect(reportPageRequestSchema.safeParse({ seasonId: "s", organizationId: "other" }).success).toBe(false);
  });
});
