import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse, requireAuthenticatedApiContext } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { createOrg, joinOrg, previewInviteLink, readOrgRouteContext } from "./orgs";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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
    requireAuthenticatedApiContext: vi.fn(),
  };
});

const apiFetchMock = vi.mocked(apiFetch);
const logServerActionFailedMock = vi.mocked(logServerActionFailed);
const parseApiResponseMock = vi.mocked(parseApiResponse);
const requireAuthenticatedApiContextMock = vi.mocked(requireAuthenticatedApiContext);
const revalidatePathMock = vi.mocked(revalidatePath);
const runServerActionMock = vi.mocked(runServerAction);

const authContext = {
  user: {
    sub: "auth0|user-1",
    email: "user@example.com",
    name: "User One",
  },
  accessToken: "access-token",
};

const appUser = {
  id: "user-1",
  auth0Sub: "auth0|user-1",
  email: "user@example.com",
  displayName: "User One",
  houseThemeEnabled: false,
  role: "OWNER" as const,
  organizationId: "org-1",
  organizationSlug: "acme",
  houseId: "house-1",
  houseName: "Phoenix",
  houseColor: "#7c3aed",
  created: false,
};

describe("createOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedApiContextMock.mockResolvedValue(authContext);
    apiFetchMock.mockResolvedValue(Response.json(appUser));
    parseApiResponseMock.mockResolvedValue(appUser);
  });

  it("returns ok and revalidates the dashboard when org creation succeeds", async () => {
    await expect(
      createOrg(" Acme Corp ", " acme ", " Phoenix ", "#7c3aed"),
    ).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("createOrg", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/orgs/create", "request-1", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        displayName: "User One",
        orgName: "Acme Corp",
        orgSlug: "acme",
        firstHouseName: "Phoenix",
        firstHouseColor: "#7c3aed",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    await expect(
      createOrg("   ", "acme", "Phoenix", "#7c3aed"),
    ).resolves.toEqual({
      ok: false,
      code: "ORG_SETUP_REQUIRED",
      message: "Organisation name, slug, and first house are required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      409,
      "ORG_SLUG_TAKEN",
      "The organisation could not be created. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(
      createOrg("Acme Corp", "acme", "Phoenix", "#7c3aed"),
    ).resolves.toEqual({
      ok: false,
      code: "ORG_SLUG_TAKEN",
      message: "The organisation could not be created. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "createOrg", requestId: "request-1" },
      error,
      {
        orgSlug: "acme",
        firstHouseName: "Phoenix",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(
      createOrg("Acme Corp", "acme", "Phoenix", "#7c3aed"),
    ).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("readOrgRouteContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue(Response.json({
      status: "MATCH",
      requestedSlug: "acme",
      organizationSlug: "acme",
    }));
    parseApiResponseMock.mockResolvedValue({
      status: "MATCH",
      requestedSlug: "acme",
      organizationSlug: "acme",
    });
  });

  it("reads route context for a trimmed organization slug", async () => {
    await expect(readOrgRouteContext(" acme ", "request-2")).resolves.toEqual({
      status: "MATCH",
      requestedSlug: "acme",
      organizationSlug: "acme",
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/orgs/route-context", "request-2", {
      method: "POST",
      body: JSON.stringify({ slug: "acme" }),
    });
  });

  it("returns a local not-found context for empty slugs", async () => {
    await expect(readOrgRouteContext("   ", "request-2")).resolves.toEqual({
      status: "NOT_FOUND",
      requestedSlug: "",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(parseApiResponseMock).not.toHaveBeenCalled();
  });
});

describe("joinOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedApiContextMock.mockResolvedValue(authContext);
    apiFetchMock.mockResolvedValue(Response.json(appUser));
    parseApiResponseMock.mockResolvedValue(appUser);
  });

  it("returns ok and revalidates the dashboard when joining succeeds", async () => {
    await expect(joinOrg(" invite-token ")).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("joinOrg", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/orgs/join", "request-1", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        displayName: "User One",
        inviteToken: "invite-token",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("sends organization slug context when joining from a slugged invite link", async () => {
    await expect(joinOrg(" invite-token ", " acme ")).resolves.toEqual({ ok: true });

    expect(apiFetchMock).toHaveBeenCalledWith("/orgs/join", "request-1", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.com",
        displayName: "User One",
        inviteToken: "invite-token",
        organizationSlug: "acme",
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    await expect(joinOrg("   ")).resolves.toEqual({
      ok: false,
      code: "INVITE_TOKEN_REQUIRED",
      message: "Invite token is required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      404,
      "INVITE_NOT_FOUND",
      "The invite could not be joined. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(joinOrg("invite-token")).resolves.toEqual({
      ok: false,
      code: "INVITE_NOT_FOUND",
      message: "The invite could not be joined. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "joinOrg", requestId: "request-1" },
      error,
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(joinOrg("invite-token")).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("previewInviteLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAuthenticatedApiContextMock.mockResolvedValue(authContext);
    apiFetchMock.mockResolvedValue(Response.json({
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      membershipStatus: "NONE",
      memberOrganizationName: null,
      memberOrganizationSlug: null,
    }));
    parseApiResponseMock.mockResolvedValue({
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      membershipStatus: "NONE",
      memberOrganizationName: null,
      memberOrganizationSlug: null,
    });
  });

  it("returns organization context for a valid slugged invite link", async () => {
    await expect(previewInviteLink(" acme ", " invite-token ")).resolves.toEqual({
      ok: true,
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      membershipStatus: "NONE",
      memberOrganizationName: null,
      memberOrganizationSlug: null,
    });

    expect(runServerActionMock).toHaveBeenCalledWith("previewInviteLink", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/orgs/join/preview", "request-1", {
      method: "POST",
      body: JSON.stringify({
        inviteToken: "invite-token",
        organizationSlug: "acme",
      }),
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns validation failures without calling the API", async () => {
    await expect(previewInviteLink("acme", "   ")).resolves.toEqual({
      ok: false,
      code: "INVITE_LINK_REQUIRED",
      message: "Invite link is missing required information.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected preview failures as typed results", async () => {
    const error = new ApiResponseError(
      404,
      "INVITE_ORG_MISMATCH",
      "The invite link could not be loaded. Please ask for a new invite.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(previewInviteLink("acme", "invite-token")).resolves.toEqual({
      ok: false,
      code: "INVITE_ORG_MISMATCH",
      message: "The invite link could not be loaded. Please ask for a new invite.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "previewInviteLink", requestId: "request-1" },
      error,
      { organizationSlug: "acme" },
    );
  });
});
