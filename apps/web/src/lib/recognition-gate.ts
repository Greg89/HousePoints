import "server-only";

// Keep the web rollout separate from the API mutation gate until C5.
export const recognitionCategoriesWebEnabled = process.env.RECOGNITION_CATEGORIES_WEB_ENABLED === "true";

const rolloutOrganizationIds = new Set((process.env.RECOGNITION_CATEGORY_ROLLOUT_ORGANIZATION_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean));

export function recognitionCategoriesWebEnabledForOrganization(organizationId: string | null | undefined): boolean {
  return recognitionCategoriesWebEnabled && Boolean(organizationId && rolloutOrganizationIds.has(organizationId));
}
