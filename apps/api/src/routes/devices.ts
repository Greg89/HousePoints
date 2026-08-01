import type { FastifyInstance } from "fastify";
import {
  registerDeviceRequestSchema,
  unregisterDeviceRequestSchema,
} from "@housepoints/contracts";
import { prisma } from "@housepoints/db";
import type { ActorRecord } from "../actor.js";
import { info } from "../logging.js";
import { parseBody, requireActor } from "../route-helpers.js";

export async function registerDevice(
  actor: ActorRecord,
  input: {
    platform: "IOS" | "ANDROID";
    pushToken: string;
    appVersion?: string;
    locale?: string;
  },
) {
  const now = new Date();
  const record = await prisma.deviceRegistration.upsert({
    where: {
      userId_pushToken: {
        userId: actor.id,
        pushToken: input.pushToken,
      },
    },
    create: {
      userId: actor.id,
      organizationId: actor.organizationId,
      platform: input.platform,
      pushToken: input.pushToken,
      appVersion: input.appVersion ?? null,
      locale: input.locale ?? null,
      lastSeenAt: now,
    },
    update: {
      organizationId: actor.organizationId,
      platform: input.platform,
      appVersion: input.appVersion ?? null,
      locale: input.locale ?? null,
      lastSeenAt: now,
      revokedAt: null,
    },
    select: { id: true },
  });
  return { id: record.id };
}

export async function unregisterDevice(actor: ActorRecord, pushToken: string) {
  const result = await prisma.deviceRegistration.updateMany({
    where: {
      userId: actor.id,
      pushToken,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  return { revoked: result.count > 0 };
}

export async function registerDeviceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/devices/register", async (request, reply) => {
    const parsed = await parseBody(registerDeviceRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { id } = await registerDevice(actor, parsed);

    info(request.log, "devices.registered", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      deviceRegistrationId: id,
      platform: parsed.platform,
      appVersion: parsed.appVersion ?? null,
      locale: parsed.locale ?? null,
    });

    return { id };
  });

  app.post("/devices/unregister", async (request, reply) => {
    const parsed = await parseBody(unregisterDeviceRequestSchema, request, reply);
    if (!parsed) return;

    const actor = await requireActor(request, reply);
    if (!actor) return;

    const { revoked } = await unregisterDevice(actor, parsed.pushToken);

    info(request.log, "devices.unregistered", {
      actorUserId: actor.id,
      organizationId: actor.organizationId,
      revoked,
    });

    return { revoked };
  });
}
