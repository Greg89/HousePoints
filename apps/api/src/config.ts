export function parseCorsAllowedOrigins(value: string | undefined): string[] {
  if (!value?.trim()) {
    throw new Error("CORS_ALLOWED_ORIGINS must be configured");
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      let url: URL;

      try {
        url = new URL(origin);
      } catch {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }

      if (
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }

      return url.origin;
    });

  if (origins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must contain at least one origin");
  }

  return [...new Set(origins)];
}

export function readCorsAllowedOriginsFromEnv(): string[] {
  return parseCorsAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
}

export function parseBooleanFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export type OrganizationCreationPolicy = {
  enabled: boolean;
  maxActiveOrganizations: number | null;
};

export function parseMaxActiveOrganizations(value: string | undefined): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || String(parsed) !== trimmed) {
    throw new Error("MAX_ACTIVE_ORGANIZATIONS must be a positive integer");
  }

  return parsed;
}

export function readOrganizationCreationPolicyFromEnv(): OrganizationCreationPolicy {
  return {
    enabled: process.env.PUBLIC_ORGANIZATION_CREATION_ENABLED?.trim().toLowerCase() !== "false",
    maxActiveOrganizations: parseMaxActiveOrganizations(process.env.MAX_ACTIVE_ORGANIZATIONS),
  };
}

export function readPointAdjustmentsEnabledFromEnv(): boolean {
  return parseBooleanFlag(process.env.POINT_ADJUSTMENTS_ENABLED);
}

export function readPushDispatchEnabledFromEnv(): boolean {
  return parseBooleanFlag(process.env.PUSH_DISPATCH_ENABLED);
}

export function readExpoAccessTokenFromEnv(): string | undefined {
  return process.env.EXPO_ACCESS_TOKEN?.trim() || undefined;
}

export function parseReleaseAutomationSecret(value: string | undefined): string {
  const secret = value?.trim();

  if (!secret) {
    throw new Error("RELEASE_AUTOMATION_SECRET must be configured");
  }

  if (secret.length < 16) {
    throw new Error("RELEASE_AUTOMATION_SECRET must be at least 16 characters");
  }

  return secret;
}

export function readReleaseAutomationSecretFromEnv(): string {
  return parseReleaseAutomationSecret(process.env.RELEASE_AUTOMATION_SECRET);
}
