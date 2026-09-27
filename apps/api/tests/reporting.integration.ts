import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

// Query logging must be enabled before the shared Prisma client is imported.
process.env.HOUSEPOINTS_QUERY_METRICS = "true";
const [{ prisma }, { readReportPage }] = await Promise.all([
  import("@housepoints/db"),
  import("../src/report-service.js"),
]);

const secret = "reporting-integration-secret-with-at-least-32-characters";
const runId = `r2-it-${randomUUID()}`;
const measuredIterations = 5;
let queryCount = 0;
// The shared client has a runtime-configured query event; Prisma's static type
// cannot infer the event from that environment choice.
(prisma as typeof prisma & { $on(event: "query", callback: () => void): void })
  .$on("query", () => { queryCount += 1; });

type Fixture = Awaited<ReturnType<typeof fixture>>;

type PlanNode = { "Node Type": string; "Index Name"?: string; Plans?: PlanNode[] };

function findScan(node: PlanNode): PlanNode | null {
  if (node["Node Type"].includes("Scan")) return node;
  for (const child of node.Plans ?? []) {
    const scan = findScan(child);
    if (scan) return scan;
  }
  return null;
}

async function fixture(label: string, houseCount: number, memberCount: number, transactionCount: number) {
  const org = await prisma.organization.create({ data: { name: `R2 ${label}`, slug: `${runId}-${label}` } });
  const houses = await Promise.all(Array.from({ length: houseCount }, (_, index) =>
    prisma.house.create({ data: { organizationId: org.id, name: `House ${index + 1}` } })));
  const owner = await prisma.user.create({ data: { auth0Sub: `${runId}-${label}-owner`, displayName: "R2 Owner" } });
  const ownerMembership = await prisma.organizationMembership.create({ data: {
    organizationId: org.id, userId: owner.id, role: "OWNER", houseId: houses[0].id,
  } });
  const season = await prisma.season.create({ data: {
    organizationId: org.id, name: "R2 Season", startsAt: new Date("2026-09-01T00:00:00.000Z"), isActive: true,
  } });
  const firstCategory = await prisma.recognitionCategory.create({ data: {
    organizationId: org.id, name: "Shared name", normalizedName: "shared name", archivedAt: new Date("2026-09-15T00:00:00.000Z"),
  } });
  const replacementCategory = await prisma.recognitionCategory.create({ data: {
    organizationId: org.id, name: "Shared name", normalizedName: "shared name",
  } });
  await prisma.user.createMany({ data: Array.from({ length: memberCount }, (_, index) => ({
    auth0Sub: `${runId}-${label}-member-${String(index).padStart(4, "0")}`,
    displayName: `Member ${index}`,
  })) });
  const members = await prisma.user.findMany({
    where: { auth0Sub: { startsWith: `${runId}-${label}-member-` } },
    orderBy: { auth0Sub: "asc" }, select: { id: true },
  });
  await prisma.organizationMembership.createMany({ data: members.map((member, index) => ({
    organizationId: org.id, userId: member.id, houseId: houses[index % houses.length].id,
  })) });
  const startsAt = new Date("2026-09-20T12:00:00.000Z").getTime();
  const rows = Array.from({ length: transactionCount }, (_, index) => {
    const isDeduction = index % 10 === 0;
    return {
      organizationId: org.id, seasonId: season.id, actorUserId: owner.id,
      targetUserId: index === 0 ? null : members[index % members.length].id,
      targetHouseId: houses[index % houses.length].id,
      type: isDeduction ? "DEDUCTION" as const : "AWARD" as const,
      delta: isDeduction ? -10 : 5,
      reason: `R2 transaction ${index}`,
      categoryId: isDeduction ? null : index % 2 === 0 ? firstCategory.id : replacementCategory.id,
      createdAt: new Date(startsAt + index * 1000),
    };
  });
  await prisma.pointTransaction.createMany({ data: rows });
  return { org, houses, owner, ownerMembership, season, firstCategory, replacementCategory, members };
}

async function cleanup(f: Fixture) {
  await prisma.pointTransaction.deleteMany({ where: { organizationId: f.org.id } });
  await prisma.recognitionCategory.deleteMany({ where: { organizationId: f.org.id } });
  await prisma.organizationMembership.deleteMany({ where: { organizationId: f.org.id } });
  await prisma.season.deleteMany({ where: { organizationId: f.org.id } });
  await prisma.house.deleteMany({ where: { organizationId: f.org.id } });
  await prisma.organization.delete({ where: { id: f.org.id } });
  await prisma.user.deleteMany({ where: { id: { in: [f.owner.id, ...f.members.map((member) => member.id)] } } });
}

async function runScenario(label: string, houseCount: number, memberCount: number, transactionCount: number) {
  const f = await fixture(label, houseCount, memberCount, transactionCount);
  try {
    const params = {
      organizationId: f.org.id,
      membershipId: f.ownerMembership.id,
      actorUserId: f.owner.id,
      cursorSecret: secret,
    };
    const request = { seasonId: f.season.id, limit: 50 };
    await readReportPage({ ...params, request });
    const samples: Array<{
      page: Awaited<ReturnType<typeof readReportPage>>;
      ms: number;
      queries: number;
      bytes: number;
    }> = [];
    for (let index = 0; index < measuredIterations; index += 1) {
      queryCount = 0;
      const started = performance.now();
      const page = await readReportPage({ ...params, request });
      samples.push({ page, ms: performance.now() - started, queries: queryCount, bytes: Buffer.byteLength(JSON.stringify(page)) });
    }
    const first = samples[0].page;
    const timings = samples.map((sample) => sample.ms).sort((a, b) => a - b);
    assert(samples.every((sample) => sample.queries === samples[0].queries));
    assert.equal(first.summary.transactionCount, transactionCount);
    assert.equal(first.summary.netPoints, first.summary.awardedPoints - first.summary.deductedPoints);

    let cursor = first.nextCursor;
    const ids = new Set(first.items.map((item) => item.id));
    let pageNet = first.items.reduce((sum, item) => sum + item.delta, 0);
    let pageCount = 1;
    while (cursor) {
      const page = await readReportPage({ ...params, request: { ...request, cursor } });
      assert.equal(page.revision, first.revision);
      assert.deepEqual(page.summary, first.summary);
      for (const item of page.items) {
        assert(!ids.has(item.id), "cursor pages must not duplicate transactions");
        ids.add(item.id);
        pageNet += item.delta;
      }
      cursor = page.nextCursor;
      pageCount += 1;
    }
    assert.equal(ids.size, transactionCount);
    assert.equal(pageNet, first.summary.netPoints);

    const old = await readReportPage({ ...params, request: { ...request, categoryId: f.firstCategory.id } });
    const replacement = await readReportPage({ ...params, request: { ...request, categoryId: f.replacementCategory.id } });
    assert.equal(old.summary.deductionsOutsideCategory?.points, first.summary.deductedPoints);
    assert.equal(replacement.summary.deductionsOutsideCategory?.points, first.summary.deductedPoints);
    assert(old.items.every((item) => item.category?.id === f.firstCategory.id));
    assert(replacement.items.every((item) => item.category?.id === f.replacementCategory.id));
    const anonymous = await readReportPage({ ...params, request: { ...request, memberId: null } });
    assert.equal(anonymous.summary.transactionCount, transactionCount > 0 ? 1 : 0);

    if (transactionCount > 0) {
      const moved = f.members[1];
      const former = f.members[2];
      const originalHouse = f.houses[1 % f.houses.length];
      await prisma.organizationMembership.update({
        where: { organizationId_userId: { organizationId: f.org.id, userId: moved.id } },
        data: { houseId: f.houses[0].id },
      });
      await prisma.organizationMembership.update({
        where: { organizationId_userId: { organizationId: f.org.id, userId: former.id } },
        data: { isActive: false, archivedAt: new Date() },
      });
      const movedReport = await readReportPage({ ...params, request: { ...request, houseId: originalHouse.id, memberId: moved.id } });
      const formerReport = await readReportPage({ ...params, request: { ...request, memberId: former.id } });
      assert(movedReport.summary.transactionCount > 0);
      assert(formerReport.summary.transactionCount > 0);
    }

    if (label === "typical") {
      const foreignOrg = await prisma.organization.create({ data: { name: "Foreign R2", slug: `${runId}-foreign` } });
      try {
        const foreignHouse = await prisma.house.create({ data: { organizationId: foreignOrg.id, name: "Foreign house" } });
        await assert.rejects(readReportPage({ ...params, request: { ...request, houseId: foreignHouse.id } }), { code: "REPORT_SCOPE_NOT_FOUND" });
      } finally {
        await prisma.house.deleteMany({ where: { organizationId: foreignOrg.id } });
        await prisma.organization.delete({ where: { id: foreignOrg.id } });
      }
    }

    if (transactionCount > 0 && first.nextCursor) {
      await prisma.pointTransaction.update({ where: { id: first.items[0].id }, data: { deletedAt: new Date() } });
      await assert.rejects(
        readReportPage({ ...params, request: { ...request, cursor: first.nextCursor } }),
        { code: "REPORT_REFRESH_REQUIRED" },
      );
      const refreshed = await readReportPage({ ...params, request });
      assert.equal(refreshed.summary.transactionCount, transactionCount - 1);
    }

    await prisma.organizationMembership.update({ where: { id: f.ownerMembership.id }, data: { isActive: false } });
    await assert.rejects(readReportPage({ ...params, request }), { code: "REPORT_ACCESS_REVOKED" });

    const planRows = await prisma.$queryRaw<Array<{ "QUERY PLAN": Array<{ Plan: PlanNode; "Execution Time": number }> }>>`
      EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT id FROM "PointTransaction"
      WHERE "organizationId" = ${f.org.id} AND "seasonId" = ${f.season.id} AND "deletedAt" IS NULL
      ORDER BY "createdAt" DESC, id DESC LIMIT 51
    `;
    const plan = planRows[0]?.["QUERY PLAN"]?.[0];
    const scan = plan ? findScan(plan.Plan) : null;
    console.log(JSON.stringify({
      scenario: label, houses: houseCount, members: memberCount,
      transactions: transactionCount, pages: pageCount,
      firstPageQueries: samples[0].queries,
      firstPageBytes: samples[0].bytes,
      firstPageP50Ms: Math.round(timings[2] * 10) / 10,
      firstPageP95Ms: Math.round(timings[4] * 10) / 10,
      pagePlan: plan?.Plan["Node Type"] ?? "unknown",
      pageScan: scan?.["Node Type"] ?? "unknown",
      pageIndex: scan?.["Index Name"] ?? null,
      pagePlanExecutionMs: plan?.["Execution Time"] ?? null,
    }));
  } finally {
    await cleanup(f);
  }
}

try {
  await runScenario("empty", 4, 1, 0);
  await runScenario("typical", 4, 24, 120);
  await runScenario("larger", 8, 200, 1000);
} finally {
  await prisma.$disconnect();
}
