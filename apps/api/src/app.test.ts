/**
 * API integration tests using Fastify's app.inject() â€” no real network or DB.
 * Prisma is mocked per test so we control exactly what the DB "returns".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// â”€â”€ Mock @housepoints/db before importing anything that uses it â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vi.mock("@housepoints/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    organization: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    authIdentity: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    house: {
      upsert: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    orgInvite: {
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    season: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    pointTransaction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// â”€â”€ Also mock dotenv/config (no .env file needed in CI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vi.mock("dotenv/config", () => ({}));

import { buildApp } from "./app";
import { prisma } from "@housepoints/db";

// Typed shorthand helpers
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUserFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>;
const mockCreate = prisma.user.create as ReturnType<typeof vi.fn>;
const mockUserUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const mockAuthIdentityFindUnique = prisma.authIdentity.findUnique as ReturnType<typeof vi.fn>;
const mockAuthIdentityCreate = prisma.authIdentity.create as ReturnType<typeof vi.fn>;
const mockOrgUpsert = prisma.organization.upsert as ReturnType<typeof vi.fn>;
const mockOrgFindUnique = prisma.organization.findUnique as ReturnType<typeof vi.fn>;
const mockOrgCreate = prisma.organization.create as ReturnType<typeof vi.fn>;
const mockHouseUpsert = prisma.house.upsert as ReturnType<typeof vi.fn>;
const mockHouseCreate = prisma.house.create as ReturnType<typeof vi.fn>;
const mockHouseFindMany = prisma.house.findMany as ReturnType<typeof vi.fn>;
const mockHouseFindUnique = prisma.house.findUnique as ReturnType<typeof vi.fn>;
const mockInviteCreate = prisma.orgInvite.create as ReturnType<typeof vi.fn>;
const mockInviteCount = prisma.orgInvite.count as ReturnType<typeof vi.fn>;
const mockInviteFindMany = prisma.orgInvite.findMany as ReturnType<typeof vi.fn>;
const mockInviteFindUnique = prisma.orgInvite.findUnique as ReturnType<typeof vi.fn>;
const mockInviteUpdateMany = prisma.orgInvite.updateMany as ReturnType<typeof vi.fn>;
const mockAuditEventCreate = prisma.auditEvent.create as ReturnType<typeof vi.fn>;
const mockAuditEventFindMany = prisma.auditEvent.findMany as ReturnType<typeof vi.fn>;
const mockSeasonFindFirst = prisma.season.findFirst as ReturnType<typeof vi.fn>;
const mockSeasonFindMany = prisma.season.findMany as ReturnType<typeof vi.fn>;
const mockSeasonCreate = prisma.season.create as ReturnType<typeof vi.fn>;
const mockSeasonUpdate = prisma.season.update as ReturnType<typeof vi.fn>;
const mockTxCreate = prisma.pointTransaction.create as ReturnType<typeof vi.fn>;
const mockTxFindUnique = prisma.pointTransaction.findUnique as ReturnType<typeof vi.fn>;
const mockTxFindFirst = prisma.pointTransaction.findFirst as ReturnType<typeof vi.fn>;
const mockTxFindMany = prisma.pointTransaction.findMany as ReturnType<typeof vi.fn>;
const mockTxGroupBy = prisma.pointTransaction.groupBy as ReturnType<typeof vi.fn>;
const mockTxUpdate = prisma.pointTransaction.update as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const TEST_CORS_ORIGINS = ["http://localhost:3000"];

// â”€â”€ Shared fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ORG = { id: "org-1", slug: "acme", name: "Acme Corp" };
const HOUSE = { id: "house-1", name: "Phoenix", color: "#7c3aed", description: null, organizationId: "org-1" };
const ACTIVE_SEASON = {
  id: "season-active",
  name: "Q3 2026",
  startsAt: new Date("2026-07-01T00:00:00.000Z"),
  endsAt: null,
  isActive: true,
};
const SEASON_ZERO = {
  id: "season-0",
  name: "Season 0",
  startsAt: new Date("2026-06-01T00:00:00.000Z"),
  endsAt: new Date("2026-07-01T00:00:00.000Z"),
  isActive: false,
};

/** Full user shape returned by prisma.user.findUnique (matches select in app.ts) */
const makeMember = (overrides = {}) => ({
  id: "user-1",
  auth0Sub: "auth0|member",
  email: "member@acme.com",
  displayName: "Alice",
  houseThemeEnabled: false,
  role: "MEMBER" as const,
  houseId: "house-1",
  organizationId: "org-1",
  organization: { slug: "acme" },
  house: { name: "Phoenix", color: "#7c3aed" },
  ...overrides,
});

const makeAdmin = (overrides = {}) => ({
  id: "user-2",
  auth0Sub: "auth0|admin",
  email: "admin@acme.com",
  displayName: "Bob",
  houseThemeEnabled: false,
  role: "ADMIN" as const,
  houseId: "house-1",
  organizationId: "org-1",
  organization: { slug: "acme" },
  house: { name: "Phoenix", color: "#7c3aed" },
  ...overrides,
});

const makeOwner = (overrides = {}) => ({
  ...makeAdmin(),
  id: "user-owner",
  auth0Sub: "auth0|owner",
  displayName: "Olivia",
  role: "OWNER" as const,
  ...overrides,
});

// Reset all mock implementations before each test to ensure isolation
beforeEach(() => {
  vi.resetAllMocks();
  mockTxFindMany.mockResolvedValue([]);
  mockTxFindFirst.mockResolvedValue(null);
  mockTxGroupBy.mockResolvedValue([]);
  mockInviteCount.mockResolvedValue(0);
  mockInviteFindMany.mockResolvedValue([]);
  mockSeasonFindMany.mockResolvedValue([]);
  mockAuditEventFindMany.mockResolvedValue([]);
  mockAuditEventCreate.mockResolvedValue({});
  mockTransaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );
});

async function buildTestApp(
  subject = "auth0|member",
  claims: Record<string, unknown> = {},
  options: {
    idTokenSubject?: string;
    idTokenClaims?: Record<string, unknown>;
  } = {},
) {
  const app = await buildApp({
    corsAllowedOrigins: TEST_CORS_ORIGINS,
    pointAdjustmentsEnabled: true,
    verifyAccessToken: vi.fn().mockResolvedValue({
      subject,
      claims: { sub: subject, ...claims },
    }),
    verifyIdToken: options.idTokenClaims
      ? vi.fn().mockResolvedValue({
          subject: options.idTokenSubject ?? subject,
          claims: {
            sub: options.idTokenSubject ?? subject,
            ...options.idTokenClaims,
          },
        })
      : null,
  });

  app.addHook("onRequest", async (request) => {
    request.headers.authorization ??= "Bearer test-token";
  });

  return app;
}

// â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("GET /health", () => {
  it("returns 200 { ok: true }", async () => {
    const app = await buildTestApp();
    expect(app.server.listening).toBe(false);

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(app.server.listening).toBe(false);
    await app.close();
  });
});

describe("API authentication", () => {
  it("keeps the health endpoint public", async () => {
    const verifyAccessToken = vi.fn();
    const app = await buildApp({
      corsAllowedOrigins: TEST_CORS_ORIGINS,
      verifyAccessToken,
    });

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects a protected endpoint without a bearer token", async () => {
    const app = await buildApp({
      corsAllowedOrigins: TEST_CORS_ORIGINS,
      verifyAccessToken: vi.fn(),
    });

    const res = await app.inject({
      method: "POST",
      url: "/members",
      payload: { actorAuth0Sub: "auth0|member" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("AUTHENTICATION_REQUIRED");
    await app.close();
  });

  it("rejects an invalid bearer token", async () => {
    const app = await buildApp({
      corsAllowedOrigins: TEST_CORS_ORIGINS,
      verifyAccessToken: vi.fn().mockRejectedValue(new Error("invalid token")),
    });

    const res = await app.inject({
      method: "POST",
      url: "/members",
      headers: { authorization: "Bearer invalid" },
      payload: { actorAuth0Sub: "auth0|member" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe("INVALID_ACCESS_TOKEN");
    await app.close();
  });

  it("rejects caller-supplied identity fields", async () => {
    const app = await buildApp({
      corsAllowedOrigins: TEST_CORS_ORIGINS,
      verifyAccessToken: vi.fn().mockResolvedValue({
        subject: "auth0|member",
        claims: { sub: "auth0|member" },
      }),
    });

    const res = await app.inject({
      method: "POST",
      url: "/members",
      headers: { authorization: "Bearer valid" },
      payload: { actorAuth0Sub: "auth0|admin" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("allows a valid token whose subject matches the request identity", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const verifyAccessToken = vi.fn().mockResolvedValue({
      subject: "auth0|member",
      claims: { sub: "auth0|member" },
    });
    const app = await buildApp({
      corsAllowedOrigins: TEST_CORS_ORIGINS,
      verifyAccessToken,
    });

    const res = await app.inject({
      method: "POST",
      url: "/members",
      headers: { authorization: "Bearer valid" },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
    expect(verifyAccessToken).toHaveBeenCalledWith("valid");
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { auth0Sub: "auth0|member" } }),
    );
    await app.close();
  });
});

describe("CORS", () => {
  it("allows configured browser origins", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "OPTIONS",
      url: "/members",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
        "access-control-request-headers":
          "authorization,content-type,x-request-id",
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-allow-headers"]).toBe(
      "authorization, content-type, x-request-id, x-auth0-id-token",
    );
    await app.close();
  });

  it("does not grant CORS access to unconfigured origins", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "OPTIONS",
      url: "/members",
      headers: {
        origin: "https://attacker.example",
        "access-control-request-method": "POST",
      },
    });

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });

  it("allows non-browser requests without adding CORS headers", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });
});

describe("POST /users/bootstrap", () => {
  it("returns existing user (created: false) when already mapped", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      payload: { displayName: "Alice" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.auth0Sub).toBe("auth0|member");
    expect(body.created).toBe(false);
    await app.close();
  });

  it("creates and returns a new user (created: true) when not found", async () => {
    const newUser = {
      id: "user-new",
      auth0Sub: "auth0|new",
      email: null,
      displayName: "Carol",
      houseThemeEnabled: false,
      role: "MEMBER" as const,
      houseId: null,
      organizationId: "org-1",
      organization: { slug: "acme" },
      house: null,
    };
    mockFindUnique.mockResolvedValue(null);   // not found
    mockOrgUpsert.mockResolvedValue(ORG);
    mockCreate.mockResolvedValue(newUser);
    const app = await buildTestApp("auth0|new");
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      payload: { displayName: "Carol" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().created).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ auth0Sub: "auth0|new" }),
      }),
    );
    await app.close();
  });

  it("links an alternate social login when the email already belongs to a user", async () => {
    const existingUser = makeMember({ email: "member@acme.com" });
    mockAuthIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingUser);

    const app = await buildTestApp("github|member", {
      email: "member@acme.com",
      email_verified: true,
    });
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      payload: { email: "member@acme.com", displayName: "Alice GitHub" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.objectContaining({
      id: "user-1",
      auth0Sub: "auth0|member",
      created: false,
    }));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAuthIdentityCreate).toHaveBeenCalledWith({
      data: {
        providerSubject: "github|member",
        userId: "user-1",
      },
    });
    await app.close();
  });

  it("links an alternate social login from verified ID token email claims", async () => {
    const existingUser = makeMember({ email: "member@acme.com" });
    mockAuthIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingUser);

    const app = await buildTestApp(
      "github|member",
      {},
      {
        idTokenClaims: {
          email: "member@acme.com",
          email_verified: true,
        },
      },
    );
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      headers: {
        "x-auth0-id-token": "id-token",
      },
      payload: { email: "member@acme.com", displayName: "Alice GitHub" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(expect.objectContaining({
      id: "user-1",
      auth0Sub: "auth0|member",
      created: false,
    }));
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAuthIdentityCreate).toHaveBeenCalledWith({
      data: {
        providerSubject: "github|member",
        userId: "user-1",
      },
    });
    await app.close();
  });

  it("does not link an alternate social login when ID token subject differs", async () => {
    mockAuthIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeMember({ email: "member@acme.com" }));

    const app = await buildTestApp(
      "github|member",
      {},
      {
        idTokenSubject: "github|other-user",
        idTokenClaims: {
          email: "member@acme.com",
          email_verified: true,
        },
      },
    );
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      headers: {
        "x-auth0-id-token": "id-token",
      },
      payload: { email: "member@acme.com", displayName: "Alice GitHub" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ACCOUNT_LINK_REQUIRED");
    expect(mockAuthIdentityCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns a conflict instead of linking duplicate body email without a verified token claim", async () => {
    mockAuthIdentityFindUnique.mockResolvedValue(null);
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeMember({ email: "member@acme.com" }));

    const app = await buildTestApp("github|member");
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      payload: { email: "member@acme.com", displayName: "Alice GitHub" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ACCOUNT_LINK_REQUIRED");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockAuthIdentityCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 400 VALIDATION_ERROR for missing displayName", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});

describe("POST /points/adjust", () => {
  it("returns 403 ACTOR_NOT_MAPPED when actor is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { targetUserId: "user-1", delta: 10, reason: "Great sprint work", trait: "COLLABORATION" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACTOR_NOT_MAPPED");
    await app.close();
  });

  it("returns 403 when target user is from a different org", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())  // getActorBySub
      .mockResolvedValueOnce(makeMember({ organizationId: "org-OTHER" })); // target user
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { targetUserId: "user-1", delta: 10, reason: "Great sprint work", trait: "COLLABORATION" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("CROSS_ORGANIZATION_TARGET");
    await app.close();
  });

  it("returns 422 TARGET_USER_UNASSIGNED when target has no house", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())   // getActorBySub
      .mockResolvedValueOnce(makeMember({ houseId: null })); // target user: no house
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { targetUserId: "user-1", delta: 10, reason: "Great sprint work", trait: "LEADERSHIP" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("TARGET_USER_UNASSIGNED");
    await app.close();
  });

  it("returns 400 VALIDATION_ERROR for negative delta", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { targetUserId: "user-1", delta: -5, reason: "Bad attempt", trait: "INNOVATION" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("returns 400 VALIDATION_ERROR when trait is missing", async () => {
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { targetUserId: "user-1", delta: 10, reason: "Good work" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("awards points and returns 200 with the transaction id and trait", async () => {
    const targetUser = makeMember({ id: "user-1", houseId: "house-1", organizationId: "org-1" });
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())  // getActorBySub
      .mockResolvedValueOnce(targetUser);  // target user lookup
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockTxCreate.mockResolvedValue({
      id: "tx-abc",
      organizationId: "org-1",
      seasonId: "season-active",
      actorUserId: "user-2",
      targetUserId: "user-1",
      targetHouseId: "house-1",
      type: "AWARD",
      delta: 15,
      reason: "Crushed the demo",
      trait: "TECHNICAL_EXCELLENCE",
      createdAt: new Date(),
    });
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: {
        targetUserId: "user-1",
        delta: 15,
        reason: "Crushed the demo",
        trait: "TECHNICAL_EXCELLENCE",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBe("tx-abc");
    expect(body.trait).toBe("TECHNICAL_EXCELLENCE");
    expect(mockTxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          seasonId: "season-active",
          actorUserId: "user-2",
          targetUserId: "user-1",
          targetHouseId: "house-1",
          type: "AWARD",
        }),
      }),
    );
    await app.close();
  });

  it("returns 409 ACTIVE_SEASON_REQUIRED when no active season exists", async () => {
    const targetUser = makeMember({ id: "user-1", houseId: "house-1", organizationId: "org-1" });
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())
      .mockResolvedValueOnce(targetUser);
    mockSeasonFindFirst.mockResolvedValue(null);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: {
        targetUserId: "user-1",
        delta: 15,
        reason: "Crushed the demo",
        trait: "TECHNICAL_EXCELLENCE",
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ACTIVE_SEASON_REQUIRED");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /points/deduct", () => {
  const validPayload = {
    targetUserId: "user-1",
    reason: "Duplicate award correction",
  };

  it("returns POINT_ADJUSTMENTS_DISABLED when the rollout flag is off", async () => {
    const app = await buildApp({
      corsAllowedOrigins: TEST_CORS_ORIGINS,
      pointAdjustmentsEnabled: false,
      verifyAccessToken: vi.fn().mockResolvedValue({
        subject: "auth0|admin",
        claims: { sub: "auth0|admin" },
      }),
    });

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      headers: { authorization: "Bearer valid" },
      payload: validPayload,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      code: "POINT_ADJUSTMENTS_DISABLED",
      message: "Point adjustments are not enabled",
    });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 400 VALIDATION_ERROR for invalid payloads", async () => {
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: { targetUserId: "user-1", reason: "no", delta: -10 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 403 ACTOR_NOT_MAPPED when actor is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACTOR_NOT_MAPPED");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 403 ACTOR_HOUSE_REQUIRED when actor is not assigned to a house", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({ houseId: null }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACTOR_HOUSE_REQUIRED");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 TARGET_USER_NOT_FOUND when target does not exist", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())
      .mockResolvedValueOnce(null);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("TARGET_USER_NOT_FOUND");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 403 CROSS_ORGANIZATION_TARGET when target is outside the actor organization", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())
      .mockResolvedValueOnce(makeMember({ organizationId: "org-other", houseId: "house-2" }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("CROSS_ORGANIZATION_TARGET");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 422 TARGET_USER_UNASSIGNED when target has no house", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())
      .mockResolvedValueOnce(makeMember({ houseId: null }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("TARGET_USER_UNASSIGNED");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 SAME_HOUSE_TARGET when target is in the actor house", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }))
      .mockResolvedValueOnce(makeMember({ houseId: "house-1" }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("SAME_HOUSE_TARGET");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 ACTIVE_SEASON_REQUIRED when no active season exists", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }))
      .mockResolvedValueOnce(makeMember({ houseId: "house-2" }));
    mockSeasonFindFirst.mockResolvedValue(null);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ACTIVE_SEASON_REQUIRED");
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 DEDUCTION_COOLDOWN_ACTIVE when the actor house already deducted recently", async () => {
    const previousCreatedAt = new Date("2026-06-22T12:00:00.000Z");
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }))
      .mockResolvedValueOnce(makeMember({ id: "user-1", houseId: "house-2", organizationId: "org-1" }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockTxFindFirst.mockResolvedValueOnce({
      id: "tx-recent-house-deduction",
      createdAt: previousCreatedAt,
    });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("DEDUCTION_COOLDOWN_ACTIVE");
    expect(mockTxFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          seasonId: "season-active",
          type: "DEDUCTION",
          actor: { houseId: "house-1" },
        }),
      }),
    );
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 TARGET_DEDUCTION_LIMIT_ACTIVE when the target already received a recent deduction", async () => {
    const previousCreatedAt = new Date("2026-06-22T12:00:00.000Z");
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }))
      .mockResolvedValueOnce(makeMember({ id: "user-1", houseId: "house-2", organizationId: "org-1" }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockTxFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "tx-recent-target-deduction",
        createdAt: previousCreatedAt,
      });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("TARGET_DEDUCTION_LIMIT_ACTIVE");
    expect(mockTxFindFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          seasonId: "season-active",
          type: "DEDUCTION",
          targetUserId: "user-1",
        }),
      }),
    );
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("creates a fixed deduction for admins against another house", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }))
      .mockResolvedValueOnce(makeMember({ id: "user-1", houseId: "house-2", organizationId: "org-1" }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockTxCreate.mockResolvedValue({ id: "tx-deduction" });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: {
        targetUserId: "user-1",
        reason: "  Duplicate award correction  ",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: "tx-deduction" });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTxCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        seasonId: "season-active",
        actorUserId: "user-2",
        targetUserId: "user-1",
        targetHouseId: "house-2",
        type: "DEDUCTION",
        delta: -10,
        reason: "Duplicate award correction",
        trait: null,
      },
      select: { id: true },
    });
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorUserId: "user-2",
        eventType: "POINTS_DEDUCTED",
        summary: "Bob deducted 10 points from Alice.",
        metadata: {
          transactionId: "tx-deduction",
          targetUserId: "user-1",
          targetUserName: "Alice",
          targetHouseId: "house-2",
          seasonId: "season-active",
          seasonName: "Q3 2026",
          delta: -10,
          reason: "Duplicate award correction",
        },
      },
    });
    await app.close();
  });

  it("allows owners to create deductions", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeOwner({ houseId: "house-1" }))
      .mockResolvedValueOnce(makeMember({ id: "user-1", houseId: "house-2", organizationId: "org-1" }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockTxCreate.mockResolvedValue({ id: "tx-owner-deduction" });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: "tx-owner-deduction" });
    expect(mockTxCreate).toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /points/delete", () => {
  const deletedPoint = {
    id: "tx-1",
    type: "AWARD" as const,
    delta: 15,
    reason: "Crushed the demo",
    trait: "TECHNICAL_EXCELLENCE" as const,
    targetUserId: "user-1",
    targetHouseId: "house-1",
    createdAt: new Date("2026-06-01T12:00:00.000Z"),
    deletedAt: new Date("2026-06-02T12:00:00.000Z"),
    deletionReason: "Duplicate award",
    actor: { displayName: "Bob" },
    targetUser: { displayName: "Alice" },
    targetHouse: { name: "Phoenix", color: "#7c3aed" },
    deletedBy: { displayName: "Olivia" },
    season: { id: "season-active", name: "Q3 2026", isActive: true },
  };

  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/points/delete",
      payload: { transactionId: "tx-1" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    expect(mockTxFindUnique).not.toHaveBeenCalled();
    await app.close();
  });

  it("soft deletes a point transaction for admins in the same organization", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    mockTxFindUnique.mockResolvedValue({
      id: "tx-1",
      organizationId: "org-1",
      deletedAt: null,
    });
    mockTxUpdate.mockResolvedValue(deletedPoint);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/delete",
      payload: { transactionId: "tx-1", reason: " Duplicate award " },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "tx-1",
      type: "AWARD",
      actorName: "Bob",
      targetUserName: "Alice",
      targetHouseName: "Phoenix",
      targetHouseColor: "#7c3aed",
      delta: 15,
      reason: "Crushed the demo",
      trait: "TECHNICAL_EXCELLENCE",
      createdAt: "2026-06-01T12:00:00.000Z",
      deletedAt: "2026-06-02T12:00:00.000Z",
      deletedByName: "Olivia",
      deletionReason: "Duplicate award",
      season: { id: "season-active", name: "Q3 2026", isActive: true },
    });
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tx-1" },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedByUserId: "user-2",
          deletionReason: "Duplicate award",
        }),
      }),
    );
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorUserId: "user-2",
        eventType: "POINT_DELETED",
        summary: "Bob deleted 15 points from Alice.",
        metadata: {
          transactionId: "tx-1",
          targetUserId: "user-1",
          targetUserName: "Alice",
          targetHouseId: "house-1",
          targetHouseName: "Phoenix",
          delta: 15,
          trait: "TECHNICAL_EXCELLENCE",
          awardReason: "Crushed the demo",
          deletionReason: "Duplicate award",
        },
      },
    });
    await app.close();
  });

  it("does not reveal transactions from another organization", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({ organizationId: "org-secure" }));
    mockTxFindUnique.mockResolvedValue({
      id: "tx-1",
      organizationId: "org-other",
      deletedAt: null,
    });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/delete",
      payload: { transactionId: "tx-1" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("POINT_TRANSACTION_NOT_FOUND");
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 when the point transaction is already deleted", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockTxFindUnique.mockResolvedValue({
      id: "tx-1",
      organizationId: "org-1",
      deletedAt: new Date("2026-06-02T12:00:00.000Z"),
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/points/delete",
      payload: { transactionId: "tx-1" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("POINT_TRANSACTION_ALREADY_DELETED");
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /seasons/context", () => {
  it("returns active season and historical seasons for the actor's organization", async () => {
    mockFindUnique.mockResolvedValue(makeMember({ organizationId: "org-secure" }));
    mockSeasonFindMany.mockResolvedValue([ACTIVE_SEASON, SEASON_ZERO]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/seasons/context",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockSeasonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-secure" },
        orderBy: { startsAt: "desc" },
      }),
    );
    expect(res.json()).toEqual({
      activeSeason: {
        id: "season-active",
        name: "Q3 2026",
        startsAt: "2026-07-01T00:00:00.000Z",
        endsAt: null,
        isActive: true,
      },
      seasons: [
        {
          id: "season-active",
          name: "Q3 2026",
          startsAt: "2026-07-01T00:00:00.000Z",
          endsAt: null,
          isActive: true,
        },
        {
          id: "season-0",
          name: "Season 0",
          startsAt: "2026-06-01T00:00:00.000Z",
          endsAt: "2026-07-01T00:00:00.000Z",
          isActive: false,
        },
      ],
    });
    await app.close();
  });

  it("returns 409 ACTIVE_SEASON_REQUIRED when no active season exists", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockSeasonFindMany.mockResolvedValue([SEASON_ZERO]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/seasons/context",
      payload: {},
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ACTIVE_SEASON_REQUIRED");
    await app.close();
  });
});

describe("POST /seasons/compare", () => {
  const fromSeason = {
    id: "season-0",
    name: "Season 0",
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: new Date("2026-01-11T00:00:00.000Z"),
    isActive: false,
  };
  const toSeason = {
    id: "season-active",
    name: "Q3 2026",
    startsAt: new Date("2026-02-01T00:00:00.000Z"),
    endsAt: new Date("2026-02-06T00:00:00.000Z"),
    isActive: true,
  };

  it("compares house rank, points, velocity, and top contributors across two seasons", async () => {
    mockFindUnique.mockResolvedValue(makeMember({ organizationId: "org-secure" }));
    mockSeasonFindMany.mockResolvedValue([fromSeason, toSeason]);
    mockHouseFindMany.mockResolvedValue([
      { id: "house-2", name: "Ember", color: "#ef4444" },
      { id: "house-3", name: "Frost", color: "#0ea5e9" },
      { id: "house-1", name: "Phoenix", color: "#7c3aed" },
    ]);
    mockTxGroupBy
      .mockResolvedValueOnce([
        {
          seasonId: "season-0",
          targetHouseId: "house-1",
          _sum: { delta: 100 },
          _count: { _all: 3 },
        },
        {
          seasonId: "season-0",
          targetHouseId: "house-2",
          _sum: { delta: 80 },
          _count: { _all: 2 },
        },
        {
          seasonId: "season-active",
          targetHouseId: "house-1",
          _sum: { delta: 70 },
          _count: { _all: 3 },
        },
        {
          seasonId: "season-active",
          targetHouseId: "house-2",
          _sum: { delta: 120 },
          _count: { _all: 4 },
        },
        {
          seasonId: "season-active",
          targetHouseId: "house-3",
          _sum: { delta: -10 },
          _count: { _all: 1 },
        },
      ])
      .mockResolvedValueOnce([
        {
          seasonId: "season-0",
          targetHouseId: "house-1",
          targetUserId: "user-1",
          _sum: { delta: 75 },
        },
        {
          seasonId: "season-0",
          targetHouseId: "house-1",
          targetUserId: "user-2",
          _sum: { delta: 25 },
        },
        {
          seasonId: "season-active",
          targetHouseId: "house-2",
          targetUserId: "user-3",
          _sum: { delta: 120 },
        },
        {
          seasonId: "season-active",
          targetHouseId: "house-3",
          targetUserId: "user-4",
          _sum: { delta: -10 },
        },
      ]);
    mockUserFindMany.mockResolvedValue([
      { id: "user-1", displayName: "Alice" },
      { id: "user-2", displayName: "Bob" },
      { id: "user-3", displayName: "Cora" },
      { id: "user-4", displayName: "Drew" },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/seasons/compare",
      payload: {
        fromSeasonId: "season-0",
        toSeasonId: "season-active",
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSeasonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["season-0", "season-active"] },
          organizationId: "org-secure",
        },
      }),
    );
    expect(mockHouseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-secure" },
        orderBy: { name: "asc" },
      }),
    );
    expect(mockTxGroupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        by: ["seasonId", "targetHouseId"],
        where: {
          organizationId: "org-secure",
          seasonId: { in: ["season-0", "season-active"] },
          deletedAt: null,
        },
      }),
    );
    expect(mockTxGroupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        by: ["seasonId", "targetHouseId", "targetUserId"],
        where: {
          organizationId: "org-secure",
          seasonId: { in: ["season-0", "season-active"] },
          deletedAt: null,
          targetUserId: { not: null },
        },
      }),
    );
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: ["user-1", "user-2", "user-3", "user-4"] },
          organizationId: "org-secure",
        },
      }),
    );
    expect(res.json()).toEqual({
      fromSeason: {
        id: "season-0",
        name: "Season 0",
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-01-11T00:00:00.000Z",
        isActive: false,
      },
      toSeason: {
        id: "season-active",
        name: "Q3 2026",
        startsAt: "2026-02-01T00:00:00.000Z",
        endsAt: "2026-02-06T00:00:00.000Z",
        isActive: true,
      },
      houses: [
        {
          houseId: "house-2",
          houseName: "Ember",
          houseColor: "#ef4444",
          from: {
            rank: 2,
            points: 80,
            transactions: 2,
            averagePointsPerDay: 8,
            topContributor: null,
          },
          to: {
            rank: 1,
            points: 120,
            transactions: 4,
            averagePointsPerDay: 24,
            topContributor: {
              userId: "user-3",
              displayName: "Cora",
              points: 120,
            },
          },
          delta: {
            rankChange: 1,
            pointChange: 40,
            averagePointsPerDayChange: 16,
          },
        },
        {
          houseId: "house-3",
          houseName: "Frost",
          houseColor: "#0ea5e9",
          from: {
            rank: 3,
            points: 0,
            transactions: 0,
            averagePointsPerDay: 0,
            topContributor: null,
          },
          to: {
            rank: 3,
            points: -10,
            transactions: 1,
            averagePointsPerDay: -2,
            topContributor: {
              userId: "user-4",
              displayName: "Drew",
              points: -10,
            },
          },
          delta: {
            rankChange: 0,
            pointChange: -10,
            averagePointsPerDayChange: -2,
          },
        },
        {
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          from: {
            rank: 1,
            points: 100,
            transactions: 3,
            averagePointsPerDay: 10,
            topContributor: {
              userId: "user-1",
              displayName: "Alice",
              points: 75,
            },
          },
          to: {
            rank: 2,
            points: 70,
            transactions: 3,
            averagePointsPerDay: 14,
            topContributor: null,
          },
          delta: {
            rankChange: -1,
            pointChange: -30,
            averagePointsPerDayChange: 4,
          },
        },
      ],
    });
    await app.close();
  });

  it("rejects comparison requests for the same season", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/seasons/compare",
      payload: {
        fromSeasonId: "season-0",
        toSeasonId: "season-0",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSeasonFindMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects cross-organization or unknown season IDs", async () => {
    mockFindUnique.mockResolvedValue(makeMember({ organizationId: "org-secure" }));
    mockSeasonFindMany.mockResolvedValue([fromSeason]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/seasons/compare",
      payload: {
        fromSeasonId: "season-0",
        toSeasonId: "other-season",
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("SEASON_NOT_FOUND");
    expect(mockHouseFindMany).not.toHaveBeenCalled();
    expect(mockTxGroupBy).not.toHaveBeenCalled();
    await app.close();
  });

  it("assembles a larger comparison fixture with set-based aggregate queries", async () => {
    const houses = Array.from({ length: 12 }, (_, index) => ({
      id: `house-${index + 1}`,
      name: `House ${String(index + 1).padStart(2, "0")}`,
      color: `#${String(index + 1).padStart(6, "0")}`,
    }));
    const users = Array.from({ length: 48 }, (_, index) => ({
      id: `user-${index + 1}`,
      displayName: `Member ${String(index + 1).padStart(2, "0")}`,
    }));
    const houseTotals = houses.flatMap((house, index) => [
      {
        seasonId: fromSeason.id,
        targetHouseId: house.id,
        _sum: { delta: (index + 1) * 10 },
        _count: { _all: index + 1 },
      },
      {
        seasonId: toSeason.id,
        targetHouseId: house.id,
        _sum: { delta: (houses.length - index) * 12 },
        _count: { _all: index + 2 },
      },
    ]);
    const contributorTotals = houses.flatMap((house, houseIndex) =>
      Array.from({ length: 4 }, (_, contributorIndex) => {
        const user = users[(houseIndex * 4 + contributorIndex) % users.length] ?? users[0];

        return {
          seasonId: contributorIndex % 2 === 0 ? fromSeason.id : toSeason.id,
          targetHouseId: house.id,
          targetUserId: user.id,
          _sum: { delta: (contributorIndex + 1) * (houseIndex + 1) },
        };
      }),
    );
    mockFindUnique.mockResolvedValue(makeMember({ organizationId: "org-secure" }));
    mockSeasonFindMany.mockResolvedValue([fromSeason, toSeason]);
    mockHouseFindMany.mockResolvedValue(houses);
    mockTxGroupBy
      .mockResolvedValueOnce(houseTotals)
      .mockResolvedValueOnce(contributorTotals);
    mockUserFindMany.mockResolvedValue(users);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/seasons/compare",
      payload: {
        fromSeasonId: fromSeason.id,
        toSeasonId: toSeason.id,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockHouseFindMany).toHaveBeenCalledTimes(1);
    expect(mockTxGroupBy).toHaveBeenCalledTimes(2);
    expect(mockUserFindMany).toHaveBeenCalledTimes(1);
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: users.map((user) => user.id) },
          organizationId: "org-secure",
        },
      }),
    );
    const body = res.json();
    expect(body.houses).toHaveLength(12);
    expect(body.houses[0]).toEqual(
      expect.objectContaining({
        houseId: "house-1",
        from: expect.objectContaining({
          points: 10,
          transactions: 1,
        }),
        to: expect.objectContaining({
          points: 144,
          transactions: 2,
        }),
        delta: expect.objectContaining({
          pointChange: 134,
        }),
      }),
    );
    await app.close();
  });
});

describe("POST /seasons/start", () => {
  it("allows an owner to close the current season and start the next one", async () => {
    const nextSeason = {
      id: "season-next",
      name: "Q4 2026",
      startsAt: new Date("2026-08-01T12:00:00.000Z"),
      endsAt: null,
      isActive: true,
    };
    const closedSeason = {
      ...ACTIVE_SEASON,
      endsAt: new Date("2026-08-01T12:00:00.000Z"),
      isActive: false,
    };
    mockFindUnique.mockResolvedValue(makeOwner({ organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockSeasonUpdate.mockResolvedValue(closedSeason);
    mockSeasonCreate.mockResolvedValue(nextSeason);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/start",
      payload: { name: "Q4 2026" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-secure",
          isActive: true,
        },
      }),
    );
    expect(mockSeasonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "season-active" },
        data: expect.objectContaining({
          isActive: false,
          endsAt: expect.any(Date),
        }),
      }),
    );
    expect(mockSeasonCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-secure",
          name: "Q4 2026",
          isActive: true,
          createdById: "user-owner",
        }),
      }),
    );
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-secure",
        actorUserId: "user-owner",
        eventType: "SEASON_STARTED",
        summary: "Olivia started Q4 2026.",
        metadata: {
          seasonId: "season-next",
          seasonName: "Q4 2026",
          previousSeasonId: "season-active",
          previousSeasonName: "Q3 2026",
        },
      },
    });
    expect(res.json()).toEqual({
      previousSeason: {
        id: "season-active",
        name: "Q3 2026",
        startsAt: "2026-07-01T00:00:00.000Z",
        endsAt: "2026-08-01T12:00:00.000Z",
        isActive: false,
      },
      activeSeason: {
        id: "season-next",
        name: "Q4 2026",
        startsAt: "2026-08-01T12:00:00.000Z",
        endsAt: null,
        isActive: true,
      },
    });
    await app.close();
  });

  it("rejects admins when starting a season", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({ organizationId: "org-secure" }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/start",
      payload: { name: "Q4 2026" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects regular members when starting a season", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp("auth0|member");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/start",
      payload: { name: "Q4 2026" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 when starting a season without an active season", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockSeasonFindFirst.mockResolvedValue(null);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/start",
      payload: { name: "Q4 2026" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ACTIVE_SEASON_REQUIRED");
    expect(mockSeasonCreate).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /seasons/rename", () => {
  it("allows an owner to rename a season in their organization", async () => {
    const renamedSeason = { ...ACTIVE_SEASON, name: "Summer 2026" };
    mockFindUnique.mockResolvedValue(makeOwner({ organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue({ id: "season-active" });
    mockSeasonUpdate.mockResolvedValue(renamedSeason);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/rename",
      payload: { seasonId: "season-active", name: "Summer 2026" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "season-active",
          organizationId: "org-secure",
        },
      }),
    );
    expect(mockSeasonUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "season-active" },
        data: { name: "Summer 2026" },
      }),
    );
    expect(res.json()).toEqual({
      id: "season-active",
      name: "Summer 2026",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: null,
      isActive: true,
    });
    await app.close();
  });

  it("rejects cross-organization or unknown season IDs when renaming", async () => {
    mockFindUnique.mockResolvedValue(makeOwner({ organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(null);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/rename",
      payload: { seasonId: "other-season", name: "Summer 2026" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("SEASON_NOT_FOUND");
    expect(mockSeasonUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects admins when renaming a season", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({ organizationId: "org-secure" }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/rename",
      payload: { seasonId: "season-active", name: "Summer 2026" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockSeasonUpdate).not.toHaveBeenCalled();
    await app.close();
  });

});

describe("POST /houses/leaderboard", () => {
  it("scopes leaderboard houses to the authenticated actor's organization", async () => {
    mockFindUnique.mockResolvedValue(
      makeMember({ organizationId: "org-secure" }),
    );
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockHouseFindMany.mockResolvedValue([
      {
        id: "house-1",
        name: "Phoenix",
        color: "#7c3aed",
        description: null,
        _count: { users: 2 },
      },
      {
        id: "house-2",
        name: "Dragon",
        color: "#dc2626",
        description: "Fire team",
        _count: { users: 1 },
      },
    ]);
    mockTxGroupBy.mockResolvedValue([
      {
        targetHouseId: "house-1",
        _sum: { delta: 10 },
        _count: { _all: 1 },
      },
      {
        targetHouseId: "house-2",
        _sum: { delta: 15 },
        _count: { _all: 2 },
      },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/houses/leaderboard",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockHouseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-secure" },
        select: expect.objectContaining({
          _count: { select: { users: true } },
        }),
      }),
    );
    expect(mockTxGroupBy).toHaveBeenCalledWith({
      by: ["targetHouseId"],
      where: {
        organizationId: "org-secure",
        seasonId: "season-active",
        deletedAt: null,
      },
      _sum: { delta: true },
      _count: { _all: true },
    });
    expect(res.json()).toEqual([
      {
        id: "house-2",
        name: "Dragon",
        color: "#dc2626",
        description: "Fire team",
        score: 15,
        transactions: 2,
        memberCount: 1,
      },
      {
        id: "house-1",
        name: "Phoenix",
        color: "#7c3aed",
        description: null,
        score: 10,
        transactions: 1,
        memberCount: 2,
      },
    ]);
    await app.close();
  });

  it("uses a requested historical season for house standings", async () => {
    mockFindUnique.mockResolvedValue(
      makeMember({ organizationId: "org-secure" }),
    );
    mockSeasonFindFirst.mockResolvedValue(SEASON_ZERO);
    mockHouseFindMany.mockResolvedValue([
      {
        id: "house-1",
        name: "Phoenix",
        color: "#7c3aed",
        description: null,
        _count: { users: 2 },
      },
    ]);
    mockTxGroupBy.mockResolvedValue([
      {
        targetHouseId: "house-1",
        _sum: { delta: 7 },
        _count: { _all: 1 },
      },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/houses/leaderboard",
      payload: { seasonId: "season-0" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "season-0",
          organizationId: "org-secure",
        },
      }),
    );
    expect(mockTxGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seasonId: "season-0",
        }),
      }),
    );
    expect(res.json()[0].score).toBe(7);
    await app.close();
  });

});

describe("POST /admin/houses", () => {
  it("returns 403 OWNER_REQUIRED when actor is not an owner", async () => {
    mockFindUnique.mockResolvedValue(makeMember()); // role = MEMBER
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/houses",
      payload: { name: "Gryffindor", color: "#ff0000" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    await app.close();
  });

  it("returns 403 OWNER_REQUIRED when actor is an admin", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/houses",
      payload: { name: "Phoenix", color: "#7c3aed" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockHouseUpsert).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 201 and creates house when actor is owner", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockHouseUpsert.mockResolvedValue(HOUSE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/houses",
      payload: { name: "Phoenix", color: "#7c3aed" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe("Phoenix");
    await app.close();
  });
});

describe("POST /admin/context", () => {
  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/admin/context",
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    expect(mockUserFindMany).not.toHaveBeenCalled();
    expect(mockHouseFindMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an admin and scopes organization context to the actor's organization", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({ organizationId: "org-secure" }));
    mockUserFindMany.mockResolvedValue([]);
    mockHouseFindMany.mockResolvedValue([]);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/context",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      organizationId: "org-secure",
      organizationSlug: "acme",
      users: [],
      houses: [],
      recentDeletedPoints: [],
      recentAdminActions: [],
      inviteStats: {
        generatedCount: 0,
        usedCount: 0,
      },
      pointAdjustmentStats: {
        seasonId: null,
        seasonName: null,
        totalDeductionCount: 0,
        totalDeductedPoints: 0,
        byHouse: [],
      },
      adminAuditNextCursor: null,
    });
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-secure" },
      }),
    );
    expect(mockHouseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-secure" },
      }),
    );
    await app.close();
  });

  it("allows an owner and returns the complete organization context", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockUserFindMany.mockResolvedValue([
      {
        id: "user-owner",
        displayName: "Olivia",
        email: "owner@acme.com",
        role: "OWNER",
        houseId: "house-1",
      },
    ]);
    mockHouseFindMany.mockResolvedValue([
      {
        id: "house-1",
        name: "Phoenix",
        color: "#7c3aed",
        description: null,
      },
    ]);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/context",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      organizationId: "org-1",
      organizationSlug: "acme",
      users: [
        {
          id: "user-owner",
          displayName: "Olivia",
          email: "owner@acme.com",
          role: "OWNER",
          houseId: "house-1",
        },
      ],
      houses: [
        {
          id: "house-1",
          name: "Phoenix",
          color: "#7c3aed",
          description: null,
        },
      ],
      recentDeletedPoints: [],
      recentAdminActions: [],
      inviteStats: {
        generatedCount: 0,
        usedCount: 0,
      },
      pointAdjustmentStats: {
        seasonId: null,
        seasonName: null,
        totalDeductionCount: 0,
        totalDeductedPoints: 0,
        byHouse: [
          {
            houseId: "house-1",
            houseName: "Phoenix",
            houseColor: "#7c3aed",
            deductionCount: 0,
            deductedPoints: 0,
          },
        ],
      },
      adminAuditNextCursor: null,
    });
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
      }),
    );
    expect(mockHouseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
      }),
    );
    await app.close();
  });
});

describe("POST /admin/point-adjustments/stats", () => {
  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/admin/point-adjustments/stats",
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    expect(mockSeasonFindFirst).not.toHaveBeenCalled();
    expect(mockTxGroupBy).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns active-season point adjustment reporting by default", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({ organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockHouseFindMany.mockResolvedValue([
      { id: "house-1", name: "Phoenix", color: "#7c3aed", description: null },
      { id: "house-2", name: "Ember", color: "#ef4444", description: null },
    ]);
    mockTxGroupBy.mockResolvedValue([
      {
        targetHouseId: "house-1",
        _count: { _all: 2 },
        _sum: { delta: -20 },
      },
    ]);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/point-adjustments/stats",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-secure",
          isActive: true,
        },
      }),
    );
    expect(mockTxGroupBy).toHaveBeenCalledWith({
      by: ["targetHouseId"],
      where: {
        organizationId: "org-secure",
        seasonId: "season-active",
        type: "DEDUCTION",
        deletedAt: null,
      },
      _count: { _all: true },
      _sum: { delta: true },
    });
    expect(res.json()).toEqual({
      seasonId: "season-active",
      seasonName: "Q3 2026",
      totalDeductionCount: 2,
      totalDeductedPoints: 20,
      byHouse: [
        {
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          deductionCount: 2,
          deductedPoints: 20,
        },
        {
          houseId: "house-2",
          houseName: "Ember",
          houseColor: "#ef4444",
          deductionCount: 0,
          deductedPoints: 0,
        },
      ],
    });
    await app.close();
  });

  it("uses a requested historical season for point adjustment reporting", async () => {
    mockFindUnique.mockResolvedValue(makeOwner({ organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(SEASON_ZERO);
    mockHouseFindMany.mockResolvedValue([
      { id: "house-1", name: "Phoenix", color: "#7c3aed", description: null },
    ]);
    mockTxGroupBy.mockResolvedValue([
      {
        targetHouseId: "house-1",
        _count: { _all: 1 },
        _sum: { delta: -10 },
      },
    ]);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/point-adjustments/stats",
      payload: { seasonId: "season-0" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "season-0",
          organizationId: "org-secure",
        },
      }),
    );
    expect(mockTxGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-secure",
          seasonId: "season-0",
          type: "DEDUCTION",
          deletedAt: null,
        }),
      }),
    );
    expect(res.json()).toMatchObject({
      seasonId: "season-0",
      seasonName: "Season 0",
      totalDeductionCount: 1,
      totalDeductedPoints: 10,
    });
    await app.close();
  });
});

describe("POST /admin/audit", () => {
  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/admin/audit",
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    expect(mockAuditEventFindMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns filtered paged audit history scoped to the actor's organization", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({ organizationId: "org-secure" }));
    mockAuditEventFindMany.mockResolvedValue([
      {
        id: "audit-delete-1",
        eventType: "POINT_DELETED",
        summary: "Bob Admin deleted 12 points from Ben.",
        metadata: {
          transactionId: "tx-1",
          targetUserName: "Ben",
          delta: 12,
        },
        createdAt: new Date("2026-06-21T12:15:00.000Z"),
        actor: { displayName: "Bob Admin" },
      },
      {
        id: "audit-delete-2",
        eventType: "POINT_DELETED",
        summary: "Bob Admin deleted 3 points from Casey.",
        metadata: {
          transactionId: "tx-2",
          targetUserName: "Casey",
          delta: 3,
        },
        createdAt: new Date("2026-06-21T11:15:00.000Z"),
        actor: { displayName: "Bob Admin" },
      },
    ]);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/audit",
      payload: { type: "POINT_DELETED", cursor: "audit-delete-0", limit: 1 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      items: [
        {
          id: "audit-event:audit-delete-1",
          type: "POINT_DELETED",
          occurredAt: "2026-06-21T12:15:00.000Z",
          actorName: "Bob Admin",
          summary: "Bob Admin deleted 12 points from Ben.",
          metadata: {
            transactionId: "tx-1",
            targetUserName: "Ben",
            delta: "12",
          },
        },
      ],
      nextCursor: "audit-delete-1",
    });
    expect(mockAuditEventFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-secure",
        eventType: "POINT_DELETED",
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 2,
      cursor: { id: "audit-delete-0" },
      skip: 1,
      select: {
        id: true,
        eventType: true,
        summary: true,
        metadata: true,
        createdAt: true,
        actor: { select: { displayName: true } },
      },
    });
    await app.close();
  });
});

describe("POST /admin/users/assign-house", () => {
  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/users/assign-house",
      payload: { targetUserId: "user-1", targetHouseId: "house-1" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    await app.close();
  });

  it("returns 404 when target user is not found", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin()); // getActorBySub
    // targetUser and targetHouse both null â€” returned via Promise.all
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    mockHouseFindUnique.mockResolvedValue(HOUSE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/users/assign-house",
      payload: { targetUserId: "user-999", targetHouseId: "house-1" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("returns 404 when target house belongs to another organization", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin({ organizationId: "org-1" }));
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "user-1",
      displayName: "Alice",
      organizationId: "org-1",
    });
    mockHouseFindUnique.mockResolvedValue({
      id: "house-other",
      organizationId: "org-other",
      name: "Other House",
    });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/assign-house",
      payload: { targetUserId: "user-1", targetHouseId: "house-other" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("TARGET_HOUSE_NOT_FOUND");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("assigns a user to a house and returns the updated user summary", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin());
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "user-1",
      displayName: "Alice",
      organizationId: "org-1",
    });
    mockHouseFindUnique.mockResolvedValue({
      id: "house-1",
      organizationId: "org-1",
      name: "Phoenix",
    });
    mockUserUpdate.mockResolvedValue({
      id: "user-1",
      displayName: "Alice",
      houseId: "house-1",
    });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/assign-house",
      payload: { targetUserId: "user-1", targetHouseId: "house-1" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "user-1",
      displayName: "Alice",
      houseId: "house-1",
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { houseId: "house-1" },
      select: {
        id: true,
        displayName: true,
        houseId: true,
      },
    });
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorUserId: "user-2",
        eventType: "USER_HOUSE_ASSIGNED",
        summary: "Bob assigned Alice to Phoenix.",
        metadata: {
          targetUserId: "user-1",
          targetUserName: "Alice",
          targetHouseId: "house-1",
          targetHouseName: "Phoenix",
        },
      },
    });
    await app.close();
  });
});

describe("POST /users/profile", () => {
  it("updates and returns the authenticated user's display name", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockUserUpdate.mockResolvedValue({
      id: "user-1",
      displayName: "Alice Updated",
      houseThemeEnabled: false,
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/users/profile",
      payload: { displayName: "Alice Updated" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "user-1",
      displayName: "Alice Updated",
      houseThemeEnabled: false,
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "Alice Updated" },
      select: { id: true, displayName: true, houseThemeEnabled: true },
    });
    await app.close();
  });

  it("updates and returns the authenticated user's house theme preference", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockUserUpdate.mockResolvedValue({
      id: "user-1",
      displayName: "Alice",
      houseThemeEnabled: true,
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/users/profile",
      payload: { houseThemeEnabled: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "user-1",
      displayName: "Alice",
      houseThemeEnabled: true,
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { houseThemeEnabled: true },
      select: { id: true, displayName: true, houseThemeEnabled: true },
    });
    await app.close();
  });
});

describe("POST /admin/users/role", () => {
  it("returns 403 OWNER_REQUIRED when actor is an admin", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/role",
      payload: { targetUserId: "user-1", role: "ADMIN" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 when the target user is outside the owner's organization", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeOwner({ organizationId: "org-secure" }))
      .mockResolvedValueOnce(makeMember({ id: "user-other", organizationId: "org-other" }));
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/role",
      payload: { targetUserId: "user-other", role: "ADMIN" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("TARGET_USER_NOT_FOUND");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects attempts to change an owner role", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeOwner({ organizationId: "org-secure" }))
      .mockResolvedValueOnce(makeOwner({
        id: "user-owner-2",
        displayName: "Second Owner",
        organizationId: "org-secure",
      }));
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/role",
      payload: { targetUserId: "user-owner-2", role: "ADMIN" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("OWNER_ROLE_IMMUTABLE");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an owner to promote a member to admin and writes an audit event", async () => {
    const targetUser = makeMember({
      id: "user-target",
      displayName: "Taylor",
      email: "taylor@acme.com",
      role: "MEMBER" as const,
      organizationId: "org-secure",
      houseId: "house-1",
    });
    mockFindUnique
      .mockResolvedValueOnce(makeOwner({ organizationId: "org-secure" }))
      .mockResolvedValueOnce(targetUser);
    mockUserUpdate.mockResolvedValue({
      id: "user-target",
      displayName: "Taylor",
      email: "taylor@acme.com",
      role: "ADMIN",
      houseId: "house-1",
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/role",
      payload: { targetUserId: "user-target", role: "ADMIN" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-target" },
      data: { role: "ADMIN" },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        houseId: true,
      },
    });
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-secure",
        actorUserId: "user-owner",
        eventType: "USER_ROLE_CHANGED",
        summary: "Olivia changed Taylor from MEMBER to ADMIN.",
        metadata: {
          targetUserId: "user-target",
          targetUserName: "Taylor",
          previousRole: "MEMBER",
          newRole: "ADMIN",
        },
      },
    });
    expect(res.json()).toEqual({
      id: "user-target",
      displayName: "Taylor",
      email: "taylor@acme.com",
      role: "ADMIN",
      houseId: "house-1",
    });
    await app.close();
  });
});

describe("POST /transactions/recent", () => {
  it("returns 403 ACTOR_NOT_MAPPED when actor is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: {},
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACTOR_NOT_MAPPED");
    await app.close();
  });

  it("returns a bounded first page of activity items with trait included", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindMany.mockResolvedValue([
      {
        id: "tx-1",
        type: "AWARD",
        delta: 10,
        reason: "Great collaboration",
        trait: "COLLABORATION",
        createdAt: new Date("2026-01-01T12:00:00Z"),
        actor: { displayName: "Bob" },
        targetUser: { displayName: "Alice" },
        targetHouse: { name: "Phoenix", color: "#7c3aed" },
        season: { id: "season-active", name: "Q3 2026", isActive: true },
      },
      {
        id: "tx-2",
        type: "AWARD",
        delta: 5,
        reason: "Second page",
        trait: "LEADERSHIP",
        createdAt: new Date("2026-01-01T11:00:00Z"),
        actor: { displayName: "Bob" },
        targetUser: { displayName: "Alice" },
        targetHouse: { name: "Phoenix", color: "#7c3aed" },
        season: { id: "season-active", name: "Q3 2026", isActive: true },
      },
    ]);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: { limit: 1 },
    });
    expect(res.statusCode).toBe(200);
    const page = res.json();
    const items = page.items;
    expect(items).toHaveLength(1);
    expect(items[0].trait).toBe("COLLABORATION");
    expect(items[0].season).toEqual({
      id: "season-active",
      name: "Q3 2026",
      isActive: true,
    });
    expect(items[0].actorName).toBe("Bob");
    expect(items[0].delta).toBe(10);
    expect(page.nextCursor).toBe("tx-1");
    expect(mockTxFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", deletedAt: null },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 2,
      select: expect.any(Object),
    });
    await app.close();
  });

  it("uses the provided activity cursor for the next page", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindMany.mockResolvedValue([]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: { cursor: "tx-1", limit: 25 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], nextCursor: null });
    expect(mockTxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: "tx-1" },
        skip: 1,
        take: 26,
      }),
    );
    await app.close();
  });

  it("returns trait as null when transaction has no trait", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindMany.mockResolvedValue([
      {
        id: "tx-2",
        delta: 5,
        reason: "Legacy record",
        trait: null,
        createdAt: new Date("2026-01-01T11:00:00Z"),
        actor: { displayName: "Bob" },
        targetUser: { displayName: "Alice" },
        targetHouse: { name: "Phoenix", color: "#7c3aed" },
        season: null,
      },
    ]);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().items[0].trait).toBeNull();
    await app.close();
  });

  it("returns a merged recent admin action timeline from persisted org data", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    mockUserFindMany.mockResolvedValue([]);
    mockHouseFindMany.mockResolvedValue([]);
    mockTxFindMany.mockResolvedValue([
      {
        id: "tx-1",
        type: "AWARD",
        delta: 12,
        reason: "Duplicate award",
        trait: "COLLABORATION",
        createdAt: new Date("2026-06-20T12:00:00.000Z"),
        deletedAt: new Date("2026-06-21T12:00:00.000Z"),
        deletionReason: "Entered twice",
        actor: { displayName: "Olivia" },
        targetUser: { displayName: "Ben" },
        targetHouse: { name: "Phoenix", color: "#7c3aed" },
        deletedBy: { displayName: "Bob Admin" },
        season: { id: "season-active", name: "Q3 2026", isActive: true },
      },
    ]);
    mockInviteFindMany.mockResolvedValue([
      {
        id: "invite-1",
        createdAt: new Date("2026-06-21T11:00:00.000Z"),
        usedAt: new Date("2026-06-21T12:30:00.000Z"),
        expiresAt: new Date("2026-06-24T11:00:00.000Z"),
        createdBy: { displayName: "Bob Admin" },
        usedBy: { displayName: "Casey" },
      },
    ]);
    mockInviteCount
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockSeasonFindMany.mockResolvedValue([
      {
        id: "season-next",
        name: "Q4 2026",
        createdAt: new Date("2026-06-21T10:00:00.000Z"),
        createdBy: { displayName: "Olivia" },
      },
    ]);
    mockAuditEventFindMany.mockResolvedValue([
      {
        id: "audit-1",
        eventType: "USER_HOUSE_ASSIGNED",
        summary: "Bob Admin assigned Alice to Phoenix.",
        metadata: {
          targetUserId: "user-1",
          targetUserName: "Alice",
          targetHouseId: "house-1",
          targetHouseName: "Phoenix",
        },
        createdAt: new Date("2026-06-21T13:00:00.000Z"),
        actor: { displayName: "Bob Admin" },
      },
      {
        id: "audit-delete-1",
        eventType: "POINT_DELETED",
        summary: "Bob Admin deleted 12 points from Ben.",
        metadata: {
          transactionId: "tx-1",
          targetUserId: "user-ben",
          targetUserName: "Ben",
          targetHouseId: "house-1",
          targetHouseName: "Phoenix",
          delta: 12,
          trait: "COLLABORATION",
          awardReason: "Duplicate award",
          deletionReason: "Entered twice",
        },
        createdAt: new Date("2026-06-21T12:15:00.000Z"),
        actor: { displayName: "Bob Admin" },
      },
      {
        id: "audit-invite-used-1",
        eventType: "INVITE_USED",
        summary: "Casey joined with an invite link.",
        metadata: {
          inviteId: "invite-1",
          usedById: "user-casey",
          usedByName: "Casey",
        },
        createdAt: new Date("2026-06-21T12:30:00.000Z"),
        actor: { displayName: "Casey" },
      },
      {
        id: "audit-invite-created-1",
        eventType: "INVITE_CREATED",
        summary: "Bob Admin created an invite link.",
        metadata: {
          inviteId: "invite-1",
          expiresAt: "2026-06-24T11:00:00.000Z",
        },
        createdAt: new Date("2026-06-21T11:00:00.000Z"),
        actor: { displayName: "Bob Admin" },
      },
      {
        id: "audit-season-started-1",
        eventType: "SEASON_STARTED",
        summary: "Olivia started Q4 2026.",
        metadata: {
          seasonId: "season-next",
          seasonName: "Q4 2026",
          previousSeasonId: "season-active",
          previousSeasonName: "Q3 2026",
        },
        createdAt: new Date("2026-06-21T10:00:00.000Z"),
        actor: { displayName: "Olivia" },
      },
    ]);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/context",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().inviteStats).toEqual({
      generatedCount: 3,
      usedCount: 2,
    });
    expect(res.json().recentAdminActions).toEqual([
      {
        id: "audit-event:audit-1",
        type: "USER_HOUSE_ASSIGNED",
        occurredAt: "2026-06-21T13:00:00.000Z",
        actorName: "Bob Admin",
        summary: "Bob Admin assigned Alice to Phoenix.",
        metadata: {
          targetUserId: "user-1",
          targetUserName: "Alice",
          targetHouseId: "house-1",
          targetHouseName: "Phoenix",
        },
      },
      {
        id: "audit-event:audit-invite-used-1",
        type: "INVITE_USED",
        occurredAt: "2026-06-21T12:30:00.000Z",
        actorName: "Casey",
        summary: "Casey joined with an invite link.",
        metadata: {
          inviteId: "invite-1",
          usedById: "user-casey",
          usedByName: "Casey",
        },
      },
      {
        id: "audit-event:audit-delete-1",
        type: "POINT_DELETED",
        occurredAt: "2026-06-21T12:15:00.000Z",
        actorName: "Bob Admin",
        summary: "Bob Admin deleted 12 points from Ben.",
        metadata: {
          transactionId: "tx-1",
          targetUserId: "user-ben",
          targetUserName: "Ben",
          targetHouseId: "house-1",
          targetHouseName: "Phoenix",
          delta: "12",
          trait: "COLLABORATION",
          awardReason: "Duplicate award",
          deletionReason: "Entered twice",
        },
      },
      {
        id: "audit-event:audit-invite-created-1",
        type: "INVITE_CREATED",
        occurredAt: "2026-06-21T11:00:00.000Z",
        actorName: "Bob Admin",
        summary: "Bob Admin created an invite link.",
        metadata: {
          inviteId: "invite-1",
          expiresAt: "2026-06-24T11:00:00.000Z",
        },
      },
      {
        id: "audit-event:audit-season-started-1",
        type: "SEASON_STARTED",
        occurredAt: "2026-06-21T10:00:00.000Z",
        actorName: "Olivia",
        summary: "Olivia started Q4 2026.",
        metadata: {
          seasonId: "season-next",
          seasonName: "Q4 2026",
          previousSeasonId: "season-active",
          previousSeasonName: "Q3 2026",
        },
      },
    ]);
    expect(mockInviteFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
      }),
    );
    expect(mockInviteCount).toHaveBeenNthCalledWith(1, {
      where: { organizationId: "org-1" },
    });
    expect(mockInviteCount).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: "org-1",
        usedAt: { not: null },
      },
    });
    expect(mockSeasonFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-1",
          createdById: { not: null },
        },
      }),
    );
    expect(mockAuditEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
      }),
    );
    await app.close();
  });

  it("returns current-season point adjustment reporting by house", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({ organizationId: "org-secure" }));
    mockUserFindMany.mockResolvedValue([]);
    mockHouseFindMany.mockResolvedValue([
      { id: "house-1", name: "Phoenix", color: "#7c3aed", description: null },
      { id: "house-2", name: "Ember", color: "#ef4444", description: null },
    ]);
    mockSeasonFindFirst.mockResolvedValue({
      id: "season-active",
      name: "Q3 2026",
    });
    mockTxGroupBy.mockResolvedValue([
      {
        targetHouseId: "house-1",
        _count: { _all: 2 },
        _sum: { delta: -20 },
      },
    ]);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/context",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().pointAdjustmentStats).toEqual({
      seasonId: "season-active",
      seasonName: "Q3 2026",
      totalDeductionCount: 2,
      totalDeductedPoints: 20,
      byHouse: [
        {
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          deductionCount: 2,
          deductedPoints: 20,
        },
        {
          houseId: "house-2",
          houseName: "Ember",
          houseColor: "#ef4444",
          deductionCount: 0,
          deductedPoints: 0,
        },
      ],
    });
    expect(mockTxGroupBy).toHaveBeenCalledWith({
      by: ["targetHouseId"],
      where: {
        organizationId: "org-secure",
        type: "DEDUCTION",
        deletedAt: null,
        season: {
          isActive: true,
        },
      },
      _count: { _all: true },
      _sum: { delta: true },
    });
    await app.close();
  });
});

describe("POST /users/scores", () => {
  it("scopes member scores to the authenticated actor's organization", async () => {
    mockFindUnique.mockResolvedValue(
      makeMember({ organizationId: "org-secure" }),
    );
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockTxGroupBy.mockResolvedValue([
      { targetUserId: "user-1", _sum: { delta: 42 } },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/users/scores",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockTxGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-secure",
          seasonId: "season-active",
          deletedAt: null,
          targetUserId: { not: null },
        },
      }),
    );
    await app.close();
  });

  it("uses a requested historical season for member scores", async () => {
    mockFindUnique.mockResolvedValue(makeMember({ organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(SEASON_ZERO);
    mockTxGroupBy.mockResolvedValue([
      { targetUserId: "user-1", _sum: { delta: 12 } },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/users/scores",
      payload: { seasonId: "season-0" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "season-0",
          organizationId: "org-secure",
        },
      }),
    );
    expect(mockTxGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seasonId: "season-0",
        }),
      }),
    );
    await app.close();
  });

  it("rejects cross-organization or unknown season IDs for member scores", async () => {
    mockFindUnique.mockResolvedValue(makeMember({ organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(null);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/users/scores",
      payload: { seasonId: "other-season" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("SEASON_NOT_FOUND");
    expect(mockTxGroupBy).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /members", () => {
  it("scopes member reads to the authenticated actor's organization", async () => {
    mockFindUnique.mockResolvedValue(
      makeMember({ organizationId: "org-secure" }),
    );
    mockUserFindMany.mockResolvedValue([
      {
        id: "user-1",
        displayName: "Alice",
        role: "MEMBER",
        houseId: "house-1",
        house: { name: "Phoenix", color: "#7c3aed" },
      },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/members",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-secure" },
      }),
    );
    await app.close();
  });
});

describe("POST /dashboard/summary", () => {
  it("returns 403 ACTOR_NOT_MAPPED when actor is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/dashboard/summary",
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACTOR_NOT_MAPPED");
    await app.close();
  });

  it("returns organization-wide reporting summary", async () => {
    const now = new Date();
    mockFindUnique.mockResolvedValue(makeMember());
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockHouseFindMany.mockResolvedValue([
      { id: "house-1", name: "Phoenix", color: "#7c3aed" },
      { id: "house-2", name: "Ember", color: "#ef4444" },
    ]);
    mockTxGroupBy
      .mockResolvedValueOnce([
        { targetUserId: "user-1", targetHouseId: "house-1", _sum: { delta: 30 } },
        { targetUserId: "user-3", targetHouseId: "house-2", _sum: { delta: 10 } },
      ])
      .mockResolvedValueOnce([
        { targetHouseId: "house-1", trait: "COLLABORATION", _count: { trait: 2 } },
        { targetHouseId: "house-1", trait: "LEADERSHIP", _count: { trait: 1 } },
        { targetHouseId: "house-2", trait: "INNOVATION", _count: { trait: 1 } },
      ])
      .mockResolvedValueOnce([
        { targetUserId: "user-1", _sum: { delta: 55 } },
        { targetUserId: "user-2", _sum: { delta: 5 } },
        { targetUserId: "user-3", _sum: { delta: 10 } },
      ]);
    mockTxFindMany
      .mockResolvedValueOnce([
        {
          id: "tx-1",
          type: "AWARD",
          delta: 12,
          reason: "Great collaboration",
          trait: "COLLABORATION",
          createdAt: now,
          actor: { displayName: "Bob" },
          targetUser: { displayName: "Alice" },
          targetHouse: { name: "Phoenix", color: "#7c3aed" },
          season: { id: "season-active", name: "Q3 2026", isActive: true },
        },
      ])
      .mockResolvedValueOnce([
        { targetHouseId: "house-1", delta: 12, createdAt: now },
        { targetHouseId: "house-2", delta: 4, createdAt: now },
      ]);
    mockUserFindMany.mockResolvedValue([
      {
        id: "user-1",
        displayName: "Alice",
        role: "MEMBER",
        houseId: "house-1",
      },
      {
        id: "user-2",
        displayName: "Bob",
        role: "ADMIN",
        houseId: "house-1",
      },
      {
        id: "user-3",
        displayName: "Cora",
        role: "MEMBER",
        houseId: "house-2",
      },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/dashboard/summary",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.generatedAt).toEqual(expect.any(String));
    expect(body.selectedSeason).toEqual({
      id: "season-active",
      name: "Q3 2026",
      startsAt: "2026-07-01T00:00:00.000Z",
      endsAt: null,
      isActive: true,
    });
    expect(body.seasonStartsAt).toBe("2026-07-01T00:00:00.000Z");
    expect(body.monthStartsAt).toBe("2026-07-01T00:00:00.000Z");
    expect(body.seasonStandout).toEqual({
      memberId: "user-1",
      memberName: "Alice",
      houseId: "house-1",
      houseName: "Phoenix",
      houseColor: "#7c3aed",
      points: 30,
    });
    expect(body.monthlyStandout).toEqual({
      memberId: "user-1",
      memberName: "Alice",
      houseId: "house-1",
      houseName: "Phoenix",
      houseColor: "#7c3aed",
      points: 30,
    });
    expect(body.monthlyStandoutsByHouse).toEqual([
      {
        houseId: "house-1",
        standout: {
          memberId: "user-1",
          memberName: "Alice",
          houseId: "house-1",
          houseName: "Phoenix",
          houseColor: "#7c3aed",
          points: 30,
        },
      },
      {
        houseId: "house-2",
        standout: {
          memberId: "user-3",
          memberName: "Cora",
          houseId: "house-2",
          houseName: "Ember",
          houseColor: "#ef4444",
          points: 10,
        },
      },
    ]);
    expect(body.traitLeaders).toEqual([
      {
        houseId: "house-1",
        houseName: "Phoenix",
        houseColor: "#7c3aed",
        trait: "COLLABORATION",
        count: 2,
      },
      {
        houseId: "house-2",
        houseName: "Ember",
        houseColor: "#ef4444",
        trait: "INNOVATION",
        count: 1,
      },
    ]);
    expect(body.recentActivity).toEqual([
      {
        id: "tx-1",
        type: "AWARD",
        actorName: "Bob",
        targetUserName: "Alice",
        targetHouseName: "Phoenix",
        targetHouseColor: "#7c3aed",
        delta: 12,
        reason: "Great collaboration",
        trait: "COLLABORATION",
        createdAt: now.toISOString(),
        season: {
          id: "season-active",
          name: "Q3 2026",
          isActive: true,
        },
      },
    ]);
    expect(body.pointsVelocity).toHaveLength(2);
    expect(body.pointsVelocity[0].days).toHaveLength(14);
    expect(body.pointsVelocity[0].days.at(-1).points).toBe(12);
    expect(body.houseMemberRankings).toEqual([
      {
        houseId: "house-1",
        members: [
          { memberId: "user-1", displayName: "Alice", role: "MEMBER", points: 55 },
          { memberId: "user-2", displayName: "Bob", role: "ADMIN", points: 5 },
        ],
      },
      {
        houseId: "house-2",
        members: [
          { memberId: "user-3", displayName: "Cora", role: "MEMBER", points: 10 },
        ],
      },
    ]);
    for (const call of mockHouseFindMany.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: { organizationId: "org-1" },
        }),
      );
    }
    expect(mockUserFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1" },
      }),
    );
    for (const call of mockTxFindMany.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            seasonId: "season-active",
          }),
        }),
      );
    }
    for (const call of mockTxGroupBy.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: "org-1",
            seasonId: "season-active",
          }),
        }),
      );
    }
    await app.close();
  });

  it("uses a requested historical season for reporting summary", async () => {
    mockFindUnique.mockResolvedValue(makeMember({ organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(SEASON_ZERO);
    mockHouseFindMany.mockResolvedValue([]);
    mockTxGroupBy.mockResolvedValue([]);
    mockTxFindMany.mockResolvedValue([]);
    mockUserFindMany.mockResolvedValue([]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/dashboard/summary",
      payload: { seasonId: "season-0" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockSeasonFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "season-0",
          organizationId: "org-secure",
        },
      }),
    );
    expect(res.json().selectedSeason.id).toBe("season-0");
    for (const call of mockTxFindMany.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ seasonId: "season-0" }),
        }),
      );
    }
    for (const call of mockTxGroupBy.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({ seasonId: "season-0" }),
        }),
      );
    }
    await app.close();
  });
});

describe("POST /orgs/create", () => {
  const payload = {
    displayName: "Alice",
    email: "alice@example.com",
    orgName: "Acme Corp",
    orgSlug: "acme",
    firstHouseName: "Phoenix",
    firstHouseColor: "#7c3aed",
  };

  it("returns SLUG_TAKEN before starting setup when organization slug already exists", async () => {
    mockOrgFindUnique.mockResolvedValue({ id: "org-existing" });
    const app = await buildTestApp("auth0|member");

    const res = await app.inject({
      method: "POST",
      url: "/orgs/create",
      payload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("SLUG_TAKEN");
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockOrgCreate).not.toHaveBeenCalled();
    expect(mockHouseCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns ALREADY_IN_ORG before starting setup when identity already belongs to an organization", async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
        organizationId: "org-existing",
      },
    });
    const app = await buildTestApp("auth0|member");

    const res = await app.inject({
      method: "POST",
      url: "/orgs/create",
      payload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ALREADY_IN_ORG");
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockOrgCreate).not.toHaveBeenCalled();
    expect(mockHouseCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("atomically creates the organization, first house, and assigned owner", async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      organizationId: null,
    });
    mockOrgCreate.mockResolvedValue(ORG);
    mockHouseCreate.mockResolvedValue(HOUSE);
    mockSeasonCreate.mockResolvedValue({ id: "season-0" });
    mockUserUpdate.mockResolvedValue(
      makeMember({
        role: "OWNER",
        email: "alice@example.com",
        organization: { slug: "acme" },
      }),
    );
    const app = await buildTestApp("auth0|member");

    const res = await app.inject({
      method: "POST",
      url: "/orgs/create",
      payload,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      role: "OWNER",
      organizationId: "org-1",
      houseId: "house-1",
      houseName: "Phoenix",
    });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockHouseCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        name: "Phoenix",
        color: "#7c3aed",
      },
      select: { id: true, name: true, color: true },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: "org-1",
          houseId: "house-1",
          role: "OWNER",
        }),
      }),
    );
    expect(mockSeasonCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        name: "Season 0",
        startsAt: expect.any(Date),
        isActive: true,
        createdById: "user-1",
      },
      select: { id: true },
    });
    await app.close();
  });

  it("returns an error when the atomic setup transaction fails", async () => {
    mockOrgFindUnique.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      organizationId: null,
    });
    mockTransaction.mockRejectedValue(new Error("transaction failed"));
    const app = await buildTestApp("auth0|member");

    const res = await app.inject({
      method: "POST",
      url: "/orgs/create",
      payload,
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    expect(mockTransaction).toHaveBeenCalledOnce();
    await app.close();
  });
});

describe("POST /orgs/invite", () => {
  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/invite",
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    expect(mockInviteCreate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an admin to create a single-use invite for their organization", async () => {
    const expiresAt = new Date("2099-01-01T00:00:00.000Z");
    mockFindUnique.mockResolvedValue(makeAdmin({ organizationId: "org-secure" }));
    mockInviteCreate.mockResolvedValue({
      id: "invite-1",
      expiresAt,
    });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/orgs/invite",
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({
      id: "invite-1",
      token: expect.stringMatching(/^[a-f0-9]{64}$/),
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
    });
    expect(mockInviteCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-secure",
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        createdById: "user-2",
        expiresAt: expect.any(Date),
      },
      select: { id: true, expiresAt: true },
    });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-secure",
        actorUserId: "user-2",
        eventType: "INVITE_CREATED",
        summary: "Bob created an invite link.",
        metadata: {
          inviteId: "invite-1",
          expiresAt: expiresAt.toISOString(),
        },
      },
    });
    await app.close();
  });
});

describe("POST /orgs/join", () => {
  const payload = {
    displayName: "Alice",
    email: "alice@example.com",
    inviteToken: "single-use-token",
  };
  const invite = {
    id: "invite-1",
    organizationId: "org-1",
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    usedAt: null,
  };
  const joinedUser = makeMember({
    email: "alice@example.com",
    houseId: null,
    house: null,
  });

  it("rejects a malformed invite before starting a transaction", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload: { ...payload, inviteToken: "" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns INVITE_NOT_FOUND for an unknown token", async () => {
    mockInviteFindUnique.mockResolvedValue(null);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("INVITE_NOT_FOUND");
    await app.close();
  });

  it("returns INVITE_USED for an already claimed token", async () => {
    mockInviteFindUnique.mockResolvedValue({
      ...invite,
      usedAt: new Date("2026-01-01T00:00:00Z"),
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("INVITE_USED");
    await app.close();
  });

  it("returns INVITE_EXPIRED for an expired token", async () => {
    mockInviteFindUnique.mockResolvedValue({
      ...invite,
      expiresAt: new Date("2020-01-01T00:00:00Z"),
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(410);
    expect(res.json().code).toBe("INVITE_EXPIRED");
    await app.close();
  });

  it("updates membership and claims the invite in one transaction", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue(joinedUser);
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      organizationId: "org-1",
      houseId: null,
      created: true,
    });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockInviteUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "invite-1",
        usedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: {
        usedAt: expect.any(Date),
        usedById: "user-1",
      },
    });
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorUserId: "user-1",
        eventType: "INVITE_USED",
        summary: "Alice joined with an invite link.",
        metadata: {
          inviteId: "invite-1",
          usedById: "user-1",
          usedByName: "Alice",
        },
      },
    });
    await app.close();
  });

  it("does not claim an invite for a user already in another organization", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      organizationId: "org-other",
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ALREADY_IN_ORG");
    expect(mockInviteUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows exactly one winner when two requests claim the same invite", async () => {
    let readers = 0;
    let releaseReaders: (() => void) | undefined;
    const bothReadersReady = new Promise<void>((resolve) => {
      releaseReaders = resolve;
    });
    let claimed = false;

    mockInviteFindUnique.mockImplementation(async () => {
      readers += 1;
      if (readers === 2) {
        releaseReaders?.();
      }
      await bothReadersReady;
      return invite;
    });
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      organizationId: null,
    });
    mockUserUpdate.mockResolvedValue(joinedUser);
    mockInviteUpdateMany.mockImplementation(async () => {
      if (claimed) {
        return { count: 0 };
      }
      claimed = true;
      return { count: 1 };
    });
    const app = await buildTestApp();

    const responses = await Promise.all([
      app.inject({ method: "POST", url: "/orgs/join", payload }),
      app.inject({ method: "POST", url: "/orgs/join", payload }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200,
      409,
    ]);
    expect(
      responses.find((response) => response.statusCode === 409)?.json().code,
    ).toBe("INVITE_USED");
    expect(mockInviteUpdateMany).toHaveBeenCalledTimes(2);
    await app.close();
  });
});
