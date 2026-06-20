import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { updateDisplayName } from "./profile";

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

describe("updateDisplayName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserForRequestMock.mockResolvedValue({
      id: "user-1",
      auth0Sub: "auth0|user-1",
      email: "user@example.com",
      displayName: "User One",
      role: "MEMBER",
      organizationId: "org-1",
      organizationSlug: "acme",
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      created: false,
    });
    apiFetchMock.mockResolvedValue(Response.json({ id: "user-1", displayName: "Updated User" }));
    parseApiResponseMock.mockResolvedValue({ id: "user-1", displayName: "Updated User" });
  });

  it("returns ok and revalidates profile surfaces when the update succeeds", async () => {
    await expect(updateDisplayName("  Updated User  ")).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("updateDisplayName", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/users/profile", "request-1", {
      method: "POST",
      body: JSON.stringify({ displayName: "Updated User" }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    await expect(updateDisplayName("   ")).resolves.toEqual({
      ok: false,
      code: "INVALID_DISPLAY_NAME",
      message: "Display name must be between 1 and 120 characters.",
    });

    expect(getCurrentUserForRequestMock).not.toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      409,
      "DISPLAY_NAME_REJECTED",
      "Your display name could not be updated. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(updateDisplayName("Updated User")).resolves.toEqual({
      ok: false,
      code: "DISPLAY_NAME_REJECTED",
      message: "Your display name could not be updated. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "updateDisplayName", requestId: "request-1" },
      error,
      { displayNameLength: 12 },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(updateDisplayName("Updated User")).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
