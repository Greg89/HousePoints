export const requiredStagingEnv = [
  "E2E_BASE_URL",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
  "E2E_TARGET_MEMBER",
] as const;

export const requiredDashboardSmokeEnv = [
  "E2E_BASE_URL",
  "E2E_USER_EMAIL",
  "E2E_USER_PASSWORD",
] as const;

export function missingRequiredEnv(names: readonly string[]) {
  return names.filter((name) => !process.env[name]);
}

export function readE2EUserCredentials() {
  return {
    email: process.env.E2E_USER_EMAIL!,
    password: process.env.E2E_USER_PASSWORD!,
  };
}

export function readTargetMemberName() {
  return process.env.E2E_TARGET_MEMBER!;
}

export function readE2EStartPath() {
  const slug = process.env.E2E_ORG_SLUG?.trim();
  return slug ? `/o/${encodeURIComponent(slug)}` : "/";
}
