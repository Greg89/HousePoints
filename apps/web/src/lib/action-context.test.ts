import { describe, expect, it, vi } from "vitest";
import { ApiResponseError, WebAuthenticationError } from "@/lib/api-client";
import { logError, logInfo, logWarn } from "@/lib/logging";
import { runServerAction } from "@/lib/action-context";

vi.mock("@/lib/logging", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  serializeErrorForLog: (error: unknown) => ({
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
    ...(
      error instanceof ApiResponseError
        ? { errorCode: error.code, statusCode: error.statusCode }
        : {}
    ),
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
      errorName: "Error",
      errorMessage: "failed",
    });
  });

  it("logs expected API and authentication failures as warnings", async () => {
    await expect(
      runServerAction("saveThing", async () => {
        throw new ApiResponseError(409, "ACTIVE_SEASON_REQUIRED", "Please start a season");
      }),
    ).rejects.toThrow("Please start a season");

    await expect(
      runServerAction("authThing", async () => {
        throw new WebAuthenticationError("SESSION_MISSING", "You must be logged in");
      }),
    ).rejects.toThrow("You must be logged in");

    expect(logWarn).toHaveBeenCalledWith(
      "web.action.failed",
      expect.objectContaining({
        action: "saveThing",
        errorCode: "ACTIVE_SEASON_REQUIRED",
        statusCode: 409,
      }),
    );
    expect(logWarn).toHaveBeenCalledWith(
      "web.action.failed",
      expect.objectContaining({
        action: "authThing",
        errorName: "WebAuthenticationError",
        errorMessage: "You must be logged in",
      }),
    );
  });
});
