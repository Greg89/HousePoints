import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiResponseError, apiFetch } from "@/lib/api-client";
import { logServerActionFailed } from "@/lib/action-context";
import { getCurrentUserForRequest } from "@/lib/current-user";
import { readRecognitionCategories, readRecognitionCategoriesForReports } from "./recognition";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/recognition-gate", () => ({ recognitionCategoriesWebEnabled: true }));
vi.mock("@/lib/current-user", () => ({ getCurrentUserForRequest: vi.fn() }));
vi.mock("@/lib/action-context", () => ({
  logServerActionFailed: vi.fn(),
  runServerAction: vi.fn(),
}));
vi.mock("@/lib/api-client", async (importActual) => ({
  ...await importActual<typeof import("@/lib/api-client")>(),
  apiFetch: vi.fn(),
}));

const category = {
  id: "category-1", name: "Community Impact", description: null, legacyTrait: null,
  createdAt: "2026-09-20T12:00:00.000Z", archivedAt: null,
};

beforeEach(() => { vi.resetAllMocks(); });

describe("recognition category reads", () => {
  it.each([
    ["award picker", readRecognitionCategories],
    ["reports", readRecognitionCategoriesForReports],
  ] as const)("loads %s categories with one authenticated API request and no bootstrap", async (_, read) => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({
      apiVersion: "categories-v1", categories: [category],
    }));
    await expect(read("request-1")).resolves.toEqual([category]);
    expect(getCurrentUserForRequest).not.toHaveBeenCalled();
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/recognition-categories/list", "request-1", {
      method: "POST", body: JSON.stringify({ includeArchived: true }),
    });
  });

  it("logs and propagates rate limits without retrying or returning an empty list", async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({
      code: "RATE_LIMITED", message: "Too many requests",
    }, { status: 429 }));
    await expect(readRecognitionCategories("request-1")).rejects.toMatchObject({
      statusCode: 429, code: "RATE_LIMITED",
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(logServerActionFailed).toHaveBeenCalledWith(
      { action: "readRecognitionCategories", requestId: "request-1" },
      expect.any(ApiResponseError),
    );
  });
});
