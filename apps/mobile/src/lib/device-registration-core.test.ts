import { describe, expect, it, vi } from "vitest";

import {
  registerDeviceForPush,
  unregisterDeviceForPush,
  type DeviceRegistrationDependencies,
} from "./device-registration-core";

function dependencies(
  overrides: Partial<DeviceRegistrationDependencies> = {},
): DeviceRegistrationDependencies {
  return {
    isPhysicalDevice: true,
    platform: "IOS",
    appVersion: "0.1.0",
    locale: "en-US",
    preparePlatform: vi.fn().mockResolvedValue(undefined),
    getPermissionStatus: vi.fn().mockResolvedValue("granted"),
    requestPermission: vi.fn().mockResolvedValue("granted"),
    getPushToken: vi.fn().mockResolvedValue("ExponentPushToken[test]"),
    register: vi.fn().mockResolvedValue(undefined),
    persistPushToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("registerDeviceForPush", () => {
  it("registers and persists a token for an already-authorized physical device", async () => {
    const deps = dependencies();

    await expect(registerDeviceForPush({
      accessToken: "access-token",
      organizationSlug: "acme",
    }, deps)).resolves.toEqual({
      status: "registered",
      pushToken: "ExponentPushToken[test]",
    });

    expect(deps.register).toHaveBeenCalledWith({
      accessToken: "access-token",
      organizationSlug: "acme",
      platform: "IOS",
      pushToken: "ExponentPushToken[test]",
      appVersion: "0.1.0",
      locale: "en-US",
    });
    expect(deps.persistPushToken).toHaveBeenCalledWith("ExponentPushToken[test]");
  });

  it("requests permission only when the status is undetermined", async () => {
    const deps = dependencies({
      getPermissionStatus: vi.fn().mockResolvedValue("undetermined"),
    });

    await registerDeviceForPush({
      accessToken: "access-token",
      organizationSlug: "acme",
    }, deps);

    expect(deps.requestPermission).toHaveBeenCalledOnce();
  });

  it("does not obtain or register a token when permission is denied", async () => {
    const deps = dependencies({
      getPermissionStatus: vi.fn().mockResolvedValue("denied"),
    });

    await expect(registerDeviceForPush({
      accessToken: "access-token",
      organizationSlug: "acme",
    }, deps)).resolves.toEqual({ status: "permission_denied" });
    expect(deps.getPushToken).not.toHaveBeenCalled();
    expect(deps.register).not.toHaveBeenCalled();
  });

  it("skips simulators and unsupported platforms", async () => {
    const deps = dependencies({ isPhysicalDevice: false });

    await expect(registerDeviceForPush({
      accessToken: "access-token",
      organizationSlug: "acme",
    }, deps)).resolves.toEqual({ status: "unsupported_device" });
    expect(deps.preparePlatform).not.toHaveBeenCalled();
  });
});

describe("unregisterDeviceForPush", () => {
  it("unregisters the stored token and clears it", async () => {
    const unregister = vi.fn().mockResolvedValue(undefined);
    const clearPushToken = vi.fn().mockResolvedValue(undefined);

    await expect(unregisterDeviceForPush({
      readPushToken: vi.fn().mockResolvedValue("ExponentPushToken[test]"),
      clearPushToken,
      unregister,
    })).resolves.toBe(true);

    expect(unregister).toHaveBeenCalledWith("ExponentPushToken[test]");
    expect(clearPushToken).toHaveBeenCalledOnce();
  });

  it("clears the stored token even when the API call fails", async () => {
    const clearPushToken = vi.fn().mockResolvedValue(undefined);

    await expect(unregisterDeviceForPush({
      readPushToken: vi.fn().mockResolvedValue("ExponentPushToken[test]"),
      clearPushToken,
      unregister: vi.fn().mockRejectedValue(new Error("offline")),
    })).rejects.toThrow("offline");
    expect(clearPushToken).toHaveBeenCalledOnce();
  });
});
