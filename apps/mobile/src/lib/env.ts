function readRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required env var ${key}. Copy apps/mobile/.env.example to apps/mobile/.env and fill it in, then restart Expo.`,
    );
  }
  return value;
}

function readOptional(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

/**
 * Runtime environment surface for the mobile app. Only `EXPO_PUBLIC_*` vars
 * are readable at runtime; anything else would be undefined on device.
 *
 * Values are computed once at module load so a misconfigured environment
 * fails loudly at startup rather than intermittently at request time.
 */
export const env = {
  apiBaseUrl: readRequired("EXPO_PUBLIC_API_BASE_URL").replace(/\/$/, ""),
  auth0Domain: readRequired("EXPO_PUBLIC_AUTH0_DOMAIN"),
  auth0ClientId: readRequired("EXPO_PUBLIC_AUTH0_CLIENT_ID"),
  auth0Audience: readRequired("EXPO_PUBLIC_AUTH0_AUDIENCE"),
  defaultOrgSlug: readOptional("EXPO_PUBLIC_DEFAULT_ORG_SLUG"),
  pointAdjustmentsEnabled:
    readOptional("EXPO_PUBLIC_POINT_ADJUSTMENTS_ENABLED") === "true",
};

export type MobileEnv = typeof env;
