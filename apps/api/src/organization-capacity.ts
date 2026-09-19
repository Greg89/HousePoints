import type { OrganizationCreationPolicy } from "./config.js";

const ORGANIZATION_CAPACITY_LOCK_ID = 1_843_729_551;

type OrganizationCapacityClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  organization: {
    count(args: { where: { archivedAt: null } }): Promise<number>;
  };
  platformSettings: {
    findUnique(args: { where: { id: string } }): Promise<{
      organizationCreationEnabled: boolean;
      maxActiveOrganizations: number | null;
    } | null>;
  };
};

export type OrganizationCreationAvailability = {
  canCreate: boolean;
  reason: "AVAILABLE" | "DISABLED" | "CAPACITY_REACHED";
};

export class OrganizationCapacityError extends Error {
  constructor(
    readonly code: "ORGANIZATION_CREATION_DISABLED" | "ORGANIZATION_CAPACITY_REACHED",
    message: string,
  ) {
    super(message);
    this.name = "OrganizationCapacityError";
  }
}

export async function readOrganizationCreationAvailability(
  client: Pick<OrganizationCapacityClient, "organization" | "platformSettings">,
  hardPolicy: OrganizationCreationPolicy,
): Promise<OrganizationCreationAvailability> {
  const policy = await readEffectiveOrganizationCreationPolicy(client, hardPolicy);
  if (!policy.enabled) return { canCreate: false, reason: "DISABLED" };
  if (policy.maxActiveOrganizations === null) return { canCreate: true, reason: "AVAILABLE" };

  const activeOrganizationCount = await client.organization.count({ where: { archivedAt: null } });
  return activeOrganizationCount >= policy.maxActiveOrganizations
    ? { canCreate: false, reason: "CAPACITY_REACHED" }
    : { canCreate: true, reason: "AVAILABLE" };
}

export async function readEffectiveOrganizationCreationPolicy(
  client: Pick<OrganizationCapacityClient, "platformSettings">,
  hardPolicy: OrganizationCreationPolicy,
): Promise<OrganizationCreationPolicy> {
  const settings = await client.platformSettings.findUnique({ where: { id: "global" } });
  if (!settings) return hardPolicy;

  const operatingMax = settings.maxActiveOrganizations;
  const hardMax = hardPolicy.maxActiveOrganizations;
  const maxActiveOrganizations = operatingMax === null
    ? hardMax
    : hardMax === null
      ? operatingMax
      : Math.min(operatingMax, hardMax);

  return {
    enabled: hardPolicy.enabled && settings.organizationCreationEnabled,
    maxActiveOrganizations,
  };
}

export async function assertOrganizationCapacity(
  client: OrganizationCapacityClient,
  hardPolicy: OrganizationCreationPolicy,
): Promise<void> {
  const initialPolicy = await readEffectiveOrganizationCreationPolicy(client, hardPolicy);
  if (!initialPolicy.enabled) {
    throw new OrganizationCapacityError(
      "ORGANIZATION_CREATION_DISABLED",
      "HousePoints is not accepting new organizations right now.",
    );
  }

  if (initialPolicy.maxActiveOrganizations === null) return;

  await client.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock($1)",
    ORGANIZATION_CAPACITY_LOCK_ID,
  );
  const availability = await readOrganizationCreationAvailability(client, hardPolicy);
  if (!availability.canCreate) {
    throw new OrganizationCapacityError(
      "ORGANIZATION_CAPACITY_REACHED",
      "HousePoints has reached its current organization capacity. You can still join an existing organization with an invitation.",
    );
  }
}
