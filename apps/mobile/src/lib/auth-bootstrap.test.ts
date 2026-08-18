import { describe, expect, it } from "vitest";

import {
  shouldStartAuthBootstrap,
  statusAfterBootstrapFailure,
} from "./auth-bootstrap";

describe("shouldStartAuthBootstrap", () => {
  it("starts when Auth0 has a user that has not been bootstrapped", () => {
    expect(
      shouldStartAuthBootstrap({
        hasAuth0User: true,
        hasAppUser: false,
        status: "signedOut",
      }),
    ).toBe(true);
  });

  it("does not automatically retry an error", () => {
    expect(
      shouldStartAuthBootstrap({
        hasAuth0User: true,
        hasAppUser: false,
        status: "error",
      }),
    ).toBe(false);
  });

  it("does not start without an Auth0 user or after bootstrap succeeds", () => {
    expect(
      shouldStartAuthBootstrap({
        hasAuth0User: false,
        hasAppUser: false,
        status: "signedOut",
      }),
    ).toBe(false);
    expect(
      shouldStartAuthBootstrap({
        hasAuth0User: true,
        hasAppUser: true,
        status: "ready",
      }),
    ).toBe(false);
  });
});

describe("statusAfterBootstrapFailure", () => {
  it("preserves an established session when a refresh fails", () => {
    expect(statusAfterBootstrapFailure(true)).toBe("ready");
  });

  it("reports an error when the initial bootstrap fails", () => {
    expect(statusAfterBootstrapFailure(false)).toBe("error");
  });
});
