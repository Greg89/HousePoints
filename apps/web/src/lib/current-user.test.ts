import type { AuthenticatedApiContext } from "@/lib/api-client";
import { createCurrentUserLoader } from "@/lib/current-user";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logging", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

const context = {
  user: {
    sub: "auth0|user-1",
    email: "alice@example.com",
    name: "Alice",
  },
  accessToken: "access-token",
} as AuthenticatedApiContext;

const appUser = {
  id: "user-1",
  auth0Sub: "auth0|user-1",
  email: "alice@example.com",
  displayName: "Alice",
  role: "MEMBER",
  organizationId: "org-1",
  organizationSlug: "example-org",
  houseId: "house-1",
  houseName: "Engineering",
  houseColor: "#7c3aed",
  created: false,
};

describe("createCurrentUserLoader", () => {
  const getContext = vi.fn();
  const request = vi.fn();
  const loadCurrentUser = createCurrentUserLoader({
    getContext,
    request,
    createRequestId: () => "request-123",
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getContext.mockResolvedValue(context);
  });

  it("bootstraps and validates the current user mapping", async () => {
    request.mockResolvedValue(Response.json(appUser));

    await expect(loadCurrentUser()).resolves.toEqual(appUser);
    expect(request).toHaveBeenCalledWith(
      "/users/bootstrap",
      "request-123",
      {
        method: "POST",
        body: JSON.stringify({
          email: "alice@example.com",
          displayName: "Alice",
        }),
      },
    );
  });

  it("uses a safe display name when Auth0 has no name claim", async () => {
    getContext.mockResolvedValue({
      ...context,
      user: { sub: "auth0|user-1", email: "alice@example.com" },
    });
    request.mockResolvedValue(Response.json(appUser));

    await loadCurrentUser();

    expect(JSON.parse(request.mock.calls[0][2].body)).toEqual({
      email: "alice@example.com",
      displayName: "Unknown User",
    });
  });

  it("rejects failed bootstrap responses without returning partial data", async () => {
    request.mockResolvedValue(
      new Response("service unavailable", { status: 503 }),
    );

    await expect(loadCurrentUser()).rejects.toThrow(
      "User mapping bootstrap failed with status 503",
    );
  });

  it("rejects API responses that do not match the shared user schema", async () => {
    request.mockResolvedValue(
      Response.json({ ...appUser, organizationId: 42 }),
    );

    await expect(loadCurrentUser()).rejects.toThrow();
  });
});
