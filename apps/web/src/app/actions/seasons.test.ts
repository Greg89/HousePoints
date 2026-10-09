import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { getActorMappingForAdmin } from "./admin-auth";
import {
  discardSeasonPlan,
  kickoffSeason,
  readSeasonComparison,
  readSeasonPlanContext,
  renameSeason,
  saveSeasonPlan,
  startSeason,
  updateSeasonPlannedEnd,
} from "./seasons";

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
  organizationContexts: [],
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

describe("kickoffSeason", () => {
  beforeEach(() => {
    parseApiResponseMock.mockResolvedValue({
      previousSeason,
      activeSeason,
    });
  });

  it("validates, starts the prepared season, and revalidates the dashboard", async () => {
    const formData = new FormData();
    formData.set("expectedActiveSeasonId", "season-active");
    formData.set("expectedPlanVersion", "2");
    formData.set("idempotencyKey", "d9428888-122b-4b6f-a53d-9b7f3b234540");

    await expect(kickoffSeason(formData)).resolves.toEqual({
      ok: true,
      transition: { previousSeason, activeSeason },
    });

    expect(getActorMappingForAdminMock).toHaveBeenCalledWith("kickoffSeason", "request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/seasons/kickoff", "request-1", {
      method: "POST",
      body: JSON.stringify({
        expectedActiveSeasonId: "season-active",
        expectedPlanVersion: 2,
        idempotencyKey: "d9428888-122b-4b6f-a53d-9b7f3b234540",
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("returns invalid kickoff metadata without calling the API", async () => {
    const formData = new FormData();
    formData.set("expectedActiveSeasonId", "season-active");
    formData.set("expectedPlanVersion", "2");
    formData.set("idempotencyKey", "invalid");

    await expect(kickoffSeason(formData)).resolves.toMatchObject({
      ok: false,
      code: "SEASON_KICKOFF_INVALID",
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

describe("readSeasonComparison", () => {
  const comparison = {
    fromSeason: previousSeason,
    toSeason: activeSeason,
    houses: [],
  };

  beforeEach(() => {
    parseApiResponseMock.mockResolvedValue(comparison);
  });

  it("loads a season comparison for the authenticated user", async () => {
    await expect(
      readSeasonComparison("season-current", "season-next", "request-2"),
    ).resolves.toEqual(comparison);

    expect(getCurrentUserForRequestMock).toHaveBeenCalledWith("request-2");
    expect(apiFetchMock).toHaveBeenCalledWith("/seasons/compare", "request-2", {
      method: "POST",
      body: JSON.stringify({
        fromSeasonId: "season-current",
        toSeasonId: "season-next",
      }),
    });
    expect(parseApiResponseMock).toHaveBeenCalledWith(
      expect.any(Response),
      expect.any(Object),
      "Season comparison could not be loaded. Please try again.",
    );
  });

  it("rethrows comparison load failures", async () => {
    parseApiResponseMock.mockRejectedValue(new Error("comparison failed"));

    await expect(
      readSeasonComparison("season-current", "season-next", "request-2"),
    ).rejects.toThrow("comparison failed");
  });
});

describe("season planning actions", () => {
  const plan = {
    id: "plan-1",
    name: "Winter 2027",
    kickoffMessage: "Welcome.",
    plannedStartsAt: "2027-01-01T14:00:00.000Z",
    plannedEndsAt: "2027-03-31T13:00:00.000Z",
    timezone: "America/New_York",
    version: 1,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  };

  it("loads the plan and readiness through the authenticated API", async () => {
    const context = {
      activeSeason,
      plan,
      activeCategoryCount: 20,
      houseCount: 4,
      unassignedMemberCount: 1,
    };
    parseApiResponseMock.mockResolvedValue(context);

    await expect(readSeasonPlanContext("request-plan")).resolves.toEqual(context);
    expect(getCurrentUserForRequestMock).toHaveBeenCalledWith("request-plan");
    expect(apiFetchMock).toHaveBeenCalledWith("/seasons/plan-context", "request-plan", {
      method: "POST",
      body: JSON.stringify({}),
    });
  });

  it("validates plan input and persists it through the owner action", async () => {
    parseApiResponseMock.mockResolvedValue(plan);
    const formData = new FormData();
    formData.set("expectedVersion", "0");
    formData.set("name", " Winter 2027 ");
    formData.set("kickoffMessage", " Welcome. ");
    formData.set("plannedStartsAt", plan.plannedStartsAt);
    formData.set("plannedEndsAt", plan.plannedEndsAt);
    formData.set("timezone", "America/New_York");

    await expect(saveSeasonPlan(formData)).resolves.toEqual({ ok: true, plan });
    expect(getActorMappingForAdminMock).toHaveBeenCalledWith("saveSeasonPlan", "request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/seasons/plan", "request-1", {
      method: "POST",
      body: JSON.stringify({
        expectedVersion: 0,
        name: "Winter 2027",
        kickoffMessage: "Welcome.",
        plannedStartsAt: plan.plannedStartsAt,
        plannedEndsAt: plan.plannedEndsAt,
        timezone: "America/New_York",
      }),
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/");
  });

  it("does not call the API for invalid plan input", async () => {
    const formData = new FormData();
    formData.set("expectedVersion", "0");
    formData.set("name", "x");
    formData.set("timezone", "UTC");

    await expect(saveSeasonPlan(formData)).resolves.toMatchObject({
      ok: false,
      code: "SEASON_PLAN_INVALID",
    });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("discards plans using the expected version", async () => {
    parseApiResponseMock.mockResolvedValue({ discarded: true });
    const formData = new FormData();
    formData.set("expectedVersion", "3");

    await expect(discardSeasonPlan(formData)).resolves.toEqual({ ok: true });
    expect(apiFetchMock).toHaveBeenCalledWith("/seasons/plan/discard", "request-1", {
      method: "POST",
      body: JSON.stringify({ expectedVersion: 3 }),
    });
  });

  it("saves a planned end against the active season ID", async () => {
    parseApiResponseMock.mockResolvedValue({
      ...activeSeason,
      plannedEndsAt: "2026-12-31T15:00:00.000Z",
      timezone: "America/New_York",
    });
    const formData = new FormData();
    formData.set("seasonId", activeSeason.id);
    formData.set("plannedEndsAt", "2026-12-31T15:00:00.000Z");
    formData.set("timezone", "America/New_York");

    await expect(updateSeasonPlannedEnd(formData)).resolves.toMatchObject({ ok: true });
    expect(apiFetchMock).toHaveBeenCalledWith("/seasons/planned-end", "request-1", {
      method: "POST",
      body: JSON.stringify({
        seasonId: activeSeason.id,
        plannedEndsAt: "2026-12-31T15:00:00.000Z",
        timezone: "America/New_York",
      }),
    });
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
