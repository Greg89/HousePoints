import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

import { logError, logWarn } from "@/lib/logging";
import { POST } from "./route";

const logErrorMock = vi.mocked(logError);
const logWarnMock = vi.mocked(logWarn);

describe("POST /api/client-errors", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("logs accepted browser error reports", async () => {
    const response = await POST(
      new Request("https://housepoints.test/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "error",
          message: "Hydration failed",
          stack: "Error: Hydration failed",
          source: "https://housepoints.test/_next/static/chunk.js",
          lineno: 10,
          colno: 5,
          url: "https://housepoints.test/",
          userAgent: "Vitest Browser",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(logErrorMock).toHaveBeenCalledWith(
      "web.client.error_reported",
      expect.objectContaining({
        route: "/api/client-errors",
        reportType: "error",
        message: "Hydration failed",
        browserUrl: "https://housepoints.test/",
        browserUserAgent: "Vitest Browser",
      }),
    );
    expect(logWarnMock).not.toHaveBeenCalled();
  });

  it("rejects malformed report payloads without logging them as browser errors", async () => {
    const response = await POST(
      new Request("https://housepoints.test/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "error",
          message: "",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false });
    expect(logWarnMock).toHaveBeenCalledWith(
      "web.client.error_report_rejected",
      expect.objectContaining({
        reason: "validation_failed",
        route: "/api/client-errors",
      }),
    );
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON", async () => {
    const response = await POST(
      new Request("https://housepoints.test/api/client-errors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    );

    expect(response.status).toBe(400);
    expect(logWarnMock).toHaveBeenCalledWith(
      "web.client.error_report_rejected",
      expect.objectContaining({
        reason: "invalid_json",
      }),
    );
  });
});
