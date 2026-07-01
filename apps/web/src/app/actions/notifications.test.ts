import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import {
  markAllNotificationsRead,
  markNotificationRead,
  readNotifications,
} from "./notifications";

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

const actor = {
  id: "user-1",
  auth0Sub: "auth0|user-1",
  email: "user@example.com",
  displayName: "User One",
  houseThemeEnabled: false,
  role: "ADMIN" as const,
  organizationId: "org-1",
  organizationSlug: "acme",
  houseId: "house-1",
  houseName: "Slytherin",
  houseColor: "#22c55e",
  created: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserForRequestMock.mockResolvedValue(actor);
  apiFetchMock.mockResolvedValue(Response.json({}));
});

describe("readNotifications", () => {
  it("loads the current actor's notifications", async () => {
    const page = { items: [], unreadCount: 0, nextCursor: null };
    parseApiResponseMock.mockResolvedValue(page);

    await expect(readNotifications("request-2")).resolves.toEqual(page);

    expect(getCurrentUserForRequestMock).toHaveBeenCalledWith("request-2");
    expect(apiFetchMock).toHaveBeenCalledWith("/notifications/list", "request-2", {
      method: "POST",
      body: JSON.stringify({ limit: 10 }),
    });
    expect(parseApiResponseMock).toHaveBeenCalledWith(
      expect.any(Response),
      expect.any(Object),
      "Notifications could not be loaded. Please try again.",
    );
  });
});

describe("markNotificationRead", () => {
  beforeEach(() => {
    parseApiResponseMock.mockResolvedValue({ updatedCount: 1 });
  });

  it("marks one notification read and revalidates dashboard data", async () => {
    await expect(markNotificationRead(" notification-1 ")).resolves.toEqual({
      ok: true,
      updatedCount: 1,
    });

    expect(runServerActionMock).toHaveBeenCalledWith("markNotificationRead", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/notifications/mark-read", "request-1", {
      method: "POST",
      body: JSON.stringify({ notificationIds: ["notification-1"] }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures without calling the API", async () => {
    await expect(markNotificationRead("  ")).resolves.toEqual({
      ok: false,
      code: "NOTIFICATION_REQUIRED",
      message: "A notification is required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      403,
      "NOTIFICATION_FORBIDDEN",
      "The notification could not be marked read. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(markNotificationRead("notification-1")).resolves.toEqual({
      ok: false,
      code: "NOTIFICATION_FORBIDDEN",
      message: "The notification could not be marked read. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "markNotificationRead", requestId: "request-1" },
      error,
      { notificationId: "notification-1" },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("markAllNotificationsRead", () => {
  beforeEach(() => {
    parseApiResponseMock.mockResolvedValue({ updatedCount: 3 });
  });

  it("marks all notifications read and revalidates dashboard data", async () => {
    await expect(markAllNotificationsRead()).resolves.toEqual({
      ok: true,
      updatedCount: 3,
    });

    expect(runServerActionMock).toHaveBeenCalledWith("markAllNotificationsRead", expect.any(Function));
    expect(apiFetchMock).toHaveBeenCalledWith("/notifications/mark-all-read", "request-1", {
      method: "POST",
      body: JSON.stringify({}),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });
});
