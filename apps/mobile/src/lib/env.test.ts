import { describe, expect, it } from "vitest";

import { createMobileEnvironment } from "./env-core";

const requiredEnvironment = {
  apiBaseUrl: "https://api.example.com/",
  webBaseUrl: "https://app.example.com/",
  auth0Domain: "tenant.example.auth0.com",
  auth0ClientId: "native-client-id",
  auth0Audience: "https://api.example.com",
  easProjectId: "eas-project-id",
  defaultOrgSlug: undefined,
  pointAdjustmentsEnabled: undefined,
  mobileAdminEnabled: undefined,
  recognitionCategoriesEnabled: undefined,
};

describe("mobile environment", () => {
  it.each([undefined, "", "false", "1", "TRUE", "true"])("enables category awards only for flag value %j", (value) => {
    expect(createMobileEnvironment({
      ...requiredEnvironment,
      recognitionCategoriesEnabled: value,
    }).recognitionCategoriesEnabled).toBe(value === "true");
  });
  it("loads Expo public variables and normalizes base URLs", () => {
    expect(
      createMobileEnvironment({
        ...requiredEnvironment,
        defaultOrgSlug: "family",
        pointAdjustmentsEnabled: "true",
        mobileAdminEnabled: "false",
        recognitionCategoriesEnabled: "true",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.example.com",
      webBaseUrl: "https://app.example.com",
      auth0Domain: "tenant.example.auth0.com",
      auth0ClientId: "native-client-id",
      auth0Audience: "https://api.example.com",
      easProjectId: "eas-project-id",
      defaultOrgSlug: "family",
      pointAdjustmentsEnabled: true,
      mobileAdminEnabled: false,
      recognitionCategoriesEnabled: true,
    });
  });

  it("fails with the missing variable name", () => {
    expect(() =>
      createMobileEnvironment({
        ...requiredEnvironment,
        apiBaseUrl: "",
      }),
    ).toThrow("Missing required env var EXPO_PUBLIC_API_BASE_URL");
  });
});
