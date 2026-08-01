import type { DevicePlatform } from "@housepoints/contracts";

export type NotificationPermissionStatus = "granted" | "denied" | "undetermined";

export type DeviceRegistrationInput = {
  accessToken: string;
  organizationSlug: string;
};

export type DeviceRegistrationDependencies = {
  isPhysicalDevice: boolean;
  platform: DevicePlatform | null;
  appVersion?: string;
  locale?: string;
  preparePlatform: () => Promise<void>;
  getPermissionStatus: () => Promise<NotificationPermissionStatus>;
  requestPermission: () => Promise<NotificationPermissionStatus>;
  getPushToken: () => Promise<string>;
  register: (input: {
    accessToken: string;
    organizationSlug: string;
    platform: DevicePlatform;
    pushToken: string;
    appVersion?: string;
    locale?: string;
  }) => Promise<void>;
  persistPushToken: (token: string) => Promise<void>;
};

export type DeviceRegistrationResult =
  | { status: "registered"; pushToken: string }
  | { status: "permission_denied" | "unsupported_device" };

export async function registerDeviceForPush(
  input: DeviceRegistrationInput,
  deps: DeviceRegistrationDependencies,
): Promise<DeviceRegistrationResult> {
  if (!deps.isPhysicalDevice || !deps.platform) {
    return { status: "unsupported_device" };
  }

  await deps.preparePlatform();
  let permissionStatus = await deps.getPermissionStatus();
  if (permissionStatus === "undetermined") {
    permissionStatus = await deps.requestPermission();
  }
  if (permissionStatus !== "granted") {
    return { status: "permission_denied" };
  }

  const pushToken = await deps.getPushToken();
  await deps.register({
    accessToken: input.accessToken,
    organizationSlug: input.organizationSlug,
    platform: deps.platform,
    pushToken,
    ...(deps.appVersion ? { appVersion: deps.appVersion } : {}),
    ...(deps.locale ? { locale: deps.locale } : {}),
  });
  await deps.persistPushToken(pushToken);
  return { status: "registered", pushToken };
}

export async function unregisterDeviceForPush(input: {
  readPushToken: () => Promise<string | null>;
  clearPushToken: () => Promise<void>;
  unregister: (pushToken: string) => Promise<void>;
}): Promise<boolean> {
  const pushToken = await input.readPushToken();
  if (!pushToken) return false;

  try {
    await input.unregister(pushToken);
    return true;
  } finally {
    await input.clearPushToken();
  }
}

