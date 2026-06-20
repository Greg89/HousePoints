import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import type { FastifyInstance } from "fastify";
import { TRAITS } from "@housepoints/contracts";
import type { VerifyAccessToken } from "../auth.js";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const apiRoot = fileURLToPath(new URL("../../", import.meta.url));

for (const envPath of [
  resolve(repoRoot, ".env"),
  resolve(apiRoot, ".env"),
  resolve(repoRoot, "packages/db/.env"),
]) {
  if (existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false, quiet: true });
  }
}

process.env.LOG_LEVEL ??= "silent";

const warmupIterations = 1;
const measuredIterations = 5;
const requestIdPrefix = `dashboard-baseline-${Date.now()}`;

const verifyAccessToken: VerifyAccessToken = async (token) => ({
  subject: token,
  claims: {
    sub: token,
    email: `${token.replace(/[^a-z0-9]/gi, "-").toLowerCase()}@example.test`,
    email_verified: true,
  },
});

const endpointSpecs = [
  {
    name: "current user",
    phase: "serial",
    method: "POST",
    url: "/users/bootstrap",
    expectedQueries: 1,
    body: { email: "owner@example.test", displayName: "Benchmark Owner" },
  },
  {
    name: "leaderboard",
    phase: "parallel",
    method: "POST",
    url: "/houses/leaderboard",
    expectedQueries: 4,
    body: {},
  },
  {
    name: "members",
    phase: "parallel",
    method: "POST",
    url: "/members",
    expectedQueries: 2,
    body: {},
  },
  {
    name: "activity",
    phase: "parallel",
    method: "POST",
    url: "/transactions/recent",
    expectedQueries: 2,
    body: { limit: 50 },
  },
  {
    name: "member scores",
    phase: "parallel",
    method: "POST",
    url: "/users/scores",
    expectedQueries: 3,
    body: {},
  },
  {
    name: "dashboard summary",
    phase: "parallel",
    method: "POST",
    url: "/dashboard/summary",
    expectedQueries: 9,
    body: {},
  },
  {
    name: "season context",
    phase: "parallel",
    method: "POST",
    url: "/seasons/context",
    expectedQueries: 2,
    body: {},
  },
  {
    name: "admin context",
    phase: "parallel",
    method: "POST",
    url: "/admin/context",
    expectedQueries: 3,
    body: {},
  },
] as const;

const scenarioConfigs = [
  {
    name: "empty",
    houseCount: 4,
    memberCount: 1,
    transactionCount: 0,
  },
  {
    name: "typical",
    houseCount: 4,
    memberCount: 24,
    transactionCount: 120,
  },
  {
    name: "larger",
    houseCount: 8,
    memberCount: 200,
    transactionCount: 1000,
  },
] as const;

type ScenarioConfig = (typeof scenarioConfigs)[number];
type EndpointName = (typeof endpointSpecs)[number]["name"];

type CreatedScenario = {
  name: ScenarioConfig["name"];
  actorSubject: string;
  organizationId: string;
};

type EndpointSample = {
  endpoint: EndpointName;
  ms: number;
  bytes: number;
};

type BundleSample = {
  totalMs: number;
  endpoints: EndpointSample[];
};

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1),
  );

  return sorted[index] ?? 0;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

async function createScenario(
  prisma: Awaited<typeof import("@housepoints/db")>["prisma"],
  config: ScenarioConfig,
): Promise<CreatedScenario> {
  const runSlug = `${requestIdPrefix}-${config.name}`.toLowerCase();
  const organization = await prisma.organization.create({
    data: {
      name: `Benchmark ${config.name}`,
      slug: runSlug,
    },
  });

  const houses = await Promise.all(
    Array.from({ length: config.houseCount }, (_, index) =>
      prisma.house.create({
        data: {
          organizationId: organization.id,
          name: `House ${index + 1}`,
          color: `#${((index + 1) * 2654435761).toString(16).slice(0, 6).padEnd(6, "0")}`,
          description: `Benchmark house ${index + 1}`,
        },
      }),
    ),
  );

  const actorSubject = `auth0|${runSlug}-owner`;
  const owner = await prisma.user.create({
    data: {
      auth0Sub: actorSubject,
      email: `${runSlug}-owner@example.test`,
      displayName: "Benchmark Owner",
      role: "OWNER",
      organizationId: organization.id,
      houseId: houses[0]?.id,
      authIdentities: {
        create: {
          providerSubject: actorSubject,
        },
      },
    },
  });

  const activeSeason = await prisma.season.create({
    data: {
      organizationId: organization.id,
      name: "Benchmark Season",
      startsAt: new Date(Date.UTC(2026, 0, 1)),
      isActive: true,
      createdById: owner.id,
    },
  });

  const members = [owner];
  const remainingMembers = Math.max(0, config.memberCount - 1);

  for (let index = 0; index < remainingMembers; index += 1) {
    const memberSubject = `auth0|${runSlug}-member-${index + 1}`;
    const house = houses[index % houses.length];

    members.push(
      await prisma.user.create({
        data: {
          auth0Sub: memberSubject,
          email: `${runSlug}-member-${index + 1}@example.test`,
          displayName: `Benchmark Member ${String(index + 1).padStart(3, "0")}`,
          role: "MEMBER",
          organizationId: organization.id,
          houseId: house?.id,
          authIdentities: {
            create: {
              providerSubject: memberSubject,
            },
          },
        },
      }),
    );
  }

  if (config.transactionCount > 0) {
    await prisma.pointTransaction.createMany({
      data: Array.from({ length: config.transactionCount }, (_, index) => {
        const targetUser = members[index % members.length] ?? owner;
        const targetHouseId = targetUser.houseId ?? houses[0]?.id;

        if (!targetHouseId) {
          throw new Error("Benchmark scenario requires at least one house");
        }

        return {
          organizationId: organization.id,
          seasonId: activeSeason.id,
          actorUserId: owner.id,
          targetUserId: targetUser.id,
          targetHouseId,
          delta: (index % 10) + 1,
          reason: `Benchmark award ${index + 1}`,
          trait: TRAITS[index % TRAITS.length],
          createdAt: new Date(Date.now() - (index % 30) * 86_400_000 - index * 1000),
        };
      }),
    });
  }

  return {
    name: config.name,
    actorSubject,
    organizationId: organization.id,
  };
}

async function cleanupScenarios(
  prisma: Awaited<typeof import("@housepoints/db")>["prisma"],
  organizationIds: string[],
): Promise<void> {
  if (organizationIds.length === 0) return;

  await prisma.pointTransaction.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.orgInvite.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.authIdentity.deleteMany({
    where: { user: { organizationId: { in: organizationIds } } },
  });
  await prisma.season.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.user.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.house.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: organizationIds } },
  });
}

async function injectEndpoint(
  app: FastifyInstance,
  actorSubject: string,
  endpoint: (typeof endpointSpecs)[number],
): Promise<EndpointSample> {
  const startedAt = performance.now();
  const response = await app.inject({
    method: endpoint.method,
    url: endpoint.url,
    headers: {
      authorization: `Bearer ${actorSubject}`,
      "content-type": "application/json",
      "x-request-id": `${requestIdPrefix}-${randomUUID()}`,
    },
    payload: endpoint.body,
  });
  const ms = performance.now() - startedAt;

  if (response.statusCode !== 200) {
    throw new Error(
      `${endpoint.name} returned ${response.statusCode}: ${response.body.slice(0, 500)}`,
    );
  }

  return {
    endpoint: endpoint.name,
    ms,
    bytes: Buffer.byteLength(response.body),
  };
}

async function runDashboardBundle(
  app: FastifyInstance,
  actorSubject: string,
): Promise<BundleSample> {
  const startedAt = performance.now();
  const serialEndpoints = endpointSpecs.filter((endpoint) => endpoint.phase === "serial");
  const parallelEndpoints = endpointSpecs.filter((endpoint) => endpoint.phase === "parallel");
  const serialSamples: EndpointSample[] = [];

  for (const endpoint of serialEndpoints) {
    serialSamples.push(await injectEndpoint(app, actorSubject, endpoint));
  }

  const parallelSamples = await Promise.all(
    parallelEndpoints.map((endpoint) => injectEndpoint(app, actorSubject, endpoint)),
  );

  return {
    totalMs: performance.now() - startedAt,
    endpoints: [...serialSamples, ...parallelSamples],
  };
}

function summarizeEndpoint(samples: BundleSample[], endpointName: EndpointName) {
  const endpointSamples = samples
    .flatMap((sample) => sample.endpoints)
    .filter((sample) => sample.endpoint === endpointName);
  const durations = endpointSamples.map((sample) => sample.ms);
  const payloadBytes = endpointSamples.map((sample) => sample.bytes);

  return {
    p50: round(percentile(durations, 50)),
    p95: round(percentile(durations, 95)),
    avgPayloadBytes: Math.round(average(payloadBytes)),
  };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set. Add it to packages/db/.env or the current shell.");
  }

  const [{ prisma }, { buildApp }] = await Promise.all([
    import("@housepoints/db"),
    import("../app.js"),
  ]);
  const app = await buildApp({
    corsAllowedOrigins: ["http://localhost:3000"],
    disableRateLimit: true,
    verifyAccessToken,
  });
  const createdOrganizationIds: string[] = [];

  try {
    const scenarios = [];
    for (const config of scenarioConfigs) {
      const scenario = await createScenario(prisma, config);
      createdOrganizationIds.push(scenario.organizationId);
      scenarios.push(scenario);
    }

    const rows = [];
    const endpointRows = [];
    const expectedQueryCount = endpointSpecs.reduce(
      (total, endpoint) => total + endpoint.expectedQueries,
      0,
    );

    for (const scenario of scenarios) {
      for (let index = 0; index < warmupIterations; index += 1) {
        await runDashboardBundle(app, scenario.actorSubject);
      }

      const samples: BundleSample[] = [];
      for (let index = 0; index < measuredIterations; index += 1) {
        samples.push(await runDashboardBundle(app, scenario.actorSubject));
      }

      const bundleDurations = samples.map((sample) => sample.totalMs);
      rows.push({
        scenario: scenario.name,
        iterations: measuredIterations,
        expectedQueries: expectedQueryCount,
        bundleP50Ms: round(percentile(bundleDurations, 50)),
        bundleP95Ms: round(percentile(bundleDurations, 95)),
        bundleMaxMs: round(Math.max(...bundleDurations)),
      });

      for (const endpoint of endpointSpecs) {
        const summary = summarizeEndpoint(samples, endpoint.name);
        endpointRows.push({
          scenario: scenario.name,
          endpoint: endpoint.name,
          expectedQueries: endpoint.expectedQueries,
          p50Ms: summary.p50,
          p95Ms: summary.p95,
          avgPayloadBytes: summary.avgPayloadBytes,
        });
      }
    }

    console.log("Dashboard API baseline");
    console.log(`Measured iterations per scenario: ${measuredIterations}`);
    console.log("Scenario bundle summary:");
    console.table(rows);
    console.log("Endpoint detail:");
    console.table(endpointRows);
    console.log("Benchmark orgs were cleaned up after measurement.");
  } finally {
    await cleanupScenarios(prisma, createdOrganizationIds);
    await app.close();
    await prisma.$disconnect();
  }
}

await main();
