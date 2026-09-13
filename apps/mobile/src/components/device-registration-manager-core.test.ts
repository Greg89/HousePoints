import { describe, expect, it } from "vitest";

import { updateRegistrationAttempt } from "./device-registration-manager-core";

describe("updateRegistrationAttempt", () => {
  it("attempts registration once for an active user and organization", () => {
    expect(updateRegistrationAttempt(null, "user-1:org-1")).toEqual({
      attemptedKey: "user-1:org-1",
      shouldRegister: true,
    });
    expect(updateRegistrationAttempt("user-1:org-1", "user-1:org-1")).toEqual({
      attemptedKey: "user-1:org-1",
      shouldRegister: false,
    });
  });

  it("clears the attempted key when the session becomes inactive", () => {
    expect(updateRegistrationAttempt("user-1:org-1", null)).toEqual({
      attemptedKey: null,
      shouldRegister: false,
    });
  });

  it("registers again after sign-out and sign-in to the same organization", () => {
    const signedOut = updateRegistrationAttempt("user-1:org-1", null);

    expect(updateRegistrationAttempt(signedOut.attemptedKey, "user-1:org-1")).toEqual({
      attemptedKey: "user-1:org-1",
      shouldRegister: true,
    });
  });
});
