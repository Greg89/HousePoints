import { z } from "zod";

export const createReleaseAnnouncementSchema = z.object({
  version: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(2_000),
  releaseNotesUrl: z.string().trim().url().max(2_000),
  releasedAt: z.string().datetime(),
}).strict();

export type CreateReleaseAnnouncementInput = z.infer<typeof createReleaseAnnouncementSchema>;

export const releaseAnnouncementSchema = createReleaseAnnouncementSchema.extend({
  id: z.string().min(1),
  broadcastAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ReleaseAnnouncement = z.infer<typeof releaseAnnouncementSchema>;
