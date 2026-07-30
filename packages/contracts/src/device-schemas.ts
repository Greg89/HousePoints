import { z } from "zod";

export const DEVICE_PLATFORMS = ["IOS", "ANDROID"] as const;

export const devicePlatformSchema = z.enum(DEVICE_PLATFORMS);
export type DevicePlatform = (typeof DEVICE_PLATFORMS)[number];

export const registerDeviceRequestSchema = z.object({
  platform: devicePlatformSchema,
  pushToken: z.string().min(1).max(512),
  appVersion: z.string().min(1).max(64).optional(),
  locale: z.string().min(1).max(64).optional(),
}).strict();

export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>;

export const registerDeviceResponseSchema = z.object({
  id: z.string().min(1),
});

export type RegisterDeviceResponse = z.infer<typeof registerDeviceResponseSchema>;

export const unregisterDeviceRequestSchema = z.object({
  pushToken: z.string().min(1).max(512),
}).strict();

export type UnregisterDeviceRequest = z.infer<typeof unregisterDeviceRequestSchema>;

export const unregisterDeviceResponseSchema = z.object({
  revoked: z.boolean(),
});

export type UnregisterDeviceResponse = z.infer<typeof unregisterDeviceResponseSchema>;
