import { afterEach, describe, expect, it, vi } from "vitest";
import { createPointSubmissionKeys } from "@housepoints/contracts";
import { callApi } from "./api-client";
import { generateRequestId } from "./request-id";

vi.mock("./env", () => ({ env: { apiBaseUrl: "https://api.example.test" } }));
vi.mock("./logger", () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }, serializeError: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

describe("mobile point submission transport", () => {
  it("retries a category award with the same category identity and submission key", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("Response lost"))
      .mockImplementation(async () => Response.json({ id: "transaction-1" }));
    vi.stubGlobal("fetch", fetcher);
    const keys = createPointSubmissionKeys(generateRequestId);
    const payload = { targetUserId: "member-1", reason: "Great work", delta: 10, categoryId: "category-new", categoryApiVersion: "categories-v1" as const };
    const submit = async () => {
      const idempotencyKey = keys.keyFor(["org", payload]);
      const result = await callApi("/points/adjust", { ...payload, idempotencyKey }, { organizationSlug: "org" });
      keys.complete(idempotencyKey);
      return result;
    };
    await expect(submit()).rejects.toThrow("Response lost");
    await expect(submit()).resolves.toEqual({ id: "transaction-1" });
    const first = JSON.parse(fetcher.mock.calls[0][1].body);
    const second = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(second).toEqual(first);
    expect(second).toMatchObject({ categoryId: "category-new", categoryApiVersion: "categories-v1" });
    expect(second).not.toHaveProperty("trait");
  });
  it.each(["/points/adjust", "/points/deduct"] as const)("preserves the retry key through %s validation and transport", async endpoint => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("Response lost"))
      .mockImplementation(async () => Response.json({ id: "transaction-1" }));
    vi.stubGlobal("fetch", fetcher);
    const keys = createPointSubmissionKeys(generateRequestId);
    const payload = endpoint === "/points/adjust"
      ? { targetUserId: "member-1", reason: "Great work", delta: 10, trait: "TEAM_SUPPORT" as const }
      : { targetUserId: "member-1", reason: "Missed cleanup" };
    const submit = async () => {
      const idempotencyKey = keys.keyFor(["org", payload]);
      const result = await callApi(endpoint, { ...payload, idempotencyKey }, { organizationSlug: "org" });
      keys.complete(idempotencyKey);
      return result;
    };
    await expect(submit()).rejects.toThrow();
    await expect(submit()).resolves.toEqual({ id: "transaction-1" });
    await submit();
    const bodies = fetcher.mock.calls.map(call => JSON.parse(call[1].body));
    expect(bodies[1].idempotencyKey).toBe(bodies[0].idempotencyKey);
    expect(bodies[2].idempotencyKey).not.toBe(bodies[0].idempotencyKey);
  });
});
