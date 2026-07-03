import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiResponseError,
  apiFetch,
  getOptionalAuthenticatedApiContext,
  parseApiResponse,
} from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { readActiveOrganizationSlug } from "@/lib/active-organization";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { readSessionSummary, updateDisplayName, updateHouseThemePreference } from "./profile";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/current-user", () => ({
  getCurrentUserForRequest: vi.fn(),
}));

vi.mock("@/lib/active-organization", () => ({
  readActiveOrganizationSlug: vi.fn(),
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
    getOptionalAuthenticatedApiContext: vi.fn(),
    parseApiResponse: vi.fn(),
  };
});

const apiFetchMock = vi.mocked(apiFetch);
const readActiveOrganizationSlugMock = vi.mocked(readActiveOrganizationSlug);
const getCurrentUserForRequestMock = vi.mocked(getCurrentUserForRequest);
const getOptionalAuthenticatedApiContextMock = vi.mocked(getOptionalAuthenticatedApiContext);
const logServerActionFailedMock = vi.mocked(logServerActionFailed);
const parseApiResponseMock = vi.mocked(parseApiResponse);
const revalidatePathMock = vi.mocked(revalidatePath);
const runServerActionMock = vi.mocked(runServerAction);

const currentUser = {
  id: "user-1",
  auth0Sub: "auth0|user-1",
  email: "user@example.com",
  displayName: "User One",
  houseThemeEnabled: false,
  role: "MEMBER" as const,
  organizationId: "org-1",
  organizationSlug: "acme",
  houseId: "house-1",
  houseName: "Slytherin",
  houseColor: "#22c55e",
  organizationContexts: [
    {
      organizationId: "org-1",
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      role: "MEMBER" as const,
      houseId: "house-1",
      houseName: "Slytherin",
      houseColor: "#22c55e",
      isCurrent: true,
    },
    {
      organizationId: "org-2",
      organizationName: "Beta Org",
      organizationSlug: "beta",
      role: "ADMIN" as const,
      houseId: null,
      houseName: null,
      houseColor: null,
      isCurrent: false,
    },
  ],
  created: false,
};

describe("readSessionSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readActiveOrganizationSlugMock.mockResolvedValue(null);
  });

  it("returns unauthenticated state without loading the app user", async () => {
    getOptionalAuthenticatedApiContextMock.mockResolvedValue(null);

    await expect(readSessionSummary("request-1")).resolves.toEqual({
      isAuthenticated: false,
    });

    expect(getCurrentUserForRequestMock).not.toHaveBeenCalled();
  });

  it("includes active organization contexts from the app user mapping", async () => {
    getOptionalAuthenticatedApiContextMock.mockResolvedValue({
      user: {
        sub: "auth0|user-1",
        email: "stale@example.com",
        name: "Stale Token Name",
      },
      accessToken: "access-token",
    });
    getCurrentUserForRequestMock.mockResolvedValue(currentUser);

    await expect(readSessionSummary("request-1")).resolves.toMatchObject({
      isAuthenticated: true,
      userName: "User One",
      userEmail: "stale@example.com",
      userSub: "auth0|user-1",
      appUserId: "user-1",
      organizationId: "org-1",
      organizationSlug: "acme",
      organizationContexts: currentUser.organizationContexts,
      needsOrg: false,
      needsHouseAssignment: false,
    });
  });

  it("derives the active session organization from membership contexts before legacy fields", async () => {
    getOptionalAuthenticatedApiContextMock.mockResolvedValue({
      user: {
        sub: "auth0|user-1",
        email: "stale@example.com",
        name: "Stale Token Name",
      },
      accessToken: "access-token",
    });
    getCurrentUserForRequestMock.mockResolvedValue({
      ...currentUser,
      role: "MEMBER",
      organizationId: null,
      organizationSlug: null,
      houseId: null,
      houseName: null,
      houseColor: null,
      organizationContexts: [
        {
          organizationId: "org-2",
          organizationName: "Beta Org",
          organizationSlug: "beta",
          role: "ADMIN",
          houseId: "house-2",
          houseName: "Ravenclaw",
          houseColor: "#2563eb",
          isCurrent: true,
        },
      ],
    });

    await expect(readSessionSummary("request-1")).resolves.toMatchObject({
      organizationId: "org-2",
      organizationSlug: "beta",
      houseId: "house-2",
      houseName: "Ravenclaw",
      houseColor: "#2563eb",
      role: "ADMIN",
      needsOrg: false,
      needsHouseAssignment: false,
    });
  });

  it("prefers the selected organization cookie over the current membership flag", async () => {
    readActiveOrganizationSlugMock.mockResolvedValue("beta");
    getOptionalAuthenticatedApiContextMock.mockResolvedValue({
      user: {
        sub: "auth0|user-1",
        email: "stale@example.com",
        name: "Stale Token Name",
      },
      accessToken: "access-token",
    });
    getCurrentUserForRequestMock.mockResolvedValue(currentUser);

    await expect(readSessionSummary("request-1")).resolves.toMatchObject({
      organizationId: "org-2",
      organizationSlug: "beta",
      houseId: null,
      role: "ADMIN",
      needsHouseAssignment: true,
    });
  });
});

describe("updateDisplayName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readActiveOrganizationSlugMock.mockResolvedValue(null);
    getCurrentUserForRequestMock.mockResolvedValue(currentUser);
    apiFetchMock.mockResolvedValue(Response.json({ id: "user-1", displayName: "Updated User", houseThemeEnabled: false }));
    parseApiResponseMock.mockResolvedValue({ id: "user-1", displayName: "Updated User", houseThemeEnabled: false });
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

describe("updateHouseThemePreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserForRequestMock.mockResolvedValue(currentUser);
    apiFetchMock.mockResolvedValue(Response.json({ id: "user-1", displayName: "User One", houseThemeEnabled: true }));
    parseApiResponseMock.mockResolvedValue({ id: "user-1", displayName: "User One", houseThemeEnabled: true });
  });

  it("persists the house theme preference and revalidates profile surfaces", async () => {
    await expect(updateHouseThemePreference(true)).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("updateHouseThemePreference", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/users/profile", "request-1", {
      method: "POST",
      body: JSON.stringify({ houseThemeEnabled: true }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
    expect(revalidatePathMock).toHaveBeenCalledWith("/settings");
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      409,
      "HOUSE_THEME_REJECTED",
      "Your house theme preference could not be updated. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(updateHouseThemePreference(false)).resolves.toEqual({
      ok: false,
      code: "HOUSE_THEME_REJECTED",
      message: "Your house theme preference could not be updated. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "updateHouseThemePreference", requestId: "request-1" },
      error,
      { houseThemeEnabled: false },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
