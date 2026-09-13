import { describe, expect, it } from "vitest";

import {
  shouldStartAuthBootstrap,
  statusAfterBootstrapFailure,
  runSingleFlight,
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

describe("runSingleFlight", () => {
  it("shares an in-flight operation and permits a later refresh", async () => {
    const reference: { current: Promise<string> | null } = { current: null };
    let resolve: ((value: string) => void) | undefined;
    let calls = 0;
    const operation = () => {
      calls += 1;
      return new Promise<string>((next) => { resolve = next; });
    };

    const first = runSingleFlight(reference, operation);
    const second = runSingleFlight(reference, operation);
    expect(second).toBe(first);
    expect(calls).toBe(1);
    resolve?.("done");
    await first;
    await Promise.resolve();

    void runSingleFlight(reference, operation);
    expect(calls).toBe(2);
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
