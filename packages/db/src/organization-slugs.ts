import type { PrismaClient } from "@prisma/client";

type SlugClient = Pick<PrismaClient, "organization" | "organizationSlugAlias">;

export type ResolvedOrganizationSlug = {
  organizationId: string;
  matchedSlug: string;
  currentSlug: string;
  isPrimary: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
};

export async function isOrganizationSlugReserved(
  client: SlugClient,
  slug: string,
): Promise<boolean> {
  const alias = await client.organizationSlugAlias.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (alias) {
    return true;
  }

  // Defensive fallback while environments roll through the alias backfill.
  const organization = await client.organization.findUnique({
    where: { slug },
    select: { id: true },
  });

  return organization !== null;
}

export async function createPrimaryOrganizationSlugAlias(
  client: SlugClient,
  input: { organizationId: string; slug: string },
): Promise<void> {
  await client.organizationSlugAlias.create({
    data: {
      organizationId: input.organizationId,
      slug: input.slug,
      isPrimary: true,
    },
  });
}

export async function resolveOrganizationSlug(
  client: SlugClient,
  slug: string,
): Promise<ResolvedOrganizationSlug | null> {
  const alias = await client.organizationSlugAlias.findUnique({
    where: { slug },
    select: {
      organizationId: true,
      slug: true,
      isPrimary: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!alias) {
    return null;
  }

  return {
    organizationId: alias.organizationId,
    matchedSlug: alias.slug,
    currentSlug: alias.organization.slug,
    isPrimary: alias.isPrimary,
    organization: alias.organization,
  };
}
