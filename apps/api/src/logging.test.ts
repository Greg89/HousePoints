import { describe, expect, it, vi } from "vitest";
import type { FastifyBaseLogger } from "fastify";
import { error, info, warn } from "./logging";

function createLoggerMock() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as FastifyBaseLogger;
}

describe("API logging helpers", () => {
  it("uses the event name as the information message", () => {
    const logger = createLoggerMock();

    info(logger, "request.completed", { statusCode: 200 });

    expect(logger.info).toHaveBeenCalledWith(
      { event: "request.completed", statusCode: 200 },
      "request.completed",
    );
  });

  it("uses the event name as the warning message", () => {
    const logger = createLoggerMock();

    warn(logger, "admin.forbidden", { role: "MEMBER" });

    expect(logger.warn).toHaveBeenCalledWith(
      { event: "admin.forbidden", role: "MEMBER" },
      "admin.forbidden",
    );
  });

  it("uses the event name as the error message and preserves the error", () => {
    const logger = createLoggerMock();
    const cause = new Error("database unavailable");

    error(logger, "request.unhandled_error", { statusCode: 500 }, cause);

    expect(logger.error).toHaveBeenCalledWith(
      {
        event: "request.unhandled_error",
        statusCode: 500,
        err: cause,
      },
      "request.unhandled_error",
    );
  });
});
