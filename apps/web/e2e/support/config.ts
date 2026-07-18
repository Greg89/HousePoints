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

export function readE2EAdminCredentials() {
  return readOptionalCredentials("E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD");
}

export function readE2EOwnerCredentials() {
  return readOptionalCredentials("E2E_OWNER_EMAIL", "E2E_OWNER_PASSWORD");
}

export function readE2EReactionActorCredentials() {
  return readOptionalCredentials("E2E_REACTION_ACTOR_EMAIL", "E2E_REACTION_ACTOR_PASSWORD");
}

export function readE2EReactionRecipientCredentials() {
  return readOptionalCredentials("E2E_REACTION_RECIPIENT_EMAIL", "E2E_REACTION_RECIPIENT_PASSWORD");
}

export function readTargetMemberName() {
  return process.env.E2E_TARGET_MEMBER!;
}

export function readE2EStartPath() {
  const slug = process.env.E2E_ORG_SLUG?.trim();
  return slug ? `/o/${encodeURIComponent(slug)}` : "/";
}

function readOptionalCredentials(emailName: string, passwordName: string) {
  const email = process.env[emailName]?.trim();
  const password = process.env[passwordName]?.trim();

  if (!email || !password) {
    return null;
  }

  return { email, password };
}
