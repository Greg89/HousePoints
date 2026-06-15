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

// â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("GET /health", () => {
  it("returns 200 { ok: true }", async () => {
    const app = await buildApp();
    expect(app.server.listening).toBe(false);

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(app.server.listening).toBe(false);
    await app.close();
  });
});

describe("POST /users/bootstrap", () => {
  it("returns existing user (created: false) when already mapped", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      payload: { auth0Sub: "auth0|member", displayName: "Alice" },
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
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      payload: { auth0Sub: "auth0|new", displayName: "Carol" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().created).toBe(true);
    await app.close();
  });

  it("returns 400 VALIDATION_ERROR for missing auth0Sub", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/users/bootstrap",
      payload: { displayName: "Nobody" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});

describe("POST /points/adjust", () => {
  it("returns 403 ACTOR_NOT_MAPPED when actor is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { actorAuth0Sub: "auth0|ghost", targetUserId: "user-1", delta: 10, reason: "Great sprint work", trait: "COLLABORATION" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACTOR_NOT_MAPPED");
    await app.close();
  });

  it("returns 403 when target user is from a different org", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())  // getActorBySub
      .mockResolvedValueOnce(makeMember({ organizationId: "org-OTHER" })); // target user
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { actorAuth0Sub: "auth0|admin", targetUserId: "user-1", delta: 10, reason: "Great sprint work", trait: "COLLABORATION" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("CROSS_ORGANIZATION_TARGET");
    await app.close();
  });

  it("returns 422 TARGET_USER_UNASSIGNED when target has no house", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())   // getActorBySub
      .mockResolvedValueOnce(makeMember({ houseId: null })); // target user: no house
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { actorAuth0Sub: "auth0|admin", targetUserId: "user-1", delta: 10, reason: "Great sprint work", trait: "LEADERSHIP" },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("TARGET_USER_UNASSIGNED");
    await app.close();
  });

  it("returns 400 VALIDATION_ERROR for negative delta", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { actorAuth0Sub: "auth0|admin", targetUserId: "user-1", delta: -5, reason: "Bad attempt", trait: "INNOVATION" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    await app.close();
  });

  it("returns 400 VALIDATION_ERROR when trait is missing", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: { actorAuth0Sub: "auth0|admin", targetUserId: "user-1", delta: 10, reason: "Good work" },
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
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: {
        actorAuth0Sub: "auth0|admin",
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
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/houses",
      payload: { actorAuth0Sub: "auth0|member", name: "Gryffindor", color: "#ff0000" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    await app.close();
  });

  it("returns 201 and creates house when actor is admin", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    mockHouseUpsert.mockResolvedValue(HOUSE);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/houses",
      payload: { actorAuth0Sub: "auth0|admin", name: "Phoenix", color: "#7c3aed" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe("Phoenix");
    await app.close();
  });
});

describe("POST /admin/users/assign-house", () => {
  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/users/assign-house",
      payload: { actorAuth0Sub: "auth0|member", targetUserId: "user-1", targetHouseId: "house-1" },
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
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/users/assign-house",
      payload: { actorAuth0Sub: "auth0|admin", targetUserId: "user-999", targetHouseId: "house-1" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
describe("POST /transactions/recent", () => {
  it("returns 403 ACTOR_NOT_MAPPED when actor is not found", async () => {
    mockFindUnique.mockResolvedValue(null);
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: { actorAuth0Sub: "auth0|ghost" },
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
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: { actorAuth0Sub: "auth0|member" },
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
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: { actorAuth0Sub: "auth0|member" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0].trait).toBeNull();
    await app.close();
  });
});
