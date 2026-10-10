import { Children, isValidElement, type ReactNode, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ push: vi.fn(), haptic: vi.fn() }));
vi.mock("expo-router", () => ({ router: { push: mocks.push } }));
vi.mock("@/lib/activity-haptics", () => ({ activityLongPressFeedback: mocks.haptic }));
vi.mock("react-native", () => ({
  Pressable: "Pressable", Text: "Text", View: "View", StyleSheet: { create: (styles: unknown) => styles },
}));
import { HousesSection } from "./HousesSection";

type Props = { children?: ReactNode; testID?: string; delayLongPress?: number; onLongPress?: () => void; onPress?: () => void; onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void };
function elements(node: ReactNode): ReactElement<Props>[] {
  return Children.toArray(node).flatMap(child => isValidElement<Props>(child) ? [child, ...elements(child.props.children)] : []);
}
const houses = [
  { id: "a", name: "Alpha", color: "#123456", description: null, score: 5, memberCount: 2, transactions: 1 },
  { id: "b", name: "Beta", color: "#654321", description: null, score: 10, memberCount: 3, transactions: 2 },
];
describe("Home house navigation", () => {
  it("opens the selected house with haptics on long press, retaining score order", () => {
    vi.clearAllMocks();
    const rows = elements(HousesSection({ houses })).filter(node => node.props.testID);
    expect(rows.map(row => row.props.testID)).toEqual(["mobile.home.house.b", "mobile.home.house.a"]);
    expect(rows[0].props.onPress).toBeUndefined();
    expect(rows[0].props.delayLongPress).toBe(350);
    rows[1].props.onLongPress?.();
    expect(mocks.haptic).toHaveBeenCalledOnce();
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/house/[houseId]", params: { houseId: "a" } });
  });
  it("offers an accessible equivalent to the long-press gesture", () => {
    vi.clearAllMocks();
    const row = elements(HousesSection({ houses })).find(node => node.props.testID);
    row?.props.onAccessibilityAction?.({ nativeEvent: { actionName: "activate" } });
    expect(mocks.push).toHaveBeenCalledWith({ pathname: "/house/[houseId]", params: { houseId: "b" } });
  });
  it("does not create navigation targets for an empty organization", () => {
    expect(elements(HousesSection({ houses: [] })).filter(node => node.props.testID)).toEqual([]);
  });
});
