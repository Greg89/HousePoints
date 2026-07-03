import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

vi.mock("./actor.js", () => ({
  getActorBySub: vi.fn(),
  isAdminRole: (role: string) => role === "ADMIN" || role === "OWNER",
  isOwnerRole: (role: string) => role === "OWNER",
}));

vi.mock("./logging.js", () => ({
  warn: vi.fn(),
}));

vi.mock("./season-scope.js", () => {
  class SeasonScopeError extends Error {
    constructor(
      readonly statusCode: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "SeasonScopeError";
    }
  }
  return {
    resolveSeasonScope: vi.fn(),
    SeasonScopeError,
  };
});

import { getActorBySub } from "./actor.js";
import { warn } from "./logging.js";
import { resolveSeasonScope, SeasonScopeError } from "./season-scope.js";
import {
  parseBody,
  requireActor,
  requireAdminActor,
  requireOwnerActor,
  resolveSeasonOrReject,
} from "./route-helpers.js";
import type { ActorRecord } from "./actor.js";

const mockGetActorBySub = getActorBySub as ReturnType<typeof vi.fn>;
const mockWarn = warn as ReturnType<typeof vi.fn>;
const mockResolveSeasonScope = resolveSeasonScope as ReturnType<typeof vi.fn>;

function makeReply() {
  const send = vi.fn().mockResolvedValue(undefined);
  const status = vi.fn().mockReturnValue({ send });
  return { reply: { status } as unknown as FastifyReply, send, status };
}

function makeRequest(body: unknown = {}, subject = "auth0|user-1") {
  return {
    body,
    auth: { subject },
    log: {},
  } as unknown as FastifyRequest;
}

const baseActor: ActorRecord = {
  id: "user-1",
  auth0Sub: "auth0|user-1",
  displayName: "Test User",
  role: "MEMBER",
  houseId: "house-1",
  organizationId: "org-1",
  organizationName: "Acme Corp",
  organizationSlug: "acme",
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("parseBody", () => {
  const schema = z.object({ name: z.string() });

  it("returns parsed data when the body matches the schema", async () => {
    const request = makeRequest({ name: "Alice" });
    const { reply } = makeReply();

    const result = await parseBody(schema, request, reply);

    expect(result).toEqual({ name: "Alice" });
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("sends 400 and returns null when the body is invalid", async () => {
    const request = makeRequest({ name: 42 });
    const { reply, status, send } = makeReply();

    const result = await parseBody(schema, request, reply);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(400);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "VALIDATION_ERROR" }),
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.anything(),
      "request.validation_failed",
      expect.objectContaining({ issues: expect.any(Array) }),
    );
  });
});

describe("requireActor", () => {
  it("returns the actor when the subject resolves to a mapped user", async () => {
    mockGetActorBySub.mockResolvedValue(baseActor);
    const request = makeRequest();
    const { reply } = makeReply();

    const result = await requireActor(request, reply);

    expect(result).toBe(baseActor);
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("sends 403 and returns null when the subject has no mapped actor", async () => {
    mockGetActorBySub.mockResolvedValue(null);
    const request = makeRequest();
    const { reply, status, send } = makeReply();

    const result = await requireActor(request, reply);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ACTOR_NOT_MAPPED" }),
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.anything(),
      "auth.actor_not_found",
      expect.anything(),
    );
  });
});

describe("requireAdminActor", () => {
  it("returns the actor for ADMIN role", async () => {
    mockGetActorBySub.mockResolvedValue({ ...baseActor, role: "ADMIN" });
    const request = makeRequest();
    const { reply } = makeReply();

    const result = await requireAdminActor(request, reply);

    expect(result).toMatchObject({ role: "ADMIN" });
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("returns the actor for OWNER role", async () => {
    mockGetActorBySub.mockResolvedValue({ ...baseActor, role: "OWNER" });
    const request = makeRequest();
    const { reply } = makeReply();

    const result = await requireAdminActor(request, reply);

    expect(result).toMatchObject({ role: "OWNER" });
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("sends 403 ADMIN_REQUIRED and returns null for MEMBER role", async () => {
    mockGetActorBySub.mockResolvedValue({ ...baseActor, role: "MEMBER" });
    const request = makeRequest();
    const { reply, status, send } = makeReply();

    const result = await requireAdminActor(request, reply);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ADMIN_REQUIRED" }),
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.anything(),
      "admin.forbidden",
      expect.anything(),
    );
  });

  it("returns null without double-responding when the actor is not found", async () => {
    mockGetActorBySub.mockResolvedValue(null);
    const request = makeRequest();
    const { reply, status } = makeReply();

    const result = await requireAdminActor(request, reply);

    expect(result).toBeNull();
    // reply.status called exactly once by requireActor, not a second time for the role check
    expect(status).toHaveBeenCalledTimes(1);
  });
});

describe("requireOwnerActor", () => {
  it("returns the actor for OWNER role", async () => {
    mockGetActorBySub.mockResolvedValue({ ...baseActor, role: "OWNER" });
    const request = makeRequest();
    const { reply } = makeReply();

    const result = await requireOwnerActor(request, reply);

    expect(result).toMatchObject({ role: "OWNER" });
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("sends 403 OWNER_REQUIRED and returns null for ADMIN role", async () => {
    mockGetActorBySub.mockResolvedValue({ ...baseActor, role: "ADMIN" });
    const request = makeRequest();
    const { reply, status, send } = makeReply();

    const result = await requireOwnerActor(request, reply);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "OWNER_REQUIRED" }),
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.anything(),
      "owner.forbidden",
      expect.anything(),
    );
  });

  it("sends 403 OWNER_REQUIRED and returns null for MEMBER role", async () => {
    mockGetActorBySub.mockResolvedValue({ ...baseActor, role: "MEMBER" });
    const request = makeRequest();
    const { reply, status, send } = makeReply();

    const result = await requireOwnerActor(request, reply);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(403);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "OWNER_REQUIRED" }),
    );
  });

  it("returns null without double-responding when the actor is not found", async () => {
    mockGetActorBySub.mockResolvedValue(null);
    const request = makeRequest();
    const { reply, status } = makeReply();

    const result = await requireOwnerActor(request, reply);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledTimes(1);
  });
});

describe("resolveSeasonOrReject", () => {
  const resolvedSeason = {
    id: "season-1",
    name: "Season 1",
    isActive: true,
    startsAt: new Date(),
    endsAt: null,
  };

  it("returns the resolved season on success", async () => {
    mockResolveSeasonScope.mockResolvedValue(resolvedSeason);
    const request = makeRequest();
    const { reply } = makeReply();

    const result = await resolveSeasonOrReject(baseActor, "season-1", request, reply);

    expect(result).toBe(resolvedSeason);
    expect(reply.status).not.toHaveBeenCalled();
  });

  it("sends 404, logs seasons.not_found, and returns null on SEASON_NOT_FOUND", async () => {
    mockResolveSeasonScope.mockRejectedValue(
      new SeasonScopeError(404, "SEASON_NOT_FOUND", "Season not found"),
    );
    const request = makeRequest();
    const { reply, status, send } = makeReply();

    const result = await resolveSeasonOrReject(baseActor, "season-missing", request, reply);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(404);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "SEASON_NOT_FOUND" }),
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.anything(),
      "seasons.not_found",
      expect.anything(),
    );
  });

  it("sends 409, logs seasons.active_missing, and returns null on ACTIVE_SEASON_REQUIRED", async () => {
    mockResolveSeasonScope.mockRejectedValue(
      new SeasonScopeError(409, "ACTIVE_SEASON_REQUIRED", "An active season is required"),
    );
    const request = makeRequest();
    const { reply, status, send } = makeReply();

    const result = await resolveSeasonOrReject(baseActor, undefined, request, reply);

    expect(result).toBeNull();
    expect(status).toHaveBeenCalledWith(409);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ACTIVE_SEASON_REQUIRED" }),
    );
    expect(mockWarn).toHaveBeenCalledWith(
      expect.anything(),
      "seasons.active_missing",
      expect.anything(),
    );
  });

  it("rethrows errors that are not SeasonScopeError", async () => {
    const unexpectedError = new Error("unexpected DB failure");
    mockResolveSeasonScope.mockRejectedValue(unexpectedError);
    const request = makeRequest();
    const { reply } = makeReply();

    await expect(
      resolveSeasonOrReject(baseActor, "season-1", request, reply),
    ).rejects.toThrow("unexpected DB failure");
  });
});
