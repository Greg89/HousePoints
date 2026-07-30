import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { callApi } from "./api-client";
import {
  registerDeviceForPush,
  unregisterDeviceForPush,
  type NotificationPermissionStatus,
} from "./device-registration-core";
import { env } from "./env";
import { logger, serializeError } from "./logger";
import {
  clearStoredPushToken,
  getStoredActiveOrgSlug,
  getStoredPushToken,
  persistPushToken,
} from "./secure-store";

const ANDROID_CHANNEL_ID = "default";

function permissionStatus(
  value: Notifications.PermissionStatus,
): NotificationPermissionStatus {
  return value === Notifications.PermissionStatus.GRANTED
    ? "granted"
    : value === Notifications.PermissionStatus.DENIED
      ? "denied"
      : "undetermined";
}

async function preparePlatform(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "HousePoints",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

export async function registerCurrentDevice(input: {
  accessToken: string;
  organizationSlug: string;
}): Promise<void> {
  const result = await registerDeviceForPush(input, {
    isPhysicalDevice: Device.isDevice,
    platform: Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : null,
    appVersion: Constants.expoConfig?.version,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    preparePlatform,
    getPermissionStatus: async () =>
      permissionStatus((await Notifications.getPermissionsAsync()).status),
    requestPermission: async () =>
      permissionStatus((await Notifications.requestPermissionsAsync()).status),
    getPushToken: async () =>
      (await Notifications.getExpoPushTokenAsync({
        projectId: env.easProjectId,
      })).data,
    register: async (registration) => {
      await callApi(
        "/devices/register",
        {
          platform: registration.platform,
          pushToken: registration.pushToken,
          ...(registration.appVersion ? { appVersion: registration.appVersion } : {}),
          ...(registration.locale ? { locale: registration.locale } : {}),
        },
        {
          accessToken: registration.accessToken,
          organizationSlug: registration.organizationSlug,
        },
      );
    },
    persistPushToken,
  });

  logger.info(`mobile.devices.${result.status}`, {
    organizationSlug: input.organizationSlug,
  });
}

export async function unregisterCurrentDevice(
  getAccessToken: () => Promise<string>,
): Promise<void> {
  const organizationSlug = await getStoredActiveOrgSlug();
  if (!organizationSlug) {
    await clearStoredPushToken();
    return;
  }

  try {
    const unregistered = await unregisterDeviceForPush({
      readPushToken: getStoredPushToken,
      clearPushToken: clearStoredPushToken,
      unregister: async (pushToken) => {
        const accessToken = await getAccessToken();
        await callApi(
          "/devices/unregister",
          { pushToken },
          { accessToken, organizationSlug },
        );
      },
    });
    if (unregistered) {
      logger.info("mobile.devices.unregistered", { organizationSlug });
    }
  } catch (err) {
    logger.warn("mobile.devices.unregister_failed", serializeError(err));
  }
}

