import { z } from "zod";

// ---------------------------------------------------------------------------
// Slug validation — shared rule used by org create/join flows and admin slug
// ---------------------------------------------------------------------------
export const slugSchema = z
  .string()
  .min(2, "Slug must be at least 2 characters")
  .max(60, "Slug must be at most 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen"
  );

export const createOrgSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().trim().min(1).max(120),
  orgName: z.string().trim().min(2).max(80),
  orgSlug: slugSchema,
  firstHouseName: z.string().trim().min(2).max(80),
  firstHouseColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#7c3aed"),
}).strict();

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const createInviteSchema = z.object({
  /** How many hours the invite is valid for. Defaults to 72. Max 168 (7 days). */
  expiresInHours: z.number().int().min(1).max(168).default(72),
}).strict();

export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const joinOrgSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().trim().min(1).max(120),
  /** The raw invite token from the URL */
  inviteToken: z.string().min(1),
  /** Optional URL slug context from /o/{slug}/join/{token} links */
  organizationSlug: slugSchema.optional(),
}).strict();

export type JoinOrgInput = z.infer<typeof joinOrgSchema>;

export const joinInvitePreviewSchema = z.object({
  /** The raw invite token from the URL */
  inviteToken: z.string().min(1),
  organizationSlug: slugSchema,
}).strict();

export type JoinInvitePreviewInput = z.infer<typeof joinInvitePreviewSchema>;

export const joinInvitePreviewResponseSchema = z.object({
  organizationName: z.string().min(1),
  organizationSlug: slugSchema,
  membershipStatus: z.enum(["NONE", "SAME_ORG", "OTHER_ORG"]),
  memberOrganizationName: z.string().min(1).nullable(),
  memberOrganizationSlug: slugSchema.nullable(),
});

export type JoinInvitePreviewResponse = z.infer<typeof joinInvitePreviewResponseSchema>;

export const orgRouteContextRequestSchema = z.object({
  slug: slugSchema,
}).strict();

export type OrgRouteContextRequest = z.infer<typeof orgRouteContextRequestSchema>;

export const orgRouteContextSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("MATCH"),
    requestedSlug: slugSchema,
    organizationSlug: slugSchema,
  }),
  z.object({
    status: z.literal("ALIAS_REDIRECT"),
    requestedSlug: slugSchema,
    organizationSlug: slugSchema,
  }),
  z.object({
    status: z.literal("DIFFERENT_ORG"),
    requestedSlug: slugSchema,
    organizationSlug: slugSchema,
    actorOrganizationSlug: slugSchema,
    actorOrganizationName: z.string().min(1),
  }),
  z.object({
    status: z.literal("NO_ACTOR_ORG"),
    requestedSlug: slugSchema,
    organizationSlug: slugSchema.optional(),
  }),
  z.object({
    status: z.literal("NOT_FOUND"),
    requestedSlug: slugSchema,
  }),
]);

export type OrgRouteContext = z.infer<typeof orgRouteContextSchema>;

export const inviteLinkSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  joinPath: z.string().min(1),
  expiresAt: z.string().datetime(),
  usedAt: z.string().datetime().nullable(),
});

export type InviteLink = z.infer<typeof inviteLinkSchema>;
