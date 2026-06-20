import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { createInviteLink } from "./admin";

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
const runServerActionMock = vi.mocked(runServerAction);

describe("createInviteLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserForRequestMock.mockResolvedValue({
      id: "user-1",
      auth0Sub: "auth0|user-1",
      email: "user@example.com",
      displayName: "User One",
      role: "OWNER",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      created: false,
    });
    apiFetchMock.mockResolvedValue(Response.json({
      token: "invite-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    }));
    parseApiResponseMock.mockResolvedValue({
      token: "invite-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
  });

  it("returns the invite token result when generation succeeds", async () => {
    await expect(createInviteLink()).resolves.toEqual({
      ok: true,
      token: "invite-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
    });

    expect(runServerActionMock).toHaveBeenCalledWith("createInviteLink", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/orgs/invite", "request-1", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      403,
      "ADMIN_REQUIRED",
      "An invite could not be generated. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(createInviteLink()).resolves.toEqual({
      ok: false,
      code: "ADMIN_REQUIRED",
      message: "An invite could not be generated. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "createInviteLink", requestId: "request-1" },
      error,
      {
        actorUserId: "user-1",
        organizationId: "org-1",
      },
    );
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(createInviteLink()).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
  });
});
