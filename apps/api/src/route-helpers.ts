import type { FastifyReply, FastifyRequest } from "fastify";
import type { ZodType, z } from "zod";
import { getActorBySub, isAdminRole, isOwnerRole, type ActorRecord } from "./actor.js";
import { warn } from "./logging.js";
import { resolveSeasonScope, SeasonScopeError } from "./season-scope.js";

export type ResolvedSeason = Awaited<ReturnType<typeof resolveSeasonScope>>;

/**
 * Parses the request body against the given Zod schema.
 * On failure, sends a 400 response and returns null.
 * The caller must `return` immediately when null is returned.
 */
export async function parseBody<T extends ZodType>(
  schema: T,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<z.infer<T> | null> {
  const parsed = schema.safeParse(request.body);

  if (!parsed.success) {
    warn(request.log, "request.validation_failed", {
      issues: parsed.error.issues,
    });
    await reply.status(400).send({
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      errors: parsed.error.flatten(),
    });
    return null;
  }

  return parsed.data;
}

/**
 * Resolves the authenticated actor from the request subject.
 * On failure, sends a 403 response and returns null.
 * The caller must `return` immediately when null is returned.
 */
export async function requireActor(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ActorRecord | null> {
  const actor = await getActorBySub(request.auth.subject);

  if (!actor) {
    warn(request.log, "auth.actor_not_found", {});
    await reply.status(403).send({
      code: "ACTOR_NOT_MAPPED",
      message: "Signed-in user is not mapped to an internal account",
    });
    return null;
  }

  return actor;
}

/**
 * Resolves the actor and asserts admin (ADMIN or OWNER) role.
 * On failure, sends the appropriate 403 response and returns null.
 * The caller must `return` immediately when null is returned.
 */
export async function requireAdminActor(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ActorRecord | null> {
  const actor = await requireActor(request, reply);

  if (!actor) {
    return null;
  }

  if (!isAdminRole(actor.role)) {
    warn(request.log, "admin.forbidden", {});
    await reply.status(403).send({
      code: "ADMIN_REQUIRED",
      message: "Admin access required",
    });
    return null;
  }

  return actor;
}

/**
 * Resolves the actor and asserts OWNER role.
 * On failure, sends the appropriate 403 response and returns null.
 * The caller must `return` immediately when null is returned.
 */
export async function requireOwnerActor(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ActorRecord | null> {
  const actor = await requireActor(request, reply);

  if (!actor) {
    return null;
  }

  if (!isOwnerRole(actor.role)) {
    warn(request.log, "owner.forbidden", {});
    await reply.status(403).send({
      code: "OWNER_REQUIRED",
      message: "Owner access required",
    });
    return null;
  }

  return actor;
}

/**
 * Resolves the season scope for the given actor and optional season ID.
 * On failure, sends the appropriate error response and returns null.
 * The caller must `return` immediately when null is returned.
 */
export async function resolveSeasonOrReject(
  actor: ActorRecord,
  seasonId: string | undefined,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ResolvedSeason | null> {
  try {
    return await resolveSeasonScope(actor, seasonId);
  } catch (err) {
    if (err instanceof SeasonScopeError) {
      warn(
        request.log,
        err.code === "SEASON_NOT_FOUND" ? "seasons.not_found" : "seasons.active_missing",
        {
          actorUserId: actor.id,
          organizationId: actor.organizationId,
          seasonId,
        },
      );
      await reply.status(err.statusCode).send({
        message: err.message,
        code: err.code,
      });
      return null;
    }

    throw err;
  }
}
