import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/index.js";

const runId = `db-it-${Date.now()}-${Math.random().toString(16).slice(2)}`;

type CreatedRecords = {
  organizationIds: string[];
  houseIds: string[];
  userIds: string[];
  seasonIds: string[];
  auditEventIds: string[];
};

const created: CreatedRecords = {
  organizationIds: [],
  houseIds: [],
  userIds: [],
  seasonIds: [],
  auditEventIds: [],
};

async function cleanup() {
  await prisma.auditEvent.deleteMany({
    where: { id: { in: created.auditEventIds } },
  });
  await prisma.pointTransaction.deleteMany({
    where: { organizationId: { in: created.organizationIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: created.userIds } } });
  await prisma.season.deleteMany({ where: { id: { in: created.seasonIds } } });
  await prisma.house.deleteMany({ where: { id: { in: created.houseIds } } });
  await prisma.organization.deleteMany({
    where: { id: { in: created.organizationIds } },
  });
}

function assertPrismaErrorCode(error: unknown, code: string) {
  assert(error instanceof Prisma.PrismaClientKnownRequestError);
  assert.equal(error.code, code);
}

function assertPrismaConstraintFailure(error: unknown) {
  assert(error instanceof Error);
  assert.match(error.message, /violates check constraint/i);
}

async function createLedgerFixture() {
  const organization = await prisma.organization.create({
    data: {
      name: `Integration Org ${runId}`,
      slug: `integration-${runId}`,
    },
  });
  created.organizationIds.push(organization.id);

  const house = await prisma.house.create({
    data: {
      organizationId: organization.id,
      name: "Engineering",
      color: "#7c3aed",
    },
  });
  created.houseIds.push(house.id);

  const actor = await prisma.user.create({
    data: {
      auth0Sub: `auth0|${runId}-actor`,
      email: `${runId}-actor@example.com`,
      displayName: "Integration Actor",
      organizationId: organization.id,
      houseId: house.id,
    },
  });
  created.userIds.push(actor.id);

  const target = await prisma.user.create({
    data: {
      auth0Sub: `auth0|${runId}-target`,
      email: `${runId}-target@example.com`,
      displayName: "Integration Target",
      organizationId: organization.id,
      houseId: house.id,
    },
  });
  created.userIds.push(target.id);

  const season = await prisma.season.create({
    data: {
      organizationId: organization.id,
      name: "Integration Season",
      startsAt: new Date(),
      isActive: true,
      createdById: actor.id,
    },
  });
  created.seasonIds.push(season.id);

  return { organization, house, actor, target, season };
}

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must point to a disposable test database");
  }

  const { organization, house, actor, target, season } = await createLedgerFixture();

  const transaction = await prisma.pointTransaction.create({
    data: {
      organizationId: organization.id,
      seasonId: season.id,
      actorUserId: actor.id,
      targetUserId: target.id,
      targetHouseId: house.id,
      delta: 10,
      reason: "Database integration test award",
      trait: "TEAM_SUPPORT",
    },
    include: {
      organization: true,
      season: true,
      actor: true,
      targetUser: true,
      targetHouse: true,
    },
  });

  assert.equal(transaction.organization.id, organization.id);
  assert.equal(transaction.season.id, season.id);
  assert.equal(transaction.actor.id, actor.id);
  assert.equal(transaction.targetUser?.id, target.id);
  assert.equal(transaction.targetHouse.id, house.id);
  assert.equal(transaction.delta, 10);
  assert.equal(transaction.trait, "TEAM_SUPPORT");

  const auditEvent = await prisma.auditEvent.create({
    data: {
      organizationId: organization.id,
      actorUserId: actor.id,
      eventType: "USER_HOUSE_ASSIGNED",
      summary: "Integration Actor assigned Integration Target to Engineering.",
      metadata: {
        targetUserId: target.id,
        targetHouseId: house.id,
      },
    },
  });
  created.auditEventIds.push(auditEvent.id);

  assert.equal(auditEvent.organizationId, organization.id);
  assert.equal(auditEvent.actorUserId, actor.id);
  assert.deepEqual(auditEvent.metadata, {
    targetUserId: target.id,
    targetHouseId: house.id,
  });

  await assert.rejects(
    () =>
      prisma.pointTransaction.create({
        data: {
          organizationId: organization.id,
          seasonId: season.id,
          actorUserId: actor.id,
          targetUserId: target.id,
          targetHouseId: house.id,
          delta: 0,
          reason: "Zero delta should fail",
          trait: "TEAM_SUPPORT",
        },
      }),
    (error) => {
      assertPrismaConstraintFailure(error);
      return true;
    },
  );

  await assert.rejects(
    () =>
      prisma.pointTransaction.create({
        data: {
          organizationId: organization.id,
          seasonId: season.id,
          actorUserId: actor.id,
          targetUserId: target.id,
          targetHouseId: house.id,
          delta: 5,
          reason: "Missing trait should fail",
          trait: null,
        },
      }),
    (error) => {
      assertPrismaConstraintFailure(error);
      return true;
    },
  );

  await assert.rejects(
    () =>
      prisma.pointTransaction.create({
        data: {
          organizationId: organization.id,
          seasonId: season.id,
          actorUserId: actor.id,
          targetUserId: target.id,
          targetHouseId: house.id,
          delta: 5,
          reason: "  ",
          trait: "TEAM_SUPPORT",
        },
      }),
    (error) => {
      assertPrismaConstraintFailure(error);
      return true;
    },
  );

  await assert.rejects(
    () =>
      prisma.pointTransaction.create({
        data: {
          organizationId: organization.id,
          seasonId: `${runId}-missing-season`,
          actorUserId: actor.id,
          targetUserId: target.id,
          targetHouseId: house.id,
          delta: 5,
          reason: "Invalid season should fail",
          trait: "TEAM_SUPPORT",
        },
      }),
    (error) => {
      assertPrismaErrorCode(error, "P2003");
      return true;
    },
  );

  await assert.rejects(
    () =>
      prisma.house.create({
        data: {
          organizationId: organization.id,
          name: house.name,
        },
      }),
    (error) => {
      assertPrismaErrorCode(error, "P2002");
      return true;
    },
  );

  await assert.rejects(
    () => prisma.organization.delete({ where: { id: organization.id } }),
    (error) => {
      assertPrismaErrorCode(error, "P2003");
      return true;
    },
  );
}

try {
  await run();
} finally {
  await cleanup();
  await prisma.$disconnect();
}
