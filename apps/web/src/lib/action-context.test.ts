import { describe, expect, it, vi } from "vitest";
import { logError, logInfo } from "@/lib/logging";
import { runServerAction } from "@/lib/action-context";

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  serializeErrorForLog: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}));

describe("runServerAction", () => {
  it("logs the same request ID for invocation and completion", async () => {
    const result = await runServerAction("saveThing", async ({ requestId }) => requestId);

    expect(result).toEqual(expect.any(String));
    expect(logInfo).toHaveBeenCalledWith("web.action.invoked", {
      action: "saveThing",
      requestId: result,
    });
    expect(logInfo).toHaveBeenCalledWith("web.action.completed", {
      action: "saveThing",
      requestId: result,
    });
  });

  it("logs failures with the action request ID before rethrowing", async () => {
    let requestId = "";

    await expect(
      runServerAction("saveThing", async (context) => {
        requestId = context.requestId;
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");

    expect(logError).toHaveBeenCalledWith("web.action.failed", {
      action: "saveThing",
      requestId,
      errorMessage: "failed",
    });
  });
});
