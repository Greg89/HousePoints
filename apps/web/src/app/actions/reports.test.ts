import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { readReportPage } from "./reports";

vi.mock("@/lib/current-user", () => ({
  getCurrentUserForRequest: vi.fn(),
}));

vi.mock("@/lib/action-context", () => ({
  logServerActionFailed: vi.fn(),
  runServerAction: vi.fn(
    async (
      action: string,
      handler: (context: { action: string; requestId: string }) => Promise<unknown>,
    ) => handler({ action, requestId: "request-1" }),
  ),
}));

vi.mock("@/lib/api-client", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api-client")>();

  return {
    ...actual,
    apiFetch: vi.fn(),
    parseApiResponse: vi.fn(),
  };
});

const apiFetchMock = vi.mocked(apiFetch);
const parseApiResponseMock = vi.mocked(parseApiResponse);
const runServerActionMock = vi.mocked(runServerAction);
const logServerActionFailedMock = vi.mocked(logServerActionFailed);
const getCurrentUserForRequestMock = vi.mocked(getCurrentUserForRequest);

const successPayload = {
  scope: { seasonId: "season-1" },
  revision: "42",
  summary: {
    netPoints: 10,
    awardedPoints: 15,
    deductedPoints: 5,
    transactionCount: 3,
    awardCount: 2,
    deductionCount: 1,
    deductionsOutsideCategory: null,
  },
  items: [],
  nextCursor: null,
} as const;

describe("readReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserForRequestMock.mockResolvedValue({
      id: "user-1",
      auth0Sub: "auth0|user-1",
      email: "user@example.com",
      displayName: "User One",
      houseThemeEnabled: false,
      role: "MEMBER",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      organizationContexts: [],
      created: false,
    });
    apiFetchMock.mockResolvedValue(Response.json({}));
  });

  it("posts the scoped request and returns the parsed page", async () => {
    parseApiResponseMock.mockResolvedValue(successPayload);

    const result = await readReportPage({
      seasonId: "season-1",
      houseId: "house-1",
      memberId: "user-2",
      limit: 25,
    });

    expect(runServerActionMock).toHaveBeenCalledWith("readReportPage", expect.any(Function));
    expect(getCurrentUserForRequestMock).toHaveBeenCalledWith("request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/reports/query", "request-1", {
      method: "POST",
      body: JSON.stringify({
        seasonId: "season-1",
        houseId: "house-1",
        memberId: "user-2",
        limit: 25,
      }),
    });
    expect(result).toEqual({ ok: true, page: successPayload });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
  });

  it("maps a 409 REPORT_REFRESH_REQUIRED to a refresh-required result", async () => {
    parseApiResponseMock.mockRejectedValue(
      new ApiResponseError(409, "REPORT_REFRESH_REQUIRED", "Report changed."),
    );

    const result = await readReportPage({ seasonId: "season-1", limit: 25 });

    expect(result).toEqual({
      ok: false,
      code: "REPORT_REFRESH_REQUIRED",
      message: "Scores changed while loading. Refresh to see the current report.",
    });
    expect(logServerActionFailedMock).toHaveBeenCalledTimes(1);
  });

  it("maps a 403 to a revoked-access result", async () => {
    parseApiResponseMock.mockRejectedValue(
      new ApiResponseError(403, "FORBIDDEN", "Not permitted."),
    );

    const result = await readReportPage({ seasonId: "season-1", limit: 25 });

    expect(result).toEqual({
      ok: false,
      code: "REPORT_ACCESS_REVOKED",
      message: "You no longer have access to this report.",
    });
  });

  it("maps a 400 INVALID_REPORT_CURSOR to a cursor error", async () => {
    parseApiResponseMock.mockRejectedValue(
      new ApiResponseError(400, "INVALID_REPORT_CURSOR", "Bad cursor."),
    );

    const result = await readReportPage({
      seasonId: "season-1",
      cursor: "stale",
      limit: 25,
    });

    expect(result).toEqual({
      ok: false,
      code: "INVALID_REPORT_CURSOR",
      message: "This report link is out of date. Refresh to start over.",
    });
  });

  it("maps a 503 REPORTS_NOT_CONFIGURED to an unavailable result", async () => {
    parseApiResponseMock.mockRejectedValue(
      new ApiResponseError(503, "REPORTS_NOT_CONFIGURED", "Unavailable."),
    );

    const result = await readReportPage({ seasonId: "season-1", limit: 25 });

    expect(result).toEqual({
      ok: false,
      code: "REPORTS_NOT_CONFIGURED",
      message: "Reports are temporarily unavailable.",
    });
  });

  it("returns a generic REPORT_UNAVAILABLE for other 4xx errors", async () => {
    parseApiResponseMock.mockRejectedValue(
      new ApiResponseError(422, "SEASON_NOT_FOUND", "Season not found."),
    );

    const result = await readReportPage({ seasonId: "season-1", limit: 25 });

    expect(result).toEqual({
      ok: false,
      code: "REPORT_UNAVAILABLE",
      message: "Season not found.",
    });
  });

  it("rethrows non-ApiResponseError failures", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("network"));

    await expect(readReportPage({ seasonId: "season-1", limit: 25 })).rejects.toThrow(
      "network",
    );
  });
});
