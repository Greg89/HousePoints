import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { getActorMappingForAdmin } from "./admin-auth";
import { renameSeason, startSeason } from "./seasons";

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

vi.mock("@/lib/logging", () => ({
  logInfo: vi.fn(),
}));

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

const previousSeason = {
  id: "season-current",
  name: "Q3 2026",
  startsAt: "2026-07-01T00:00:00.000Z",
  endsAt: "2026-08-01T00:00:00.000Z",
  isActive: false,
};

const activeSeason = {
  id: "season-next",
  name: "Q4 2026",
  startsAt: "2026-08-01T00:00:00.000Z",
  endsAt: null,
  isActive: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  getActorMappingForAdminMock.mockResolvedValue(actor);
  getCurrentUserForRequestMock.mockResolvedValue(actor);
  apiFetchMock.mockResolvedValue(Response.json({}));
});

describe("startSeason", () => {
  beforeEach(() => {
    parseApiResponseMock.mockResolvedValue({
      previousSeason,
      activeSeason,
    });
  });

  it("returns the transition and revalidates the dashboard when season start succeeds", async () => {
    const formData = new FormData();
    formData.set("name", " Q4 2026 ");

    await expect(startSeason(formData)).resolves.toEqual({
      ok: true,
      transition: {
        previousSeason,
        activeSeason,
      },
    });

    expect(runServerActionMock).toHaveBeenCalledWith("startSeason", expect.any(Function));
    expect(getActorMappingForAdminMock).toHaveBeenCalledWith("startSeason", "request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/seasons/start", "request-1", {
      method: "POST",
      body: JSON.stringify({ name: "Q4 2026" }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    const formData = new FormData();
    formData.set("name", "   ");

    await expect(startSeason(formData)).resolves.toEqual({
      ok: false,
      code: "SEASON_NAME_REQUIRED",
      message: "Season name is required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const formData = new FormData();
    formData.set("name", "Q4 2026");
    const error = new ApiResponseError(
      409,
      "ACTIVE_SEASON_NOT_FOUND",
      "The season could not be started. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(startSeason(formData)).resolves.toEqual({
      ok: false,
      code: "ACTIVE_SEASON_NOT_FOUND",
      message: "The season could not be started. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "startSeason", requestId: "request-1" },
      error,
      {
        actorUserId: "user-1",
        organizationId: "org-1",
        name: "Q4 2026",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    const formData = new FormData();
    formData.set("name", "Q4 2026");
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(startSeason(formData)).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("renameSeason", () => {
  beforeEach(() => {
    parseApiResponseMock.mockResolvedValue({
      ...previousSeason,
      name: "Launch Season",
    });
  });

  it("returns the renamed season and revalidates the dashboard when rename succeeds", async () => {
    const formData = new FormData();
    formData.set("seasonId", " season-current ");
    formData.set("name", " Launch Season ");

    await expect(renameSeason(formData)).resolves.toEqual({
      ok: true,
      season: {
        ...previousSeason,
        name: "Launch Season",
      },
    });

    expect(runServerActionMock).toHaveBeenCalledWith("renameSeason", expect.any(Function));
    expect(getActorMappingForAdminMock).toHaveBeenCalledWith("renameSeason", "request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/seasons/rename", "request-1", {
      method: "POST",
      body: JSON.stringify({
        seasonId: "season-current",
        name: "Launch Season",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns validation failures as typed results without calling the API", async () => {
    const formData = new FormData();
    formData.set("seasonId", "season-current");
    formData.set("name", "   ");

    await expect(renameSeason(formData)).resolves.toEqual({
      ok: false,
      code: "SEASON_RENAME_TARGET_REQUIRED",
      message: "Season and name are required.",
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("logs and returns expected API failures as typed results", async () => {
    const formData = new FormData();
    formData.set("seasonId", "season-current");
    formData.set("name", "Launch Season");
    const error = new ApiResponseError(
      404,
      "SEASON_NOT_FOUND",
      "The season could not be renamed. Please try again.",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(renameSeason(formData)).resolves.toEqual({
      ok: false,
      code: "SEASON_NOT_FOUND",
      message: "The season could not be renamed. Please try again.",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "renameSeason", requestId: "request-1" },
      error,
      {
        actorUserId: "user-1",
        organizationId: "org-1",
        seasonId: "season-current",
      },
    );
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("rethrows unexpected failures for the shared action logger", async () => {
    const formData = new FormData();
    formData.set("seasonId", "season-current");
    formData.set("name", "Launch Season");
    parseApiResponseMock.mockRejectedValue(new Error("database vanished"));

    await expect(renameSeason(formData)).rejects.toThrow("database vanished");

    expect(logServerActionFailedMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});
