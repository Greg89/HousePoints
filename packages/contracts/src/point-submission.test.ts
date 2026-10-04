import { describe, expect, it, vi } from "vitest";
import { createPointSubmissionKeys } from "./point-submission.js";
import { adjustPointsSchema, deductPointsSchema } from "./point-schemas.js";

describe("point submission retries", () => {
  it("retains uncertain payloads, separates changed submissions, and rotates after success", () => {
    const generate = vi.fn().mockReturnValueOnce("first").mockReturnValueOnce("second").mockReturnValueOnce("third");
    const keys = createPointSubmissionKeys(generate);
    const payload = { targetUserId: "member", delta: 10 };
    expect(keys.keyFor(payload)).toBe("first");
    expect(keys.keyFor({ ...payload })).toBe("first");
    expect(keys.keyFor({ ...payload, delta: 20 })).toBe("second");
    expect(keys.keyFor(payload)).toBe("first");
    keys.complete("first");
    expect(keys.keyFor(payload)).toBe("third");
    expect(keys.keyFor({ ...payload, delta: 20 })).toBe("second");
  });
  it("accepts legacy and keyed requests but rejects malformed keys", () => {
    const body = { targetUserId: "member", reason: "Great work", delta: 10, trait: "COLLABORATION" };
    expect(adjustPointsSchema.safeParse(body).success).toBe(true);
    expect(adjustPointsSchema.safeParse({ ...body, idempotencyKey: "29b2f600-1d44-401b-b18a-bf02c6d58d98" }).success).toBe(true);
    expect(adjustPointsSchema.safeParse({ ...body, idempotencyKey: "bad" }).success).toBe(false);
    expect(deductPointsSchema.safeParse({ targetUserId: "member", reason: "Reason", idempotencyKey: "bad" }).success).toBe(false);
  });
});
