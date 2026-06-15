/**
 * API integration tests using Fastify's app.inject() â€” no real network or DB.
 * Prisma is mocked per test so we control exactly what the DB "returns".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// â”€â”€ Mock @housepoints/db before importing anything that uses it â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vi.mock("@housepoints/db", () => ({
  prisma: {
    organization: { upsert: vi.fn() },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    house: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    pointTransaction: {
      create: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

// â”€â”€ Also mock dotenv/config (no .env file needed in CI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
vi.mock("dotenv/config", () => ({}));

import { buildApp } from "./app";
import { prisma } from "@housepoints/db";

// Typed shorthand helpers
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockCreate = prisma.user.create as ReturnType<typeof vi.fn>;
const mockOrgUpsert = prisma.organization.upsert as ReturnType<typeof vi.fn>;
const mockHouseUpsert = prisma.house.upsert as ReturnType<typeof vi.fn>;
const mockHouseFindUnique = prisma.house.findUnique as ReturnType<typeof vi.fn>;
const mockTxCreate = prisma.pointTransaction.create as ReturnType<typeof vi.fn>;
const mockTxFindMany = prisma.pointTransaction.findMany as ReturnType<typeof vi.fn>;

// â”€â”€ Shared fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ORG = { id: "org-1", slug: "acme", name: "Acme Corp" };
const HOUSE = { id: "house-1", name: "Phoenix", color: "#7c3aed", description: null, organizationId: "org-1" };

/** Full user shape returned by prisma.user.findUnique (matches select in app.ts) */
const makeMember = (overrides = {}) => ({
  id: "user-1",
  auth0Sub: "auth0|member",
  email: "member@acme.com",
  displayName: "Alice",
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
  role: "ADMIN" as const,
  houseId: "house-1",
  organizationId: "org-1",
  organization: { slug: "acme" },
  house: { name: "Phoenix", color: "#7c3aed" },
  ...overrides,
});

// Reset all mock implementations before each test to ensure isolation
beforeEach(() => vi.resetAllMocks());

async function buildTestApp(subject = "auth0|member") {
  const app = await buildApp({
    verifyAccessToken: vi.fn().mockResolvedValue({
      subject,
      claims: { sub: subject },
    }),
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
    const app = await buildApp({ verifyAccessToken });

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(verifyAccessToken).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects a protected endpoint without a bearer token", async () => {
    const app = await buildApp({
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
    const app = await buildApp({ verifyAccessToken });

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
    mockTxCreate.mockResolvedValue({
      id: "tx-abc",
      organizationId: "org-1",
      actorUserId: "user-2",
      targetUserId: "user-1",
      targetHouseId: "house-1",
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
    await app.close();
  });
});

describe("POST /admin/houses", () => {
  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember()); // role = MEMBER
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/houses",
      payload: { name: "Gryffindor", color: "#ff0000" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    await app.close();
  });

  it("returns 201 and creates house when actor is admin", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
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

  it("returns activity items with trait included", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindMany.mockResolvedValue([
      {
        id: "tx-1",
        delta: 10,
        reason: "Great collaboration",
        trait: "COLLABORATION",
        createdAt: new Date("2026-01-01T12:00:00Z"),
        actor: { displayName: "Bob" },
        targetUser: { displayName: "Alice" },
        targetHouse: { name: "Phoenix", color: "#7c3aed" },
      },
    ]);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    const items = res.json();
    expect(items).toHaveLength(1);
    expect(items[0].trait).toBe("COLLABORATION");
    expect(items[0].actorName).toBe("Bob");
    expect(items[0].delta).toBe(10);
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
      },
    ]);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0].trait).toBeNull();
    await app.close();
  });
});
