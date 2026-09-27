import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { ScoringWriteError, scoringWriteTime } from "./scoring-write.js";

type Submission = {
  organizationId: string;
  actorId: string;
  targetUserId: string;
  targetHouseId: string;
  actorHouseId?: string;
  idempotencyKey?: string;
  reason: string;
  delta?: number;
  trait?: string;
};

// Called only while holding F1's organization lock. Never cache authorization.
async function authorize(tx: Prisma.TransactionClient, input: Submission, operation: string) {
  const memberships = await tx.organizationMembership.findMany({
    where: {
      organizationId: input.organizationId,
      userId: { in: [input.actorId, input.targetUserId] },
      isActive: true, archivedAt: null, suspendedAt: null,
      organization: { archivedAt: null, suspendedAt: null },
      user: { deletionRequestedAt: null, deletionCompletedAt: null },
    },
    select: { userId: true, role: true, houseId: true },
  });
  const actor = memberships.find(row => row.userId === input.actorId);
  const target = memberships.find(row => row.userId === input.targetUserId);
  if (!actor?.houseId || !target?.houseId || actor.userId === target.userId ||
      (operation === "DEDUCTION" && (actor.role === "MEMBER" || actor.houseId === target.houseId))) {
    throw new ScoringWriteError(403, "POINT_MUTATION_NOT_AUTHORIZED", "You no longer have permission to make this point change.");
  }
  if (target.houseId !== input.targetHouseId || (input.actorHouseId && actor.houseId !== input.actorHouseId)) {
    throw new ScoringWriteError(409, "POINT_MEMBERSHIP_CHANGED", "House assignments changed. Refresh and try again.");
  }
}

export async function idempotentPointMutation<T extends { id: string }>(
  tx: Prisma.TransactionClient,
  input: Submission,
  operation: "AWARD" | "DEDUCTION",
  write: () => Promise<T>,
): Promise<{ transaction: T | { id: string }; replayed: boolean }> {
  // Preserve the legacy request/response path until old clients are retired.
  if (!input.idempotencyKey) return { transaction: await write(), replayed: false };
  await authorize(tx, input, operation);
  const fingerprint = createHash("sha256").update(JSON.stringify([
    input.targetUserId, operation === "AWARD" ? input.delta : -10,
    input.reason, operation === "AWARD" ? input.trait : null,
  ])).digest("hex");
  const scope = { organizationId: input.organizationId, actorUserId: input.actorId, operation, key: input.idempotencyKey };
  const prior = await tx.pointMutationRequest.findUnique({
    where: { organizationId_actorUserId_operation_key: scope },
  });
  const now = await scoringWriteTime(tx);
  if (prior) {
    if (prior.fingerprint !== fingerprint) {
      throw new ScoringWriteError(409, "IDEMPOTENCY_KEY_CONFLICT", "This submission key was already used for a different point change.");
    }
    if (prior.expiresAt <= now) {
      throw new ScoringWriteError(409, "IDEMPOTENCY_KEY_EXPIRED", "This submission has expired. Check Activity before starting a new point change.");
    }
    return { transaction: { id: prior.resultId }, replayed: true };
  }
  const transaction = await write();
  await tx.pointMutationRequest.create({ data: {
    ...scope, fingerprint, resultId: transaction.id, createdAt: now,
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  } });
  return { transaction: { id: transaction.id }, replayed: false };
}
