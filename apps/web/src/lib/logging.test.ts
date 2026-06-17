import { describe, expect, it } from "vitest";
import { redactLogContext, serializeErrorForLog } from "@/lib/logging";

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

describe("redactLogContext", () => {
  it("redacts sensitive fields before logs are written", () => {
    expect(
      redactLogContext({
        requestId: "request-1",
        accessToken: "access-token",
        headers: {
          authorization: "Bearer secret",
          cookie: "appSession=value",
          "x-request-id": "request-1",
        },
        nested: [
          {
            inviteToken: "invite-token",
            safe: "present",
          },
        ],
      }),
    ).toEqual({
      requestId: "request-1",
      accessToken: "[REDACTED]",
      headers: {
        authorization: "[REDACTED]",
        cookie: "[REDACTED]",
        "x-request-id": "request-1",
      },
      nested: [
        {
          inviteToken: "[REDACTED]",
          safe: "present",
        },
      ],
    });
  });
});
