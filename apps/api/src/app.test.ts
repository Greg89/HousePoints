/**
 * API integration tests using Fastify's app.inject() - no real network or DB.
 * Prisma is mocked per test so we control exactly what the DB "returns".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @housepoints/db before importing anything that uses it.
vi.mock("@housepoints/db", () => ({
  createPrimaryOrganizationSlugAlias: vi.fn(),
  isOrganizationSlugReserved: vi.fn(),
  resolveOrganizationSlug: vi.fn(),
  updateUserDisplayName: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    organization: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    organizationMembership: {
      findFirst: vi.fn(),
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
    organizationSlugAlias: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    releaseAnnouncement: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
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
    pointReaction: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Also mock dotenv/config (no .env file needed in CI).
vi.mock("dotenv/config", () => ({}));

import { buildApp } from "./app";
import {
  createPrimaryOrganizationSlugAlias,
  isOrganizationSlugReserved,
  prisma,
  resolveOrganizationSlug,
  updateUserDisplayName,
} from "@housepoints/db";

// Typed shorthand helpers
const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>;
const mockUserFindMany = prisma.user.findMany as ReturnType<typeof vi.fn>;
const mockMembershipFindFirst = prisma.organizationMembership.findFirst as ReturnType<typeof vi.fn>;
const mockMembershipFindMany = prisma.organizationMembership.findMany as ReturnType<typeof vi.fn>;
const mockMembershipCreate = prisma.organizationMembership.create as ReturnType<typeof vi.fn>;
const mockMembershipUpdate = prisma.organizationMembership.update as ReturnType<typeof vi.fn>;
const mockCreate = prisma.user.create as ReturnType<typeof vi.fn>;
const mockUserUpdate = prisma.user.update as ReturnType<typeof vi.fn>;
const mockAuthIdentityFindUnique = prisma.authIdentity.findUnique as ReturnType<typeof vi.fn>;
const mockAuthIdentityCreate = prisma.authIdentity.create as ReturnType<typeof vi.fn>;
const mockOrgUpsert = prisma.organization.upsert as ReturnType<typeof vi.fn>;
const mockOrgCreate = prisma.organization.create as ReturnType<typeof vi.fn>;
const mockOrgUpdate = prisma.organization.update as ReturnType<typeof vi.fn>;
const mockHouseUpsert = prisma.house.upsert as ReturnType<typeof vi.fn>;
const mockHouseCreate = prisma.house.create as ReturnType<typeof vi.fn>;
const mockHouseFindMany = prisma.house.findMany as ReturnType<typeof vi.fn>;
const mockHouseFindUnique = prisma.house.findUnique as ReturnType<typeof vi.fn>;
const mockInviteCreate = prisma.orgInvite.create as ReturnType<typeof vi.fn>;
const mockInviteCount = prisma.orgInvite.count as ReturnType<typeof vi.fn>;
const mockInviteFindMany = prisma.orgInvite.findMany as ReturnType<typeof vi.fn>;
const mockInviteFindUnique = prisma.orgInvite.findUnique as ReturnType<typeof vi.fn>;
const mockInviteUpdateMany = prisma.orgInvite.updateMany as ReturnType<typeof vi.fn>;
const mockCreatePrimaryOrganizationSlugAlias = createPrimaryOrganizationSlugAlias as ReturnType<typeof vi.fn>;
const mockIsOrganizationSlugReserved = isOrganizationSlugReserved as ReturnType<typeof vi.fn>;
const mockResolveOrganizationSlug = resolveOrganizationSlug as ReturnType<typeof vi.fn>;
const mockUpdateUserDisplayName = updateUserDisplayName as ReturnType<typeof vi.fn>;
const mockOrgSlugAliasCreate = prisma.organizationSlugAlias.create as ReturnType<typeof vi.fn>;
const mockOrgSlugAliasUpdateMany = prisma.organizationSlugAlias.updateMany as ReturnType<typeof vi.fn>;
const mockAuditEventCreate = prisma.auditEvent.create as ReturnType<typeof vi.fn>;
const mockAuditEventFindMany = prisma.auditEvent.findMany as ReturnType<typeof vi.fn>;
const mockNotificationCount = prisma.notification.count as ReturnType<typeof vi.fn>;
const mockNotificationCreateMany = prisma.notification.createMany as ReturnType<typeof vi.fn>;
const mockNotificationFindMany = prisma.notification.findMany as ReturnType<typeof vi.fn>;
const mockNotificationUpdateMany = prisma.notification.updateMany as ReturnType<typeof vi.fn>;
const mockReleaseAnnouncementFindUnique = prisma.releaseAnnouncement.findUnique as ReturnType<typeof vi.fn>;
const mockReleaseAnnouncementUpsert = prisma.releaseAnnouncement.upsert as ReturnType<typeof vi.fn>;
const mockReleaseAnnouncementUpdate = prisma.releaseAnnouncement.update as ReturnType<typeof vi.fn>;
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
const mockPointReactionCreate = prisma.pointReaction.create as ReturnType<typeof vi.fn>;
const mockPointReactionFindFirst = prisma.pointReaction.findFirst as ReturnType<typeof vi.fn>;
const mockPointReactionFindMany = prisma.pointReaction.findMany as ReturnType<typeof vi.fn>;
const mockPointReactionUpdate = prisma.pointReaction.update as ReturnType<typeof vi.fn>;
const mockTransaction = prisma.$transaction as ReturnType<typeof vi.fn>;
const TEST_CORS_ORIGINS = ["http://localhost:3000"];

// Shared fixtures.
const ORG = { id: "org-1", slug: "acme", name: "Acme Corp" };
const HOUSE = {
  id: "house-1",
  name: "Phoenix",
  color: "#7c3aed",
  description: null,
  organizationId: "org-1",
  themeMode: "GENERATED",
  themeSecondaryColor: null,
  themeSurfaceColor: null,
};
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

type TestUserRole = "MEMBER" | "ADMIN" | "OWNER";

type TestMembershipOverrides = {
  id?: string;
  organizationId?: string;
  role?: TestUserRole;
  houseId?: string | null;
  organization?: { name: string; slug: string };
  house?: { name: string; color: string } | null;
};

const makeUserMembership = (userId: string, overrides: TestMembershipOverrides = {}) => ({
  id: `membership-${userId}`,
  organizationId: "org-1",
  role: "MEMBER" as TestUserRole,
  houseId: "house-1",
  organization: { name: "Acme Corp", slug: "acme" },
  house: { name: "Phoenix", color: "#7c3aed" },
  ...overrides,
});

/** Full user shape returned by prisma.user.findUnique (matches select in app.ts) */
const withDefaultMembership = <T extends {
  id: string;
  memberships?: unknown[];
}>(user: T, membershipOverrides: TestMembershipOverrides | null = {}): T & { memberships: unknown[] } => ({
  ...user,
  memberships: user.memberships ?? (membershipOverrides === null ? [] : [makeUserMembership(user.id, membershipOverrides)]),
});

const makeMember = (overrides = {}, membershipOverrides: TestMembershipOverrides | null = {}) => withDefaultMembership({
  id: "user-1",
  auth0Sub: "auth0|member",
  email: "member@acme.com",
  displayName: "Alice",
  houseThemeEnabled: false,
  role: "MEMBER" as const,
  houseId: "house-1",
  organizationId: "org-1",
  organization: { name: "Acme Corp", slug: "acme" },
  house: { name: "Phoenix", color: "#7c3aed" },
  ...overrides,
}, membershipOverrides === null ? null : { role: "MEMBER", ...membershipOverrides });

const makeAdmin = (overrides = {}, membershipOverrides: TestMembershipOverrides | null = {}) => withDefaultMembership({
  id: "user-2",
  auth0Sub: "auth0|admin",
  email: "admin@acme.com",
  displayName: "Bob",
  houseThemeEnabled: false,
  role: "ADMIN" as const,
  houseId: "house-1",
  organizationId: "org-1",
  organization: { name: "Acme Corp", slug: "acme" },
  house: { name: "Phoenix", color: "#7c3aed" },
  ...overrides,
}, membershipOverrides === null ? null : { role: "ADMIN", ...membershipOverrides });

const makeOwner = (overrides = {}, membershipOverrides: TestMembershipOverrides | null = {}) => withDefaultMembership({
  id: "user-owner",
  auth0Sub: "auth0|owner",
  email: "owner@acme.com",
  displayName: "Olivia",
  houseThemeEnabled: false,
  role: "OWNER" as const,
  houseId: "house-1",
  organizationId: "org-1",
  organization: { name: "Acme Corp", slug: "acme" },
  house: { name: "Phoenix", color: "#7c3aed" },
  ...overrides,
}, membershipOverrides === null ? null : { role: "OWNER", ...membershipOverrides });

const makeTargetMembership = (overrides = {}) => ({
  userId: "user-1",
  houseId: "house-1",
  user: {
    id: "user-1",
    displayName: "Alice",
  },
  ...overrides,
});

const makeActorMembership = (overrides = {}) => ({
  id: "membership-admin",
  organizationId: "org-1",
  role: "ADMIN" as const,
  houseId: "house-1",
  organization: { name: "Acme Corp", slug: "acme" },
  ...overrides,
});

// Reset all mock implementations before each test to ensure isolation
beforeEach(() => {
  vi.resetAllMocks();
  mockTxFindMany.mockResolvedValue([]);
  mockTxFindFirst.mockResolvedValue(null);
  mockTxGroupBy.mockResolvedValue([]);
  mockPointReactionCreate.mockResolvedValue({ id: "reaction-1", reactionKey: "clap" });
  mockPointReactionFindFirst.mockResolvedValue(null);
  mockPointReactionFindMany.mockResolvedValue([]);
  mockPointReactionUpdate.mockResolvedValue({ id: "reaction-1", reactionKey: "clap" });
  mockUserFindMany.mockResolvedValue([]);
  mockMembershipFindFirst.mockResolvedValue(null);
  mockMembershipFindMany.mockResolvedValue([]);
  mockInviteCount.mockResolvedValue(0);
  mockInviteFindMany.mockResolvedValue([]);
  mockIsOrganizationSlugReserved.mockResolvedValue(false);
  mockCreatePrimaryOrganizationSlugAlias.mockResolvedValue(undefined);
  mockResolveOrganizationSlug.mockResolvedValue(null);
  mockUpdateUserDisplayName.mockImplementation(
    (
      client: typeof prisma,
      input: {
        userId: string;
        displayName: string;
        data?: Record<string, unknown>;
        select: Record<string, unknown>;
      },
    ) => client.user.update({
      where: { id: input.userId },
      data: {
        ...input.data,
        displayName: input.displayName,
      },
      select: input.select,
    }),
  );
  mockSeasonFindMany.mockResolvedValue([]);
  mockAuditEventFindMany.mockResolvedValue([]);
  mockAuditEventCreate.mockResolvedValue({});
  mockNotificationCount.mockResolvedValue(0);
  mockNotificationCreateMany.mockResolvedValue({ count: 0 });
  mockNotificationFindMany.mockResolvedValue([]);
  mockNotificationUpdateMany.mockResolvedValue({ count: 0 });
  const releaseAnnouncement = {
    id: "release-1",
    version: "v1.2.3",
    title: "Release notes automation",
    summary: "Adds app-owned release records.",
    releaseNotesUrl: "https://example.com/releases/v1.2.3.html",
    releasedAt: new Date("2026-07-04T18:00:00.000Z"),
    broadcastAt: null,
    createdAt: new Date("2026-07-04T18:01:00.000Z"),
    updatedAt: new Date("2026-07-04T18:02:00.000Z"),
  };
  mockReleaseAnnouncementFindUnique.mockResolvedValue(releaseAnnouncement);
  mockReleaseAnnouncementUpsert.mockResolvedValue(releaseAnnouncement);
  mockReleaseAnnouncementUpdate.mockResolvedValue({
    ...releaseAnnouncement,
    broadcastAt: new Date("2026-07-04T18:03:00.000Z"),
    updatedAt: new Date("2026-07-04T18:03:00.000Z"),
  });
  delete process.env.RELEASE_AUTOMATION_SECRET;
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

// Tests.

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

describe("POST /system/releases/record", () => {
  const releasePayload = {
    version: "v1.2.3",
    title: "Release notes automation",
    summary: "Adds app-owned release records.",
    releaseNotesUrl: "https://example.com/releases/v1.2.3.html",
    releasedAt: "2026-07-04T18:00:00.000Z",
  };

  it("records release metadata when the automation secret matches", async () => {
    process.env.RELEASE_AUTOMATION_SECRET = "release-secret-123";
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/system/releases/record",
      headers: {
        "x-housepoints-release-secret": "release-secret-123",
      },
      payload: releasePayload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "release-1",
      ...releasePayload,
      broadcastAt: null,
      createdAt: "2026-07-04T18:01:00.000Z",
      updatedAt: "2026-07-04T18:02:00.000Z",
    });
    expect(mockReleaseAnnouncementUpsert).toHaveBeenCalledWith({
      where: { version: "v1.2.3" },
      create: {
        version: "v1.2.3",
        title: "Release notes automation",
        summary: "Adds app-owned release records.",
        releaseNotesUrl: "https://example.com/releases/v1.2.3.html",
        releasedAt: new Date("2026-07-04T18:00:00.000Z"),
      },
      update: {
        title: "Release notes automation",
        summary: "Adds app-owned release records.",
        releaseNotesUrl: "https://example.com/releases/v1.2.3.html",
        releasedAt: new Date("2026-07-04T18:00:00.000Z"),
      },
      select: {
        id: true,
        version: true,
        title: true,
        summary: true,
        releaseNotesUrl: true,
        releasedAt: true,
        broadcastAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await app.close();
  });

  it("fails closed when release automation is not configured", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/system/releases/record",
      headers: {
        "x-housepoints-release-secret": "release-secret-123",
      },
      payload: releasePayload,
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      code: "RELEASE_AUTOMATION_NOT_CONFIGURED",
    });
    expect(mockReleaseAnnouncementUpsert).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects invalid release automation secrets", async () => {
    process.env.RELEASE_AUTOMATION_SECRET = "release-secret-123";
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/system/releases/record",
      headers: {
        "x-housepoints-release-secret": "wrong-secret-value",
      },
      payload: releasePayload,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      code: "INVALID_RELEASE_AUTOMATION_SECRET",
    });
    expect(mockReleaseAnnouncementUpsert).not.toHaveBeenCalled();

    await app.close();
  });

  it("validates release metadata before writing", async () => {
    process.env.RELEASE_AUTOMATION_SECRET = "release-secret-123";
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/system/releases/record",
      headers: {
        "x-housepoints-release-secret": "release-secret-123",
      },
      payload: {
        ...releasePayload,
        releaseNotesUrl: "not-a-url",
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(mockReleaseAnnouncementUpsert).not.toHaveBeenCalled();

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
      "authorization, content-type, x-request-id, x-auth0-id-token, x-housepoints-release-secret",
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
      organization: { name: "Acme Corp", slug: "acme" },
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
      .mockResolvedValueOnce(makeMember({}, { organizationId: "org-OTHER" })); // target user
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
    mockFindUnique.mockResolvedValueOnce(makeAdmin());
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({ houseId: null }));
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

  it("awards points, notifies the recipient, and returns 201 with the transaction id and trait", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin());
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership());
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
    expect(mockMembershipFindFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        userId: "user-1",
        isActive: true,
        archivedAt: null,
      },
      select: {
        userId: true,
        houseId: true,
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [{
        organizationId: "org-1",
        recipientUserId: "user-1",
        type: "POINT_AWARD_RECEIVED",
        severity: "INFO",
        title: "Points awarded",
        body: "Bob awarded you 15 points for Technical Excellence.",
        actionLabel: "View activity",
        actionHref: "/?tab=activity",
        entityType: "PointTransaction",
        entityId: "tx-abc",
        dedupeKey: "point-award-received:org-1:tx-abc",
      }],
      skipDuplicates: true,
    });
    await app.close();
  });

  it("does not create a recipient notification for self-awards", async () => {
    const actor = makeAdmin({ id: "user-2", houseId: "house-1", organizationId: "org-1" });
    mockFindUnique.mockResolvedValueOnce(actor);
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({
      userId: "user-2",
      user: { id: "user-2", displayName: "Bob" },
    }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockTxCreate.mockResolvedValue({
      id: "tx-self",
      organizationId: "org-1",
      seasonId: "season-active",
      actorUserId: "user-2",
      targetUserId: "user-2",
      targetHouseId: "house-1",
      type: "AWARD",
      delta: 5,
      reason: "Kept the build green",
      trait: "RELIABILITY",
      createdAt: new Date(),
    });
    const app = await buildTestApp("auth0|admin");
    const res = await app.inject({
      method: "POST",
      url: "/points/adjust",
      payload: {
        targetUserId: "user-2",
        delta: 5,
        reason: "Kept the build green",
        trait: "RELIABILITY",
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe("tx-self");
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 ACTIVE_SEASON_REQUIRED when no active season exists", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin());
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership());
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 403 ACTOR_HOUSE_REQUIRED when actor is not assigned to a house", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({}, { houseId: null }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACTOR_HOUSE_REQUIRED");
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 403 CROSS_ORGANIZATION_TARGET when target is outside the actor organization", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeAdmin())
      .mockResolvedValueOnce(makeMember({}, { organizationId: "org-other", houseId: "house-2" }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("CROSS_ORGANIZATION_TARGET");
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 422 TARGET_USER_UNASSIGNED when target has no house", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin());
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({ houseId: null }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("TARGET_USER_UNASSIGNED");
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 SAME_HOUSE_TARGET when target is in the actor house", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }));
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({ houseId: "house-1" }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/points/deduct",
      payload: validPayload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("SAME_HOUSE_TARGET");
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 ACTIVE_SEASON_REQUIRED when no active season exists", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }));
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({ houseId: "house-2" }));
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 DEDUCTION_COOLDOWN_ACTIVE when the actor house already deducted recently", async () => {
    const previousCreatedAt = new Date("2026-06-22T12:00:00.000Z");
    mockFindUnique.mockResolvedValueOnce(makeAdmin({
      houseId: "legacy-house",
      memberships: [makeActorMembership({ houseId: "house-1" })],
    }));
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({ houseId: "house-2" }));
    mockMembershipFindMany.mockResolvedValue([{ userId: "user-2" }, { userId: "user-owner" }]);
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
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        houseId: "house-1",
        isActive: true,
        archivedAt: null,
      },
      select: { userId: true },
    });
    expect(mockTxFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          seasonId: "season-active",
          type: "DEDUCTION",
          actorUserId: { in: ["user-2", "user-owner"] },
        }),
      }),
    );
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockTxCreate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 TARGET_DEDUCTION_LIMIT_ACTIVE when the target already received a recent deduction", async () => {
    const previousCreatedAt = new Date("2026-06-22T12:00:00.000Z");
    mockFindUnique.mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }));
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({ houseId: "house-2" }));
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("creates a fixed deduction for admins against another house", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin({ houseId: "house-1" }));
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({ houseId: "house-2" }));
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
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [{
        organizationId: "org-1",
        recipientUserId: "user-1",
        type: "POINT_DEDUCTION_RECEIVED",
        severity: "WARNING",
        title: "Points deducted",
        body: "Bob deducted 10 points from you. Reason: Duplicate award correction.",
        actionLabel: "View activity",
        actionHref: "/?tab=activity",
        entityType: "PointTransaction",
        entityId: "tx-deduction",
        dedupeKey: "point-deduction-received:org-1:tx-deduction",
      }],
      skipDuplicates: true,
    });
    await app.close();
  });

  it("allows owners to create deductions", async () => {
    mockFindUnique.mockResolvedValueOnce(makeOwner({ houseId: "house-1" }));
    mockMembershipFindFirst.mockResolvedValue(makeTargetMembership({ houseId: "house-2" }));
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
    mockFindUnique.mockResolvedValue(makeAdmin({}, { organizationId: "org-secure" }));
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
    mockFindUnique.mockResolvedValue(makeMember({}, { organizationId: "org-secure" }));
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
    mockFindUnique.mockResolvedValue(makeMember({}, { organizationId: "org-secure" }));
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
    mockMembershipFindMany.mockResolvedValue([
      { user: { id: "user-1", displayName: "Alice" } },
      { user: { id: "user-2", displayName: "Bob" } },
      { user: { id: "user-3", displayName: "Cora" } },
      { user: { id: "user-4", displayName: "Drew" } },
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
    expect(mockMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-secure",
          isActive: true,
          archivedAt: null,
          userId: { in: ["user-1", "user-2", "user-3", "user-4"] },
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
    mockFindUnique.mockResolvedValue(makeMember({}, { organizationId: "org-secure" }));
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
    mockFindUnique.mockResolvedValue(makeMember({}, { organizationId: "org-secure" }));
    mockSeasonFindMany.mockResolvedValue([fromSeason, toSeason]);
    mockHouseFindMany.mockResolvedValue(houses);
    mockTxGroupBy
      .mockResolvedValueOnce(houseTotals)
      .mockResolvedValueOnce(contributorTotals);
    mockMembershipFindMany.mockResolvedValue(
      users.map((user) => ({ user })),
    );
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
    expect(mockMembershipFindMany).toHaveBeenCalledTimes(1);
    expect(mockMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-secure",
          isActive: true,
          archivedAt: null,
          userId: { in: users.map((user) => user.id) },
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
    mockFindUnique.mockResolvedValue(makeOwner({}, { organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockSeasonUpdate.mockResolvedValue(closedSeason);
    mockSeasonCreate.mockResolvedValue(nextSeason);
    mockMembershipFindMany.mockResolvedValue([
      { user: { id: "user-owner" } },
      { user: { id: "user-admin" } },
      { user: { id: "user-member" } },
    ]);
    mockNotificationCreateMany.mockResolvedValue({ count: 3 });
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
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-secure",
        isActive: true,
        archivedAt: null,
      },
      select: { user: { select: { id: true } } },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "org-secure",
          recipientUserId: "user-owner",
          type: "SEASON_STARTED",
          severity: "INFO",
          title: "Season started",
          body: "Olivia started Q4 2026. House standings and leaderboards now use the new season.",
          actionLabel: "View overview",
          actionHref: "/",
          entityType: "Season",
          entityId: "season-next",
          dedupeKey: "season-started:org-secure:season-next",
        },
        {
          organizationId: "org-secure",
          recipientUserId: "user-admin",
          type: "SEASON_STARTED",
          severity: "INFO",
          title: "Season started",
          body: "Olivia started Q4 2026. House standings and leaderboards now use the new season.",
          actionLabel: "View overview",
          actionHref: "/",
          entityType: "Season",
          entityId: "season-next",
          dedupeKey: "season-started:org-secure:season-next",
        },
        {
          organizationId: "org-secure",
          recipientUserId: "user-member",
          type: "SEASON_STARTED",
          severity: "INFO",
          title: "Season started",
          body: "Olivia started Q4 2026. House standings and leaderboards now use the new season.",
          actionLabel: "View overview",
          actionHref: "/",
          entityType: "Season",
          entityId: "season-next",
          dedupeKey: "season-started:org-secure:season-next",
        },
      ],
      skipDuplicates: true,
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
    mockFindUnique.mockResolvedValue(makeAdmin({}, { organizationId: "org-secure" }));
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/start",
      payload: { name: "Q4 2026" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("skips season-start notification creation when the organization has no recipients", async () => {
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
    mockFindUnique.mockResolvedValue(makeOwner({}, { organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockSeasonUpdate.mockResolvedValue(closedSeason);
    mockSeasonCreate.mockResolvedValue(nextSeason);
    mockMembershipFindMany.mockResolvedValue([]);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/seasons/start",
      payload: { name: "Q4 2026" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-secure",
        isActive: true,
        archivedAt: null,
      },
      select: { user: { select: { id: true } } },
    });
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /seasons/rename", () => {
  it("allows an owner to rename a season in their organization", async () => {
    const renamedSeason = { ...ACTIVE_SEASON, name: "Summer 2026" };
    mockFindUnique.mockResolvedValue(makeOwner({}, { organizationId: "org-secure" }));
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
    mockFindUnique.mockResolvedValue(makeOwner({}, { organizationId: "org-secure" }));
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
    mockFindUnique.mockResolvedValue(makeAdmin({}, { organizationId: "org-secure" }));
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
      makeMember({}, { organizationId: "org-secure" }),
    );
    mockSeasonFindFirst.mockResolvedValue(ACTIVE_SEASON);
    mockHouseFindMany.mockResolvedValue([
      {
        id: "house-1",
        name: "Phoenix",
        color: "#7c3aed",
        description: null,
      },
      {
        id: "house-2",
        name: "Dragon",
        color: "#dc2626",
        description: "Fire team",
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
    mockMembershipFindMany.mockResolvedValue([
      { houseId: "house-1" },
      { houseId: "house-1" },
      { houseId: "house-2" },
      { houseId: null },
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
          id: true,
          name: true,
          color: true,
          description: true,
        }),
      }),
    );
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-secure",
        isActive: true,
        archivedAt: null,
        houseId: { not: null },
      },
      select: { houseId: true },
    });
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
      makeMember({}, { organizationId: "org-secure" }),
    );
    mockSeasonFindFirst.mockResolvedValue(SEASON_ZERO);
    mockHouseFindMany.mockResolvedValue([
      {
        id: "house-1",
        name: "Phoenix",
        color: "#7c3aed",
        description: null,
      },
    ]);
    mockMembershipFindMany.mockResolvedValue([{ houseId: "house-1" }]);
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
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-owner",
        eventType: "HOUSE_SETTINGS_UPDATED",
        summary: "Olivia created house Phoenix.",
        metadata: expect.objectContaining({
          operation: "created",
          houseId: "house-1",
          houseName: "Phoenix",
          changedFields: "created",
          newColor: "#7c3aed",
          newThemeMode: "GENERATED",
        }),
      }),
    });
    await app.close();
  });

  it("persists optional house theme palette fields when actor is owner", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockHouseUpsert.mockResolvedValue({
      ...HOUSE,
      themeMode: "CUSTOM",
      themeSecondaryColor: "#22c55e",
      themeSurfaceColor: "#f0fdf4",
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/admin/houses",
      payload: {
        name: "Phoenix",
        color: "#7c3aed",
        themeMode: "CUSTOM",
        themeSecondaryColor: "#22c55e",
        themeSurfaceColor: "#f0fdf4",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockHouseUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        themeMode: "CUSTOM",
        themeSecondaryColor: "#22c55e",
        themeSurfaceColor: "#f0fdf4",
      }),
      update: expect.objectContaining({
        themeMode: "CUSTOM",
        themeSecondaryColor: "#22c55e",
        themeSurfaceColor: "#f0fdf4",
      }),
    }));
    expect(res.json()).toMatchObject({
      themeMode: "CUSTOM",
      themeSecondaryColor: "#22c55e",
      themeSurfaceColor: "#f0fdf4",
    });
    await app.close();
  });

  it("audits changed house theme fields when actor updates an existing house", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockHouseFindUnique.mockResolvedValue(HOUSE);
    mockHouseUpsert.mockResolvedValue({
      ...HOUSE,
      color: "#1d4ed8",
      themeMode: "CUSTOM",
      themeSecondaryColor: "#22c55e",
      themeSurfaceColor: "#f0fdf4",
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/admin/houses",
      payload: {
        name: "Phoenix",
        color: "#1d4ed8",
        themeMode: "CUSTOM",
        themeSecondaryColor: "#22c55e",
        themeSurfaceColor: "#f0fdf4",
      },
    });

    expect(res.statusCode).toBe(201);
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        actorUserId: "user-owner",
        eventType: "HOUSE_SETTINGS_UPDATED",
        summary: "Olivia updated house Phoenix: color, themeMode, themeSecondaryColor, themeSurfaceColor.",
        metadata: expect.objectContaining({
          operation: "updated",
          houseId: "house-1",
          houseName: "Phoenix",
          changedFields: "color,themeMode,themeSecondaryColor,themeSurfaceColor",
          previousColor: "#7c3aed",
          newColor: "#1d4ed8",
          previousThemeMode: "GENERATED",
          newThemeMode: "CUSTOM",
          previousThemeSecondaryColor: null,
          newThemeSecondaryColor: "#22c55e",
          previousThemeSurfaceColor: null,
          newThemeSurfaceColor: "#f0fdf4",
        }),
      }),
    });
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
    expect(mockMembershipFindMany).not.toHaveBeenCalled();
    expect(mockHouseFindMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an admin and scopes organization context to the actor's organization", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin({}, { organizationId: "org-secure" }));
    mockMembershipFindMany.mockResolvedValue([]);
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
      organizationName: "Acme Corp",
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
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org-secure", isActive: true, archivedAt: null },
      orderBy: { user: { displayName: "asc" } },
      select: {
        role: true,
        houseId: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
    expect(mockHouseFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-secure" },
      }),
    );
    await app.close();
  });

  it("builds team management users from active memberships", async () => {
    mockFindUnique.mockResolvedValue(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindMany.mockResolvedValue([
      {
        role: "MEMBER",
        houseId: null,
        user: {
          id: "user-cross-shadow",
          displayName: "Casey Cross",
          email: "casey@example.com",
        },
      },
      {
        role: "ADMIN",
        houseId: "house-2",
        user: {
          id: "user-admin",
          displayName: "Ada Admin",
          email: "ada@example.com",
        },
      },
    ]);
    mockHouseFindMany.mockResolvedValue([]);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/context",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().users).toEqual([
      {
        id: "user-cross-shadow",
        displayName: "Casey Cross",
        email: "casey@example.com",
        role: "MEMBER",
        houseId: null,
      },
      {
        id: "user-admin",
        displayName: "Ada Admin",
        email: "ada@example.com",
        role: "ADMIN",
        houseId: "house-2",
      },
    ]);
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org-secure", isActive: true, archivedAt: null },
      orderBy: { user: { displayName: "asc" } },
      select: {
        role: true,
        houseId: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
    expect(mockUserFindMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an owner and returns the complete organization context", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockMembershipFindMany.mockResolvedValue([
      {
        role: "OWNER",
        houseId: "house-1",
        user: {
          id: "user-owner",
          displayName: "Olivia",
          email: "owner@acme.com",
        },
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
      organizationName: "Acme Corp",
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
    expect(mockMembershipFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: "org-1", isActive: true, archivedAt: null },
        orderBy: { user: { displayName: "asc" } },
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

describe("POST /admin/org/settings", () => {
  it("returns 403 OWNER_REQUIRED when actor is not an owner", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/settings",
      payload: { name: "Renamed Org" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockOrgUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an owner to rename the organization and writes an audit event", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockOrgUpdate.mockResolvedValue({
      id: "org-1",
      name: "Renamed Org",
      slug: "acme",
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/settings",
      payload: { name: " Renamed Org " },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockOrgUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { name: "Renamed Org" },
      select: { id: true, name: true, slug: true },
    });
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorUserId: "user-owner",
        eventType: "ORG_SETTINGS_UPDATED",
        summary: "Olivia renamed the organization from Acme Corp to Renamed Org.",
        metadata: {
          previousName: "Acme Corp",
          newName: "Renamed Org",
        },
      },
    });
    expect(res.json()).toEqual({
      id: "org-1",
      name: "Renamed Org",
      slug: "acme",
    });
    await app.close();
  });
});

describe("POST /admin/org/slug", () => {
  it("returns 403 OWNER_REQUIRED when actor is not an owner", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/slug",
      payload: { slug: "acme-corp" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockOrgUpdate).not.toHaveBeenCalled();
    expect(mockOrgSlugAliasCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns SLUG_UNCHANGED when the submitted slug matches the current slug", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/slug",
      payload: { slug: "acme" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("SLUG_UNCHANGED");
    expect(mockIsOrganizationSlugReserved).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns SLUG_TAKEN when the slug is already reserved", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockIsOrganizationSlugReserved.mockResolvedValue(true);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/slug",
      payload: { slug: "reserved-slug" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("SLUG_TAKEN");
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an owner to change the organization slug and writes an audit event", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockOrgUpdate.mockResolvedValue({
      id: "org-1",
      name: "Acme Corp",
      slug: "acme-corp",
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/slug",
      payload: { slug: "acme-corp" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockOrgSlugAliasUpdateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        isPrimary: true,
      },
      data: {
        isPrimary: false,
        retiredAt: expect.any(Date),
      },
    });
    expect(mockOrgUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: { slug: "acme-corp" },
      select: { id: true, name: true, slug: true },
    });
    expect(mockOrgSlugAliasCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        slug: "acme-corp",
        isPrimary: true,
      },
    });
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorUserId: "user-owner",
        eventType: "ORG_SETTINGS_UPDATED",
        summary: "Olivia changed the organization slug from acme to acme-corp.",
        metadata: {
          field: "slug",
          previousSlug: "acme",
          newSlug: "acme-corp",
        },
      },
    });
    expect(res.json()).toEqual({
      id: "org-1",
      name: "Acme Corp",
      slug: "acme-corp",
    });
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
    mockFindUnique.mockResolvedValue(makeAdmin({}, { organizationId: "org-secure" }));
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
    mockFindUnique.mockResolvedValue(makeOwner({}, { organizationId: "org-secure" }));
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
    mockFindUnique.mockResolvedValue(makeAdmin({}, { organizationId: "org-secure" }));
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
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 when target user is not found", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin()); // getActorBySub
    mockMembershipFindFirst.mockResolvedValueOnce(null);
    mockHouseFindUnique.mockResolvedValue(HOUSE);
    const app = await buildTestApp();
    const res = await app.inject({
      method: "POST",
      url: "/admin/users/assign-house",
      payload: { targetUserId: "user-999", targetHouseId: "house-1" },
    });
    expect(res.statusCode).toBe(404);
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 when target house belongs to another organization", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin({}, { organizationId: "org-1" }));
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-1",
      userId: "user-1",
      user: {
        id: "user-1",
        displayName: "Alice",
      },
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
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("assigns a user to a house, writes audit history, and resolves matching assignment notifications", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin());
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-1",
      userId: "user-1",
      user: {
        id: "user-1",
        displayName: "Alice",
      },
    });
    mockHouseFindUnique.mockResolvedValue({
      id: "house-1",
      organizationId: "org-1",
      name: "Phoenix",
    });
    mockMembershipUpdate.mockResolvedValue({
      houseId: "house-1",
      user: {
        id: "user-1",
        displayName: "Alice",
      },
    });
    mockNotificationUpdateMany.mockResolvedValue({ count: 2 });
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
    expect(mockMembershipFindFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        userId: "user-1",
        isActive: true,
        archivedAt: null,
      },
      select: {
        id: true,
        user: { select: { id: true, displayName: true } },
      },
    });
    expect(mockMembershipUpdate).toHaveBeenCalledWith({
      where: { id: "membership-1" },
      data: { houseId: "house-1" },
      select: {
        houseId: true,
        user: { select: { id: true, displayName: true } },
      },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
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
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
        entityType: "User",
        entityId: "user-1",
        archivedAt: null,
      },
      data: {
        readAt: expect.any(Date),
        archivedAt: expect.any(Date),
      },
    });
    await app.close();
  });
});

describe("POST /admin/users/display-name", () => {
  it("returns 403 ADMIN_REQUIRED when actor is a regular member", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/display-name",
      payload: { targetUserId: "user-1", displayName: "Alice Updated" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ADMIN_REQUIRED");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 when target user is outside the actor organization", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce(null);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/display-name",
      payload: { targetUserId: "user-other", displayName: "Other User" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("TARGET_USER_NOT_FOUND");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 409 without audit noise when the display name is unchanged", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-target",
      userId: "user-target",
      role: "MEMBER",
      houseId: "house-1",
      user: {
        id: "user-target",
        displayName: "Taylor",
        email: "taylor@acme.com",
      },
    });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/display-name",
      payload: { targetUserId: "user-target", displayName: "Taylor" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("DISPLAY_NAME_UNCHANGED");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockAuditEventCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("lets admins update an active member display name and writes audit history", async () => {
    mockFindUnique.mockResolvedValueOnce(makeAdmin({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-target",
      userId: "user-target",
      role: "MEMBER",
      houseId: "house-1",
      user: {
        id: "user-target",
        displayName: "Taylor",
        email: "taylor@acme.com",
      },
    });
    mockUserUpdate.mockResolvedValue({
      id: "user-target",
      displayName: "Taylor Smith",
      email: "taylor@acme.com",
    });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/display-name",
      payload: { targetUserId: "user-target", displayName: "Taylor Smith" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      id: "user-target",
      displayName: "Taylor Smith",
      email: "taylor@acme.com",
      role: "MEMBER",
      houseId: "house-1",
    });
    expect(mockMembershipFindFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-secure",
        userId: "user-target",
        isActive: true,
        archivedAt: null,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        houseId: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-target" },
      data: { displayName: "Taylor Smith" },
      select: {
        id: true,
        displayName: true,
        email: true,
      },
    });
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-secure",
        actorUserId: "user-2",
        eventType: "USER_DISPLAY_NAME_CHANGED",
        summary: "Bob changed Taylor's display name to Taylor Smith.",
        metadata: {
          targetUserId: "user-target",
          previousDisplayName: "Taylor",
          newDisplayName: "Taylor Smith",
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
      ...makeMember({
        displayName: "Alice Updated",
        role: "MEMBER",
      }),
      memberships: [
        {
          organizationId: "org-1",
          role: "MEMBER",
          houseId: "house-1",
          organization: { name: "Acme Corp", slug: "acme" },
          house: { name: "Phoenix", color: "#7c3aed" },
        },
      ],
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/users/profile",
      payload: { displayName: "Alice Updated" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: "user-1",
      displayName: "Alice Updated",
      houseThemeEnabled: false,
      organizationContexts: [
        expect.objectContaining({
          organizationId: "org-1",
          organizationSlug: "acme",
          role: "MEMBER",
          isCurrent: true,
        }),
      ],
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { displayName: "Alice Updated" },
      select: expect.objectContaining({
        id: true,
        displayName: true,
        houseThemeEnabled: true,
        memberships: expect.any(Object),
      }),
    });
    await app.close();
  });

  it("updates and returns the authenticated user's house theme preference", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockUserUpdate.mockResolvedValue({
      ...makeMember({ houseThemeEnabled: true }),
      memberships: [
        {
          organizationId: "org-1",
          role: "MEMBER",
          houseId: "house-1",
          organization: { name: "Acme Corp", slug: "acme" },
          house: { name: "Phoenix", color: "#7c3aed" },
        },
      ],
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/users/profile",
      payload: { houseThemeEnabled: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      id: "user-1",
      displayName: "Alice",
      houseThemeEnabled: true,
      organizationContexts: [
        expect.objectContaining({
          organizationId: "org-1",
          organizationSlug: "acme",
          role: "MEMBER",
          isCurrent: true,
        }),
      ],
    });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { houseThemeEnabled: true },
      select: expect.objectContaining({
        id: true,
        displayName: true,
        houseThemeEnabled: true,
        memberships: expect.any(Object),
      }),
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 when the target user is outside the owner's organization", async () => {
    mockFindUnique
      .mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }))
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
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects attempts to change an owner role", async () => {
    const targetOwner = makeOwner({
      id: "user-owner-2",
      displayName: "Second Owner",
      organizationId: "org-secure",
    });
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-owner-2",
      userId: "user-owner-2",
      role: "OWNER",
      houseId: targetOwner.houseId,
      user: {
        id: targetOwner.id,
        displayName: targetOwner.displayName,
        email: targetOwner.email,
      },
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/role",
      payload: { targetUserId: "user-owner-2", role: "ADMIN" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("OWNER_ROLE_IMMUTABLE");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an owner to promote a member to admin, writes audit, and notifies the target plus other owners", async () => {
    const targetUser = makeMember({
      id: "user-target",
      displayName: "Taylor",
      email: "taylor@acme.com",
      role: "MEMBER" as const,
      organizationId: "org-secure",
      houseId: "house-1",
    });
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-target",
      userId: "user-target",
      role: targetUser.role,
      houseId: targetUser.houseId,
      user: {
        id: targetUser.id,
        displayName: targetUser.displayName,
        email: targetUser.email,
      },
    });
    mockMembershipUpdate.mockResolvedValue({
      role: "ADMIN",
      houseId: "house-1",
      user: {
        id: "user-target",
        displayName: "Taylor",
        email: "taylor@acme.com",
      },
    });
    mockMembershipFindMany.mockResolvedValue([
      { user: { id: "user-owner-2" } },
      { user: { id: "user-target" } },
    ]);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/role",
      payload: { targetUserId: "user-target", role: "ADMIN" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockMembershipFindFirst).toHaveBeenCalledWith({
      where: {
        organizationId: "org-secure",
        userId: "user-target",
        isActive: true,
        archivedAt: null,
      },
      select: {
        id: true,
        userId: true,
        role: true,
        houseId: true,
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });
    expect(mockMembershipUpdate).toHaveBeenCalledWith({
      where: { id: "membership-target" },
      data: { role: "ADMIN" },
      select: {
        role: true,
        houseId: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
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
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-secure",
        role: "OWNER",
        userId: { not: "user-owner" },
        isActive: true,
        archivedAt: null,
      },
      select: { user: { select: { id: true } } },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "org-secure",
          recipientUserId: "user-target",
          type: "ROLE_CHANGED",
          severity: "INFO",
          title: "Role changed",
          body: "Olivia changed Taylor from MEMBER to ADMIN.",
          actionLabel: "View team",
          actionHref: "/?tab=manage&section=team",
          entityType: "User",
          entityId: "user-target",
        },
        {
          organizationId: "org-secure",
          recipientUserId: "user-owner-2",
          type: "ROLE_CHANGED",
          severity: "INFO",
          title: "Role changed",
          body: "Olivia changed Taylor from MEMBER to ADMIN.",
          actionLabel: "View team",
          actionHref: "/?tab=manage&section=team",
          entityType: "User",
          entityId: "user-target",
        },
      ],
      skipDuplicates: true,
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

  it("allows an owner to demote an admin to member and writes an audit event", async () => {
    const targetUser = makeAdmin({
      id: "user-target",
      displayName: "Taylor",
      email: "taylor@acme.com",
      role: "ADMIN" as const,
      organizationId: "org-secure",
      houseId: "house-1",
    });
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-target",
      userId: "user-target",
      role: targetUser.role,
      houseId: targetUser.houseId,
      user: {
        id: targetUser.id,
        displayName: targetUser.displayName,
        email: targetUser.email,
      },
    });
    mockMembershipUpdate.mockResolvedValue({
      role: "MEMBER",
      houseId: "house-1",
      user: {
        id: "user-target",
        displayName: "Taylor",
        email: "taylor@acme.com",
      },
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/role",
      payload: { targetUserId: "user-target", role: "MEMBER" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockMembershipUpdate).toHaveBeenCalledWith({
      where: { id: "membership-target" },
      data: { role: "MEMBER" },
      select: {
        role: true,
        houseId: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-secure",
        actorUserId: "user-owner",
        eventType: "USER_ROLE_CHANGED",
        summary: "Olivia changed Taylor from ADMIN to MEMBER.",
        metadata: {
          targetUserId: "user-target",
          targetUserName: "Taylor",
          previousRole: "ADMIN",
          newRole: "MEMBER",
        },
      },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [{
        organizationId: "org-secure",
        recipientUserId: "user-target",
        type: "ROLE_CHANGED",
        severity: "INFO",
        title: "Role changed",
        body: "Olivia changed Taylor from ADMIN to MEMBER.",
        actionLabel: "View team",
        actionHref: "/?tab=manage&section=team",
        entityType: "User",
        entityId: "user-target",
      }],
      skipDuplicates: true,
    });
    expect(res.json()).toEqual({
      id: "user-target",
      displayName: "Taylor",
      email: "taylor@acme.com",
      role: "MEMBER",
      houseId: "house-1",
    });
    await app.close();
  });
});

describe("POST /admin/org/owner", () => {
  it("returns 403 OWNER_REQUIRED when actor is an admin", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/owner",
      payload: { targetUserId: "user-target" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects transferring ownership to self", async () => {
    mockFindUnique.mockResolvedValue(makeOwner({}, { organizationId: "org-secure" }));
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/owner",
      payload: { targetUserId: "user-owner" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("OWNER_TRANSFER_SELF");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 when the target user is outside the owner's organization", async () => {
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst
      .mockResolvedValueOnce({
        id: "membership-owner",
        userId: "user-owner",
        role: "OWNER",
        houseId: "house-1",
        user: { id: "user-owner", displayName: "Olivia", email: "admin@acme.com" },
      })
      .mockResolvedValueOnce(null);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/owner",
      payload: { targetUserId: "user-other" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("TARGET_USER_NOT_FOUND");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects transferring ownership to another owner", async () => {
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst
      .mockResolvedValueOnce({
        id: "membership-owner",
        userId: "user-owner",
        role: "OWNER",
        houseId: "house-1",
        user: { id: "user-owner", displayName: "Olivia", email: "admin@acme.com" },
      })
      .mockResolvedValueOnce({
        id: "membership-owner-2",
        userId: "user-owner-2",
        role: "OWNER",
        houseId: "house-1",
        user: { id: "user-owner-2", displayName: "Second Owner", email: "second-owner@acme.com" },
      });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/owner",
      payload: { targetUserId: "user-owner-2" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("TARGET_ALREADY_OWNER");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an owner to transfer ownership, demotes the actor to admin, writes audit, and notifies both users", async () => {
    const targetUser = makeAdmin({
      id: "user-target",
      displayName: "Taylor",
      email: "taylor@acme.com",
      role: "ADMIN" as const,
      organizationId: "org-secure",
      houseId: "house-1",
    });
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst
      .mockResolvedValueOnce({
        id: "membership-owner",
        userId: "user-owner",
        role: "OWNER",
        houseId: "house-1",
        user: { id: "user-owner", displayName: "Olivia", email: "admin@acme.com" },
      })
      .mockResolvedValueOnce({
        id: "membership-target",
        userId: "user-target",
        role: targetUser.role,
        houseId: targetUser.houseId,
        user: {
          id: targetUser.id,
          displayName: targetUser.displayName,
          email: targetUser.email,
        },
      });
    mockMembershipUpdate
      .mockResolvedValueOnce({ id: "membership-owner" })
      .mockResolvedValueOnce({
        role: "OWNER",
        houseId: "house-1",
        user: {
          id: "user-target",
          displayName: "Taylor",
          email: "taylor@acme.com",
        },
      });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/owner",
      payload: { targetUserId: "user-target" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockMembershipUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "membership-owner" },
      data: { role: "ADMIN" },
      select: { id: true },
    });
    expect(mockMembershipUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "membership-target" },
      data: { role: "OWNER" },
      select: {
        role: true,
        houseId: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-secure",
        actorUserId: "user-owner",
        eventType: "USER_ROLE_CHANGED",
        summary: "Olivia transferred ownership to Taylor.",
        metadata: {
          previousOwnerId: "user-owner",
          previousOwnerName: "Olivia",
          newOwnerId: "user-target",
          newOwnerName: "Taylor",
          previousRole: "ADMIN",
          newRole: "OWNER",
        },
      },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "org-secure",
          recipientUserId: "user-target",
          type: "ROLE_CHANGED",
          severity: "INFO",
          title: "Role changed",
          body: "Olivia changed Taylor from ADMIN to OWNER.",
          actionLabel: "View team",
          actionHref: "/?tab=manage&section=team",
          entityType: "User",
          entityId: "user-target",
        },
        {
          organizationId: "org-secure",
          recipientUserId: "user-owner",
          type: "ROLE_CHANGED",
          severity: "INFO",
          title: "Role changed",
          body: "Olivia changed Olivia from OWNER to ADMIN.",
          actionLabel: "View team",
          actionHref: "/?tab=manage&section=team",
          entityType: "User",
          entityId: "user-owner",
        },
      ],
      skipDuplicates: true,
    });
    expect(res.json()).toEqual({
      id: "user-target",
      displayName: "Taylor",
      email: "taylor@acme.com",
      role: "OWNER",
      houseId: "house-1",
    });
    await app.close();
  });
});

describe("POST /admin/org/archive", () => {
  it("returns 403 OWNER_REQUIRED when actor is an admin", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/archive",
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockOrgUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects unknown archive request fields", async () => {
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/archive",
      payload: { reason: "closing this organization" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockOrgUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("allows an owner to archive the organization and writes an audit event", async () => {
    const archivedAt = new Date("2026-07-04T17:30:00.000Z");
    mockFindUnique.mockResolvedValue(makeOwner());
    mockOrgUpdate.mockResolvedValue({
      id: "org-1",
      name: "Acme Corp",
      slug: "acme",
      archivedAt,
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/org/archive",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockOrgUpdate).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: {
        archivedAt: expect.any(Date),
        archivedById: "user-owner",
      },
      select: { id: true, name: true, slug: true, archivedAt: true },
    });
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        actorUserId: "user-owner",
        eventType: "ORG_ARCHIVED",
        summary: "Olivia archived Acme Corp.",
        metadata: {
          organizationName: "Acme Corp",
          organizationSlug: "acme",
          archivedAt: expect.any(String),
        },
      },
    });
    expect(res.json()).toEqual({
      id: "org-1",
      name: "Acme Corp",
      slug: "acme",
      archivedAt: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
    });
    await app.close();
  });
});

describe("POST /admin/users/remove", () => {
  it("returns 403 OWNER_REQUIRED when actor is an admin", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/remove",
      payload: { targetUserId: "user-target" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("OWNER_REQUIRED");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects owner self-removal", async () => {
    mockFindUnique.mockResolvedValue(makeOwner({}, { organizationId: "org-secure" }));
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/remove",
      payload: { targetUserId: "user-owner" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ORG_MEMBER_REMOVE_SELF");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns 404 when target user is outside the owner's organization", async () => {
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce(null);
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/remove",
      payload: { targetUserId: "user-other" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("TARGET_USER_NOT_FOUND");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects removing another owner", async () => {
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-owner-2",
      userId: "user-owner-2",
      role: "OWNER",
      houseId: "house-1",
      user: {
        id: "user-owner-2",
        displayName: "Second Owner",
        email: "second-owner@acme.com",
      },
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/remove",
      payload: { targetUserId: "user-owner-2" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("OWNER_REMOVE_FORBIDDEN");
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("removes a member from the organization, archives notifications, and writes audit", async () => {
    const targetUser = makeMember({
      id: "user-target",
      displayName: "Taylor",
      role: "ADMIN" as const,
      organizationId: "org-secure",
      houseId: "house-1",
    });
    mockFindUnique.mockResolvedValueOnce(makeOwner({}, { organizationId: "org-secure" }));
    mockMembershipFindFirst.mockResolvedValueOnce({
      id: "membership-target",
      userId: "user-target",
      role: targetUser.role,
      houseId: targetUser.houseId,
      user: {
        id: targetUser.id,
        displayName: targetUser.displayName,
        email: targetUser.email,
      },
    });
    mockMembershipUpdate.mockResolvedValue({
      user: {
        id: "user-target",
        displayName: "Taylor",
      },
    });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/admin/users/remove",
      payload: { targetUserId: "user-target" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockMembershipUpdate).toHaveBeenCalledWith({
      where: { id: "membership-target" },
      data: {
        isActive: false,
        archivedAt: expect.any(Date),
        houseId: null,
        role: "MEMBER",
      },
      select: {
        user: { select: { id: true, displayName: true } },
      },
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
    expect(mockNotificationUpdateMany).toHaveBeenCalledTimes(2);
    expect(mockAuditEventCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-secure",
        actorUserId: "user-owner",
        eventType: "USER_REMOVED_FROM_ORG",
        summary: "Olivia removed Taylor from the organization.",
        metadata: {
          targetUserId: "user-target",
          targetUserName: "Taylor",
          previousRole: "ADMIN",
        },
      },
    });
    expect(res.json()).toEqual({
      id: "user-target",
      displayName: "Taylor",
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
        reactions: [
          { actorUserId: "user-1", reactionKey: "heart" },
          { actorUserId: "user-2", reactionKey: "heart" },
          { actorUserId: "user-3", reactionKey: "clap" },
          { actorUserId: "user-4", reactionKey: "unknown-reaction" },
        ],
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
        reactions: [],
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
    expect(items[0].myReactionKey).toBe("heart");
    expect(items[0].reactions).toEqual([
      { reactionKey: "heart", count: 2 },
      { reactionKey: "clap", count: 1 },
    ]);
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

  it("filters activity by transaction type before paging", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindMany.mockResolvedValue([]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: { type: "DEDUCTION", limit: 10 },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-1",
          deletedAt: null,
          type: "DEDUCTION",
        },
        take: 11,
      }),
    );
    await app.close();
  });

  it("filters activity by target member before paging", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindMany.mockResolvedValue([]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/recent",
      payload: { targetUserId: "user-target", limit: 10 },
    });

    expect(res.statusCode).toBe(200);
    expect(mockTxFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: "org-1",
          deletedAt: null,
          targetUserId: "user-target",
        },
        take: 11,
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
    mockFindUnique.mockResolvedValue(makeAdmin({}, { organizationId: "org-secure" }));
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

describe("POST /transactions/react", () => {
  const awardTransaction = {
    id: "tx-1",
    organizationId: "org-1",
    targetUserId: "user-target",
    type: "AWARD",
    deletedAt: null,
  };

  it("creates a reaction and notifies the award recipient", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindUnique.mockResolvedValue(awardTransaction);
    mockPointReactionCreate.mockResolvedValue({ id: "reaction-1", reactionKey: "clap" });
    mockPointReactionFindMany.mockResolvedValue([
      { actorUserId: "user-1", reactionKey: "clap" },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/react",
      payload: { transactionId: "tx-1", reactionKey: "clap" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      transactionId: "tx-1",
      myReactionKey: "clap",
      reactions: [{ reactionKey: "clap", count: 1 }],
    });
    expect(mockPointReactionCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        pointTransactionId: "tx-1",
        actorUserId: "user-1",
        reactionKey: "clap",
      },
      select: { id: true, reactionKey: true },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          recipientUserId: "user-target",
          type: "POINT_REACTION_RECEIVED",
          entityType: "PointReaction",
          entityId: "reaction-1",
          dedupeKey: "point-reaction-received:org-1:tx-1:user-1",
        }),
      ],
      skipDuplicates: true,
    });
    await app.close();
  });

  it("updates an existing reaction and refreshes the deduped notification", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindUnique.mockResolvedValue(awardTransaction);
    mockPointReactionFindFirst.mockResolvedValue({ id: "reaction-1", reactionKey: "clap" });
    mockPointReactionUpdate.mockResolvedValue({ id: "reaction-1", reactionKey: "fire" });
    mockPointReactionFindMany.mockResolvedValue([
      { actorUserId: "user-1", reactionKey: "fire" },
    ]);
    mockNotificationUpdateMany.mockResolvedValue({ count: 1 });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/react",
      payload: { transactionId: "tx-1", reactionKey: "fire" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().myReactionKey).toBe("fire");
    expect(mockPointReactionCreate).not.toHaveBeenCalled();
    expect(mockPointReactionUpdate).toHaveBeenCalledWith({
      where: { id: "reaction-1" },
      data: { reactionKey: "fire" },
      select: { id: true, reactionKey: true },
    });
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        recipientUserId: "user-target",
        dedupeKey: "point-reaction-received:org-1:tx-1:user-1",
      },
      data: expect.objectContaining({
        body: "Alice reacted with On fire.",
        entityId: "reaction-1",
        archivedAt: null,
      }),
    });
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("removes an existing reaction and archives the deduped notification", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindUnique.mockResolvedValue(awardTransaction);
    mockPointReactionFindFirst.mockResolvedValue({ id: "reaction-1", reactionKey: "heart" });
    mockPointReactionUpdate.mockResolvedValue({ id: "reaction-1", reactionKey: "heart" });
    mockPointReactionFindMany.mockResolvedValue([]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/react",
      payload: { transactionId: "tx-1", reactionKey: null },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      transactionId: "tx-1",
      myReactionKey: null,
      reactions: [],
    });
    expect(mockPointReactionUpdate).toHaveBeenCalledWith({
      where: { id: "reaction-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        recipientUserId: "user-target",
        dedupeKey: "point-reaction-received:org-1:tx-1:user-1",
        archivedAt: null,
      },
      data: { archivedAt: expect.any(Date) },
    });
    await app.close();
  });

  it("does not notify when the recipient reacts to their own award", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindUnique.mockResolvedValue({ ...awardTransaction, targetUserId: "user-1" });
    mockPointReactionFindMany.mockResolvedValue([
      { actorUserId: "user-1", reactionKey: "star" },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/react",
      payload: { transactionId: "tx-1", reactionKey: "star" },
    });

    expect(res.statusCode).toBe(200);
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects deductions without writing a reaction", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindUnique.mockResolvedValue({ ...awardTransaction, type: "DEDUCTION" });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/react",
      payload: { transactionId: "tx-1", reactionKey: "clap" },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().code).toBe("POINT_REACTION_UNSUPPORTED_TRANSACTION_TYPE");
    expect(mockPointReactionCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns not found for missing, deleted, or cross-org transactions", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    mockTxFindUnique.mockResolvedValue({ ...awardTransaction, organizationId: "org-other" });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/react",
      payload: { transactionId: "tx-1", reactionKey: "clap" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("POINT_TRANSACTION_NOT_FOUND");
    expect(mockPointReactionCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects unknown reaction keys at the request boundary", async () => {
    mockFindUnique.mockResolvedValue(makeMember());
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/transactions/react",
      payload: { transactionId: "tx-1", reactionKey: "confetti" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(mockTransaction).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /users/scores", () => {
  it("scopes member scores to the authenticated actor's organization", async () => {
    mockFindUnique.mockResolvedValue(
      makeMember({}, { organizationId: "org-secure" }),
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
    mockFindUnique.mockResolvedValue(makeMember({}, { organizationId: "org-secure" }));
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
    mockFindUnique.mockResolvedValue(makeMember({}, { organizationId: "org-secure" }));
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

describe("POST /system/releases/broadcast", () => {
  it("broadcasts release notifications to active members once", async () => {
    process.env.RELEASE_AUTOMATION_SECRET = "release-secret-123";
    mockMembershipFindMany.mockResolvedValue([
      { organizationId: "org-1", userId: "user-1" },
      { organizationId: "org-1", userId: "user-2" },
      { organizationId: "org-2", userId: "user-1" },
    ]);
    mockNotificationCreateMany.mockResolvedValue({ count: 3 });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/system/releases/broadcast",
      headers: {
        "x-housepoints-release-secret": "release-secret-123",
      },
      payload: { version: "v1.2.3" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      release: {
        id: "release-1",
        version: "v1.2.3",
        title: "Release notes automation",
        summary: "Adds app-owned release records.",
        releaseNotesUrl: "https://example.com/releases/v1.2.3.html",
        releasedAt: "2026-07-04T18:00:00.000Z",
        broadcastAt: "2026-07-04T18:03:00.000Z",
        createdAt: "2026-07-04T18:01:00.000Z",
        updatedAt: "2026-07-04T18:03:00.000Z",
      },
      notificationCount: 3,
      alreadyBroadcast: false,
    });
    expect(mockReleaseAnnouncementFindUnique).toHaveBeenCalledWith({
      where: { version: "v1.2.3" },
      select: {
        id: true,
        version: true,
        title: true,
        summary: true,
        releaseNotesUrl: true,
        releasedAt: true,
        broadcastAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        archivedAt: null,
        organization: {
          archivedAt: null,
        },
      },
      select: {
        organizationId: true,
        userId: true,
      },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "org-1",
          recipientUserId: "user-1",
          type: "RELEASE_ANNOUNCEMENT",
          severity: "INFO",
          title: "What's new: Release notes automation",
          body: "Adds app-owned release records.",
          actionLabel: "View release notes",
          actionHref: "https://example.com/releases/v1.2.3.html",
          entityType: "ReleaseAnnouncement",
          entityId: "release-1",
          dedupeKey: "release-announcement:v1.2.3:org-1",
        },
        {
          organizationId: "org-1",
          recipientUserId: "user-2",
          type: "RELEASE_ANNOUNCEMENT",
          severity: "INFO",
          title: "What's new: Release notes automation",
          body: "Adds app-owned release records.",
          actionLabel: "View release notes",
          actionHref: "https://example.com/releases/v1.2.3.html",
          entityType: "ReleaseAnnouncement",
          entityId: "release-1",
          dedupeKey: "release-announcement:v1.2.3:org-1",
        },
        {
          organizationId: "org-2",
          recipientUserId: "user-1",
          type: "RELEASE_ANNOUNCEMENT",
          severity: "INFO",
          title: "What's new: Release notes automation",
          body: "Adds app-owned release records.",
          actionLabel: "View release notes",
          actionHref: "https://example.com/releases/v1.2.3.html",
          entityType: "ReleaseAnnouncement",
          entityId: "release-1",
          dedupeKey: "release-announcement:v1.2.3:org-2",
        },
      ],
      skipDuplicates: true,
    });
    expect(mockReleaseAnnouncementUpdate).toHaveBeenCalledWith({
      where: { id: "release-1" },
      data: { broadcastAt: expect.any(Date) },
      select: {
        id: true,
        version: true,
        title: true,
        summary: true,
        releaseNotesUrl: true,
        releasedAt: true,
        broadcastAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await app.close();
  });

  it("does not create duplicate notifications after a release has been broadcast", async () => {
    process.env.RELEASE_AUTOMATION_SECRET = "release-secret-123";
    mockReleaseAnnouncementFindUnique.mockResolvedValue({
      id: "release-1",
      version: "v1.2.3",
      title: "Release notes automation",
      summary: "Adds app-owned release records.",
      releaseNotesUrl: "https://example.com/releases/v1.2.3.html",
      releasedAt: new Date("2026-07-04T18:00:00.000Z"),
      broadcastAt: new Date("2026-07-04T18:03:00.000Z"),
      createdAt: new Date("2026-07-04T18:01:00.000Z"),
      updatedAt: new Date("2026-07-04T18:03:00.000Z"),
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/system/releases/broadcast",
      headers: {
        "x-housepoints-release-secret": "release-secret-123",
      },
      payload: { version: "v1.2.3" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      notificationCount: 0,
      alreadyBroadcast: true,
      release: {
        broadcastAt: "2026-07-04T18:03:00.000Z",
      },
    });
    expect(mockMembershipFindMany).not.toHaveBeenCalled();
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    expect(mockReleaseAnnouncementUpdate).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns 404 when the release is missing", async () => {
    process.env.RELEASE_AUTOMATION_SECRET = "release-secret-123";
    mockReleaseAnnouncementFindUnique.mockResolvedValue(null);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/system/releases/broadcast",
      headers: {
        "x-housepoints-release-secret": "release-secret-123",
      },
      payload: { version: "missing-release" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      code: "RELEASE_NOT_FOUND",
    });
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    expect(mockReleaseAnnouncementUpdate).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects invalid release automation secrets", async () => {
    process.env.RELEASE_AUTOMATION_SECRET = "release-secret-123";
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/system/releases/broadcast",
      headers: {
        "x-housepoints-release-secret": "wrong-secret-value",
      },
      payload: { version: "v1.2.3" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({
      code: "INVALID_RELEASE_AUTOMATION_SECRET",
    });
    expect(mockReleaseAnnouncementFindUnique).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("POST /members", () => {
  it("scopes member reads to the authenticated actor's organization", async () => {
    mockFindUnique.mockResolvedValue(
      makeMember({}, { organizationId: "org-secure" }),
    );
    mockMembershipFindMany.mockResolvedValue([
      {
        role: "MEMBER",
        houseId: "house-1",
        house: { name: "Phoenix", color: "#7c3aed" },
        user: {
          id: "user-1",
          displayName: "Alice",
        },
      },
    ]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/members",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        id: "user-1",
        displayName: "Alice",
        role: "MEMBER",
        houseId: "house-1",
        houseName: "Phoenix",
        houseColor: "#7c3aed",
      },
    ]);
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org-secure", isActive: true, archivedAt: null },
      orderBy: { user: { displayName: "asc" } },
      select: {
        id: true,
        role: true,
        houseId: true,
        house: { select: { name: true, color: true } },
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
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
      ])
      .mockResolvedValueOnce([
        { targetHouseId: "house-1", _sum: { delta: 55 }, _count: { _all: 3 } },
        { targetHouseId: "house-2", _sum: { delta: 10 }, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { type: "AWARD", _sum: { delta: 75 }, _count: { _all: 4 } },
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
    mockMembershipFindMany.mockResolvedValue([
      {
        role: "MEMBER",
        houseId: "house-1",
        user: {
          id: "user-1",
          displayName: "Alice",
        },
      },
      {
        role: "ADMIN",
        houseId: "house-1",
        user: {
          id: "user-2",
          displayName: "Bob",
        },
      },
      {
        role: "MEMBER",
        houseId: "house-2",
        user: {
          id: "user-3",
          displayName: "Cora",
        },
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
    expect(body.seasonWinnerSummary).toBeNull();
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
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", isActive: true, archivedAt: null },
      orderBy: { user: { displayName: "asc" } },
      select: {
        role: true,
        houseId: true,
        user: {
          select: {
            id: true,
            displayName: true,
          },
        },
      },
    });
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
    mockFindUnique.mockResolvedValue(makeMember({}, { organizationId: "org-secure" }));
    mockSeasonFindFirst.mockResolvedValue(SEASON_ZERO);
    mockHouseFindMany.mockResolvedValue([
      HOUSE,
      { id: "house-2", name: "Ember", color: "#ef4444", description: null, organizationId: "org-secure" },
    ]);
    mockTxGroupBy
      .mockResolvedValueOnce([
        { targetUserId: "user-3", targetHouseId: "house-2", _sum: { delta: 30 } },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { targetUserId: "user-3", _sum: { delta: 30 } },
      ])
      .mockResolvedValueOnce([
        { targetHouseId: "house-1", _sum: { delta: 10 }, _count: { _all: 1 } },
        { targetHouseId: "house-2", _sum: { delta: 30 }, _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { type: "AWARD", _sum: { delta: 45 }, _count: { _all: 3 } },
        { type: "DEDUCTION", _sum: { delta: -5 }, _count: { _all: 1 } },
      ]);
    mockTxFindMany.mockResolvedValue([]);
    mockMembershipFindMany.mockResolvedValue([
      {
        role: "MEMBER",
        houseId: "house-2",
        user: {
          id: "user-3",
          displayName: "Cora",
        },
      },
    ]);
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
    expect(res.json().seasonWinnerSummary).toEqual({
      seasonId: "season-0",
      seasonName: "Season 0",
      startsAt: "2026-06-01T00:00:00.000Z",
      endsAt: "2026-07-01T00:00:00.000Z",
      winningHouse: {
        houseId: "house-2",
        houseName: "Ember",
        houseColor: "#ef4444",
        points: 30,
      },
      topContributor: {
        memberId: "user-3",
        memberName: "Cora",
        houseId: "house-2",
        houseName: "Ember",
        houseColor: "#ef4444",
        points: 30,
      },
      totalTransactions: 4,
      awardCount: 3,
      deductionCount: 1,
      awardedPoints: 45,
      deductedPoints: 5,
    });
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
    mockIsOrganizationSlugReserved.mockResolvedValue(true);
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

  it("allows an existing org member to create another organization", async () => {
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        id: "user-1",
      },
    });
    mockOrgCreate.mockResolvedValue(ORG);
    mockHouseCreate.mockResolvedValue(HOUSE);
    mockSeasonCreate.mockResolvedValue({ id: "season-0" });
    mockFindUnique.mockResolvedValue({
      ...makeMember({
        role: "OWNER",
        email: "alice@example.com",
        organization: { name: "Acme Corp", slug: "acme" },
      }),
      memberships: [
        {
          organizationId: "org-1",
          role: "OWNER",
          houseId: "house-1",
          organization: { name: "Acme Corp", slug: "acme" },
          house: { name: "Phoenix", color: "#7c3aed" },
        },
      ],
    });
    mockUserUpdate.mockResolvedValue(
      makeMember({
        role: "OWNER",
        email: "alice@example.com",
        organization: { name: "Acme Corp", slug: "acme" },
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
      organizationContexts: [
        expect.objectContaining({
          organizationId: "org-1",
          organizationSlug: "acme",
          role: "OWNER",
          houseId: "house-1",
          isCurrent: true,
        }),
      ],
    });
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.not.objectContaining({
          organizationId: expect.anything(),
          houseId: expect.anything(),
          role: expect.anything(),
        }),
      }),
    );
    expect(mockMembershipCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-1",
        role: "OWNER",
        houseId: "house-1",
      },
      select: { id: true },
    });
    await app.close();
  });

  it("atomically creates the organization, first house, and assigned owner", async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        id: "user-1",
      })
      .mockResolvedValueOnce({
        ...makeMember({
          role: "OWNER",
          email: "alice@example.com",
          organization: { name: "Acme Corp", slug: "acme" },
        }),
        memberships: [
          {
            organizationId: "org-1",
            role: "OWNER",
            houseId: "house-1",
            organization: { name: "Acme Corp", slug: "acme" },
            house: { name: "Phoenix", color: "#7c3aed" },
          },
        ],
      });
    mockOrgCreate.mockResolvedValue(ORG);
    mockHouseCreate.mockResolvedValue(HOUSE);
    mockSeasonCreate.mockResolvedValue({ id: "season-0" });
    mockUserUpdate.mockResolvedValue(
      makeMember({
        role: "OWNER",
        email: "alice@example.com",
        organization: { name: "Acme Corp", slug: "acme" },
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
      organizationContexts: [
        expect.objectContaining({
          organizationId: "org-1",
          organizationSlug: "acme",
          role: "OWNER",
          houseId: "house-1",
          isCurrent: true,
        }),
      ],
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
    expect(mockCreatePrimaryOrganizationSlugAlias).toHaveBeenCalledWith(prisma, {
      organizationId: "org-1",
      slug: "acme",
    });
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          organizationId: expect.anything(),
          houseId: expect.anything(),
          role: expect.anything(),
        }),
      }),
    );
    expect(mockMembershipCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-1",
        role: "OWNER",
        houseId: "house-1",
      },
      select: { id: true },
    });
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
    mockFindUnique.mockResolvedValue({
      id: "user-1",
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
    mockFindUnique.mockResolvedValue(makeAdmin({}, { organizationId: "org-secure" }));
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
      joinPath: expect.stringMatching(/^\/o\/acme\/join\/[a-f0-9]{64}$/),
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

describe("POST /orgs/join/preview", () => {
  const payload = {
    inviteToken: "single-use-token",
    organizationSlug: "acme",
  };
  const invite = {
    id: "invite-1",
    organizationId: "org-1",
    organization: { name: "Acme Corp" },
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    usedAt: null,
  };
  const resolvedSlug = {
    organizationId: "org-1",
    matchedSlug: "acme",
    currentSlug: "acme",
    isPrimary: true,
    organization: {
      id: "org-1",
      name: "Acme Corp",
      slug: "acme",
      archivedAt: null,
    },
  };

  it("returns canonical organization details without claiming the invite", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join/preview",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      organizationName: "Acme Corp",
      organizationSlug: "acme",
      membershipStatus: "NONE",
      memberOrganizationName: null,
      memberOrganizationSlug: null,
    });
    expect(mockInviteUpdateMany).not.toHaveBeenCalled();
    expect(mockAuditEventCreate).not.toHaveBeenCalled();
    await app.close();
  });

  it("returns the current slug when the URL used an old alias", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockResolveOrganizationSlug.mockResolvedValue({
      ...resolvedSlug,
      matchedSlug: "old-acme",
      currentSlug: "acme",
      isPrimary: false,
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join/preview",
      payload: { ...payload, organizationSlug: "old-acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().organizationSlug).toBe("acme");
    await app.close();
  });

  it("reports when the signed-in user already belongs to the invite organization", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join/preview",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      membershipStatus: "SAME_ORG",
      memberOrganizationName: "Acme Corp",
      memberOrganizationSlug: "acme",
    });
    expect(mockAuthIdentityFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: {
        user: {
          select: {
            id: true,
            memberships: {
              where: { isActive: true, archivedAt: null },
              select: {
                organizationId: true,
                organization: { select: { name: true, slug: true } },
              },
            },
          },
        },
      },
    }));
    expect(mockInviteUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("uses active memberships to detect same-organization users", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join/preview",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      membershipStatus: "SAME_ORG",
      memberOrganizationName: "Acme Corp",
      memberOrganizationSlug: "acme",
    });
    expect(mockInviteUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("reports when the signed-in user belongs to another organization", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-other",
            organization: {
              name: "Other Org",
              slug: "other-org",
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join/preview",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      membershipStatus: "OTHER_ORG",
      memberOrganizationName: "Other Org",
      memberOrganizationSlug: "other-org",
    });
    expect(mockInviteUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("reports no membership when no active memberships exist", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join/preview",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      membershipStatus: "NONE",
      memberOrganizationName: null,
      memberOrganizationSlug: null,
    });
    expect(mockInviteUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects an invite token that does not belong to the slugged organization", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockResolveOrganizationSlug.mockResolvedValue({
      ...resolvedSlug,
      organizationId: "org-other",
      organization: {
        id: "org-other",
        name: "Other Org",
        slug: "other-org",
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join/preview",
      payload,
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("INVITE_ORG_MISMATCH");
    expect(mockInviteUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /orgs/route-context", () => {
  const resolvedSlug = {
    organizationId: "org-1",
    matchedSlug: "acme",
    currentSlug: "acme",
    isPrimary: true,
    organization: {
      id: "org-1",
      name: "Acme Corp",
      slug: "acme",
    },
  };

  it("returns MATCH for the actor's current organization slug", async () => {
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "MATCH",
      requestedSlug: "acme",
      organizationSlug: "acme",
    });
    expect(mockResolveOrganizationSlug).toHaveBeenCalledWith(prisma, "acme");
    await app.close();
  });

  it("returns MATCH when an active membership exists", async () => {
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "MATCH",
      requestedSlug: "acme",
      organizationSlug: "acme",
    });
    await app.close();
  });

  it("returns ALIAS_REDIRECT for an old slug owned by the actor's organization", async () => {
    mockResolveOrganizationSlug.mockResolvedValue({
      ...resolvedSlug,
      matchedSlug: "old-acme",
      isPrimary: false,
    });
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "old-acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "ALIAS_REDIRECT",
      requestedSlug: "old-acme",
      organizationSlug: "acme",
    });
    await app.close();
  });

  it("returns ARCHIVED for members of an archived organization", async () => {
    const archivedAt = new Date("2026-07-04T17:30:00.000Z");
    mockResolveOrganizationSlug.mockResolvedValue({
      ...resolvedSlug,
      organization: {
        ...resolvedSlug.organization,
        archivedAt,
      },
    });
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
              archivedAt,
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "ARCHIVED",
      requestedSlug: "acme",
      organizationSlug: "acme",
      organizationName: "Acme Corp",
      archivedAt: "2026-07-04T17:30:00.000Z",
    });
    await app.close();
  });

  it("returns NOT_FOUND for an unknown slug without exposing organization data", async () => {
    mockResolveOrganizationSlug.mockResolvedValue(null);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-1",
            organization: {
              name: "Acme Corp",
              slug: "acme",
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "not-real" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "NOT_FOUND",
      requestedSlug: "not-real",
    });
    await app.close();
  });

  it("returns NO_ACTOR_ORG for signed-in users who have not joined an organization", async () => {
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "NO_ACTOR_ORG",
      requestedSlug: "acme",
      organizationSlug: "acme",
    });
    await app.close();
  });

  it("returns NO_ACTOR_ORG when no active memberships exist", async () => {
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "NO_ACTOR_ORG",
      requestedSlug: "acme",
      organizationSlug: "acme",
    });
    await app.close();
  });

  it("returns DIFFERENT_ORG from active memberships", async () => {
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockAuthIdentityFindUnique.mockResolvedValue({
      user: {
        memberships: [
          {
            organizationId: "org-other",
            organization: {
              name: "Other Org",
              slug: "other-org",
            },
          },
        ],
      },
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "DIFFERENT_ORG",
      requestedSlug: "acme",
      organizationSlug: "acme",
      actorOrganizationSlug: "other-org",
      actorOrganizationName: "Other Org",
    });
    await app.close();
  });

  it("rejects malformed slug requests before resolving aliases", async () => {
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/route-context",
      payload: { slug: "Acme Corp" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(mockResolveOrganizationSlug).not.toHaveBeenCalled();
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
    organization: { name: "Acme Corp" },
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    usedAt: null,
  };
  const joinedUser = makeMember({
    email: "alice@example.com",
    houseId: null,
    house: null,
  });
  const resolvedSlug = {
    organizationId: "org-1",
    matchedSlug: "acme",
    currentSlug: "acme",
    isPrimary: true,
    organization: {
      id: "org-1",
      name: "Acme Corp",
      slug: "acme",
    },
  };

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
    mockResolveOrganizationSlug.mockResolvedValue(resolvedSlug);
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        ...joinedUser,
        memberships: [
          {
            organizationId: "org-1",
            role: "MEMBER",
            houseId: null,
            organization: { name: "Acme Corp", slug: "acme" },
            house: null,
          },
        ],
      });
    mockCreate.mockResolvedValue(joinedUser);
    mockMembershipFindMany.mockResolvedValue([
      { user: { id: "admin-1" } },
      { user: { id: "owner-1" } },
    ]);
    mockNotificationCreateMany.mockResolvedValue({ count: 2 });
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload: { ...payload, organizationSlug: "acme" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      organizationId: "org-1",
      houseId: null,
      created: true,
      organizationContexts: [
        expect.objectContaining({
          organizationId: "org-1",
          organizationSlug: "acme",
          role: "MEMBER",
          isCurrent: true,
        }),
      ],
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
    expect(mockMembershipCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-1",
        role: "MEMBER",
        houseId: null,
      },
      select: { id: true },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          organizationId: expect.anything(),
          houseId: expect.anything(),
          role: expect.anything(),
        }),
      }),
    );
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
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        role: { in: ["ADMIN", "OWNER"] },
        userId: { not: "user-1" },
        isActive: true,
        archivedAt: null,
      },
      select: { user: { select: { id: true } } },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        {
          organizationId: "org-1",
          recipientUserId: "admin-1",
          type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
          severity: "ACTION_REQUIRED",
          title: "New member needs a house",
          body: "Alice joined Acme Corp and has not been assigned to a house yet.",
          actionLabel: "Assign house",
          actionHref: "/?tab=manage&section=team",
          entityType: "User",
          entityId: "user-1",
          dedupeKey: "member-needs-house-assignment:org-1:user-1",
        },
        {
          organizationId: "org-1",
          recipientUserId: "owner-1",
          type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
          severity: "ACTION_REQUIRED",
          title: "New member needs a house",
          body: "Alice joined Acme Corp and has not been assigned to a house yet.",
          actionLabel: "Assign house",
          actionHref: "/?tab=manage&section=team",
          entityType: "User",
          entityId: "user-1",
          dedupeKey: "member-needs-house-assignment:org-1:user-1",
        },
      ],
      skipDuplicates: true,
    });
    expect(JSON.stringify(mockNotificationCreateMany.mock.calls)).not.toContain("single-use-token");
    await app.close();
  });

  it("ignores stale legacy house assignment when deciding join notifications", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    const housedUser = makeMember({
      email: "alice@example.com",
      houseId: "house-1",
      house: { name: "Phoenix", color: "#7c3aed" },
    });
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(housedUser);
    mockCreate.mockResolvedValue(housedUser);
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
    mockMembershipFindMany.mockResolvedValue([{ user: { id: "admin-1" } }]);
    mockNotificationCreateMany.mockResolvedValue({ count: 1 });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        role: { in: ["ADMIN", "OWNER"] },
        userId: { not: "user-1" },
        isActive: true,
        archivedAt: null,
      },
      select: { user: { select: { id: true } } },
    });
    expect(mockNotificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          organizationId: "org-1",
          recipientUserId: "admin-1",
          type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
          entityId: "user-1",
        }),
      ],
      skipDuplicates: true,
    }));
    await app.close();
  });

  it("skips notification creation when no admin or owner recipients exist", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(joinedUser);
    mockCreate.mockResolvedValue(joinedUser);
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
    mockMembershipFindMany.mockResolvedValue([]);
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(mockMembershipFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        role: { in: ["ADMIN", "OWNER"] },
        userId: { not: "user-1" },
        isActive: true,
        archivedAt: null,
      },
      select: { user: { select: { id: true } } },
    });
    expect(mockNotificationCreateMany).not.toHaveBeenCalled();
    await app.close();
  });

  it("uses skipDuplicates so assignment notifications are idempotent", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(joinedUser);
    mockCreate.mockResolvedValue(joinedUser);
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
    mockMembershipFindMany.mockResolvedValue([{ user: { id: "admin-1" } }]);
    mockNotificationCreateMany.mockResolvedValue({ count: 0 });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(mockNotificationCreateMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
    }));
    await app.close();
  });

  it("does not claim an invite when the provided organization slug does not match", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockResolveOrganizationSlug.mockResolvedValue({
      ...resolvedSlug,
      organizationId: "org-other",
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload: { ...payload, organizationSlug: "other-org" },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("INVITE_ORG_MISMATCH");
    expect(mockInviteUpdateMany).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUserUpdate).not.toHaveBeenCalled();
    await app.close();
  });

  it("creates a membership when an existing user joins another organization", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      organizationId: "org-other",
    });
    mockUserUpdate.mockResolvedValue(joinedUser);
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.not.objectContaining({
          organizationId: expect.anything(),
          houseId: expect.anything(),
          role: expect.anything(),
        }),
      }),
    );
    expect(mockMembershipCreate).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-1",
        role: "MEMBER",
        houseId: null,
      },
      select: { id: true },
    });
    expect(mockInviteUpdateMany).toHaveBeenCalledOnce();
    await app.close();
  });

  it("reactivates an archived membership when the invite is valid", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      organizationId: "org-other",
    });
    mockMembershipFindFirst.mockResolvedValue({
      id: "membership-archived",
      isActive: false,
      archivedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    mockUserUpdate.mockResolvedValue(joinedUser);
    mockMembershipUpdate.mockResolvedValue({ id: "membership-archived" });
    mockInviteUpdateMany.mockResolvedValue({ count: 1 });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(200);
    expect(mockMembershipUpdate).toHaveBeenCalledWith({
      where: { id: "membership-archived" },
      data: {
        isActive: true,
        archivedAt: null,
        role: "MEMBER",
        houseId: null,
      },
      select: { id: true },
    });
    expect(mockMembershipCreate).not.toHaveBeenCalled();
    expect(mockInviteUpdateMany).toHaveBeenCalledOnce();
    await app.close();
  });

  it("does not claim an invite when the user already has an active membership in that organization", async () => {
    mockInviteFindUnique.mockResolvedValue(invite);
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      organizationId: "org-1",
    });
    mockMembershipFindFirst.mockResolvedValue({
      id: "membership-1",
      isActive: true,
      archivedAt: null,
    });
    const app = await buildTestApp();

    const res = await app.inject({
      method: "POST",
      url: "/orgs/join",
      payload,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe("ALREADY_IN_ORG");
    expect(mockUserUpdate).not.toHaveBeenCalled();
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

describe("POST /notifications/list", () => {
  it("returns the current actor's notifications with unread count and pagination", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    mockNotificationFindMany.mockResolvedValue([
      {
        id: "notification-3",
        type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
        severity: "ACTION_REQUIRED",
        title: "New member needs a house",
        body: "Casey joined and has not been assigned to a house yet.",
        actionLabel: "Assign house",
        actionHref: "/?tab=manage&section=team",
        entityType: "User",
        entityId: "user-casey",
        readAt: null,
        createdAt: new Date("2026-06-30T12:02:00.000Z"),
      },
      {
        id: "notification-2",
        type: "SEASON_STARTED",
        severity: "INFO",
        title: "Season started",
        body: "Season 1 is now active.",
        actionLabel: "View overview",
        actionHref: "/",
        entityType: "Season",
        entityId: "season-1",
        readAt: new Date("2026-06-30T12:01:00.000Z"),
        createdAt: new Date("2026-06-30T12:01:00.000Z"),
      },
      {
        id: "notification-1",
        type: "INVITE_ACCEPTED",
        severity: "INFO",
        title: "Invite accepted",
        body: "Alice joined with an invite link.",
        actionLabel: null,
        actionHref: null,
        entityType: "OrgInvite",
        entityId: "invite-1",
        readAt: null,
        createdAt: new Date("2026-06-30T12:00:00.000Z"),
      },
    ]);
    mockNotificationCount.mockResolvedValue(2);
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/notifications/list",
      payload: {
        cursor: "notification-4",
        limit: 2,
        unreadOnly: true,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      items: [
        {
          id: "notification-3",
          type: "MEMBER_NEEDS_HOUSE_ASSIGNMENT",
          severity: "ACTION_REQUIRED",
          title: "New member needs a house",
          body: "Casey joined and has not been assigned to a house yet.",
          actionLabel: "Assign house",
          actionHref: "/?tab=manage&section=team",
          entityType: "User",
          entityId: "user-casey",
          readAt: null,
          createdAt: "2026-06-30T12:02:00.000Z",
        },
        {
          id: "notification-2",
          type: "SEASON_STARTED",
          severity: "INFO",
          title: "Season started",
          body: "Season 1 is now active.",
          actionLabel: "View overview",
          actionHref: "/",
          entityType: "Season",
          entityId: "season-1",
          readAt: "2026-06-30T12:01:00.000Z",
          createdAt: "2026-06-30T12:01:00.000Z",
        },
      ],
      unreadCount: 2,
      nextCursor: "notification-2",
    });
    expect(mockNotificationFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        recipientUserId: "user-2",
        archivedAt: null,
        readAt: null,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: 3,
      cursor: { id: "notification-4" },
      skip: 1,
      select: {
        id: true,
        type: true,
        severity: true,
        title: true,
        body: true,
        actionLabel: true,
        actionHref: true,
        entityType: true,
        entityId: true,
        readAt: true,
        createdAt: true,
      },
    });
    expect(mockNotificationCount).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        recipientUserId: "user-2",
        archivedAt: null,
        readAt: null,
      },
    });
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        recipientUserId: "user-2",
        archivedAt: null,
        readAt: { not: null },
        type: "RELEASE_ANNOUNCEMENT",
      },
      data: {
        archivedAt: expect.any(Date),
      },
    });
    await app.close();
  });

  it("rejects malformed list requests before reading notifications", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/notifications/list",
      payload: { limit: 1000 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(mockNotificationFindMany).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /notifications/mark-read", () => {
  it("marks only unread notifications belonging to the current actor", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    mockNotificationUpdateMany.mockResolvedValueOnce({ count: 2 }).mockResolvedValueOnce({ count: 0 });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/notifications/mark-read",
      payload: {
        notificationIds: ["notification-1", "notification-2"],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ updatedCount: 2 });
    expect(mockNotificationUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: { in: ["notification-1", "notification-2"] },
        organizationId: "org-1",
        recipientUserId: "user-2",
        archivedAt: null,
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });
    expect(mockNotificationUpdateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ["notification-1", "notification-2"] },
        organizationId: "org-1",
        recipientUserId: "user-2",
        archivedAt: null,
        readAt: { not: null },
        type: "RELEASE_ANNOUNCEMENT",
      },
      data: {
        archivedAt: expect.any(Date),
      },
    });
    await app.close();
  });

  it("archives release announcements after marking them read", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    mockNotificationUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 1 });
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/notifications/mark-read",
      payload: {
        notificationIds: ["notification-release"],
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ updatedCount: 1 });
    expect(mockNotificationUpdateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: { in: ["notification-release"] },
        organizationId: "org-1",
        recipientUserId: "user-2",
        archivedAt: null,
        readAt: { not: null },
        type: "RELEASE_ANNOUNCEMENT",
      },
      data: {
        archivedAt: expect.any(Date),
      },
    });
    await app.close();
  });

  it("rejects empty notification id lists", async () => {
    mockFindUnique.mockResolvedValue(makeAdmin());
    const app = await buildTestApp("auth0|admin");

    const res = await app.inject({
      method: "POST",
      url: "/notifications/mark-read",
      payload: { notificationIds: [] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });
});

describe("POST /notifications/mark-all-read", () => {
  it("marks all unread notifications for the current actor", async () => {
    mockFindUnique.mockResolvedValue(makeOwner());
    mockNotificationUpdateMany.mockResolvedValueOnce({ count: 3 }).mockResolvedValueOnce({ count: 1 });
    const app = await buildTestApp("auth0|owner");

    const res = await app.inject({
      method: "POST",
      url: "/notifications/mark-all-read",
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ updatedCount: 3 });
    expect(mockNotificationUpdateMany).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: "org-1",
        recipientUserId: "user-owner",
        archivedAt: null,
        readAt: null,
      },
      data: {
        readAt: expect.any(Date),
      },
    });
    expect(mockNotificationUpdateMany).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: "org-1",
        recipientUserId: "user-owner",
        archivedAt: null,
        readAt: { not: null },
        type: "RELEASE_ANNOUNCEMENT",
      },
      data: {
        archivedAt: expect.any(Date),
      },
    });
    await app.close();
  });

  it("requires an actor mapped to an organization", async () => {
    mockFindUnique.mockResolvedValue(null);
    const app = await buildTestApp("auth0|missing");

    const res = await app.inject({
      method: "POST",
      url: "/notifications/mark-all-read",
      payload: {},
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("ACTOR_NOT_MAPPED");
    expect(mockNotificationUpdateMany).not.toHaveBeenCalled();
    await app.close();
  });
});
