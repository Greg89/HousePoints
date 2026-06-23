import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { awardPoints, deductPoints } from "./points";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentUserForRequest: vi.fn(),
}));

vi.mock("@/lib/action-context", () => ({
  logServerActionFailed: vi.fn(),
  runServerAction: vi.fn(async (action: string, handler: (context: { action: string; requestId: string }) => Promise<unknown>) =>
    handler({ action, requestId: "request-1" }),
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
const getCurrentUserForRequestMock = vi.mocked(getCurrentUserForRequest);
const logServerActionFailedMock = vi.mocked(logServerActionFailed);
const parseApiResponseMock = vi.mocked(parseApiResponse);
const revalidatePathMock = vi.mocked(revalidatePath);
const runServerActionMock = vi.mocked(runServerAction);

describe("awardPoints", () => {
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
      created: false,
    });
    apiFetchMock.mockResolvedValue(Response.json({ id: "tx-1" }));
    parseApiResponseMock.mockResolvedValue({ id: "tx-1" });
  });

  it("returns ok and revalidates the dashboard when the award succeeds", async () => {
    await expect(
      awardPoints("target-1", 10, "Great teamwork", "TEAM_SUPPORT"),
    ).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("awardPoints", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/points/adjust", "request-1", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "target-1",
        delta: 10,
        reason: "Great teamwork",
        trait: "TEAM_SUPPORT",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      409,
      "ACTIVE_SEASON_REQUIRED",
      "Points could not be awarded. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(
      awardPoints("target-1", 10, "Great teamwork", "TEAM_SUPPORT"),
    ).resolves.toEqual({
      ok: false,
      code: "ACTIVE_SEASON_REQUIRED",
      message: "Points could not be awarded. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "awardPoints", requestId: "request-1" },
      error,
      {
        targetUserId: "target-1",
        delta: 10,
        trait: "TEAM_SUPPORT",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(
      awardPoints("target-1", 10, "Great teamwork", "TEAM_SUPPORT"),
    ).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("deductPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserForRequestMock.mockResolvedValue({
      id: "user-1",
      auth0Sub: "auth0|user-1",
      email: "user@example.com",
      displayName: "User One",
      houseThemeEnabled: false,
      role: "ADMIN",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      created: false,
    });
    apiFetchMock.mockResolvedValue(Response.json({ id: "tx-deduction" }));
    parseApiResponseMock.mockResolvedValue({ id: "tx-deduction" });
  });

  it("returns ok and revalidates the dashboard when the deduction succeeds", async () => {
    await expect(
      deductPoints("target-1", "Missed team commitment"),
    ).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("deductPoints", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/points/deduct", "request-1", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "target-1",
        reason: "Missed team commitment",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("maps deduction cooldown failures to friendly typed results", async () => {
    const error = new ApiResponseError(
      409,
      "DEDUCTION_COOLDOWN_ACTIVE",
      "Points could not be deducted. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(
      deductPoints("target-1", "Missed team commitment"),
    ).resolves.toEqual({
      ok: false,
      code: "DEDUCTION_COOLDOWN_ACTIVE",
      message: "Your house has already deducted points in the last 24 hours.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "deductPoints", requestId: "request-1" },
      error,
      {
        targetUserId: "target-1",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected deduction failures for the shared action logger", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(
      deductPoints("target-1", "Missed team commitment"),
    ).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
