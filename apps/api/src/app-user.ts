export function mapAppUser(user: {
  id: string;
  auth0Sub: string;
  email: string | null;
  displayName: string;
  role: "MEMBER" | "ADMIN" | "OWNER";
  houseId: string | null;
  organizationId: string | null;
  organization: { slug: string } | null;
  house: { name: string; color: string } | null;
}) {
  return {
    id: user.id,
    auth0Sub: user.auth0Sub,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    organizationId: user.organizationId,
    organizationSlug: user.organization?.slug ?? null,
    houseId: user.houseId,
    houseName: user.house?.name ?? null,
    houseColor: user.house?.color ?? null,
  };
}
