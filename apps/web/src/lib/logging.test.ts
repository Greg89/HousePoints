import { describe, expect, it } from "vitest";
import { serializeErrorForLog } from "@/lib/logging";

describe("serializeErrorForLog", () => {
  it("preserves safe operational metadata from errors", () => {
    const error = Object.assign(
      new Error("Dashboard summary could not be loaded. Please try again.", {
        cause: new TypeError("fetch failed"),
      }),
      {
        code: "API_REQUEST_FAILED",
        digest: "digest-123",
        statusCode: 503,
      },
    );

    expect(serializeErrorForLog(error)).toEqual({
      errorName: "Error",
      errorMessage: "Dashboard summary could not be loaded. Please try again.",
      errorCode: "API_REQUEST_FAILED",
      statusCode: 503,
      digest: "digest-123",
      causeName: "TypeError",
      causeMessage: "fetch failed",
    });
  });

  it("serializes non-error throws without crashing the logger", () => {
    expect(serializeErrorForLog("failed")).toEqual({
      errorType: "string",
      errorMessage: "failed",
    });
  });
});
