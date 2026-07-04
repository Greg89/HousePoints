import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { createReleaseAnnouncementSchema } from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import { readReleaseAutomationSecretFromEnv } from "../config.js";
import { info, warn } from "../logging.js";
import { parseBody } from "../route-helpers.js";

const RELEASE_ANNOUNCEMENT_SELECT = {
  id: true,
  version: true,
  title: true,
  summary: true,
  releaseNotesUrl: true,
  releasedAt: true,
  broadcastAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ReleaseAnnouncementRecord = Prisma.ReleaseAnnouncementGetPayload<{
  select: typeof RELEASE_ANNOUNCEMENT_SELECT;
}>;

function mapReleaseAnnouncement(release: ReleaseAnnouncementRecord) {
  return {
    id: release.id,
    version: release.version,
    title: release.title,
    summary: release.summary,
    releaseNotesUrl: release.releaseNotesUrl,
    releasedAt: release.releasedAt.toISOString(),
    broadcastAt: release.broadcastAt?.toISOString() ?? null,
    createdAt: release.createdAt.toISOString(),
    updatedAt: release.updatedAt.toISOString(),
  };
}

function readReleaseSecretHeader(request: FastifyRequest): string {
  const raw = request.headers["x-housepoints-release-secret"];
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

async function requireReleaseAutomationSecret(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  let expectedSecret: string;

  try {
    expectedSecret = readReleaseAutomationSecretFromEnv();
  } catch {
    warn(request.log, "releases.automation_secret_missing", {});
    await reply.status(503).send({
      code: "RELEASE_AUTOMATION_NOT_CONFIGURED",
      message: "Release automation is not configured.",
    });
    return false;
  }

  if (!secretsMatch(readReleaseSecretHeader(request), expectedSecret)) {
    warn(request.log, "releases.automation_secret_invalid", {});
    await reply.status(401).send({
      code: "INVALID_RELEASE_AUTOMATION_SECRET",
      message: "A valid release automation secret is required.",
    });
    return false;
  }

  return true;
}

export async function registerReleaseRoutes(app: FastifyInstance): Promise<void> {
  app.post("/system/releases/record", async (request, reply) => {
    if (!(await requireReleaseAutomationSecret(request, reply))) {
      return;
    }

    const parsed = await parseBody(createReleaseAnnouncementSchema, request, reply);
    if (!parsed) return;

    const releasedAt = new Date(parsed.releasedAt);
    const release = await prisma.releaseAnnouncement.upsert({
      where: { version: parsed.version },
      create: {
        version: parsed.version,
        title: parsed.title,
        summary: parsed.summary,
        releaseNotesUrl: parsed.releaseNotesUrl,
        releasedAt,
      },
      update: {
        title: parsed.title,
        summary: parsed.summary,
        releaseNotesUrl: parsed.releaseNotesUrl,
        releasedAt,
      },
      select: RELEASE_ANNOUNCEMENT_SELECT,
    });

    info(request.log, "releases.recorded", {
      releaseId: release.id,
      version: release.version,
      releasedAt: release.releasedAt.toISOString(),
      alreadyBroadcast: Boolean(release.broadcastAt),
    });

    return mapReleaseAnnouncement(release);
  });
}
