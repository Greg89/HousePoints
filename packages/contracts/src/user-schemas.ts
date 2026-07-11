import { z } from "zod";

export const bootstrapUserSchema = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(120),
}).strict();

export type BootstrapUserInput = z.infer<typeof bootstrapUserSchema>;

const userRoleSchema = z.enum(["MEMBER", "ADMIN", "OWNER"]);
const houseThemeModeSchema = z.enum(["GENERATED", "CUSTOM"]);

export const appUserOrganizationContextSchema = z.object({
  organizationId: z.string(),
  organizationName: z.string(),
  organizationSlug: z.string(),
  role: userRoleSchema,
  houseId: z.string().nullable(),
  houseName: z.string().nullable(),
  houseColor: z.string().nullable(),
  houseThemeMode: houseThemeModeSchema.nullable().optional(),
  houseThemeSecondaryColor: z.string().nullable().optional(),
  houseThemeSurfaceColor: z.string().nullable().optional(),
  isCurrent: z.boolean(),
});

export const appUserSchema = z.object({
  id: z.string(),
  auth0Sub: z.string(),
  email: z.string().nullable(),
  displayName: z.string(),
  houseThemeEnabled: z.boolean(),
  role: userRoleSchema,
  organizationId: z.string().nullable(),
  organizationSlug: z.string().nullable(),
  houseId: z.string().nullable(),
  houseName: z.string().nullable(),
  houseColor: z.string().nullable(),
  houseThemeMode: houseThemeModeSchema.nullable().optional(),
  houseThemeSecondaryColor: z.string().nullable().optional(),
  houseThemeSurfaceColor: z.string().nullable().optional(),
  organizationContexts: z.array(appUserOrganizationContextSchema).default([]),
  created: z.boolean(),
});

export type AppUser = z.infer<typeof appUserSchema>;
export type AppUserOrganizationContext = z.infer<typeof appUserOrganizationContextSchema>;
export type UserRole = AppUser["role"];

export const orgMemberSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: userRoleSchema,
  houseId: z.string().nullable(),
  houseName: z.string().nullable(),
  houseColor: z.string().nullable(),
});

export type OrgMember = z.infer<typeof orgMemberSchema>;
export const orgMembersSchema = z.array(orgMemberSchema);

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  houseThemeEnabled: z.boolean().optional(),
}).strict().refine(
  (input) => input.displayName !== undefined || input.houseThemeEnabled !== undefined,
  { message: "At least one profile field is required." },
);

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updateProfileResponseSchema = appUserSchema.omit({ created: true }).strict();

export type UpdateProfileResponse = z.infer<
  typeof updateProfileResponseSchema
>;
