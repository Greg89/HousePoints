import { createMobileEnvironment } from "./env-core";

/**
 * Runtime environment surface for the mobile app. Only `EXPO_PUBLIC_*` vars
 * are readable at runtime; anything else would be undefined on device.
 *
 * Values are computed once at module load so a misconfigured environment
 * fails loudly at startup rather than intermittently at request time.
 */
export const env = createMobileEnvironment({
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL,
  auth0Domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN,
  auth0ClientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID,
  auth0Audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE,
  easProjectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID,
  defaultOrgSlug: process.env.EXPO_PUBLIC_DEFAULT_ORG_SLUG,
  pointAdjustmentsEnabled: process.env.EXPO_PUBLIC_POINT_ADJUSTMENTS_ENABLED,
  mobileAdminEnabled: process.env.EXPO_PUBLIC_MOBILE_ADMIN_ENABLED,
});

export type { MobileEnv } from "./env-core";
