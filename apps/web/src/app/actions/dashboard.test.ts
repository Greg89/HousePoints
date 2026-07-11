import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch, parseApiResponse } from "@/lib/api-client";
import { logServerActionFailed, runServerAction } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { reactToPointTransaction, readPointReactionDetails } from "./dashboard";

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

describe("reactToPointTransaction", () => {
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
      organizationContexts: [],
      created: false,
    });
    apiFetchMock.mockResolvedValue(Response.json({}));
    parseApiResponseMock.mockResolvedValue({
      transactionId: "tx-1",
      myReactionKey: "heart",
      reactions: [{ reactionKey: "heart", count: 1 }],
    });
  });

  it("posts the reaction mutation and returns the parsed reaction summary", async () => {
    await expect(reactToPointTransaction(" tx-1 ", "heart")).resolves.toEqual({
      ok: true,
      reaction: {
        transactionId: "tx-1",
        myReactionKey: "heart",
        reactions: [{ reactionKey: "heart", count: 1 }],
      },
    });

    expect(runServerActionMock).toHaveBeenCalledWith("reactToPointTransaction", expect.any(Function));
    expect(getCurrentUserForRequestMock).toHaveBeenCalledWith("request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/transactions/react", "request-1", {
      method: "POST",
      body: JSON.stringify({
        transactionId: "tx-1",
        reactionKey: "heart",
      }),
    });
    expect(logServerActionFailedMock).not.toHaveBeenCalled();
  });

  it("sends null to remove a reaction", async () => {
    parseApiResponseMock.mockResolvedValue({
      transactionId: "tx-1",
      myReactionKey: null,
      reactions: [],
    });

    await expect(reactToPointTransaction("tx-1", null)).resolves.toEqual({
      ok: true,
      reaction: {
        transactionId: "tx-1",
        myReactionKey: null,
        reactions: [],
      },
    });

    expect(apiFetchMock).toHaveBeenCalledWith("/transactions/react", "request-1", {
      method: "POST",
      body: JSON.stringify({
        transactionId: "tx-1",
        reactionKey: null,
      }),
    });
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      404,
      "POINT_TRANSACTION_NOT_FOUND",
      "Point transaction was not found",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(reactToPointTransaction("tx-1", "clap")).resolves.toEqual({
      ok: false,
      code: "POINT_TRANSACTION_NOT_FOUND",
      message: "Point transaction was not found",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "reactToPointTransaction", requestId: "request-1" },
      error,
      {
        transactionId: "tx-1",
        reactionKey: "clap",
      },
    );
  });

  it("returns a validation result before calling the API when transaction id is blank", async () => {
    await expect(reactToPointTransaction("   ", "clap")).resolves.toEqual({
      ok: false,
      code: "POINT_TRANSACTION_REQUIRED",
      message: "Point transaction is required.",
    });

    expect(getCurrentUserForRequestMock).not.toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});

describe("readPointReactionDetails", () => {
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
      organizationContexts: [],
      created: false,
    });
    apiFetchMock.mockResolvedValue(Response.json({}));
    parseApiResponseMock.mockResolvedValue({
      transactionId: "tx-1",
      reactions: [
        {
          id: "reaction-1",
          reactionKey: "party",
          actorUserId: "user-2",
          actorName: "Caitlin Swanson",
          createdAt: "2026-06-25T12:00:00.000Z",
          updatedAt: "2026-06-25T12:05:00.000Z",
        },
      ],
    });
  });

  it("posts the detail request and returns parsed reaction details", async () => {
    await expect(readPointReactionDetails(" tx-1 ")).resolves.toEqual({
      ok: true,
      details: {
        transactionId: "tx-1",
        reactions: [
          {
            id: "reaction-1",
            reactionKey: "party",
            actorUserId: "user-2",
            actorName: "Caitlin Swanson",
            createdAt: "2026-06-25T12:00:00.000Z",
            updatedAt: "2026-06-25T12:05:00.000Z",
          },
        ],
      },
    });

    expect(runServerActionMock).toHaveBeenCalledWith("readPointReactionDetails", expect.any(Function));
    expect(getCurrentUserForRequestMock).toHaveBeenCalledWith("request-1");
    expect(apiFetchMock).toHaveBeenCalledWith("/transactions/reactions", "request-1", {
      method: "POST",
      body: JSON.stringify({ transactionId: "tx-1" }),
    });
  });

  it("logs and returns expected API failures as typed results", async () => {
    const error = new ApiResponseError(
      404,
      "POINT_TRANSACTION_NOT_FOUND",
      "Point transaction was not found",
    );
    parseApiResponseMock.mockRejectedValue(error);

    await expect(readPointReactionDetails("tx-1")).resolves.toEqual({
      ok: false,
      code: "POINT_TRANSACTION_NOT_FOUND",
      message: "Point transaction was not found",
    });

    expect(logServerActionFailedMock).toHaveBeenCalledWith(
      { action: "readPointReactionDetails", requestId: "request-1" },
      error,
      { transactionId: "tx-1" },
    );
  });

  it("returns a validation result before calling the API when transaction id is blank", async () => {
    await expect(readPointReactionDetails("   ")).resolves.toEqual({
      ok: false,
      code: "POINT_TRANSACTION_REQUIRED",
      message: "Point transaction is required.",
    });

    expect(getCurrentUserForRequestMock).not.toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
