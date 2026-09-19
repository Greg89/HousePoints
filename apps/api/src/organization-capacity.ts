import type { OrganizationCreationPolicy } from "./config.js";

const ORGANIZATION_CAPACITY_LOCK_ID = 1_843_729_551;

type OrganizationCapacityClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  organization: {
    count(args: { where: { archivedAt: null } }): Promise<number>;
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
  client: Pick<OrganizationCapacityClient, "organization">,
  policy: OrganizationCreationPolicy,
): Promise<OrganizationCreationAvailability> {
  if (!policy.enabled) return { canCreate: false, reason: "DISABLED" };
  if (policy.maxActiveOrganizations === null) return { canCreate: true, reason: "AVAILABLE" };

  const activeOrganizationCount = await client.organization.count({ where: { archivedAt: null } });
  return activeOrganizationCount >= policy.maxActiveOrganizations
    ? { canCreate: false, reason: "CAPACITY_REACHED" }
    : { canCreate: true, reason: "AVAILABLE" };
}

export async function assertOrganizationCapacity(
  client: OrganizationCapacityClient,
  policy: OrganizationCreationPolicy,
): Promise<void> {
  if (!policy.enabled) {
    throw new OrganizationCapacityError(
      "ORGANIZATION_CREATION_DISABLED",
      "HousePoints is not accepting new organizations right now.",
    );
  }

  if (policy.maxActiveOrganizations === null) return;

  await client.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock($1)",
    ORGANIZATION_CAPACITY_LOCK_ID,
  );
  const availability = await readOrganizationCreationAvailability(client, policy);
  if (!availability.canCreate) {
    throw new OrganizationCapacityError(
      "ORGANIZATION_CAPACITY_REACHED",
      "HousePoints has reached its current organization capacity. You can still join an existing organization with an invitation.",
    );
  }
}
