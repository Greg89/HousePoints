import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ push: vi.fn(), haptic: vi.fn() }));
vi.mock("expo-router", () => ({ router: { push: mocks.push } }));
vi.mock("@/lib/activity-haptics", () => ({ activityLongPressFeedback: mocks.haptic }));
vi.mock("react-native", () => ({ Pressable: "Pressable" }));
import { MemberDetailsLink } from "./MemberDetailsLink";

describe("shared member navigation", () => {
  it("opens the selected member on long press with feedback", () => {
    vi.clearAllMocks();
    const element = MemberDetailsLink({ memberId: "m", name: "Alex", children: null });
    expect(element.props.delayLongPress).toBe(350);
    element.props.onLongPress();
    expect(mocks.haptic).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/member/[memberId]", params: { memberId: "m" } });
  });
  it("offers a screen-reader equivalent", () => {
    vi.clearAllMocks();
    const element = MemberDetailsLink({ memberId: "m2", name: "Alex", children: null });
    element.props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } });
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/member/[memberId]", params: { memberId: "m2" } });
  });
});
