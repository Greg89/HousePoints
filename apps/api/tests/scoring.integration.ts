import { randomUUID } from "node:crypto";
import type { User, OrganizationMembership } from "@prisma/client";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { prisma } from "@housepoints/db";
import { createPointAward as submitPointAward, createPointDeduction, softDeleteTransaction } from "../src/routes/points.js";
import { archiveRecognitionCategory, createRecognitionCategory } from "../src/routes/recognition-categories.js";
import { startSeasonTransaction } from "../src/routes/seasons.js";
import { lockOrganizationScoring, withScoringWrite } from "../src/scoring-write.js";
import { idempotentPointMutation } from "../src/point-idempotency.js";
import type { ActorRecord } from "../src/actor.js";

async function createPointAward(params: Parameters<typeof submitPointAward>[0]) {
  const result = await submitPointAward(params);
  return prisma.pointTransaction.findUniqueOrThrow({ where: { id: result.transaction.id } });
}

const runId = `scoring-it-${Date.now()}`;
const orgIds: string[] = [];
const userIds: string[] = [];

async function fixture() {
  const org = await prisma.organization.create({ data: { name: runId, slug: `${runId}-${orgIds.length}` } });
  orgIds.push(org.id);
  const houses = await Promise.all(["A", "B", "C"].map(name => prisma.house.create({ data: { organizationId: org.id, name } })));
  const users: Array<{ user: User; membership: OrganizationMembership }> = [];
  for (const [i, house] of [houses[0], houses[0], houses[2], houses[1]].entries()) {
    const user = await prisma.user.create({ data: { auth0Sub: `${org.id}-${i}`, displayName: `Scoring ${i}` } });
    userIds.push(user.id);
    const membership = await prisma.organizationMembership.create({ data: { organizationId: org.id, userId: user.id, houseId: house.id, role: "OWNER" } });
    users.push({ user, membership });
  }
  const season = await prisma.season.create({ data: { organizationId: org.id, name: "Initial", startsAt: new Date(), isActive: true } });
  const actor = (index: number): ActorRecord => ({ id: users[index].user.id, displayName: users[index].user.displayName, auth0Sub: users[index].user.auth0Sub, membershipId: users[index].membership.id, houseId: users[index].membership.houseId, role: "OWNER", organizationId: org.id, organizationName: org.name, organizationSlug: org.slug });
  const award = (index = 0) => ({ organizationId: org.id, actorId: actor(index).id, actorDisplayName: actor(index).displayName, targetUserId: users[3].user.id, targetUserDisplayName: users[3].user.displayName, targetHouseId: houses[1].id, delta: 5, reason: "Integration recognition", trait: "COLLABORATION" as const });
  const deduction = (index = 0) => ({ ...award(index), actorHouseId: actor(index).houseId! });
  return { org, houses, users, season, actor, award, deduction };
}

async function revision(orgId: string) {
  return (await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { reportingRevision: true } })).reportingRevision;
}

// Hold the protocol lock, then observe real PostgreSQL lock waits before release.
// This proves overlap rather than depending on scheduling or fixed sleeps.
async function holdLock(orgId: string) {
  let acquired!: () => void;
  let release!: () => void;
  const ready = new Promise<void>(resolve => { acquired = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const done = prisma.$transaction(async tx => {
    await lockOrganizationScoring(tx, orgId);
    acquired();
    await gate;
  }, { timeout: 15_000 });
  await Promise.race([ready, done]);
  return { release, done };
}

async function waitForBlockedWrites(count: number) {
  const deadline = performance.now() + 5_000;
  while (performance.now() < deadline) {
    const [row] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
        AND query LIKE '%FOR NO KEY UPDATE%'
    `;
    if (Number(row.count) >= count) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Expected ${count} concurrent blocked scoring writes`);
}

async function testDeductions(sameHouse: boolean) {
  const f = await fixture();
  const before = await revision(f.org.id);
  const lock = await holdLock(f.org.id);
  const second = sameHouse
    ? { ...f.deduction(1), targetUserId: f.users[2].user.id, targetUserDisplayName: f.users[2].user.displayName, targetHouseId: f.houses[2].id }
    : f.deduction(2);
  const results = Promise.allSettled([createPointDeduction(f.deduction(0)), createPointDeduction(second)]);
  try { await waitForBlockedWrites(2); } finally { lock.release(); await lock.done; }
  const settled = await results;
  assert.equal(settled.filter(r => r.status === "fulfilled").length, 1);
  const failed = settled.find(r => r.status === "rejected");
  assert(failed?.status === "rejected");
  assert.equal(failed.reason.code, sameHouse ? "DEDUCTION_COOLDOWN_ACTIVE" : "TARGET_DEDUCTION_LIMIT_ACTIVE");
  assert.equal(await prisma.pointTransaction.count({ where: { organizationId: f.org.id } }), 1);
  assert.equal(await prisma.auditEvent.count({ where: { organizationId: f.org.id } }), 1);
  assert.equal(await prisma.notification.count({ where: { organizationId: f.org.id } }), 1);
  assert.equal(await revision(f.org.id), before + 1n);
  console.log(`PASS concurrent deductions (${sameHouse ? "same house" : "same target, different houses"})`);
}

async function testRollover(awardFirst: boolean) {
  const f = await fixture();
  const lock = await holdLock(f.org.id);
  let award!: ReturnType<typeof createPointAward>;
  let rollover!: ReturnType<typeof startSeasonTransaction>;
  try {
    if (awardFirst) award = createPointAward(f.award());
    else rollover = startSeasonTransaction(f.actor(0), "Next");
    await waitForBlockedWrites(1);
    if (awardFirst) rollover = startSeasonTransaction(f.actor(0), "Next");
    else award = createPointAward(f.award());
    await waitForBlockedWrites(2);
  } finally { lock.release(); await lock.done; }
  const [point, transition] = await Promise.all([award, rollover]);
  assert.equal(point.seasonId, awardFirst ? f.season.id : transition.activeSeason.id);
  assert.equal(transition.previousSeason.endsAt!.getTime(), transition.activeSeason.startsAt.getTime());
  assert(awardFirst ? point.createdAt <= transition.activeSeason.startsAt : point.createdAt >= transition.activeSeason.startsAt);
  assert.equal(await prisma.season.count({ where: { organizationId: f.org.id, isActive: true } }), 1);
  assert.equal(await prisma.pointTransaction.count({ where: { organizationId: f.org.id } }), 1);
  const before = await revision(f.org.id);
  await assert.rejects(startSeasonTransaction(f.actor(0), "Next"));
  assert.equal(await revision(f.org.id), before);
  assert.equal(await prisma.season.count({ where: { organizationId: f.org.id, isActive: true, endsAt: null } }), 1);
  console.log(`PASS ordered award/rollover (${awardFirst ? "award first" : "rollover first"}) and failed rollover rollback`);
}

async function createSeasonPlan(f: Awaited<ReturnType<typeof fixture>>) {
  const plannedEndsAt = new Date("2027-03-31T13:00:00.000Z");
  const plan = await prisma.seasonPlan.create({
    data: {
      organizationId: f.org.id,
      name: "Prepared next season",
      kickoffMessage: "Welcome to the next season.",
      plannedEndsAt,
      timezone: "America/New_York",
      version: 1,
      createdById: f.actor(0).id,
      updatedById: f.actor(0).id,
    },
  });
  return {
    plan,
    request: {
      expectedActiveSeasonId: f.season.id,
      expectedPlanVersion: plan.version,
      idempotencyKey: randomUUID(),
    },
  };
}

async function testPreparedKickoffAndRollback() {
  const f = await fixture();
  const { plan, request } = await createSeasonPlan(f);
  const transition = await startSeasonTransaction(f.actor(0), null, request);
  const retry = await startSeasonTransaction(f.actor(0), null, request);

  assert.equal(retry.replayed, true);
  assert.equal(retry.previousSeason.id, transition.previousSeason.id);
  assert.equal(retry.activeSeason.id, transition.activeSeason.id);
  assert.equal(transition.activeSeason.plannedEndsAt?.toISOString(), plan.plannedEndsAt?.toISOString());
  assert.equal(transition.activeSeason.timezone, plan.timezone);
  assert.equal(await prisma.seasonTransition.count({ where: { organizationId: f.org.id } }), 1);
  assert.equal(await prisma.seasonPlan.count({ where: { organizationId: f.org.id } }), 0);
  assert.equal(await prisma.season.count({ where: { organizationId: f.org.id, isActive: true } }), 1);
  assert.equal(await prisma.notification.count({
    where: { organizationId: f.org.id, body: { contains: plan.kickoffMessage! } },
  }), 4);
  assert.equal(await prisma.auditEvent.count({
    where: { organizationId: f.org.id, eventType: "SEASON_STARTED" },
  }), 1);

  const rollbackFixture = await fixture();
  const rollbackPlan = await createSeasonPlan(rollbackFixture);
  assert.match(rollbackFixture.org.id, /^[a-z0-9]+$/i);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Notification" ADD CONSTRAINT "s2_reject_kickoff_notification" CHECK ("organizationId" <> '${rollbackFixture.org.id}') NOT VALID`,
  );
  try {
    await assert.rejects(startSeasonTransaction(rollbackFixture.actor(0), null, rollbackPlan.request));
  } finally {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Notification" DROP CONSTRAINT "s2_reject_kickoff_notification"',
    );
  }
  assert.equal(await prisma.season.count({
    where: { organizationId: rollbackFixture.org.id, isActive: true },
  }), 1);
  assert.equal(await prisma.season.count({ where: { organizationId: rollbackFixture.org.id } }), 1);
  assert.equal(await prisma.seasonPlan.count({ where: { organizationId: rollbackFixture.org.id } }), 1);
  assert.equal(await prisma.seasonTransition.count({ where: { organizationId: rollbackFixture.org.id } }), 0);
  assert.equal(await prisma.auditEvent.count({ where: { organizationId: rollbackFixture.org.id } }), 0);
  console.log("PASS prepared kickoff idempotency, announcement persistence, plan consumption and transaction rollback");
}

async function testPreparedRollover(awardFirst: boolean) {
  const f = await fixture();
  const { request } = await createSeasonPlan(f);
  const lock = await holdLock(f.org.id);
  let award!: ReturnType<typeof createPointAward>;
  let rollover!: ReturnType<typeof startSeasonTransaction>;
  try {
    if (awardFirst) award = createPointAward(f.award());
    else rollover = startSeasonTransaction(f.actor(0), null, request);
    await waitForBlockedWrites(1);
    if (awardFirst) rollover = startSeasonTransaction(f.actor(0), null, request);
    else award = createPointAward(f.award());
    await waitForBlockedWrites(2);
  } finally {
    lock.release();
    await lock.done;
  }

  const [point, transition] = await Promise.all([award, rollover]);
  assert.equal(point.seasonId, awardFirst ? f.season.id : transition.activeSeason.id);
  assert.equal(transition.previousSeason.endsAt!.getTime(), transition.activeSeason.startsAt.getTime());
  assert(awardFirst
    ? point.createdAt <= transition.activeSeason.startsAt
    : point.createdAt >= transition.activeSeason.startsAt);
  assert.equal(await prisma.season.count({ where: { organizationId: f.org.id, isActive: true } }), 1);
  assert.equal(await prisma.seasonTransition.count({ where: { organizationId: f.org.id } }), 1);
  assert.equal(await prisma.seasonPlan.count({ where: { organizationId: f.org.id } }), 0);
  console.log(`PASS ordered prepared kickoff/award (${awardFirst ? "award first" : "kickoff first"})`);
}

async function testRollbackAndDeletions() {
  const f = await fixture();
  const before = await revision(f.org.id);
  await assert.rejects(withScoringWrite(f.org.id, async tx => {
    await tx.pointTransaction.create({ data: { organizationId: f.org.id, seasonId: f.season.id, actorUserId: f.actor(0).id, targetUserId: f.users[3].user.id, targetHouseId: f.houses[1].id, delta: 5, reason: "Rollback fixture", trait: "COLLABORATION" } });
    await tx.auditEvent.create({ data: { organizationId: f.org.id, actorUserId: f.actor(0).id, eventType: "POINT_DELETED", summary: "Rollback fixture" } });
    assert.equal((await tx.organization.findUniqueOrThrow({ where: { id: f.org.id } })).reportingRevision, before + 1n);
    // Fail a durable side effect after the ledger, revision, and audit writes.
    await tx.notification.create({ data: { organizationId: f.org.id, recipientUserId: "missing-f1-user", type: "POINT_AWARD_RECEIVED", severity: "INFO", title: "Rollback", body: "Rollback" } });
  }));
  assert.equal(await revision(f.org.id), before);
  assert.equal(await prisma.pointTransaction.count({ where: { organizationId: f.org.id } }), 0);
  assert.equal(await prisma.auditEvent.count({ where: { organizationId: f.org.id } }), 0);
  assert.equal(await prisma.notification.count({ where: { organizationId: f.org.id } }), 0);
  const point = await createPointAward(f.award());
  const params = { transactionId: point.id, actorId: f.actor(0).id, actorDisplayName: f.actor(0).displayName, organizationId: f.org.id, deletionReason: "Integration correction" };
  const deletions = await Promise.allSettled([softDeleteTransaction(params), softDeleteTransaction(params)]);
  assert.equal(deletions.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await revision(f.org.id), before + 2n);
  assert.equal(await prisma.auditEvent.count({ where: { organizationId: f.org.id, eventType: "POINT_DELETED" } }), 1);
  await prisma.pointTransaction.delete({ where: { id: point.id } });
  assert.equal(await revision(f.org.id), before + 3n);
  console.log("PASS rollback, duplicate deletion, and hard-delete revision coverage");
}

async function testRevisionCoverage() {
  const f = await fixture();
  const other = await fixture();
  const otherBefore = await revision(other.org.id);
  const point = await createPointAward(f.award());
  const before = await revision(f.org.id);
  // Direct DB writes exercise the same trigger used by platform moderation,
  // future correction code, and maintenance jobs (not just API helpers).
  const deletedAt = new Date();
  await prisma.pointTransaction.update({ where: { id: point.id }, data: { deletedAt } });
  assert.equal(await revision(f.org.id), before + 1n);
  await prisma.pointTransaction.update({ where: { id: point.id }, data: { deletedAt } });
  assert.equal(await revision(f.org.id), before + 1n);
  await prisma.pointTransaction.update({ where: { id: point.id }, data: { deletedAt: null, delta: 9 } });
  assert.equal(await revision(f.org.id), before + 2n);
  await prisma.season.update({ where: { id: f.season.id }, data: { name: "Renamed" } });
  assert.equal(await revision(f.org.id), before + 3n);
  assert.equal(await revision(other.org.id), otherBefore);
  assert.equal((await prisma.pointTransaction.aggregate({ where: { organizationId: f.org.id, deletedAt: null }, _sum: { delta: true } }))._sum.delta, 9);
  console.log("PASS revision coverage for direct moderation/correction/season writes, no-ops, and organization isolation");
}

async function profileContention() {
  const f = await fixture();
  const other = await fixture();
  const lock = await holdLock(f.org.id);
  try {
    // A different organization must complete while this one remains locked.
    await createPointAward(other.award());
  } finally { lock.release(); await lock.done; }
  const times = await Promise.all(Array.from({ length: 20 }, async () => {
    const start = performance.now();
    await createPointAward(f.award());
    return performance.now() - start;
  }));
  times.sort((a, b) => a - b);
  assert.equal(await prisma.pointTransaction.count({ where: { organizationId: f.org.id } }), 20);
  console.log(JSON.stringify({ event: "scoring.lock.profile", writes: 20, p50Ms: Math.round(times[9]), p95Ms: Math.round(times[18]), maxMs: Math.round(times[19]), note: "Local test DB, includes pool and lock waits; not a production capacity estimate" }));
}

async function testIdempotency() {
  for (const operation of ["AWARD", "DEDUCTION"] as const) {
    const f = await fixture();
    const input = { ...f.deduction(), idempotencyKey: randomUUID() };
    const submit = () => operation === "AWARD" ? submitPointAward(input) : createPointDeduction(input);
    const before = await revision(f.org.id);
    const lock = await holdLock(f.org.id);
    const results = Promise.all([submit(), submit()]);
    try { await waitForBlockedWrites(2); } finally { lock.release(); await lock.done; }
    const [a, b] = await results;
    assert.equal(a.transaction.id, b.transaction.id);
    assert.equal([a, b].filter(r => r.replayed).length, 1);
    // A lost response is retried after commit, even after the active season changes.
    await startSeasonTransaction(f.actor(0), "After retry");
    const afterRollover = await revision(f.org.id);
    assert.equal(afterRollover, before + 3n);
    assert.deepEqual(await submit(), { transaction: { id: a.transaction.id }, replayed: true });
    assert.equal(await revision(f.org.id), afterRollover);
    assert.equal(await prisma.pointTransaction.count({ where: { organizationId: f.org.id } }), 1);
    assert.equal(await prisma.notification.count({ where: { organizationId: f.org.id, type: operation === "AWARD" ? "POINT_AWARD_RECEIVED" : "POINT_DEDUCTION_RECEIVED" } }), 1);
    assert.equal(await prisma.auditEvent.count({ where: { organizationId: f.org.id, eventType: "POINTS_DEDUCTED" } }), operation === "DEDUCTION" ? 1 : 0);
    assert.equal(await prisma.pointMutationRequest.count({ where: { organizationId: f.org.id } }), 1);
    const changed = { ...input, reason: "Changed payload" };
    await assert.rejects(operation === "AWARD" ? submitPointAward(changed) : createPointDeduction(changed), { code: "IDEMPOTENCY_KEY_CONFLICT" });
    await prisma.organizationMembership.update({ where: { id: f.users[0].membership.id }, data: { isActive: false } });
    await assert.rejects(submit(), { code: "POINT_MUTATION_NOT_AUTHORIZED" });
    await prisma.organizationMembership.update({ where: { id: f.users[0].membership.id }, data: { isActive: true } });
    if (operation === "DEDUCTION") {
      await prisma.organizationMembership.update({ where: { id: f.users[0].membership.id }, data: { role: "MEMBER" } });
      await assert.rejects(submit(), { code: "POINT_MUTATION_NOT_AUTHORIZED" });
      await prisma.organizationMembership.update({ where: { id: f.users[0].membership.id }, data: { role: "OWNER" } });
    }
    await prisma.organizationMembership.update({ where: { id: f.users[3].membership.id }, data: { isActive: false } });
    await assert.rejects(submit(), { code: "POINT_MUTATION_NOT_AUTHORIZED" });
    await prisma.organizationMembership.update({ where: { id: f.users[3].membership.id }, data: { isActive: true } });
    await prisma.pointMutationRequest.updateMany({ where: { organizationId: f.org.id }, data: { expiresAt: new Date(0) } });
    await assert.rejects(submit(), { code: "IDEMPOTENCY_KEY_EXPIRED" });
    assert.equal(await revision(f.org.id), afterRollover);
    console.log(`PASS ${operation} concurrent retries, lost response, changed payload, revoked access and expiry`);
  }
  const f = await fixture();
  const key = randomUUID();
  const first = await submitPointAward({ ...f.award(), idempotencyKey: key });
  const otherActor = await submitPointAward({ ...f.award(1), idempotencyKey: key });
  const otherOperation = await createPointDeduction({ ...f.deduction(), idempotencyKey: key });
  const other = await fixture();
  const otherOrg = await submitPointAward({ ...other.award(), idempotencyKey: key });
  assert.equal(new Set([first, otherActor, otherOperation, otherOrg].map(r => r.transaction.id)).size, 4);
  // Failure after writing the ledger rolls back the request record and revision too.
  const before = await revision(f.org.id);
  await assert.rejects(withScoringWrite(f.org.id, async tx => {
    await idempotentPointMutation(tx, { ...f.award(), idempotencyKey: randomUUID() }, "AWARD", async () => {
      const row = await tx.pointTransaction.create({ data: { organizationId: f.org.id, seasonId: f.season.id, actorUserId: f.actor(0).id, targetUserId: f.users[3].user.id, targetHouseId: f.houses[1].id, delta: 5, reason: "Rollback", trait: "COLLABORATION" } });
      return row;
    });
    throw new Error("Lost transaction");
  }));
  assert.equal(await prisma.pointMutationRequest.count({ where: { organizationId: f.org.id } }), 3);
  assert.equal(await revision(f.org.id), before);
  console.log("PASS retry scope isolation and atomic request rollback");
}

async function testClosedSeasonCorrections() {
  for (const deduction of [false, true]) {
    const f = await fixture();
    const point = deduction ? (await createPointDeduction(f.deduction())).transaction : await createPointAward(f.award());
    await startSeasonTransaction(f.actor(0), "New season");
    const before = await revision(f.org.id);
    const params = { transactionId: point.id, actorId: f.actor(0).id, actorDisplayName: f.actor(0).displayName, organizationId: f.org.id, deletionReason: null as string | null };
    for (const deletionReason of [null, "", "   "]) {
      await assert.rejects(softDeleteTransaction({ ...params, deletionReason }), { code: "CORRECTION_REASON_REQUIRED" });
    }
    const other = await fixture();
    await assert.rejects(softDeleteTransaction({ ...params, organizationId: other.org.id, deletionReason: "Cross org" }), { code: "POINT_TRANSACTION_NOT_FOUND" });
    assert.equal(await revision(f.org.id), before);
    const total = async () => (await prisma.pointTransaction.aggregate({ where: { organizationId: f.org.id, seasonId: f.season.id, deletedAt: null }, _sum: { delta: true } }))._sum.delta ?? 0;
    const delta = deduction ? -10 : 5;
    assert.equal(await total(), delta);
    // A real database constraint rejects audit persistence after the ledger UPDATE.
    // Only this fixture's organization is affected; remove the constraint in finally.
    assert.match(f.org.id, /^[a-z0-9]+$/i);
    await prisma.$executeRawUnsafe(`ALTER TABLE "AuditEvent" ADD CONSTRAINT "f3_reject_fixture_audit" CHECK ("organizationId" <> '${f.org.id}') NOT VALID`);
    try {
      await assert.rejects(softDeleteTransaction({ ...params, deletionReason: "Duplicate record" }));
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "AuditEvent" DROP CONSTRAINT "f3_reject_fixture_audit"');
    }
    assert.equal(await total(), delta);
    assert.equal(await revision(f.org.id), before);
    assert.equal((await prisma.pointTransaction.findUniqueOrThrow({ where: { id: point.id } })).deletedAt, null);
    assert.equal(await prisma.auditEvent.count({ where: { organizationId: f.org.id, eventType: "POINT_DELETED" } }), 0);
    assert.equal(await prisma.notification.count({ where: { organizationId: f.org.id, type: "SEASON_CORRECTION" } }), 0);
    const corrected = await softDeleteTransaction({ ...params, deletionReason: "  Duplicate record  " });
    assert.equal(await total(), 0);
    assert.equal(corrected.deletionReason, "Duplicate record");
    assert.equal(await revision(f.org.id), before + 1n);
    const audit = await prisma.auditEvent.findFirstOrThrow({ where: { organizationId: f.org.id, eventType: "POINT_DELETED" } });
    assert.equal(audit.actorUserId, params.actorId);
    assert.equal(audit.createdAt.toISOString(), corrected.deletedAt!.toISOString());
    const metadata = audit.metadata as Record<string, unknown>;
    assert.equal(metadata.transactionId, point.id);
    assert.equal(metadata.seasonId, f.season.id);
    assert.equal(metadata.isClosedSeason, true);
    assert.equal(metadata.deletionReason, "Duplicate record");
    assert.equal(metadata.scoreContributionBefore, delta);
    assert.equal(metadata.scoreContributionAfter, 0);
    assert.equal(metadata.scoreChange, -delta);
    assert.equal(metadata.reportingRevision, (before + 1n).toString());
    const correctionNotifications = await prisma.notification.findMany({
      where: { organizationId: f.org.id, type: "SEASON_CORRECTION" },
      orderBy: { recipientUserId: "asc" },
    });
    assert.equal(correctionNotifications.length, 4);
    assert(correctionNotifications.every(row =>
      row.actionHref === `/o/${f.org.slug}/reports?season=${f.season.id}` &&
      row.body.includes("No winner") &&
      row.entityId === f.season.id
    ));
  }
  const f = await fixture();
  const point = await createPointAward(f.award());
  const lock = await holdLock(f.org.id);
  const rollover = startSeasonTransaction(f.actor(0), "Rollover before correction");
  let correction!: Promise<unknown>;
  try {
    await waitForBlockedWrites(1);
    correction = assert.rejects(softDeleteTransaction({ transactionId: point.id, actorId: f.actor(0).id, actorDisplayName: f.actor(0).displayName, organizationId: f.org.id, deletionReason: null }), { code: "CORRECTION_REASON_REQUIRED" });
    await waitForBlockedWrites(2);
  } finally { lock.release(); await lock.done; }
  await Promise.all([rollover, correction]);
  assert.equal((await prisma.pointTransaction.findUniqueOrThrow({ where: { id: point.id } })).deletedAt, null);
  console.log("PASS closed-season award/deduction corrections, missing reasons, scope, audit failure rollback, totals/revision and rollover race");
}

async function testRecognitionCategories() {
  const f = await fixture();
  const owner = f.actor(0);
  const creationKey = randomUUID();
  const create = () => createRecognitionCategory({
    organizationId: f.org.id,
    actorId: owner.id,
    actorDisplayName: owner.displayName,
    idempotencyKey: creationKey,
    name: "  Community   Impact  ",
    description: "  Recognizes work beyond the team.  ",
  });
  const [first, replay] = await Promise.all([create(), create()]);
  assert.equal(first.id, replay.id);
  assert.equal(first.name, "Community Impact");
  assert.equal(first.normalizedName, "community impact");
  assert.equal(first.description, "Recognizes work beyond the team.");
  assert.equal(await prisma.auditEvent.count({
    where: { organizationId: f.org.id, eventType: "RECOGNITION_CATEGORY_CREATED" },
  }), 1);
  await assert.rejects(createRecognitionCategory({
    organizationId: f.org.id,
    actorId: owner.id,
    actorDisplayName: owner.displayName,
    idempotencyKey: creationKey,
    name: "Different category",
  }), { code: "IDEMPOTENCY_KEY_CONFLICT" });

  const other = await fixture();
  const otherCategory = await prisma.recognitionCategory.findFirstOrThrow({
    where: { organizationId: other.org.id },
  });
  await assert.rejects(createPointAward({ ...f.award(), trait: undefined, categoryId: otherCategory.id }), {
    code: "RECOGNITION_CATEGORY_UNAVAILABLE",
  });

  const lock = await holdLock(f.org.id);
  const archive = archiveRecognitionCategory({
    organizationId: f.org.id,
    actorId: owner.id,
    actorDisplayName: owner.displayName,
    categoryId: first.id,
  });
  const award = createPointAward({ ...f.award(), trait: undefined, categoryId: first.id });
  try { await waitForBlockedWrites(2); } finally { lock.release(); await lock.done; }
  const [archiveResult, awardResult] = await Promise.allSettled([archive, award]);
  assert.equal(archiveResult.status, "fulfilled");
  if (awardResult.status === "fulfilled") {
    assert.equal(awardResult.value.categoryId, first.id);
  } else {
    assert.equal(awardResult.reason.code, "RECOGNITION_CATEGORY_UNAVAILABLE");
  }
  assert.equal((await prisma.recognitionCategory.findUniqueOrThrow({ where: { id: first.id } })).archivedAt instanceof Date, true);

  const replacement = await createRecognitionCategory({
    organizationId: f.org.id,
    actorId: owner.id,
    actorDisplayName: owner.displayName,
    idempotencyKey: randomUUID(),
    name: "community impact",
    description: "A separate category identity.",
  });
  assert.notEqual(replacement.id, first.id);

  const active = await prisma.recognitionCategory.findMany({
    where: { organizationId: f.org.id, archivedAt: null },
    orderBy: { id: "asc" },
  });
  for (const category of active.slice(0, -2)) {
    await archiveRecognitionCategory({
      organizationId: f.org.id,
      actorId: owner.id,
      actorDisplayName: owner.displayName,
      categoryId: category.id,
    });
  }
  const finalTwo = await prisma.recognitionCategory.findMany({
    where: { organizationId: f.org.id, archivedAt: null },
    orderBy: { id: "asc" },
  });
  assert.equal(finalTwo.length, 2);
  const finalArchives = await Promise.allSettled(finalTwo.map((category) => archiveRecognitionCategory({
    organizationId: f.org.id,
    actorId: owner.id,
    actorDisplayName: owner.displayName,
    categoryId: category.id,
  })));
  assert.equal(finalArchives.filter((result) => result.status === "fulfilled").length, 1);
  const rejectedArchive = finalArchives.find((result) => result.status === "rejected");
  assert(rejectedArchive?.status === "rejected");
  assert.equal(rejectedArchive.reason.code, "RECOGNITION_CATEGORY_LAST_ACTIVE");
  assert.equal(await prisma.recognitionCategory.count({
    where: { organizationId: f.org.id, archivedAt: null },
  }), 1);
  console.log("PASS recognition category retries, tenant scope, archive/award ordering, name reuse and final-category race");
}

try {
  await testRecognitionCategories();
  await testClosedSeasonCorrections();
  await testIdempotency();
  await testDeductions(true);
  await testDeductions(false);
  await testRollover(true);
  await testRollover(false);
  await testPreparedKickoffAndRollback();
  await testPreparedRollover(true);
  await testPreparedRollover(false);
  await testRollbackAndDeletions();
  await testRevisionCoverage();
  await profileContention();
} finally {
  // Only this run's fixtures; never truncate shared test tables.
  await prisma.notification.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.auditEvent.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.pointTransaction.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.seasonTransition.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.season.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.house.deleteMany({ where: { organizationId: { in: orgIds } } });
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
}
