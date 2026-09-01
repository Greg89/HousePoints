export type MobileEnvironmentInput = {
  apiBaseUrl: string | undefined;
  webBaseUrl: string | undefined;
  auth0Domain: string | undefined;
  auth0ClientId: string | undefined;
  auth0Audience: string | undefined;
  easProjectId: string | undefined;
  defaultOrgSlug: string | undefined;
  pointAdjustmentsEnabled: string | undefined;
  mobileAdminEnabled: string | undefined;
};

function readRequired(key: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${key}. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in, then restart Expo.`,
    );
  }
  return value;
}

function readOptional(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

export function createMobileEnvironment(input: MobileEnvironmentInput) {
  return {
    apiBaseUrl: readRequired(
      "EXPO_PUBLIC_API_BASE_URL",
      input.apiBaseUrl,
    ).replace(/\/$/, ""),
    webBaseUrl: readRequired(
      "EXPO_PUBLIC_WEB_BASE_URL",
      input.webBaseUrl,
    ).replace(/\/$/, ""),
    auth0Domain: readRequired("EXPO_PUBLIC_AUTH0_DOMAIN", input.auth0Domain),
    auth0ClientId: readRequired(
      "EXPO_PUBLIC_AUTH0_CLIENT_ID",
      input.auth0ClientId,
    ),
    auth0Audience: readRequired(
      "EXPO_PUBLIC_AUTH0_AUDIENCE",
      input.auth0Audience,
    ),
    easProjectId: readRequired(
      "EXPO_PUBLIC_EAS_PROJECT_ID",
      input.easProjectId,
    ),
    defaultOrgSlug: readOptional(input.defaultOrgSlug),
    pointAdjustmentsEnabled:
      readOptional(input.pointAdjustmentsEnabled) === "true",
    mobileAdminEnabled: readOptional(input.mobileAdminEnabled) === "true",
  };
}

export type MobileEnv = ReturnType<typeof createMobileEnvironment>;
