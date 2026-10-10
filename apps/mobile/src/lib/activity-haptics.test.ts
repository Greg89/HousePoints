import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  platform: { OS: "ios" },
  impact: vi.fn(),
  android: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: mocks.platform }));
vi.mock("expo-haptics", () => ({
  impactAsync: mocks.impact,
  performAndroidHapticsAsync: mocks.android,
  ImpactFeedbackStyle: { Light: "light" },
  AndroidHaptics: { Long_Press: "longPress" },
}));

import { activityLongPressFeedback } from "./activity-haptics";

describe("activity long-press feedback", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses a light impact on iOS", async () => {
    mocks.platform.OS = "ios";
    await activityLongPressFeedback();
    expect(mocks.impact).toHaveBeenCalledWith("light");
  });

  it("uses native long-press feedback on Android", async () => {
    mocks.platform.OS = "android";
    await activityLongPressFeedback();
    expect(mocks.android).toHaveBeenCalledWith("longPress");
  });

  it("tolerates unavailable haptics", async () => {
    mocks.platform.OS = "ios";
    mocks.impact.mockRejectedValue(new Error("Unavailable"));
    await expect(activityLongPressFeedback()).resolves.toBeUndefined();
  });

  it("skips feedback on other platforms", async () => {
    mocks.platform.OS = "web";
    await activityLongPressFeedback();
    expect(mocks.impact).not.toHaveBeenCalled();
    expect(mocks.android).not.toHaveBeenCalled();
  });
});
