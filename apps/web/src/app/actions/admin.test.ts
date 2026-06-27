import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { assignUserHouse, createHouse, createInviteLink, deletePointTransaction, promoteUserRole } from "./admin";
import { getActorMappingForAdmin } from "./admin-auth";

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

vi.mock("./admin-auth", () => ({
  getActorMappingForAdmin: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);
const getActorMappingForAdminMock = vi.mocked(getActorMappingForAdmin);
const getCurrentUserForRequestMock = vi.mocked(getCurrentUserForRequest);
const logServerActionFailedMock = vi.mocked(logServerActionFailed);
const parseApiResponseMock = vi.mocked(parseApiResponse);
const revalidatePathMock = vi.mocked(revalidatePath);
const runServerActionMock = vi.mocked(runServerAction);

const actor = {
  id: "user-1",
  auth0Sub: "auth0|user-1",
  email: "user@example.com",
  displayName: "User One",
  houseThemeEnabled: false,
  role: "OWNER" as const,
  organizationId: "org-1",
  organizationSlug: "acme",
  houseId: "house-1",
  houseName: "Slytherin",
  houseColor: "#22c55e",
  created: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  getActorMappingForAdminMock.mockResolvedValue(actor);
  getCurrentUserForRequestMock.mockResolvedValue(actor);
});

describe("createHouse", () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue(Response.json({
      id: "house-2",
      name: "Ravenclaw",
      color: "#1d4ed8",
      description: "Values wisdom.",
      score: 0,
      transactions: 0,
      memberCount: 0,
    }));
    parseApiResponseMock.mockResolvedValue({
      id: "house-2",
      name: "Ravenclaw",
      color: "#1d4ed8",
      description: "Values wisdom.",
      score: 0,
      transactions: 0,
      memberCount: 0,
    });
  });

  it("returns ok and revalidates the dashboard when house creation succeeds", async () => {
    const formData = new FormData();
    formData.set("name", " Ravenclaw ");
    formData.set("color", "#1d4ed8");
    formData.set("description", " Values wisdom. ");

    await expect(createHouse(formData)).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("createHouse", expect.any(Function));
    expect(getActorMappingForAdminMock).toHaveBeenCalledWith("createHouse", "request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/houses", "request-1", {
      method: "POST",
      body: JSON.stringify({
        name: "Ravenclaw",
        color: "#1d4ed8",
        description: "Values wisdom.",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    const formData = new FormData();
    formData.set("name", "   ");

    await expect(createHouse(formData)).resolves.toEqual({
      ok: false,
      code: "HOUSE_NAME_REQUIRED",
      message: "House name is required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const formData = new FormData();
    formData.set("name", "Ravenclaw");
    formData.set("color", "#1d4ed8");
    const error = new ApiResponseError(
      409,
      "HOUSE_ALREADY_EXISTS",
      "The house could not be created. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(createHouse(formData)).resolves.toEqual({
      ok: false,
      code: "HOUSE_ALREADY_EXISTS",
      message: "The house could not be created. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "createHouse", requestId: "request-1" },
      error,
      {
        actorUserId: "user-1",
        organizationId: "org-1",
        houseName: "Ravenclaw",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    const formData = new FormData();
    formData.set("name", "Ravenclaw");
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(createHouse(formData)).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("assignUserHouse", () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue(Response.json({
      id: "target-1",
      houseId: "house-2",
    }));
    parseApiResponseMock.mockResolvedValue({
      id: "target-1",
      houseId: "house-2",
    });
  });

  it("returns ok and revalidates the dashboard when assignment succeeds", async () => {
    const formData = new FormData();
    formData.set("targetUserId", "target-1");
    formData.set("targetHouseId", "house-2");

    await expect(assignUserHouse(formData)).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("assignUserHouse", expect.any(Function));
    expect(getActorMappingForAdminMock).toHaveBeenCalledWith("assignUserHouse", "request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/users/assign-house", "request-1", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "target-1",
        targetHouseId: "house-2",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    const formData = new FormData();
    formData.set("targetUserId", "target-1");

    await expect(assignUserHouse(formData)).resolves.toEqual({
      ok: false,
      code: "HOUSE_ASSIGNMENT_TARGET_REQUIRED",
      message: "Target user and house are required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const formData = new FormData();
    formData.set("targetUserId", "target-1");
    formData.set("targetHouseId", "house-2");
    const error = new ApiResponseError(
      404,
      "USER_NOT_FOUND",
      "The user could not be assigned to that house. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(assignUserHouse(formData)).resolves.toEqual({
      ok: false,
      code: "USER_NOT_FOUND",
      message: "The user could not be assigned to that house. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "assignUserHouse", requestId: "request-1" },
      error,
      {
        actorUserId: "user-1",
        organizationId: "org-1",
        targetUserId: "target-1",
        targetHouseId: "house-2",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    const formData = new FormData();
    formData.set("targetUserId", "target-1");
    formData.set("targetHouseId", "house-2");
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(assignUserHouse(formData)).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("promoteUserRole", () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue(Response.json({
      id: "target-1",
      displayName: "Target User",
      email: "target@example.com",
      role: "ADMIN",
      houseId: "house-1",
    }));
    parseApiResponseMock.mockResolvedValue({
      id: "target-1",
      displayName: "Target User",
      email: "target@example.com",
      role: "ADMIN",
      houseId: "house-1",
    });
  });

  it("returns ok and revalidates the dashboard when promotion succeeds", async () => {
    const formData = new FormData();
    formData.set("targetUserId", "target-1");
    formData.set("role", "ADMIN");

    await expect(promoteUserRole(formData)).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("promoteUserRole", expect.any(Function));
    expect(getActorMappingForAdminMock).toHaveBeenCalledWith("promoteUserRole", "request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/admin/users/role", "request-1", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "target-1",
        role: "ADMIN",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("submits member role changes for owner admin demotion", async () => {
    const formData = new FormData();
    formData.set("targetUserId", "target-1");
    formData.set("role", "MEMBER");

    await expect(promoteUserRole(formData)).resolves.toEqual({ ok: true });

    expect(apiFetchMock).toHaveBeenCalledWith("/admin/users/role", "request-1", {
      method: "POST",
      body: JSON.stringify({
        targetUserId: "target-1",
        role: "MEMBER",
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    const formData = new FormData();

    await expect(promoteUserRole(formData)).resolves.toEqual({
      ok: false,
      code: "ROLE_TARGET_REQUIRED",
      message: "A member is required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const formData = new FormData();
    formData.set("targetUserId", "target-1");
    formData.set("role", "ADMIN");
    const error = new ApiResponseError(
      403,
      "OWNER_REQUIRED",
      "The member role could not be updated. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(promoteUserRole(formData)).resolves.toEqual({
      ok: false,
      code: "OWNER_REQUIRED",
      message: "The member role could not be updated. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "promoteUserRole", requestId: "request-1" },
      error,
      {
        actorUserId: "user-1",
        organizationId: "org-1",
        targetUserId: "target-1",
        role: "ADMIN",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("createInviteLink", () => {
  beforeEach(() => {
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

describe("deletePointTransaction", () => {
  beforeEach(() => {
    apiFetchMock.mockResolvedValue(Response.json({
      id: "tx-1",
    }));
    parseApiResponseMock.mockResolvedValue({
      id: "tx-1",
      actorName: "Bob",
      targetUserName: "Alice",
      targetHouseName: "Phoenix",
      targetHouseColor: "#7c3aed",
      delta: 10,
      reason: "Great work",
      trait: "LEADERSHIP",
      createdAt: "2026-06-01T12:00:00.000Z",
      deletedAt: "2026-06-02T12:00:00.000Z",
      deletedByName: "User One",
      deletionReason: null,
      season: null,
    });
  });

  it("returns ok and revalidates the dashboard when point deletion succeeds", async () => {
    await expect(deletePointTransaction(" tx-1 ", " Duplicate award ")).resolves.toEqual({ ok: true });

    expect(runServerActionMock).toHaveBeenCalledWith("deletePointTransaction", expect.any(Function));
    expect(getActorMappingForAdminMock).toHaveBeenCalledWith("deletePointTransaction", "request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/points/delete", "request-1", {
      method: "POST",
      body: JSON.stringify({
        transactionId: "tx-1",
        reason: "Duplicate award",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    await expect(deletePointTransaction("   ")).resolves.toEqual({
      ok: false,
      code: "POINT_TRANSACTION_REQUIRED",
      message: "A point transaction is required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      404,
      "POINT_TRANSACTION_NOT_FOUND",
      "The point award could not be deleted. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(deletePointTransaction("tx-1")).resolves.toEqual({
      ok: false,
      code: "POINT_TRANSACTION_NOT_FOUND",
      message: "The point award could not be deleted. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "deletePointTransaction", requestId: "request-1" },
      error,
      {
        actorUserId: "user-1",
        organizationId: "org-1",
        transactionId: "tx-1",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(deletePointTransaction("tx-1")).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
