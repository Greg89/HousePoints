import { z } from "zod";

export const reportClientErrorSchema = z.object({ type: z.enum(["error", "unhandledrejection"]), message: z.string().trim().min(1).max(500), sourcePath: z.string().trim().min(1).max(500).nullable() }).strict();
export const reportClientErrorResponseSchema = z.object({ recorded: z.boolean() });
